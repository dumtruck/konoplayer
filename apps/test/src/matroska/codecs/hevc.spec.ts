import { SegmentSchema, SegmentType } from '@konoplayer/matroska/schema';
import { VideoCodecId } from '@konoplayer/matroska/codecs';
import {
  parseHEVCDecoderConfigurationRecord,
  genCodecStringByHEVCDecoderConfigurationRecord,
  HEVCDecoderConfigurationRecordType,
} from '@konoplayer/matroska/codecs/hevc';
import { loadComponentFromRangedResource } from '../utils/data';
import { EbmlTagIdEnum, EbmlTagPosition } from 'konoebml';
import { isTagIdPos } from '@konoplayer/matroska/util';
import { assert } from 'vitest';

describe('HEVC codec test', () => {
  it('should parse hevc meta from track entry', async () => {
    const [segment] = await loadComponentFromRangedResource<SegmentType>({
      resource: 'video/test-hevc.mkv',
      predicate: isTagIdPos(EbmlTagIdEnum.Segment, EbmlTagPosition.End),
      schema: SegmentSchema,
    });

    const hevcTrack = segment.Tracks?.TrackEntry.find(
      (t) => t.CodecID === VideoCodecId.HEVC
    )!;

    expect(hevcTrack).toBeDefined();

    expect(hevcTrack.CodecPrivate).toBeDefined();

    const meta = parseHEVCDecoderConfigurationRecord(hevcTrack);

    expect(meta).toBeDefined();

    const codecStr = genCodecStringByHEVCDecoderConfigurationRecord(meta);

    expect(codecStr).toBe('hev1.1.6.L63.90');
  });

  it('should match chrome test suite', () => {
    function makeHEVCParameterSet(
      generalProfileSpace: number,
      generalProfileIDC: number,
      generalProfileCompatibilityFlags: number,
      generalTierFlag: number,
      generalConstraintIndicatorFlags: [
        number,
        number,
        number,
        number,
        number,
        number,
      ],
      generalLevelIDC: number
    ) {
      return {
        generalProfileSpace: generalProfileSpace,
        generalProfileIdc: generalProfileIDC,
        generalProfileCompatibilityFlags: generalProfileCompatibilityFlags,
        generalTierFlag: generalTierFlag,
        generalConstraintIndicatorFlags: Number(
          new DataView(
            new Uint8Array([0, 0, ...generalConstraintIndicatorFlags]).buffer
          ).getBigUint64(0, false)
        ),
        generalLevelIdc: generalLevelIDC,
      } as unknown as HEVCDecoderConfigurationRecordType;
    }

    assert(
      genCodecStringByHEVCDecoderConfigurationRecord(
        makeHEVCParameterSet(0, 1, 0x60000000, 0, [0, 0, 0, 0, 0, 0], 93)
      ),
      'hev1.1.6.L93'
    );
    assert(
      genCodecStringByHEVCDecoderConfigurationRecord(
        makeHEVCParameterSet(1, 4, 0x82000000, 1, [0, 0, 0, 0, 0, 0], 120)
      ),
      'hev1.A4.41.H120'
    );
    assert(
      genCodecStringByHEVCDecoderConfigurationRecord(
        makeHEVCParameterSet(0, 1, 0x60000000, 0, [176, 0, 0, 0, 0, 0], 93)
      ),
      'hev1.1.6.L93.B0'
    );
    assert(
      genCodecStringByHEVCDecoderConfigurationRecord(
        makeHEVCParameterSet(1, 4, 0x82000000, 1, [176, 35, 0, 0, 0, 0], 120)
      ),
      'hev1.A4.41.H120.B0.23'
    );
    assert(
      genCodecStringByHEVCDecoderConfigurationRecord(
        makeHEVCParameterSet(
          2,
          1,
          0xf77db57b,
          1,
          [18, 52, 86, 120, 154, 188],
          254
        )
      ),
      'hev1.B1.DEADBEEF.H254.12.34.56.78.9A.BC'
    );
  });
});
