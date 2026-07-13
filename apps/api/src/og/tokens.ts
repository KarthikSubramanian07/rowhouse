/**
 * Rowhouse OG design tokens: dark, cinematic, high-contrast.
 * Kept in one place so every card reads as the same product.
 */

export const CARD = {
  width: 1200,
  height: 630,
  /** Outer safe padding for content. */
  pad: 64,
} as const;

export const COLOR = {
  bg: '#0B0B0D',
  surface: '#131317',
  border: '#24242B',
  textHi: '#F2F0EC',
  textMid: '#9E9EA7',
  /** Cinema red, the brand accent. */
  accent: '#E0362E',
  /** "Locked" mint (verified / committed state). */
  mint: '#3DD68C',
} as const;

/** Reaction palette, used for track "tone" badges and audiogram spikes. */
export const REACTION = {
  fire: '#FF7A45',
  laugh: '#F5C518',
  cry: '#4C8DFF',
  shock: '#B57BFF',
} as const;

export type ReactionTone = keyof typeof REACTION;

export const FONT = {
  serif: 'Fraunces',
  sans: 'Inter',
} as const;
