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
import { SegmentSystem, SEEK_ID_KAX_CUES, type CueSystem } from './model';
import { isTagIdPos } from './util';
import type { ClusterType } from "./schema";

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
          const segment = new SegmentSystem(startTag);
          const clusterSystem = segment.cluster;
          const seekSystem = segment.seek;

          const continuousReusedCluster$ = ebml$.pipe(
            filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)),
            filter((s) => s.id === EbmlTagIdEnum.Cluster),
            map(clusterSystem.addClusterWithTag.bind(clusterSystem))
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
            reduce((segment, meta) => segment.scanHead(meta), segment),
            map(segment.completeHeads.bind(segment)),
            take(1),
            shareReplay(1)
          );

          const withRemoteCues$ = withMeta$.pipe(
            switchMap((s) => {
              const cueSystem = s.cue;
              const seekSystem = s.seek;
              if (cueSystem.prepared) {
                return EMPTY;
              }
              const remoteCuesTagStartOffset = seekSystem.seekOffsetBySeekId(SEEK_ID_KAX_CUES);
              if (remoteCuesTagStartOffset! >= 0) {
                return createRangedEbmlStream(src, remoteCuesTagStartOffset).pipe(
                  switchMap((req) => req.ebml$),
                  filter(isTagIdPos(EbmlTagIdEnum.Cues, EbmlTagPosition.End)),
                  withLatestFrom(withMeta$),
                  map(([cues, withMeta]) => {
                    withMeta.cue.prepareCuesWithTag(cues);
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
            switchMap((s) => s.cue.prepared ? of(s) : EMPTY),
            shareReplay(1)
          );

          const withCues$ = merge(withLocalCues$, withRemoteCues$).pipe(
            take(1)
          );

          const withoutCues$ = withCues$.pipe(
            isEmpty(),
            switchMap((empty) => (empty ? withMeta$ : EMPTY))
          );

          const seekWithoutCues = (seekTime: number): Observable<ClusterType> => {
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
                      map((tag) => clusterSystem.addClusterWithTag(tag))
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
                    ClusterType | undefined,
                    ClusterType | undefined,
                  ],
                [undefined, undefined] as [
                  ClusterType | undefined,
                  ClusterType | undefined,
                ]
              ),
              filter((c) => c[1]?.Timestamp! > seekTime),
              map((c) => c[0] ?? c[1]!)
            );
          };

          const seekWithCues = (
            cues: CueSystem,
            seekTime: number
          ): Observable<ClusterType> => {
            if (seekTime === 0) {
              return seekWithoutCues(seekTime);
            }

            const cuePoint = cues.findClosestCue(seekTime);

            if (!cuePoint) {
              return seekWithoutCues(seekTime);
            }

            return createRangedEbmlStream(
              src,
              seekSystem.offsetFromSeekDataPosition(cues.getCueTrackPositions(cuePoint).CueClusterPosition)
            ).pipe(
              switchMap((req) => req.ebml$),
              filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)),
              map(clusterSystem.addClusterWithTag.bind(clusterSystem))
            );
          };

          const seek = (seekTime: number): Observable<ClusterType> => {
            if (seekTime === 0) {
              const subscription = merge(withCues$, withoutCues$).subscribe();

              // if seekTime equals to 0 at start, reuse the initialize stream
              return seekWithoutCues(seekTime).pipe(
                finalize(() => {
                  subscription.unsubscribe();
                })
              );
            }
            return merge(
              withCues$.pipe(
                switchMap((s) =>
                  seekWithCues(s.cue, seekTime)
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
