/**
 * Coarse fixed-window rate limiting backed by the CONFIG KV namespace.
 *
 * This is a cheap abuse brake for state-changing and unauthenticated endpoints,
 * not a hard quota: KV is eventually consistent across locations and the
 * read-increment-write is not atomic, so a determined attacker spread across
 * colos can exceed the limit somewhat. For strict per-key limits a Durable
 * Object counter would be needed. For login/report/listen spam this is enough,
 * and it stays within the free tier.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types.js';
import { tooMany } from './http.js';

export interface RateLimitOptions {
  /** Distinct bucket name so different endpoints don't share a counter. */
  bucket: string;
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /** Optional key override; defaults to the client IP. */
  key?: (c: Parameters<MiddlewareHandler<AppEnv>>[0]) => string;
}

export function rateLimit(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const who = opts.key?.(c) ?? c.req.header('cf-connecting-ip') ?? 'local';
    const window = Math.floor(Date.now() / 1000 / opts.windowSec);
    const k = `rl:${opts.bucket}:${who}:${window}`;
    const current = Number((await c.env.CONFIG.get(k)) ?? '0');
    if (current >= opts.limit) throw tooMany('Too many requests. Please slow down.');
    await c.env.CONFIG.put(k, String(current + 1), {
      expirationTtl: Math.max(60, opts.windowSec * 2),
    });
    await next();
  };
}
