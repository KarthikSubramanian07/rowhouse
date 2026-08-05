import { defineMiddleware } from 'astro:middleware';

/**
 * Security headers for every response. The Cloudflare adapter serves the site
 * through `_worker.js` (advanced mode), where Pages ignores the static `_headers`
 * file, so headers must be set here to apply to SSR routes. `_headers` still
 * covers any purely static assets. The microphone is granted to self for the
 * sync demo; script-src keeps 'unsafe-inline' for Astro's inline hydration, with
 * the JSON-LD injection vector already closed at the source (see Base.astro).
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' https: data:",
  "media-src 'self' https: blob:",
  "font-src 'self' https: data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https: wss:",
].join('; ');

export const onRequest = defineMiddleware(async (_context, next) => {
  const res = await next();
  const h = res.headers;
  h.set('Content-Security-Policy', CSP);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  h.set('Permissions-Policy', 'geolocation=(), camera=(), microphone=(self)');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  return res;
});
