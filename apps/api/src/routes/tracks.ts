import { chapters, clips, reactionMarkers, tracks, users } from '@rowhouse/db';
import { createTrackSchema } from '@rowhouse/types';
import { asc, eq, sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { requireCreator } from '../auth/middleware.js';
import { badRequest, forbidden, notFound } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { getFilmBySlug } from '../services/films.js';
import type { AppEnv } from '../types.js';

export const trackRoutes = new Hono<AppEnv>();

const audioKey = (id: string) => `audio/${id}.bin`;
const fpKey = (id: string) => `fp/${id}.rhf`;

/** Create a commentary track / mini-take. Returns upload targets. */
trackRoutes.post('/', requireCreator, async (c) => {
  const parsed = createTrackSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_track');
  const data = parsed.data;
  const db = c.get('db');
  const user = c.get('user')!;

  const film = await getFilmBySlug(db, data.filmSlug);
  if (!film) throw notFound('film_not_found');

  const id = newId('trk');
  await db.insert(tracks).values({
    id,
    kind: data.kind,
    filmSlug: data.filmSlug,
    creatorId: user.id,
    title: data.title,
    audioKey: audioKey(id),
    fingerprintKey: null,
    durationSeconds: data.durationSeconds,
    platform: data.platform ?? null,
    tone: data.tone ?? null,
    spoilerSafe: data.spoilerSafe,
    liveSessionId: data.liveSessionId ?? null,
  });
  return c.json({
    trackId: id,
    audioUploadUrl: `${c.env.PUBLIC_API_ORIGIN}/tracks/${id}/audio`,
    fingerprintUploadUrl: `${c.env.PUBLIC_API_ORIGIN}/tracks/${id}/fingerprint`,
  });
});

async function ownedTrack(c: Context<AppEnv>, id: string) {
  const track = await c.get('db').select().from(tracks).where(eq(tracks.id, id)).get();
  if (!track) throw notFound('track_not_found');
  if (track.creatorId !== c.get('user')?.id) throw forbidden('not_your_track');
  return track;
}

/** Upload the COMMENTARY audio (never film audio) to R2. */
trackRoutes.put('/:id/audio', requireCreator, async (c) => {
  const track = await ownedTrack(c, c.req.param('id'));
  const body = await c.req.arrayBuffer();
  await c.env.AUDIO.put(track.audioKey, body, {
    httpMetadata: { contentType: c.req.header('content-type') ?? 'application/octet-stream' },
  });
  return c.json({ ok: true, bytes: body.byteLength });
});

/** Upload the fingerprint MAP blob (built client-side from reference audio). */
trackRoutes.put('/:id/fingerprint', requireCreator, async (c) => {
  const track = await ownedTrack(c, c.req.param('id'));
  const blob = await c.req.arrayBuffer();
  const check = c.get('providers').sync.validateMap(blob);
  if (!check.ok) throw badRequest('invalid_fingerprint_map', check.reason);
  const key = fpKey(track.id);
  await c.env.FINGERPRINTS.put(key, blob);
  await c.get('db').update(tracks).set({ fingerprintKey: key }).where(eq(tracks.id, track.id));
  return c.json({ ok: true, entries: check.entries, version: check.version });
});

/** Track detail for the async player: track + creator + chapters + markers. */
trackRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const row = await db
    .select({
      track: tracks,
      creatorHandle: users.handle,
      creatorName: users.displayName,
      avatar: users.avatarUrl,
    })
    .from(tracks)
    .innerJoin(users, eq(users.id, tracks.creatorId))
    .where(eq(tracks.id, id))
    .get();
  if (!row) throw notFound('track_not_found');
  const [markerRows, chapterRows, film] = await Promise.all([
    db.select().from(reactionMarkers).where(eq(reactionMarkers.trackId, id)).all(),
    db.select().from(chapters).where(eq(chapters.trackId, id)).orderBy(asc(chapters.t)).all(),
    getFilmBySlug(db, row.track.filmSlug),
  ]);
  return c.json({
    track: {
      id: row.track.id,
      kind: row.track.kind,
      title: row.track.title,
      filmSlug: row.track.filmSlug,
      durationSeconds: row.track.durationSeconds,
      platform: row.track.platform,
      tone: row.track.tone,
      spoilerSafe: row.track.spoilerSafe,
      listenCount: row.track.listenCount,
      completionRate:
        row.track.listenCount > 0 ? row.track.completionCount / row.track.listenCount : 0,
      hasFingerprint: row.track.fingerprintKey != null,
      isLiveReplay: row.track.liveSessionId != null,
      createdAt: row.track.createdAt,
    },
    creator: { handle: row.creatorHandle, name: row.creatorName, avatarUrl: row.avatar },
    film,
    markers: markerRows.map((m) => ({ t: m.t, type: m.type, count: m.count })),
    chapters: chapterRows.map((ch) => ({ t: ch.t, title: ch.title })),
    audioUrl: `${c.env.PUBLIC_API_ORIGIN}/tracks/${id}/audio`,
    fingerprintUrl: row.track.fingerprintKey
      ? `${c.env.PUBLIC_API_ORIGIN}/tracks/${id}/fingerprint`
      : null,
  });
});

/** Stream the commentary audio from R2 (range-aware). */
trackRoutes.get('/:id/audio', async (c) => {
  const track = await c
    .get('db')
    .select()
    .from(tracks)
    .where(eq(tracks.id, c.req.param('id')))
    .get();
  if (!track) throw notFound('track_not_found');
  const range = c.req.header('range');
  const obj = await c.env.AUDIO.get(
    track.audioKey,
    range ? { range: parseRange(range) } : undefined,
  );
  if (!obj) throw notFound('audio_not_found');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('accept-ranges', 'bytes');
  headers.set('etag', obj.httpEtag);
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(obj.body, { status: range ? 206 : 200, headers });
});

/** Serve the fingerprint map blob for client-side matching. */
trackRoutes.get('/:id/fingerprint', async (c) => {
  const track = await c
    .get('db')
    .select()
    .from(tracks)
    .where(eq(tracks.id, c.req.param('id')))
    .get();
  if (!track?.fingerprintKey) throw notFound('fingerprint_not_found');
  const obj = await c.env.FINGERPRINTS.get(track.fingerprintKey);
  if (!obj) throw notFound('fingerprint_not_found');
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/octet-stream',
      'cache-control': 'public, max-age=604800, immutable',
    },
  });
});

/** Record a listen; `completed` feeds the completion rate. */
trackRoutes.post('/:id/listen', async (c) => {
  const id = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as { completed?: boolean };
  const inc = body.completed ? 1 : 0;
  const res = await c
    .get('db')
    .update(tracks)
    .set({
      listenCount: sql`${tracks.listenCount} + 1`,
      completionCount: sql`${tracks.completionCount} + ${inc}`,
    })
    .where(eq(tracks.id, id));
  if (res.meta.changes === 0) throw notFound('track_not_found');
  return c.json({ ok: true });
});

/** Clip candidates for a track (creator reviews/approves). */
trackRoutes.get('/:id/clips', async (c) => {
  const rows = await c
    .get('db')
    .select()
    .from(clips)
    .where(eq(clips.trackId, c.req.param('id')))
    .all();
  return c.json({ clips: rows });
});

function parseRange(header: string): { offset: number; length?: number } {
  const m = /bytes=(\d+)-(\d*)/.exec(header);
  if (!m) return { offset: 0 };
  const offset = Number.parseInt(m[1]!, 10);
  const end = m[2] ? Number.parseInt(m[2], 10) : undefined;
  return end !== undefined ? { offset, length: end - offset + 1 } : { offset };
}
