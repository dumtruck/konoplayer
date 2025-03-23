import { AudioCodec } from '../../base/audio_codecs';
import { UnsupportCodecError } from '../../base/errors';
import { VideoCodec } from '../../base/video_codecs';
import type { TrackEntryType } from '../schema';
import {
  genCodecIdByAudioSpecificConfig,
  parseAudioSpecificConfig,
} from './aac';
import {
  genCodecIdByAVCDecoderConfigurationRecord,
  parseAVCDecoderConfigurationRecord,
} from './avc';

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

export function videoCodecIdToWebCodecsVideoDecoder(
  track: TrackEntryType
): [VideoCodec, string] {
  const codecId = track.CodecID;
  const codecPrivate = track.CodecPrivate;
  switch (codecId) {
    case VideoCodecId.HEVC:
      return [VideoCodec.HEVC, 'hevc'];
    case VideoCodecId.VP9:
      return [VideoCodec.VP9, 'vp09'];
    case VideoCodecId.AV1:
      return [VideoCodec.AV1, 'av1'];
    case VideoCodecId.H264:
      if (!codecPrivate) {
        throw new UnsupportCodecError(
          'h264(without codec_private profile)',
          'web codecs audio decoder'
        );
      }
      return [
        VideoCodec.H264,
        genCodecIdByAVCDecoderConfigurationRecord(
          parseAVCDecoderConfigurationRecord(codecPrivate)
        ),
      ];
    case VideoCodecId.THEORA:
      return [VideoCodec.Theora, 'theora'];
    case VideoCodecId.VP8:
      return [VideoCodec.VP8, 'vp8'];
    case VideoCodecId.MPEG4_ISO_SP:
      return [VideoCodec.MPEG4, 'mp4v.01.3'];
    case VideoCodecId.MPEG4_ISO_ASP:
      return [VideoCodec.MPEG4, 'mp4v.20.9'];
    case VideoCodecId.MPEG4_ISO_AP:
      return [VideoCodec.MPEG4, 'mp4v.20.9'];
    default:
      throw new UnsupportCodecError(codecId, 'web codecs video decoder');
  }
}

export function videoCodecIdToWebCodecsAudioDecoder(
  track: TrackEntryType
): [AudioCodec, string] {
  const codecId = track.CodecID;
  const codecPrivate = track.CodecPrivate;
  const bitDepth = track.Audio?.BitDepth;
  switch (track.CodecID) {
    case AudioCodecId.AAC_MPEG4_MAIN:
    case AudioCodecId.AAC_MPEG2_MAIN:
      return [AudioCodec.AAC, 'mp4a.40.1'];
    case AudioCodecId.AAC_MPEG2_LC:
    case AudioCodecId.AAC_MPEG4_LC:
      return [AudioCodec.AAC, 'mp4a.40.2'];
    case AudioCodecId.AAC_MPEG2_SSR:
    case AudioCodecId.AAC_MPEG4_SSR:
      return [AudioCodec.AAC, 'mp4a.40.3'];
    case AudioCodecId.AAC_MPEG4_LTP:
      return [AudioCodec.AAC, 'mp4a.40.4'];
    case AudioCodecId.AAC_MPEG2_LC_SBR:
    case AudioCodecId.AAC_MPEG4_SBR:
      return [AudioCodec.AAC, 'mp4a.40.5'];
    case AudioCodecId.AAC:
      return [
        AudioCodec.AAC,
        codecPrivate
          ? genCodecIdByAudioSpecificConfig(
              parseAudioSpecificConfig(codecPrivate)
            )
          : 'mp4a.40.2',
      ];
    case AudioCodecId.AC3:
    case AudioCodecId.AC3_BSID9:
      return [AudioCodec.AC3, 'ac-3'];
    case AudioCodecId.EAC3:
    case AudioCodecId.AC3_BSID10:
      return [AudioCodec.EAC3, 'ec-3'];
    case AudioCodecId.MPEG_L3:
      return [AudioCodec.MP3, 'mp3'];
    case AudioCodecId.VORBIS:
      return [AudioCodec.Vorbis, 'vorbis'];
    case AudioCodecId.FLAC:
      return [AudioCodec.FLAC, 'flac'];
    case AudioCodecId.OPUS:
      return [AudioCodec.Opus, 'opus'];
    case AudioCodecId.ALAC:
      return [AudioCodec.ALAC, 'alac'];
    case AudioCodecId.PCM_INT_BIG:
      if (bitDepth === 16) {
        return [AudioCodec.PCM_S16BE, 'pcm-s16be'];
      }
      if (bitDepth === 24) {
        return [AudioCodec.PCM_S24BE, 'pcm-s24be'];
      }
      if (bitDepth === 32) {
        return [AudioCodec.PCM_S32BE, 'pcm-s32be'];
      }
      throw new UnsupportCodecError(
        `${codecId}(${bitDepth}b)`,
        'web codecs audio decoder'
      );
    case AudioCodecId.PCM_INT_LIT:
      if (bitDepth === 16) {
        return [AudioCodec.PCM_S16LE, 'pcm-s16le'];
      }
      if (bitDepth === 24) {
        return [AudioCodec.PCM_S24LE, 'pcm-s24le'];
      }
      if (bitDepth === 32) {
        return [AudioCodec.PCM_S32LE, 'pcm-s32le'];
      }
      throw new UnsupportCodecError(
        `${codecId}(${bitDepth}b)`,
        'web codecs audio decoder'
      );
    case AudioCodecId.PCM_FLOAT_IEEE:
      return [AudioCodec.PCM_F32LE, 'pcm-f32le'];
    default:
      throw new UnsupportCodecError(codecId, 'web codecs audio decoder');
  }
}
