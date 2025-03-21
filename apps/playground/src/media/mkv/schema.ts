import { type, match } from 'arktype';
import { EbmlTagIdEnum, EbmlSimpleBlockTag, EbmlBlockTag } from 'konoebml';

export const BinarySchema = type.instanceOf(Uint8Array);
export const SimpleBlockSchema = type.instanceOf(EbmlSimpleBlockTag);
export const BlockSchema = type.instanceOf(EbmlBlockTag);

export const DocTypeExtensionSchema = type({
  DocTypeExtensionName: type.string,
  DocTypeExtensionVersion: type.number,
});

export type DocTypeExtensionType = typeof DocTypeExtensionSchema.infer;

export const EBMLSchema = type({
  EBMLVersion: type.number.default(1),
  EBMLReadVersion: type.number.default(1),
  EBMLMaxIDLength: type.number.default(4),
  EBMLMaxSizeLength: type.number.default(8),
  DocType: type.string,
  DocTypeVersion: type.number.default(1),
  DocTypeReadVersion: type.number.default(1),
  DocTypeExtension: DocTypeExtensionSchema.array().optional(),
});

export type EBMLType = typeof EBMLSchema.infer;

export const SeekSchema = type({
  SeekID: BinarySchema,
  SeekPosition: type.number,
});

export type SeekType = typeof SeekSchema.infer;

export const SeekHeadSchema = type({
  Seek: SeekSchema.array(),
});

export type SeekHeadType = typeof SeekHeadSchema.infer;

export const ChapterTranslateSchema = type({
  ChapterTranslateID: BinarySchema,
  ChapterTranslateCodec: type.number,
  ChapterTranslateEditionUID: type.number.array().optional(),
});

export type ChapterTranslateType = typeof ChapterTranslateSchema.infer;

export const InfoSchema = type({
  SegmentUUID: BinarySchema.optional(),
  SegmentFilename: type.string.optional(),
  PrevUUID: BinarySchema.optional(),
  PrevFilename: type.string.optional(),
  NextUUID: BinarySchema.optional(),
  NextFilename: type.string.optional(),
  SegmentFamily: BinarySchema.array().optional(),
  ChapterTranslate: ChapterTranslateSchema.array().optional(),
  TimestampScale: type.number.default(1000000),
  Duration: type.number.optional(),
  DateUTC: BinarySchema.optional(),
  Title: type.string.optional(),
  MuxingApp: type.string,
  WritingApp: type.string,
});

export type InfoType = typeof InfoSchema.infer;

export const SilentTracksSchema = type({
  SilentTrackNumber: type.number.array().optional(),
});

export type SilentTracksType = typeof SilentTracksSchema.infer;

export const BlockMoreSchema = type({
  BlockAdditional: BinarySchema,
  BlockAddID: type.number.default(1),
});

export type BlockMoreType = typeof BlockMoreSchema.infer;

export const BlockAdditionsSchema = type({
  BlockMore: BlockMoreSchema.array(),
});

export type BlockAdditionsType = typeof BlockAdditionsSchema.infer;

export const TimeSliceSchema = type({
  LaceNumber: type.number.optional(),
  FrameNumber: type.number.default(0),
  BlockAdditionID: type.number.default(0),
  Delay: type.number.default(0),
  SliceDuration: type.number.default(0),
});

export type TimeSliceType = typeof TimeSliceSchema.infer;

export const SlicesSchema = type({
  TimeSlice: TimeSliceSchema.array().optional(),
});

export type SlicesType = typeof SlicesSchema.infer;

export const ReferenceFrameSchema = type({
  ReferenceOffset: type.number,
  ReferenceTimestamp: type.number,
});

export type ReferenceFrameType = typeof ReferenceFrameSchema.infer;

export const BlockGroupSchema = type({
  Block: BlockSchema,
  BlockVirtual: BinarySchema.optional(),
  BlockAdditions: BlockAdditionsSchema.optional(),
  BlockDuration: type.number.optional(),
  ReferencePriority: type.number.default(0),
  ReferenceBlock: type.number.array().optional(),
  ReferenceVirtual: type.number.optional(),
  CodecState: BinarySchema.optional(),
  DiscardPadding: type.number.optional(),
  Slices: SlicesSchema.optional(),
  ReferenceFrame: ReferenceFrameSchema.optional(),
});

export type BlockGroupType = typeof BlockGroupSchema.infer;

export const ClusterSchema = type({
  Timestamp: type.number,
  SilentTracks: SilentTracksSchema.optional(),
  Position: type.number.optional(),
  PrevSize: type.number.optional(),
  SimpleBlock: SimpleBlockSchema.array().optional(),
  BlockGroup: BlockGroupSchema.array().optional(),
  EncryptedBlock: BinarySchema.array().optional(),
});

export type ClusterType = typeof ClusterSchema.infer;

export const BlockAdditionMappingSchema = type({
  BlockAddIDValue: type.number.optional(),
  BlockAddIDName: type.string.optional(),
  BlockAddIDType: type.number.default(0),
  BlockAddIDExtraData: BinarySchema.optional(),
});

export type BlockAdditionMappingType = typeof BlockAdditionMappingSchema.infer;

export const TrackTranslateSchema = type({
  TrackTranslateTrackID: BinarySchema,
  TrackTranslateCodec: type.number,
  TrackTranslateEditionUID: type.number.array().optional(),
});

export type TrackTranslateType = typeof TrackTranslateSchema.infer;

export const MasteringMetadataSchema = type({
  PrimaryRChromaticityX: type.number.optional(),
  PrimaryRChromaticityY: type.number.optional(),
  PrimaryGChromaticityX: type.number.optional(),
  PrimaryGChromaticityY: type.number.optional(),
  PrimaryBChromaticityX: type.number.optional(),
  PrimaryBChromaticityY: type.number.optional(),
  WhitePointChromaticityX: type.number.optional(),
  WhitePointChromaticityY: type.number.optional(),
  LuminanceMax: type.number.optional(),
  LuminanceMin: type.number.optional(),
});

export type MasteringMetadataType = typeof MasteringMetadataSchema.infer;

export enum MatrixCoefficientsRestrictionEnum {
  // Identity
  IDENTITY = 0,
  // ITU-R BT.709
  ITU_R_BT_709 = 1,
  // unspecified
  UNSPECIFIED = 2,
  // reserved
  RESERVED = 3,
  // US FCC 73.682
  US_FCC_73_682 = 4,
  // ITU-R BT.470BG
  ITU_R_BT_470_BG = 5,
  // SMPTE 170M
  SMPTE_170_M = 6,
  // SMPTE 240M
  SMPTE_240_M = 7,
  // YCoCg
  Y_CO_CG = 8,
  // BT2020 Non-constant Luminance
  BT2020_NON_CONSTANT_LUMINANCE = 9,
  // BT2020 Constant Luminance
  BT2020_CONSTANT_LUMINANCE = 10,
  // SMPTE ST 2085
  SMPTE_ST_2085 = 11,
  // Chroma-derived Non-constant Luminance
  CHROMA_DERIVED_NON_CONSTANT_LUMINANCE = 12,
  // Chroma-derived Constant Luminance
  CHROMA_DERIVED_CONSTANT_LUMINANCE = 13,
  // ITU-R BT.2100-0
  ITU_R_BT_2100_0 = 14,
}
export const MatrixCoefficientsRestriction = type(
  '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14'
);
export type MatrixCoefficientsRestrictionType =
  typeof MatrixCoefficientsRestriction.infer;

export enum ChromaSitingHorzRestrictionEnum {
  // unspecified
  UNSPECIFIED = 0,
  // left collocated
  LEFT_COLLOCATED = 1,
  // half
  HALF = 2,
}
export const ChromaSitingHorzRestriction = type('0 | 1 | 2');
export type ChromaSitingHorzRestrictionType =
  typeof ChromaSitingHorzRestriction.infer;

export enum ChromaSitingVertRestrictionEnum {
  // unspecified
  UNSPECIFIED = 0,
  // top collocated
  TOP_COLLOCATED = 1,
  // half
  HALF = 2,
}
export const ChromaSitingVertRestriction = type('0 | 1 | 2');
export type ChromaSitingVertRestrictionType =
  typeof ChromaSitingVertRestriction.infer;

export enum RangeRestrictionEnum {
  // unspecified
  UNSPECIFIED = 0,
  // broadcast range
  BROADCAST_RANGE = 1,
  // full range (no clipping)
  FULL_RANGE_NO_CLIPPING = 2,
  // defined by MatrixCoefficients / TransferCharacteristics
  DEFINED_BY_MATRIX_COEFFICIENTS_TRANSFER_CHARACTERISTICS = 3,
}
export const RangeRestriction = type('0 | 1 | 2 | 3');
export type RangeRestrictionType = typeof RangeRestriction.infer;

export enum TransferCharacteristicsRestrictionEnum {
  // reserved
  RESERVED = 0,
  // ITU-R BT.709
  ITU_R_BT_709 = 1,
  // unspecified
  UNSPECIFIED = 2,
  // reserved2
  RESERVED2 = 3,
  // Gamma 2.2 curve - BT.470M
  GAMMA_2_2_CURVE_BT_470_M = 4,
  // Gamma 2.8 curve - BT.470BG
  GAMMA_2_8_CURVE_BT_470_BG = 5,
  // SMPTE 170M
  SMPTE_170_M = 6,
  // SMPTE 240M
  SMPTE_240_M = 7,
  // Linear
  LINEAR = 8,
  // Log
  LOG = 9,
  // Log Sqrt
  LOG_SQRT = 10,
  // IEC 61966-2-4
  IEC_61966_2_4 = 11,
  // ITU-R BT.1361 Extended Colour Gamut
  ITU_R_BT_1361_EXTENDED_COLOUR_GAMUT = 12,
  // IEC 61966-2-1
  IEC_61966_2_1 = 13,
  // ITU-R BT.2020 10 bit
  ITU_R_BT_2020_10_BIT = 14,
  // ITU-R BT.2020 12 bit
  ITU_R_BT_2020_12_BIT = 15,
  // ITU-R BT.2100 Perceptual Quantization
  ITU_R_BT_2100_PERCEPTUAL_QUANTIZATION = 16,
  // SMPTE ST 428-1
  SMPTE_ST_428_1 = 17,
  // ARIB STD-B67 (HLG)
  ARIB_STD_B67_HLG = 18,
}
export const TransferCharacteristicsRestriction = type(
  '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18'
);
export type TransferCharacteristicsRestrictionType =
  typeof TransferCharacteristicsRestriction.infer;

export enum PrimariesRestrictionEnum {
  // reserved
  RESERVED = 0,
  // ITU-R BT.709
  ITU_R_BT_709 = 1,
  // unspecified
  UNSPECIFIED = 2,
  // reserved2
  RESERVED2 = 3,
  // ITU-R BT.470M
  ITU_R_BT_470_M = 4,
  // ITU-R BT.470BG - BT.601 625
  ITU_R_BT_470_BG_BT_601_625 = 5,
  // ITU-R BT.601 525 - SMPTE 170M
  ITU_R_BT_601_525_SMPTE_170_M = 6,
  // SMPTE 240M
  SMPTE_240_M = 7,
  // FILM
  FILM = 8,
  // ITU-R BT.2020
  ITU_R_BT_2020 = 9,
  // SMPTE ST 428-1
  SMPTE_ST_428_1 = 10,
  // SMPTE RP 432-2
  SMPTE_RP_432_2 = 11,
  // SMPTE EG 432-2
  SMPTE_EG_432_2 = 12,
  // EBU Tech. 3213-E - JEDEC P22 phosphors
  EBU_TECH_3213_E_JEDEC_P22_PHOSPHORS = 22,
}
export const PrimariesRestriction = type(
  '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 22'
);
export type PrimariesRestrictionType = typeof PrimariesRestriction.infer;

export const ColourSchema = type({
  MatrixCoefficients: MatrixCoefficientsRestriction.default(2),
  BitsPerChannel: type.number.default(0),
  ChromaSubsamplingHorz: type.number.optional(),
  ChromaSubsamplingVert: type.number.optional(),
  CbSubsamplingHorz: type.number.optional(),
  CbSubsamplingVert: type.number.optional(),
  ChromaSitingHorz: ChromaSitingHorzRestriction.default(0),
  ChromaSitingVert: ChromaSitingVertRestriction.default(0),
  Range: RangeRestriction.default(0),
  TransferCharacteristics: TransferCharacteristicsRestriction.default(2),
  Primaries: PrimariesRestriction.default(2),
  MaxCLL: type.number.optional(),
  MaxFALL: type.number.optional(),
  MasteringMetadata: MasteringMetadataSchema.optional(),
});

export type ColourType = typeof ColourSchema.infer;

export enum ProjectionTypeRestrictionEnum {
  // rectangular
  RECTANGULAR = 0,
  // equirectangular
  EQUIRECTANGULAR = 1,
  // cubemap
  CUBEMAP = 2,
  // mesh
  MESH = 3,
}
export const ProjectionTypeRestriction = type('0 | 1 | 2 | 3');
export type ProjectionTypeRestrictionType =
  typeof ProjectionTypeRestriction.infer;

export const ProjectionSchema = type({
  ProjectionType: ProjectionTypeRestriction.default(0),
  ProjectionPrivate: BinarySchema.optional(),
  ProjectionPoseYaw: type.number.default(0),
  ProjectionPosePitch: type.number.default(0),
  ProjectionPoseRoll: type.number.default(0),
});

export type ProjectionType = typeof ProjectionSchema.infer;

export enum FlagInterlacedRestrictionEnum {
  // undetermined
  UNDETERMINED = 0,
  // interlaced
  INTERLACED = 1,
  // progressive
  PROGRESSIVE = 2,
}
export const FlagInterlacedRestriction = type('0 | 1 | 2');
export type FlagInterlacedRestrictionType =
  typeof FlagInterlacedRestriction.infer;

export enum FieldOrderRestrictionEnum {
  // progressive
  PROGRESSIVE = 0,
  // tff
  TFF = 1,
  // undetermined
  UNDETERMINED = 2,
  // bff
  BFF = 6,
  // tff (interleaved)
  TFF_INTERLEAVED = 9,
  // bff (interleaved)
  BFF_INTERLEAVED = 14,
}
export const FieldOrderRestriction = type('0 | 1 | 2 | 6 | 9 | 14');
export type FieldOrderRestrictionType = typeof FieldOrderRestriction.infer;

export enum StereoModeRestrictionEnum {
  // mono
  MONO = 0,
  // side by side (left eye first)
  SIDE_BY_SIDE_LEFT_EYE_FIRST = 1,
  // top - bottom (right eye is first)
  TOP_BOTTOM_RIGHT_EYE_IS_FIRST = 2,
  // top - bottom (left eye is first)
  TOP_BOTTOM_LEFT_EYE_IS_FIRST = 3,
  // checkboard (right eye is first)
  CHECKBOARD_RIGHT_EYE_IS_FIRST = 4,
  // checkboard (left eye is first)
  CHECKBOARD_LEFT_EYE_IS_FIRST = 5,
  // row interleaved (right eye is first)
  ROW_INTERLEAVED_RIGHT_EYE_IS_FIRST = 6,
  // row interleaved (left eye is first)
  ROW_INTERLEAVED_LEFT_EYE_IS_FIRST = 7,
  // column interleaved (right eye is first)
  COLUMN_INTERLEAVED_RIGHT_EYE_IS_FIRST = 8,
  // column interleaved (left eye is first)
  COLUMN_INTERLEAVED_LEFT_EYE_IS_FIRST = 9,
  // anaglyph (cyan/red)
  ANAGLYPH_CYAN_RED = 10,
  // side by side (right eye first)
  SIDE_BY_SIDE_RIGHT_EYE_FIRST = 11,
  // anaglyph (green/magenta)
  ANAGLYPH_GREEN_MAGENTA = 12,
  // both eyes laced in one Block (left eye is first)
  BOTH_EYES_LACED_IN_ONE_BLOCK_LEFT_EYE_IS_FIRST = 13,
  // both eyes laced in one Block (right eye is first)
  BOTH_EYES_LACED_IN_ONE_BLOCK_RIGHT_EYE_IS_FIRST = 14,
}
export const StereoModeRestriction = type(
  '0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14'
);
export type StereoModeRestrictionType = typeof StereoModeRestriction.infer;

export enum AlphaModeRestrictionEnum {
  // none
  NONE = 0,
  // present
  PRESENT = 1,
}
export const AlphaModeRestriction = type('0 | 1');
export type AlphaModeRestrictionType = typeof AlphaModeRestriction.infer;

export enum OldStereoModeRestrictionEnum {
  // mono
  MONO = 0,
  // right eye
  RIGHT_EYE = 1,
  // left eye
  LEFT_EYE = 2,
  // both eyes
  BOTH_EYES = 3,
}
export const OldStereoModeRestriction = type('0 | 1 | 2 | 3');
export type OldStereoModeRestrictionType =
  typeof OldStereoModeRestriction.infer;

export enum DisplayUnitRestrictionEnum {
  // pixels
  PIXELS = 0,
  // centimeters
  CENTIMETERS = 1,
  // inches
  INCHES = 2,
  // display aspect ratio
  DISPLAY_ASPECT_RATIO = 3,
  // unknown
  UNKNOWN = 4,
}
export const DisplayUnitRestriction = type('0 | 1 | 2 | 3 | 4');
export type DisplayUnitRestrictionType = typeof DisplayUnitRestriction.infer;

export enum AspectRatioTypeRestrictionEnum {
  // free resizing
  FREE_RESIZING = 0,
  // keep aspect ratio
  KEEP_ASPECT_RATIO = 1,
  // fixed
  FIXED = 2,
}
export const AspectRatioTypeRestriction = type('0 | 1 | 2');
export type AspectRatioTypeRestrictionType =
  typeof AspectRatioTypeRestriction.infer;

export const VideoSchema = type({
  FlagInterlaced: FlagInterlacedRestriction.default(0),
  FieldOrder: FieldOrderRestriction.default(2),
  StereoMode: StereoModeRestriction.default(0),
  AlphaMode: AlphaModeRestriction.default(0),
  OldStereoMode: OldStereoModeRestriction.optional(),
  PixelWidth: type.number,
  PixelHeight: type.number,
  PixelCropBottom: type.number.default(0),
  PixelCropTop: type.number.default(0),
  PixelCropLeft: type.number.default(0),
  PixelCropRight: type.number.default(0),
  DisplayWidth: type.number.optional(),
  DisplayHeight: type.number.optional(),
  DisplayUnit: DisplayUnitRestriction.default(0),
  AspectRatioType: AspectRatioTypeRestriction.default(0),
  UncompressedFourCC: BinarySchema.optional(),
  GammaValue: type.number.optional(),
  FrameRate: type.number.optional(),
  Colour: ColourSchema.optional(),
  Projection: ProjectionSchema.optional(),
});

export type VideoType = typeof VideoSchema.infer;

export enum EmphasisRestrictionEnum {
  // No emphasis
  NO_EMPHASIS = 0,
  // CD audio
  CD_AUDIO = 1,
  // reserved
  RESERVED = 2,
  // CCIT J.17
  CCIT_J_17 = 3,
  // FM 50
  FM_50 = 4,
  // FM 75
  FM_75 = 5,
  // Phono RIAA
  PHONO_RIAA = 10,
  // Phono IEC N78
  PHONO_IEC_N78 = 11,
  // Phono TELDEC
  PHONO_TELDEC = 12,
  // Phono EMI
  PHONO_EMI = 13,
  // Phono Columbia LP
  PHONO_COLUMBIA_LP = 14,
  // Phono LONDON
  PHONO_LONDON = 15,
  // Phono NARTB
  PHONO_NARTB = 16,
}
export const EmphasisRestriction = type(
  '0 | 1 | 2 | 3 | 4 | 5 | 10 | 11 | 12 | 13 | 14 | 15 | 16'
);
export type EmphasisRestrictionType = typeof EmphasisRestriction.infer;

export const AudioSchema = type({
  SamplingFrequency: type.number.default(0),
  OutputSamplingFrequency: type.number.optional(),
  Channels: type.number.default(1),
  ChannelPositions: BinarySchema.optional(),
  BitDepth: type.number.optional(),
  Emphasis: EmphasisRestriction.default(0),
});

export type AudioType = typeof AudioSchema.infer;

export enum TrackPlaneTypeRestrictionEnum {
  // left eye
  LEFT_EYE = 0,
  // right eye
  RIGHT_EYE = 1,
  // background
  BACKGROUND = 2,
}
export const TrackPlaneTypeRestriction = type('0 | 1 | 2');
export type TrackPlaneTypeRestrictionType =
  typeof TrackPlaneTypeRestriction.infer;

export const TrackPlaneSchema = type({
  TrackPlaneUID: type.number,
  TrackPlaneType: TrackPlaneTypeRestriction,
});

export type TrackPlaneType = typeof TrackPlaneSchema.infer;

export const TrackCombinePlanesSchema = type({
  TrackPlane: TrackPlaneSchema.array(),
});

export type TrackCombinePlanesType = typeof TrackCombinePlanesSchema.infer;

export const TrackJoinBlocksSchema = type({
  TrackJoinUID: type.number.array(),
});

export type TrackJoinBlocksType = typeof TrackJoinBlocksSchema.infer;

export const TrackOperationSchema = type({
  TrackCombinePlanes: TrackCombinePlanesSchema.optional(),
  TrackJoinBlocks: TrackJoinBlocksSchema.optional(),
});

export type TrackOperationType = typeof TrackOperationSchema.infer;

export enum ContentCompAlgoRestrictionEnum {
  // zlib
  ZLIB = 0,
  // bzlib
  BZLIB = 1,
  // lzo1x
  LZO1X = 2,
  // Header Stripping
  HEADER_STRIPPING = 3,
}
export const ContentCompAlgoRestriction = type('0 | 1 | 2 | 3');
export type ContentCompAlgoRestrictionType =
  typeof ContentCompAlgoRestriction.infer;

export const ContentCompressionSchema = type({
  ContentCompAlgo: ContentCompAlgoRestriction.default(0),
  ContentCompSettings: BinarySchema.optional(),
});

export type ContentCompressionType = typeof ContentCompressionSchema.infer;

export enum AESSettingsCipherModeRestrictionEnum {
  // AES-CTR
  AES_CTR = 1,
  // AES-CBC
  AES_CBC = 2,
}
export const AESSettingsCipherModeRestriction = type('1 | 2');
export type AESSettingsCipherModeRestrictionType =
  typeof AESSettingsCipherModeRestriction.infer;

export const ContentEncAESSettingsSchema = type({
  AESSettingsCipherMode: AESSettingsCipherModeRestriction,
});

export type ContentEncAESSettingsType =
  typeof ContentEncAESSettingsSchema.infer;

export enum ContentEncAlgoRestrictionEnum {
  // Not encrypted
  NOT_ENCRYPTED = 0,
  // DES
  DES = 1,
  // 3DES
  _3_DES = 2,
  // Twofish
  TWOFISH = 3,
  // Blowfish
  BLOWFISH = 4,
  // AES
  AES = 5,
}
export const ContentEncAlgoRestriction = type('0 | 1 | 2 | 3 | 4 | 5');
export type ContentEncAlgoRestrictionType =
  typeof ContentEncAlgoRestriction.infer;

export enum ContentSigAlgoRestrictionEnum {
  // Not signed
  NOT_SIGNED = 0,
  // RSA
  RSA = 1,
}
export const ContentSigAlgoRestriction = type('0 | 1');
export type ContentSigAlgoRestrictionType =
  typeof ContentSigAlgoRestriction.infer;

export enum ContentSigHashAlgoRestrictionEnum {
  // Not signed
  NOT_SIGNED = 0,
  // SHA1-160
  SHA1_160 = 1,
  // MD5
  MD5 = 2,
}
export const ContentSigHashAlgoRestriction = type('0 | 1 | 2');
export type ContentSigHashAlgoRestrictionType =
  typeof ContentSigHashAlgoRestriction.infer;

export const ContentEncryptionSchema = type({
  ContentEncAlgo: ContentEncAlgoRestriction.default(0),
  ContentEncKeyID: BinarySchema.optional(),
  ContentEncAESSettings: ContentEncAESSettingsSchema.optional(),
  ContentSignature: BinarySchema.optional(),
  ContentSigKeyID: BinarySchema.optional(),
  ContentSigAlgo: ContentSigAlgoRestriction.default(0),
  ContentSigHashAlgo: ContentSigHashAlgoRestriction.default(0),
});

export type ContentEncryptionType = typeof ContentEncryptionSchema.infer;

export enum ContentEncodingScopeRestrictionEnum {
  // Block
  BLOCK = 1,
  // Private
  PRIVATE = 2,
  // Next
  NEXT = 4,
}
export const ContentEncodingScopeRestriction = type('1 | 2 | 4');
export type ContentEncodingScopeRestrictionType =
  typeof ContentEncodingScopeRestriction.infer;

export enum ContentEncodingTypeRestrictionEnum {
  // Compression
  COMPRESSION = 0,
  // Encryption
  ENCRYPTION = 1,
}
export const ContentEncodingTypeRestriction = type('0 | 1');
export type ContentEncodingTypeRestrictionType =
  typeof ContentEncodingTypeRestriction.infer;

export const ContentEncodingSchema = type({
  ContentEncodingOrder: type.number.default(0),
  ContentEncodingScope: ContentEncodingScopeRestriction.default(1),
  ContentEncodingType: ContentEncodingTypeRestriction.default(0),
  ContentCompression: ContentCompressionSchema.optional(),
  ContentEncryption: ContentEncryptionSchema.optional(),
});

export type ContentEncodingType = typeof ContentEncodingSchema.infer;

export const ContentEncodingsSchema = type({
  ContentEncoding: ContentEncodingSchema.array(),
});

export type ContentEncodingsType = typeof ContentEncodingsSchema.infer;

export enum TrackTypeRestrictionEnum {
  // video
  VIDEO = 1,
  // audio
  AUDIO = 2,
  // complex
  COMPLEX = 3,
  // logo
  LOGO = 16,
  // subtitle
  SUBTITLE = 17,
  // buttons
  BUTTONS = 18,
  // control
  CONTROL = 32,
  // metadata
  METADATA = 33,
}
export const TrackTypeRestriction = type('1 | 2 | 3 | 16 | 17 | 18 | 32 | 33');
export type TrackTypeRestrictionType = typeof TrackTypeRestriction.infer;

export const TrackEntrySchema = type({
  TrackNumber: type.number,
  TrackUID: type.number,
  TrackType: TrackTypeRestriction,
  FlagEnabled: type.number.default(1),
  FlagDefault: type.number.default(1),
  FlagForced: type.number.default(0),
  FlagHearingImpaired: type.number.optional(),
  FlagVisualImpaired: type.number.optional(),
  FlagTextDescriptions: type.number.optional(),
  FlagOriginal: type.number.optional(),
  FlagCommentary: type.number.optional(),
  FlagLacing: type.number.default(1),
  MinCache: type.number.default(0),
  MaxCache: type.number.optional(),
  DefaultDuration: type.number.optional(),
  DefaultDecodedFieldDuration: type.number.optional(),
  TrackTimestampScale: type.number.default(0),
  TrackOffset: type.number.default(0),
  MaxBlockAdditionID: type.number.default(0),
  BlockAdditionMapping: BlockAdditionMappingSchema.array().optional(),
  Name: type.string.optional(),
  Language: type.string.default('eng'),
  LanguageBCP47: type.string.optional(),
  CodecID: type.string,
  CodecPrivate: BinarySchema.optional(),
  CodecName: type.string.optional(),
  AttachmentLink: type.number.optional(),
  CodecSettings: type.string.optional(),
  CodecInfoURL: type.string.array().optional(),
  CodecDownloadURL: type.string.array().optional(),
  CodecDecodeAll: type.number.default(1),
  TrackOverlay: type.number.array().optional(),
  CodecDelay: type.number.default(0),
  SeekPreRoll: type.number.default(0),
  TrackTranslate: TrackTranslateSchema.array().optional(),
  Video: VideoSchema.optional(),
  Audio: AudioSchema.optional(),
  TrackOperation: TrackOperationSchema.optional(),
  TrickTrackUID: type.number.optional(),
  TrickTrackSegmentUID: BinarySchema.optional(),
  TrickTrackFlag: type.number.default(0),
  TrickMasterTrackUID: type.number.optional(),
  TrickMasterTrackSegmentUID: BinarySchema.optional(),
  ContentEncodings: ContentEncodingsSchema.optional(),
});

export type TrackEntryType = typeof TrackEntrySchema.infer;

export const TracksSchema = type({
  TrackEntry: TrackEntrySchema.array(),
});

export type TracksType = typeof TracksSchema.infer;

export const CueReferenceSchema = type({
  CueRefTime: type.number,
  CueRefCluster: type.number,
  CueRefNumber: type.number.default(1),
  CueRefCodecState: type.number.default(0),
});

export type CueReferenceType = typeof CueReferenceSchema.infer;

export const CueTrackPositionsSchema = type({
  CueTrack: type.number,
  CueClusterPosition: type.number,
  CueRelativePosition: type.number.optional(),
  CueDuration: type.number.optional(),
  CueBlockNumber: type.number.optional(),
  CueCodecState: type.number.default(0),
  CueReference: CueReferenceSchema.array().optional(),
});

export type CueTrackPositionsType = typeof CueTrackPositionsSchema.infer;

export const CuePointSchema = type({
  CueTime: type.number,
  CueTrackPositions: CueTrackPositionsSchema.array(),
});

export type CuePointType = typeof CuePointSchema.infer;

export const CuesSchema = type({
  CuePoint: CuePointSchema.array(),
});

export type CuesType = typeof CuesSchema.infer;

export const AttachedFileSchema = type({
  FileDescription: type.string.optional(),
  FileName: type.string,
  FileMediaType: type.string,
  FileData: BinarySchema,
  FileUID: type.number,
  FileReferral: BinarySchema.optional(),
  FileUsedStartTime: type.number.optional(),
  FileUsedEndTime: type.number.optional(),
});

export type AttachedFileType = typeof AttachedFileSchema.infer;

export const AttachmentsSchema = type({
  AttachedFile: AttachedFileSchema.array(),
});

export type AttachmentsType = typeof AttachmentsSchema.infer;

export const EditionDisplaySchema = type({
  EditionString: type.string,
  EditionLanguageIETF: type.string.array().optional(),
});

export type EditionDisplayType = typeof EditionDisplaySchema.infer;

export const EditionEntrySchema = type({
  EditionUID: type.number.optional(),
  EditionFlagHidden: type.number.default(0),
  EditionFlagDefault: type.number.default(0),
  EditionFlagOrdered: type.number.default(0),
  EditionDisplay: EditionDisplaySchema.array().optional(),
});

export type EditionEntryType = typeof EditionEntrySchema.infer;

export const ChaptersSchema = type({
  EditionEntry: EditionEntrySchema.array(),
});

export type ChaptersType = typeof ChaptersSchema.infer;

export const TagTrackUIDSchema = match({
  'number[]': (v) => (v.length > 0 ? v : [0]),
  undefined: () => [0],
  default: 'assert',
});

export const TagEditionUIDSchema = match({
  'number[]': (v) => (v.length > 0 ? v : [0]),
  undefined: () => [0],
  default: 'assert',
});

export const TagChapterUIDSchema = match({
  'number[]': (v) => (v.length > 0 ? v : [0]),
  undefined: () => [0],
  default: 'assert',
});

export const TagAttachmentUIDSchema = match({
  'number[]': (v) => (v.length > 0 ? v : [0]),
  undefined: () => [0],
  default: 'assert',
});

export enum TargetTypeValueRestrictionEnum {
  // SHOT
  SHOT = 10,
  // SUBTRACK / MOVEMENT / SCENE
  SUBTRACK_MOVEMENT_SCENE = 20,
  // TRACK / SONG / CHAPTER
  TRACK_SONG_CHAPTER = 30,
  // PART / SESSION
  PART_SESSION = 40,
  // ALBUM / OPERA / CONCERT / MOVIE / EPISODE
  ALBUM_OPERA_CONCERT_MOVIE_EPISODE = 50,
  // EDITION / ISSUE / VOLUME / OPUS / SEASON / SEQUEL
  EDITION_ISSUE_VOLUME_OPUS_SEASON_SEQUEL = 60,
  // COLLECTION
  COLLECTION = 70,
}
export const TargetTypeValueRestriction = type(
  '10 | 20 | 30 | 40 | 50 | 60 | 70'
);
export type TargetTypeValueRestrictionType =
  typeof TargetTypeValueRestriction.infer;

export enum TargetTypeRestrictionEnum {
  // TargetTypeValue 70
  COLLECTION = 'COLLECTION',
  // TargetTypeValue 60
  EDITION = 'EDITION',
  // TargetTypeValue 60
  ISSUE = 'ISSUE',
  // TargetTypeValue 60
  VOLUME = 'VOLUME',
  // TargetTypeValue 60
  OPUS = 'OPUS',
  // TargetTypeValue 60
  SEASON = 'SEASON',
  // TargetTypeValue 60
  SEQUEL = 'SEQUEL',
  // TargetTypeValue 50
  ALBUM = 'ALBUM',
  // TargetTypeValue 50
  OPERA = 'OPERA',
  // TargetTypeValue 50
  CONCERT = 'CONCERT',
  // TargetTypeValue 50
  MOVIE = 'MOVIE',
  // TargetTypeValue 50
  EPISODE = 'EPISODE',
  // TargetTypeValue 40
  PART = 'PART',
  // TargetTypeValue 40
  SESSION = 'SESSION',
  // TargetTypeValue 30
  TRACK = 'TRACK',
  // TargetTypeValue 30
  SONG = 'SONG',
  // TargetTypeValue 30
  CHAPTER = 'CHAPTER',
  // TargetTypeValue 20
  SUBTRACK = 'SUBTRACK',
  // TargetTypeValue 20
  MOVEMENT = 'MOVEMENT',
  // TargetTypeValue 20
  SCENE = 'SCENE',
  // TargetTypeValue 10
  SHOT = 'SHOT',
}
export const TargetTypeRestriction = type(
  '"COLLECTION" | "EDITION" | "ISSUE" | "VOLUME" | "OPUS" | "SEASON" | "SEQUEL" | "ALBUM" | "OPERA" | "CONCERT" | "MOVIE" | "EPISODE" | "PART" | "SESSION" | "TRACK" | "SONG" | "CHAPTER" | "SUBTRACK" | "MOVEMENT" | "SCENE" | "SHOT"'
);
export type TargetTypeRestrictionType = typeof TargetTypeRestriction.infer;

export const TargetsSchema = type({
  TargetTypeValue: TargetTypeValueRestriction.default(50),
  TargetType: TargetTypeRestriction.optional(),
  TagTrackUID: TagTrackUIDSchema,
  TagEditionUID: TagEditionUIDSchema,
  TagChapterUID: TagChapterUIDSchema,
  TagAttachmentUID: TagAttachmentUIDSchema,
});

export type TargetsType = typeof TargetsSchema.infer;

export const TagSchema = type({
  Targets: TargetsSchema,
});

export type TagType = typeof TagSchema.infer;

export const TagsSchema = type({
  Tag: TagSchema.array(),
});

export type TagsType = typeof TagsSchema.infer;

export const SegmentSchema = type({
  SeekHead: SeekHeadSchema.array().optional(),
  Info: InfoSchema,
  Cluster: ClusterSchema.array().optional(),
  Tracks: TracksSchema.optional(),
  Cues: CuesSchema.optional(),
  Attachments: AttachmentsSchema.optional(),
  Chapters: ChaptersSchema.optional(),
  Tags: TagsSchema.array().optional(),
});

export type SegmentType = typeof SegmentSchema.infer;

export const IdMultiSet = new Set([
  EbmlTagIdEnum.DocTypeExtension,
  EbmlTagIdEnum.Seek,
  EbmlTagIdEnum.ChapterTranslateEditionUID,
  EbmlTagIdEnum.SegmentFamily,
  EbmlTagIdEnum.ChapterTranslate,
  EbmlTagIdEnum.SilentTrackNumber,
  EbmlTagIdEnum.BlockMore,
  EbmlTagIdEnum.TimeSlice,
  EbmlTagIdEnum.ReferenceBlock,
  EbmlTagIdEnum.SimpleBlock,
  EbmlTagIdEnum.BlockGroup,
  EbmlTagIdEnum.EncryptedBlock,
  EbmlTagIdEnum.TrackTranslateEditionUID,
  EbmlTagIdEnum.TrackPlane,
  EbmlTagIdEnum.TrackJoinUID,
  EbmlTagIdEnum.ContentEncoding,
  EbmlTagIdEnum.BlockAdditionMapping,
  EbmlTagIdEnum.CodecInfoURL,
  EbmlTagIdEnum.CodecDownloadURL,
  EbmlTagIdEnum.TrackOverlay,
  EbmlTagIdEnum.TrackTranslate,
  EbmlTagIdEnum.TrackEntry,
  EbmlTagIdEnum.CueReference,
  EbmlTagIdEnum.CueTrackPositions,
  EbmlTagIdEnum.CuePoint,
  EbmlTagIdEnum.AttachedFile,
  EbmlTagIdEnum.EditionLanguageIETF,
  EbmlTagIdEnum.EditionDisplay,
  EbmlTagIdEnum.EditionEntry,
  EbmlTagIdEnum.TagTrackUID,
  EbmlTagIdEnum.TagEditionUID,
  EbmlTagIdEnum.TagChapterUID,
  EbmlTagIdEnum.TagAttachmentUID,
  EbmlTagIdEnum.Tag,
  EbmlTagIdEnum.SeekHead,
  EbmlTagIdEnum.Cluster,
  EbmlTagIdEnum.Tags,
]);
