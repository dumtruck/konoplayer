import { ParseCodecPrivateError } from '@/media/base/errors';
import { ArkErrors, type } from 'arktype';

export const HEVC_CODEC_TYPE = 'h265(HEVC)';

export const HEVCDecoderConfigurationRecordArraySchema = type({
  arrayCompleteness: type.boolean,
  reserved: type.number,
  NALUnitType: type.number,
  numNalus: type.number,
  nalUnits: type.instanceOf(Uint8Array<ArrayBufferLike>).array(),
});

export type HEVCDecoderConfigurationRecordArrayType =
  typeof HEVCDecoderConfigurationRecordArraySchema.infer;

// Define the schema for HEVCDecoderConfigurationRecord
export const HEVCDecoderConfigurationRecordSchema = type({
  configurationVersion: type.number, // Must be 1
  generalProfileSpace: type.number,
  generalTierFlag: type.boolean,
  generalProfileIdc: type.number,
  generalProfileCompatibilityFlags: type.number,
  generalConstraintIndicatorFlags: type.number.array().exactlyLength(6), // Fixed 6-byte array
  generalLevelIdc: type.number,
  reserved1: type.number, // 4 bits reserved, must be 1111
  minSpatialSegmentationIdc: type.number,
  reserved2: type.number, // 6 bits reserved, must be 111111
  parallelismType: type.number,
  chromaFormat: type.number,
  bitDepthLumaMinus8: type.number,
  bitDepthChromaMinus8: type.number,
  avgFrameRate: type.number,
  constantFrameRate: type.number,
  numTemporalLayers: type.number,
  temporalIdNested: type.boolean,
  lengthSizeMinusOne: type.number,
  numOfArrays: type.number,
  arrays: HEVCDecoderConfigurationRecordArraySchema.array(),
});

export type HEVCDecoderConfigurationRecordType =
  typeof HEVCDecoderConfigurationRecordSchema.infer;

/**
 * Parse HEVCDecoderConfigurationRecord from codec_private Uint8Array
 * @param codecPrivate - Uint8Array containing codec_private data
 * @returns Parsed HEVCDecoderConfigurationRecord or throws an error if invalid
 */
export function parseHEVCDecoderConfigurationRecord(
  codecPrivate: Uint8Array
): HEVCDecoderConfigurationRecordType {
  let offset = 0;

  // Read and validate basic fields
  const config: HEVCDecoderConfigurationRecordType = {
    configurationVersion: codecPrivate[offset++],
    generalProfileSpace: codecPrivate[offset] >> 6,
    generalTierFlag: Boolean(codecPrivate[offset] & 0x20),
    generalProfileIdc: codecPrivate[offset++] & 0x1f,
    generalProfileCompatibilityFlags:
      (codecPrivate[offset] << 24) |
      (codecPrivate[offset + 1] << 16) |
      (codecPrivate[offset + 2] << 8) |
      codecPrivate[offset + 3],
    generalConstraintIndicatorFlags: Array.from(
      codecPrivate.subarray(offset + 4, offset + 10)
    ),
    generalLevelIdc: codecPrivate[offset + 10],
    reserved1: (codecPrivate[offset + 11] & 0xf0) >> 4, // 4 bits
    minSpatialSegmentationIdc:
      ((codecPrivate[offset + 11] & 0x0f) << 8) | codecPrivate[offset + 12],
    reserved2: (codecPrivate[offset + 13] & 0xfc) >> 2, // 6 bits
    parallelismType: codecPrivate[offset + 13] & 0x03,
    chromaFormat: (codecPrivate[offset + 14] & 0xe0) >> 5,
    bitDepthLumaMinus8: (codecPrivate[offset + 14] & 0x1c) >> 2,
    bitDepthChromaMinus8: codecPrivate[offset + 14] & 0x03,
    avgFrameRate: (codecPrivate[offset + 15] << 8) | codecPrivate[offset + 16],
    constantFrameRate: (codecPrivate[offset + 17] & 0xc0) >> 6,
    numTemporalLayers: (codecPrivate[offset + 17] & 0x38) >> 3,
    temporalIdNested: Boolean(codecPrivate[offset + 17] & 0x04),
    lengthSizeMinusOne: codecPrivate[offset + 17] & 0x03,
    numOfArrays: codecPrivate[offset + 18],
    arrays: [],
  };
  offset += 19;

  // Parse NAL unit arrays
  const arrays = config.arrays;
  for (let i = 0; i < config.numOfArrays; i++) {
    const array: HEVCDecoderConfigurationRecordArrayType = {
      arrayCompleteness: Boolean(codecPrivate[offset] & 0x80),
      reserved: (codecPrivate[offset] & 0x40) >> 6,
      NALUnitType: codecPrivate[offset] & 0x3f,
      numNalus: (codecPrivate[offset + 1] << 8) | codecPrivate[offset + 2],
      nalUnits: [] as Uint8Array<ArrayBufferLike>[],
    };
    offset += 3;

    for (let j = 0; j < array.numNalus; j++) {
      const nalUnitLength =
        (codecPrivate[offset] << 8) | codecPrivate[offset + 1];
      offset += 2;
      array.nalUnits.push(
        codecPrivate.subarray(offset, offset + nalUnitLength)
      );
      offset += nalUnitLength;
    }
    arrays.push(array);
  }

  const result = { ...config, arrays };

  // Validate using arktype
  const validation = HEVCDecoderConfigurationRecordSchema(result);
  if (validation instanceof ArkErrors) {
    const error = new ParseCodecPrivateError(
      HEVC_CODEC_TYPE,
      'Invalid HEVC configuration record'
    );
    error.cause = validation;
    throw error;
  }

  return result;
}

export function genCodecStringByHEVCDecoderConfigurationRecord(
  config: HEVCDecoderConfigurationRecordType
) {
  const profileSpace =
    config.generalProfileSpace === 0
      ? ''
      : String.fromCharCode(65 + config.generalProfileSpace - 1);
  const profileIdcHex = config.generalProfileIdc.toString(16);
  const tier = config.generalTierFlag ? '7' : '6';
  const levelMajor = Math.floor(config.generalLevelIdc / 30);
  const levelMinor =
    config.generalLevelIdc % 30 === 0 ? '0' : (config.generalLevelIdc % 30) / 3;
  const levelStr = `L${config.generalLevelIdc.toString().padStart(3, '0')}`;

  const constraint = '00';
  return `hev1.${profileSpace}${profileIdcHex}.${tier}.${levelStr}.${constraint}`;
}
