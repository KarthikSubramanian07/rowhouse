import type { APIRoute } from 'astro';
import { buildSitemap, filmEntries, staticEntries } from '../lib/agent/sitemap';
import { apiFetch } from '../lib/runtime';

export const prerender = false;

/**
 * Rendered per request so film pages appear as soon as they have commentary.
 * If the backend is unreachable the static pages still ship, so the sitemap is
 * never empty or broken.
 */
export const GET: APIRoute = async (context) => {
  const catalog =
    (await apiFetch<{ films: { slug: string }[] }>(context, '/films/catalog'))?.films ?? [];
  return new Response(buildSitemap([...staticEntries(), ...filmEntries(catalog)]), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
