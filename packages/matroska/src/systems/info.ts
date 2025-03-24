import type {EbmlInfoTagType} from "konoebml";
import {InfoSchema, type InfoType} from "../schema.ts";
import {type SegmentComponent, SegmentComponentSystemTrait} from "./segment.ts";

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