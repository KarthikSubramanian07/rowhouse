import { chapters, clips, reactionMarkers, tracks, users } from '@rowhouse/db';
import { createTrackSchema } from '@rowhouse/types';
import { asc, eq, sql } from 'drizzle-orm';
import { type Context, Hono } from 'hono';
import { z } from 'zod';
import { requireCreator } from '../auth/middleware.js';
import { badRequest, forbidden, notFound, requireBucket } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import { rateLimit } from '../lib/ratelimit.js';
import { getFilmBySlug } from '../services/films.js';
import type { AppEnv } from '../types.js';

export const trackRoutes = new Hono<AppEnv>();

const audioKey = (id: string) => `audio/${id}.bin`;
const fpKey = (id: string) => `fp/${id}.rhf`;

/** Hard caps so a creator can't buffer/store an unbounded body. */
const MAX_AUDIO_BYTES = 120 * 1024 * 1024; // 120 MB
const MAX_FP_BYTES = 24 * 1024 * 1024; // 24 MB (a 2h film map is ~11 MB)

/**
 * Only these content types are ever stored/served for commentary audio. Anything
 * else is coerced to application/octet-stream so an attacker cannot upload a body
 * of `<script>...` labelled text/html and have the browser render it on the API
 * origin (a stored-XSS vector, since this origin holds the session cookie).
 */
const AUDIO_CONTENT_TYPES = new Set([
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/ogg',
  'audio/opus',
  'audio/webm',
  'audio/wav',
  'audio/x-m4a',
]);

function safeAudioType(ct?: string | null): string {
  const base = (ct ?? '').split(';')[0]!.trim().toLowerCase();
  return AUDIO_CONTENT_TYPES.has(base) ? base : 'application/octet-stream';
}

function declaredLength(c: Context<AppEnv>): number | null {
  const v = c.req.header('content-length');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const listenSchema = z.object({ completed: z.boolean().optional() });

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
  const len = declaredLength(c);
  if (len !== null && len > MAX_AUDIO_BYTES) throw badRequest('audio_too_large');
  if (!c.req.raw.body) throw badRequest('empty_body');
  // Stream to R2 rather than buffering the whole body in the Worker's memory.
  // The stored content type is coerced to a safe audio type (never client-chosen).
  const obj = await requireBucket(c.env.AUDIO).put(track.audioKey, c.req.raw.body, {
    httpMetadata: { contentType: safeAudioType(c.req.header('content-type')) },
  });
  return c.json({ ok: true, bytes: obj?.size ?? len ?? 0 });
});

/** Upload the fingerprint MAP blob (built client-side from reference audio). */
trackRoutes.put('/:id/fingerprint', requireCreator, async (c) => {
  const track = await ownedTrack(c, c.req.param('id'));
  const len = declaredLength(c);
  if (len !== null && len > MAX_FP_BYTES) throw badRequest('fingerprint_too_large');
  const blob = await c.req.arrayBuffer();
  if (blob.byteLength > MAX_FP_BYTES) throw badRequest('fingerprint_too_large');
  const check = c.get('providers').sync.validateMap(blob);
  if (!check.ok) throw badRequest('invalid_fingerprint_map', check.reason);
  const key = fpKey(track.id);
  await requireBucket(c.env.FINGERPRINTS).put(key, blob);
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
  const obj = await requireBucket(c.env.AUDIO).get(
    track.audioKey,
    range ? { range: parseRange(range) } : undefined,
  );
  if (!obj) throw notFound('audio_not_found');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  // Force a safe audio content type and forbid MIME sniffing, so the response can
  // never be interpreted as HTML/script on this (cookie-bearing) origin.
  headers.set('content-type', safeAudioType(headers.get('content-type')));
  headers.set('x-content-type-options', 'nosniff');
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
  const obj = await requireBucket(c.env.FINGERPRINTS).get(track.fingerprintKey);
  if (!obj) throw notFound('fingerprint_not_found');
  return new Response(obj.body, {
    headers: {
      'content-type': 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'public, max-age=604800, immutable',
    },
  });
});

/** Record a listen; `completed` feeds the completion rate. */
trackRoutes.post(
  '/:id/listen',
  rateLimit({ bucket: 'listen', limit: 30, windowSec: 60 }),
  async (c) => {
    const id = c.req.param('id');
    const parsed = listenSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) throw badRequest('invalid_listen');
    const inc = parsed.data.completed ? 1 : 0;
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
  },
);

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
