import { type } from 'arktype';
import type { TrackEntryType } from '../schema';
import { BitReader } from '@konoplayer/core/data';
import { ParseCodecError } from '@konoplayer/core/errors';

export const VP9_CODEC_TYPE = 'vp9';

export enum VP9ColorSpaceEnum {
  UNKNOWN = 0,
  BT_601 = 1, // eq bt_470bg
  BT_709 = 2,
  SMPTE_170 = 3,
  SMPTE_240 = 4,
  BT_2020 = 5,
  RESERVED = 6,
  SRGB = 7,
}

export enum VP9YUVRange {
  STUDIO_SWING = 0,
  FULL_SWING = 1,
}

export enum VP9Subsampling {
  UNKNOWN = 0,
  YUV420 = 1,
  YUV422 = 2,
  YUV440 = 3,
  YUV444 = 4,
}

export const VP9PerformenceLevel = [
  { level: '10', maxSampleRate: 829440, maxResolution: 36864 }, // Level 1
  { level: '11', maxSampleRate: 2764800, maxResolution: 73728 }, // Level 1
  { level: '20', maxSampleRate: 4608000, maxResolution: 122880 }, // Level 2
  { level: '21', maxSampleRate: 9216000, maxResolution: 245760 }, // Level 2.1
  { level: '30', maxSampleRate: 20736000, maxResolution: 552960 }, // Level 3
  { level: '31', maxSampleRate: 36864000, maxResolution: 983040 }, // Level 3.1
  { level: '40', maxSampleRate: 83558400, maxResolution: 2228224 }, // Level 4
  { level: '41', maxSampleRate: 160432128, maxResolution: 2228224 }, // Level 4.1
  { level: '50', maxSampleRate: 311951360, maxResolution: 8912896 }, // Level 5
  { level: '51', maxSampleRate: 588251136, maxResolution: 8912896 }, // Level 5.1
  { level: '52', maxSampleRate: 1176502272, maxResolution: 8912896 }, // Level 5.2
  { level: '60', maxSampleRate: 1176502272, maxResolution: 35651584 }, // Level 6
  { level: '61', maxSampleRate: 2353004544, maxResolution: 35651584 }, // Level 6.1
  { level: '62', maxSampleRate: 4706009088, maxResolution: 35651584 }, // Level 6.2
];

export const VP9DecoderConfigurationRecordSchema = type({
  profile: type.number, // 0 | 1 | 2 | 3,
  bitDepth: type.number, // 8 | 10 | 12
  colorSpace: type.number,
  subsampling: type.number, // 420 | 422 | 444
  width: type.number,
  height: type.number,
  yuvRangeFlag: type.number.optional(),
  hasScaling: type.boolean,
  renderWidth: type.number,
  renderHeight: type.number,
  frameRate: type.number, // frame per second
  estimateLevel: type.string,
});

export type VP9DecoderConfigurationRecordType =
  typeof VP9DecoderConfigurationRecordSchema.infer;

export function parseVP9DecoderConfigurationRecord(
  track: TrackEntryType,
  keyframe: Uint8Array
): VP9DecoderConfigurationRecordType {
  const reader = new BitReader(keyframe);
  const frameRate = 1_000_000_000 / Number(track.DefaultDuration) || 30;

  // Frame Marker: 2 bits, must be 0b10
  const frameMarker = reader.readBits(2);
  if (frameMarker !== 2) {
    throw new ParseCodecError(VP9_CODEC_TYPE, 'invalid frame marker');
  }

  // Profile: 2 bits
  const version = reader.readBits(1);
  const high = reader.readBits(1);

  const profile = (high << 1) + version;

  let reservedZero = 0;
  if (profile === 3) {
    reservedZero = reader.readBits(1);
    if (reservedZero !== 0) {
      throw new ParseCodecError(
        VP9_CODEC_TYPE,
        'Invalid reserved zero bit for profile 3'
      );
    }
  }

  // Show Existing Frame: 1 bit
  const showExistingFrame = reader.readBits(1);
  if (showExistingFrame === 1) {
    throw new ParseCodecError(VP9_CODEC_TYPE, 'not a keyframe to parse');
  }

  // Frame Type: 1 bit (0 = keyframe)
  const frameType = reader.readBits(1);
  if (frameType !== 0) {
    throw new ParseCodecError(VP9_CODEC_TYPE, 'not a keyframe to parse');
  }

  // Show Frame and Error Resilient
  const _showFrame = reader.readBits(1);
  const _errorResilient = reader.readBits(1);

  // Sync Code: 3 bytes (0x49, 0x83, 0x42)
  const syncCode =
    (reader.readBits(8) << 16) | (reader.readBits(8) << 8) | reader.readBits(8);
  if (syncCode !== 0x498342) {
    throw new ParseCodecError(VP9_CODEC_TYPE, 'Invalid sync code');
  }

  // Bit Depth
  let bitDepth: number;
  if (profile >= 2) {
    const tenOrTwelveBit = reader.readBits(1);
    bitDepth = tenOrTwelveBit === 0 ? 10 : 12;
  } else {
    bitDepth = 8;
  }

  const colorSpace = reader.readBits(3);

  let subsamplingX: number;
  let subsamplingY: number;
  let yuvRangeFlag: number | undefined;
  if (colorSpace !== VP9ColorSpaceEnum.SRGB) {
    yuvRangeFlag = reader.readBits(1);
    if (profile === 1 || profile === 3) {
      subsamplingX = reader.readBits(1);
      subsamplingY = reader.readBits(1);
      reservedZero = reader.readBits(1);
    } else {
      subsamplingX = 1;
      subsamplingY = 1;
    }
  } else {
    if (profile !== 1 && profile !== 3) {
      throw new ParseCodecError(
        VP9_CODEC_TYPE,
        'VP9 profile with sRGB ColorSpace must be 1 or 3'
      );
    }
    subsamplingX = 0;
    subsamplingY = 0;
    reservedZero = reader.readBits(1);
  }

  let subsampling: VP9Subsampling;

  if (!subsamplingX && subsamplingY) {
    subsampling = VP9Subsampling.YUV440;
  } else if (subsamplingX && !subsamplingY) {
    subsampling = VP9Subsampling.YUV422;
  } else if (subsamplingX && subsamplingY) {
    subsampling = VP9Subsampling.YUV420;
  } else if (!subsamplingX && !subsamplingY) {
    subsampling = VP9Subsampling.YUV444;
  } else {
    subsampling = VP9Subsampling.UNKNOWN;
  }

  // Frame Size (resolution)
  const widthMinus1 = reader.readBits(16);
  const heightMinus1 = reader.readBits(16);
  const hasScaling = !!reader.readBits(1);
  let renderWidthMinus1 = widthMinus1;
  let renderHeightMinus1 = heightMinus1;
  if (hasScaling) {
    renderWidthMinus1 = reader.readBits(16);
    renderHeightMinus1 = reader.readBits(16);
  }

  const width = widthMinus1 + 1;
  const height = heightMinus1 + 1;

  const sampleRate = width * height * frameRate;
  const resolution = width * height;

  let estimateLevel = '62';
  for (const { level, maxSampleRate, maxResolution } of VP9PerformenceLevel) {
    if (sampleRate <= maxSampleRate && resolution <= maxResolution) {
      // 检查 profile 和 bitDepth 的额外要求
      if (profile >= 2 && bitDepth > 8 && Number.parseFloat(level) < 20) {
        continue;
      }
      estimateLevel = level;
      break;
    }
  }

  return {
    profile,
    bitDepth,
    colorSpace,
    subsampling,
    yuvRangeFlag,
    width,
    height,
    hasScaling,
    renderWidth: renderWidthMinus1 + 1,
    renderHeight: renderHeightMinus1 + 1,
    frameRate,
    estimateLevel,
  };
}

// The format of the 'vp09' codec string is specified in the webm GitHub repo:
// <https://github.com/webmproject/vp9-dash/blob/master/VPCodecISOMediaFileFormatBinding.md#codecs-parameter-string>
//
// The codecs parameter string for the VP codec family is as follows:
//   <sample entry 4CC>.<profile>.<level>.<bitDepth>.<chromaSubsampling>.
//   <colourPrimaries>.<transferCharacteristics>.<matrixCoefficients>.
//   <videoFullRangeFlag>
//  All parameter values are expressed as double-digit decimals.
//  sample entry 4CC, profile, level, and bitDepth are all mandatory fields.
export function genCodecStringByVP9DecoderConfigurationRecord(
  config: VP9DecoderConfigurationRecordType
): string {
  const profileStr = config.profile.toString().padStart(2, '0');
  const bitDepthStr = config.bitDepth.toString().padStart(2, '0');
  const levelStr = config.estimateLevel;

  return `vp09.${profileStr}.${levelStr}.${bitDepthStr}`;
}
