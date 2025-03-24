use ffmpeg_sys_next as ffmpeg;

fn get_webcodecs_codec(codec_id: &str, codec_private: &[u8]) -> Result<String, String> {
    unsafe {
        // 根据 CodecID 获取 AVCodec
        let codec = match codec_id {
            "V_VP8" => ffmpeg::AVCodecID::AV_CODEC_ID_VP8,
            "V_VP9" => ffmpeg::AVCodecID::AV_CODEC_ID_VP9,
            "V_MPEG4/ISO/AVC" => ffmpeg::AVCodecID::AV_CODEC_ID_H264,
            "V_MPEGH/ISO/HEVC" => ffmpeg::AVCodecID::AV_CODEC_ID_HEVC,
            _ => return Err(format!("Unsupported CodecID: {}", codec_id)),
        };

        let av_codec = ffmpeg::avcodec_find_decoder(codec);
        if av_codec.is_null() {
            return Err("Codec not found".to_string());
        }

        let context = ffmpeg::avcodec_alloc_context3(av_codec);
        if context.is_null() {
            return Err("Failed to allocate context".to_string());
        }

        // 设置 CodecPrivate 数据
        (*context).extradata = codec_private.as_ptr() as *mut u8;
        (*context).extradata_size = codec_private.len() as i32;

        // 解析参数
        match codec_id {
            "V_VP9" => {
                // VP9: 假设默认值，实际需解析帧数据
                Ok("vp09.00.10.08".to_string())
            }
            "V_MPEG4/ISO/AVC" => {
                let profile = (*context).profile; // FFmpeg 提供 profile
                let level = (*context).level;
                Ok(format!("avc1.{:02x}00{:02x}", profile, level))
            }
            "V_MPEGH/ISO/HEVC" => {
                let profile = (*context).profile;
                let level = (*context).level;
                Ok(format!("hev1.{}.0.{}.B0", profile, level))
            }
            _ => unreachable!(),
        }
    }
}

pub fn add(left: u64, right: u64) -> u64 {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(2, 2);
        assert_eq!(result, 4);
    }

    #[test]
    fn main() {
        let codec_id = "V_MPEGH/ISO/HEVC";
        let codec_private = vec![
            1, 2, 32, 0, 0, 0, 144, 0, 0, 0, 0, 0, 120, 240, 0, 252, 253, 250, 250, 0, 0, 15, 4,
            160, 0, 1, 0, 25, 64, 1, 12, 1, 255, 255, 2, 32, 0, 0, 3, 0, 144, 0, 0, 3, 0, 0, 3, 0,
            120, 153, 138, 2, 64, 161, 0, 1, 0, 44, 66, 1, 1, 2, 32, 0, 0, 3, 0, 144, 0, 0, 3, 0,
            0, 3, 0, 120, 160, 3, 192, 128, 16, 228, 217, 102, 98, 174, 70, 194, 166, 160, 32, 32,
            60, 32, 0, 0, 125, 32, 0, 11, 184, 1, 162, 0, 1, 0, 9, 68, 1, 193, 114, 138, 86, 113,
            178, 64, 167, 0, 1, 0, 121, 78, 1, 5, 116, 44, 162, 222, 9, 181, 23, 71, 219, 187, 85,
            164, 254, 127, 194, 252, 78, 120, 50, 54, 53, 32, 45, 32, 45, 32, 72, 46, 50, 54, 53,
            47, 72, 69, 86, 67, 32, 99, 111, 100, 101, 99, 32, 45, 32, 67, 111, 112, 121, 114, 105,
            103, 104, 116, 32, 50, 48, 49, 51, 45, 50, 48, 49, 56, 32, 40, 99, 41, 32, 77, 117,
            108, 116, 105, 99, 111, 114, 101, 119, 97, 114, 101, 44, 32, 73, 110, 99, 32, 45, 32,
            104, 116, 116, 112, 58, 47, 47, 120, 50, 54, 53, 46, 111, 114, 103, 32, 45, 32, 111,
            112, 116, 105, 111, 110, 115, 58, 32, 128,
        ];
        match get_webcodecs_codec(codec_id, &codec_private) {
            Ok(codec) => println!("WebCodecs codec: {}", codec),
            Err(e) => eprintln!("Error: {}", e),
        }
    }
}
