export class UnsupportedCodecError extends Error {
  constructor(codec: string, context: string) {
    super(`codec ${codec} is not supported in ${context} context`);
  }
}

export class ParseCodecError extends Error {
  constructor(codec: string, detail: string) {
    super(`code ${codec} private parse failed: ${detail}`);
  }
}

export class UnreachableOrLogicError extends Error {
  constructor(detail: string) {
    super(`unreachable or logic error: ${detail}`);
  }
}

export class ParseCodecErrors extends Error {
  cause: Error[] = [];

  constructor() {
    super('failed to parse codecs');
  }
}

export class UnimplementedError extends Error {
  constructor(detail: string) {
    super(`unimplemented: ${detail}`);
  }
}
