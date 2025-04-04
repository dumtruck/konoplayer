export interface RangedStream {
  controller: AbortController;
  response: Response;
  body: ReadableStream;
  totalSize?: number;
}

export interface CreateRangedStreamOptions {
  url: string;
  byteStart?: number;
  byteEnd?: number;
}

export async function createRangedStream({
  url,
  byteStart = 0,
  byteEnd,
}: CreateRangedStreamOptions) {
  const controller = new AbortController();
  const signal = controller.signal;
  const headers = new Headers();
  headers.append(
    'Range',
    typeof byteEnd === 'number'
      ? `bytes=${byteStart}-${byteEnd}`
      : `bytes=${byteStart}-`
  );

  const response = await fetch(url, { signal, headers });

  if (!response.ok) {
    throw new Error('fetch video stream failed');
  }

  const acceptRanges = response.headers.get('Accept-Ranges');

  if (acceptRanges !== 'bytes') {
    throw new Error('video server does not support byte ranges');
  }

  const body = response.body;

  if (!(body instanceof ReadableStream)) {
    throw new Error('can not get readable stream from response.body');
  }

  const contentRange = response.headers.get('Content-Range');

  //
  // Content-Range Header Syntax:
  // Content-Range: <unit> <range-start>-<range-end>/<size>
  // Content-Range: <unit> <range-start>-<range-end>/*
  // Content-Range: <unit> */<size>
  //
  const totalSize = contentRange
    ? Number.parseInt(contentRange.split('/')[1], 10)
    : undefined;

  return {
    controller,
    response,
    body,
    totalSize,
  };
}
