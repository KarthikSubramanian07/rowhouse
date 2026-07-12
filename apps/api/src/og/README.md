# OG-image / audiogram module

Dynamic Open Graph share cards for Rowhouse, rendered inside the Worker.

Pipeline: `params → Satori vdom → SVG → resvg (WASM) → PNG bytes`.

Every exported function is pure-ish — `(env, params) → Promise<Uint8Array>` PNG
bytes. **Caching and HTTP serving are the caller's job.** Hash the params, look
in `env.MEDIA` (R2), render on miss, `put` the bytes, serve with a long
`Cache-Control`. This module never touches R2 itself.

## Exports (`index.ts`)

```ts
renderFilmCard(env, { title, year, creatorCount, trackCount, posterBase64? }): Promise<Uint8Array>
renderTrackCard(env, { filmTitle, trackTitle, creatorHandle, durationSeconds, tone? }): Promise<Uint8Array>
renderAudiogramCard(env, { creatorHandle, filmTitle, caption, waveform, peakX? }): Promise<Uint8Array>
```

Plus the typed errors `OgFontError`, `OgRenderError`, the `ReactionTone` type,
and the `CARD` size constant.

All return **PNG** bytes. Never WebP — resvg crashes on it, and `og:image`
wants PNG/JPEG anyway.

## The one runtime external: the font CDN

Satori needs fonts as `ArrayBuffer`s. We load static `.ttf` files from
**Fontsource via jsDelivr**:

```
https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf
https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf
https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.ttf
https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-600-normal.ttf
https://cdn.jsdelivr.net/fontsource/fonts/fraunces@latest/latin-700-normal.ttf
```

Inter is the sans/metadata face; **Fraunces** is the serif used for the big
film / track titles.

### Three-tier caching (`fonts.ts`)

1. **Module scope** — a `Map` on the warm isolate. Instant, free, per-isolate.
2. **`env.CONFIG` KV** — key `font:<slug>:<weight>` (e.g. `font:inter:600`).
   Survives cold starts and new isolates; read as `arrayBuffer`.
3. **Fontsource CDN** — hit only on a true first-ever load. The fetched buffer
   is written back to both tiers (KV write is best-effort).

### Fallback

If the CDN fetch fails **and** KV has no copy, `loadFonts` throws
`OgFontError`. The HTTP caller should catch it and serve a static fallback OG
image (or a 302 to one) rather than a 500 — text simply cannot be laid out
without a font. Once any font reaches KV, later renders are CDN-independent.

## Workers gotchas handled here

- **resvg WASM** is a *static* import (`@resvg/resvg-wasm/index_bg.wasm`) so
  wrangler precompiles it to a `WebAssembly.Module`. `initWasm` runs exactly
  once, guarded by a module-scope promise (`render.ts`). See `wasm.d.ts` for the
  ambient `*.wasm` type.
- **Satori images**: Satori silently fails to fetch remote images on Workers.
  Posters must be passed **pre-fetched as base64** (`posterBase64`, raw base64 or
  a full `data:` URL). No poster → the card renders text-only.
- **Satori text**: `embedFont: true` vectorizes glyphs into the SVG, so resvg
  needs no system fonts (`loadSystemFonts: false`).
- **vdom**: plain-object form only (no JSX). The `col`/`row` helpers in
  `vdom.ts` enforce Satori's rule that any multi-child element sets
  `display: 'flex'` + an explicit `flexDirection`.

## Design tokens (`tokens.ts`)

Dark and cinematic: bg `#0B0B0D`, surface `#131317`, border `#24242B`, text-hi
`#F2F0EC`, text-mid `#9E9EA7`, accent (cinema red) `#E0362E`, locked mint
`#3DD68C`. Reaction palette (tone pills + audiogram spike): fire `#FF7A45`,
laugh `#F5C518`, cry `#4C8DFF`, shock `#B57BFF`. Card is 1200×630.
