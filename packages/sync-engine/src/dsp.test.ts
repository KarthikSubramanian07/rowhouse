import { describe, expect, it } from 'vitest';
import { fftInPlace, preEmphasize, resample, spectrogram, toMono } from './dsp.js';

/** Naive O(n^2) DFT magnitude for cross-checking the FFT. */
function naiveDftMag(x: number[]): number[] {
  const n = x.length;
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    let re = 0;
    let im = 0;
    for (let t = 0; t < n; t++) {
      const ang = (-2 * Math.PI * k * t) / n;
      re += x[t]! * Math.cos(ang);
      im += x[t]! * Math.sin(ang);
    }
    out.push(Math.sqrt(re * re + im * im));
  }
  return out;
}

describe('fftInPlace', () => {
  it('matches a naive DFT for a known signal', () => {
    const input = [1, 2, 3, 4, 4, 3, 2, 1];
    const re = Float64Array.from(input);
    const im = new Float64Array(8);
    fftInPlace(re, im);
    const expected = naiveDftMag(input);
    for (let k = 0; k < 8; k++) {
      const mag = Math.sqrt(re[k]! ** 2 + im[k]! ** 2);
      expect(mag).toBeCloseTo(expected[k]!, 5);
    }
  });

  it('recovers a pure tone at the right bin', () => {
    const n = 1024;
    const bin = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.sin((2 * Math.PI * bin * i) / n);
    fftInPlace(re, im);
    let peakBin = 0;
    let peak = -1;
    for (let k = 0; k < n / 2; k++) {
      const m = Math.sqrt(re[k]! ** 2 + im[k]! ** 2);
      if (m > peak) {
        peak = m;
        peakBin = k;
      }
    }
    expect(peakBin).toBe(bin);
  });
});

describe('front-end helpers', () => {
  it('averages stereo to mono', () => {
    const l = new Float32Array([1, 0, -1]);
    const r = new Float32Array([0, 1, 1]);
    expect(Array.from(toMono([l, r]))).toEqual([0.5, 0.5, 0]);
  });

  it('resample is identity when rates match', () => {
    const x = new Float32Array([1, 2, 3]);
    expect(resample(x, 8000, 8000)).toBe(x);
  });

  it('resample halves length when downsampling 2:1', () => {
    const x = new Float32Array(16000);
    const y = resample(x, 16000, 8000);
    expect(y.length).toBe(8000);
  });

  it('pre-emphasis is a first-order difference', () => {
    const x = new Float32Array([1, 1, 1]);
    const y = preEmphasize(x, 0.97);
    expect(y[0]).toBeCloseTo(1, 5);
    expect(y[1]).toBeCloseTo(0.03, 5);
  });

  it('spectrogram produces the expected number of frames', () => {
    const x = new Float32Array(8000); // 1s @ 8k
    const spec = spectrogram(x);
    // frames = 1 + floor((8000 - 1024)/256)
    expect(spec.frames).toBe(1 + Math.floor((8000 - 1024) / 256));
    expect(spec.bins).toBe(513);
  });
});
