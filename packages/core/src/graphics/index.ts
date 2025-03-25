import {map, Observable, Subject} from 'rxjs';

export type RenderingContext =
  | ImageBitmapRenderingContext
  | CanvasRenderingContext2D;

export function createRenderingContext(): RenderingContext {
  const canvas = document.createElement('canvas');
  const context =
    canvas.getContext('bitmaprenderer') || canvas.getContext('2d');
  if (!context) {
    throw new DOMException(
      'can not get rendering context of canvas',
      'CanvasException'
    );
  }
  return context;
}

export function renderBitmapAtRenderingContext(
  context: RenderingContext,
  bitmap: ImageBitmap
) {
  const canvas = context.canvas;
  if (bitmap.width !== canvas.width || bitmap.height !== canvas.height) {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
  }
  if (context instanceof ImageBitmapRenderingContext) {
    context.transferFromImageBitmap(bitmap);
  } else {
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
    bitmap.close();
  }
}

export function captureCanvasAsVideoSrcObject(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  frameRate: number
) {
  video.srcObject = canvas.captureStream(frameRate);
}

export function createVideoDecodeStream(configuration: VideoDecoderConfig): Observable<{
  decoder: VideoDecoder;
  frame$: Observable<VideoFrame>;
}> {
  const frame$ = new Subject<VideoFrame>()
  const decoder$ = new Observable<VideoDecoder>((subscriber) => {
    let isFinalized = false;
    const decoder = new VideoDecoder({
      output: (frame) => frame$.next(frame),
      error: (e) => {
        if (!isFinalized) {
          isFinalized = true;
          frame$.error(e);
          subscriber.error(e);
        }
      },
    });

    decoder.configure(configuration);

    subscriber.next(decoder);

    return () => {
      if (!isFinalized) {
        isFinalized = true;
        frame$.complete();
        decoder.close();
      }
    };
  })

  return decoder$.pipe(map((decoder) => ({
    decoder,
    frame$
  })));
}
