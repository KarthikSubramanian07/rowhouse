/**
 * Core render pipeline:  vdom -> Satori -> SVG -> resvg(WASM) -> PNG bytes.
 *
 * Workers gotchas handled here:
 *  - resvg WASM is a static import so wrangler precompiles it into a
 *    `WebAssembly.Module`; `initWasm` is called exactly once, guarded by a
 *    module-scope promise (calling it twice throws "Already initialized").
 *  - Satori embeds glyphs as vector paths (`embedFont: true`), so the SVG is
 *    self-contained and resvg needs no system fonts.
 *  - Output is always PNG, never WebP (which crashes resvg). og:image wants PNG/JPEG.
 */

import { initWasm, Resvg } from '@resvg/resvg-wasm';
// Static import; wrangler precompiles it to a WebAssembly.Module (see wasm.d.ts).
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';
import satori from 'satori';
import type { Env } from '../env.js';
import { CARD_FONTS, loadFonts } from './fonts.js';
import { CARD } from './tokens.js';
import type { VNode } from './vdom.js';

/** Single-flight guard: init the resvg WASM once per isolate. */
let resvgInit: Promise<unknown> | null = null;

function ensureResvg(): Promise<unknown> {
  if (resvgInit === null) {
    // `resvgWasm` is a WebAssembly.Module thanks to the static import.
    resvgInit = initWasm(resvgWasm);
  }
  return resvgInit;
}

/** Thrown when Satori or resvg fails to produce an image. */
export class OgRenderError extends Error {
  override readonly name = 'OgRenderError';
  constructor(message: string, cause?: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
  }
}

/**
 * Render a card vdom to PNG bytes at the fixed 1200x630 OG size.
 * Pure-ish: `(env, vdom) -> Promise<Uint8Array>`. Caching/storage is the caller's job.
 */
export async function renderCard(env: Env, tree: VNode): Promise<Uint8Array> {
  const fonts = await loadFonts(env, CARD_FONTS);

  let svg: string;
  try {
    svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
      width: CARD.width,
      height: CARD.height,
      fonts,
      // Vectorize text so resvg does not need any fonts of its own.
      embedFont: true,
    });
  } catch (err) {
    throw new OgRenderError('Satori failed to lay out the card', err);
  }

  try {
    await ensureResvg();
    const resvg = new Resvg(svg, {
      // Render at exactly the card width; height follows the SVG viewBox.
      fitTo: { mode: 'width', value: CARD.width },
      font: { loadSystemFonts: false },
      background: 'rgba(0,0,0,0)',
    });
    const png = resvg.render().asPng();
    // asPng() returns a Uint8Array (a Buffer-like view); return it as-is.
    return png;
  } catch (err) {
    throw new OgRenderError('resvg failed to rasterize the SVG', err);
  }
}
