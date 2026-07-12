-- Rowhouse initial schema. Authored to match packages/db/src/schema.ts.
-- Applied with: wrangler d1 migrations apply rowhouse [--local]

CREATE TABLE users (
  id           TEXT PRIMARY KEY NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  handle       TEXT NOT NULL UNIQUE,
  avatar_url   TEXT,
  is_creator   INTEGER NOT NULL DEFAULT 0,
  pro          INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE oauth_accounts (
  provider         TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (provider, provider_user_id)
);
CREATE INDEX oauth_user_idx ON oauth_accounts (user_id);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY NOT NULL,
  secret_hash BLOB NOT NULL,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at  INTEGER NOT NULL
);
CREATE INDEX session_user_idx ON sessions (user_id);

CREATE TABLE creators (
  user_id        TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bio            TEXT,
  tone           TEXT,
  follower_count INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE films (
  slug            TEXT PRIMARY KEY NOT NULL,
  tmdb_id         INTEGER NOT NULL,
  media_type      TEXT NOT NULL,
  title           TEXT NOT NULL,
  year            INTEGER,
  overview        TEXT,
  poster_path     TEXT,
  backdrop_path   TEXT,
  director        TEXT,
  runtime_minutes INTEGER,
  season          INTEGER,
  episode         INTEGER,
  genres          TEXT NOT NULL DEFAULT '[]',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX films_tmdb_idx ON films (tmdb_id, media_type);

CREATE TABLE tracks (
  id               TEXT PRIMARY KEY NOT NULL,
  kind             TEXT NOT NULL DEFAULT 'commentary',
  film_slug        TEXT NOT NULL REFERENCES films(slug),
  creator_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  audio_key        TEXT NOT NULL,
  fingerprint_key  TEXT,
  duration_seconds REAL NOT NULL,
  platform         TEXT,
  tone             TEXT,
  spoiler_safe     INTEGER NOT NULL DEFAULT 0,
  listen_count     INTEGER NOT NULL DEFAULT 0,
  completion_count INTEGER NOT NULL DEFAULT 0,
  live_session_id  TEXT,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX tracks_film_idx ON tracks (film_slug);
CREATE INDEX tracks_creator_idx ON tracks (creator_id);
CREATE INDEX tracks_created_idx ON tracks (created_at);

CREATE TABLE reaction_markers (
  id       TEXT PRIMARY KEY NOT NULL,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  t        REAL NOT NULL,
  type     TEXT NOT NULL,
  count    INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX markers_track_idx ON reaction_markers (track_id);

CREATE TABLE chapters (
  id       TEXT PRIMARY KEY NOT NULL,
  track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  t        REAL NOT NULL,
  title    TEXT NOT NULL
);
CREATE INDEX chapters_track_idx ON chapters (track_id);

CREATE TABLE live_sessions (
  id            TEXT PRIMARY KEY NOT NULL,
  creator_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_slug     TEXT NOT NULL REFERENCES films(slug),
  title         TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled',
  mode          TEXT NOT NULL DEFAULT 'audio',
  platform      TEXT,
  scheduled_for INTEGER,
  started_at    INTEGER,
  ended_at      INTEGER,
  peak_viewers  INTEGER NOT NULL DEFAULT 0,
  track_id      TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX sessions_creator_idx ON live_sessions (creator_id);
CREATE INDEX sessions_status_idx ON live_sessions (status, scheduled_for);

CREATE TABLE follows (
  follower_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (follower_id, creator_id)
);
CREATE INDEX follows_creator_idx ON follows (creator_id);

CREATE TABLE watchlist_items (
  creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  film_slug  TEXT NOT NULL REFERENCES films(slug),
  note       TEXT,
  upvotes    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (creator_id, film_slug)
);

CREATE TABLE watchlist_votes (
  creator_id TEXT NOT NULL,
  film_slug  TEXT NOT NULL,
  voter_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (creator_id, film_slug, voter_id)
);

CREATE TABLE clips (
  id            TEXT PRIMARY KEY NOT NULL,
  track_id      TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  start_seconds REAL NOT NULL,
  end_seconds   REAL NOT NULL,
  peak_seconds  REAL NOT NULL,
  status        TEXT NOT NULL DEFAULT 'suggested',
  asset_key     TEXT,
  score         INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX clips_track_idx ON clips (track_id);
CREATE INDEX clips_status_idx ON clips (status);

CREATE TABLE push_subscriptions (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX push_user_idx ON push_subscriptions (user_id);

CREATE TABLE reports (
  id          TEXT PRIMARY KEY NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  detail      TEXT,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX reports_status_idx ON reports (status);
