import type { ClusterType } from '../schema';

export function* clusterBlocks(cluster: ClusterType) {
  if (cluster.SimpleBlock) {
    for (const simpleBlock of cluster.SimpleBlock) {
      yield simpleBlock;
    }
  }
  if (cluster.BlockGroup) {
    for (const block of cluster.BlockGroup) {
      yield block;
    }
  }
}
