export class BitReader {
  private data: Uint8Array;
  private byteOffset = 0;
  private bitOffset = 0;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  readBits(numBits: number): number {
    let value = 0;
    for (let i = 0; i < numBits; i++) {
      const bit = (this.data[this.byteOffset] >> (7 - this.bitOffset)) & 1;
      value = (value << 1) | bit;
      this.bitOffset++;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
    }
    return value;
  }

  skipBits(numBits: number): void {
    this.bitOffset += numBits;
    while (this.bitOffset >= 8) {
      this.bitOffset -= 8;
      this.byteOffset++;
    }
  }

  hasData(): boolean {
    return this.byteOffset < this.data.length;
  }

  getRemainingBytes(): Uint8Array {
    return this.data.slice(this.byteOffset);
  }
}
