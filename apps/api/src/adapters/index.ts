/**
 * Provider registry. One place that resolves every paid or external dependency to a
 * concrete adapter based on the current secrets, defaulting to mocks. Route handlers
 * take a `Providers` bundle so nothing reaches for env directly.
 */
import type { Env } from '../env.js';
import { type AiProvider, resolveAi } from './ai.js';
import { type PaymentProvider, resolvePayment } from './payment.js';
import { type PushProvider, resolvePush } from './push.js';
import { resolveStream, type StreamProvider } from './stream.js';
import { resolveSyncEngine, type SyncEngine } from './sync.js';
import { resolveTmdb, type TmdbProvider } from './tmdb.js';

export interface Providers {
  sync: SyncEngine;
  tmdb: TmdbProvider;
  stream: StreamProvider;
  ai: AiProvider;
  push: PushProvider;
  payment: PaymentProvider;
}

export function buildProviders(env: Env): Providers {
  return {
    sync: resolveSyncEngine(env),
    tmdb: resolveTmdb(env),
    stream: resolveStream(env),
    ai: resolveAi(env),
    push: resolvePush(env),
    payment: resolvePayment(env),
  };
}

export * from './ai.js';
export * from './payment.js';
export * from './push.js';
export * from './stream.js';
export * from './sync.js';
export * from './tmdb.js';
