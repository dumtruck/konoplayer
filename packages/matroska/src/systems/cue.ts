import {type EbmlCuePointTagType, type EbmlCuesTagType, EbmlTagIdEnum} from "konoebml";
import {CuePointSchema, type CuePointType, type CueTrackPositionsType} from "../schema.ts";
import {maxBy} from "lodash-es";
import {type SegmentComponent, SegmentComponentSystemTrait} from "./segment.ts";

export class CueSystem extends SegmentComponentSystemTrait<
  EbmlCuePointTagType,
  typeof CuePointSchema
> {
  override get schema() {
    return CuePointSchema;
  }

  cues: SegmentComponent<CuePointType>[] = [];

  prepareCuesWithTag(tag: EbmlCuesTagType) {
    this.cues = tag.children
      .filter((c) => c.id === EbmlTagIdEnum.CuePoint)
      .map(this.componentFromTag.bind(this));
    return this;
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
    return Math.abs((before.CueTime as number) - seekTime) <
    Math.abs((after.CueTime as number) - seekTime)
      ? before
      : after;
  }

  getCueTrackPositions(
    cuePoint: CuePointType,
    track?: number
  ): CueTrackPositionsType {
    let cueTrackPositions: CueTrackPositionsType | undefined;
    if (track! >= 0) {
      cueTrackPositions = cuePoint.CueTrackPositions.find(
        (c) => c.CueTrack === track
      );
    }
    if (!cueTrackPositions) {
      cueTrackPositions = maxBy(
        cuePoint.CueTrackPositions,
        (c) => c.CueClusterPosition
      )!;
    }
    return cueTrackPositions;
  }

  get prepared(): boolean {
    return this.cues.length > 0;
  }
}