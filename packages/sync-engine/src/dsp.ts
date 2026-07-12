/**
 * Deterministic DSP front-end shared by map generation and query matching.
 *
 * Pure functions over Float32Array — no Web Audio, no I/O — so the exact same
 * code runs in the browser (listener capture), Node (fixtures/tests) and a
 * Cloudflare Worker (creator map generation). Determinism is a hard requirement:
 * the same PCM must yield byte-identical fingerprints on every platform.
 */
import { FP, SPECTRUM_BINS } from './params.js';

/** Average interleaved or planar stereo down to mono. Mono passes through. */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const first = channels[0]!;
  if (channels.length === 1) return first;
  const out = new Float32Array(first.length);
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (const ch of channels) sum += ch[i] ?? 0;
    out[i] = sum / channels.length;
  }
  return out;
}

/**
 * Linear-interpolation resampler to FP.sampleRate. A band-limited (polyphase)
 * resampler would be marginally cleaner, but the constellation peaks we extract
 * are robust to the small aliasing this introduces, and linear interpolation is
 * trivially identical across platforms — which matters more than fidelity here.
 * Callers that already have 8 kHz PCM (e.g. OfflineAudioContext-rendered
 * captures) should pass srcRate === FP.sampleRate to skip resampling.
 */
export function resample(
  input: Float32Array,
  srcRate: number,
  dstRate = FP.sampleRate,
): Float32Array {
  if (srcRate === dstRate || input.length === 0) return input;
  const ratio = srcRate / dstRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcPos = i * ratio;
    const i0 = Math.floor(srcPos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcPos - i0;
    out[i] = (input[i0] ?? 0) * (1 - frac) + (input[i1] ?? 0) * frac;
  }
  return out;
}

/** In-place first-order pre-emphasis: y[n] = x[n] - a*x[n-1]. Returns a new array. */
export function preEmphasize(x: Float32Array, coeff = FP.preEmphasis): Float32Array {
  const out = new Float32Array(x.length);
  let prev = 0;
  for (let i = 0; i < x.length; i++) {
    const cur = x[i]!;
    out[i] = cur - coeff * prev;
    prev = cur;
  }
  return out;
}

const hannCache = new Map<number, Float64Array>();
/** Periodic Hann window of length n (cached). */
export function hann(n: number): Float64Array {
  const cached = hannCache.get(n);
  if (cached) return cached;
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  hannCache.set(n, w);
  return w;
}

/**
 * In-place iterative radix-2 Cooley–Tukey FFT. `re`/`im` are power-of-two length.
 * Self-contained (no dependency) so the whole matcher is owned and runs anywhere.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  // Butterflies with twiddle recurrence.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenR = Math.cos(ang);
    const wlenI = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let wR = 1;
      let wI = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b]!;
        const xi = im[b]!;
        const vR = xr * wR - xi * wI;
        const vI = xr * wI + xi * wR;
        const uR = re[a]!;
        const uI = im[a]!;
        re[a] = uR + vR;
        im[a] = uI + vI;
        re[b] = uR - vR;
        im[b] = uI - vI;
        const nwR = wR * wlenR - wI * wlenI;
        wI = wR * wlenI + wI * wlenR;
        wR = nwR;
      }
    }
  }
}

/**
 * Framed magnitude spectrogram. Input is mono PCM already at FP.sampleRate.
 * Returns { frames, bins, mag } where mag is a flat Float32Array of
 * frames*bins magnitudes (bins = nfft/2 + 1).
 */
export interface Spectrogram {
  frames: number;
  bins: number;
  /** Flat [frame * bins + bin] magnitude. */
  mag: Float32Array;
}

export function spectrogram(pcm8k: Float32Array): Spectrogram {
  const { nfft, hop } = FP;
  const bins = SPECTRUM_BINS;
  const win = hann(nfft);
  if (pcm8k.length < nfft) {
    return { frames: 0, bins, mag: new Float32Array(0) };
  }
  const frames = 1 + Math.floor((pcm8k.length - nfft) / hop);
  const mag = new Float32Array(frames * bins);
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  for (let t = 0; t < frames; t++) {
    const start = t * hop;
    for (let i = 0; i < nfft; i++) {
      re[i] = (pcm8k[start + i] ?? 0) * win[i]!;
      im[i] = 0;
    }
    fftInPlace(re, im);
    const base = t * bins;
    for (let f = 0; f < bins; f++) {
      const r = re[f]!;
      const im2 = im[f]!;
      mag[base + f] = Math.sqrt(r * r + im2 * im2);
    }
  }
  return { frames, bins, mag };
}
