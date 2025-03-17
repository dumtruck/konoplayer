import { html, css, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import {
  EbmlStreamDecoder,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlTagType,
} from 'konoebml';
import {
  EMPTY,
  filter,
  from,
  isEmpty,
  map,
  merge,
  mergeMap,
  Observable,
  of,
  reduce,
  scan,
  share,
  Subject,
  type Subscription,
  switchMap,
  take,
  takeUntil,
  withLatestFrom,
} from 'rxjs';
import { createRangedVideoStream } from './media/shared';
import {
  EbmlCluster,
  EbmlCues,
  EbmlSegment,
  SEEK_ID_KAX_CUES,
} from './media/mkv/model';
import { isTagEnd } from './media/mkv/util';

export function createRangedEbmlStream(
  url: string,
  byteStart = 0,
  byteEnd?: number
): Observable<{
  ebml$: Observable<EbmlTagType>;
  totalSize?: number;
  response: Response;
  stream: ReadableStream;
  controller: AbortController;
}> {
  const stream$ = from(createRangedVideoStream(url, byteStart, byteEnd));

  return stream$.pipe(
    mergeMap(({ controller, stream, totalSize, response }) => {
      const ebml$ = new Observable<EbmlTagType>((subscriber) => {
        stream
          .pipeThrough(
            new EbmlStreamDecoder({
              streamStartOffset: byteStart,
              collectChild: (child) => child.id !== EbmlTagIdEnum.Cluster,
            })
          )
          .pipeTo(
            new WritableStream({
              write: (tag) => {
                subscriber.next(tag);
              },
              close: () => {
                subscriber.complete();
              },
              abort: (err: any) => {
                subscriber.error(err);
              },
            })
          );

        return () => {
          controller.abort();
        };
      }).pipe(
        share({
          connector: () => new Subject(),
          resetOnComplete: false,
          resetOnError: false,
          resetOnRefCountZero: false,
        })
      );

      return of({
        ebml$,
        totalSize,
        response,
        stream,
        controller,
      });
    })
  );
}

export class VideoPipelineDemo extends LitElement {
  @property()
  src!: string;

  subscripton?: Subscription;

  static styles = css``;

  async prepareVideoPipeline() {
    if (!this.src) {
      return;
    }

    const ebmlRequest$ = createRangedEbmlStream(this.src, 0);

    const ebmlInit$ = ebmlRequest$.pipe(
      map(({ totalSize, ebml$, response, controller }) => {
        const head = 1;
        console.debug(
          `stream of video "${this.src}" created, total size is ${totalSize ?? 'unknown'}`
        );

        const segmentStart$ = ebml$.pipe(
          filter((s) => s.position === EbmlTagPosition.Start),
          filter((tag) => tag.id === EbmlTagIdEnum.Segment)
        );

        const segmentEnd$ = ebml$.pipe(
          filter(
            (tag) =>
              tag.id === EbmlTagIdEnum.Segment &&
              tag.position === EbmlTagPosition.End
          )
        );

        const segments$ = segmentStart$.pipe(
          map((startTag) => {
            const segment = new EbmlSegment(startTag);
            const tag$ = ebml$.pipe(takeUntil(segmentEnd$));
            const cluster$ = tag$.pipe(
              filter(isTagEnd),
              filter((tag) => tag.id === EbmlTagIdEnum.Cluster),
              map((tag) => new EbmlCluster(tag))
            );
            const meta$ = tag$.pipe(takeUntil(cluster$));

            const withMeta$ = meta$.pipe(
              reduce((segment, meta) => {
                segment.scanMeta(meta);
                return segment;
              }, segment),
              map((segment) => {
                segment.markMetaEnd();
                return segment;
              })
            );

            const withRemoteCues$ = withMeta$.pipe(
              map((s) =>
                s.cuesNode
                  ? Number.NaN
                  : s.dataOffset +
                    (s.findSeekPositionBySeekId(SEEK_ID_KAX_CUES) ?? Number.NaN)
              ),
              filter((cuesStartOffset) => cuesStartOffset >= 0),
              switchMap((cuesStartOffset) =>
                createRangedEbmlStream(this.src, cuesStartOffset).pipe(
                  switchMap((req) => req.ebml$)
                )
              ),
              filter(isTagEnd),
              filter((tag) => tag?.id === EbmlTagIdEnum.Cues),
              take(1),
              withLatestFrom(withMeta$),
              map(([cues, withMeta]) => {
                withMeta.cuesNode = cues;
                return withMeta;
              }),
              share()
            );

            const withLocalCues$ = withMeta$.pipe(filter((s) => !!s.cuesNode));

            const withCues$ = merge(withRemoteCues$, withLocalCues$);

            const withoutCues$ = withCues$.pipe(
              isEmpty(),
              switchMap((empty) => (empty ? withMeta$ : EMPTY))
            );

            const seekWithoutCues = (
              cluster$: Observable<EbmlCluster>,
              seekTime: number
            ): Observable<EbmlCluster> => {
              if (seekTime === 0) {
                return cluster$;
              }

              return cluster$.pipe(
                scan(
                  (prev, curr) =>
                    [prev?.[1], curr] as [
                      EbmlCluster | undefined,
                      EbmlCluster | undefined,
                    ],
                  [undefined, undefined] as [
                    EbmlCluster | undefined,
                    EbmlCluster | undefined,
                  ]
                ),
                filter((c) => c[1]?.timestamp! >= seekTime),
                map((c) => c[1]!)
              );
            };

            const seekWithCues = (
              cues: EbmlCues,
              cluster$: Observable<EbmlCluster>,
              seekTime: number
            ): Observable<EbmlCluster> => {
              if (seekTime === 0) {
                return cluster$;
              }

              const cuePoint = cues.findClosestCue(seekTime);

              if (!cuePoint) {
                return seekWithoutCues(cluster$, seekTime);
              }

              return createRangedEbmlStream(
                this.src,
                cuePoint.position + segment.dataOffset
              ).pipe(
                switchMap((req) => req.ebml$),
                filter(isTagEnd),
                filter((tag) => tag.id === EbmlTagIdEnum.Cluster),
                map((c) => new EbmlCluster(c))
              );
            };

            const seek = (seekTime: number): Observable<EbmlCluster> => {
              return merge(
                withCues$.pipe(
                  switchMap((s) =>
                    seekWithCues(new EbmlCues(s.cuesNode!), cluster$, seekTime)
                  )
                ),
                withoutCues$.pipe(
                  switchMap((_) => seekWithoutCues(cluster$, seekTime))
                )
              );
            };

            return {
              startTag,
              head,
              segment,
              tag$,
              meta$,
              cluster$,
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
          head,
          totalSize,
          ebml$,
          controller,
          response,
        };
      })
    );

    this.subscripton = ebmlInit$
      .pipe(
        switchMap(({ segments$ }) => segments$),
        take(1),
        switchMap(({ seek }) => seek(2000))
      )
      .subscribe(console.log);
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.prepareVideoPipeline();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  render() {
    return html`<video />`;
  }
}
