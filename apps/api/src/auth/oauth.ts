/**
 * Google OAuth via Arctic v3 (the maintained successor to Lucia's OAuth layer,
 * Workers/WebCrypto-friendly). Falls back cleanly: when GOOGLE_* secrets are
 * absent the API exposes a dev-login instead (see routes/auth.ts) so the whole
 * app runs with zero secrets.
 */
import { Google } from 'arctic';
import type { Env } from '../env.js';

export interface GoogleProfile {
  providerUserId: string;
  email: string;
  name: string;
  picture: string | null;
}

export function googleConfigured(env: Env): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function googleClient(env: Env): Google {
  if (!googleConfigured(env)) throw new Error('google_oauth_not_configured');
  return new Google(
    env.GOOGLE_CLIENT_ID as string,
    env.GOOGLE_CLIENT_SECRET as string,
    `${env.PUBLIC_API_ORIGIN}/auth/google/callback`,
  );
}

export const GOOGLE_SCOPES = ['openid', 'email', 'profile'];

interface IdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** Decode the ID token. No verification needed; Arctic already validated the code exchange. */
export function decodeIdToken(idToken: string): GoogleProfile {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('bad_id_token');
  const payload = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0),
      ),
    ),
  ) as IdTokenClaims;
  return {
    providerUserId: payload.sub,
    email: payload.email ?? '',
    name: payload.name ?? payload.email?.split('@')[0] ?? 'Cinephile',
    picture: payload.picture ?? null,
  };
}
