/**
 * SyncEngine adapter. The listener's mic capture is fingerprinted and matched
 * client-side (mic audio never leaves the device, both for privacy and as a legal
 * invariant), so the server side is mainly map generation and validation, plus an
 * optional server match for the hosted-API path.
 *
 *  SelfHostedSyncEngine: the default $0 engine (@rowhouse/sync-engine).
 *  AcrCloudSyncEngine: optional hosted accelerator (free tier ~1k/day). Stub.
 *  MockSyncEngine: deterministic fixture offsets; the test default.
 */
import {
  buildFingerprintMap,
  FingerprintMap,
  fingerprint,
  type MatchResult,
  matchPcm,
} from '@rowhouse/sync-engine';
import type { Env } from '../env.js';

export interface SyncEngine {
  readonly name: 'self-hosted' | 'acrcloud' | 'mock';
  /** Build a fingerprint-map blob from reference PCM (server/test use). */
  buildMap(referencePcm: Float32Array, sampleRate: number): Promise<ArrayBuffer>;
  /** Cheaply validate an uploaded map blob before storing it in R2. */
  validateMap(
    blob: ArrayBuffer,
  ): { ok: true; version: number; entries: number } | { ok: false; reason: string };
  /** Server-side match (client normally matches locally with the same engine). */
  match(queryPcm: Float32Array, sampleRate: number, map: ArrayBuffer): Promise<MatchResult>;
}

export class SelfHostedSyncEngine implements SyncEngine {
  readonly name = 'self-hosted' as const;

  async buildMap(referencePcm: Float32Array, sampleRate: number): Promise<ArrayBuffer> {
    const landmarks = fingerprint(referencePcm, sampleRate);
    return buildFingerprintMap(landmarks).serialize();
  }

  validateMap(blob: ArrayBuffer) {
    try {
      const map = FingerprintMap.deserialize(blob);
      if (map.size === 0) return { ok: false as const, reason: 'empty_map' };
      return { ok: true as const, version: map.version, entries: map.size };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : 'invalid_map' };
    }
  }

  async match(queryPcm: Float32Array, sampleRate: number, map: ArrayBuffer): Promise<MatchResult> {
    return matchPcm(queryPcm, sampleRate, FingerprintMap.deserialize(map));
  }
}

/**
 * ACRCloud broadcast-monitoring accelerator. Left as a stub on purpose: activating
 * it costs money per call and only serves as a faster MVP path, while the
 * self-hosted engine is the shipping product. Documented in DECISIONS.md.
 */
export class AcrCloudSyncEngine implements SyncEngine {
  readonly name = 'acrcloud' as const;
  constructor(private readonly env: Env) {}
  async buildMap(): Promise<ArrayBuffer> {
    throw new Error('acrcloud_buildmap_not_implemented');
  }
  validateMap() {
    return { ok: false as const, reason: 'acrcloud_stub' };
  }
  async match(): Promise<MatchResult> {
    void this.env;
    throw new Error('acrcloud_match_not_implemented');
  }
}

/** Deterministic mock for tests: returns a fixed, locked offset. */
export class MockSyncEngine implements SyncEngine {
  readonly name = 'mock' as const;
  constructor(private readonly fixedOffset = 42) {}
  async buildMap(): Promise<ArrayBuffer> {
    return buildFingerprintMap([]).serialize();
  }
  validateMap() {
    return { ok: true as const, version: 1, entries: 1 };
  }
  async match(_pcm: Float32Array, _sr: number, _map: ArrayBuffer): Promise<MatchResult> {
    return {
      offsetSeconds: this.fixedOffset,
      positionSeconds: this.fixedOffset + 10,
      confidence: 0.95,
      score: 60,
      locked: true,
      bestDeltaFrames: Math.round(this.fixedOffset / (256 / 8000)),
      prominence: 8,
      matchedFraction: 0.4,
      matchedLandmarks: 200,
    };
  }
}

export function resolveSyncEngine(_env: Env): SyncEngine {
  void _env;
  // ACRCloud remains a documented stub; never select it until buildMap/match work.
  return new SelfHostedSyncEngine();
}
