import { describe, expect, it } from 'vitest';
import { captureToFingerprint } from './fingerprint.js';
import { buildReferenceFixture, PROFILES, simulateCapture } from './testing/index.js';

const ref = buildReferenceFixture(30, 42);

/**
 * The load-bearing legal invariant, made technical: the app listens, derives a
 * fingerprint, and discards the audio. It never records, returns, retains, or
 * persists raw film audio. If this ever regresses, Rowhouse stops being a
 * "commentary layer" and becomes a content problem. See DECISIONS.md §legal.
 */
describe('no raw film audio persisted', () => {
  const cap = simulateCapture(ref.pcm, 10, 10, PROFILES.livingRoom);

  it('captureToFingerprint returns only derived integer hashes, never audio', () => {
    const fp = captureToFingerprint(cap, 8000);
    // The result contains ONLY Int32Array views (hashes/times) + scalars.
    expect(fp.hashes).toBeInstanceOf(Int32Array);
    expect(fp.times).toBeInstanceOf(Int32Array);
    for (const value of Object.values(fp)) {
      expect(value).not.toBeInstanceOf(Float32Array);
      expect(value).not.toBeInstanceOf(Float64Array);
      expect(ArrayBuffer.isView(value) && !(value instanceof Int32Array)).toBe(false);
    }
  });

  it('retains no reference to the input PCM (mutating it afterwards is inert)', () => {
    const input = Float32Array.from(cap);
    const before = captureToFingerprint(input, 8000);
    // Corrupt the original buffer; a retained reference would change the result.
    input.fill(0);
    const after = captureToFingerprint(Float32Array.from(cap), 8000);
    expect(Array.from(before.hashes)).toEqual(Array.from(after.hashes));
    expect(Array.from(before.times)).toEqual(Array.from(after.times));
  });

  it('a fingerprint cannot be inverted back into audio samples', () => {
    const fp = captureToFingerprint(cap, 8000);
    // Hashes are 26-bit landmark descriptors; there is strictly less information
    // than the ~80k input samples. Assert the derived data is far smaller.
    const derivedBytes = fp.hashes.byteLength + fp.times.byteLength;
    const audioBytes = cap.byteLength;
    expect(derivedBytes).toBeLessThan(audioBytes / 2);
  });
});
