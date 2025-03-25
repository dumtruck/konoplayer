import {
  type CreateRangedStreamOptions,
  createRangedStream,
} from '@konoplayer/core/data';
import { type EbmlTagType, EbmlStreamDecoder, EbmlTagIdEnum } from 'konoebml';
import {Observable, from, switchMap, share, defer, EMPTY, of, tap} from 'rxjs';
import { waitTick } from '../util';

export interface CreateRangedEbmlStreamOptions extends CreateRangedStreamOptions {
  refCount?: boolean
}

export function createRangedEbmlStream({
  url,
  byteStart = 0,
  byteEnd
}: CreateRangedEbmlStreamOptions): Observable<{
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

      const ebml$ = new Observable<EbmlTagType>((subscriber) => {
        if (requestCompleted) {
          subscriber.complete();
        }
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
          if (!requestCompleted) {
            requestCompleted = true;
            controller.abort();
          }
        };
      }).pipe(
        share({
          resetOnComplete: false,
          resetOnError: false,
          resetOnRefCountZero: true,
        })
      );

      return of({
        totalSize,
        response,
        body,
        controller,
        ebml$
      });
    })
  );
}
