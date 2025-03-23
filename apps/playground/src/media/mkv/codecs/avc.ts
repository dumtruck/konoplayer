import { ParseCodecPrivateError } from '@/media/base/errors';
import { type } from 'arktype';

export const AVC_CODEC_TYPE = 'h264(AVC)';

export const AVCDecoderConfigurationRecordSchema = type({
  configurationVersion: type.number, // Configuration version, typically 1
  avcProfileIndication: type.number, // AVC profile
  profileCompatibility: type.number, // Profile compatibility
  avcLevelIndication: type.number, // AVC level
  lengthSizeMinusOne: type.number, // NAL unit length field size minus 1
  sps: type
    .instanceOf(Uint8Array<ArrayBufferLike>)
    .array()
    .atLeastLength(1), // Sequence Parameter Sets (SPS)
  pps: type
    .instanceOf(Uint8Array<ArrayBufferLike>)
    .array()
    .atLeastLength(1), // Picture Parameter Sets (PPS)
});

export type AVCDecoderConfigurationRecordType =
  typeof AVCDecoderConfigurationRecordSchema.infer;

/**
 * Parse AVCDecoderConfigurationRecord from codec_private Uint8Array
 * @param codecPrivate - Uint8Array containing codec_private data
 * @returns Parsed AVCDecoderConfigurationRecord or throws an error if invalid
 */
export function parseAVCDecoderConfigurationRecord(
  codecPrivate: Uint8Array
): AVCDecoderConfigurationRecordType {
  let offset = 0;

  // Check if data length is sufficient
  if (codecPrivate.length < 5) {
    throw new ParseCodecPrivateError(
      AVC_CODEC_TYPE,
      'Input data too short for AVCDecoderConfigurationRecord'
    );
  }

  const configurationVersion = codecPrivate[offset++];
  const avcProfileIndication = codecPrivate[offset++];
  const profileCompatibility = codecPrivate[offset++];
  const avcLevelIndication = codecPrivate[offset++];

  // Read lengthSizeMinusOne (first 6 bits are reserved, typically 0xFF, last 2 bits are the value)
  const lengthSizeMinusOne = codecPrivate[offset++] & 0x03;

  // Read number of SPS (first 3 bits are reserved, typically 0xE0, last 5 bits are SPS count)
  const numOfSPS = codecPrivate[offset++] & 0x1f;
  const sps: Uint8Array[] = [];

  // Parse SPS
  for (let i = 0; i < numOfSPS; i++) {
    if (offset + 2 > codecPrivate.length) {
      throw new ParseCodecPrivateError(AVC_CODEC_TYPE, 'Invalid SPS length');
    }

    const spsLength = (codecPrivate[offset] << 8) | codecPrivate[offset + 1];
    offset += 2;

    if (offset + spsLength > codecPrivate.length) {
      throw new ParseCodecPrivateError(
        AVC_CODEC_TYPE,
        'SPS data exceeds buffer length'
      );
    }

    sps.push(codecPrivate.subarray(offset, offset + spsLength));
    offset += spsLength;
  }

  // Read number of PPS
  if (offset >= codecPrivate.length) {
    throw new ParseCodecPrivateError(AVC_CODEC_TYPE, 'No space for PPS count');
  }
  const numOfPPS = codecPrivate[offset++];
  const pps: Uint8Array[] = [];

  // Parse PPS
  for (let i = 0; i < numOfPPS; i++) {
    if (offset + 2 > codecPrivate.length) {
      throw new ParseCodecPrivateError(AVC_CODEC_TYPE, 'Invalid PPS length');
    }

    const ppsLength = (codecPrivate[offset] << 8) | codecPrivate[offset + 1];
    offset += 2;

    if (offset + ppsLength > codecPrivate.length) {
      throw new ParseCodecPrivateError(
        AVC_CODEC_TYPE,
        'PPS data exceeds buffer length'
      );
    }

    pps.push(codecPrivate.subarray(offset, offset + ppsLength));
    offset += ppsLength;
  }

  return {
    configurationVersion,
    avcProfileIndication,
    profileCompatibility,
    avcLevelIndication,
    lengthSizeMinusOne,
    sps,
    pps,
  };
}

export function genCodecIdByAVCDecoderConfigurationRecord(
  config: AVCDecoderConfigurationRecordType
): string {
  const profileHex = config.avcProfileIndication.toString(16).padStart(2, '0');
  const profileCompatHex = config.profileCompatibility
    .toString(16)
    .padStart(2, '0');
  const levelHex = (config.avcLevelIndication / 10)
    .toString(16)
    .replace(/./g, '')
    .padStart(2, '0');
  return `avc1.${profileHex}${profileCompatHex}${levelHex}`;
}
