/**
 * Deterministic reaction + clip logic.
 *
 * These are pure functions the platform's "flywheel" depends on, so they're
 * unit-tested hard alongside the sync engine:
 *  - mapping a reaction timestamp to a normalized waveform x-position,
 *  - finding highest-reaction-density moments (auto-clip candidates), and
 *  - assembling a finished live session into a searchable async track with its
 *    community reaction markers baked in.
 */

export type ReactionType = 'fire' | 'laugh' | 'cry' | 'shock';

export interface ReactionEvent {
  /** Reference-timeline position (seconds) the reaction landed at. */
  t: number;
  type: ReactionType;
}

export interface Chapter {
  /** Reference-timeline position (seconds). */
  t: number;
  title: string;
}

/**
 * Map a timeline position to a normalized [0, 1] x-position on a waveform of the
 * given duration. Clamped so out-of-range markers never render off-canvas.
 */
export function reactionToWaveformX(positionSeconds: number, durationSeconds: number): number {
  if (durationSeconds <= 0) return 0;
  const x = positionSeconds / durationSeconds;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export interface ReactionBin {
  /** Bin center (seconds). */
  t: number;
  /** Normalized x-position [0, 1]. */
  x: number;
  /** Total reactions in this bin. */
  count: number;
  /** Per-type counts, for coloring the dot cluster. */
  counts: Record<ReactionType, number>;
}

const REACTION_TYPES: ReactionType[] = ['fire', 'laugh', 'cry', 'shock'];

function emptyCounts(): Record<ReactionType, number> {
  return { fire: 0, laugh: 0, cry: 0, shock: 0 };
}

/**
 * Bucket reactions into fixed-width bins for waveform dot clusters.
 * `binSeconds` controls dot granularity (default 2 s).
 */
export function binReactions(
  events: ReactionEvent[],
  durationSeconds: number,
  binSeconds = 2,
): ReactionBin[] {
  if (durationSeconds <= 0 || binSeconds <= 0) return [];
  const nBins = Math.max(1, Math.ceil(durationSeconds / binSeconds));
  const bins: ReactionBin[] = [];
  for (let i = 0; i < nBins; i++) {
    const center = (i + 0.5) * binSeconds;
    bins.push({
      t: center,
      x: reactionToWaveformX(center, durationSeconds),
      count: 0,
      counts: emptyCounts(),
    });
  }
  for (const e of events) {
    if (e.t < 0 || e.t > durationSeconds) continue;
    const idx = Math.min(nBins - 1, Math.floor(e.t / binSeconds));
    const bin = bins[idx]!;
    bin.count++;
    bin.counts[e.type]++;
  }
  return bins.filter((b) => b.count > 0);
}

export interface ClipCandidate {
  startSeconds: number;
  endSeconds: number;
  /** Peak reaction-density moment within the window. */
  peakSeconds: number;
  /** Total reactions inside the window (the density score). */
  score: number;
  counts: Record<ReactionType, number>;
}

export interface ClipDetectionOptions {
  /** Clip length in seconds. Default 20. */
  windowSeconds?: number;
  /** How many top clips to return. Default 3. */
  topK?: number;
  /** Minimum reactions in a window to qualify. Default 5. */
  minReactions?: number;
  /** Minimum gap between returned clip centers (dedupe). Default = windowSeconds. */
  minSeparationSeconds?: number;
}

/**
 * Find the highest-reaction-density moments — the auto-generated clip candidates
 * ("creator losing their mind" audiograms). A sliding window over sorted events;
 * greedy non-overlapping top-K selection so clips don't stack on one spike.
 */
export function detectClipCandidates(
  events: ReactionEvent[],
  durationSeconds: number,
  opts: ClipDetectionOptions = {},
): ClipCandidate[] {
  const windowSeconds = opts.windowSeconds ?? 20;
  const topK = opts.topK ?? 3;
  const minReactions = opts.minReactions ?? 5;
  const minSep = opts.minSeparationSeconds ?? windowSeconds;
  if (events.length === 0 || durationSeconds <= 0) return [];

  const sorted = [...events]
    .filter((e) => e.t >= 0 && e.t <= durationSeconds)
    .sort((a, b) => a.t - b.t);

  // For each event as a window start, count events within [t, t+window).
  const windows: ClipCandidate[] = [];
  let hi = 0;
  for (let lo = 0; lo < sorted.length; lo++) {
    const start = sorted[lo]!.t;
    const end = Math.min(durationSeconds, start + windowSeconds);
    if (hi < lo) hi = lo;
    while (hi < sorted.length && sorted[hi]!.t < end) hi++;
    const counts = emptyCounts();
    for (let i = lo; i < hi; i++) counts[sorted[i]!.type]++;
    const score = hi - lo;
    // Approximate the density peak by the median event time within the window.
    const mid = sorted[Math.floor((lo + hi - 1) / 2)]!.t;
    windows.push({ startSeconds: start, endSeconds: end, peakSeconds: mid, score, counts });
  }

  // Greedy non-overlapping top-K by score.
  windows.sort((a, b) => b.score - a.score || a.startSeconds - b.startSeconds);
  const chosen: ClipCandidate[] = [];
  for (const w of windows) {
    if (w.score < minReactions) break;
    if (chosen.some((c) => Math.abs(c.peakSeconds - w.peakSeconds) < minSep)) continue;
    chosen.push(w);
    if (chosen.length >= topK) break;
  }
  return chosen.sort((a, b) => a.startSeconds - b.startSeconds);
}

export interface AssembledTrack {
  durationSeconds: number;
  reactionBins: ReactionBin[];
  chapters: Chapter[];
  clipCandidates: ClipCandidate[];
  totalReactions: number;
}

/**
 * Assemble a finished live session into the async catalog entry: reaction dot
 * clusters, validated chapter markers, and clip candidates — the live→async
 * flywheel made concrete. Deterministic given identical inputs.
 */
export function assembleTrackFromSession(input: {
  durationSeconds: number;
  reactions: ReactionEvent[];
  chapters?: Chapter[];
  binSeconds?: number;
  clipOptions?: ClipDetectionOptions;
}): AssembledTrack {
  const { durationSeconds } = input;
  const reactions = input.reactions.filter((r) => r.t >= 0 && r.t <= durationSeconds);
  const chapters = (input.chapters ?? [])
    .filter((c) => c.t >= 0 && c.t <= durationSeconds && c.title.trim().length > 0)
    .sort((a, b) => a.t - b.t);
  return {
    durationSeconds,
    reactionBins: binReactions(reactions, durationSeconds, input.binSeconds),
    chapters,
    clipCandidates: detectClipCandidates(reactions, durationSeconds, input.clipOptions),
    totalReactions: reactions.length,
  };
}

export { REACTION_TYPES };
