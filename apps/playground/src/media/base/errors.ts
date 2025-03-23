export class UnsupportCodecError extends Error {
  constructor(codec: string, context: string) {
    super(`codec ${codec} is not supported in ${context} context`);
  }
}

export class ParseCodecPrivateError extends Error {
  constructor(codec: string, detail: string) {
    super(`code ${codec} private parse failed: ${detail}`);
  }
}
