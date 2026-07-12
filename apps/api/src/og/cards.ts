/**
 * Card layouts (Satori vdom builders). Each `build*` function returns a VNode
 * tree; the actual rasterization happens in render.ts. Kept separate so the
 * layout logic is testable/inspectable without the WASM pipeline.
 */

import { CARD, COLOR, FONT, REACTION, type ReactionTone } from './tokens.js';
import { box, col, img, row, text, type VNode } from './vdom.js';

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------

/** Hard-truncate with an ellipsis (Satori text-overflow is unreliable across wraps). */
function clamp(input: string, max: number): string {
  const s = input.trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** Resample an arbitrary-length 0..1 series down to `targetN` averaged buckets. */
function resample(values: number[], targetN: number): number[] {
  if (values.length === 0) return new Array(targetN).fill(0);
  if (values.length <= targetN) return values.map((v) => clampUnit(v));
  const out: number[] = [];
  const bucket = values.length / targetN;
  for (let i = 0; i < targetN; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end && j < values.length; j++) {
      sum += clampUnit(values[j] ?? 0);
      count++;
    }
    out.push(count > 0 ? sum / count : 0);
  }
  return out;
}

function clampUnit(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// shared chrome
// ---------------------------------------------------------------------------

/** The ROWHOUSE wordmark lockup: a cinema-red tick + letter-spaced label. */
function wordmark(): VNode {
  return row({ alignItems: 'center', gap: 12 }, [
    box('div', { width: 14, height: 14, backgroundColor: COLOR.accent, borderRadius: 3 }),
    text(
      {
        fontFamily: FONT.sans,
        fontWeight: 700,
        fontSize: 20,
        letterSpacing: 4,
        color: COLOR.textHi,
      },
      'ROWHOUSE',
    ),
  ]);
}

/**
 * Root frame: full-bleed dark bg + a 1px engineered inset border + a cinema-red
 * rail down the left edge. `content` fills the padded interior.
 */
function frame(content: VNode): VNode {
  return box(
    'div',
    {
      display: 'flex',
      width: CARD.width,
      height: CARD.height,
      backgroundColor: COLOR.bg,
      position: 'relative',
    },
    [
      // left cinema-red rail
      box('div', {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 8,
        backgroundColor: COLOR.accent,
      }),
      // inset hairline border
      box('div', {
        position: 'absolute',
        left: 28,
        top: 28,
        right: 28,
        bottom: 28,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 18,
      }),
      // padded content plane
      col(
        {
          position: 'absolute',
          left: CARD.pad,
          top: CARD.pad,
          right: CARD.pad,
          bottom: CARD.pad,
          justifyContent: 'space-between',
        },
        [content],
      ),
    ],
  );
}

/** A metadata stat: big number + small caps label, stacked. */
function stat(value: string, label: string, accent: string = COLOR.textHi): VNode {
  return col({ alignItems: 'flex-start' }, [
    text(
      { fontFamily: FONT.sans, fontWeight: 700, fontSize: 40, color: accent, lineHeight: 1 },
      value,
    ),
    text(
      {
        fontFamily: FONT.sans,
        fontWeight: 600,
        fontSize: 15,
        letterSpacing: 2,
        color: COLOR.textMid,
        marginTop: 8,
      },
      label.toUpperCase(),
    ),
  ]);
}

/** A colored "tone" pill (uses the reaction palette). */
function tonePill(tone: ReactionTone): VNode {
  const color = REACTION[tone];
  return row(
    {
      alignItems: 'center',
      gap: 10,
      backgroundColor: COLOR.surface,
      border: `1px solid ${COLOR.border}`,
      borderRadius: 999,
      padding: '10px 18px',
    },
    [
      box('div', { width: 12, height: 12, borderRadius: 999, backgroundColor: color }),
      text(
        { fontFamily: FONT.sans, fontWeight: 600, fontSize: 18, letterSpacing: 1, color },
        tone.toUpperCase(),
      ),
    ],
  );
}

/** Build an <img> data URL from a raw base64 string or pass through a data: URL. */
function posterSrc(posterBase64: string): string {
  return posterBase64.startsWith('data:') ? posterBase64 : `data:image/jpeg;base64,${posterBase64}`;
}

// ---------------------------------------------------------------------------
// 1. film card
// ---------------------------------------------------------------------------

export interface FilmCardParams {
  title: string;
  year: number;
  creatorCount: number;
  trackCount: number;
  /** Optional pre-fetched poster (raw base64 or a full data: URL). */
  posterBase64?: string;
}

export function buildFilmCard(p: FilmCardParams): VNode {
  const hasPoster = typeof p.posterBase64 === 'string' && p.posterBase64.length > 0;

  const info = col({ flexGrow: 1, justifyContent: 'space-between', height: '100%' }, [
    // top: wordmark + eyebrow
    col({ gap: 20 }, [
      wordmark(),
      text(
        {
          fontFamily: FONT.sans,
          fontWeight: 600,
          fontSize: 18,
          letterSpacing: 3,
          color: COLOR.accent,
        },
        'COMMENTARY ON ROWHOUSE',
      ),
    ]),
    // middle: title + year
    col({ gap: 6 }, [
      text(
        {
          fontFamily: FONT.serif,
          fontWeight: 700,
          fontSize: hasPoster ? 78 : 96,
          lineHeight: 1.02,
          color: COLOR.textHi,
        },
        clamp(p.title, hasPoster ? 40 : 34),
      ),
      text(
        { fontFamily: FONT.sans, fontWeight: 400, fontSize: 30, color: COLOR.textMid },
        String(p.year),
      ),
    ]),
    // bottom: stats
    row({ gap: 64, alignItems: 'flex-end' }, [
      stat(String(p.creatorCount), 'Creators', COLOR.textHi),
      stat(String(p.trackCount), 'Tracks', COLOR.mint),
    ]),
  ]);

  if (!hasPoster) return frame(info);

  return frame(
    row({ gap: 56, width: '100%', height: '100%', alignItems: 'stretch' }, [
      box(
        'div',
        {
          display: 'flex',
          width: 320,
          height: '100%',
          borderRadius: 14,
          border: `1px solid ${COLOR.border}`,
          overflow: 'hidden',
          backgroundColor: COLOR.surface,
        },
        [
          img(posterSrc(p.posterBase64 as string), {
            width: 320,
            height: '100%',
            // object-fit keeps the poster from distorting.
            objectFit: 'cover',
          }),
        ],
      ),
      info,
    ]),
  );
}

// ---------------------------------------------------------------------------
// 2. track card
// ---------------------------------------------------------------------------

export interface TrackCardParams {
  filmTitle: string;
  trackTitle: string;
  creatorHandle: string;
  /** Duration timecode string, formatted by the caller via formatTimecode(). */
  duration: string;
  tone?: ReactionTone;
}

export function buildTrackCard(p: TrackCardParams): VNode {
  const handle = p.creatorHandle.startsWith('@') ? p.creatorHandle : `@${p.creatorHandle}`;

  return frame(
    col({ flexGrow: 1, justifyContent: 'space-between', height: '100%' }, [
      // top: wordmark + film context
      col({ gap: 18 }, [
        wordmark(),
        text(
          {
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: 1,
            color: COLOR.textMid,
          },
          clamp(p.filmTitle, 52),
        ),
      ]),
      // middle: track title
      col({ gap: 4 }, [
        text(
          {
            fontFamily: FONT.serif,
            fontWeight: 700,
            fontSize: 84,
            lineHeight: 1.03,
            color: COLOR.textHi,
          },
          clamp(p.trackTitle, 44),
        ),
      ]),
      // bottom: creator + duration + tone
      row({ alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
        row({ alignItems: 'center', gap: 20 }, [
          text(
            { fontFamily: FONT.sans, fontWeight: 700, fontSize: 30, color: COLOR.textHi },
            handle,
          ),
          box('div', { width: 6, height: 6, borderRadius: 999, backgroundColor: COLOR.textMid }),
          // monospaced-feeling timecode via tabular sans
          text(
            {
              fontFamily: FONT.sans,
              fontWeight: 600,
              fontSize: 30,
              letterSpacing: 1,
              color: COLOR.accent,
            },
            p.duration,
          ),
        ]),
        ...(p.tone ? [tonePill(p.tone)] : []),
      ]),
    ]),
  );
}

// ---------------------------------------------------------------------------
// 3. audiogram card
// ---------------------------------------------------------------------------

export interface AudiogramCardParams {
  creatorHandle: string;
  filmTitle: string;
  caption: string;
  /** Bar heights, 0..1. Resampled to a fixed bar count for a clean look. */
  waveform: number[];
  /** Reaction-spike position, 0..1 across the waveform. Highlighted in accent red. */
  peakX?: number;
}

const WAVE_BARS = 68;
const WAVE_AREA_HEIGHT = 200;
const WAVE_MIN_BAR = 6;

export function buildAudiogramCard(p: AudiogramCardParams): VNode {
  const handle = p.creatorHandle.startsWith('@') ? p.creatorHandle : `@${p.creatorHandle}`;
  const bars = resample(p.waveform, WAVE_BARS);

  const peakIndex =
    p.peakX === undefined
      ? -1
      : Math.min(WAVE_BARS - 1, Math.max(0, Math.round(clampUnit(p.peakX) * (WAVE_BARS - 1))));

  const barNodes: VNode[] = bars.map((h, i) => {
    const dist = peakIndex < 0 ? Infinity : Math.abs(i - peakIndex);
    const isSpike = dist <= 1;
    const isNearSpike = dist === 2;
    // The spike blows the bar out to full height in cinema red; falloff around it.
    const boosted = isSpike ? Math.max(h, 0.95) : isNearSpike ? Math.max(h, 0.7) : h;
    const height = Math.max(WAVE_MIN_BAR, Math.round(boosted * WAVE_AREA_HEIGHT));
    const color = isSpike ? COLOR.accent : isNearSpike ? '#7A211D' : COLOR.textMid;
    return box('div', {
      display: 'flex',
      flexGrow: 1,
      height,
      backgroundColor: color,
      borderRadius: 3,
      opacity: isSpike ? 1 : isNearSpike ? 0.9 : 0.55,
    });
  });

  return frame(
    col({ flexGrow: 1, justifyContent: 'space-between', height: '100%' }, [
      // top: wordmark + CLIP tag + context
      row({ alignItems: 'center', justifyContent: 'space-between', width: '100%' }, [
        wordmark(),
        row(
          {
            alignItems: 'center',
            gap: 10,
            backgroundColor: COLOR.accent,
            borderRadius: 999,
            padding: '8px 16px',
          },
          [
            box('div', { width: 10, height: 10, borderRadius: 999, backgroundColor: COLOR.bg }),
            text(
              {
                fontFamily: FONT.sans,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: 2,
                color: COLOR.bg,
              },
              'CLIP',
            ),
          ],
        ),
      ]),
      // middle: caption (the "losing their mind" line)
      col({ gap: 14 }, [
        text(
          {
            fontFamily: FONT.sans,
            fontWeight: 600,
            fontSize: 20,
            letterSpacing: 1,
            color: COLOR.textMid,
          },
          `${handle}  ·  ${clamp(p.filmTitle, 40)}`,
        ),
        text(
          {
            fontFamily: FONT.serif,
            fontWeight: 700,
            fontSize: 64,
            lineHeight: 1.05,
            color: COLOR.textHi,
          },
          `“${clamp(p.caption, 70)}”`,
        ),
      ]),
      // bottom: the waveform
      row(
        {
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 5,
          height: WAVE_AREA_HEIGHT,
          width: '100%',
        },
        barNodes,
      ),
    ]),
  );
}
