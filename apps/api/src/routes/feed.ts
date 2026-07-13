import { follows, tracks, users } from '@rowhouse/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { unauthorized } from '../lib/http.js';
import { catalogFilms } from '../services/films.js';
import type { AppEnv } from '../types.js';

export const feedRoutes = new Hono<AppEnv>();

async function recentTracks(
  c: import('hono').Context<AppEnv>,
  creatorIds: string[],
  limit: number,
) {
  if (creatorIds.length === 0) return [];
  const rows = await c
    .get('db')
    .select({
      id: tracks.id,
      title: tracks.title,
      filmSlug: tracks.filmSlug,
      handle: users.handle,
      name: users.displayName,
      durationSeconds: tracks.durationSeconds,
      listenCount: tracks.listenCount,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .innerJoin(users, eq(users.id, tracks.creatorId))
    .where(inArray(tracks.creatorId, creatorIds))
    .orderBy(desc(tracks.createdAt))
    .limit(limit)
    .all();
  return rows;
}

/** Chronological home feed for a logged-in user: followed creators first. */
feedRoutes.get('/', async (c) => {
  const user = c.get('user');
  if (!user) throw unauthorized('not_authenticated');
  const db = c.get('db');
  const following = await db
    .select({ id: follows.creatorId })
    .from(follows)
    .where(eq(follows.followerId, user.id))
    .all();
  const ids = following.map((f) => f.id);
  const [followedTracks, discover] = await Promise.all([
    recentTracks(c, ids, 30),
    catalogFilms(db, 24),
  ]);
  return c.json({ followingCount: ids.length, recent: followedTracks, discover });
});

/** Logged-out discovery surface: trending commentary and the catalog. */
feedRoutes.get('/discover', async (c) => {
  const db = c.get('db');
  const trending = await db
    .select({
      id: tracks.id,
      title: tracks.title,
      filmSlug: tracks.filmSlug,
      handle: users.handle,
      name: users.displayName,
      durationSeconds: tracks.durationSeconds,
      listenCount: tracks.listenCount,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .innerJoin(users, eq(users.id, tracks.creatorId))
    .orderBy(desc(tracks.listenCount), desc(tracks.createdAt))
    .limit(24)
    .all();
  const catalog = await catalogFilms(db, 40);
  return c.json({ trending, catalog });
});
