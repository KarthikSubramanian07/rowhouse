/**
 * The shared fingerprint pipeline: PCM to landmarks. Used identically for
 * creator-side map generation and listener-side query capture.
 */
import { preEmphasize, resample, spectrogram } from './dsp.js';
import { encodeHash, type Landmark, makeLandmarks } from './landmarks.js';
import { FP } from './params.js';
import { pickPeaks } from './peaks.js';

/**
 * Compute constellation landmarks for a PCM buffer.
 *
 * @param pcm        mono or already-mixed PCM samples (Float32, [-1, 1])
 * @param sampleRate source sample rate; resampled to FP.sampleRate internally
 */
export function fingerprint(pcm: Float32Array, sampleRate: number): Landmark[] {
  const resampled = resample(pcm, sampleRate, FP.sampleRate);
  const emphasized = preEmphasize(resampled);
  const spec = spectrogram(emphasized);
  const peaks = pickPeaks(spec);
  return makeLandmarks(peaks);
}

/**
 * Listener-side capture to discardable fingerprint hashes.
 *
 * Returns only the derived landmark hashes and query anchor times. The input PCM
 * is never returned or retained; the caller is expected to drop it immediately.
 * This enforces the legal invariant: the app listens, fingerprints, and discards.
 * It never records or stores film audio. See the "no raw film audio persisted"
 * test.
 */
export interface QueryFingerprint {
  /** Parallel arrays: hash[i] occurred at anchor frame time[i] (query timeline). */
  hashes: Int32Array;
  times: Int32Array;
  /** Number of landmarks (== hashes.length). */
  count: number;
  /** Duration of the analysed capture in seconds. */
  durationSeconds: number;
}

export function captureToFingerprint(pcm: Float32Array, sampleRate: number): QueryFingerprint {
  const durationSeconds = pcm.length / sampleRate;
  const landmarks = fingerprint(pcm, sampleRate);
  const hashes = new Int32Array(landmarks.length);
  const times = new Int32Array(landmarks.length);
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i]!;
    hashes[i] = encodeHash(lm.f1, lm.f2, lm.dt);
    times[i] = lm.t;
  }
  // pcm intentionally goes out of scope here; nothing retains it.
  return { hashes, times, count: landmarks.length, durationSeconds };
}
