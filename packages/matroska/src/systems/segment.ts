import {
  type EbmlClusterTagType,
  type EbmlMasterTagType,
  type EbmlSegmentTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlTagType
} from "konoebml";
import {ArkErrors, type Type} from "arktype";
import {convertEbmlTagToComponent, type InferType} from "../util.ts";
import {CueSystem} from "./cue.ts";
import {ClusterSystem} from "./cluster.ts";
import {SEEK_ID_KAX_CUES, SEEK_ID_KAX_INFO, SEEK_ID_KAX_TAGS, SEEK_ID_KAX_TRACKS, SeekSystem} from "./seek.ts";
import {InfoSystem} from "./info.ts";
import {TrackSystem} from "./track.ts";
import {TagSystem} from "./tag.ts";
import type {BlockGroupType} from "../schema.ts";

export class SegmentSystem {
  startTag: EbmlSegmentTagType;
  metaTags: EbmlTagType[] = [];
  firstCluster: EbmlClusterTagType | undefined;

  cue: CueSystem;
  cluster: ClusterSystem;
  seek: SeekSystem;
  info: InfoSystem;
  track: TrackSystem;
  tag: TagSystem;

  constructor(startNode: EbmlSegmentTagType) {
    this.startTag = startNode;
    this.cue = new CueSystem(this);
    this.cluster = new ClusterSystem(this);
    this.seek = new SeekSystem(this);
    this.info = new InfoSystem(this);
    this.track = new TrackSystem(this);
    this.tag = new TagSystem(this);
  }

  get contentStartOffset() {
    return this.startTag.startOffset + this.startTag.headerLength;
  }

  private seekLocal() {
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
    this.metaTags.push(tag);
    this.seek.memoOffset(tag);
    if (tag.id === EbmlTagIdEnum.Cluster && !this.firstCluster) {
      this.firstCluster = tag;
      this.seekLocal();
    }
    if (this.firstCluster) {
      if (tag.id === EbmlTagIdEnum.SimpleBlock && tag.keyframe) {
        this.track.tryPeekKeyframe(tag);
      } else if (tag.id === EbmlTagIdEnum.BlockGroup) {
        const blockGroup = convertEbmlTagToComponent(tag) as BlockGroupType;
        // keep frame
        if (blockGroup && !blockGroup.ReferenceBlock && blockGroup.Block) {
          this.track.tryPeekKeyframe(blockGroup.Block);
        }
      }
    }
    return this;
  }

  canCompleteMeta() {
    const lastTag = this.metaTags.at(-1);
    if (!lastTag) {
      return false;
    }
    if (lastTag.id === EbmlTagIdEnum.Segment && lastTag.position === EbmlTagPosition.End) {
      return true;
    }
    return !!(this.firstCluster && this.track.preparedToConfigureTracks());
  }

  async completeMeta() {
    this.seekLocal();

    await this.track.buildTracksConfiguration();

    return this;
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