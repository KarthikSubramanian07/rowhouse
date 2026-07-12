/**
 * Test/fixture helpers for the sync engine. Exported via `@rowhouse/sync-engine/testing`
 * so the API's mock SyncEngine adapter and integration tests can reuse the same
 * deterministic corpus.
 */
import { fingerprint } from '../fingerprint.js';
import { buildFingerprintMap, type FingerprintMap } from '../map.js';
import { FP } from '../params.js';
import { generateReference } from './signal.js';

export * from './signal.js';

export interface ReferenceFixture {
  pcm: Float32Array;
  map: FingerprintMap;
  durationSeconds: number;
  sampleRate: number;
}

/** Build a reference track + its fingerprint map in one call. */
export function buildReferenceFixture(durationSeconds: number, seed: number): ReferenceFixture {
  const pcm = generateReference(durationSeconds, seed);
  const landmarks = fingerprint(pcm, FP.sampleRate);
  const map = buildFingerprintMap(landmarks);
  return { pcm, map, durationSeconds, sampleRate: FP.sampleRate };
}
