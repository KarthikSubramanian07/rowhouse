import { users, watchlistItems, watchlistVotes } from '@rowhouse/db';
import { watchlistAddSchema } from '@rowhouse/types';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth, requireCreator } from '../auth/middleware.js';
import { badRequest, notFound } from '../lib/http.js';
import { getFilmBySlug } from '../services/films.js';
import type { AppEnv } from '../types.js';

export const watchlistRoutes = new Hono<AppEnv>();

/** A creator adds a film to their public watch list (spec §04). */
watchlistRoutes.post('/', requireCreator, async (c) => {
  const parsed = watchlistAddSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_watchlist_item');
  const db = c.get('db');
  const film = await getFilmBySlug(db, parsed.data.filmSlug);
  if (!film) throw notFound('film_not_found');
  await db
    .insert(watchlistItems)
    .values({
      creatorId: c.get('user')!.id,
      filmSlug: parsed.data.filmSlug,
      note: parsed.data.note ?? null,
    })
    .onConflictDoNothing();
  return c.json({ ok: true });
});

/** A follower upvotes a title on a creator's watch list. */
watchlistRoutes.post('/:handle/:filmSlug/upvote', requireAuth, async (c) => {
  const db = c.get('db');
  const voter = c.get('user')!;
  const creator = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, c.req.param('handle')))
    .get();
  if (!creator) throw notFound('creator_not_found');
  const filmSlug = c.req.param('filmSlug');
  const inserted = await db
    .insert(watchlistVotes)
    .values({ creatorId: creator.id, filmSlug, voterId: voter.id })
    .onConflictDoNothing();
  if (inserted.meta.changes > 0) {
    await db
      .update(watchlistItems)
      .set({ upvotes: sql`${watchlistItems.upvotes} + 1` })
      .where(and(eq(watchlistItems.creatorId, creator.id), eq(watchlistItems.filmSlug, filmSlug)));
  }
  return c.json({ ok: true, counted: inserted.meta.changes > 0 });
});
