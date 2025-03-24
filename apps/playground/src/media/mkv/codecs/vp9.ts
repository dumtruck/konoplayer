import { type } from 'arktype';
import type {TrackEntryType} from "@/media/mkv/schema.ts";

export const VP9DecoderProfileSchema = type('0 | 1 | 2 | 3');

export const VP9DecoderConfigurationRecordSchema = type({
  profile: VP9DecoderProfileSchema,
  level: type.number,
  bitDepth: type.number,
});

export type VP9DecoderConfigurationRecordType =
  typeof VP9DecoderConfigurationRecordSchema.infer;

export function parseVP9DecoderConfigurationRecord(track: TrackEntryType) {
  const pixelWidth = Number(track.Video?.PixelWidth);
  const pixelHeight = Number(track.Video?.PixelHeight);
  const pixels = pixelWidth * pixelHeight;
  const bitDepth = Number(track.Video?.Colour?.BitsPerChannel) || 10;

}
