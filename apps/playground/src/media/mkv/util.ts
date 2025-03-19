import type { Type } from 'arktype';
import type { EbmlMasterTagType, EbmlTagIdEnum, EbmlTagType } from 'konoebml';

export type InferType<T> = T extends Type<infer U> ? U : never;

export interface TagWithArktypeOptions<
  I extends EbmlTagType['id'],
  S extends Type<any>,
> {
  id: I;
  schema: S;
  extract: (tag: Extract<EbmlTagType, { id: I }>, schema: S) => InferType<S>;
}

export type TagWithArktypeClassInstance<
  I extends EbmlTagType['id'],
  S extends Type<any>,
> = InferType<S> & {
  tag: Extract<EbmlTagType, { id: I }>;
};

export interface TagWithArktypeClass<
  I extends EbmlTagType['id'],
  S extends Type<any>,
> {
  new (
    tag: Extract<EbmlTagType, { id: I }>,
    validatedTag: InferType<S>
  ): TagWithArktypeClassInstance<I, S>;

  fromTag<R extends TagWithArktypeClassInstance<I, S>>(
    this: new (
      tag: Extract<EbmlTagType, { id: I }>,
      validatedTag: InferType<S>
    ) => TagWithArktypeClassInstance<I, S>,
    tag: Extract<EbmlTagType, { id: I }>
  ): R;

  id: I;
  schema: S;
}

export function TagWithArktype<
  I extends EbmlTagType['id'],
  S extends Type<any>,
>({
  id,
  schema,
  extract,
}: TagWithArktypeOptions<I, S>): TagWithArktypeClass<I, S> {
  const tagWithArktypeImpl = class TagWithArktypeImpl {
    static id = id;
    static schema = schema;

    tag: Extract<EbmlTagType, { id: I }>;

    constructor(
      tag: Extract<EbmlTagType, { id: I }>,
      validatedTag: InferType<S>
    ) {
      Object.assign(this, validatedTag);
      this.tag = tag;
    }

    static fromTag(tag: Extract<EbmlTagType, { id: I }>) {
      const extractedData = extract(tag, schema);
      const validatedExtractedData = schema(extractedData);
      // biome-ignore lint/complexity/noThisInStatic: <explanation>
      return new this(tag, validatedExtractedData);
    }
  };

  return tagWithArktypeImpl as unknown as TagWithArktypeClass<I, S>;
}

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
export type MasterChildExtractMap<T, K> = {
  [id in EbmlTagIdEnum]?: K extends keyof T
    ?
        | {
            key: K;
            multi: true;
            extract: (
              tag: Extract<EbmlTagType, { id: id }>
            ) => T[K] extends Array<infer U> ? U : never;
          }
        | {
            key: K;
            multi?: false;
            extract: (tag: Extract<EbmlTagType, { id: id }>) => T[K];
          }
    : never;
};

export function simpleMasterExtractor<
  T extends EbmlMasterTagType,
  S extends Type<any>,
  EM extends MasterChildExtractMap<InferType<S>, keyof InferType<S>>,
>(map: EM) {
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: <explanation>
  return (tag: T, _schema: S): InferType<S> => {
    if (!tag?.children?.length) {
      return {} as unknown as InferType<S>;
    }
    const value = {} as Record<string, any>;
    for (const c of tag.children) {
      const entry = (
        map as unknown as Record<
          string,
          { id: number; multi: boolean; extract: (tag: any) => any }
        >
      )[c.id as number] as any;
      if (entry?.key) {
        const key = entry.key;
        const item = entry.extract ? entry.extract(c) : c.data;
        if (entry.multi) {
          if (value[key]) {
            value[key].push(item);
          } else {
            value[key] = [item];
          }
        } else {
          value[key] = item;
        }
      }
    }
    return value as unknown as InferType<S>;
  };
}
