import type { Type } from 'arktype';
import { EbmlElementType, EbmlTagIdEnum, type EbmlTagType } from 'konoebml';
import { IdMultiSet } from './schema';

export type InferType<T extends Type<any>> = T['infer'];

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

export function convertEbmlTagToComponent (tag: EbmlTagType) {
  if (tag.type === EbmlElementType.Master) {
    const obj: Record<string, any> = {};
    const children = tag.children;
    for (const c of children) {
      const name = EbmlTagIdEnum[c.id];
      const converted = convertEbmlTagToComponent(c);
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
    return obj;
  }
  if (tag.id === EbmlTagIdEnum.SimpleBlock || tag.id === EbmlTagIdEnum.Block) {
    return tag;
  }
  return tag.data;
}
