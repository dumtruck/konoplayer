import {
  type EbmlTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlTracksTagType,
  type EbmlInfoTagType,
  type EbmlCuesTagType,
  type EbmlSeekHeadTagType,
  type EbmlSegmentTagType,
} from 'konoebml';
import { isTagIdPos, simpleMasterExtractor } from './util';
import { isEqual } from 'lodash-es';
import { type } from 'arktype';
import { TagWithArktype } from './util';

export const SEEK_ID_KAX_INFO = new Uint8Array([0x15, 0x49, 0xa9, 0x66]);
export const SEEK_ID_KAX_TRACKS = new Uint8Array([0x16, 0x54, 0xae, 0x6b]);
export const SEEK_ID_KAX_CUES = new Uint8Array([0x1c, 0x53, 0xbb, 0x6b]);

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

export class TrackEntry extends TagWithArktype({
  id: EbmlTagIdEnum.TrackEntry,
  schema: type({
    trackNumber: 'number',
    trackType: 'number',
    trackUID: 'number',
  }),
  extract: simpleMasterExtractor({
    [EbmlTagIdEnum.TrackNumber]: {
      key: 'trackNumber',
      extract: (t) => t.data as number,
    },
    [EbmlTagIdEnum.TrackType]: {
      key: 'trackType',
      extract: (t) => t.data as number,
    },
    [EbmlTagIdEnum.TrackUID]: {
      key: 'trackUID',
      extract: (t) => t.data as number,
    },
  }),
}) {}

export class Tracks extends TagWithArktype({
  id: EbmlTagIdEnum.Tracks,
  schema: type({
    tracks: type.instanceOf(TrackEntry).array(),
  }),
  extract: simpleMasterExtractor({
    [EbmlTagIdEnum.TrackEntry]: {
      key: 'tracks',
      multi: true,
      extract: TrackEntry.fromTag.bind(TrackEntry),
    },
  }),
}) {}

export interface EbmlSeekEntry {
  seekId: Uint8Array;
  seekPosition: number;
}

export class MHead extends TagWithArktype({
  id: EbmlTagIdEnum.EBML,
  schema: type({}),
  extract: () => ({}),
}) {}

export class SimpleBlock extends TagWithArktype({
  id: EbmlTagIdEnum.SimpleBlock,
  schema: type({
    frame: type.instanceOf(Uint8Array),
  }),
  extract: (tag) => ({
    frame: tag.payload,
  }),
}) {}

export class Block extends TagWithArktype({
  id: EbmlTagIdEnum.Block,
  schema: type({}),
  extract: () => ({}),
}) {}

export class Cluster extends TagWithArktype({
  id: EbmlTagIdEnum.Cluster,
  schema: type({
    timestamp: 'number',
    position: 'number?',
    prevSize: 'number?',
    simpleBlock: type.instanceOf(SimpleBlock).array(),
  }),
  extract: simpleMasterExtractor({
    [EbmlTagIdEnum.Timecode]: {
      key: 'timestamp',
      extract: (t) => t.data as number,
    },
    [EbmlTagIdEnum.PrevSize]: {
      key: 'prevSize',
      extract: (t) => t.data as number,
    },
    [EbmlTagIdEnum.SimpleBlock]: {
      key: 'simpleBlock',
      multi: true,
      extract: SimpleBlock.fromTag.bind(SimpleBlock),
    },
  }),
}) {}

export type CuePointType = typeof CuePoint.infer;

export class Cues {
  cues: CuePointType[];

  constructor(
    public readonly tag: EbmlCuesTagType,
    cues: CuePointType[]
  ) {}

  findClosestCue(seekTime: number): CuePoint | null {
    const cues = this.cues;
    if (!cues || cues.length === 0) {
      return null;
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
    return Math.abs(before.timestamp - seekTime) <
      Math.abs(after.timestamp - seekTime)
      ? before
      : after;
  }
}
