/**
 * Font loading + caching for the OG renderer.
 *
 * Satori needs fonts as ArrayBuffers. We fetch static .ttf files from the
 * Fontsource CDN (the one runtime external of this module) and cache them in
 * two tiers so we only hit the network once per font:
 *
 *   1. module scope: survives across requests on a warm isolate (free, instant).
 *   2. env.CONFIG KV: survives cold starts and new isolates (key `font:<family>:<weight>`).
 *
 * On a cold isolate we read from KV; on a truly first-ever load we fetch the CDN
 * and write both tiers. If the CDN fetch fails and KV has nothing, we throw
 * `OgFontError` so the HTTP caller can decide how to degrade.
 */

import type { Env } from '../env.js';

/** Weights we ship. Matches Satori's numeric weight type. */
export type FontWeight = 400 | 600 | 700;

/** Font families used by the cards. */
export type FontFamily = 'Inter' | 'Fraunces';

export interface LoadedFont {
  name: FontFamily;
  data: ArrayBuffer;
  weight: FontWeight;
  style: 'normal';
}

/** Thrown when a required font cannot be loaded from CDN or KV. */
export class OgFontError extends Error {
  override readonly name = 'OgFontError';
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}

/**
 * Fontsource slugs. Fontsource serves per-weight static instances at
 *   https://cdn.jsdelivr.net/fontsource/fonts/<slug>@latest/latin-<weight>-normal.ttf
 */
const SLUG: Record<FontFamily, string> = {
  Inter: 'inter',
  Fraunces: 'fraunces',
};

const CDN_BASE = 'https://cdn.jsdelivr.net/fontsource/fonts';

function cdnUrl(family: FontFamily, weight: FontWeight): string {
  return `${CDN_BASE}/${SLUG[family]}@latest/latin-${weight}-normal.ttf`;
}

function kvKey(family: FontFamily, weight: FontWeight): string {
  return `font:${SLUG[family]}:${weight}`;
}

/** Tier 1: warm-isolate module cache, keyed by `<slug>:<weight>`. */
const memoryCache = new Map<string, ArrayBuffer>();

async function loadOne(env: Env, family: FontFamily, weight: FontWeight): Promise<ArrayBuffer> {
  const memKey = `${SLUG[family]}:${weight}`;
  const cached = memoryCache.get(memKey);
  if (cached) return cached;

  const key = kvKey(family, weight);

  // Tier 2: KV (survives cold starts).
  try {
    const fromKv = await env.CONFIG.get(key, 'arrayBuffer');
    if (fromKv && fromKv.byteLength > 0) {
      memoryCache.set(memKey, fromKv);
      return fromKv;
    }
  } catch {
    // KV read failure is non-fatal; fall through to the CDN.
  }

  // Tier 3: origin fetch from Fontsource CDN.
  let buf: ArrayBuffer;
  try {
    const res = await fetch(cdnUrl(family, weight), {
      cf: { cacheEverything: true, cacheTtl: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) {
      throw new OgFontError(
        `Font CDN returned ${res.status} for ${family} ${weight} (${cdnUrl(family, weight)})`,
      );
    }
    buf = await res.arrayBuffer();
    if (buf.byteLength === 0) {
      throw new OgFontError(`Font CDN returned empty body for ${family} ${weight}`);
    }
  } catch (err) {
    if (err instanceof OgFontError) throw err;
    throw new OgFontError(`Failed to fetch font ${family} ${weight} from CDN`, err);
  }

  memoryCache.set(memKey, buf);
  // Best-effort persist to KV; a write failure must not fail the render.
  try {
    await env.CONFIG.put(key, buf);
  } catch {
    // Ignore: we still have the buffer in memory for this isolate.
  }
  return buf;
}

/**
 * Load the full set of fonts a card needs, in parallel. Returns Satori-shaped
 * font descriptors. Throws {@link OgFontError} if any required font is missing.
 */
export async function loadFonts(
  env: Env,
  specs: ReadonlyArray<{ name: FontFamily; weight: FontWeight }>,
): Promise<LoadedFont[]> {
  return Promise.all(
    specs.map(async ({ name, weight }) => ({
      name,
      weight,
      style: 'normal' as const,
      data: await loadOne(env, name, weight),
    })),
  );
}

/** The font set every card loads: Inter 400/600/700 and Fraunces 600/700 for titles. */
export const CARD_FONTS: ReadonlyArray<{ name: FontFamily; weight: FontWeight }> = [
  { name: 'Inter', weight: 400 },
  { name: 'Inter', weight: 600 },
  { name: 'Inter', weight: 700 },
  { name: 'Fraunces', weight: 600 },
  { name: 'Fraunces', weight: 700 },
];
