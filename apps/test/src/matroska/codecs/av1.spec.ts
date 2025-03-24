import { SegmentSchema, SegmentType } from '@konoplayer/matroska/schema';
import { VideoCodecId } from '@konoplayer/matroska/codecs';
import {
  parseAV1DecoderConfigurationRecord,
  genCodecStringByAV1DecoderConfigurationRecord,
} from '@konoplayer/matroska/codecs/av1';
import { loadComponentFromRangedResource } from '../utils/data';
import { EbmlTagIdEnum, EbmlTagPosition } from 'konoebml';
import { isTagIdPos } from '@konoplayer/matroska/util';

describe('AV1 code test', () => {
  it('should parse av1 meta from track entry', async () => {
    const [segment] = await loadComponentFromRangedResource<SegmentType>({
      resource: 'video/test-av1.mkv',
      predicate: isTagIdPos(EbmlTagIdEnum.Segment, EbmlTagPosition.End),
      schema: SegmentSchema,
    });

    const av1Track = segment.Tracks?.TrackEntry.find(
      (t) => t.CodecID === VideoCodecId.AV1
    )!;

    expect(av1Track).toBeDefined();

    expect(av1Track.CodecPrivate).toBeDefined();

    const meta = parseAV1DecoderConfigurationRecord(av1Track)!;

    expect(meta).toBeDefined();

    const codecStr = genCodecStringByAV1DecoderConfigurationRecord(meta);

    expect(meta.marker).toBe(1);
    expect(meta.version).toBe(1);
    expect(meta.seqProfile).toBe(0);
    expect(meta.seqLevelIdx0).toBe(1);
    expect(meta.seqTier0).toBe(0);
    expect(meta.highBitdepth).toBe(0);
    expect(meta.monochrome).toBe(0);
    expect(
      `${meta.chromaSubsamplingX}${meta.chromaSubsamplingY}${meta.chromaSamplePosition}`
    ).toBe('110');
    expect(meta.initialPresentationDelayMinus1).toBeUndefined();

    expect(codecStr).toBe('av01.0.01M.08.0.110');
  });
});
