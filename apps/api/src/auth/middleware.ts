import { createDb } from '@rowhouse/db';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { buildProviders } from '../adapters/index.js';
import { forbidden, unauthorized } from '../lib/http.js';
import type { AppEnv } from '../types.js';
import { SESSION_COOKIE, validateSession } from './session.js';

/** Attaches a per-request Drizzle client, provider registry, and session. */
export const withContext = createMiddleware<AppEnv>(async (c, next) => {
  c.set('db', createDb(c.env.DB));
  c.set('providers', buildProviders(c.env));
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const result = await validateSession(c.get('db'), token, c.env.SESSION_PEPPER);
    if (result) {
      c.set('user', result.user);
      c.set('sessionId', result.sessionId);
    }
  }
  await next();
});

/** 401 unless a valid session is present. */
export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('user')) throw unauthorized();
  await next();
});

/** 403 unless the authed user is a creator. */
export const requireCreator = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) throw unauthorized();
  if (!user.isCreator) throw forbidden('creator_required');
  await next();
});
