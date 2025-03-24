import { ParseCodecError } from '@konoplayer/core/errors';
import { ArkErrors, type } from 'arktype';
import type { TrackEntryType } from '../schema';

export const HEVC_CODEC_TYPE = 'h265(HEVC)';

export const HEVCDecoderConfigurationRecordArraySchema = type({
  arrayCompleteness: type.number,
  nalUnitType: type.number,
  numNalus: type.number,
  nalUnit: type.instanceOf(Uint8Array<ArrayBufferLike>).array(),
});

export type HEVCDecoderConfigurationRecordArrayType =
  typeof HEVCDecoderConfigurationRecordArraySchema.infer;

// Define the schema for HEVCDecoderConfigurationRecord
export const HEVCDecoderConfigurationRecordSchema = type({
  configurationVersion: type.number, // Must be 1
  generalProfileSpace: type.number,
  generalTierFlag: type.number,
  generalProfileIdc: type.number,
  generalProfileCompatibilityFlags: type.number,
  generalConstraintIndicatorFlags: type.number,
  generalLevelIdc: type.number,
  minSpatialSegmentationIdc: type.number,
  parallelismType: type.number,
  chromaFormat: type.number,
  bitDepthLumaMinus8: type.number,
  bitDepthChromaMinus8: type.number,
  avgFrameRate: type.number,
  constantFrameRate: type.number,
  numTemporalLayers: type.number,
  temporalIdNested: type.number,
  lengthSizeMinusOne: type.number,
  numOfArrays: type.number,
  nalUnits: HEVCDecoderConfigurationRecordArraySchema.array(),
});

export type HEVCDecoderConfigurationRecordType =
  typeof HEVCDecoderConfigurationRecordSchema.infer;

export function parseHEVCDecoderConfigurationRecord(
  track: TrackEntryType
): HEVCDecoderConfigurationRecordType {
  const codecPrivate = track.CodecPrivate;
  if (!codecPrivate) {
    throw new ParseCodecError(
      HEVC_CODEC_TYPE,
      'CodecPrivate of HEVC Track is missing'
    );
  }
  const view = new DataView(codecPrivate.buffer);
  let offset = 0;

  const readUint8 = (move: boolean) => {
    const result = view.getUint8(offset);
    if (move) {
      offset += 1;
    }
    return result;
  };

  const readUint16 = (move: boolean) => {
    const result = view.getUint16(offset, false);
    if (move) {
      offset += 2;
    }
    return result;
  };

  const readUint48 = (move: boolean) => {
    const result =
      view.getUint16(offset, false) * 2 ** 32 +
      view.getUint32(offset + 2, false);
    if (move) {
      offset += 6;
    }
    return result;
  };

  const readUint32 = (move: boolean) => {
    const result = view.getUint32(offset, false);
    if (move) {
      offset += 4;
    }
    return result;
  };

  // Read and validate basic fields
  const config: HEVCDecoderConfigurationRecordType = {
    configurationVersion: readUint8(true),
    generalProfileSpace: (readUint8(false) & 0xc0) >> 6,
    generalTierFlag: (readUint8(false) & 0x20) >> 5,
    generalProfileIdc: readUint8(true) & 0x1f,
    generalProfileCompatibilityFlags: readUint32(true),
    generalConstraintIndicatorFlags: readUint48(true),
    generalLevelIdc: readUint8(true),
    minSpatialSegmentationIdc: readUint16(true) & 0x0fff,
    parallelismType: readUint8(true) & 0x03,
    chromaFormat: readUint8(true) & 0x03,
    bitDepthLumaMinus8: readUint8(true) & 0x07,
    bitDepthChromaMinus8: readUint8(true) & 0x07,
    avgFrameRate: readUint16(true),
    constantFrameRate: (readUint8(false) & 0xc0) >> 6,
    numTemporalLayers: (readUint8(false) & 0x38) >> 3,
    temporalIdNested: (readUint8(false) & 0x04) >> 2,
    lengthSizeMinusOne: readUint8(true) & 0x03,
    numOfArrays: readUint8(true),
    nalUnits: [],
  };

  // Parse NAL unit arrays
  const arrays = config.nalUnits;

  for (let i = 0; i < config.numOfArrays; i++) {
    const array: HEVCDecoderConfigurationRecordArrayType = {
      arrayCompleteness: (readUint8(false) & 0x80) >> 7,
      nalUnitType: readUint8(true) & 0x3f,
      numNalus: readUint16(true),
      nalUnit: [] as Uint8Array<ArrayBufferLike>[],
    };

    for (let j = 0; j < array.numNalus; j++) {
      const nalUnitLength = readUint16(true);
      array.nalUnit.push(codecPrivate.subarray(offset, offset + nalUnitLength));
      offset += nalUnitLength;
    }
    arrays.push(array);
  }

  // Validate using arktype
  const validation = HEVCDecoderConfigurationRecordSchema(config);
  if (validation instanceof ArkErrors) {
    const error = new ParseCodecError(
      HEVC_CODEC_TYPE,
      'Invalid HEVC configuration record'
    );
    error.cause = validation;
    throw error;
  }

  return validation;
}

function reverseBits32(value: number): number {
  let result = 0;
  for (let i = 0; i < 32; i++) {
    result = (result << 1) | ((value >> i) & 1);
  }
  return result;
}

/**
 * @see[webkit implementation](https://github.com/movableink/webkit/blob/7e43fe7000b319ce68334c09eed1031642099726/Source/WebCore/platform/graphics/HEVCUtilities.cpp#L204)
 */
export function genCodecStringByHEVCDecoderConfigurationRecord(
  config: HEVCDecoderConfigurationRecordType
) {
  const result: string[] = [];

  // prefix
  result.push(`hev${config.configurationVersion}`);

  // Profile Space
  if (config.generalProfileSpace > 0) {
    const profileSpaceChar = String.fromCharCode(
      'A'.charCodeAt(0) + config.generalProfileSpace - 1
    );
    result.push(profileSpaceChar + config.generalProfileIdc.toString());
  } else {
    result.push(config.generalProfileIdc.toString());
  }

  // Profile Compatibility Flags
  const compatFlags = reverseBits32(config.generalProfileCompatibilityFlags)
    .toString(16)
    .toUpperCase();
  result.push(compatFlags);

  // Tier Flag and Level IDC
  const tierPrefix = config.generalTierFlag ? 'H' : 'L';
  result.push(tierPrefix + config.generalLevelIdc.toString());

  // Constraint Indicator Flags
  let constraintBytes: number[];
  if (Array.isArray(config.generalConstraintIndicatorFlags)) {
    constraintBytes = config.generalConstraintIndicatorFlags as number[];
  } else {
    // split 48 bit integer into 6 byte
    const flags = BigInt(config.generalConstraintIndicatorFlags);
    constraintBytes = [];
    for (let i = 5; i >= 0; i--) {
      constraintBytes.push(Number((flags >> BigInt(8 * i)) & BigInt(0xff)));
    }
  }

  // find last non-zero byte
  const lastNonZeroIndex = constraintBytes.reduce(
    (last, byte, i) => (byte ? i : last),
    -1
  );
  if (lastNonZeroIndex >= 0) {
    for (let i = 0; i <= lastNonZeroIndex; i++) {
      const byteHex = constraintBytes[i]
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
      result.push(byteHex);
    }
  }

  return result.join('.');
}
