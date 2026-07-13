# Third-party licenses

Rowhouse is MIT. Its dependencies are permissive, with two noted exceptions that
are kept safe. Nothing GPL or LGPL is linked into the app.

## Everyday dependencies (MIT / BSD / ISC / Apache-2.0)

`hono`, `drizzle-orm`, `arctic`, `@oslojs/crypto`, `@oslojs/encoding`,
`@pushforge/builder`, `zod`, `astro`, `@astrojs/cloudflare`, `@astrojs/react`,
`react`, `react-dom`, `tailwindcss`, `tailwind-variants`, `radix-ui`,
`lucide-react` (ISC), `sonner`, `@fontsource-variable/*`, `wrangler`, `vitest`,
`@biomejs/biome`, `lefthook`. The fonts Fraunces, Geist, and Geist Mono are all SIL
Open Font License and self-hosted, with no CDN at runtime.

## MPL-2.0 (fine as unmodified dependencies)

`satori` and `@resvg/resvg-wasm` render the OG cards and audiograms. MPL-2.0 is
file-level copyleft, so the obligations apply only if you modify their source
files, which this project does not. They ship as ordinary dependencies.

## Deliberately avoided (GPL / LGPL)

Chromaprint and AcoustID are LGPL-2.1 as a whole and are not used. The sync engine
is a constellation-hash implementation written here, with its own FFT, so there is
no LGPL in the matcher. Chromaprint was a reference only.

FFmpeg (LGPL/GPL) is not used. If audiogram video (mp4) rendering is added later,
it has to run in a separate container or process, never linked into a Worker, and
with attribution. The static waveform PNGs from Satori need no FFmpeg.

## Prior art (algorithms, not code)

- A. Wang, "An Industrial-Strength Audio Search Algorithm," ISMIR 2003.
- D. Ellis, "Robust Landmark-Based Audio Fingerprinting."
- N. Q. K. Duong and F. Thudor, "Movie synchronization by audio landmark
  matching," IEEE ICASSP 2013. This is the media-sync approach the engine follows.

Film and TV metadata, when the real provider is enabled, comes from TMDB. This
product uses the TMDB API but is not endorsed or certified by TMDB.
