/**
 * The stored fingerprint map: hash to a sorted list of reference anchor times.
 *
 * Layout is two parallel Int32Arrays sorted by hash (then time), so a lookup is
 * a pair of binary searches for the hash's [lo, hi) range. This is 8 bytes per
 * entry with no per-entry object overhead, gzips well, and loads on the client
 * as a raw ArrayBuffer with zero parsing. A 2-hour film is roughly 1.4M entries,
 * about 11 MB (~5 MB gzipped). See DECISIONS.md §sync for the size math.
 */
import type { Landmark } from './landmarks.js';
import { encodeHash } from './landmarks.js';
import { FP } from './params.js';

const MAGIC = 0x52484631; // 'RHF1'
const HEADER_INTS = 3; // magic, version, count

export class FingerprintMap {
  readonly version: number;
  /** Sorted-ascending hashes. */
  readonly hashes: Int32Array;
  /** Reference anchor frame times, parallel to `hashes`. */
  readonly times: Int32Array;

  constructor(hashes: Int32Array, times: Int32Array, version: number = FP.version) {
    if (hashes.length !== times.length) throw new Error('hashes/times length mismatch');
    this.hashes = hashes;
    this.times = times;
    this.version = version;
  }

  get size(): number {
    return this.hashes.length;
  }

  /** Return the reference times for a hash as a subarray view (may be empty). */
  lookup(hash: number): Int32Array {
    const lo = this.lowerBound(hash);
    if (lo >= this.hashes.length || this.hashes[lo] !== hash) return EMPTY;
    const hi = this.upperBound(hash, lo);
    return this.times.subarray(lo, hi);
  }

  private lowerBound(hash: number): number {
    let lo = 0;
    let hi = this.hashes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.hashes[mid]! < hash) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private upperBound(hash: number, from: number): number {
    let lo = from;
    let hi = this.hashes.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.hashes[mid]! <= hash) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  /** Serialize to a portable little-endian ArrayBuffer (R2/KV/client transport). */
  serialize(): ArrayBuffer {
    const n = this.hashes.length;
    const buf = new ArrayBuffer((HEADER_INTS + n * 2) * 4);
    const header = new Uint32Array(buf, 0, HEADER_INTS);
    header[0] = MAGIC;
    header[1] = this.version;
    header[2] = n;
    const body = new Int32Array(buf, HEADER_INTS * 4, n * 2);
    body.set(this.hashes, 0);
    body.set(this.times, n);
    return buf;
  }

  static deserialize(buf: ArrayBuffer): FingerprintMap {
    const header = new Uint32Array(buf, 0, HEADER_INTS);
    if (header[0] !== MAGIC) throw new Error('bad fingerprint map: magic mismatch');
    const version = header[1]!;
    const n = header[2]!;
    // Copy out (subarrays on a non-8-byte-aligned offset are fine for Int32).
    const hashes = new Int32Array(buf.slice(HEADER_INTS * 4, (HEADER_INTS + n) * 4));
    const times = new Int32Array(buf.slice((HEADER_INTS + n) * 4, (HEADER_INTS + n * 2) * 4));
    return new FingerprintMap(hashes, times, version);
  }
}

const EMPTY = new Int32Array(0);

/**
 * Build a fingerprint map from reference landmarks. Sorts (hash, time) pairs by
 * hash so lookups are binary searches.
 */
export function buildFingerprintMap(landmarks: Landmark[]): FingerprintMap {
  const n = landmarks.length;
  const entries = new Array<{ h: number; t: number }>(n);
  for (let i = 0; i < n; i++) {
    const lm = landmarks[i]!;
    entries[i] = { h: encodeHash(lm.f1, lm.f2, lm.dt), t: lm.t };
  }
  entries.sort((a, b) => a.h - b.h || a.t - b.t);
  const hashes = new Int32Array(n);
  const times = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    hashes[i] = entries[i]!.h;
    times[i] = entries[i]!.t;
  }
  return new FingerprintMap(hashes, times);
}
