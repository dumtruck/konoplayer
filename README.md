# konoplayer

**A project initially launched solely to watch animations in the widely used but poorly supported MKV format in browsers, just for fun.**

## State of Prototype
- [x] Matroska support
  - [x] Parse EBML and demux (Done / Typescript)
  - [x] Data validating fit matroska v4 doc (Done / Typescript)
  - [x] WebCodecs decode + Canvas rendering (Prototyping / Typescript)
  - [x] Parsing track CodecId/Private and generate Codec String (Partial / Typescript)
    - Video: 
      - [x] VP9
      - [x] VP8
      - [x] AVC
      - [x] HEVC
      - [x] AV1
    - Audio: 
      - [x] AAC
      - [x] MP3  
      - [x] AC3
      - [ ] OPUS (not tested, need more work)
      - [ ] VORBIS (need fix)
      - [ ] EAC-3 (need fix)
      - [ ] PCM (need tested)
      - [ ] ALAC (need tested)
      - [ ] FLAC (need tested)
  - [ ] Wrap video element with customElements (Prototyping / Lit-html + Typescript)
  - [ ] Add WebCodecs polyfill with ffmpeg or libav (Todo / WASM)
    - [x] Chrome/Edge/Android Webview: WebCodecs Native support
    - [ ] FIREFOX 
      - [x] VP8/VP9/AV1 native support
      - [x] AVC/HEVC 8bit native support
      - [ ] AVC/HEVC >= 10bit polyfill needed
      - [ ] Firefox Android not support
    - [ ] Safari
        - [x] VP8/VP9/AV1 native support
        - [x] AVC/HEVC 8bit native support
        - [ ] AVC/HEVC >= 10bit polyfill needed for some devices
        - [ ] Audio Decoder polyfill needed
    - [ ] Danmuku integration (Todo / Typescript)