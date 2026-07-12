/// <reference types="../../.astro/types.d.ts" />
import type { APIContext, AstroGlobal } from 'astro';

/**
 * Resolve the backend Worker origin. The browser never calls this directly — it
 * hits same-origin /api/* which the proxy (src/pages/api/[...path].ts) forwards
 * here, piping Set-Cookie through so sessions stay first-party on pages.dev.
 */
export function apiOrigin(ctx: APIContext | AstroGlobal): string {
  const runtimeEnv = (ctx.locals as { runtime?: { env?: Record<string, string> } }).runtime?.env;
  return (
    runtimeEnv?.PUBLIC_API_ORIGIN ?? import.meta.env.PUBLIC_API_ORIGIN ?? 'http://localhost:8787'
  );
}

/** Server-side fetch to the backend, forwarding the visitor's cookies. */
export async function apiFetch<T>(
  ctx: APIContext | AstroGlobal,
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  const cookie = ctx.request.headers.get('cookie') ?? '';
  try {
    const res = await fetch(`${apiOrigin(ctx)}${path}`, {
      ...init,
      headers: { ...(init.headers ?? {}), cookie, accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
