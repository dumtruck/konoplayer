import {ParseCodecErrors, UnsupportedCodecError} from "@konoplayer/core/errors.ts";
import {
  EbmlTagIdEnum,
  type EbmlTrackEntryTagType,
  type EbmlTracksTagType
} from "konoebml";
import {
  audioCodecIdToWebCodecs,
  videoCodecIdRequirePeekingKeyframe,
  videoCodecIdToWebCodecs, type AudioDecoderConfigExt, type VideoDecoderConfigExt
} from "../codecs";
import {TrackEntrySchema, type TrackEntryType, TrackTypeRestrictionEnum} from "../schema";
import {type SegmentComponent, SegmentComponentSystemTrait} from "./segment";

export interface GetTrackEntryOptions {
  priority?: (v: SegmentComponent<TrackEntryType>) => number;
  predicate?: (v: SegmentComponent<TrackEntryType>) => boolean;
}

export abstract class TrackContext {
  peekingKeyframe?: Uint8Array;
  trackEntry: TrackEntryType

  constructor(trackEntry: TrackEntryType) {
    this.trackEntry = trackEntry;
  }

  peekKeyframe (payload: Uint8Array) {
    this.peekingKeyframe = payload;
  }

  preparedToConfigure () {
    if (this.requirePeekKeyframe()) {
      return !!this.peekingKeyframe;
    }
    return true;
  }

  abstract requirePeekKeyframe (): boolean;

  abstract buildConfiguration (): Promise<void>;
}

export class DefaultTrackContext extends TrackContext {
  override requirePeekKeyframe(): boolean {
    return false;
  }

  override async buildConfiguration(): Promise<void> {}
}

export class VideoTrackContext extends TrackContext {
  configuration!: VideoDecoderConfigExt;

  override requirePeekKeyframe (): boolean {
    return videoCodecIdRequirePeekingKeyframe(this.trackEntry.CodecID);
  }

  async buildConfiguration () {
    const configuration = videoCodecIdToWebCodecs(this.trackEntry, this.peekingKeyframe);
    if (await VideoDecoder.isConfigSupported(configuration)) {
      throw new UnsupportedCodecError(configuration.codec, 'video decoder');
    }
    this.configuration = configuration;
  }
}

export class AudioTrackContext extends TrackContext {
  configuration!: AudioDecoderConfigExt;

  override requirePeekKeyframe (): boolean {
    return videoCodecIdRequirePeekingKeyframe(this.trackEntry.CodecID);
  }

  async buildConfiguration () {
    const configuration = audioCodecIdToWebCodecs(this.trackEntry, this.peekingKeyframe);
    if (await AudioDecoder.isConfigSupported(configuration)) {
      throw new UnsupportedCodecError(configuration.codec, 'audio decoder');
    }

    this.configuration = configuration;
  }
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
                  priority = (track) =>
                    (Number(!!track.FlagForced) << 4) + Number(!!track.FlagDefault),
                  predicate = (track) => track.FlagEnabled !== 0,
                }: GetTrackEntryOptions) {
    return this.tracks
      .filter(predicate)
      .toSorted((a, b) => priority(b) - priority(a))
      .at(0);
  }

  getTrackContext <T extends TrackContext>(options: GetTrackEntryOptions): T | undefined {
    const trackEntry = this.getTrackEntry(options);
    const trackNum = trackEntry?.TrackNumber!;
    return this.trackContexts.get(trackNum) as T | undefined;
  }

  prepareTracksWithTag(tag: EbmlTracksTagType) {
    this.tracks = tag.children
      .filter((c) => c.id === EbmlTagIdEnum.TrackEntry)
      .map((c) => this.componentFromTag(c));
    for (const track of this.tracks) {
      if (track.TrackType === TrackTypeRestrictionEnum.VIDEO) {
        this.trackContexts.set(track.TrackNumber, new VideoTrackContext(track))
      } else if (track.TrackType === TrackTypeRestrictionEnum.AUDIO) {
        this.trackContexts.set(track.TrackNumber, new AudioTrackContext(track))
      }
    }
    return this;
  }

  async buildTracksConfiguration () {
    const parseErrors = new ParseCodecErrors();

    for (const context of this.trackContexts.values()) {
      try {
        await context.buildConfiguration();
      } catch (e) {
        parseErrors.cause.push(e as Error);
      }
    }
    if (parseErrors.cause.length > 0) {
      console.error(parseErrors);
    }
  }

  tryPeekKeyframe (tag: { track: number | bigint, frames: Uint8Array[] }) {
    for (const c of this.trackContexts.values()) {
      if (c.trackEntry.TrackNumber === tag.track) {
        c.peekKeyframe(tag.frames?.[0])
      }
    }
  }

  preparedToConfigureTracks (): boolean {
    for (const c of this.trackContexts.values()) {
      if (!c.preparedToConfigure()) {
        return false;
      }
    }
    return true;
  }
}