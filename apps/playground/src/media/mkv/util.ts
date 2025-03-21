import type { Type } from 'arktype';
import { EbmlElementType, EbmlTagIdEnum, type EbmlTagType } from 'konoebml';
import { IdMultiSet } from './schema';

export type InferType<T> = T extends Type<infer U> ? U : never;

export const SEEK_ID_KAX_INFO = new Uint8Array([0x15, 0x49, 0xa9, 0x66]);
export const SEEK_ID_KAX_TRACKS = new Uint8Array([0x16, 0x54, 0xae, 0x6b]);
export const SEEK_ID_KAX_CUES = new Uint8Array([0x1c, 0x53, 0xbb, 0x6b]);

export type PredicateIdExtract<T, K> = Extract<T, { id: K }>;

export type PredicatePositionExtract<
  T extends { position: string },
  P,
> = P extends T['position'] ? T : never;

export function isTagIdPos<
  I extends EbmlTagIdEnum,
  P extends PredicateIdExtract<EbmlTagType, I>['position'] | '*' = '*',
>(id: I, pos?: P) {
  return (tag: EbmlTagType): tag is PredicateIdExtract<EbmlTagType, I> =>
    tag.id === id && (pos === '*' || pos === tag.position);
}

export function isTagPos<
  T extends { position: string },
  P extends T['position'],
>(pos: P | '*' = '*') {
  return (tag: T): tag is PredicatePositionExtract<T, P> =>
    pos === '*' || pos === tag.position;
}

export function convertEbmlTagToModelShape(tag: EbmlTagType) {
  if (tag.type === EbmlElementType.Master) {
    const obj: Record<string, any> = {};
    const children = tag.children;
    for (const c of children) {
      const name = EbmlTagIdEnum[c.id];
      const converted = convertEbmlTagToModelShape(c);
      if (IdMultiSet.has(c.id)) {
        if (obj[name]) {
          obj[name].push(converted);
        } else {
          obj[name] = [converted];
        }
      } else {
        obj[name] = converted;
      }
    }
  }
  if (tag.id === EbmlTagIdEnum.SimpleBlock || tag.id === EbmlTagIdEnum.Block) {
    return tag;
  }
  return tag.data;
}
