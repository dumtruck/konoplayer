import { html, css, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import {
  animationFrames,
  BehaviorSubject,
  combineLatest,
  ReplaySubject,
  EMPTY,
  map,
  Observable,
  shareReplay,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
  distinctUntilChanged,
  fromEvent,
  filter,
} from 'rxjs';
import { createEbmlController } from './media/mkv/reactive';
import { TrackTypeRestrictionEnum, type ClusterType } from './media/mkv/schema';
import type { SegmentComponent } from './media/mkv/model';
import { createRef, ref, type Ref } from 'lit/directives/ref.js';
import { Queue } from 'mnemonist';

export class VideoPipelineDemo extends LitElement {
  static styles = css``;

  @property()
  src!: string;

  @property({ type: Number })
  width = 1280;

  @property({ type: Number })
  height = 720;

  canvasRef: Ref<HTMLCanvasElement> = createRef();
  audioContext = new AudioContext();

  seek$ = new ReplaySubject<number>(1);
  cluster$ = new Subject<SegmentComponent<ClusterType>>();
  videoFrameBuffer$ = new BehaviorSubject(new Queue<VideoFrame>());
  audioFrameBuffer$ = new BehaviorSubject(new Queue<AudioData>());
  pipeline$$?: Subscription;
  private startTime = 0;

  paused$ = new BehaviorSubject<boolean>(false);
  ended$ = new BehaviorSubject<boolean>(false);

  private preparePipeline() {
    const src = this.src;
    if (!src) {
      return;
    }

    const { controller$ } = createEbmlController({
      url: src,
    });

    const segment$ = controller$.pipe(
      switchMap(({ segments$ }) => segments$.pipe(take(1)))
    );

    const cluster$ = combineLatest({
      seekTime: this.seek$,
      segment: segment$,
    }).pipe(switchMap(({ seekTime, segment }) => segment.seek(seekTime)));

    const decode$ = segment$.pipe(
      switchMap(({ withMeta$ }) => withMeta$),
      map((segment) => {
        const trackSystem = segment.track;
        const infoSystem = segment.info;
        const tracks = {
          video: trackSystem.getTrackEntry({
            predicate: (c) =>
              c.TrackType === TrackTypeRestrictionEnum.VIDEO &&
              c.FlagEnabled !== 0,
          }),
          audio: trackSystem.getTrackEntry({
            predicate: (c) =>
              c.TrackType === TrackTypeRestrictionEnum.AUDIO &&
              c.FlagEnabled !== 0,
          }),
          subtitle: trackSystem.getTrackEntry({
            predicate: (c) =>
              c.TrackType === TrackTypeRestrictionEnum.SUBTITLE &&
              c.FlagEnabled !== 0,
          }),
        };

        const videoDecode$ = tracks.video
          ? new Observable<VideoFrame>((subscriber) => {
              let isFinalized = false;
              const videoTrack = tracks.video!;
              const decoder = new VideoDecoder({
                output: (frame) => {
                  subscriber.next(frame);
                },
                error: (e) => {
                  if (!isFinalized) {
                    isFinalized = true;
                    subscriber.error(e);
                  }
                },
              });

              decoder.configure({
                codec: 'hev1.2.2.L93.B0', // codec: 'vp8',
                hardwareAcceleration: 'prefer-hardware',
                description: videoTrack.CodecPrivate, // Uint8Array，包含 VPS/SPS/PPS
              });

              // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
              const sub = this.cluster$.subscribe((c) => {
                if (!isFinalized) {
                  for (const b of (c.SimpleBlock || []).filter(
                    (b) => b.track === videoTrack.TrackNumber
                  )) {
                    const chunk = new EncodedVideoChunk({
                      type: b.keyframe ? 'key' : 'delta',
                      timestamp:
                        ((infoSystem.info.TimestampScale as number) / 1000) *
                        ((c.Timestamp as number) + b.value),
                      data: b.payload,
                    });
                    decoder.decode(chunk);
                  }
                }
              });

              return () => {
                if (!isFinalized) {
                  isFinalized = true;
                  decoder.close();
                }
                sub.unsubscribe();
              };
            })
          : EMPTY;

        const audioDecode$ = tracks.audio
          ? new Observable<AudioData>((subscriber) => {
              let isFinalized = false;

              const decoder = new AudioDecoder({
                output: (audioData) => {
                  subscriber.next(audioData);
                },
                error: (e) => {
                  if (!isFinalized) {
                    isFinalized = true;
                    subscriber.error(e);
                  }
                },
              });

              const audioTrack = tracks.audio!;
              const sampleRate = audioTrack.Audio?.SamplingFrequency || 44100;
              const codec = 'mp4a.40.2';
              const numberOfChannels =
                (audioTrack.Audio?.Channels as number) || 2;
              const duration =
                Math.round(Number(audioTrack.DefaultDuration / 1000)) ||
                Math.round((1024 / sampleRate) * 1000000);

              decoder.configure({
                codec: codec,
                description: audioTrack.CodecPrivate,
                numberOfChannels,
                sampleRate,
              });

              // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
              const sub = this.cluster$.subscribe((c) => {
                if (!isFinalized) {
                  for (const b of (c.SimpleBlock || []).filter(
                    (b) => b.track === audioTrack.TrackNumber
                  )) {
                    const blockTime = (c.Timestamp as number) + b.value;
                    let n = 0;
                    for (const f of b.frames) {
                      const offsetTimeUs = (n + 1) * duration;
                      decoder.decode(
                        new EncodedAudioChunk({
                          type: b.keyframe ? 'key' : 'delta',
                          timestamp:
                            ((infoSystem.info.TimestampScale as number) /
                              1000) *
                              blockTime +
                            offsetTimeUs,
                          data: f,
                        })
                      );
                      n += 1;
                    }
                  }
                }
              });

              return () => {
                if (!isFinalized) {
                  isFinalized = true;
                }
                sub.unsubscribe();
              };
            })
          : EMPTY;

        return {
          video$: videoDecode$,
          audio$: audioDecode$,
        };
      }),
      shareReplay(1)
    );

    const addToVideoFrameBuffer$ = decode$.pipe(
      switchMap((decode) => decode.video$),
      tap((frame) => {
        const buffer = this.videoFrameBuffer$.getValue();
        buffer.enqueue(frame);
        this.videoFrameBuffer$.next(buffer);
      })
    );

    const addToAudioFrameBuffer$ = decode$.pipe(
      switchMap((decode) => decode.audio$),
      tap((frame) => {
        const buffer = this.audioFrameBuffer$.getValue();
        buffer.enqueue(frame);
        this.audioFrameBuffer$.next(buffer);
      })
    );

    const audio$ = combineLatest({
      paused: this.paused$,
      ended: this.ended$,
      buffered: this.audioFrameBuffer$.pipe(
        map((q) => q.size >= 1),
        distinctUntilChanged()
      ),
    }).pipe(
      map(({ ended, paused, buffered }) => !paused && !ended && !!buffered),
      switchMap((enabled) => (enabled ? animationFrames() : EMPTY)),
      // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
      tap(() => {
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
      })
    );

    const video$ = combineLatest({
      paused: this.paused$,
      ended: this.ended$,
      buffered: this.videoFrameBuffer$.pipe(
        map((q) => q.size >= 1),
        distinctUntilChanged()
      ),
    }).pipe(
      map(({ ended, paused, buffered }) => !paused && !ended && !!buffered),
      switchMap((enabled) => (enabled ? animationFrames() : EMPTY)),
      tap(() => {
        const videoFrameBuffer = this.videoFrameBuffer$.getValue();
        let videoChanged = false;
        const nowTime = performance.now();
        const accTime = nowTime - this.startTime;
        while (videoFrameBuffer.size > 0) {
          const firstVideo = videoFrameBuffer.peek();
          if (firstVideo && firstVideo.timestamp <= accTime * 1000) {
            const videoFrame = videoFrameBuffer.dequeue()!;
            const canvas = this.canvasRef.value;
            const canvas2dContext = canvas?.getContext('2d');
            if (canvas2dContext) {
              canvas2dContext.drawImage(
                videoFrame,
                0,
                0,
                this.width,
                this.height
              );
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
      })
    );

    this.pipeline$$ = new Subscription();
    this.pipeline$$.add(audio$.subscribe());
    this.pipeline$$.add(video$.subscribe());
    this.pipeline$$.add(addToVideoFrameBuffer$.subscribe());
    this.pipeline$$.add(addToAudioFrameBuffer$.subscribe());
    this.pipeline$$.add(cluster$.subscribe(this.cluster$));
    this.pipeline$$.add(
      fromEvent(document.body, 'click').subscribe(() => {
        this.audioContext.resume();
        this.audioFrameBuffer$.next(this.audioFrameBuffer$.getValue());
      })
    );
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.preparePipeline();
    this.seek(0);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.pipeline$$?.unsubscribe();
  }

  seek(seekTime: number) {
    this.seek$.next(seekTime);
  }

  play() {
    this.paused$.next(false);
  }

  pause() {
    this.paused$.next(true);
  }

  render() {
    return html`
      <canvas ref=${ref(this.canvasRef)} width=${this.width} height=${this.height}></canvas>
      `;
  }
}
