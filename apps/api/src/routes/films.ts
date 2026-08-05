import { linkFilmSchema, MEDIA_TYPES, type MediaType } from '@rowhouse/types';
import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { badRequest, notFound } from '../lib/http.js';
import { catalogFilms, ensureFilm, getFilmPage } from '../services/films.js';
import type { AppEnv } from '../types.js';

export const filmRoutes = new Hono<AppEnv>();

filmRoutes.get('/search', async (c) => {
  const q = c.req.query('q') ?? '';
  if (q.trim().length === 0) return c.json({ results: [] });
  const requested = c.req.query('mediaType');
  const mediaType = (MEDIA_TYPES as readonly string[]).includes(requested ?? '')
    ? (requested as MediaType)
    : undefined;
  const results = await c.get('providers').tmdb.search(q, mediaType);
  return c.json({ results });
});

filmRoutes.get('/catalog', async (c) => {
  return c.json({ films: await catalogFilms(c.get('db')) });
});

filmRoutes.get('/:slug', async (c) => {
  const page = await getFilmPage(c.get('db'), c.req.param('slug'));
  if (!page) throw notFound('film_not_found');
  return c.json(page);
});

filmRoutes.post('/link', requireAuth, async (c) => {
  const parsed = linkFilmSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_film');
  const film = await ensureFilm(c.get('db'), c.get('providers').tmdb, parsed.data);
  if (!film) throw notFound('tmdb_not_found');
  return c.json({ film });
});
