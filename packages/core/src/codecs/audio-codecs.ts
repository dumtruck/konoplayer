export enum AudioCodec {
  Unknown = 0,
  AAC = 1,
  MP3 = 2,
  PCM = 3,
  Vorbis = 4,
  FLAC = 5,
  AMR_NB = 6,
  AMR_WB = 7,
  PCM_MULAW = 8,
  GSM_MS = 9,
  PCM_S16BE = 10,
  PCM_S24BE = 11,
  Opus = 12,
  EAC3 = 13,
  PCM_ALAW = 14,
  ALAC = 15,
  AC3 = 16,
  MpegHAudio = 17,
  DTS = 18,
  DTSXP2 = 19,
  DTSE = 20,
  AC4 = 21,
  IAMF = 22,
  PCM_S32BE = 23,
  PCM_S32LE = 24,
  PCM_S24LE = 25,
  PCM_S16LE = 26,
  PCM_F32BE = 27,
  PCM_F32LE = 28,
  MaxValue = PCM_F32LE, // Must equal the last "real" codec above.
}
