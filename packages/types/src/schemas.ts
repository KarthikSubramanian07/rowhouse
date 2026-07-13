/**
 * Zod DTO schemas. Validation at every trust boundary (the API contract).
 * Import the inferred types on both client and server so requests can't drift.
 */
import { z } from 'zod';
import {
  CONTENT_KINDS,
  MEDIA_TYPES,
  REACTION_TYPES,
  REPORT_REASONS,
  STREAM_MODES,
  TONES,
} from './domain.js';

export const handleSchema = z
  .string()
  .min(2)
  .max(30)
  .regex(/^[a-z0-9_]+$/, 'lowercase letters, numbers, underscore only');

export const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'lowercase slug');

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

// Auth / profile
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60),
  bio: z.string().max(500).optional(),
  tone: z.enum(TONES).optional(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

// Films
export const filmSearchSchema = z.object({
  q: z.string().min(1).max(120),
  mediaType: z.enum(MEDIA_TYPES).optional(),
});

/** Attach a film to Rowhouse from a TMDB result (cached locally on first use). */
export const linkFilmSchema = z.object({
  tmdbId: z.number().int().positive(),
  mediaType: z.enum(MEDIA_TYPES),
  season: z.number().int().min(0).optional(),
  episode: z.number().int().min(0).optional(),
});
export type LinkFilm = z.infer<typeof linkFilmSchema>;

// Commentary tracks
export const createTrackSchema = z.object({
  kind: z.enum(CONTENT_KINDS).default('commentary'),
  filmSlug: slugSchema,
  title: z.string().min(1).max(140),
  durationSeconds: z
    .number()
    .positive()
    .max(60 * 60 * 8),
  platform: z.string().max(60).optional(),
  tone: z.enum(TONES).optional(),
  spoilerSafe: z.boolean().default(false),
  /** Set when publishing a saved live session as async. */
  liveSessionId: z.string().optional(),
});
export type CreateTrack = z.infer<typeof createTrackSchema>;

/** Returns presigned-style upload targets for audio + fingerprint map. */
export const requestUploadSchema = z.object({
  contentType: z.string().max(120),
  kind: z.enum(['audio', 'fingerprint']),
});
export type RequestUpload = z.infer<typeof requestUploadSchema>;

// Live sessions
export const scheduleSessionSchema = z.object({
  filmSlug: slugSchema,
  title: z.string().min(1).max(140),
  mode: z.enum(STREAM_MODES).default('audio'),
  scheduledFor: z.number().int().positive(),
  platform: z.string().max(60).optional(),
});
export type ScheduleSession = z.infer<typeof scheduleSessionSchema>;

export const chapterSchema = z.object({
  t: z.number().min(0),
  title: z.string().min(1).max(120),
});
export type ChapterInput = z.infer<typeof chapterSchema>;

// Reactions (over the live WebSocket and async replay)
export const reactionEventSchema = z.object({
  t: z.number().min(0),
  type: z.enum(REACTION_TYPES),
});
export type ReactionEventInput = z.infer<typeof reactionEventSchema>;

export const chatMessageSchema = z.object({
  body: z.string().min(1).max(500),
});
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;

/** Envelope for messages travelling over the live chat WebSocket. */
export const liveClientMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('chat'), body: z.string().min(1).max(500) }),
  z.object({ kind: z.literal('reaction'), t: z.number().min(0), type: z.enum(REACTION_TYPES) }),
  z.object({ kind: z.literal('ping') }),
]);
export type LiveClientMessage = z.infer<typeof liveClientMessageSchema>;

// Watchlist
export const watchlistAddSchema = z.object({
  filmSlug: slugSchema,
  note: z.string().max(200).optional(),
});
export type WatchlistAdd = z.infer<typeof watchlistAddSchema>;

// Reports (moderation, spec §11)
export const reportSchema = z.object({
  targetType: z.enum(['track', 'chat_message', 'clip', 'creator']),
  targetId: z.string().min(1),
  reason: z.enum(REPORT_REASONS),
  detail: z.string().max(1000).optional(),
});
export type ReportInput = z.infer<typeof reportSchema>;

// Web Push
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

// Clip approval
export const approveClipSchema = z.object({
  clipId: z.string().min(1),
  approve: z.boolean(),
});
export type ApproveClip = z.infer<typeof approveClipSchema>;
