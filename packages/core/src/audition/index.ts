import {map, Observable, Subject} from 'rxjs';


// biome-ignore lint/correctness/noUndeclaredVariables: <explanation>
export function createAudioDecodeStream(configuration: AudioDecoderConfig): Observable<{
  decoder: AudioDecoder;
  frame$: Observable<AudioData>;
}> {
  const frame$ = new Subject<AudioData>()
  const decoder$ = new Observable<AudioDecoder>((subscriber) => {
    let isFinalized = false;
    const decoder = new AudioDecoder({
      output: (frame) => frame$.next(frame),
      error: (e) => {
        if (!isFinalized) {
          isFinalized = true;
          frame$.error(e);
          subscriber.error(e);
        }
      },
    });

    decoder.configure(configuration);

    subscriber.next(decoder);

    return () => {
      if (!isFinalized) {
        isFinalized = true;
        frame$.complete();
        decoder.close();
      }
    };
  })

  return decoder$.pipe(map((decoder) => ({
    decoder,
    frame$
  })));
}
