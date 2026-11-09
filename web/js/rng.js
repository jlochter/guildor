// SplitMix64 keyed by SHA-256(seed|label). Mirrors src/guildor/rng.py.

import { sha256Bytes, utf8 } from "./sha256.js";

const MASK = (1n << 64n) - 1n;
const TWO64 = 1n << 64n;

export class Rng {
  constructor(seed, label) {
    const d = sha256Bytes(utf8(`${seed}|${label}`));
    let s = 0n;
    for (let i = 0; i < 8; i++) s = (s << 8n) | BigInt(d[i]);
    this.state = s;
  }

  nextU64() {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  }

  /** Uniform integer in [lo, hi], rejection-sampled. */
  randint(lo, hi) {
    if (hi < lo) throw new RangeError("hi < lo");
    const span = BigInt(hi - lo + 1);
    const limit = TWO64 - (TWO64 % span);
    for (;;) {
      const x = this.nextU64();
      if (x < limit) return lo + Number(x % span);
    }
  }
}
