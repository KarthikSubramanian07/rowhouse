/**
 * Rowhouse dynamic OG-image / audiogram module (Cloudflare Worker).
 *
 * Pipeline:  params -> Satori vdom -> SVG -> resvg(WASM) -> PNG bytes.
 * Every exported function is pure-ish: `(env, params) -> Promise<Uint8Array>`
 * PNG bytes. Caching (R2 `env.MEDIA` keyed by content hash) and HTTP serving are
 * the caller's responsibility; this module only renders.
 *
 * Fonts are fetched from the Fontsource CDN once, then cached in module scope
 * and in `env.CONFIG` KV (see fonts.ts). Images (posters) must be supplied as
 * base64 by the caller, since Satori cannot fetch remote images on Workers.
 *
 * Errors surface as typed `OgFontError` / `OgRenderError` for the caller to catch.
 */

import { formatTimecode } from '@rowhouse/types';
import type { Env } from '../env.js';
import {
  type AudiogramCardParams,
  buildAudiogramCard,
  buildFilmCard,
  buildTrackCard,
  type FilmCardParams,
  type TrackCardParams,
} from './cards.js';
import { renderCard } from './render.js';
import type { ReactionTone } from './tokens.js';

export { OgFontError } from './fonts.js';
export { OgRenderError } from './render.js';
export type { ReactionTone } from './tokens.js';
export { CARD } from './tokens.js';

// ---------------------------------------------------------------------------
// 1. Film share card
// ---------------------------------------------------------------------------

export interface RenderFilmCardParams {
  title: string;
  year: number;
  creatorCount: number;
  trackCount: number;
  /** Optional pre-fetched poster: raw base64 or a full `data:` URL. */
  posterBase64?: string;
}

/**
 * The film-page share card: "<Title>, commentary on Rowhouse", with creator and
 * track counts, and an optional poster on the left.
 */
export function renderFilmCard(env: Env, params: RenderFilmCardParams): Promise<Uint8Array> {
  const cardParams: FilmCardParams = {
    title: params.title,
    year: params.year,
    creatorCount: params.creatorCount,
    trackCount: params.trackCount,
    // Preserve exactOptionalPropertyTypes: only set the key when present.
    ...(params.posterBase64 !== undefined ? { posterBase64: params.posterBase64 } : {}),
  };
  return renderCard(env, buildFilmCard(cardParams));
}

// ---------------------------------------------------------------------------
// 2. Commentary-track share card
// ---------------------------------------------------------------------------

export interface RenderTrackCardParams {
  filmTitle: string;
  trackTitle: string;
  creatorHandle: string;
  durationSeconds: number;
  tone?: ReactionTone;
}

/**
 * A commentary-track share card. Duration is rendered via `formatTimecode`
 * from `@rowhouse/types`.
 */
export function renderTrackCard(env: Env, params: RenderTrackCardParams): Promise<Uint8Array> {
  const cardParams: TrackCardParams = {
    filmTitle: params.filmTitle,
    trackTitle: params.trackTitle,
    creatorHandle: params.creatorHandle,
    duration: formatTimecode(params.durationSeconds),
    ...(params.tone !== undefined ? { tone: params.tone } : {}),
  };
  return renderCard(env, buildTrackCard(cardParams));
}

// ---------------------------------------------------------------------------
// 3. Audiogram / CLIP share card
// ---------------------------------------------------------------------------

export interface RenderAudiogramCardParams {
  creatorHandle: string;
  filmTitle: string;
  caption: string;
  /** Bar heights in 0..1. Resampled internally to a fixed bar count. */
  waveform: number[];
  /** Reaction-spike position in 0..1 across the waveform (highlighted red). */
  peakX?: number;
}

/**
 * The clip audiogram share format. Draws the waveform as a row of flex bars with a
 * cinema-red reaction spike at `peakX`.
 */
export function renderAudiogramCard(
  env: Env,
  params: RenderAudiogramCardParams,
): Promise<Uint8Array> {
  const cardParams: AudiogramCardParams = {
    creatorHandle: params.creatorHandle,
    filmTitle: params.filmTitle,
    caption: params.caption,
    waveform: params.waveform,
    ...(params.peakX !== undefined ? { peakX: params.peakX } : {}),
  };
  return renderCard(env, buildAudiogramCard(cardParams));
}
