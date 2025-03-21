import {
  type EbmlTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlTracksTagType,
  type EbmlInfoTagType,
  type EbmlCuesTagType,
  type EbmlSeekHeadTagType,
  type EbmlSegmentTagType,
  type EbmlCuePointTagType,
  type EbmlMasterTagType,
} from 'konoebml';
import {
  convertEbmlTagToModelShape,
  type InferType,
  isTagIdPos,
  SEEK_ID_KAX_CUES,
  SEEK_ID_KAX_INFO,
  SEEK_ID_KAX_TRACKS,
} from './util';
import { isEqual } from 'lodash-es';
import type { Type } from 'arktype';
import { CuePointSchema, type CuePointType } from './schema';

export abstract class StandardComponentSystem<
  E extends EbmlMasterTagType,
  S extends Type<any>,
> {
  abstract get schema(): S;

  componentFromTag(tag: E): InferType<S> {
    const extracted = convertEbmlTagToModelShape(tag);
    return this.schema.assert(extracted) as InferType<S>;
  }
}

export class EbmlSegment {
  startNode: EbmlSegmentTagType;
  seekHeadNode?: EbmlSeekHeadTagType;
  seekEntries: EbmlSeekEntry[];
  tracksNode?: EbmlTracksTagType;
  infoNode?: EbmlInfoTagType;
  cuesNode?: EbmlCuesTagType;
  metaBuffer: EbmlTagType[] = [];
  metaOffsets: Map<number, EbmlTagType> = new Map();

  constructor(startNode: EbmlSegmentTagType) {
    this.startNode = startNode;
    this.seekEntries = [];
    this.metaBuffer = [];
  }

  get dataOffset() {
    return this.startNode.startOffset + this.startNode.headerLength;
  }

  private addSeekHead(node: EbmlSeekHeadTagType) {
    this.seekHeadNode = node;
    this.seekEntries = this.seekHeadNode.children
      .filter(isTagIdPos(EbmlTagIdEnum.Seek, EbmlTagPosition.End))
      .map((c) => {
        const seekId = c.children.find(
          (item) => item.id === EbmlTagIdEnum.SeekID
        )?.data;
        const seekPosition = c.children.find(
          (item) => item.id === EbmlTagIdEnum.SeekPosition
        )?.data as number;
        if (seekId && seekPosition) {
          return {
            seekId,
            seekPosition,
          };
        }
        return null;
      })
      .filter((c): c is EbmlSeekEntry => !!c);
  }

  findSeekPositionBySeekId(seekId: Uint8Array): number | undefined {
    return this.seekEntries.find((c) => isEqual(c.seekId, seekId))
      ?.seekPosition;
  }

  findLocalNodeBySeekId(seekId: Uint8Array): EbmlTagType | undefined {
    return this.findLocalNodeBySeekPosition(
      this.findSeekPositionBySeekId(seekId)
    );
  }

  findLocalNodeBySeekPosition(
    seekPosition: number | undefined
  ): EbmlTagType | undefined {
    return seekPosition! >= 0
      ? this.metaOffsets.get(seekPosition as number)
      : undefined;
  }

  markMetaEnd() {
    this.infoNode = this.findLocalNodeBySeekId(
      SEEK_ID_KAX_INFO
    ) as EbmlInfoTagType;
    this.tracksNode = this.findLocalNodeBySeekId(
      SEEK_ID_KAX_TRACKS
    ) as EbmlTracksTagType;
    this.cuesNode = this.findLocalNodeBySeekId(
      SEEK_ID_KAX_CUES
    ) as EbmlCuesTagType;
  }

  scanMeta(node: EbmlTagType): boolean {
    if (
      node.id === EbmlTagIdEnum.SeekHead &&
      node.position === EbmlTagPosition.End
    ) {
      this.addSeekHead(node);
    }
    this.metaBuffer.push(node);
    this.metaOffsets.set(node.startOffset - this.dataOffset, node);
    return true;
  }
}

export class CuesSystem extends StandardComponentSystem<
  EbmlCuePointTagType,
  typeof CuePointSchema
> {
  schema = CuePointSchema;
  cues: CuePointType[];

  constructor(cues: CuePointType[]) {
    super();
    this.cues = cues;
  }

  findClosestCue(seekTime: number): CuePointType | undefined {
    const cues = this.cues;
    if (!cues || cues.length === 0) {
      return undefined;
    }

    let left = 0;
    let right = cues.length - 1;

    if (seekTime <= cues[0].CueTime) {
      return cues[0];
    }

    if (seekTime >= cues[right].CueTime) {
      return cues[right];
    }

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      if (cues[mid].CueTime === seekTime) {
        return cues[mid];
      }

      if (cues[mid].CueTime < seekTime) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    const before = cues[right];
    const after = cues[left];
    return Math.abs(before.CueTime - seekTime) <
      Math.abs(after.CueTime - seekTime)
      ? before
      : after;
  }
}
