import {EbmlTagIdEnum, type EbmlTagsTagType, type EbmlTagTagType} from "konoebml";
import {TagSchema, type TagType} from "../schema.ts";

import {type SegmentComponent, SegmentComponentSystemTrait} from "./segment.ts";

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