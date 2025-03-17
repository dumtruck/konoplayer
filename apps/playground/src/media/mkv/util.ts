import { EbmlTagPosition, type EbmlTagType } from 'konoebml';

export function isTagEnd(tag: EbmlTagType): boolean {
  return tag.position === EbmlTagPosition.End;
}
