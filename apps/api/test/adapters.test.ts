import { buildReferenceFixture, PROFILES, simulateCapture } from '@rowhouse/sync-engine/testing';
import { describe, expect, it } from 'vitest';
import { MockAiProvider } from '../src/adapters/ai.js';
import { MockSyncEngine, SelfHostedSyncEngine } from '../src/adapters/sync.js';
import { MockTmdbProvider, mockFilmBySlug } from '../src/adapters/tmdb.js';

describe('SelfHostedSyncEngine adapter', () => {
  const ref = buildReferenceFixture(90, 42);
  const engine = new SelfHostedSyncEngine();

  it('builds a valid map and matches a degraded capture back to its offset', async () => {
    const blob = await engine.buildMap(ref.pcm, ref.sampleRate);
    const check = engine.validateMap(blob);
    expect(check.ok).toBe(true);

    const cap = simulateCapture(ref.pcm, 30, 10, PROFILES.livingRoom);
    const result = await engine.match(cap, ref.sampleRate, blob);
    expect(result.locked).toBe(true);
    expect(Math.abs(result.offsetSeconds - 30)).toBeLessThan(0.25);
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
