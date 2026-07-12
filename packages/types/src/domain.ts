/**
 * Core domain vocabulary. These enums/constants are the single source of truth
 * shared by the API, the SPA, and the SEO site.
 */

export const REACTION_TYPES = ['fire', 'laugh', 'cry', 'shock'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];

/** Content types (spec §04). */
export const CONTENT_KINDS = ['commentary', 'mini_take'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

/** Stream setup (spec §06). */
export const STREAM_MODES = ['audio', 'video'] as const;
export type StreamMode = (typeof STREAM_MODES)[number];

export const LIVE_STATUS = ['scheduled', 'live', 'ended', 'canceled'] as const;
export type LiveStatus = (typeof LIVE_STATUS)[number];

/** Tone tags for discovery (spec §07 Discovery). */
export const TONES = ['analytical', 'comedic', 'emotional', 'chaotic'] as const;
export type Tone = (typeof TONES)[number];

/** The media a track is attached to. TV episodes carry season/episode. */
export const MEDIA_TYPES = ['movie', 'tv'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const REPORT_REASONS = [
  'hate_or_harassment',
  'targeted_abuse',
  'mislabeled_spoilers',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const CLIP_STATUS = ['suggested', 'approved', 'published', 'rejected'] as const;
export type ClipStatus = (typeof CLIP_STATUS)[number];

// ── Entities ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  isCreator: boolean;
  pro: boolean;
  createdAt: number;
}

export interface Creator {
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  tone: Tone | null;
}

export interface Film {
  /** Rowhouse slug, e.g. "mulholland-drive" or "the-sopranos-s06e21". */
  slug: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  director: string | null;
  runtimeMinutes: number | null;
  season: number | null;
  episode: number | null;
  genres: string[];
}

export interface CommentaryTrack {
  id: string;
  kind: ContentKind;
  filmSlug: string;
  creatorHandle: string;
  title: string;
  /** R2 object key for the commentary audio. Never film audio. */
  audioKey: string;
  /** R2 object key for the fingerprint map blob. */
  fingerprintKey: string | null;
  durationSeconds: number;
  /** Which platform/version the creator watched (for fingerprint variant). */
  platform: string | null;
  tone: Tone | null;
  spoilerSafe: boolean;
  listenCount: number;
  /** Sum of listens that reached the end / listenCount — the key metric. */
  completionRate: number;
  /** Present when this track was born from a live session. */
  liveSessionId: string | null;
  createdAt: number;
}

export interface LiveSession {
  id: string;
  creatorHandle: string;
  filmSlug: string;
  title: string;
  status: LiveStatus;
  mode: StreamMode;
  scheduledFor: number | null;
  startedAt: number | null;
  endedAt: number | null;
  peakViewers: number;
  /** Set once the session ends and auto-saves as a track. */
  trackId: string | null;
}

export interface ReactionMarker {
  t: number;
  type: ReactionType;
  count: number;
}

export interface Clip {
  id: string;
  trackId: string;
  startSeconds: number;
  endSeconds: number;
  peakSeconds: number;
  status: ClipStatus;
  /** R2 key for the rendered audiogram (mp4/png), when produced. */
  assetKey: string | null;
  score: number;
  createdAt: number;
}

export interface WatchlistItem {
  creatorHandle: string;
  filmSlug: string;
  upvotes: number;
  note: string | null;
  createdAt: number;
}
