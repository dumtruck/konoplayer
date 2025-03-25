import { type EbmlEBMLTagType, EbmlTagIdEnum, EbmlTagPosition } from 'konoebml';
import {
  switchMap,
  filter,
  take,
  shareReplay,
  map,
  combineLatest,
  of, type Observable, delayWhen, pipe, finalize, tap, throwIfEmpty,
} from 'rxjs';
import { isTagIdPos } from '../util';
import {createRangedEbmlStream, type CreateRangedEbmlStreamOptions} from './resource';
import { type MatroskaSegmentModel, createMatroskaSegment } from './segment';

export type CreateMatroskaOptions = Omit<
  CreateRangedEbmlStreamOptions,
  'byteStart' | 'byteEnd'
>;

export interface MatroskaModel {
  totalSize?: number;
  initResponse: Response;
  head: EbmlEBMLTagType;
  segment: MatroskaSegmentModel;
}

export function createMatroska(options: CreateMatroskaOptions): Observable<MatroskaModel> {
  const metadataRequest$ = createRangedEbmlStream({
    ...options,
    byteStart: 0,
  });

  return metadataRequest$.pipe(
    switchMap(({ totalSize, ebml$, response }) => {

      /**
       * while [matroska v4](https://www.matroska.org/technical/elements.html) doc tell that there is only one segment in a file
       * some mkv generated by strange tools will emit several
       */
      const segment$ = ebml$.pipe(
        filter(isTagIdPos(EbmlTagIdEnum.Segment, EbmlTagPosition.Start)),
        map((startTag) => createMatroskaSegment({
           startTag,
           matroskaOptions: options,
           ebml$,
         })),
        delayWhen(
          ({ loadedMetadata$ }) => loadedMetadata$
        ),
        take(1),
        shareReplay(1)
      );

      const head$ = ebml$.pipe(
        filter(isTagIdPos(EbmlTagIdEnum.EBML, EbmlTagPosition.End)),
        take(1),
        shareReplay(1),
        throwIfEmpty(() => new Error("failed to find head tag"))
      );

      return combineLatest({
        segment: segment$,
        head: head$,
        totalSize: of(totalSize),
        initResponse: of(response),
      });
    }),
    shareReplay(1)
  );
}
