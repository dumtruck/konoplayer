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
  audioContext = new AudioContext();
  canvasSource = new MediaSource();

  seeked$ = new Subject<number>();

  videoFrameBuffer$ = new BehaviorSubject(new Queue<VideoFrame>());
  audioFrameBuffer$ = new BehaviorSubject(new Queue<AudioData>());
  private startTime = 0;

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
    } = await firstValueFrom(
      createMatroska({
        url: src,
      })
    );

    const currentCluster$ = this.seeked$.pipe(
      switchMap((seekTime) => seek(seekTime)),
      share()
    );

    defaultVideoTrack$
      .pipe(takeUntil(destroyRef$), take(1))
      .subscribe(this.videoTrack$);

    defaultAudioTrack$
      .pipe(takeUntil(destroyRef$), take(1))
      .subscribe(this.audioTrack$);

    this.videoTrack$
      .pipe(
        takeUntil(this.destroyRef$),
        map((track) =>
          track ? videoTrackDecoder(track, currentCluster$) : undefined
        ),
        switchMap((decoder) => {
          if (!decoder) {
            return EMPTY;
          }
          return decoder.frame$;
        })
      )
      .subscribe((frame) => {
        const buffer = this.videoFrameBuffer$.value;
        buffer.enqueue(frame);
        this.videoFrameBuffer$.next(buffer);
      });

    this.audioTrack$
      .pipe(
        takeUntil(this.destroyRef$),
        map((track) =>
          track ? audioTrackDecoder(track, currentCluster$) : undefined
        ),
        switchMap((decoder) => {
          if (!decoder) {
            return EMPTY;
          }
          return decoder.frame$;
        })
      )
      .subscribe((frame) => {
        const buffer = this.audioFrameBuffer$.value;
        buffer.enqueue(frame);
        this.audioFrameBuffer$.next(buffer);
      });

    combineLatest({
      paused: this.paused$,
      ended: this.ended$,
      buffered: this.audioFrameBuffer$.pipe(
        map((q) => q.size >= 1),
        distinctUntilChanged()
      ),
    })
      .pipe(
        takeUntil(this.destroyRef$),
        map(({ ended, paused, buffered }) => !paused && !ended && !!buffered),
        switchMap((enabled) => (enabled ? animationFrames() : EMPTY))
      )
      .subscribe(() => {
        const audioFrameBuffer = this.audioFrameBuffer$.getValue();
        const nowTime = performance.now();
        const accTime = nowTime - this.startTime;
        let audioChanged = false;
        while (audioFrameBuffer.size > 0) {
          const firstAudio = audioFrameBuffer.peek();
          if (firstAudio && firstAudio.timestamp <= accTime * 1000) {
            const audioFrame = audioFrameBuffer.dequeue()!;
            audioChanged = true;
            const audioContext = this.audioContext;

            if (audioContext) {
              const numberOfChannels = audioFrame.numberOfChannels;
              const sampleRate = audioFrame.sampleRate;
              const numberOfFrames = audioFrame.numberOfFrames;
              const data = new Float32Array(numberOfFrames * numberOfChannels);
              audioFrame.copyTo(data, {
                planeIndex: 0,
              });

              const audioBuffer = audioContext.createBuffer(
                numberOfChannels,
                numberOfFrames,
                sampleRate
              );

              for (let channel = 0; channel < numberOfChannels; channel++) {
                const channelData = audioBuffer.getChannelData(channel);
                for (let i = 0; i < numberOfFrames; i++) {
                  channelData[i] = data[i * numberOfChannels + channel];
                }
              }

              const audioTime = audioFrame.timestamp / 1000000;

              audioFrame.close();

              if (audioContext.state === 'running') {
                const audioSource = audioContext.createBufferSource();
                audioSource.buffer = audioBuffer;
                audioSource.connect(audioContext.destination);

                audioSource.start(
                  audioContext.currentTime +
                    Math.max(0, audioTime - accTime / 1000)
                );
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

    combineLatest({
      paused: this.paused$,
      ended: this.ended$,
      buffered: this.videoFrameBuffer$.pipe(
        map((q) => q.size >= 1),
        distinctUntilChanged()
      ),
    })
      .pipe(
        takeUntil(this.destroyRef$),
        map(({ ended, paused, buffered }) => !paused && !ended && !!buffered),
        switchMap((enabled) => (enabled ? animationFrames() : EMPTY))
      )
      .subscribe(async () => {
        const videoFrameBuffer = this.videoFrameBuffer$.getValue();
        let videoChanged = false;
        const nowTime = performance.now();
        const accTime = nowTime - this.startTime;
        while (videoFrameBuffer.size > 0) {
          const firstVideo = videoFrameBuffer.peek();
          if (firstVideo && firstVideo.timestamp <= accTime * 1000) {
            const videoFrame = videoFrameBuffer.dequeue()!;
            const renderingContext = this.renderingContext;
            if (renderingContext) {
              const bitmap = await createImageBitmap(videoFrame);
              renderBitmapAtRenderingContext(renderingContext, bitmap);
              videoFrame.close();
              videoChanged = true;
            }
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
      .subscribe(() => {
        this.audioContext.resume();
        this.audioFrameBuffer$.next(this.audioFrameBuffer$.getValue());
      });
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.preparePipeline();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.destroyRef$.next();
  }

  render() {
    return html`
        <video ref=${ref(this.videoRef)}></video>
      `;
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
      .subscribe((frameRate) =>
        captureCanvasAsVideoSrcObject(video, canvas, frameRate)
      );
  }
}
