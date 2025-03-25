import {
  type EbmlClusterTagType,
  type EbmlSegmentTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlTagType
} from "konoebml";
import {convertEbmlTagToComponent} from "../util";
import {CueSystem} from "./cue";
import {ClusterSystem} from "./cluster";
import {SEEK_ID_KAX_CUES, SEEK_ID_KAX_INFO, SEEK_ID_KAX_TAGS, SEEK_ID_KAX_TRACKS, SeekSystem} from "./seek";
import {InfoSystem} from "./info";
import {TrackSystem} from "./track";
import {TagSystem} from "./tag";
import type {BlockGroupType} from "../schema";

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
    if (tag.position !== EbmlTagPosition.Start) {
      this.seek.memoOffset(tag);
    }
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
    return (!!this.firstCluster && this.track.preparedToConfigureTracks());
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

