import {
  type EbmlClusterTagType,
  type EbmlCuePointTagType,
  type EbmlCuesTagType,
  type EbmlInfoTagType,
  type EbmlMasterTagType,
  type EbmlSeekHeadTagType,
  type EbmlSegmentTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlTagsTagType,
  type EbmlTagTagType,
  type EbmlTagType,
  type EbmlTrackEntryTagType,
  type EbmlTracksTagType,
} from 'konoebml';
import { convertEbmlTagToComponent, type InferType } from './util';
import { isEqual, maxBy } from 'lodash-es';
import { ArkErrors, type Type } from 'arktype';
import {
  ClusterSchema,
  type ClusterType,
  CuePointSchema,
  type CuePointType,
  type CueTrackPositionsType,
  InfoSchema,
  type InfoType,
  SeekHeadSchema,
  type SeekHeadType,
  TagSchema,
  type TagType,
  TrackEntrySchema,
  type TrackEntryType, TrackTypeRestrictionEnum,
} from './schema';
import {concatBufs} from "konoebml/lib/tools";
import {ParseCodecErrors, UnreachableOrLogicError, UnsupportedCodecError} from "@/media/base/errors.ts";
import type {ProbeInfo} from "@/media/mkv/enhance/probe.ts";
import {audioCodecIdToWebCodecs, videoCodecIdToWebCodecs} from "@/media/mkv/codecs";
import {Queue} from "mnemonist";
import {BehaviorSubject} from "rxjs";

export const SEEK_ID_KAX_INFO = new Uint8Array([0x15, 0x49, 0xa9, 0x66]);
export const SEEK_ID_KAX_TRACKS = new Uint8Array([0x16, 0x54, 0xae, 0x6b]);
export const SEEK_ID_KAX_CUES = new Uint8Array([0x1c, 0x53, 0xbb, 0x6b]);
export const SEEK_ID_KAX_TAGS = new Uint8Array([0x12, 0x54, 0xc3, 0x67]);

export class SegmentSystem {
  startTag: EbmlSegmentTagType;
  headTags: EbmlTagType[] = [];
  teeStream: ReadableStream<Uint8Array>
  teeBufferTask: Promise<Uint8Array>;
  firstCluster: EbmlClusterTagType | undefined;
  probInfo?: ProbeInfo;

  cue: CueSystem;
  cluster: ClusterSystem;
  seek: SeekSystem;
  info: InfoSystem;
  track: TrackSystem;
  tag: TagSystem;

  constructor(startNode: EbmlSegmentTagType, teeStream: ReadableStream<Uint8Array>) {
    this.startTag = startNode;
    this.cue = new CueSystem(this);
    this.cluster = new ClusterSystem(this);
    this.seek = new SeekSystem(this);
    this.info = new InfoSystem(this);
    this.track = new TrackSystem(this);
    this.tag = new TagSystem(this);
    this.teeStream = teeStream;
    this.teeBufferTask = this.teeWaitingProbingData(teeStream);
  }

  private async teeWaitingProbingData (teeStream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
    const reader = teeStream.getReader();
    const list: Uint8Array<ArrayBufferLike>[] = [];
    while (true) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        list.push(value);
      } catch (e: any) {
        if (e?.name === 'AbortError') {
          break;
        }
        throw e;
      }
    }
    return concatBufs(...list)
  }

  get contentStartOffset() {
    return this.startTag.startOffset + this.startTag.headerLength;
  }

  private seekLocal () {
    const infoTag = this.seek.seekTagBySeekId(SEEK_ID_KAX_INFO);
    const tracksTag = this.seek.seekTagBySeekId(SEEK_ID_KAX_TRACKS);
    const cuesTag = this.seek.seekTagBySeekId(SEEK_ID_KAX_CUES);
    const tagsTag = this.seek.seekTagBySeekId(SEEK_ID_KAX_TAGS);

    if (cuesTag?.id === EbmlTagIdEnum.Cues) {
      this.cue.prepareCuesWithTag(cuesTag);
    }
    if (infoTag?.id === EbmlTagIdEnum.Info) {
      this.info.prepareWithInfoTag(infoTag);
    }
    if (tracksTag?.id === EbmlTagIdEnum.Tracks) {
      this.track.prepareTracksWithTag(tracksTag);
    }
    if (tagsTag?.id === EbmlTagIdEnum.Tags) {
      this.tag.prepareTagsWithTag(tagsTag);
    }
  }

  scanMeta(tag: EbmlTagType) {
    if (
      tag.id === EbmlTagIdEnum.SeekHead &&
      tag.position === EbmlTagPosition.End
    ) {
      this.seek.addSeekHeadTag(tag);
    }
    this.headTags.push(tag);
    this.seek.memoTag(tag);
    if (tag.id === EbmlTagIdEnum.Cluster && !this.firstCluster) {
      this.firstCluster = tag;
      this.seekLocal();
    }
    return this;
  }

  async completeMeta () {
    this.seekLocal();

    await this.parseCodes();

    return this;
  }

  async fetchProbeInfo (_payload: Uint8Array): Promise<ProbeInfo> {
    // call local or remote ff-probe
    return {}
  }

  async parseCodes () {
    const candidates = this.track.tracks.filter(c => c.TrackType === TrackTypeRestrictionEnum.AUDIO || c.TrackType === TrackTypeRestrictionEnum.VIDEO);
    const parseErrors = new ParseCodecErrors();

    if (!this.probInfo) {
      for (const t of candidates) {
        try {
          await this.track.initTrack(t, undefined)
        } catch (e: unknown) {
          parseErrors.cause.push(e as Error)
        }
      }
      if (parseErrors.cause.length > 0) {
        try {
          const teeBuffer = await this.teeBufferTask;
          this.probInfo = await this.fetchProbeInfo(teeBuffer);
        } catch (e) {
          parseErrors.cause.push(e as Error);
          return;
        }
      } else {
        return;
      }
    }

    for (const t of candidates) {
      try {
        await this.track.initTrack(t, this.probInfo)
      } catch (e) {
        parseErrors.cause.push(e as Error)
      }
    }
    if (parseErrors.cause.length > 0) {
      console.error(parseErrors);
    }
  }
}

export type SegmentComponent<T> = T & {
  get segment(): SegmentSystem;
};

export function withSegment<T extends object>(
  component: T,
  segment: SegmentSystem
): SegmentComponent<T> {
  const component_ = component as T & { segment: SegmentSystem };
  component_.segment = segment;
  return component_;
}

export class SegmentComponentSystemTrait<
  E extends EbmlMasterTagType,
  S extends Type<any>,
> {
  segment: SegmentSystem;

  get schema(): S {
    throw new Error('unimplemented!');
  }

  constructor(segment: SegmentSystem) {
    this.segment = segment;
  }

  componentFromTag(tag: E): SegmentComponent<InferType<S>> {
    const extracted = convertEbmlTagToComponent(tag);
    const result = this.schema(extracted) as
      | (InferType<S> & { segment: SegmentSystem })
      | ArkErrors;
    if (result instanceof ArkErrors) {
      const errors = result;
      console.error(
        'Parse component from tag error:',
        tag.toDebugRecord(),
        errors.flatProblemsByPath
      );
      throw errors;
    }
    result.segment = this.segment;
    return result;
  }
}

export class SeekSystem extends SegmentComponentSystemTrait<
  EbmlSeekHeadTagType,
  typeof SeekHeadSchema
> {
  override get schema() {
    return SeekHeadSchema;
  }

  seekHeads: SeekHeadType[] = [];
  private offsetToTagMemo: Map<number, EbmlTagType> = new Map();

  memoTag(tag: EbmlTagType) {
    this.offsetToTagMemo.set(tag.startOffset, tag);
  }

  addSeekHeadTag(tag: EbmlSeekHeadTagType) {
    const seekHead = this.componentFromTag(tag);
    this.seekHeads.push(seekHead);
    return seekHead;
  }

  offsetFromSeekPosition(position: number): number {
    return position + this.segment.contentStartOffset;
  }

  seekTagByStartOffset(
    startOffset: number | undefined
  ): EbmlTagType | undefined {
    return startOffset! >= 0
      ? this.offsetToTagMemo.get(startOffset!)
      : undefined;
  }

  seekOffsetBySeekId(seekId: Uint8Array): number | undefined {
    const seekPosition = this.seekHeads[0]?.Seek?.find((c) =>
      isEqual(c.SeekID, seekId)
    )?.SeekPosition;
    return seekPosition! >= 0
      ? this.offsetFromSeekPosition(seekPosition! as number)
      : undefined;
  }

  seekTagBySeekId(seekId: Uint8Array): EbmlTagType | undefined {
    return this.seekTagByStartOffset(this.seekOffsetBySeekId(seekId));
  }

  get firstClusterOffset () {
    if (!this.segment.firstCluster) {
      throw new UnreachableOrLogicError("first cluster not found")
    }
    return this.segment.firstCluster.startOffset;
  }
}

export class InfoSystem extends SegmentComponentSystemTrait<
  EbmlInfoTagType,
  typeof InfoSchema
> {
  override get schema() {
    return InfoSchema;
  }

  info!: SegmentComponent<InfoType>;

  prepareWithInfoTag(tag: EbmlInfoTagType) {
    this.info = this.componentFromTag(tag);
    return this;
  }
}

export class ClusterSystem extends SegmentComponentSystemTrait<
  EbmlClusterTagType,
  typeof ClusterSchema
> {
  override get schema() {
    return ClusterSchema;
  }

  clustersBuffer: SegmentComponent<ClusterType>[] = [];

  addClusterWithTag(tag: EbmlClusterTagType) {
    const cluster = this.componentFromTag(tag);
    this.clustersBuffer.push(cluster);
    return cluster;
  }
}

export interface GetTrackEntryOptions {
  priority?: (v: SegmentComponent<TrackEntryType>) => number;
  predicate?: (v: SegmentComponent<TrackEntryType>) => boolean;
}


export interface TrackState<Decoder, Config, Frame> {
  decoder: Decoder,
  configuration?: Config,
  frameBuffer$: BehaviorSubject<Queue<Frame>>
}

export class TrackSystem extends SegmentComponentSystemTrait<
  EbmlTrackEntryTagType,
  typeof TrackEntrySchema
> {
  override get schema() {
    return TrackEntrySchema;
  }

  tracks: SegmentComponent<TrackEntryType>[] = [];
  videoTrackState = new WeakMap<TrackEntryType, TrackState< VideoDecoder, VideoDecoderConfig, VideoFrame>>();
  audioTrackState = new WeakMap<TrackEntryType, TrackState<AudioDecoder, AudioDecoderConfig, AudioData>>();

  getTrackEntry({
    priority = (track) =>
      (Number(!!track.FlagForced) << 4) + Number(!!track.FlagDefault),
    predicate = (track) => track.FlagEnabled !== 0,
  }: GetTrackEntryOptions) {
    return this.tracks
      .filter(predicate)
      .toSorted((a, b) => priority(b) - priority(a))
      .at(0);
  }

  prepareTracksWithTag(tag: EbmlTracksTagType) {
    this.tracks = tag.children
      .filter((c) => c.id === EbmlTagIdEnum.TrackEntry)
      .map((c) => this.componentFromTag(c));
    return this;
  }

  async initTrack (track: TrackEntryType, probe?: ProbeInfo)  {
    if (track.TrackType === TrackTypeRestrictionEnum.AUDIO) {
      const configuration = audioCodecIdToWebCodecs(track, probe);
      if (await AudioDecoder.isConfigSupported(configuration)) {
        throw new UnsupportedCodecError(configuration.codec, 'audio decoder')
      }

      const queue$ = new BehaviorSubject(new Queue<AudioData>());
      this.audioTrackState.set(track, {
        configuration,
        decoder: new AudioDecoder({
          output: (audioData) => {
            const queue = queue$.getValue();
            queue.enqueue(audioData);
            queue$.next(queue);
          },
          error: (e) => {
            queue$.error(e);
          },
        }),
        frameBuffer$: queue$,
      })
    } else if (track.TrackType === TrackTypeRestrictionEnum.VIDEO) {
      const configuration = videoCodecIdToWebCodecs(track, probe);
      if (await VideoDecoder.isConfigSupported(configuration)) {
        throw new UnsupportedCodecError(configuration.codec, 'audio decoder')
      }

      const queue$ = new BehaviorSubject(new Queue<VideoFrame>());
      this.videoTrackState.set(track, {
        configuration,
        decoder: new VideoDecoder({
          output: (audioData) => {
            const queue = queue$.getValue();
            queue.enqueue(audioData);
            queue$.next(queue);
          },
          error: (e) => {
            queue$.error(e);
          },
        }),
        frameBuffer$: queue$,
      })
    }
  }
}

export class CueSystem extends SegmentComponentSystemTrait<
  EbmlCuePointTagType,
  typeof CuePointSchema
> {
  override get schema() {
    return CuePointSchema;
  }

  cues: SegmentComponent<CuePointType>[] = [];

  prepareCuesWithTag(tag: EbmlCuesTagType) {
    this.cues = tag.children
      .filter((c) => c.id === EbmlTagIdEnum.CuePoint)
      .map(this.componentFromTag.bind(this));
    return this;
  }

  findClosestCue(seekTime: number): CuePointType | undefined {
    const cues = this.cues;
    if (!cues || cues.length === 0) {
      return undefined;
    }

    let left = 0;
    let right = cues.length - 1;

    if (seekTime <= cues[0].CueTime) {
      return cues[0];
    }

    if (seekTime >= cues[right].CueTime) {
      return cues[right];
    }

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      if (cues[mid].CueTime === seekTime) {
        return cues[mid];
      }

      if (cues[mid].CueTime < seekTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    const before = cues[right];
    const after = cues[left];
    return Math.abs((before.CueTime as number) - seekTime) <
      Math.abs((after.CueTime as number) - seekTime)
      ? before
      : after;
  }

  getCueTrackPositions(
    cuePoint: CuePointType,
    track?: number
  ): CueTrackPositionsType {
    let cueTrackPositions: CueTrackPositionsType | undefined;
    if (track! >= 0) {
      cueTrackPositions = cuePoint.CueTrackPositions.find(
        (c) => c.CueTrack === track
      );
    }
    if (!cueTrackPositions) {
      cueTrackPositions = maxBy(
        cuePoint.CueTrackPositions,
        (c) => c.CueClusterPosition
      )!;
    }
    return cueTrackPositions;
  }

  get prepared(): boolean {
    return this.cues.length > 0;
  }
}

export class TagSystem extends SegmentComponentSystemTrait<
  EbmlTagTagType,
  typeof TagSchema
> {
  override get schema() {
    return TagSchema;
  }

  tags: SegmentComponent<TagType>[] = [];

  prepareTagsWithTag(tag: EbmlTagsTagType) {
    this.tags = tag.children
      .filter((c) => c.id === EbmlTagIdEnum.Tag)
      .map((c) => this.componentFromTag(c));
    return this;
  }

  get prepared(): boolean {
    return this.tags.length > 0;
  }
}
