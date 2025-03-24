import { Type } from 'arktype';
import { EbmlStreamDecoder, EbmlTagPosition, EbmlTagType } from 'konoebml';
import { convertEbmlTagToComponent } from '@konoplayer/matroska/util';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import { TransformStream } from 'node:stream/web';
import path from 'node:path';

export interface LoadRangedResourceOptions<S extends Type<any> = any> {
  resource: string;
  byteStart?: number;
  byteEnd?: number;
  schema?: S;
  predicate?: (tag: EbmlTagType) => boolean;
}

export async function loadComponentFromRangedResource<
  T,
  S extends Type<any> = any,
>({
  resource,
  byteStart,
  byteEnd,
  predicate = (tag) => !tag?.parent && tag.position !== EbmlTagPosition.Start,
  schema,
}: LoadRangedResourceOptions<S>): Promise<T[]> {
  const input = Readable.toWeb(
    fs.createReadStream(
      path.join(import.meta.dirname, '..', '..', '..', 'resources', resource),
      {
        start: byteStart,
        end: byteEnd,
      }
    )
  );

  const output = input.pipeThrough(
    new EbmlStreamDecoder({
      streamStartOffset: byteStart,
      collectChild: true,
    }) as unknown as TransformStream<Uint8Array, EbmlTagType>
  );

  const result: T[] = [];

  for await (const t of output) {
    if (predicate(t)) {
      let component = convertEbmlTagToComponent(t) as T;
      if (schema) {
        component = schema.assert(component);
      }
      result.push(component);
    }
  }
  return result;
}
