/**
 * Constellation peak picking: sparse, reproducible spectral maxima that survive
 * additive noise and band-limited TV-speaker playback.
 *
 * Method: convert to dB, spectral-whiten against a per-frame moving-median noise
 * floor (this neutralises TV EQ and slowly varying room noise, the main
 * robustness step), take 2-D local maxima via a separable max filter, then cap
 * density to the strongest N peaks per second so the same peaks are selected from
 * clean and noisy audio regardless of gain.
 */

import type { Spectrogram } from './dsp.js';
import { BAND_HI_BIN, BAND_LO_BIN, FP, HOP_SECONDS } from './params.js';

export interface Peak {
  /** Frame index (time). */
  t: number;
  /** Frequency bin. */
  f: number;
  /** Whitened log-magnitude value used for ranking. */
  v: number;
}

const EPS = 1e-10;

/**
 * Per-frame spectral whitening: subtract a moving median (approximated by a
 * windowed mean over the band) so peaks are ranked relative to local background.
 * Ranking against the local floor makes the same peaks emerge from clean and
 * mic-captured audio.
 */
function whitenedDb(spec: Spectrogram): Float32Array {
  const { frames, bins, mag } = spec;
  const out = new Float32Array(frames * bins);
  const win = FP.peak.freqNeighborhood; // reuse freq neighborhood as smoothing width
  for (let t = 0; t < frames; t++) {
    const base = t * bins;
    // Running band mean (in dB) as the local floor estimate.
    for (let f = BAND_LO_BIN; f <= BAND_HI_BIN; f++) {
      const db = 20 * Math.log10((mag[base + f] ?? 0) + EPS);
      let sum = 0;
      let cnt = 0;
      const lo = Math.max(BAND_LO_BIN, f - win);
      const hi = Math.min(BAND_HI_BIN, f + win);
      for (let g = lo; g <= hi; g++) {
        sum += 20 * Math.log10((mag[base + g] ?? 0) + EPS);
        cnt++;
      }
      out[base + f] = db - sum / cnt;
    }
  }
  return out;
}

/** Separable 2-D max filter over the whitened spectrogram, band-limited. */
function localMax2d(s: Float32Array, frames: number, bins: number): Float32Array {
  const fN = FP.peak.freqNeighborhood;
  const tN = FP.peak.timeNeighborhood;
  // Pass 1: max over frequency.
  const freqMax = new Float32Array(frames * bins).fill(-Infinity);
  for (let t = 0; t < frames; t++) {
    const base = t * bins;
    for (let f = BAND_LO_BIN; f <= BAND_HI_BIN; f++) {
      let m = -Infinity;
      const lo = Math.max(BAND_LO_BIN, f - fN);
      const hi = Math.min(BAND_HI_BIN, f + fN);
      for (let g = lo; g <= hi; g++) if (s[base + g]! > m) m = s[base + g]!;
      freqMax[base + f] = m;
    }
  }
  // Pass 2: max over time of the freq-max.
  const both = new Float32Array(frames * bins).fill(-Infinity);
  for (let t = 0; t < frames; t++) {
    const lo = Math.max(0, t - tN);
    const hi = Math.min(frames - 1, t + tN);
    for (let f = BAND_LO_BIN; f <= BAND_HI_BIN; f++) {
      let m = -Infinity;
      for (let u = lo; u <= hi; u++) {
        const val = freqMax[u * bins + f]!;
        if (val > m) m = val;
      }
      both[t * bins + f] = m;
    }
  }
  return both;
}

/**
 * Pick constellation peaks from a spectrogram. Deterministic and gain-invariant.
 */
export function pickPeaks(spec: Spectrogram): Peak[] {
  const { frames, bins } = spec;
  if (frames === 0) return [];
  const whitened = whitenedDb(spec);
  const localMax = localMax2d(whitened, frames, bins);
  const { floorDb } = FP.peak;

  // Candidate local maxima above the absolute floor.
  const candidates: Peak[] = [];
  for (let t = 0; t < frames; t++) {
    const base = t * bins;
    for (let f = BAND_LO_BIN; f <= BAND_HI_BIN; f++) {
      const v = whitened[base + f]!;
      if (v < floorDb) continue;
      if (v === localMax[base + f]!) candidates.push({ t, f, v });
    }
  }

  return densityLimit(candidates, frames);
}

/**
 * Keep only the strongest `targetPeaksPerSec` peaks within each 1-second block.
 * Symmetric between map-gen and query so identical peaks survive at any gain.
 */
function densityLimit(peaks: Peak[], frames: number): Peak[] {
  const framesPerSec = FP.sampleRate / FP.hop;
  const seconds = Math.max(1, Math.ceil(frames / framesPerSec));
  const buckets: Peak[][] = Array.from({ length: seconds }, () => []);
  for (const p of peaks) {
    const sec = Math.min(seconds - 1, Math.floor((p.t * HOP_SECONDS) | 0));
    buckets[sec]!.push(p);
  }
  const kept: Peak[] = [];
  for (const bucket of buckets) {
    bucket.sort((a, b) => b.v - a.v || a.t - b.t || a.f - b.f);
    for (let i = 0; i < Math.min(bucket.length, FP.peak.targetPeaksPerSec); i++) {
      kept.push(bucket[i]!);
    }
  }
  // Sort by time then frequency for downstream landmark pairing.
  kept.sort((a, b) => a.t - b.t || a.f - b.f);
  return kept;
}
