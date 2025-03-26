import { Observable } from 'rxjs';

// biome-ignore lint/correctness/noUndeclaredVariables: <explanation>
export function createAudioDecodeStream(configuration: AudioDecoderConfig): {
  decoder: AudioDecoder;
  frame$: Observable<AudioData>;
} {
  let decoder!: VideoDecoder;
  const frame$ = new Observable<AudioData>((subscriber) => {
    let isFinalized = false;
    decoder = new AudioDecoder({
      output: (frame) => subscriber.next(frame),
      error: (e) => {
        if (!isFinalized) {
          isFinalized = true;
          subscriber.error(e);
        }
      },
    });

    decoder.configure(configuration);

    return () => {
      if (!isFinalized) {
        isFinalized = true;
        decoder.close();
      }
    };
  });

  return {
    decoder,
    frame$,
  };
}
