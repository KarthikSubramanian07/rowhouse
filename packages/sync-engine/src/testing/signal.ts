/**
 * Deterministic synthetic-audio generators for the sync-engine fixture corpus.
 *
 * We cannot record a real living room in CI, so we synthesize dialogue-like
 * reference audio (time-varying formant partials + texture, unique at every
 * position) and then degrade a slice the way a phone mic in a noisy room
 * degrades TV-speaker playback: band-limiting, additive noise at a target SNR,
 * room reverb, and arbitrary gain. Everything is seeded → byte-reproducible.
 *
 * This proves the algorithm under controlled degradation. Real consumer-hardware
 * validation (the roadmap's true gate) still needs a device capture pass — see
 * DECISIONS.md §sync and SETUP.md.
 */
import { FP } from '../params.js';

/** mulberry32 — small deterministic PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ReferenceOptions {
  sampleRate?: number;
  /** Segment length (s) over which the partials hold before changing. */
  segmentSeconds?: number;
  /** Number of simultaneous partials. */
  partials?: number;
  /** Broadband texture level. */
  noiseFloor?: number;
}

/**
 * Generate a reference "film audio" track: unique, non-repeating spectral
 * content so every timeline position is distinguishable.
 */
export function generateReference(
  durationSeconds: number,
  seed: number,
  opts: ReferenceOptions = {},
): Float32Array {
  const sr = opts.sampleRate ?? FP.sampleRate;
  const segLen = opts.segmentSeconds ?? 0.25;
  const partials = opts.partials ?? 4;
  const noiseFloor = opts.noiseFloor ?? 0.02;
  const rand = mulberry32(seed);
  const n = Math.round(durationSeconds * sr);
  const out = new Float32Array(n);
  const segSamples = Math.max(1, Math.round(segLen * sr));
  const phases = new Float64Array(partials);
  let segFreqs: number[] = [];
  let segAmps: number[] = [];

  for (let i = 0; i < n; i++) {
    if (i % segSamples === 0) {
      segFreqs = [];
      segAmps = [];
      for (let p = 0; p < partials; p++) {
        // Partials spread across the dialogue band, unique per segment.
        segFreqs.push(220 + rand() * 1900);
        segAmps.push(0.15 + rand() * 0.5);
      }
    }
    let s = 0;
    for (let p = 0; p < partials; p++) {
      phases[p]! += (2 * Math.PI * segFreqs[p]!) / sr;
      s += segAmps[p]! * Math.sin(phases[p]!);
    }
    s += (rand() * 2 - 1) * noiseFloor;
    out[i] = s / partials;
  }
  return out;
}

export interface DegradationProfile {
  /** Output/input amplitude scale (phone AGC / distance). */
  gain: number;
  /** Target signal-to-noise ratio in dB (Infinity = clean). */
  snrDb: number;
  /** Band-pass corners (Hz) approximating TV-speaker response. null = none. */
  band: [number, number] | null;
  /** Room reverb tap gains (impulse-response approximation). Empty = dry. */
  reverbTaps: { delayMs: number; gain: number }[];
  /** PRNG seed for the additive noise. */
  noiseSeed: number;
}

export const PROFILES = {
  clean: {
    gain: 1,
    snrDb: Number.POSITIVE_INFINITY,
    band: null,
    reverbTaps: [],
    noiseSeed: 1,
  },
  livingRoom: {
    gain: 0.7,
    snrDb: 12,
    band: [250, 3000],
    reverbTaps: [
      { delayMs: 17, gain: 0.28 },
      { delayMs: 41, gain: 0.14 },
    ],
    noiseSeed: 7,
  },
  noisy: {
    gain: 0.5,
    snrDb: 5,
    band: [300, 2800],
    reverbTaps: [
      { delayMs: 13, gain: 0.32 },
      { delayMs: 29, gain: 0.2 },
      { delayMs: 53, gain: 0.12 },
    ],
    noiseSeed: 13,
  },
} as const satisfies Record<string, DegradationProfile>;

function rms(x: Float32Array): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * x[i]!;
  return Math.sqrt(s / Math.max(1, x.length));
}

/** One-pole high-pass then one-pole low-pass — crude band-pass. */
function bandPass(x: Float32Array, sr: number, lo: number, hi: number): Float32Array {
  const out = new Float32Array(x.length);
  // High-pass
  const rcHi = 1 / (2 * Math.PI * lo);
  const aHi = rcHi / (rcHi + 1 / sr);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < x.length; i++) {
    const cur = x[i]!;
    const y = aHi * (prevY + cur - prevX);
    out[i] = y;
    prevX = cur;
    prevY = y;
  }
  // Low-pass
  const rcLo = 1 / (2 * Math.PI * hi);
  const aLo = 1 / sr / (rcLo + 1 / sr);
  let ylo = 0;
  for (let i = 0; i < out.length; i++) {
    ylo += aLo * (out[i]! - ylo);
    out[i] = ylo;
  }
  return out;
}

function applyReverb(
  x: Float32Array,
  sr: number,
  taps: DegradationProfile['reverbTaps'],
): Float32Array {
  if (taps.length === 0) return x;
  const out = Float32Array.from(x);
  for (const tap of taps) {
    const d = Math.round((tap.delayMs / 1000) * sr);
    for (let i = d; i < out.length; i++) out[i] = out[i]! + tap.gain * x[i - d]!;
  }
  return out;
}

/**
 * Simulate a phone-mic capture of `durationSeconds` of the reference starting at
 * `offsetSeconds`, degraded by the given profile. Returns 8 kHz mono PCM.
 */
export function simulateCapture(
  reference: Float32Array,
  offsetSeconds: number,
  durationSeconds: number,
  profile: DegradationProfile,
  sampleRate = FP.sampleRate,
): Float32Array {
  const start = Math.round(offsetSeconds * sampleRate);
  const len = Math.round(durationSeconds * sampleRate);
  let seg = reference.subarray(start, Math.min(reference.length, start + len));
  if (profile.band) seg = bandPass(seg, sampleRate, profile.band[0], profile.band[1]);
  seg = applyReverb(seg, sampleRate, profile.reverbTaps);

  const out = new Float32Array(seg.length);
  if (Number.isFinite(profile.snrDb)) {
    const sigRms = rms(seg);
    const noiseRms = sigRms / 10 ** (profile.snrDb / 20);
    const rand = mulberry32(profile.noiseSeed + start);
    for (let i = 0; i < out.length; i++) {
      const noise = (rand() * 2 - 1) * noiseRms * Math.SQRT2;
      out[i] = (seg[i]! + noise) * profile.gain;
    }
  } else {
    for (let i = 0; i < out.length; i++) out[i] = seg[i]! * profile.gain;
  }
  return out;
}
