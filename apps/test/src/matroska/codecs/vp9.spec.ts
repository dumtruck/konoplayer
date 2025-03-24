import { SegmentSchema, SegmentType } from '@konoplayer/matroska/schema';
import { VideoCodecId } from '@konoplayer/matroska/codecs';
import {
  genCodecStringByVP9DecoderConfigurationRecord,
  parseVP9DecoderConfigurationRecord,
  VP9ColorSpaceEnum,
  VP9Subsampling,
} from '@konoplayer/matroska/codecs/vp9';
import { loadComponentFromRangedResource } from '../utils/data';
import { EbmlTagIdEnum, EbmlTagPosition } from 'konoebml';
import { isTagIdPos } from '@konoplayer/matroska/util';

describe('VP9 code test', () => {
  it('should parse vp9 meta from track entry and keyframe', async () => {
    const [segment] = await loadComponentFromRangedResource<SegmentType>({
      resource: 'video/test-vp9.mkv',
      predicate: isTagIdPos(EbmlTagIdEnum.Segment, EbmlTagPosition.End),
      schema: SegmentSchema,
    });

    const vp9Track = segment.Tracks?.TrackEntry.find(
      (t) => t.CodecID === VideoCodecId.VP9
    )!;

    expect(vp9Track).toBeDefined();

    expect(vp9Track.CodecPrivate).toBeFalsy();

    const keyframe = segment
      .Cluster!.flatMap((c) => c.SimpleBlock || [])
      .find((b) => b.keyframe && b.track === vp9Track.TrackNumber)!;

    expect(keyframe).toBeDefined();
    expect(keyframe.frames.length).toBe(1);

    const meta = parseVP9DecoderConfigurationRecord(
      vp9Track,
      keyframe.frames[0]
    )!;

    expect(meta).toBeDefined();

    expect(meta.bitDepth).toBe(8);
    expect(meta.subsampling).toBe(VP9Subsampling.YUV420);
    expect(meta.width).toBe(640);
    expect(meta.height).toBe(360);
    expect(meta.colorSpace).toBe(VP9ColorSpaceEnum.BT_601);
    expect(meta.profile).toBe(0);

    const codecStr = genCodecStringByVP9DecoderConfigurationRecord(meta);

    expect(codecStr).toBe('vp09.00.21.08');
  });
});
