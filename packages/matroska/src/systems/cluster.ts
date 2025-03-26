import type { EbmlClusterTagType } from 'konoebml';
import {
  ClusterSchema,
  type SimpleBlockType,
  type ClusterType,
  type BlockGroupType,
  type TrackEntryType,
} from '../schema';
import { type SegmentComponent } from './segment';
import { SegmentComponentSystemTrait } from './segment-component';

export abstract class BlockViewTrait {
  abstract get keyframe(): boolean;

  abstract get frames(): Uint8Array[];

  abstract get trackNum(): number | bigint;

  abstract get relTime(): number;
}

export class SimpleBlockView extends BlockViewTrait {
  constructor(public readonly block: SimpleBlockType) {
    super();
  }

  get keyframe() {
    return !!this.block.keyframe;
  }

  get frames(): Uint8Array<ArrayBufferLike>[] {
    return this.block.frames;
  }

  get trackNum() {
    return this.block.track;
  }

  get relTime() {
    return this.block.value;
  }
}

export class BlockGroupView extends BlockViewTrait {
  constructor(public readonly block: BlockGroupType) {
    super();
  }

  get keyframe() {
    return !this.block.ReferenceBlock;
  }

  get frames(): Uint8Array<ArrayBufferLike>[] {
    return this.block.Block.frames;
  }
  get trackNum() {
    return this.block.Block.track;
  }

  get relTime() {
    return this.block.Block.value;
  }
}

export class ClusterSystem extends SegmentComponentSystemTrait<
  EbmlClusterTagType,
  typeof ClusterSchema
> {
  override get schema() {
    return ClusterSchema;
  }

  clustersBuffer: SegmentComponent<ClusterType>[] = [];

  addClusterWithTag(tag: EbmlClusterTagType) {
    const cluster = this.componentFromTag(tag);
    // this.clustersBuffer.push(cluster);
    return cluster;
  }

  *enumerateBlocks(
    cluster: ClusterType,
    track: TrackEntryType
  ): Generator<BlockViewTrait> {
    if (cluster.BlockGroup && cluster.SimpleBlock) {
      const blocks = [];
      for (const block of cluster.BlockGroup) {
        if (block.Block.track === track.TrackNumber) {
          blocks.push(new BlockGroupView(block));
        }
      }
      for (const block of cluster.SimpleBlock) {
        if (block.track === track.TrackNumber) {
          blocks.push(new SimpleBlockView(block));
        }
      }
      blocks.sort((a, b) => a.relTime - b.relTime);
      yield* blocks;
    } else {
      if (cluster.SimpleBlock) {
        for (const block of cluster.SimpleBlock) {
          if (block.track === track.TrackNumber) {
            yield new SimpleBlockView(block);
          }
        }
      }
      if (cluster.BlockGroup) {
        for (const block of cluster.BlockGroup) {
          if (block.Block.track === track.TrackNumber) {
            yield new BlockGroupView(block);
          }
        }
      }
    }
  }
}
