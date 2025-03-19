import {
  type EbmlTagType,
  EbmlStreamDecoder,
  EbmlTagIdEnum,
  EbmlTagPosition,
} from 'konoebml';
import {
  Observable,
  from,
  switchMap,
  share,
  defer,
  EMPTY,
  of,
  filter,
  finalize,
  isEmpty,
  map,
  merge,
  raceWith,
  reduce,
  scan,
  shareReplay,
  take,
  takeUntil,
  withLatestFrom,
} from 'rxjs';
import { createRangedStream } from '@/fetch';
import { EbmlSegment, Cluster, SEEK_ID_KAX_CUES, Cues } from './model';
import { isTagIdPos } from './util';

export function createRangedEbmlStream(
  url: string,
  byteStart = 0,
  byteEnd?: number
): Observable<{
  ebml$: Observable<EbmlTagType>;
  totalSize?: number;
  response: Response;
  body: ReadableStream<Uint8Array>;
  controller: AbortController;
}> {
  const stream$ = from(createRangedStream(url, byteStart, byteEnd));

  return stream$.pipe(
    switchMap(({ controller, body, totalSize, response }) => {
      let requestCompleted = false;
      const originRequest$ = new Observable<EbmlTagType>((subscriber) => {
        body
          .pipeThrough(
            new EbmlStreamDecoder({
              streamStartOffset: byteStart,
              collectChild: (child) => child.id !== EbmlTagIdEnum.Cluster,
            })
          )
          .pipeTo(
            new WritableStream({
              write: (tag) => subscriber.next(tag),
              close: () => {
                if (!requestCompleted) {
                  subscriber.complete();
                }
              },
            })
          )
          .catch((error) => {
            if (requestCompleted && error?.name === 'AbortError') {
              return;
            }
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
export function createEbmlController(src: string) {
  const request$ = createRangedEbmlStream(src, 0);

  const controller$ = request$.pipe(
    map(({ totalSize, ebml$, response, controller }) => {
      const head$ = ebml$.pipe(
        filter(isTagIdPos(EbmlTagIdEnum.EBML, EbmlTagPosition.End)),
        take(1),
        shareReplay(1)
      );

      console.debug(
        `stream of video "${src}" created, total size is ${totalSize ?? 'unknown'}`
      );

      const segmentStart$ = ebml$.pipe(
        filter((s) => s.position === EbmlTagPosition.Start),
        filter((tag) => tag.id === EbmlTagIdEnum.Segment)
      );

      const segments$ = segmentStart$.pipe(
        map((startTag) => {
          const segment = new EbmlSegment(startTag);

          const continuousReusedCluster$ = ebml$.pipe(
            filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)),
            filter((s) => s.id === EbmlTagIdEnum.Cluster),
            map(Cluster.fromTag.bind(Cluster))
          );

          const segmentEnd$ = ebml$.pipe(
            filter(isTagIdPos(EbmlTagIdEnum.Segment, EbmlTagPosition.End)),
            filter((tag) => tag.id === EbmlTagIdEnum.Segment),
            take(1)
          );

          const clusterStart$ = ebml$.pipe(
            filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.Start)),
            take(1),
            shareReplay(1)
          );

          const meta$ = ebml$.pipe(
            takeUntil(clusterStart$.pipe(raceWith(segmentEnd$))),
            share({
              resetOnComplete: false,
              resetOnError: false,
              resetOnRefCountZero: true,
            })
          );

          const withMeta$ = meta$.pipe(
            reduce((segment, meta) => {
              segment.scanMeta(meta);
              return segment;
            }, segment),
            map((segment) => {
              segment.markMetaEnd();
              return segment;
            }),
            take(1),
            shareReplay(1)
          );

          const withRemoteCues$ = withMeta$.pipe(
            switchMap((s) => {
              if (s.cuesNode) {
                return EMPTY;
              }
              const cuesStartOffset =
                s.dataOffset +
                (s.findSeekPositionBySeekId(SEEK_ID_KAX_CUES) ?? Number.NaN);
              if (cuesStartOffset >= 0) {
                return createRangedEbmlStream(src, cuesStartOffset).pipe(
                  switchMap((req) => req.ebml$),
                  filter(isTagIdPos(EbmlTagIdEnum.Cues, EbmlTagPosition.End)),
                  withLatestFrom(withMeta$),
                  map(([cues, withMeta]) => {
                    withMeta.cuesNode = cues;
                    return withMeta;
                  })
                );
              }
              return EMPTY;
            }),
            take(1),
            shareReplay(1)
          );

          const withLocalCues$ = withMeta$.pipe(
            switchMap((s) => {
              if (s.cuesNode) {
                return of(s);
              }
              return EMPTY;
            }),
            shareReplay(1)
          );

          const withCues$ = merge(withLocalCues$, withRemoteCues$).pipe(
            take(1)
          );

          const withoutCues$ = withCues$.pipe(
            isEmpty(),
            switchMap((empty) => (empty ? withMeta$ : EMPTY))
          );

          const seekWithoutCues = (seekTime: number): Observable<Cluster> => {
            const cluster$ = continuousReusedCluster$.pipe(
              isEmpty(),
              switchMap((empty) => {
                return empty
                  ? clusterStart$.pipe(
                      switchMap((startTag) =>
                        createRangedEbmlStream(src, startTag.startOffset)
                      ),
                      switchMap((req) => req.ebml$),
                      filter(
                        isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)
                      ),
                      map(Cluster.fromTag.bind(Cluster))
                    )
                  : continuousReusedCluster$;
              })
            );
            if (seekTime === 0) {
              return cluster$;
            }

            return cluster$.pipe(
              scan(
                (prev, curr) =>
                  [prev?.[1], curr] as [
                    Cluster | undefined,
                    Cluster | undefined,
                  ],
                [undefined, undefined] as [
                  Cluster | undefined,
                  Cluster | undefined,
                ]
              ),
              filter((c) => c[1]?.timestamp! > seekTime),
              map((c) => c[0] ?? c[1]!)
            );
          };

          const seekWithCues = (
            cues: Cues,
            seekTime: number
          ): Observable<Cluster> => {
            if (seekTime === 0) {
              return seekWithoutCues(seekTime);
            }

            const cuePoint = cues.findClosestCue(seekTime);

            if (!cuePoint) {
              return seekWithoutCues(seekTime);
            }

            return createRangedEbmlStream(
              src,
              cuePoint.position + segment.dataOffset
            ).pipe(
              switchMap((req) => req.ebml$),
              filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)),
              map(Cluster.fromTag.bind(Cluster))
            );
          };

          const seek = (seekTime: number): Observable<Cluster> => {
            if (seekTime === 0) {
              const subscripton = merge(withCues$, withoutCues$).subscribe();

              // if seekTime equals to 0 at start, reuse the initialize stream
              return seekWithoutCues(seekTime).pipe(
                finalize(() => {
                  subscripton.unsubscribe();
                })
              );
            }
            return merge(
              withCues$.pipe(
                switchMap((s) =>
                  seekWithCues(Cues.fromTag(s.cuesNode!), seekTime)
                )
              ),
              withoutCues$.pipe(switchMap((_) => seekWithoutCues(seekTime)))
            );
          };

          return {
            startTag,
            head$,
            segment,
            meta$,
            withMeta$,
            withCues$,
            withoutCues$,
            seekWithCues,
            seekWithoutCues,
            seek,
          };
        })
      );

      return {
        segments$,
        head$,
        totalSize,
        ebml$,
        controller,
        response,
      };
    })
  );

  return {
    controller$,
    request$,
  };
}
