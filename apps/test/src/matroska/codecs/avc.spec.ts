import { SegmentSchema, SegmentType } from '@konoplayer/matroska/schema';
import { VideoCodecId } from '@konoplayer/matroska/codecs';
import {
  parseAVCDecoderConfigurationRecord,
  genCodecStringByAVCDecoderConfigurationRecord,
} from '@konoplayer/matroska/codecs/avc';
import { loadComponentFromRangedResource } from '../utils/data';
import { EbmlTagIdEnum, EbmlTagPosition } from 'konoebml';
import { isTagIdPos } from '@konoplayer/matroska/util';

describe('AVC code test', () => {
  it('should parse avc meta from track entry', async () => {
    const [segment] = await loadComponentFromRangedResource<SegmentType>({
      resource: 'video/test-avc.mkv',
      predicate: isTagIdPos(EbmlTagIdEnum.Segment, EbmlTagPosition.End),
      schema: SegmentSchema,
    });

    const avcTrack = segment.Tracks?.TrackEntry.find(
      (t) => t.CodecID === VideoCodecId.H264
    )!;

    expect(avcTrack).toBeDefined();

    expect(avcTrack.CodecPrivate).toBeDefined();

    const meta = parseAVCDecoderConfigurationRecord(avcTrack)!;

    expect(meta).toBeDefined();

    const codecStr = genCodecStringByAVCDecoderConfigurationRecord(meta);

    expect(meta.configurationVersion).toBe(1);
    expect(meta.avcProfileIndication).toBe(100);
    expect(meta.profileCompatibility).toBe(0);
    expect(meta.avcLevelIndication).toBe(30);

    expect(codecStr).toBe('avc1.64001e');
  });
});
