import { pushSubscriptions } from '@rowhouse/db';
import { pushSubscriptionSchema } from '@rowhouse/types';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { badRequest } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import type { AppEnv } from '../types.js';

export const pushRoutes = new Hono<AppEnv>();

/**
 * A push endpoint is later fetched server-side by the web-push provider, so an
 * arbitrary URL would be a blind-SSRF sink. Restrict to the real browser push
 * services over https. This is validated at subscribe time; /test only ever
 * sends to a stored (already-validated) endpoint.
 */
const PUSH_HOST_EXACT = new Set([
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);
const PUSH_HOST_SUFFIXES = ['.push.services.mozilla.com', '.notify.windows.com', '.push.apple.com'];

function isAllowedPushEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  return PUSH_HOST_EXACT.has(host) || PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s));
}

/** The client needs the VAPID public key to subscribe. */
pushRoutes.get('/vapid', (c) => c.json({ publicKey: c.env.VAPID_PUBLIC_KEY ?? null }));

pushRoutes.post('/subscribe', requireAuth, async (c) => {
  const parsed = pushSubscriptionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_subscription');
  const db = c.get('db');
  const sub = parsed.data;
  if (!isAllowedPushEndpoint(sub.endpoint)) throw badRequest('invalid_endpoint');
  await db
    .insert(pushSubscriptions)
    .values({
      id: newId('sub'),
      userId: c.get('user')!.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoNothing();
  return c.json({ ok: true, provider: c.get('providers').push.name });
});

pushRoutes.post('/test', requireAuth, async (c) => {
  const db = c.get('db');
  const sub = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, c.get('user')!.id))
    .get();
  if (!sub) throw badRequest('no_subscription');
  const result = await c.get('providers').push.send(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    {
      title: 'Rowhouse',
      body: 'Push is wired up. See you at the next live session.',
      url: c.env.APP_ORIGIN,
    },
  );
  return c.json(result);
});
