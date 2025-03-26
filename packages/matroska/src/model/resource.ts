import {
  type CreateRangedStreamOptions,
  createRangedStream,
} from '@konoplayer/core/data';
import { type EbmlTagType, EbmlStreamDecoder, EbmlTagIdEnum } from 'konoebml';
import { Observable, from, switchMap, share, defer, EMPTY, of } from 'rxjs';
import { waitTick } from '../util';

export function createRangedEbmlStream({
  url,
  byteStart = 0,
  byteEnd,
}: CreateRangedStreamOptions): Observable<{
  ebml$: Observable<EbmlTagType>;
  totalSize?: number;
  response: Response;
  body: ReadableStream<Uint8Array>;
  controller: AbortController;
}> {
  const stream$ = from(createRangedStream({ url, byteStart, byteEnd }));

  return stream$.pipe(
    switchMap(({ controller, body, totalSize, response }) => {
      let requestCompleted = false;

      const originRequest$ = new Observable<EbmlTagType>((subscriber) => {
        body
          .pipeThrough(
            new EbmlStreamDecoder({
              streamStartOffset: byteStart,
              collectChild: (child) => child.id !== EbmlTagIdEnum.Cluster,
              backpressure: {
                eventLoop: waitTick,
              },
            })
          )
          .pipeTo(
            new WritableStream({
              write: async (tag) => {
                await waitTick();
                subscriber.next(tag);
              },
              close: () => {
                if (!requestCompleted) {
                  requestCompleted = true;
                  subscriber.complete();
                }
              },
            })
          )
          .catch((error) => {
            if (requestCompleted && error?.name === 'AbortError') {
              return;
            }
            requestCompleted = true;
            subscriber.error(error);
          });

        return () => {
          requestCompleted = true;
          controller.abort();
        };
      }).pipe(
        share({
          resetOnComplete: false,
          resetOnError: false,
          resetOnRefCountZero: true,
        })
      );

      const ebml$ = defer(() =>
        requestCompleted ? EMPTY : originRequest$
      ).pipe(
        share({
          resetOnError: false,
          resetOnComplete: true,
          resetOnRefCountZero: true,
        })
      );

      return of({
        ebml$,
        totalSize,
        response,
        body,
        controller,
      });
    })
  );
}
