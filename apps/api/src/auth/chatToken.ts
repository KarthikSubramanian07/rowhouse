/**
 * Short-lived HMAC chat tokens for the live WebSocket.
 *
 * Cookies are not sent on cross-origin WS upgrades to workers.dev, so identity
 * must be proven with a token minted over the Pages /api proxy (first-party
 * cookies) and presented as `?token=` on the WS URL.
 */
import type { Env } from '../env.js';

export interface ChatClaims {
  /** Live session id (`lvs_...`). */
  sid: string;
  /** Authenticated user id, or null for guests. */
  uid: string | null;
  /** Server-assigned display name. */
  name: string;
  /** Whether this connection may send chat messages. */
  chat: boolean;
  /** Unix expiry seconds. */
  exp: number;
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Signing material for chat tokens and internal DO calls. Prefer SESSION_PEPPER. */
export function signingKey(env: Env): string {
  return env.SESSION_PEPPER?.trim() || `rowhouse-dev:${env.APP_ORIGIN}`;
}

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(sig);
}

async function hmacVerify(secret: string, payload: string, signature: string): Promise<boolean> {
  const expected = await hmacSign(secret, payload);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

export async function mintChatToken(
  env: Env,
  claims: Omit<ChatClaims, 'exp'>,
  ttlSeconds = 3600,
): Promise<string> {
  const body: ChatClaims = {
    ...claims,
    name: claims.name.slice(0, 40),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(body)));
  const sig = await hmacSign(signingKey(env), payload);
  return `${payload}.${sig}`;
}

export async function verifyChatToken(
  env: Env,
  token: string,
  sessionId: string,
): Promise<ChatClaims | null> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  if (!(await hmacVerify(signingKey(env), payload, sig))) return null;
  try {
    const json = new TextDecoder().decode(fromBase64Url(payload));
    const claims = JSON.parse(json) as ChatClaims;
    if (claims.sid !== sessionId) return null;
    if (typeof claims.exp !== 'number' || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof claims.name !== 'string' || claims.name.length === 0) return null;
    if (typeof claims.chat !== 'boolean') return null;
    return claims;
  } catch {
    return null;
  }
}

/** Header used for Worker → Durable Object internal fetches (timeline). */
export const INTERNAL_HEADER = 'x-rowhouse-internal';

export function internalAuthHeaders(env: Env): HeadersInit {
  return { [INTERNAL_HEADER]: signingKey(env) };
}

export function checkInternalAuth(env: Env, request: Request): boolean {
  return request.headers.get(INTERNAL_HEADER) === signingKey(env);
}
