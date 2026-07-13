/**
 * Offset-histogram matching.
 *
 * Each query landmark that hits the reference map votes for a relative offset
 * delta = t_ref - t_query (frames). A correct alignment makes many landmarks
 * agree on one delta, producing a sharp histogram peak; random collisions spread
 * out. The peak delta, converted to seconds, is the reference position at the
 * start of the capture. (Duong & Thudor ICASSP 2013: the 1-D projection of the
 * (t_ref, t_query) diagonal. We take the single dominant peak: one master
 * timeline, no edits.)
 */
import { captureToFingerprint, type QueryFingerprint } from './fingerprint.js';
import type { FingerprintMap } from './map.js';
import { FP, HOP_SECONDS } from './params.js';

export interface MatchResult {
  /** Reference position (s) at the start of the captured buffer. */
  offsetSeconds: number;
  /** Live position (s) now = offsetSeconds + capture duration. */
  positionSeconds: number;
  /** 0...1 heuristic confidence blending peak strength and sharpness. */
  confidence: number;
  /** Agreeing landmarks in the (smoothed) peak bin. */
  score: number;
  /** Passes the lock gate (count, prominence, and matched fraction). */
  locked: boolean;
  /** Peak offset in frames (t_ref - t_query). */
  bestDeltaFrames: number;
  /** Peak / runner-up smoothed counts: histogram sharpness. */
  prominence: number;
  /** peak count / number of query landmarks. */
  matchedFraction: number;
  /** Total number of query landmarks that hit the map at all. */
  matchedLandmarks: number;
}

const NO_MATCH: MatchResult = {
  offsetSeconds: 0,
  positionSeconds: 0,
  confidence: 0,
  score: 0,
  locked: false,
  bestDeltaFrames: 0,
  prominence: 0,
  matchedFraction: 0,
  matchedLandmarks: 0,
};

/** Match a precomputed query fingerprint against a reference map. */
export function matchQuery(query: QueryFingerprint, map: FingerprintMap): MatchResult {
  if (query.count === 0 || map.size === 0) return { ...NO_MATCH };

  // Build the offset histogram.
  const votes = new Map<number, number>();
  let matchedLandmarks = 0;
  for (let i = 0; i < query.count; i++) {
    const hash = query.hashes[i]!;
    const tq = query.times[i]!;
    const refs = map.lookup(hash);
    if (refs.length > 0) matchedLandmarks++;
    for (let r = 0; r < refs.length; r++) {
      const delta = refs[r]! - tq;
      votes.set(delta, (votes.get(delta) ?? 0) + 1);
    }
  }
  if (votes.size === 0) return { ...NO_MATCH, matchedLandmarks: 0 };

  const s = FP.match.smoothingFrames;
  const smoothed = (delta: number): number => {
    let sum = votes.get(delta) ?? 0;
    for (let k = 1; k <= s; k++) {
      sum += votes.get(delta - k) ?? 0;
      sum += votes.get(delta + k) ?? 0;
    }
    return sum;
  };

  // Peak bin.
  let bestDelta = 0;
  let bestCount = -1;
  for (const delta of votes.keys()) {
    const c = smoothed(delta);
    if (c > bestCount) {
      bestCount = c;
      bestDelta = delta;
    }
  }

  // Runner-up, excluding a guard band around the peak so its own neighbours
  // don't masquerade as a competing alignment.
  const guard = 2 * s + 1;
  let second = 0;
  for (const delta of votes.keys()) {
    if (Math.abs(delta - bestDelta) <= guard) continue;
    const c = smoothed(delta);
    if (c > second) second = c;
  }

  const prominence = bestCount / Math.max(1, second);
  const matchedFraction = bestCount / query.count;
  const offsetSeconds = bestDelta * HOP_SECONDS;
  const positionSeconds = offsetSeconds + query.durationSeconds;
  const locked =
    bestCount >= FP.match.lockCount &&
    prominence >= FP.match.lockProminence &&
    matchedFraction >= FP.match.lockMatchedFraction;

  const countScore = Math.min(1, bestCount / 40);
  const promScore = Math.min(1, prominence / 4);
  const confidence = clamp01(0.5 * countScore + 0.5 * promScore);

  return {
    offsetSeconds,
    positionSeconds,
    confidence,
    score: bestCount,
    locked,
    bestDeltaFrames: bestDelta,
    prominence,
    matchedFraction,
    matchedLandmarks,
  };
}

/** Convenience: fingerprint a raw capture and match it in one call. */
export function matchPcm(pcm: Float32Array, sampleRate: number, map: FingerprintMap): MatchResult {
  return matchQuery(captureToFingerprint(pcm, sampleRate), map);
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
