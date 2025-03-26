import { html, css, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import {
  animationFrames,
  BehaviorSubject,
  combineLatest,
  EMPTY,
  map,
  Subject,
  switchMap,
  take,
  distinctUntilChanged,
  fromEvent,
  share,
  takeUntil,
  firstValueFrom,
  tap,
  throwIfEmpty,
  ReplaySubject,
} from 'rxjs';
import { createMatroska } from '@konoplayer/matroska/model';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { Queue } from 'mnemonist';

import type {
  AudioTrackContext,
  VideoTrackContext,
} from '@konoplayer/matroska/systems';
import {
  captureCanvasAsVideoSrcObject,
  createRenderingContext,
  renderBitmapAtRenderingContext,
} from '@konoplayer/core/graphics';

export class VideoPipelineDemo extends LitElement {
  static styles = css``;

  @property()
  src!: string;

  @property({ type: Number })
  width = 1280;

  @property({ type: Number })
  height = 720;

  destroyRef$ = new Subject<void>();

  videoRef: Ref<HTMLVideoElement> = createRef();
  renderingContext = createRenderingContext();
  audioContext = new AudioContext({});

  seeked$ = new ReplaySubject<number>(1);

  videoFrameBuffer$ = new BehaviorSubject(new Queue<VideoFrame>());
  audioFrameBuffer$ = new BehaviorSubject(new Queue<AudioData>());

  paused$ = new BehaviorSubject<boolean>(false);
  ended$ = new BehaviorSubject<boolean>(false);

  currentTime$ = new BehaviorSubject<number>(0);
  duration$ = new BehaviorSubject<number>(0);
  frameRate$ = new BehaviorSubject<number>(30);

  videoTrack$ = new BehaviorSubject<VideoTrackContext | undefined>(undefined);
  audioTrack$ = new BehaviorSubject<AudioTrackContext | undefined>(undefined);

  private async preparePipeline() {
    const src = this.src;
    const destroyRef$ = this.destroyRef$;

    if (!src) {
      return;
    }

    const {
      segment: {
        seek,
        defaultVideoTrack$,
        defaultAudioTrack$,
        videoTrackDecoder,
        audioTrackDecoder,
      },
      totalSize,
    } = await firstValueFrom(
      createMatroska({
        url: src,
      }).pipe(throwIfEmpty(() => new Error('failed to extract matroska')))
    );

    console.debug(`[MATROSKA]: loaded metadata, total size ${totalSize} bytes`);

    const currentCluster$ = this.seeked$.pipe(
      switchMap((seekTime) => seek(seekTime)),
      share({
        resetOnRefCountZero: false,
        resetOnError: false,
        resetOnComplete: false,
      })
    );

    defaultVideoTrack$
      .pipe(
        take(1),
        takeUntil(destroyRef$),
        tap((track) => console.debug('[MATROSKA]: video track loaded,', track))
      )
      .subscribe(this.videoTrack$.next.bind(this.videoTrack$));

    defaultAudioTrack$
      .pipe(
        take(1),
        takeUntil(destroyRef$),
        tap((track) => console.debug('[MATROSKA]: audio track loaded,', track))
      )
      .subscribe(this.audioTrack$.next.bind(this.audioTrack$));

    this.videoTrack$
      .pipe(
        takeUntil(this.destroyRef$),
        switchMap((track) =>
          track?.configuration
            ? videoTrackDecoder(track, currentCluster$)
            : EMPTY
        ),
        switchMap(({ frame$ }) => frame$)
      )
      .subscribe((frame) => {
        const buffer = this.videoFrameBuffer$.value;
        buffer.enqueue(frame);
        this.videoFrameBuffer$.next(buffer);
      });

    this.audioTrack$
      .pipe(
        takeUntil(this.destroyRef$),
        switchMap((track) =>
          track?.configuration
            ? audioTrackDecoder(track, currentCluster$)
            : EMPTY
        ),
        switchMap(({ frame$ }) => frame$)
      )
      .subscribe((frame) => {
        const buffer = this.audioFrameBuffer$.value;
        buffer.enqueue(frame);
        this.audioFrameBuffer$.next(buffer);
      });

    let playableStartTime = 0;
    const playable = combineLatest({
      paused: this.paused$,
      ended: this.ended$,
      audioBuffered: this.audioFrameBuffer$.pipe(
        map((q) => q.size >= 1),
        distinctUntilChanged()
      ),
      videoBuffered: this.videoFrameBuffer$.pipe(
        map((q) => q.size >= 1),
        distinctUntilChanged()
      ),
    }).pipe(
      takeUntil(this.destroyRef$),
      map(
        ({ ended, paused, videoBuffered, audioBuffered }) =>
          !paused && !ended && !!(videoBuffered || audioBuffered)
      ),
      tap((enabled) => {
        if (enabled) {
          playableStartTime = performance.now();
        }
      }),
      share()
    );

    let nextAudioStartTime = 0;
    playable
      .pipe(
        tap(() => {
          nextAudioStartTime = 0;
        }),
        switchMap((enabled) => (enabled ? animationFrames() : EMPTY))
      )
      .subscribe(() => {
        const audioFrameBuffer = this.audioFrameBuffer$.getValue();
        const audioContext = this.audioContext;
        const nowTime = performance.now();
        const accTime = nowTime - playableStartTime;
        let audioChanged = false;
        while (audioFrameBuffer.size > 0) {
          const firstAudio = audioFrameBuffer.peek();
          if (firstAudio && firstAudio.timestamp / 1000 <= accTime) {
            const audioFrame = audioFrameBuffer.dequeue()!;
            audioChanged = true;
            if (audioContext) {
              const numberOfChannels = audioFrame.numberOfChannels;
              const sampleRate = audioFrame.sampleRate;
              const numberOfFrames = audioFrame.numberOfFrames;

              const audioBuffer = audioContext.createBuffer(
                numberOfChannels,
                numberOfFrames,
                sampleRate
              );

              // add fade-in-out
              const fadeLength = Math.min(50, audioFrame.numberOfFrames);
              for (let channel = 0; channel < numberOfChannels; channel++) {
                const channelData = new Float32Array(numberOfFrames);
                audioFrame.copyTo(channelData, {
                  planeIndex: channel,
                  frameCount: numberOfFrames,
                });
                for (let i = 0; i < fadeLength; i++) {
                  channelData[i] *= i / fadeLength; // fade-in
                  channelData[audioFrame.numberOfFrames - 1 - i] *=
                    i / fadeLength; // fade-out
                }
                audioBuffer.copyToChannel(channelData, channel);
              }

              /**
               * @TODO: ADD TIME SYNC
               */
              const audioTime = audioFrame.timestamp / 1_000_000;

              audioFrame.close();

              if (audioContext.state === 'running') {
                const audioSource = audioContext.createBufferSource();
                audioSource.buffer = audioBuffer;
                audioSource.connect(audioContext.destination);
                const currentTime = audioContext.currentTime;
                nextAudioStartTime = Math.max(nextAudioStartTime, currentTime); // 确保不早于当前时间
                audioSource.start(nextAudioStartTime);
                nextAudioStartTime += audioBuffer.duration;
              }
            }
          } else {
            break;
          }
        }
        if (audioChanged) {
          this.audioFrameBuffer$.next(this.audioFrameBuffer$.getValue());
        }
      });

    playable
      .pipe(switchMap((enabled) => (enabled ? animationFrames() : EMPTY)))
      .subscribe(async () => {
        const renderingContext = this.renderingContext;
        const videoFrameBuffer = this.videoFrameBuffer$.getValue();
        let videoChanged = false;
        const nowTime = performance.now();
        const accTime = nowTime - playableStartTime;
        while (videoFrameBuffer.size > 0) {
          const firstVideo = videoFrameBuffer.peek();
          if (firstVideo && firstVideo.timestamp / 1000 <= accTime) {
            const videoFrame = videoFrameBuffer.dequeue()!;
            videoChanged = true;
            if (renderingContext) {
              const bitmap = await createImageBitmap(videoFrame);
              renderBitmapAtRenderingContext(renderingContext, bitmap);
            }
            videoFrame.close();
          } else {
            break;
          }
        }
        if (videoChanged) {
          this.videoFrameBuffer$.next(videoFrameBuffer);
        }
      });

    fromEvent(document.body, 'click')
      .pipe(takeUntil(this.destroyRef$))
      .subscribe(async () => {
        const permissionStatus = await navigator.permissions.query({
          name: 'microphone',
        });
        if (permissionStatus.state === 'prompt') {
          await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
        }
        this.audioContext.resume();
        this.audioFrameBuffer$.next(this.audioFrameBuffer$.getValue());
      });

    const permissionStatus = await navigator.permissions.query({
      name: 'microphone',
    });
    if (permissionStatus.state === 'granted') {
      await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      this.audioContext.resume();
    }

    this.seeked$.next(0);
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.preparePipeline();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyRef$.next(undefined);
  }

  firstUpdated() {
    const video = this.videoRef.value;
    const context = this.renderingContext;
    const frameRate$ = this.frameRate$;
    const destroyRef$ = this.destroyRef$;
    const currentTime$ = this.currentTime$;
    const duration$ = this.duration$;
    const seeked$ = this.seeked$;

    if (!video) {
      return;
    }
    const canvas = context.canvas as HTMLCanvasElement;

    Object.defineProperty(video, 'duration', {
      get: () => duration$.value,
      set: (val: number) => {
        duration$.next(val);
      },
      configurable: true,
    });

    Object.defineProperty(video, 'currentTime', {
      get: () => currentTime$.value,
      set: (val: number) => {
        currentTime$.next(val);
        seeked$.next(val);
      },
      configurable: true,
    });

    frameRate$
      .pipe(takeUntil(destroyRef$), distinctUntilChanged())
      .subscribe((frameRate) => {
        canvas.width = this.width || 1;
        canvas.height = this.height || 1;
        captureCanvasAsVideoSrcObject(video, canvas, frameRate);
      });
  }

  render() {
    return html`
        <video ref=${ref(this.videoRef)} width=${this.width} height=${this.height} autoplay muted></video>
      `;
  }
}
