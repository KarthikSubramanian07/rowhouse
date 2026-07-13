import { liveSessions, users } from '@rowhouse/db';
import { scheduleSessionSchema } from '@rowhouse/types';
import { asc, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { mintChatToken, verifyChatToken } from '../auth/chatToken.js';
import { requireCreator } from '../auth/middleware.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { getFilmBySlug } from '../services/films.js';
import { assembleLiveSession } from '../services/live.js';
import type { AppEnv } from '../types.js';

export const liveRoutes = new Hono<AppEnv>();

/** Schedule a live session (spec §06). The calendar drives push retention. */
liveRoutes.post('/', requireCreator, async (c) => {
  const parsed = scheduleSessionSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_session');
  const data = parsed.data;
  const db = c.get('db');
  const film = await getFilmBySlug(db, data.filmSlug);
  if (!film) throw notFound('film_not_found');
  const id = newId('lvs');
  await db.insert(liveSessions).values({
    id,
    creatorId: c.get('user')!.id,
    filmSlug: data.filmSlug,
    title: data.title,
    status: 'scheduled',
    mode: data.mode,
    platform: data.platform ?? null,
    scheduledFor: data.scheduledFor,
  });
  return c.json({ id, status: 'scheduled' });
});

/** Live now and upcoming. Feeds the home page's above-the-fold. */
liveRoutes.get('/now', async (c) => {
  const db = c.get('db');
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({
      session: liveSessions,
      handle: users.handle,
      name: users.displayName,
      avatar: users.avatarUrl,
    })
    .from(liveSessions)
    .innerJoin(users, eq(users.id, liveSessions.creatorId))
    .where(inArray(liveSessions.status, ['live', 'scheduled']))
    .orderBy(desc(liveSessions.status), asc(liveSessions.scheduledFor))
    .limit(40)
    .all();
  const live = [];
  const upcoming = [];
  for (const r of rows) {
    const item = {
      id: r.session.id,
      title: r.session.title,
      filmSlug: r.session.filmSlug,
      mode: r.session.mode,
      creatorHandle: r.handle,
      creatorName: r.name,
      avatarUrl: r.avatar,
      scheduledFor: r.session.scheduledFor,
      startedAt: r.session.startedAt,
    };
    if (r.session.status === 'live') live.push(item);
    else if ((r.session.scheduledFor ?? 0) >= now - 3600) upcoming.push(item);
  }
  return c.json({ live, upcoming });
});

liveRoutes.get('/:id', async (c) => {
  const row = await c
    .get('db')
    .select({
      session: liveSessions,
      handle: users.handle,
      name: users.displayName,
      avatar: users.avatarUrl,
    })
    .from(liveSessions)
    .innerJoin(users, eq(users.id, liveSessions.creatorId))
    .where(eq(liveSessions.id, c.req.param('id')))
    .get();
  if (!row) throw notFound('session_not_found');
  const film = await getFilmBySlug(c.get('db'), row.session.filmSlug);
  return c.json({
    session: {
      id: row.session.id,
      title: row.session.title,
      status: row.session.status,
      mode: row.session.mode,
      filmSlug: row.session.filmSlug,
      scheduledFor: row.session.scheduledFor,
      startedAt: row.session.startedAt,
      endedAt: row.session.endedAt,
      peakViewers: row.session.peakViewers,
      trackId: row.session.trackId,
      platform: row.session.platform,
    },
    creator: { handle: row.handle, name: row.name, avatarUrl: row.avatar },
    film,
    wsUrl: `${c.env.PUBLIC_API_ORIGIN.replace(/^http/, 'ws')}/live/${row.session.id}/ws`,
  });
});

/**
 * Mint a short-lived WS token over the first-party /api proxy so the browser can
 * prove identity on the cross-origin Worker WebSocket (cookies are not sent there).
 */
liveRoutes.post('/:id/ws-token', async (c) => {
  const id = c.req.param('id');
  const row = await c.get('db').select().from(liveSessions).where(eq(liveSessions.id, id)).get();
  if (!row) throw notFound('session_not_found');
  const user = c.get('user');
  const token = await mintChatToken(c.env, {
    sid: id,
    uid: user?.id ?? null,
    name: user?.displayName?.trim() || `guest-${crypto.randomUUID().slice(0, 8)}`,
    // Guests may react/watch; only signed-in users may send chat text.
    chat: Boolean(user),
  });
  return c.json({ token, chat: Boolean(user) });
});

async function ownSession(c: import('hono').Context<AppEnv>, id: string) {
  const s = await c.get('db').select().from(liveSessions).where(eq(liveSessions.id, id)).get();
  if (!s) throw notFound('session_not_found');
  if (s.creatorId !== c.get('user')?.id) throw forbidden('not_your_session');
  return s;
}

liveRoutes.post('/:id/start', requireCreator, async (c) => {
  const s = await ownSession(c, c.req.param('id'));
  if (s.status === 'live') return c.json({ status: 'live', room: null, already: true });
  if (s.status !== 'scheduled')
    throw conflict('invalid_transition', `Cannot start a session in status "${s.status}".`);
  const room = await c.get('providers').stream.createRoom(s.id, s.mode as 'audio' | 'video');
  await c
    .get('db')
    .update(liveSessions)
    .set({ status: 'live', startedAt: Math.floor(Date.now() / 1000) })
    .where(eq(liveSessions.id, s.id));
  await c.env.JOBS.send({ type: 'notify_live', liveSessionId: s.id });
  return c.json({ status: 'live', room });
});

/** End the session, then assemble the async track with reactions preserved. */
liveRoutes.post('/:id/end', requireCreator, async (c) => {
  const s = await ownSession(c, c.req.param('id'));
  if (s.status === 'ended') {
    return c.json({
      trackId: s.trackId,
      already: true,
      peakViewers: s.peakViewers,
    });
  }
  if (s.status !== 'live')
    throw conflict('invalid_transition', `Cannot end a session in status "${s.status}".`);
  await c
    .get('db')
    .update(liveSessions)
    .set({ endedAt: Math.floor(Date.now() / 1000) })
    .where(eq(liveSessions.id, s.id));
  const result = await assembleLiveSession(c.get('db'), c.get('providers'), c.env, s.id);
  await c.env.JOBS.send({ type: 'detect_clips', trackId: result.trackId });
  return c.json(result);
});

/** Live chat and reaction WebSocket, forwarded to the ChatRoom Durable Object. */
liveRoutes.get('/:id/ws', async (c) => {
  if (c.req.header('upgrade') !== 'websocket') throw badRequest('expected_websocket');
  const id = c.req.param('id');
  const incoming = new URL(c.req.url);
  const token = incoming.searchParams.get('token');
  if (!token) throw badRequest('missing_chat_token', 'Mint a token via POST /live/:id/ws-token.');

  const claims = await verifyChatToken(c.env, token, id);
  if (!claims) throw forbidden('invalid_chat_token');

  const url = new URL('https://do/ws');
  if (claims.uid) url.searchParams.set('uid', claims.uid);
  url.searchParams.set('name', claims.name);
  if (claims.chat) url.searchParams.set('chat', '1');

  const stub = c.env.CHAT.get(c.env.CHAT.idFromName(id));
  return stub.fetch(new Request(url, c.req.raw));
});
