import type { ReactionType } from '@rowhouse/types';

/**
 * Reaction colors, mirrored from tokens.css. Duplicated as literals here because
 * the <Waveform> canvas needs real color strings at paint time (canvas cannot
 * read Tailwind utility classes). Keep in sync with `--react-*` in tokens.css.
 */
export const REACTION_COLORS: Record<ReactionType, string> = {
  fire: '#ff7a45',
  laugh: '#f5c518',
  cry: '#4c8dff',
  shock: '#b57bff',
};

/** Human labels for reactions (buttons, aria-labels). */
export const REACTION_LABELS: Record<ReactionType, string> = {
  fire: 'Fire',
  laugh: 'Laugh',
  cry: 'Cry',
  shock: 'Shock',
};
