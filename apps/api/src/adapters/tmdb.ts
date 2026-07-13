/**
 * Film and TV metadata provider. TMDB is free at our scale; the mock ships a
 * curated catalog so the SEO film pages and demo render fully with zero keys. Mock
 * posters are null on purpose: the UI renders a typographic poster fallback instead
 * of depending on a remote image.
 */
import type { Film, MediaType } from '@rowhouse/types';
import { filmSlug } from '@rowhouse/types';
import type { Env } from '../env.js';

export interface FilmSummary {
  slug: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  posterPath: string | null;
}

export interface TmdbProvider {
  readonly name: 'tmdb' | 'mock';
  search(query: string, mediaType?: MediaType): Promise<FilmSummary[]>;
  getByTmdb(
    tmdbId: number,
    mediaType: MediaType,
    season?: number | undefined,
    episode?: number | undefined,
  ): Promise<Film | null>;
}

// Curated mock catalog.
function film(f: Omit<Film, 'slug'> & { slug?: string }): Film {
  return {
    ...f,
    slug:
      f.slug ??
      filmSlug({ title: f.title, mediaType: f.mediaType, season: f.season, episode: f.episode }),
  };
}

export const MOCK_CATALOG: Film[] = [
  film({
    tmdbId: 1018,
    mediaType: 'movie',
    title: 'Mulholland Drive',
    year: 2001,
    overview:
      "A bright-eyed actress and an amnesiac collide in a Los Angeles that keeps folding in on itself. Lynch's dream logic as a murder mystery with no floor.",
    posterPath: null,
    backdropPath: null,
    director: 'David Lynch',
    runtimeMinutes: 147,
    season: null,
    episode: null,
    genres: ['Mystery', 'Drama', 'Thriller'],
  }),
  film({
    tmdbId: 493922,
    mediaType: 'movie',
    title: 'Hereditary',
    year: 2018,
    overview:
      'After the family matriarch dies, grief curdles into something older and more deliberate. A miniature of a house you cannot leave.',
    posterPath: null,
    backdropPath: null,
    director: 'Ari Aster',
    runtimeMinutes: 127,
    season: null,
    episode: null,
    genres: ['Horror', 'Drama', 'Mystery'],
  }),
  film({
    tmdbId: 496243,
    mediaType: 'movie',
    title: 'Parasite',
    year: 2019,
    overview:
      'One family schemes its way into another, and the basement remembers. Bong Joon-ho turns a staircase into a class system.',
    posterPath: null,
    backdropPath: null,
    director: 'Bong Joon-ho',
    runtimeMinutes: 132,
    season: null,
    episode: null,
    genres: ['Comedy', 'Thriller', 'Drama'],
  }),
  film({
    tmdbId: 843,
    mediaType: 'movie',
    title: 'There Will Be Blood',
    year: 2007,
    overview:
      'Oil, faith, and a milkshake. Daniel Plainview drills straight down into the American soul and keeps going.',
    posterPath: null,
    backdropPath: null,
    director: 'Paul Thomas Anderson',
    runtimeMinutes: 158,
    season: null,
    episode: null,
    genres: ['Drama'],
  }),
  film({
    tmdbId: 62,
    mediaType: 'movie',
    title: '2001: A Space Odyssey',
    year: 1968,
    overview:
      'From a bone thrown into the air to a star-child watching Earth. Kubrick asks what comes after us and refuses to blink.',
    posterPath: null,
    backdropPath: null,
    director: 'Stanley Kubrick',
    runtimeMinutes: 149,
    season: null,
    episode: null,
    genres: ['Science Fiction', 'Adventure'],
  }),
  film({
    tmdbId: 843906,
    mediaType: 'movie',
    title: 'In the Mood for Love',
    year: 2000,
    overview:
      'Two neighbors discover their spouses are having an affair and rehearse a love they refuse to have. Wong Kar-wai films longing as architecture.',
    posterPath: null,
    backdropPath: null,
    director: 'Wong Kar-wai',
    runtimeMinutes: 98,
    season: null,
    episode: null,
    genres: ['Drama', 'Romance'],
  }),
  film({
    tmdbId: 694,
    mediaType: 'movie',
    title: 'The Shining',
    year: 1980,
    overview:
      'A writer, a hotel, and a winter with no exits. The Overlook was always waiting for the Torrances.',
    posterPath: null,
    backdropPath: null,
    director: 'Stanley Kubrick',
    runtimeMinutes: 146,
    season: null,
    episode: null,
    genres: ['Horror', 'Thriller'],
  }),
  film({
    tmdbId: 6977,
    mediaType: 'movie',
    title: 'No Country for Old Men',
    year: 2007,
    overview:
      'A hunter finds money in the desert and a force of nature comes to collect. The Coens on fate, chance, and a coin toss.',
    posterPath: null,
    backdropPath: null,
    director: 'Joel & Ethan Coen',
    runtimeMinutes: 122,
    season: null,
    episode: null,
    genres: ['Crime', 'Drama', 'Thriller'],
  }),
  film({
    tmdbId: 1398,
    mediaType: 'tv',
    title: 'The Sopranos',
    year: 2007,
    overview:
      'Made in America. Tony orders onion rings, a bell rings over the door, and the cut to black rewired television forever.',
    posterPath: null,
    backdropPath: null,
    director: 'David Chase',
    runtimeMinutes: 55,
    season: 6,
    episode: 21,
    genres: ['Drama', 'Crime'],
  }),
  film({
    tmdbId: 1405,
    mediaType: 'tv',
    title: 'Twin Peaks',
    year: 1990,
    overview:
      'Who killed Laura Palmer? The question was always a doorway. Coffee, cherry pie, and a red room outside of time.',
    posterPath: null,
    backdropPath: null,
    director: 'David Lynch & Mark Frost',
    runtimeMinutes: 48,
    season: 1,
    episode: 1,
    genres: ['Drama', 'Mystery'],
  }),
];

const CATALOG_BY_SLUG = new Map(MOCK_CATALOG.map((f) => [f.slug, f]));

export class MockTmdbProvider implements TmdbProvider {
  readonly name = 'mock' as const;
  async search(query: string, mediaType?: MediaType): Promise<FilmSummary[]> {
    const q = query.trim().toLowerCase();
    return MOCK_CATALOG.filter(
      (f) =>
        (!mediaType || f.mediaType === mediaType) &&
        (q === '' || f.title.toLowerCase().includes(q)),
    ).map(toSummary);
  }
  async getByTmdb(
    tmdbId: number,
    mediaType: MediaType,
    season?: number | undefined,
    episode?: number | undefined,
  ): Promise<Film | null> {
    return (
      MOCK_CATALOG.find(
        (f) =>
          f.tmdbId === tmdbId &&
          f.mediaType === mediaType &&
          (season == null || f.season === season) &&
          (episode == null || f.episode === episode),
      ) ?? null
    );
  }
}

export function mockFilmBySlug(slug: string): Film | undefined {
  return CATALOG_BY_SLUG.get(slug);
}

function toSummary(f: Film): FilmSummary {
  return {
    slug: f.slug,
    tmdbId: f.tmdbId,
    mediaType: f.mediaType,
    title: f.title,
    year: f.year,
    posterPath: f.posterPath,
  };
}

/** Real TMDB provider (v4 read token). Thin fetch client with no extra dependency. */
export class TmdbApiProvider implements TmdbProvider {
  readonly name = 'tmdb' as const;
  constructor(private readonly env: Env) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`https://api.themoviedb.org/3${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const headers: Record<string, string> = { accept: 'application/json' };
    if (this.env.TMDB_READ_TOKEN) headers.authorization = `Bearer ${this.env.TMDB_READ_TOKEN}`;
    else url.searchParams.set('api_key', this.env.TMDB_API_KEY as string);
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`tmdb_${res.status}`);
    return (await res.json()) as T;
  }

  async search(query: string, mediaType: MediaType = 'movie'): Promise<FilmSummary[]> {
    const data = await this.get<{ results: TmdbSearchResult[] }>(`/search/${mediaType}`, { query });
    return data.results.slice(0, 20).map((r) => ({
      slug: filmSlug({ title: r.title ?? r.name ?? 'Untitled', mediaType }),
      tmdbId: r.id,
      mediaType,
      title: r.title ?? r.name ?? 'Untitled',
      year: yearOf(r.release_date ?? r.first_air_date),
      posterPath: r.poster_path,
    }));
  }

  async getByTmdb(
    tmdbId: number,
    mediaType: MediaType,
    season?: number | undefined,
    episode?: number | undefined,
  ): Promise<Film | null> {
    const d = await this.get<TmdbDetail>(`/${mediaType}/${tmdbId}`, {
      append_to_response: 'credits',
    });
    const director = d.credits?.crew?.find((c) => c.job === 'Director')?.name ?? null;
    return {
      slug: filmSlug({ title: d.title ?? d.name ?? 'Untitled', mediaType, season, episode }),
      tmdbId,
      mediaType,
      title: d.title ?? d.name ?? 'Untitled',
      year: yearOf(d.release_date ?? d.first_air_date),
      overview: d.overview ?? null,
      posterPath: d.poster_path,
      backdropPath: d.backdrop_path,
      director,
      runtimeMinutes: d.runtime ?? d.episode_run_time?.[0] ?? null,
      season: season ?? null,
      episode: episode ?? null,
      genres: (d.genres ?? []).map((g) => g.name),
    };
  }
}

interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path: string | null;
}
interface TmdbDetail extends TmdbSearchResult {
  overview?: string;
  backdrop_path: string | null;
  runtime?: number;
  episode_run_time?: number[];
  genres?: { id: number; name: string }[];
  credits?: { crew?: { job: string; name: string }[] };
}

function yearOf(date?: string): number | null {
  if (!date) return null;
  const y = Number.parseInt(date.slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

export function resolveTmdb(env: Env): TmdbProvider {
  return env.TMDB_READ_TOKEN || env.TMDB_API_KEY
    ? new TmdbApiProvider(env)
    : new MockTmdbProvider();
}
