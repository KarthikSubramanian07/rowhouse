import type { APIRoute } from 'astro';
import { apiOrigin } from '../../lib/runtime';

export const prerender = false;

/**
 * Same-origin API proxy. The browser calls /api/* on rowhouse-gg.pages.dev; we
 * forward to the backend Worker server-side and pipe the response (including
 * Set-Cookie) straight back, so session cookies stay first-party. Splitting a
 * clean public domain from the backend Worker this way keeps auth working
 * without third-party cookies.
 */
const HOP_BY_HOP = new Set(['content-length', 'host', 'connection', 'content-encoding']);

async function proxy(context: Parameters<APIRoute>[0]): Promise<Response> {
  const { request, params } = context;
  const path = params.path ?? '';
  const url = new URL(request.url);
  const target = `${apiOrigin(context)}/${path}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');

  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const upstream = await fetch(target, { method, headers, body, redirect: 'manual' });

  const respHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) respHeaders.append(key, value);
  });
  return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
}

export const GET: APIRoute = proxy;
export const POST: APIRoute = proxy;
export const PUT: APIRoute = proxy;
export const PATCH: APIRoute = proxy;
export const DELETE: APIRoute = proxy;
