/**
 * Landmark pairing and hashing.
 *
 * Each anchor peak is paired with up to `fanOut` later peaks in its target zone.
 * A pair encodes (f1, f2, dt) into a 26-bit hash. The hash is kept below 2^31 so
 * every value is a positive int32 and the sorted binary map (Int32Array) can be
 * binary-searched without unsigned-comparison hazards.
 *
 *   hash = (f1 & 0x3FF) << 16 | (f2 & 0x3FF) << 6 | (dt & 0x3F)
 *
 * Bit layout: bits 16-25 = f1 (10 bits), bits 6-15 = f2 (10 bits), bits 0-5 = dt
 * (6 bits), 26 bits total. f1/f2 are frequency bins (0 to 512, 10 bits); dt is
 * the anchor-to-target frame gap, bounded by FP.pair.maxDt = 63 (6 bits).
 */
import { FP } from './params.js';
import type { Peak } from './peaks.js';

export interface Landmark {
  /** Anchor frequency bin. */
  f1: number;
  /** Target frequency bin. */
  f2: number;
  /** Anchor-to-target time gap in frames. */
  dt: number;
  /** Anchor frame index (this landmark's time position). */
  t: number;
}

const F_MASK = 0x3ff;
const DT_MASK = 0x3f;

export function encodeHash(f1: number, f2: number, dt: number): number {
  return (((f1 & F_MASK) << 16) | ((f2 & F_MASK) << 6) | (dt & DT_MASK)) >>> 0;
}

/** Decode a hash back into its components (for debugging / tests). */
export function decodeHash(hash: number): { f1: number; f2: number; dt: number } {
  return {
    f1: (hash >>> 16) & F_MASK,
    f2: (hash >>> 6) & F_MASK,
    dt: hash & DT_MASK,
  };
}

/** Pair peaks (already sorted by time) into landmarks. */
export function makeLandmarks(peaks: Peak[]): Landmark[] {
  const { fanOut, minDt, maxDt, maxDf } = FP.pair;
  const out: Landmark[] = [];
  for (let i = 0; i < peaks.length; i++) {
    const anchor = peaks[i]!;
    let paired = 0;
    for (let j = i + 1; j < peaks.length; j++) {
      const target = peaks[j]!;
      const dt = target.t - anchor.t;
      if (dt < minDt) continue;
      if (dt > maxDt) break; // peaks sorted by time, so no further targets in zone
      if (Math.abs(target.f - anchor.f) > maxDf) continue;
      out.push({ f1: anchor.f, f2: target.f, dt, t: anchor.t });
      if (++paired >= fanOut) break;
    }
  }
  return out;
}
