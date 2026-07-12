/**
 * Rowhouse data model (D1 / SQLite via Drizzle).
 *
 * Timestamps are unix seconds (integer). Booleans are 0/1 integers. Money isn't
 * modelled here — the core platform is free forever (spec §12); Pro/creator-subs
 * are Phase-2 seams left to the PaymentProvider adapter.
 */
import { sql } from 'drizzle-orm';
import { blob, index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const now = sql`(unixepoch())`;

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  handle: text('handle').notNull().unique(),
  avatarUrl: text('avatar_url'),
  isCreator: integer('is_creator', { mode: 'boolean' }).notNull().default(false),
  pro: integer('pro', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull().default(now),
});

/** OAuth identities (Google at launch). One row per provider identity. */
export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerUserId] }),
    index('oauth_user_idx').on(t.userId),
  ],
);

/** Sessions: id.secret token; only SHA-256(secret) is stored. See auth module. */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    secretHash: blob('secret_hash').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull().default(now),
    expiresAt: integer('expires_at').notNull(),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

/** Creator profile extends a user (spec §05 Creator page). */
export const creators = sqliteTable('creators', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  bio: text('bio'),
  tone: text('tone'),
  followerCount: integer('follower_count').notNull().default(0),
  createdAt: integer('created_at').notNull().default(now),
});

/** Films/episodes, cached from TMDB on first use. The SEO surface (spec §05). */
export const films = sqliteTable(
  'films',
  {
    slug: text('slug').primaryKey(),
    tmdbId: integer('tmdb_id').notNull(),
    mediaType: text('media_type').notNull(),
    title: text('title').notNull(),
    year: integer('year'),
    overview: text('overview'),
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    director: text('director'),
    runtimeMinutes: integer('runtime_minutes'),
    season: integer('season'),
    episode: integer('episode'),
    /** JSON array of genre names. */
    genres: text('genres', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('films_tmdb_idx').on(t.tmdbId, t.mediaType)],
);

/** Commentary tracks + mini-takes — the catalog (spec §04). */
export const tracks = sqliteTable(
  'tracks',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull().default('commentary'),
    filmSlug: text('film_slug')
      .notNull()
      .references(() => films.slug),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    /** R2 key for the COMMENTARY audio. Never film audio (legal invariant). */
    audioKey: text('audio_key').notNull(),
    /** R2 key for the fingerprint map blob (null until processed). */
    fingerprintKey: text('fingerprint_key'),
    durationSeconds: real('duration_seconds').notNull(),
    platform: text('platform'),
    tone: text('tone'),
    spoilerSafe: integer('spoiler_safe', { mode: 'boolean' }).notNull().default(false),
    listenCount: integer('listen_count').notNull().default(0),
    completionCount: integer('completion_count').notNull().default(0),
    liveSessionId: text('live_session_id'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    index('tracks_film_idx').on(t.filmSlug),
    index('tracks_creator_idx').on(t.creatorId),
    index('tracks_created_idx').on(t.createdAt),
  ],
);

/** Reaction markers baked into a track from its originating live session. */
export const reactionMarkers = sqliteTable(
  'reaction_markers',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    t: real('t').notNull(),
    type: text('type').notNull(),
    count: integer('count').notNull().default(1),
  },
  (t) => [index('markers_track_idx').on(t.trackId)],
);

/** Chapter navigation markers (spec §06 Commentary chapters). */
export const chapters = sqliteTable(
  'chapters',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    t: real('t').notNull(),
    title: text('title').notNull(),
  },
  (t) => [index('chapters_track_idx').on(t.trackId)],
);

export const liveSessions = sqliteTable(
  'live_sessions',
  {
    id: text('id').primaryKey(),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    filmSlug: text('film_slug')
      .notNull()
      .references(() => films.slug),
    title: text('title').notNull(),
    status: text('status').notNull().default('scheduled'),
    mode: text('mode').notNull().default('audio'),
    platform: text('platform'),
    scheduledFor: integer('scheduled_for'),
    startedAt: integer('started_at'),
    endedAt: integer('ended_at'),
    peakViewers: integer('peak_viewers').notNull().default(0),
    trackId: text('track_id'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    index('sessions_creator_idx').on(t.creatorId),
    index('sessions_status_idx').on(t.status, t.scheduledFor),
  ],
);

/** Asymmetric follow graph (spec §07 Following). */
export const follows = sqliteTable(
  'follows',
  {
    followerId: text('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.creatorId] }),
    index('follows_creator_idx').on(t.creatorId),
  ],
);

/** Creator watch lists (spec §04) + per-user upvotes on titles. */
export const watchlistItems = sqliteTable(
  'watchlist_items',
  {
    creatorId: text('creator_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    filmSlug: text('film_slug')
      .notNull()
      .references(() => films.slug),
    note: text('note'),
    upvotes: integer('upvotes').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [primaryKey({ columns: [t.creatorId, t.filmSlug] })],
);

export const watchlistVotes = sqliteTable(
  'watchlist_votes',
  {
    creatorId: text('creator_id').notNull(),
    filmSlug: text('film_slug').notNull(),
    voterId: text('voter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.creatorId, t.filmSlug, t.voterId] })],
);

/** Auto-generated share clips / audiograms (spec §07 Clips). */
export const clips = sqliteTable(
  'clips',
  {
    id: text('id').primaryKey(),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    startSeconds: real('start_seconds').notNull(),
    endSeconds: real('end_seconds').notNull(),
    peakSeconds: real('peak_seconds').notNull(),
    status: text('status').notNull().default('suggested'),
    assetKey: text('asset_key'),
    score: integer('score').notNull().default(0),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('clips_track_idx').on(t.trackId), index('clips_status_idx').on(t.status)],
);

/** Web Push subscriptions (spec §05 Notifications, §12). */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('push_user_idx').on(t.userId)],
);

/** Moderation queue (spec §11). Reviewed within 24h at launch scale. */
export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    reason: text('reason').notNull(),
    detail: text('detail'),
    reporterId: text('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('open'),
    createdAt: integer('created_at').notNull().default(now),
  },
  (t) => [index('reports_status_idx').on(t.status)],
);

export type UserRow = typeof users.$inferSelect;
export type TrackRow = typeof tracks.$inferSelect;
export type FilmRow = typeof films.$inferSelect;
export type LiveSessionRow = typeof liveSessions.$inferSelect;
export type ClipRow = typeof clips.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
