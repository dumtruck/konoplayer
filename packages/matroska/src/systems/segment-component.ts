import type {EbmlMasterTagType} from "konoebml";
import {ArkErrors, type Type} from "arktype";
import {convertEbmlTagToComponent, type InferType} from "../util";
import type {SegmentComponent, SegmentSystem} from "./segment";

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