import { clips, tracks, users } from '@rowhouse/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { renderAudiogramCard, renderFilmCard, renderTrackCard } from '../og/index.js';
import { getFilmBySlug, getFilmPage } from '../services/films.js';
import type { AppEnv } from '../types.js';

export const ogRoutes = new Hono<AppEnv>();

/** Cheap deterministic hash so a card re-renders only when its inputs change. */
function hash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Deterministic pseudo-waveform for an audiogram, seeded by a string. */
function seededWaveform(seed: string, n = 68): number[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    out.push(0.2 + (s / 0x7fffffff) * 0.8);
  }
  return out;
}

async function serveCached(
  c: import('hono').Context<AppEnv>,
  key: string,
  render: () => Promise<Uint8Array>,
): Promise<Response> {
  try {
    const cached = await c.env.MEDIA.get(key);
    if (cached) {
      return new Response(cached.body, {
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=86400, immutable',
        },
      });
    }
    const png = await render();
    await c.env.MEDIA.put(key, png, { httpMetadata: { contentType: 'image/png' } });
    return new Response(png, {
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400, immutable' },
    });
  } catch {
    // Best-effort fallback: a minimal on-brand SVG (cards are non-critical).
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#0B0B0D"/><rect width="8" height="630" fill="#E0362E"/><text x="64" y="330" fill="#F2F0EC" font-family="serif" font-size="72">Rowhouse</text></svg>`;
    return new Response(svg, {
      headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=3600' },
    });
  }
}

ogRoutes.get('/film/:slug', async (c) => {
  const page = await getFilmPage(c.get('db'), c.req.param('slug'));
  if (!page) return c.notFound();
  const key = `og/film/${page.film.slug}-${hash(`${page.tracks.length}:${page.creatorCount}`)}.png`;
  return serveCached(c, key, () =>
    renderFilmCard(c.env, {
      title: page.film.title,
      year: page.film.year ?? 0,
      creatorCount: page.creatorCount,
      trackCount: page.tracks.length,
    }),
  );
});

ogRoutes.get('/track/:id', async (c) => {
  const row = await c
    .get('db')
    .select({ track: tracks, handle: users.handle })
    .from(tracks)
    .innerJoin(users, eq(users.id, tracks.creatorId))
    .where(eq(tracks.id, c.req.param('id')))
    .get();
  if (!row) return c.notFound();
  const film = await getFilmBySlug(c.get('db'), row.track.filmSlug);
  const key = `og/track/${row.track.id}.png`;
  return serveCached(c, key, () =>
    renderTrackCard(c.env, {
      filmTitle: film?.title ?? row.track.filmSlug,
      trackTitle: row.track.title,
      creatorHandle: row.handle,
      durationSeconds: row.track.durationSeconds,
      ...(row.track.tone ? { tone: row.track.tone as never } : {}),
    }),
  );
});

ogRoutes.get('/clip/:id', async (c) => {
  const clip = await c
    .get('db')
    .select()
    .from(clips)
    .where(eq(clips.id, c.req.param('id')))
    .get();
  if (!clip) return c.notFound();
  const row = await c
    .get('db')
    .select({ track: tracks, handle: users.handle })
    .from(tracks)
    .innerJoin(users, eq(users.id, tracks.creatorId))
    .where(eq(tracks.id, clip.trackId))
    .get();
  if (!row) return c.notFound();
  const film = await getFilmBySlug(c.get('db'), row.track.filmSlug);
  const dur = Math.max(1, clip.endSeconds - clip.startSeconds);
  const key = `og/clip/${clip.id}.png`;
  return serveCached(c, key, () =>
    renderAudiogramCard(c.env, {
      creatorHandle: row.handle,
      filmTitle: film?.title ?? row.track.filmSlug,
      caption: row.track.title,
      waveform: seededWaveform(clip.id),
      peakX: (clip.peakSeconds - clip.startSeconds) / dur,
    }),
  );
});
