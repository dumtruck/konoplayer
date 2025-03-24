import { ParseCodecError } from '@konoplayer/core/errors';
import { type } from 'arktype';
import type { TrackEntryType } from '../schema';

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
 *
 * @see [webkit](https://github.com/movableink/webkit/blob/7e43fe7000b319ce68334c09eed1031642099726/Source/WebCore/platform/graphics/HEVCUtilities.cpp#L84)
 */
export function parseAVCDecoderConfigurationRecord(
  track: TrackEntryType
): AVCDecoderConfigurationRecordType {
  // ISO/IEC 14496-10:2014
  // 7.3.2.1.1 Sequence parameter set data syntax
  const codecPrivate = track.CodecPrivate;

  if (!codecPrivate) {
    throw new ParseCodecError(
      AVC_CODEC_TYPE,
      'CodecPrivate of AVC Track is missing'
    );
  }

  // AVCDecoderConfigurationRecord is at a minimum 24 bytes long
  if (codecPrivate.length < 24) {
    throw new ParseCodecError(
      AVC_CODEC_TYPE,
      'Input data too short for AVCDecoderConfigurationRecord'
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

  const configurationVersion = readUint8(true);
  const avcProfileIndication = readUint8(true);
  const profileCompatibility = readUint8(true);
  const avcLevelIndication = readUint8(true);

  // Read lengthSizeMinusOne (first 6 bits are reserved, typically 0xFF, last 2 bits are the value)
  const lengthSizeMinusOne = readUint8(true) & 0x03;

  // Read number of SPS (first 3 bits are reserved, typically 0xE0, last 5 bits are SPS count)
  const numOfSPS = readUint8(true) & 0x1f;
  const sps: Uint8Array[] = [];

  // Parse SPS
  for (let i = 0; i < numOfSPS; i++) {
    if (offset + 2 > codecPrivate.length) {
      throw new ParseCodecError(AVC_CODEC_TYPE, 'Invalid SPS length');
    }

    const spsLength = readUint16(true);

    if (offset + spsLength > codecPrivate.length) {
      throw new ParseCodecError(
        AVC_CODEC_TYPE,
        'SPS data exceeds buffer length'
      );
    }

    sps.push(codecPrivate.subarray(offset, offset + spsLength));
    offset += spsLength;
  }

  // Read number of PPS
  if (offset >= codecPrivate.length) {
    throw new ParseCodecError(AVC_CODEC_TYPE, 'No space for PPS count');
  }
  const numOfPPS = readUint8(true);
  const pps: Uint8Array[] = [];

  // Parse PPS
  for (let i = 0; i < numOfPPS; i++) {
    if (offset + 2 > codecPrivate.length) {
      throw new ParseCodecError(AVC_CODEC_TYPE, 'Invalid PPS length');
    }

    const ppsLength = readUint16(true);

    if (offset + ppsLength > codecPrivate.length) {
      throw new ParseCodecError(
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

export function genCodecStringByAVCDecoderConfigurationRecord(
  config: AVCDecoderConfigurationRecordType
): string {
  const profileHex = config.avcProfileIndication.toString(16).padStart(2, '0');
  const profileCompatHex = config.profileCompatibility
    .toString(16)
    .padStart(2, '0');
  const levelHex = config.avcLevelIndication.toString(16).padStart(2, '0');
  return `avc1.${profileHex}${profileCompatHex}${levelHex}`;
}
