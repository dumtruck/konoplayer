import { createAudioDecodeStream } from '@konoplayer/core/audition';
import { createVideoDecodeStream } from '@konoplayer/core/graphics';
import {
  type EbmlSegmentTagType,
  type EbmlTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
} from 'konoebml';
import {
  type Observable,
  scan,
  takeWhile,
  share,
  map,
  switchMap,
  shareReplay,
  EMPTY,
  filter,
  withLatestFrom,
  take,
  of,
  merge,
  isEmpty,
  finalize,
  delayWhen,
  from,
} from 'rxjs';
import type { CreateMatroskaOptions } from '.';
import { type ClusterType, TrackTypeRestrictionEnum } from '../schema';
import {
  SegmentSystem,
  type SegmentComponent,
  type VideoTrackContext,
  type AudioTrackContext,
  SEEK_ID_KAX_CUES,
  SEEK_ID_KAX_TAGS,
  type CueSystem,
} from '../systems';
import {
  standardTrackPredicate,
  standardTrackPriority,
} from '../systems/track';
import { isTagIdPos } from '../util';
import { createRangedEbmlStream } from './resource';

export interface CreateMatroskaSegmentOptions {
  matroskaOptions: CreateMatroskaOptions;
  startTag: EbmlSegmentTagType;
  ebml$: Observable<EbmlTagType>;
}

export interface MatroskaSegmentModel {
  startTag: EbmlSegmentTagType;
  segment: SegmentSystem;
  loadedMetadata$: Observable<SegmentSystem>;
  loadedTags$: Observable<SegmentSystem>;
  loadedCues$: Observable<SegmentSystem>;
  seek: (seekTime: number) => Observable<SegmentComponent<ClusterType>>;
  videoTrackDecoder: (
    track: VideoTrackContext,
    cluster$: Observable<ClusterType>
  ) => Observable<{
    track: VideoTrackContext;
    decoder: VideoDecoder;
    frame$: Observable<VideoFrame>;
  }>;
  audioTrackDecoder: (
    track: AudioTrackContext,
    cluster$: Observable<ClusterType>
  ) => Observable<{
    track: AudioTrackContext;
    decoder: AudioDecoder;
    frame$: Observable<AudioData>;
  }>;
  defaultVideoTrack$: Observable<VideoTrackContext | undefined>;
  defaultAudioTrack$: Observable<AudioTrackContext | undefined>;
}

export function createMatroskaSegment({
  matroskaOptions,
  startTag,
  ebml$,
}: CreateMatroskaSegmentOptions): MatroskaSegmentModel {
  const segment = new SegmentSystem(startTag);
  const clusterSystem = segment.cluster;
  const seekSystem = segment.seek;

  const metaScan$ = ebml$.pipe(
    scan(
      (acc, tag) => {
        const segment = acc.segment;
        segment.scanMeta(tag);
        acc.tag = tag;
        acc.canComplete = segment.canCompleteMeta();
        return acc;
      },
      {
        segment,
        tag: undefined as unknown as EbmlTagType,
        canComplete: false,
      }
    ),
    takeWhile(({ canComplete }) => !canComplete, true),
    delayWhen(({ segment }) => from(segment.completeMeta())),
    share({
      resetOnComplete: false,
      resetOnError: false,
      resetOnRefCountZero: true,
    })
  );

  const loadedMetadata$ = metaScan$.pipe(
    filter(({ canComplete }) => canComplete),
    map(({ segment }) => segment),
    take(1),
    shareReplay(1),
  );

  const loadedRemoteCues$ = loadedMetadata$.pipe(
    switchMap((s) => {
      const cueSystem = s.cue;
      const seekSystem = s.seek;
      if (cueSystem.prepared) {
        return EMPTY;
      }
      const remoteCuesTagStartOffset =
        seekSystem.seekOffsetBySeekId(SEEK_ID_KAX_CUES);
      if (remoteCuesTagStartOffset! >= 0) {
        return createRangedEbmlStream({
          ...matroskaOptions,
          byteStart: remoteCuesTagStartOffset,
        }).pipe(
          switchMap((req) => req.ebml$),
          filter(isTagIdPos(EbmlTagIdEnum.Cues, EbmlTagPosition.End)),
          withLatestFrom(loadedMetadata$),
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

  const loadedLocalCues$ = loadedMetadata$.pipe(
    switchMap((s) => (s.cue.prepared ? of(s) : EMPTY)),
    shareReplay(1)
  );

  const loadedEmptyCues$ = merge(loadedLocalCues$, loadedRemoteCues$).pipe(
    isEmpty(),
    switchMap((empty) => (empty ? loadedMetadata$ : EMPTY))
  );

  const loadedCues$ = merge(
    loadedLocalCues$,
    loadedRemoteCues$,
    loadedEmptyCues$
  ).pipe(take(1));

  const loadedRemoteTags$ = loadedMetadata$.pipe(
    switchMap((s) => {
      const tagSystem = s.tag;
      const seekSystem = s.seek;
      if (tagSystem.prepared) {
        return EMPTY;
      }

      const remoteTagsTagStartOffset =
        seekSystem.seekOffsetBySeekId(SEEK_ID_KAX_TAGS);
      if (remoteTagsTagStartOffset! >= 0) {
        return createRangedEbmlStream({
          ...matroskaOptions,
          byteStart: remoteTagsTagStartOffset,
        }).pipe(
          switchMap((req) => req.ebml$),
          filter(isTagIdPos(EbmlTagIdEnum.Tags, EbmlTagPosition.End)),
          withLatestFrom(loadedMetadata$),
          map(([tags, withMeta]) => {
            withMeta.tag.prepareTagsWithTag(tags);
            return withMeta;
          })
        );
      }
      return EMPTY;
    }),
    take(1),
    shareReplay(1)
  );

  const loadedLocalTags$ = loadedMetadata$.pipe(
    switchMap((s) => (s.tag.prepared ? of(s) : EMPTY)),
    shareReplay(1)
  );

  const loadedEmptyTags$ = merge(loadedRemoteTags$, loadedLocalTags$).pipe(
    isEmpty(),
    switchMap((empty) => (empty ? loadedMetadata$ : EMPTY))
  );

  const loadedTags$ = merge(
    loadedLocalTags$,
    loadedRemoteTags$,
    loadedEmptyTags$
  ).pipe(take(1));

  const seekWithoutCues = (
    seekTime: number
  ): Observable<SegmentComponent<ClusterType>> => {
    const request$ = loadedMetadata$.pipe(
      switchMap(() =>
        createRangedEbmlStream({
          ...matroskaOptions,
          byteStart: seekSystem.firstClusterOffset,
        })
      )
    );
    const cluster$ = request$.pipe(
      switchMap((req) => req.ebml$),
      filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)),
      map((tag) => clusterSystem.addClusterWithTag(tag))
    );

    if (seekTime === 0) {
      return cluster$;
    }

    return cluster$.pipe(
      scan(
        (acc, curr) => {
          // avoid object recreation
          acc.prev = acc.next;
          acc.next = curr;
          return acc;
        },
        {
          prev: undefined as SegmentComponent<ClusterType> | undefined,
          next: undefined as SegmentComponent<ClusterType> | undefined,
        }
      ),
      filter((c) => c.next?.Timestamp! > seekTime),
      map((c) => c.prev ?? c.next!)
    );
  };

  const seekWithCues = (
    cueSystem: CueSystem,
    seekTime: number
  ): Observable<SegmentComponent<ClusterType>> => {
    if (seekTime === 0) {
      return seekWithoutCues(seekTime);
    }

    const cuePoint = cueSystem.findClosestCue(seekTime);

    if (!cuePoint) {
      return seekWithoutCues(seekTime);
    }

    return createRangedEbmlStream({
      ...matroskaOptions,
      byteStart: seekSystem.offsetFromSeekPosition(
        cueSystem.getCueTrackPositions(cuePoint).CueClusterPosition as number
      ),
    }).pipe(
      switchMap((req) => req.ebml$),
      filter(isTagIdPos(EbmlTagIdEnum.Cluster, EbmlTagPosition.End)),
      map(clusterSystem.addClusterWithTag.bind(clusterSystem))
    );
  };

  const seek = (
    seekTime: number
  ): Observable<SegmentComponent<ClusterType>> => {
    if (seekTime === 0) {
      const subscription = loadedCues$.subscribe();

      // if seekTime equals to 0 at start, reuse the initialize stream
      return seekWithoutCues(seekTime).pipe(
        finalize(() => {
          subscription.unsubscribe();
        })
      );
    }
    return loadedCues$.pipe(
      switchMap((segment) => {
        const cueSystem = segment.cue;
        if (cueSystem.prepared) {
          return seekWithCues(cueSystem, seekTime);
        }
        return seekWithoutCues(seekTime);
      })
    );
  };

  const videoTrackDecoder = (
    track: VideoTrackContext,
    cluster$: Observable<ClusterType>
  ) => {
    return createVideoDecodeStream(track.configuration).pipe(
      map(({ decoder, frame$ }) => {
        const clusterSystem = segment.cluster;
        const infoSystem = segment.info;
        const timestampScale = Number(infoSystem.info.TimestampScale) / 1000;

        const decodeSubscription = cluster$.subscribe((cluster) => {
          for (const block of clusterSystem.enumerateBlocks(
            cluster,
            track.trackEntry
          )) {
            const blockTime = (Number(cluster.Timestamp) + block.relTime) * timestampScale;
            const blockDuration =
              frames.length > 1 ? track.predictBlockDuration(blockTime) * timestampScale : 0;
            const perFrameDuration =
              frames.length > 1 && blockDuration
                ? blockDuration / block.frames.length
                : 0;

            for (const frame of block.frames) {
              const chunk = new EncodedVideoChunk({
                type: block.keyframe ? 'key' : 'delta',
                data: frame,
                timestamp: blockTime + perFrameDuration,
              });

              decoder.decode(chunk);
            }
          }
        });

        return {
          track,
          decoder,
          frame$: frame$
            .pipe(
              finalize(() => {
                decodeSubscription.unsubscribe();
              })
            )
        }
      })
    );
  };

  const audioTrackDecoder = (
    track: AudioTrackContext,
    cluster$: Observable<ClusterType>
  ) => {
    return createAudioDecodeStream(track.configuration).pipe(
      map(({ decoder, frame$ }) => {
        const clusterSystem = segment.cluster;
        const infoSystem = segment.info;
        const timestampScale = Number(infoSystem.info.TimestampScale) / 1000;

        const decodeSubscription = cluster$.subscribe((cluster) => {
          for (const block of clusterSystem.enumerateBlocks(
            cluster,
            track.trackEntry
          )) {
            const blockTime = (Number(cluster.Timestamp) + block.relTime) * timestampScale;
            const blockDuration =
              frames.length > 1 ? track.predictBlockDuration(blockTime) : 0;
            const perFrameDuration =
              frames.length > 1 && blockDuration
                ? blockDuration / block.frames.length
                : 0;

            let i = 0;
            for (const frame of block.frames) {
              const chunk = new EncodedAudioChunk({
                type: block.keyframe ? 'key' : 'delta',
                data: frame,
                timestamp: blockTime + perFrameDuration * i,
              });
              i++;

              decoder.decode(chunk);
            }
          }
        });

        return {
          track,
          decoder,
          frame$: frame$.pipe(finalize(() => decodeSubscription.unsubscribe())),
        };
    }));
  };

  const defaultVideoTrack$ = loadedMetadata$.pipe(
    map((segment) =>
      segment.track.getTrackContext<VideoTrackContext>({
        predicate: (track) =>
          track.TrackType === TrackTypeRestrictionEnum.VIDEO &&
          standardTrackPredicate(track),
        priority: standardTrackPriority,
      })
    )
  );

  const defaultAudioTrack$ = loadedMetadata$.pipe(
    map((segment) =>
      segment.track.getTrackContext<AudioTrackContext>({
        predicate: (track) =>
          track.TrackType === TrackTypeRestrictionEnum.AUDIO &&
          standardTrackPredicate(track),
        priority: standardTrackPriority,
      })
    )
  );

  return {
    startTag,
    segment,
    loadedMetadata$,
    loadedTags$,
    loadedCues$,
    seek,
    videoTrackDecoder,
    audioTrackDecoder,
    defaultVideoTrack$,
    defaultAudioTrack$
  };
}
