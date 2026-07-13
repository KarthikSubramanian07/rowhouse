/**
 * Worker bindings and environment. With no secrets set, the app runs entirely on
 * mock adapters (see src/adapters) and the tests pass. Real providers activate only
 * when their corresponding secrets are present.
 */
export interface Env {
  // Storage / data
  DB: D1Database;
  SESSIONS: KVNamespace;
  CONFIG: KVNamespace;
  AUDIO: R2Bucket;
  FINGERPRINTS: R2Bucket;
  MEDIA: R2Bucket;
  CHAT: DurableObjectNamespace;
  JOBS: Queue<JobMessage>;

  // Public vars
  APP_ORIGIN: string;
  PUBLIC_API_ORIGIN: string;
  VAPID_SUBJECT: string;
  TMDB_IMAGE_BASE: string;

  // Secrets. All optional; when one is absent, its adapter falls back to a mock.
  SESSION_PEPPER?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  TMDB_API_KEY?: string;
  TMDB_READ_TOKEN?: string;
  ACRCLOUD_HOST?: string;
  ACRCLOUD_KEY?: string;
  ACRCLOUD_SECRET?: string;
}

/** Queue job envelope (discriminated by `type`). */
export type JobMessage =
  | { type: 'process_fingerprint'; trackId: string }
  | { type: 'assemble_track'; liveSessionId: string }
  | { type: 'detect_clips'; trackId: string }
  | { type: 'render_clip'; clipId: string }
  | { type: 'notify_live'; liveSessionId: string };

/** Which provider each adapter resolves to, given the current secrets. */
export interface ProviderReport {
  sync: 'self-hosted' | 'acrcloud' | 'mock';
  tmdb: 'tmdb' | 'mock';
  stream: 'hundred-ms' | 'cloudflare-realtime' | 'mock';
  ai: 'anthropic' | 'mock';
  push: 'web-push' | 'mock';
  payment: 'stripe' | 'mock';
}

export function describeProviders(env: Env): ProviderReport {
  return {
    sync: env.ACRCLOUD_KEY ? 'acrcloud' : 'self-hosted',
    tmdb: env.TMDB_READ_TOKEN || env.TMDB_API_KEY ? 'tmdb' : 'mock',
    stream: 'mock',
    ai: 'mock',
    push: env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY ? 'web-push' : 'mock',
    payment: 'mock',
  };
}
