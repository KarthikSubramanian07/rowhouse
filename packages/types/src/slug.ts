/** Slug helpers. The SEO surface depends on stable, readable film slugs. */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

/**
 * Build a film/episode slug. Examples:
 *   movie: "mulholland-drive"
 *   tv:    "the-sopranos-s06e21"
 */
export function filmSlug(input: {
  title: string;
  mediaType: 'movie' | 'tv' | 'audiobook';
  season?: number | null | undefined;
  episode?: number | null | undefined;
}): string {
  const base = slugify(input.title);
  if (input.mediaType === 'tv' && input.season != null && input.episode != null) {
    const s = String(input.season).padStart(2, '0');
    const e = String(input.episode).padStart(2, '0');
    return `${base}-s${s}e${e}`;
  }
  return base;
}

const zeros = '0000000000';
/** Format seconds as a timecode: 1:23:14 or 4:07. */
export function formatTimecode(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number, w = 2) => (zeros + n).slice(-w);
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}
