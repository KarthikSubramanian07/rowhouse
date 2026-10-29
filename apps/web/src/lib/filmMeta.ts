/** Trim to `max` chars on a word boundary, adding an ellipsis only when cut. */
function clip(text: string, max: number): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const atWord = cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut;
  return `${atWord.replace(/[\s.,;:!?-]+$/, '')}…`;
}

/** Ensure a sentence ends with terminal punctuation (or an ellipsis). */
function terminate(text: string): string {
  return /[.!?…]$/.test(text) ? text : `${text}.`;
}

/** Meta description for a film page: its overview, then what Rowhouse offers for it. */
export function filmDescription(film: {
  title: string;
  overview: string | null;
  creatorCount: number;
}): string {
  const offer =
    film.creatorCount === 0
      ? `Be the first to record synced commentary for ${film.title} on Rowhouse.`
      : `Listen to synced commentary on ${film.title} from ${film.creatorCount} ${
          film.creatorCount === 1 ? 'creator' : 'creators'
        }.`;
  if (!film.overview?.trim()) {
    return `Synced film commentary for ${film.title}. Hold up your phone and the track locks to your frame.`;
  }
  return `${terminate(clip(film.overview, 150))} ${offer}`;
}
