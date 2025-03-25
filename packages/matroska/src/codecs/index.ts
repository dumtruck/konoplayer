import {
  ParseCodecError,
  UnsupportedCodecError,
} from '@konoplayer/core/errors';
import { VideoCodec, AudioCodec } from '@konoplayer/core/codecs';
import type { TrackEntryType } from '../schema';
import {
  genCodecIdByAudioSpecificConfig,
  parseAudioSpecificConfig,
  samplesPerFrameByAACAudioObjectType,
} from './aac';
import {
  genCodecStringByAVCDecoderConfigurationRecord,
  parseAVCDecoderConfigurationRecord,
} from './avc';
import {
  genCodecStringByAV1DecoderConfigurationRecord,
  parseAV1DecoderConfigurationRecord,
} from './av1';
import {
  genCodecStringByHEVCDecoderConfigurationRecord,
  parseHEVCDecoderConfigurationRecord,
} from './hevc';
import {
  genCodecStringByVP9DecoderConfigurationRecord,
  parseVP9DecoderConfigurationRecord,
  VP9_CODEC_TYPE,
} from './vp9';

export const VideoCodecId = {
  VCM: 'V_MS/VFW/FOURCC',
  UNCOMPRESSED: 'V_UNCOMPRESSED',
  MPEG4_ISO_SP: 'V_MPEG4/ISO/SP',
  MPEG4_ISO_ASP: 'V_MPEG4/ISO/ASP',
  MPEG4_ISO_AP: 'V_MPEG4/ISO/AP',
  MPEG4_MS_V3: 'V_MPEG4/MS/V3',
  MPEG1: 'V_MPEG1',
  MPEG2: 'V_MPEG2',
  H264: 'V_MPEG4/ISO/AVC',
  HEVC: 'V_MPEGH/ISO/HEVC',
  AVS2: 'V_AVS2',
  AVS3: 'V_AVS3',
  RV10: 'V_REAL/RV10',
  RV20: 'V_REAL/RV20',
  RV30: 'V_REAL/RV30',
  RV40: 'V_REAL/RV40',
  QUICKTIME: 'V_QUICKTIME',
  THEORA: 'V_THEORA',
  PROPRES: 'V_PRORES',
  VP8: 'V_VP8',
  VP9: 'V_VP9',
  FFV1: 'V_FFV1',
  AV1: 'V_AV1',
} as const;

export type VideoCodecIdType =
  | `${(typeof VideoCodecId)[keyof typeof VideoCodecId]}`
  | string;

export const AudioCodecId = {
  MPEG_L3: 'A_MPEG/L3',
  MPEG_L2: 'A_MPEG/L2',
  MPEG_L1: 'A_MPEG/L1',
  PCM_INT_BIG: 'A_PCM/INT/BIG',
  PCM_INT_LIT: 'A_PCM/INT/LIT',
  PCM_FLOAT_IEEE: 'A_PCM/FLOAT/IEEE',
  MPC: 'A_MPC',
  AC3: 'A_AC3',
  AC3_BSID9: 'A_AC3/BSID9',
  AC3_BSID10: 'A_AC3/BSID10',
  ALAC: 'A_ALAC',
  DTS: 'A_DTS',
  DTS_EXPRESS: 'A_DTS/EXPRESS',
  DTS_LOSSLESS: 'A_DTS/LOSSLESS',
  VORBIS: 'A_VORBIS',
  OPUS: 'A_OPUS',
  FLAC: 'A_FLAC',
  EAC3: 'A_EAC3',
  REAL_14_4: 'A_REAL/14_4',
  REAL_28_8: 'A_REAL/28_8',
  REAL_COOK: 'A_REAL/COOK',
  REAL_SIPR: 'A_REAL/SIPR',
  REAL_RALF: 'A_REAL/RALF',
  REAL_ATRC: 'A_REAL/ATRC',
  MS_ACM: 'A_MS/ACM',
  AAC: 'A_AAC',
  AAC_MPEG2_MAIN: 'A_AAC/MPEG2/MAIN',
  AAC_MPEG2_LC: 'A_AAC/MPEG2/LC',
  AAC_MPEG2_LC_SBR: 'A_AAC/MPEG2/LC/SBR',
  AAC_MPEG2_SSR: 'A_AAC/MPEG2/SSR',
  AAC_MPEG4_MAIN: 'A_AAC/MPEG4/MAIN',
  AAC_MPEG4_LC: 'A_AAC/MPEG4/LC',
  AAC_MPEG4_SBR: 'A_AAC/MPEG4/LC/SBR',
  AAC_MPEG4_SSR: 'A_AAC/MPEG4/SSR',
  AAC_MPEG4_LTP: 'A_AAC/MPEG4/LTP',
  QUICKTIME: 'A_QUICKTIME',
  QDMC: 'A_QUICKTIME/QDMC',
  QDM2: 'A_QUICKTIME/QDM2',
  TTA1: 'A_TTA1',
  WAVEPACK4: 'A_WAVPACK4',
  ATRAC: 'A_ATRAC/AT1',
} as const;

export type AudioCodecIdType =
  | `${(typeof AudioCodecId)[keyof typeof AudioCodecId]}`
  | string;

export const SubtitleCodecId = {
  UTF8: 'S_TEXT/UTF8',
  SSA: 'S_TEXT/SSA',
  ASS: 'S_TEXT/ASS',
  WEBVTT: 'S_TEXT/WEBVTT',
  BMP: 'S_IMAGE/BMP',
  DVBSUB: 'S_DVBSUB',
  VOBSUB: 'S_VOBSUB',
  HDMV_PGS: 'S_HDMV/PGS',
  HDMV_TEXTST: 'S_HDMV/TEXTST',
  KATE: 'S_KATE',
  ARIBSUB: 'S_ARIBSUB',
} as const;

export type SubtitleCodecIdType =
  | `${(typeof SubtitleCodecId)[keyof typeof SubtitleCodecId]}`
  | string;

export interface VideoDecoderConfigExt extends VideoDecoderConfig {
  codecType: VideoCodec;
}

export function videoCodecIdRequirePeekingKeyframe(codecId: VideoCodecIdType) {
  return codecId === VideoCodecId.VP9;
}

export function videoCodecIdToWebCodecs(
  track: TrackEntryType,
  keyframe: Uint8Array | undefined
): VideoDecoderConfigExt {
  const codecId = track.CodecID;
  const codecPrivate = track.CodecPrivate;
  const shareOptions = {
    description: codecPrivate,
  };
  switch (codecId) {
    case VideoCodecId.HEVC:
      return {
        ...shareOptions,
        codecType: VideoCodec.HEVC,
        codec: genCodecStringByHEVCDecoderConfigurationRecord(
          parseHEVCDecoderConfigurationRecord(track)
        ),
      };
    case VideoCodecId.VP9:
      if (!keyframe) {
        throw new ParseCodecError(
          VP9_CODEC_TYPE,
          'keyframe is required to parse VP9 codec'
        );
      }
      return {
        ...shareOptions,
        codecType: VideoCodec.VP9,
        codec: genCodecStringByVP9DecoderConfigurationRecord(
          parseVP9DecoderConfigurationRecord(track, keyframe)
        ),
      };
    case VideoCodecId.AV1:
      return {
        ...shareOptions,
        codecType: VideoCodec.AV1,
        codec: genCodecStringByAV1DecoderConfigurationRecord(
          parseAV1DecoderConfigurationRecord(track)
        ),
      };
    case VideoCodecId.H264:
      return {
        ...shareOptions,
        codecType: VideoCodec.H264,
        codec: genCodecStringByAVCDecoderConfigurationRecord(
          parseAVCDecoderConfigurationRecord(track)
        ),
      };
    case VideoCodecId.THEORA:
      return { ...shareOptions, codecType: VideoCodec.Theora, codec: 'theora' };
    case VideoCodecId.VP8:
      return { ...shareOptions, codecType: VideoCodec.VP8, codec: 'vp8' };
    case VideoCodecId.MPEG4_ISO_SP:
      return {
        ...shareOptions,
        codecType: VideoCodec.MPEG4,
        codec: 'mp4v.01.3',
      };
    case VideoCodecId.MPEG4_ISO_ASP:
      return {
        ...shareOptions,
        codecType: VideoCodec.MPEG4,
        codec: 'mp4v.20.9',
      };
    case VideoCodecId.MPEG4_ISO_AP:
      return {
        ...shareOptions,
        codecType: VideoCodec.MPEG4,
        codec: 'mp4v.20.9',
      };
    default:
      throw new UnsupportedCodecError(codecId, 'web codecs video decoder');
  }
}

export interface AudioDecoderConfigExt extends AudioDecoderConfig {
  codecType: AudioCodec;
  samplesPerFrame?: number;
}

export function isAudioCodecIdRequirePeekingKeyframe(_track: TrackEntryType) {
  return false;
}

export function audioCodecIdToWebCodecs(
  track: TrackEntryType,
  _keyframe: Uint8Array | undefined
): AudioDecoderConfigExt {
  const codecId = track.CodecID;
  const codecPrivate = track.CodecPrivate;
  const bitDepth = track.Audio?.BitDepth;
  const numberOfChannels = Number(track.Audio?.Channels);
  const sampleRate = Number(track.Audio?.SamplingFrequency);

  const shareOptions = {
    numberOfChannels,
    sampleRate,
    description: codecPrivate,
  };

  switch (track.CodecID) {
    case AudioCodecId.AAC_MPEG4_MAIN:
    case AudioCodecId.AAC_MPEG2_MAIN:
      return {
        ...shareOptions,
        codecType: AudioCodec.AAC,
        codec: 'mp4a.40.1',
        samplesPerFrame: 1024,
      };
    case AudioCodecId.AAC_MPEG2_LC:
    case AudioCodecId.AAC_MPEG4_LC:
      return {
        ...shareOptions,
        codecType: AudioCodec.AAC,
        codec: 'mp4a.40.2',
        samplesPerFrame: 1024,
      };
    case AudioCodecId.AAC_MPEG2_SSR:
    case AudioCodecId.AAC_MPEG4_SSR:
      return {
        ...shareOptions,
        codecType: AudioCodec.AAC,
        codec: 'mp4a.40.3',
        samplesPerFrame: 1024,
      };
    case AudioCodecId.AAC_MPEG4_LTP:
      return {
        ...shareOptions,
        codecType: AudioCodec.AAC,
        codec: 'mp4a.40.4',
        samplesPerFrame: 1024,
      };
    case AudioCodecId.AAC_MPEG2_LC_SBR:
    case AudioCodecId.AAC_MPEG4_SBR:
      return {
        ...shareOptions,
        codecType: AudioCodec.AAC,
        codec: 'mp4a.40.5',
        samplesPerFrame: 2048,
      };
    case AudioCodecId.AAC:
      if (codecPrivate) {
        const config = parseAudioSpecificConfig(codecPrivate);
        return {
          ...shareOptions,
          codecType: AudioCodec.AAC,
          codec: genCodecIdByAudioSpecificConfig(config),
          samplesPerFrame: samplesPerFrameByAACAudioObjectType(
            config.audioObjectType
          ),
        };
      }
      return {
        ...shareOptions,
        codecType: AudioCodec.AAC,
        codec: 'mp4a.40.2',
        samplesPerFrame: 1024,
      };
    case AudioCodecId.AC3:
    case AudioCodecId.AC3_BSID9:
      return {
        ...shareOptions,
        codecType: AudioCodec.AC3,
        codec: 'ac-3',
        samplesPerFrame: 1536,
      };
    case AudioCodecId.EAC3:
    case AudioCodecId.AC3_BSID10:
      return {
        ...shareOptions,
        codecType: AudioCodec.EAC3,
        codec: 'ec-3',
        // TODO: FIXME
        // parse frame header
        // samples per frame = numblkscod * 256
        // most time numblkscod = 6
        // samplesPerFrame: 1536,
      };
    case AudioCodecId.MPEG_L3:
      return {
        ...shareOptions,
        codecType: AudioCodec.MP3,
        codec: 'mp3',
        samplesPerFrame: 1152,
      };
    case AudioCodecId.VORBIS:
      return {
        ...shareOptions,
        codecType: AudioCodec.Vorbis,
        codec: 'vorbis',
        /**
         * TODO: FIXME
         * read code private
         * prase setup header
         * ShortBlockSize = 2 ^ blocksize_0
         * LongBlockSize = 2 ^ blocksize_1
         */
        samplesPerFrame: 2048,
      };
    case AudioCodecId.FLAC:
      return {
        ...shareOptions,
        codecType: AudioCodec.FLAC,
        codec: 'flac',
        /**
         * TODO: FIXME
         * read code private
         * get block size
         */
        // samplesPerFrame: 4096,
      };
    case AudioCodecId.OPUS:
      return {
        ...shareOptions,
        codecType: AudioCodec.Opus,
        codec: 'opus',
        /**
         * TODO: FIXME
         * Read TOC header from frame data
         */
        // samplesPerFrame: 960,
      };
    case AudioCodecId.ALAC:
      return {
        ...shareOptions,
        codecType: AudioCodec.ALAC,
        codec: 'alac',
        /**
         * TODO: FIXME
         * parse private data and get frame length
         * 00 00 10 00  // Frame Length (4096)
          00 00 00 00  // Compatible Version (0)
          00 10        // Bit Depth (16-bit)
          40 00        // PB (like 40)
          00 00        // MB (like 0)
          00 00        // KB (like 0)
          00 02        // Channels (2)
          00 00 AC 44  // Sample Rate (44100Hz)
         */
        // samplesPerFrame: 4096,
      };
    case AudioCodecId.PCM_INT_BIG:
      if (bitDepth === 16) {
        return {
          ...shareOptions,
          codecType: AudioCodec.PCM_S16BE,
          codec: 'pcm-s16be',
        };
      }
      if (bitDepth === 24) {
        return {
          ...shareOptions,
          codecType: AudioCodec.PCM_S24BE,
          codec: 'pcm-s24be',
        };
      }
      if (bitDepth === 32) {
        return {
          ...shareOptions,
          codecType: AudioCodec.PCM_S32BE,
          codec: 'pcm-s32be',
        };
      }
      throw new UnsupportedCodecError(
        `${codecId}(${bitDepth}b)`,
        'web codecs audio decoder'
      );
    case AudioCodecId.PCM_INT_LIT:
      if (bitDepth === 16) {
        return {
          ...shareOptions,
          codecType: AudioCodec.PCM_S16LE,
          codec: 'pcm-s16le',
        };
      }
      if (bitDepth === 24) {
        return {
          ...shareOptions,
          codecType: AudioCodec.PCM_S24LE,
          codec: 'pcm-s24le',
        };
      }
      if (bitDepth === 32) {
        return {
          ...shareOptions,
          codecType: AudioCodec.PCM_S32LE,
          codec: 'pcm-s32le',
        };
      }
      throw new UnsupportedCodecError(
        `${codecId}(${bitDepth}b)`,
        'web codecs audio decoder'
      );
    case AudioCodecId.PCM_FLOAT_IEEE:
      return {
        ...shareOptions,
        codecType: AudioCodec.PCM_F32LE,
        codec: 'pcm-f32le',
      };
    default:
      throw new UnsupportedCodecError(codecId, 'web codecs audio decoder');
  }
}
