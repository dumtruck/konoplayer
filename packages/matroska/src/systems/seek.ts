import type {EbmlSeekHeadTagType, EbmlTagType} from "konoebml";
import {SeekHeadSchema, type SeekHeadType} from "../schema.ts";
import {isEqual} from "lodash-es";
import {UnreachableOrLogicError} from "@konoplayer/core/errors.ts";

import {SegmentComponentSystemTrait} from "./segment.ts";

export const SEEK_ID_KAX_INFO = new Uint8Array([0x15, 0x49, 0xa9, 0x66]);
export const SEEK_ID_KAX_TRACKS = new Uint8Array([0x16, 0x54, 0xae, 0x6b]);
export const SEEK_ID_KAX_CUES = new Uint8Array([0x1c, 0x53, 0xbb, 0x6b]);
export const SEEK_ID_KAX_TAGS = new Uint8Array([0x12, 0x54, 0xc3, 0x67]);

export class SeekSystem extends SegmentComponentSystemTrait<
  EbmlSeekHeadTagType,
  typeof SeekHeadSchema
> {
  override get schema() {
    return SeekHeadSchema;
  }

  seekHeads: SeekHeadType[] = [];
  private offsetToTagMemo: Map<number, EbmlTagType> = new Map();

  memoOffset(tag: EbmlTagType) {
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

  get firstClusterOffset() {
    if (!this.segment.firstCluster) {
      throw new UnreachableOrLogicError('first cluster not found');
    }
    return this.segment.firstCluster.startOffset;
  }
}