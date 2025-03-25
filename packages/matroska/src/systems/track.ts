import {
  ParseCodecErrors,
  UnsupportedCodecError,
} from '@konoplayer/core/errors';
import {
  EbmlTagIdEnum,
  type EbmlTrackEntryTagType,
  type EbmlTracksTagType,
} from 'konoebml';
import {
  audioCodecIdToWebCodecs,
  videoCodecIdRequirePeekingKeyframe,
  videoCodecIdToWebCodecs,
  type AudioDecoderConfigExt,
  type VideoDecoderConfigExt,
} from '../codecs';
import {
  TrackEntrySchema,
  type TrackEntryType,
  TrackTypeRestrictionEnum,
} from '../schema';
import type { SegmentComponent } from './segment';
import {SegmentComponentSystemTrait} from "./segment-component";
import {pick} from "lodash-es";

export interface GetTrackEntryOptions {
  priority?: (v: SegmentComponent<TrackEntryType>) => number;
  predicate: (v: SegmentComponent<TrackEntryType>) => boolean;
}

export abstract class TrackContext {
  peekingKeyframe?: Uint8Array;
  trackEntry: TrackEntryType;
  timestampScale: number;
  lastBlockTimestamp = Number.NaN;
  averageBlockDuration = Number.NaN;

  constructor(trackEntry: TrackEntryType, timestampScale: number) {
    this.trackEntry = trackEntry;
    this.timestampScale = Number(timestampScale);
  }

  peekKeyframe(payload: Uint8Array) {
    this.peekingKeyframe = payload;
  }

  preparedToConfigure() {
    if (this.requirePeekKeyframe()) {
      return !!this.peekingKeyframe;
    }
    return true;
  }

  abstract requirePeekKeyframe(): boolean;

  abstract buildConfiguration(): Promise<void>;

  predictBlockDuration(blockTimestamp: number): number {
    if (this.trackEntry.DefaultDuration) {
      return Number(this.trackEntry.DefaultDuration);
    }
    const delta = blockTimestamp - this.lastBlockTimestamp;
    this.lastBlockTimestamp = blockTimestamp;
    this.averageBlockDuration = this.averageBlockDuration
      ? this.averageBlockDuration * 0.5 + delta * 0.5
      : delta;
    return this.averageBlockDuration;
  }
}

export class DefaultTrackContext extends TrackContext {
  override requirePeekKeyframe(): boolean {
    return false;
  }

  // biome-ignore lint/suspicious/noEmptyBlockStatements: <explanation>
  override async buildConfiguration(): Promise<void> {}
}

export class VideoTrackContext extends TrackContext {
  configuration!: VideoDecoderConfigExt;

  override requirePeekKeyframe(): boolean {
    return videoCodecIdRequirePeekingKeyframe(this.trackEntry.CodecID);
  }

  async buildConfiguration() {
    const configuration = videoCodecIdToWebCodecs(
      this.trackEntry,
      this.peekingKeyframe
    );
    const checkResult = await VideoDecoder?.isConfigSupported?.(configuration);
    if (!checkResult?.supported) {
      throw new UnsupportedCodecError(configuration.codec, 'video decoder');
    }
    this.configuration = configuration;
  }
}

export class AudioTrackContext extends TrackContext {
  configuration!: AudioDecoderConfigExt;

  override requirePeekKeyframe(): boolean {
    return videoCodecIdRequirePeekingKeyframe(this.trackEntry.CodecID);
  }

  async buildConfiguration() {
    const configuration = audioCodecIdToWebCodecs(
      this.trackEntry,
      this.peekingKeyframe
    );
    const checkResult = await AudioDecoder?.isConfigSupported?.(configuration);
    if (!checkResult?.supported) {
      throw new UnsupportedCodecError(configuration.codec, 'audio decoder');
    }

    this.configuration = configuration;
  }

  override predictBlockDuration(blockTimestamp: number): number {
    if (this.trackEntry.DefaultDuration) {
      return Number(this.trackEntry.DefaultDuration);
    }
    if (this.configuration.samplesPerFrame) {
      return (
        Number(
          this.configuration.samplesPerFrame / this.configuration.sampleRate
        ) * this.timestampScale
      );
    }
    const delta = blockTimestamp - this.lastBlockTimestamp;
    this.lastBlockTimestamp = blockTimestamp;
    this.averageBlockDuration = this.averageBlockDuration
      ? this.averageBlockDuration * 0.5 + delta * 0.5
      : delta;
    return this.averageBlockDuration;
  }
}

export function standardTrackPredicate(track: TrackEntryType) {
  return track.FlagEnabled !== 0;
}

export function standardTrackPriority(track: TrackEntryType) {
  return (Number(!!track.FlagForced) << 8) + (Number(!!track.FlagDefault) << 4);
}

export class TrackSystem extends SegmentComponentSystemTrait<
  EbmlTrackEntryTagType,
  typeof TrackEntrySchema
> {
  override get schema() {
    return TrackEntrySchema;
  }

  tracks: SegmentComponent<TrackEntryType>[] = [];
  trackContexts: Map<number | bigint, TrackContext> = new Map();

  getTrackEntry({
    priority = standardTrackPriority,
    predicate,
  }: GetTrackEntryOptions) {
    return this.tracks
      .filter(predicate)
      .toSorted((a, b) => priority(b) - priority(a))
      .at(0);
  }

  getTrackContext<T extends TrackContext>(
    options: GetTrackEntryOptions
  ): T | undefined {
    const trackEntry = this.getTrackEntry(options);
    const trackNum = trackEntry?.TrackNumber!;
    return this.trackContexts.get(trackNum) as T | undefined;
  }

  prepareTracksWithTag(tag: EbmlTracksTagType) {
    const infoSystem = this.segment.info;
    this.tracks = tag.children
      .filter((c) => c.id === EbmlTagIdEnum.TrackEntry)
      .map((c) => this.componentFromTag(c));
    for (const track of this.tracks) {
      if (track.TrackType === TrackTypeRestrictionEnum.VIDEO) {
        this.trackContexts.set(
          track.TrackNumber,
          new VideoTrackContext(track, Number(infoSystem.info.TimestampScale))
        );
      } else if (track.TrackType === TrackTypeRestrictionEnum.AUDIO) {
        this.trackContexts.set(
          track.TrackNumber,
          new AudioTrackContext(track, Number(infoSystem.info.TimestampScale))
        );
      }
    }
    return this;
  }

  async buildTracksConfiguration() {
    const parseErrors = new ParseCodecErrors();

    for (const context of this.trackContexts.values()) {
      try {
        await context.buildConfiguration();
      } catch (e) {
        parseErrors.cause.push(e as Error);
      }
    }
    if (parseErrors.cause.length > 0) {
      console.error(parseErrors, parseErrors.cause);
    }
  }

  tryPeekKeyframe(tag: { track: number | bigint; frames: Uint8Array[] }) {
    for (const c of this.trackContexts.values()) {
      if (c.trackEntry.TrackNumber === tag.track) {
        c.peekKeyframe(tag.frames?.[0]);
      }
    }
  }

  preparedToConfigureTracks(): boolean {
    for (const c of this.trackContexts.values()) {
      if (!c.preparedToConfigure()) {
        return false;
      }
    }
    return true;
  }
}
