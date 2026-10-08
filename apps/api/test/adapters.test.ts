import { FP } from '@rowhouse/sync-engine';
import { generateReference, PROFILES, simulateCapture } from '@rowhouse/sync-engine/testing';
import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '../src/adapters/ai.js';
import { MockSyncEngine, SelfHostedSyncEngine } from '../src/adapters/sync.js';
import { MockTmdbProvider, mockFilmBySlug } from '../src/adapters/tmdb.js';

describe('SelfHostedSyncEngine adapter', () => {
  // This test checks the adapter's wiring (build, validate, match through the
  // serialized blob); match accuracy across lengths and profiles is covered in
  // packages/sync-engine. A 40s reference keeps the DSP work small, and the
  // adapter builds the only fingerprint map, so nothing is computed twice.
  const sampleRate = FP.sampleRate;
  const pcm = generateReference(40, 42);
  const engine = new SelfHostedSyncEngine();

  // Fingerprinting is CPU-bound: give it headroom so a busy machine or a
  // parallel test run can't trip vitest's 5s default.
  it('builds a valid map and matches a degraded capture back to its offset', {
    timeout: 30_000,
  }, async () => {
    const blob = await engine.buildMap(pcm, sampleRate);
    const check = engine.validateMap(blob);
    expect(check.ok).toBe(true);

    const cap = simulateCapture(pcm, 20, 10, PROFILES.livingRoom);
    const result = await engine.match(cap, sampleRate, blob);
    expect(result.locked).toBe(true);
    expect(Math.abs(result.offsetSeconds - 20)).toBeLessThan(0.25);
  });

  it('rejects a corrupt fingerprint map', () => {
    const bad = engine.validateMap(new ArrayBuffer(8));
    expect(bad.ok).toBe(false);
  });
});

describe('MockSyncEngine (test default)', () => {
  it('returns a deterministic locked offset', async () => {
    const engine = new MockSyncEngine(42);
    const res = await engine.match(new Float32Array(0), 8000, new ArrayBuffer(0));
    expect(res.locked).toBe(true);
    expect(res.offsetSeconds).toBe(42);
  });
});

describe('MockTmdbProvider', () => {
  it('searches the curated canon and resolves by slug', async () => {
    const results = await new MockTmdbProvider().search('mulholland');
    expect(results[0]?.title).toBe('Mulholland Drive');
    expect(mockFilmBySlug('the-sopranos-s06e21')?.mediaType).toBe('tv');
  });
});

describe('MockAiProvider', () => {
  const ai = new MockAiProvider();
  it('tags tone from keywords', async () => {
    expect(await ai.tagTone('a shot-by-shot analysis of the framing')).toBe('analytical');
    expect(await ai.tagTone('absolutely hilarious unhinged roast')).toBe('comedic');
  });
  it('suggests chapters seeded by reaction density', async () => {
    const reactions = Array.from({ length: 12 }, (_, i) => ({
      t: 100 + i * 0.4,
      type: 'shock' as const,
    }));
    const chapters = await ai.suggestChapters({ durationSeconds: 600, reactions });
    expect(chapters[0]?.title).toBe('Cold open');
    expect(chapters.length).toBeGreaterThan(1);
  });
});
