import { generateCodeVerifier, generateState } from 'arctic';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { requireAuth } from '../auth/middleware.js';
import { decodeIdToken, GOOGLE_SCOPES, googleClient, googleConfigured } from '../auth/oauth.js';
import {
  createSession,
  invalidateSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../auth/session.js';
import type { Env } from '../env.js';
import { badRequest } from '../lib/http.js';
import { getOrCreateDevUser, upsertOAuthUser } from '../services/users.js';
import type { AppEnv } from '../types.js';

export const authRoutes = new Hono<AppEnv>();

const isSecure = (origin: string) => origin.startsWith('https://');

function allowDevLogin(env: Env): boolean {
  const origin = env.PUBLIC_API_ORIGIN;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  return env.ALLOW_DEV_LOGIN === '1';
}

authRoutes.get('/me', (c) =>
  c.json({ user: c.get('user') ?? null, google: googleConfigured(c.env) }),
);

authRoutes.get('/google', async (c) => {
  if (!googleConfigured(c.env))
    return c.redirect(`${c.env.APP_ORIGIN}/login?error=google_unavailable`);
  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = googleClient(c.env).createAuthorizationURL(state, codeVerifier, GOOGLE_SCOPES);
  const opts = {
    httpOnly: true,
    secure: isSecure(c.env.PUBLIC_API_ORIGIN),
    sameSite: 'Lax',
    path: '/',
    maxAge: 600,
  } as const;
  setCookie(c, 'g_state', state, opts);
  setCookie(c, 'g_verifier', codeVerifier, opts);
  return c.redirect(url.toString());
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  const storedState = getCookie(c, 'g_state');
  const verifier = getCookie(c, 'g_verifier');
  deleteCookie(c, 'g_state');
  deleteCookie(c, 'g_verifier');
  if (!code || !state || !storedState || state !== storedState || !verifier) {
    return c.redirect(`${c.env.APP_ORIGIN}/login?error=oauth_state`);
  }
  try {
    const tokens = await googleClient(c.env).validateAuthorizationCode(code, verifier);
    const profile = decodeIdToken(tokens.idToken());
    const user = await upsertOAuthUser(c.get('db'), 'google', profile);
    const token = await createSession(c.get('db'), user.id, c.env.SESSION_PEPPER);
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(isSecure(c.env.PUBLIC_API_ORIGIN)));
    return c.redirect(`${c.env.APP_ORIGIN}/`);
  } catch {
    return c.redirect(`${c.env.APP_ORIGIN}/login?error=oauth_failed`);
  }
});

/**
 * Zero-secret local login. Enabled only when Google OAuth is not configured AND
 * either the API origin is localhost or ALLOW_DEV_LOGIN=1 is set. This prevents
 * accidental creator/pro demo accounts on a public workers.dev deploy.
 */
authRoutes.post('/dev', async (c) => {
  if (googleConfigured(c.env))
    throw badRequest('dev_login_disabled', 'Google OAuth is configured; use it.');
  if (!allowDevLogin(c.env))
    throw badRequest(
      'dev_login_disabled',
      'Dev login is disabled outside localhost. Set ALLOW_DEV_LOGIN=1 to opt in.',
    );
  const user = await getOrCreateDevUser(c.get('db'));
  const token = await createSession(c.get('db'), user.id, c.env.SESSION_PEPPER);
  setCookie(c, SESSION_COOKIE, token, sessionCookieOptions(isSecure(c.env.PUBLIC_API_ORIGIN)));
  return c.json({ user });
});

authRoutes.post('/logout', requireAuth, async (c) => {
  const sessionId = c.get('sessionId');
  if (sessionId) await invalidateSession(c.get('db'), sessionId);
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
