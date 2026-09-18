/**
 * Incremental (streaming) SHA-256 — pure TypeScript, no dependencies.
 *
 * Why not Web Crypto? `crypto.subtle.digest()` requires the entire input in one
 * buffer, which would force multi-GB files into memory. This implementation
 * digests chunk-by-chunk as files stream through the transfer engine, on both
 * the sender and receiver side, so file integrity can be verified without ever
 * holding a whole file in memory.
 */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const HEX = '0123456789abcdef';

export class Sha256 {
  private state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  private buf = new Uint8Array(64);
  private bufLen = 0;
  private totalBytes = 0;
  private w = new Uint32Array(64);
  private hexCache: string | null = null;

  update(data: Uint8Array): this {
    if (this.hexCache !== null) throw new Error('Sha256: already finalized');
    this.totalBytes += data.length;
    let pos = 0;
    if (this.bufLen > 0) {
      const take = Math.min(64 - this.bufLen, data.length);
      this.buf.set(data.subarray(0, take), this.bufLen);
      this.bufLen += take;
      pos = take;
      if (this.bufLen === 64) {
        this.compress(this.buf, 0);
        this.bufLen = 0;
      }
    }
    while (pos + 64 <= data.length) {
      this.compress(data, pos);
      pos += 64;
    }
    if (pos < data.length) {
      this.buf.set(data.subarray(pos), 0);
      this.bufLen = data.length - pos;
    }
    return this;
  }

  digestHex(): string {
    if (this.hexCache !== null) return this.hexCache;
    // Padding: 0x80, zeros until ≡ 56 (mod 64), then 8-byte big-endian bit length.
    const tail = new Uint8Array(128);
    let tailLen = 0;
    if (this.bufLen > 0) {
      tail.set(this.buf.subarray(0, this.bufLen));
      tailLen = this.bufLen;
    }
    tail[tailLen++] = 0x80;
    while (tailLen % 64 !== 56) tail[tailLen++] = 0;
    const bitLen = this.totalBytes * 8; // safe: < 2^53 for any realistic file
    const view = new DataView(tail.buffer);
    view.setUint32(tailLen, Math.floor(bitLen / 4294967296), false);
    view.setUint32(tailLen + 4, bitLen % 4294967296, false);
    tailLen += 8;
    for (let offset = 0; offset < tailLen; offset += 64) {
      this.compress(tail, offset);
    }
    let hex = '';
    for (let i = 0; i < 8; i++) {
      const word = this.state[i];
      hex += HEX[(word >>> 28) & 0xf] + HEX[(word >>> 24) & 0xf] + HEX[(word >>> 20) & 0xf] + HEX[(word >>> 16) & 0xf];
      hex += HEX[(word >>> 12) & 0xf] + HEX[(word >>> 8) & 0xf] + HEX[(word >>> 4) & 0xf] + HEX[word & 0xf];
    }
    this.hexCache = hex;
    return hex;
  }

  private compress(block: Uint8Array, offset: number): void {
    const w = this.w;
    const s = this.state;
    for (let i = 0; i < 16; i++) {
      const j = offset + i * 4;
      w[i] = ((block[j] << 24) | (block[j + 1] << 16) | (block[j + 2] << 8) | block[j + 3]) >>> 0;
    }
    for (let i = 16; i < 64; i++) {
      const x = w[i - 15];
      const y = w[i - 2];
      const s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
      const s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let a = s[0];
    let b = s[1];
    let c = s[2];
    let d = s[3];
    let e = s[4];
    let f = s[5];
    let g = s[6];
    let h = s[7];
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    s[0] = (s[0] + a) >>> 0;
    s[1] = (s[1] + b) >>> 0;
    s[2] = (s[2] + c) >>> 0;
    s[3] = (s[3] + d) >>> 0;
    s[4] = (s[4] + e) >>> 0;
    s[5] = (s[5] + f) >>> 0;
    s[6] = (s[6] + g) >>> 0;
    s[7] = (s[7] + h) >>> 0;
  }
}
