import { BitReader } from '@konoplayer/core/data';
import { type } from 'arktype';
import type { TrackEntryType } from '../schema';
import { ParseCodecError } from '@konoplayer/core/errors';

export const AV1_CODEC_TYPE = 'AV1';

export const AV1DecoderConfigurationRecordSchema = type({
  marker: type.number, // 1 bit, must be 1
  version: type.number, // 7 bits, must be 1
  seqProfile: type.number, // 3 bits, seq profile (0-7)
  seqLevelIdx0: type.number, // 5 bits, seq level (0-31)
  seqTier0: type.number, // 1 bit, tier (0 or 1)
  highBitdepth: type.number, // 1 bit, high or low
  twelveBit: type.number, // 1 bit, if 12-bit
  monochrome: type.number, // 1 bit, if mono chrome
  chromaSubsamplingX: type.number, // 1 bit, sub sampling X
  chromaSubsamplingY: type.number, // 1 bit, sub sampling Y
  chromaSamplePosition: type.number, // 2 bits
  initialPresentationDelayPresent: type.number, // 1 bit
  initialPresentationDelayMinus1: type.number.optional(), // 4 bits, optoinal
  configOBUs: type.instanceOf(Uint8Array<ArrayBufferLike>), // remain OBU data
});

export type AV1DecoderConfigurationRecordType =
  typeof AV1DecoderConfigurationRecordSchema.infer;

/**
 * [webkit impl](https://github.com/movableink/webkit/blob/7e43fe7000b319ce68334c09eed1031642099726/Source/WebCore/platform/graphics/AV1Utilities.cpp#L48)
 */
export function parseAV1DecoderConfigurationRecord(
  track: TrackEntryType
): AV1DecoderConfigurationRecordType {
  const codecPrivate = track.CodecPrivate;

  if (!codecPrivate) {
    throw new ParseCodecError(
      AV1_CODEC_TYPE,
      'CodecPrivate of AVC Track is missing'
    );
  }

  if (codecPrivate.length < 4) {
    throw new ParseCodecError(
      AV1_CODEC_TYPE,
      'Input data too short for AV1DecoderConfigurationRecord'
    );
  }

  const reader = new BitReader(codecPrivate);

  // Byte 0
  const marker = reader.readBits(1);
  const version = reader.readBits(7);
  if (marker !== 1 || version !== 1) {
    throw new ParseCodecError(
      AV1_CODEC_TYPE,
      `Invalid marker (${marker}) or version (${version})`
    );
  }

  const seqProfile = reader.readBits(3);
  const seqLevelIdx0 = reader.readBits(5);

  // Byte 1
  const seqTier0 = reader.readBits(1);
  const highBitdepth = reader.readBits(1);
  const twelveBit = reader.readBits(1);
  const monochrome = reader.readBits(1);
  const chromaSubsamplingX = reader.readBits(1);
  const chromaSubsamplingY = reader.readBits(1);
  const chromaSamplePosition = reader.readBits(2);

  // Byte 2
  const reserved1 = reader.readBits(3);
  if (reserved1 !== 0) {
    throw new ParseCodecError(
      AV1_CODEC_TYPE,
      `Reserved bits must be 0, got ${reserved1}`
    );
  }
  const initialPresentationDelayPresent = reader.readBits(1);
  let initialPresentationDelayMinus1: number | undefined;
  if (initialPresentationDelayPresent) {
    initialPresentationDelayMinus1 = reader.readBits(4);
  } else {
    const reserved2 = reader.readBits(4);
    if (reserved2 !== 0) {
      throw new ParseCodecError(
        AV1_CODEC_TYPE,
        `Reserved bits must be 0, got ${reserved2}`
      );
    }
  }

  // remain bytes as configOBUs
  const configOBUs = reader.getRemainingBytes();

  return {
    marker,
    version,
    seqProfile,
    seqLevelIdx0,
    seqTier0,
    highBitdepth,
    twelveBit,
    monochrome,
    chromaSubsamplingX,
    chromaSubsamplingY,
    chromaSamplePosition,
    initialPresentationDelayPresent,
    initialPresentationDelayMinus1,
    configOBUs,
  };
}

/**
 * [webkit impl](https://github.com/movableink/webkit/blob/7e43fe7000b319ce68334c09eed1031642099726/Source/WebCore/platform/graphics/AV1Utilities.cpp#L197)
 */
export function genCodecStringByAV1DecoderConfigurationRecord(
  config: AV1DecoderConfigurationRecordType
): string {
  const parts: string[] = [];

  // Prefix
  parts.push('av01');

  // Profile
  parts.push(config.seqProfile.toString());

  // Level and Tier
  const levelStr = config.seqLevelIdx0.toString().padStart(2, '0');
  const tierStr = config.seqTier0 === 0 ? 'M' : 'H';
  parts.push(`${levelStr}${tierStr}`);

  // Bit Depth
  let bitDepthStr: string;
  if (config.highBitdepth === 0) {
    bitDepthStr = '08'; // 8-bit
  } else if (config.twelveBit === 0) {
    bitDepthStr = '10'; // 10-bit
  } else {
    bitDepthStr = '12'; // 12-bit
  }
  parts.push(bitDepthStr);

  // Monochrome
  parts.push(config.monochrome.toString());

  // Chroma Subsampling
  const chromaSubsampling = `${config.chromaSubsamplingX}${config.chromaSubsamplingY}${config.chromaSamplePosition}`;
  parts.push(chromaSubsampling);

  // Initial Presentation Delay（optional）
  if (
    config.initialPresentationDelayPresent === 1 &&
    config.initialPresentationDelayMinus1 !== undefined
  ) {
    const delay = (config.initialPresentationDelayMinus1 + 1)
      .toString()
      .padStart(2, '0');
    parts.push(delay);
  }

  // joined
  return parts.join('.');
}
