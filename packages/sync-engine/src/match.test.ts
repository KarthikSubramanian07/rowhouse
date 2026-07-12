import { describe, expect, it } from 'vitest';
import { captureToFingerprint } from './fingerprint.js';
import { FingerprintMap } from './map.js';
import { matchPcm } from './match.js';
import { buildReferenceFixture, PROFILES, simulateCapture } from './testing/index.js';

const REF_SECONDS = 90;
const CAPTURE_SECONDS = 10;
const OFFSETS = [5, 12.5, 30, 47.3, 61, 78];

// One reference track + its map, reused across the corpus.
const ref = buildReferenceFixture(REF_SECONDS, 42);

interface CorpusRow {
  profile: string;
  offset: number;
  matched: boolean;
  locked: boolean;
  absErr: number;
  score: number;
}

describe('offset-histogram matching — fixture corpus', () => {
  const rows: CorpusRow[] = [];

  for (const [name, profile] of Object.entries(PROFILES)) {
    const tol = name === 'clean' ? 0.1 : name === 'livingRoom' ? 0.2 : 0.35;

    for (const offset of OFFSETS) {
      it(`locks to ${offset}s under "${name}" (±${tol}s)`, () => {
        const cap = simulateCapture(ref.pcm, offset, CAPTURE_SECONDS, profile);
        const res = matchPcm(cap, ref.sampleRate, ref.map);
        const absErr = Math.abs(res.offsetSeconds - offset);
        rows.push({
          profile: name,
          offset,
          matched: res.matchedLandmarks > 0,
          locked: res.locked,
          absErr,
          score: res.score,
        });
        expect(res.locked).toBe(true);
        expect(absErr).toBeLessThanOrEqual(tol);
        // positionSeconds is the live "now" = start offset + capture length.
        expect(res.positionSeconds).toBeCloseTo(offset + CAPTURE_SECONDS, 1);
      });
    }
  }

  it('reports aggregate accuracy for the summary', () => {
    // Runs last (registration order) — summarize what the per-case tests recorded.
    const total = rows.length;
    const locked = rows.filter((r) => r.locked).length;
    const meanErr = rows.reduce((s, r) => s + r.absErr, 0) / Math.max(1, total);
    const maxErr = rows.reduce((m, r) => Math.max(m, r.absErr), 0);
    // eslint-disable-next-line no-console
    console.log(
      `[sync-corpus] cases=${total} lockRate=${((locked / total) * 100).toFixed(1)}% ` +
        `meanAbsErr=${(meanErr * 1000).toFixed(1)}ms maxAbsErr=${(maxErr * 1000).toFixed(1)}ms`,
    );
    expect(locked).toBe(total);
    expect(meanErr).toBeLessThan(0.1);
  });
});

describe('rejection of non-matching audio', () => {
  it('does not lock when the capture is from a different film', () => {
    const other = buildReferenceFixture(REF_SECONDS, 999);
    const cap = simulateCapture(other.pcm, 30, CAPTURE_SECONDS, PROFILES.clean);
    const res = matchPcm(cap, other.sampleRate, ref.map);
    expect(res.locked).toBe(false);
    expect(res.confidence).toBeLessThan(0.5);
  });

  it('does not lock on silence', () => {
    const silence = new Float32Array(CAPTURE_SECONDS * 8000);
    const res = matchPcm(silence, 8000, ref.map);
    expect(res.locked).toBe(false);
  });

  it('returns no match against an empty map', () => {
    const empty = new FingerprintMap(new Int32Array(0), new Int32Array(0));
    const cap = simulateCapture(ref.pcm, 10, CAPTURE_SECONDS, PROFILES.clean);
    const res = matchPcm(cap, ref.sampleRate, empty);
    expect(res.locked).toBe(false);
    expect(res.score).toBe(0);
  });
});

describe('FingerprintMap serialization', () => {
  it('round-trips through the binary format', () => {
    const buf = ref.map.serialize();
    const restored = FingerprintMap.deserialize(buf);
    expect(restored.size).toBe(ref.map.size);
    expect(restored.version).toBe(ref.map.version);
    // A capture matched against the restored map behaves identically.
    const cap = simulateCapture(ref.pcm, 42, CAPTURE_SECONDS, PROFILES.livingRoom);
    const a = matchPcm(cap, ref.sampleRate, ref.map);
    const b = matchPcm(cap, ref.sampleRate, restored);
    expect(b.offsetSeconds).toBeCloseTo(a.offsetSeconds, 6);
    expect(b.score).toBe(a.score);
  });

  it('rejects a buffer with a bad magic number', () => {
    const bad = new ArrayBuffer(12);
    expect(() => FingerprintMap.deserialize(bad)).toThrow(/magic/);
  });
});

describe('captureToFingerprint', () => {
  it('reports the capture duration and produces landmarks', () => {
    const cap = simulateCapture(ref.pcm, 20, CAPTURE_SECONDS, PROFILES.clean);
    const fp = captureToFingerprint(cap, 8000);
    expect(fp.durationSeconds).toBeCloseTo(CAPTURE_SECONDS, 2);
    expect(fp.count).toBeGreaterThan(50);
    expect(fp.hashes.length).toBe(fp.count);
    expect(fp.times.length).toBe(fp.count);
  });
});
