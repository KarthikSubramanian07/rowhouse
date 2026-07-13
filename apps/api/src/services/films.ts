import type { Database } from '@rowhouse/db';
import { films, tracks, users } from '@rowhouse/db';
import type { Film, MediaType } from '@rowhouse/types';
import { desc, eq, sql } from 'drizzle-orm';
import type { TmdbProvider } from '../adapters/index.js';
import { mockFilmBySlug } from '../adapters/tmdb.js';

type FilmColumns = Omit<typeof films.$inferSelect, 'createdAt'>;

function rowToFilm(r: FilmColumns): Film {
  return {
    slug: r.slug,
    tmdbId: r.tmdbId,
    mediaType: r.mediaType as MediaType,
    title: r.title,
    year: r.year,
    overview: r.overview,
    posterPath: r.posterPath,
    backdropPath: r.backdropPath,
    director: r.director,
    runtimeMinutes: r.runtimeMinutes,
    season: r.season,
    episode: r.episode,
    genres: r.genres,
  };
}

async function insertFilm(db: Database, film: Film): Promise<void> {
  await db
    .insert(films)
    .values({ ...film, genres: film.genres })
    .onConflictDoNothing();
}

/** Ensure a film row exists (cache from TMDB or the mock catalog). */
export async function ensureFilm(
  db: Database,
  tmdb: TmdbProvider,
  input: {
    tmdbId: number;
    mediaType: MediaType;
    season?: number | undefined;
    episode?: number | undefined;
  },
): Promise<Film | null> {
  const resolved = await tmdb.getByTmdb(input.tmdbId, input.mediaType, input.season, input.episode);
  if (!resolved) return null;
  await insertFilm(db, resolved);
  return resolved;
}

/** Look up a film by slug: DB first, then the curated mock catalog (lazy insert). */
export async function getFilmBySlug(db: Database, slug: string): Promise<Film | null> {
  const row = await db.select().from(films).where(eq(films.slug, slug)).get();
  if (row) return rowToFilm(row);
  const mock = mockFilmBySlug(slug);
  if (mock) {
    await insertFilm(db, mock);
    return mock;
  }
  return null;
}

export interface TrackListItem {
  id: string;
  kind: string;
  title: string;
  creatorHandle: string;
  creatorName: string;
  durationSeconds: number;
  listenCount: number;
  completionRate: number;
  tone: string | null;
  spoilerSafe: boolean;
  isLiveReplay: boolean;
  createdAt: number;
}

export async function tracksForFilm(db: Database, slug: string): Promise<TrackListItem[]> {
  const rows = await db
    .select({
      id: tracks.id,
      kind: tracks.kind,
      title: tracks.title,
      handle: users.handle,
      name: users.displayName,
      durationSeconds: tracks.durationSeconds,
      listenCount: tracks.listenCount,
      completionCount: tracks.completionCount,
      tone: tracks.tone,
      spoilerSafe: tracks.spoilerSafe,
      liveSessionId: tracks.liveSessionId,
      createdAt: tracks.createdAt,
    })
    .from(tracks)
    .innerJoin(users, eq(users.id, tracks.creatorId))
    .where(eq(tracks.filmSlug, slug))
    .orderBy(desc(tracks.listenCount), desc(tracks.createdAt))
    .all();

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    creatorHandle: r.handle,
    creatorName: r.name,
    durationSeconds: r.durationSeconds,
    listenCount: r.listenCount,
    completionRate: r.listenCount > 0 ? r.completionCount / r.listenCount : 0,
    tone: r.tone,
    spoilerSafe: r.spoilerSafe,
    isLiveReplay: r.liveSessionId != null,
    createdAt: r.createdAt,
  }));
}

export interface FilmPage {
  film: Film;
  tracks: TrackListItem[];
  creatorCount: number;
}

export async function getFilmPage(db: Database, slug: string): Promise<FilmPage | null> {
  const film = await getFilmBySlug(db, slug);
  if (!film) return null;
  const list = await tracksForFilm(db, slug);
  const creatorCount = new Set(list.map((t) => t.creatorHandle)).size;
  return { film, tracks: list, creatorCount };
}

/** All films that have at least one track. Backs the discovery and catalog surface. */
export async function catalogFilms(
  db: Database,
  limit = 60,
): Promise<(Film & { trackCount: number })[]> {
  const rows = await db
    .select({
      slug: films.slug,
      tmdbId: films.tmdbId,
      mediaType: films.mediaType,
      title: films.title,
      year: films.year,
      overview: films.overview,
      posterPath: films.posterPath,
      backdropPath: films.backdropPath,
      director: films.director,
      runtimeMinutes: films.runtimeMinutes,
      season: films.season,
      episode: films.episode,
      genres: films.genres,
      trackCount: sql<number>`count(${tracks.id})`,
    })
    .from(films)
    .leftJoin(tracks, eq(tracks.filmSlug, films.slug))
    .groupBy(films.slug)
    .orderBy(desc(sql`count(${tracks.id})`))
    .limit(limit)
    .all();
  return rows.map((r) => ({ ...rowToFilm(r), trackCount: Number(r.trackCount) }));
}
