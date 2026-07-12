# Third-party licenses

Rowhouse is MIT. Its dependencies are permissive; the two exceptions are noted and
kept safe. Nothing GPL/LGPL is linked into the app.

## Everyday dependencies — all permissive (MIT / BSD / ISC / Apache-2.0)

`hono`, `drizzle-orm`, `arctic`, `@oslojs/crypto`, `@oslojs/encoding`,
`@pushforge/builder`, `zod`, `astro`, `@astrojs/cloudflare`, `@astrojs/react`,
`react`, `react-dom`, `tailwindcss`, `tailwind-variants`, `radix-ui`,
`lucide-react` (ISC), `sonner`, `@fontsource-variable/*`, `wrangler`, `vitest`,
`@biomejs/biome`, `lefthook`. Fonts: **Fraunces**, **Geist**, **Geist Mono** — all
SIL Open Font License, self-hosted (no CDN at runtime).

## MPL-2.0 (fine as unmodified dependencies)

- **`satori`** and **`@resvg/resvg-wasm`** — used for OG cards / audiograms.
  MPL-2.0 is file-level copyleft: obligations trigger only if you modify their
  source files, which we don't. Shipped as ordinary deps.

## Deliberately avoided (GPL / LGPL)

- **Chromaprint / AcoustID (LGPL-2.1 as a whole)** — we do *not* use it. The sync
  engine is our own constellation-hash implementation with a self-written FFT, so
  there is no LGPL in the matcher. Chromaprint was a reference only.
- **FFmpeg (LGPL/GPL)** — not used. If audiogram **video** (mp4) rendering is added
  later, it must run in an isolated Container/process, never linked into a Worker,
  with attribution. Static waveform PNGs (via Satori) need no FFmpeg.

## Reference / prior art (algorithms, not code)

- A. Wang, "An Industrial-Strength Audio Search Algorithm," ISMIR 2003.
- D. Ellis, "Robust Landmark-Based Audio Fingerprinting."
- N. Q. K. Duong & F. Thudor, "Movie synchronization by audio landmark matching,"
  IEEE ICASSP 2013 — the media-sync specialization the engine follows.

Film and TV metadata, when the real provider is enabled, comes from **TMDB**; this
product uses the TMDB API but is not endorsed or certified by TMDB.
