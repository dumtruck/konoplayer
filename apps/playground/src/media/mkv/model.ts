import {
  type EbmlTagType,
  EbmlTagIdEnum,
  EbmlTagPosition,
  type EbmlCuePointTagType,
  type EbmlTracksTagType,
  type EbmlInfoTagType,
  type EbmlCuesTagType,
  type EbmlSeekHeadTagType,
  type EbmlSegmentTagType,
  type EbmlClusterTagType,
} from 'konoebml';
import { isTagEnd } from './util';
import { isEqual } from 'lodash-es';

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
      .filter(isTagEnd)
      .filter((c) => c.id === EbmlTagIdEnum.Seek)
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

  findLocalNodeBySeekId(seekId: Uint8Array): EbmlTagType | undefined {
    return this.findLocalNodeBySeekPosition(
      this.seekEntries.find((c) => isEqual(c.seekId, seekId))?.seekPosition
    );
  }

  findLocalNodeBySeekPosition(
    seekPosition: number | undefined
  ): EbmlTagType | undefined {
    return Number.isSafeInteger(seekPosition)
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

export interface EbmlSeekEntry {
  seekId: Uint8Array;
  seekPosition: number;
}

export class EbmlHead {
  head: EbmlTagType;

  constructor(head: EbmlTagType) {
    this.head = head;
  }
}

export class EbmlCluster {
  cluster: EbmlClusterTagType;
  _timestamp: number;

  constructor(cluster: EbmlClusterTagType) {
    this.cluster = cluster;
    this._timestamp = cluster.children.find(
      (c) => c.id === EbmlTagIdEnum.Timecode
    )?.data as number;
  }

  get timestamp(): number {
    return this._timestamp;
  }
}

export class EbmlCue {
  node: EbmlCuePointTagType;
  _timestamp: number;
  trackPositions: { track: number; position: number }[];

  get timestamp(): number {
    return this._timestamp;
  }

  get position(): number {
    return Math.max(...this.trackPositions.map((t) => t.position));
  }

  constructor(node: EbmlCuePointTagType) {
    this.node = node;
    this._timestamp = node.children.find((c) => c.id === EbmlTagIdEnum.CueTime)
      ?.data as number;
    this.trackPositions = node.children
      .map((t) => {
        if (
          t.id === EbmlTagIdEnum.CueTrackPositions &&
          t.position === EbmlTagPosition.End
        ) {
          const track = t.children.find((t) => t.id === EbmlTagIdEnum.CueTrack)
            ?.data as number;
          const position = t.children.find(
            (t) => t.id === EbmlTagIdEnum.CueClusterPosition
          )?.data as number;

          return track! >= 0 && position! >= 0 ? { track, position } : null;
        }
        return null;
      })
      .filter((a): a is { track: number; position: number } => !!a);
  }
}

export class EbmlCues {
  node: EbmlCuesTagType;
  cues: EbmlCue[];

  constructor(node: EbmlCuesTagType) {
    this.node = node;
    this.cues = node.children
      .filter(isTagEnd)
      .filter((c) => c.id === EbmlTagIdEnum.CuePoint)
      .map((c) => new EbmlCue(c));
  }

  findClosestCue(seekTime: number): EbmlCue | null {
    const cues = this.cues;
    if (!cues || cues.length === 0) {
      return null;
    }

    let left = 0;
    let right = cues.length - 1;

    if (seekTime <= cues[0].timestamp) {
      return cues[0];
    }

    if (seekTime >= cues[right].timestamp) {
      return cues[right];
    }

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);

      if (cues[mid].timestamp === seekTime) {
        return cues[mid];
      }

      if (cues[mid].timestamp < seekTime) {
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
