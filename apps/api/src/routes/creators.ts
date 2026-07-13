import {
  creators,
  films,
  follows,
  liveSessions,
  tracks,
  users,
  watchlistItems,
} from '@rowhouse/db';
import { updateProfileSchema } from '@rowhouse/types';
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { badRequest, notFound } from '../lib/http.js';
import type { AppEnv } from '../types.js';

export const creatorRoutes = new Hono<AppEnv>();

/** Promote the current user to a creator. No approval step. */
creatorRoutes.post('/me/become', requireAuth, async (c) => {
  const db = c.get('db');
  const user = c.get('user')!;
  await db.update(users).set({ isCreator: true }).where(eq(users.id, user.id));
  await db.insert(creators).values({ userId: user.id }).onConflictDoNothing();
  return c.json({ ok: true });
});

creatorRoutes.patch('/me', requireAuth, async (c) => {
  const parsed = updateProfileSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_profile');
  const db = c.get('db');
  const user = c.get('user')!;
  await db.update(users).set({ displayName: parsed.data.displayName }).where(eq(users.id, user.id));
  await db
    .insert(creators)
    .values({ userId: user.id, bio: parsed.data.bio ?? null, tone: parsed.data.tone ?? null })
    .onConflictDoUpdate({
      target: creators.userId,
      set: { bio: parsed.data.bio ?? null, tone: parsed.data.tone ?? null },
    });
  return c.json({ ok: true });
});

/** Creator page (spec §05): profile, library, upcoming schedule, watch list. */
creatorRoutes.get('/:handle', async (c) => {
  const db = c.get('db');
  const handle = c.req.param('handle');
  const now = Math.floor(Date.now() / 1000);
  const profile = await db
    .select({
      user: users,
      bio: creators.bio,
      tone: creators.tone,
      followers: creators.followerCount,
    })
    .from(users)
    .leftJoin(creators, eq(creators.userId, users.id))
    .where(eq(users.handle, handle))
    .get();
  if (!profile) throw notFound('creator_not_found');

  const [library, upcoming, watch] = await Promise.all([
    db
      .select({
        id: tracks.id,
        title: tracks.title,
        filmSlug: tracks.filmSlug,
        durationSeconds: tracks.durationSeconds,
        listenCount: tracks.listenCount,
        completionCount: tracks.completionCount,
        tone: tracks.tone,
        isLiveReplay: tracks.liveSessionId,
        createdAt: tracks.createdAt,
      })
      .from(tracks)
      .where(eq(tracks.creatorId, profile.user.id))
      .orderBy(desc(tracks.createdAt))
      .all(),
    db
      .select({
        id: liveSessions.id,
        title: liveSessions.title,
        filmSlug: liveSessions.filmSlug,
        scheduledFor: liveSessions.scheduledFor,
        status: liveSessions.status,
      })
      .from(liveSessions)
      .where(
        and(eq(liveSessions.creatorId, profile.user.id), gt(liveSessions.scheduledFor, now - 3600)),
      )
      .orderBy(liveSessions.scheduledFor)
      .all(),
    db
      .select({
        filmSlug: watchlistItems.filmSlug,
        note: watchlistItems.note,
        upvotes: watchlistItems.upvotes,
        title: films.title,
        year: films.year,
      })
      .from(watchlistItems)
      .innerJoin(films, eq(films.slug, watchlistItems.filmSlug))
      .where(eq(watchlistItems.creatorId, profile.user.id))
      .orderBy(desc(watchlistItems.upvotes))
      .all(),
  ]);

  const viewer = c.get('user');
  const followsCreator = viewer
    ? Boolean(
        await db
          .select({ f: follows.followerId })
          .from(follows)
          .where(and(eq(follows.followerId, viewer.id), eq(follows.creatorId, profile.user.id)))
          .get(),
      )
    : false;

  return c.json({
    creator: {
      handle: profile.user.handle,
      name: profile.user.displayName,
      avatarUrl: profile.user.avatarUrl,
      bio: profile.bio,
      tone: profile.tone,
      followerCount: profile.followers ?? 0,
      isCreator: profile.user.isCreator,
    },
    following: followsCreator,
    library: library.map((t) => ({
      id: t.id,
      title: t.title,
      filmSlug: t.filmSlug,
      durationSeconds: t.durationSeconds,
      listenCount: t.listenCount,
      completionRate: t.listenCount > 0 ? t.completionCount / t.listenCount : 0,
      tone: t.tone,
      isLiveReplay: t.isLiveReplay != null,
      createdAt: t.createdAt,
    })),
    upcoming,
    watchlist: watch,
  });
});

creatorRoutes.post('/:handle/follow', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, c.req.param('handle')))
    .get();
  if (!target) throw notFound('creator_not_found');
  if (target.id === viewer.id) throw badRequest('cannot_follow_self');
  const res = await db
    .insert(follows)
    .values({ followerId: viewer.id, creatorId: target.id })
    .onConflictDoNothing();
  if (res.meta.changes > 0) {
    await db
      .update(creators)
      .set({ followerCount: sql`${creators.followerCount} + 1` })
      .where(eq(creators.userId, target.id));
  }
  return c.json({ following: true });
});

creatorRoutes.delete('/:handle/follow', requireAuth, async (c) => {
  const db = c.get('db');
  const viewer = c.get('user')!;
  const target = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, c.req.param('handle')))
    .get();
  if (!target) throw notFound('creator_not_found');
  const res = await db
    .delete(follows)
    .where(and(eq(follows.followerId, viewer.id), eq(follows.creatorId, target.id)));
  if (res.meta.changes > 0) {
    await db
      .update(creators)
      .set({ followerCount: sql`max(0, ${creators.followerCount} - 1)` })
      .where(eq(creators.userId, target.id));
  }
  return c.json({ following: false });
});
