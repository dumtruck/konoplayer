import { ParseCodecError } from '@konoplayer/core/errors';
import { ArkErrors, type } from 'arktype';

export const AAC_CODEC_TYPE = 'AAC';

export const AudioObjectTypeSchema = type('1 | 2 | 3 | 4 | 5 | 29 | 67 | 23');

export const SamplingFrequencyIndexSchema = type(
  '1 | 2 | 3 | 4 |5|6|7|8|9|10|11|12'
);

export const ChannelConfigurationSchema = type('1 | 2 | 3 | 4 | 5 | 6 | 7');

export const AudioSpecificConfigSchema = type({
  audioObjectType: AudioObjectTypeSchema, // AAC profiles: Main, LC, SSR, LTP, HE, HE v2
  samplingFrequencyIndex: SamplingFrequencyIndexSchema.optional(), // Sampling rate index
  channelConfiguration: ChannelConfigurationSchema, // Channel config (1-7)
  sbrPresent: type.boolean.optional(), // Optional: Indicates SBR presence
  psPresent: type.boolean.optional(), // Optional: Indicates PS presence (for HE-AAC v2)
});

export type AudioSpecificConfigType = typeof AudioSpecificConfigSchema.infer;

/**
 * Parse AudioSpecificConfig from codec_private Uint8Array
 * @param codecPrivate - Uint8Array containing codec_private data
 * @returns Parsed AudioSpecificConfig or throws an error if invalid
 */
export function parseAudioSpecificConfig(
  codecPrivate: Uint8Array
): AudioSpecificConfigType {
  if (codecPrivate.length < 2) {
    throw new ParseCodecError(AAC_CODEC_TYPE, 'codec_private data too short');
  }

  // Create a DataView for bit-level manipulation
  const view = new DataView(
    codecPrivate.buffer,
    codecPrivate.byteOffset,
    codecPrivate.byteLength
  );
  let byteOffset = 0;
  let bitOffset = 0;

  // Helper function to read specific number of bits
  function readBits(bits: number): number {
    let value = 0;
    for (let i = 0; i < bits; i++) {
      const byte = view.getUint8(byteOffset);
      const bit = (byte >> (7 - bitOffset)) & 1;
      value = (value << 1) | bit;
      bitOffset++;
      if (bitOffset === 8) {
        bitOffset = 0;
        byteOffset++;
      }
    }
    return value;
  }

  // Read 5 bits for audioObjectType
  const audioObjectType = readBits(5);

  // Read 4 bits for samplingFrequencyIndex
  const samplingFrequencyIndex = readBits(4);

  // Read 4 bits for channelConfiguration
  const channelConfiguration = readBits(4);

  // Check for SBR/PS extension (if audioObjectType indicates HE-AAC)
  let sbrPresent = false;
  let psPresent = false;
  if (audioObjectType === 5 || audioObjectType === 29) {
    sbrPresent = true;
    if (audioObjectType === 29) {
      psPresent = true; // HE-AAC v2 includes Parametric Stereo
    }
    // Skip extension-specific bits if present (simplified here)
    // In real cases, additional parsing may be needed
  }

  // Construct the result object
  const config: AudioSpecificConfigType = {
    audioObjectType:
      audioObjectType as AudioSpecificConfigType['audioObjectType'],
    samplingFrequencyIndex:
      samplingFrequencyIndex as AudioSpecificConfigType['samplingFrequencyIndex'],
    channelConfiguration:
      channelConfiguration as AudioSpecificConfigType['channelConfiguration'],
    ...(sbrPresent && { sbrPresent }),
    ...(psPresent && { psPresent }),
  };

  // Validate with arktype
  const validation = AudioSpecificConfigSchema(config);
  if (validation instanceof ArkErrors) {
    const error = new ParseCodecError(
      AAC_CODEC_TYPE,
      'Invalid AudioSpecificConfig'
    );
    error.cause = validation;
    throw error;
  }

  return config;
}

export function genCodecIdByAudioSpecificConfig(
  config: AudioSpecificConfigType
) {
  return `mp4a.40.${config.audioObjectType}`;
}

export function samplesPerFrameByAACAudioObjectType(audioObjectType: number) {
  switch (audioObjectType) {
    case 5:
    case 29:
      return 2048;
    case 23:
      return 512;
    default:
      return 1024;
  }
}
