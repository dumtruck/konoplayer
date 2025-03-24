import type {EbmlClusterTagType} from "konoebml";
import {ClusterSchema, type ClusterType} from "../schema";
import {type SegmentComponent, SegmentComponentSystemTrait} from "./segment";

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
    this.clustersBuffer.push(cluster);
    return cluster;
  }
}