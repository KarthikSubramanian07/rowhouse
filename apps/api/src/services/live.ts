import type { Database } from '@rowhouse/db';
import {
  chapters as chaptersTable,
  clips,
  liveSessions,
  reactionMarkers,
  tracks,
} from '@rowhouse/db';
import {
  assembleTrackFromSession,
  type ReactionEvent,
  type ReactionType,
} from '@rowhouse/sync-engine';
import { eq } from 'drizzle-orm';
import type { Providers } from '../adapters/index.js';
import { internalAuthHeaders } from '../auth/chatToken.js';
import type { Env } from '../env.js';
import { newId } from '../lib/ids.js';

const REACTION_SET = new Set<ReactionType>(['fire', 'laugh', 'cry', 'shock']);

interface DoTimeline {
  reactions: { t: number; type: string }[];
  peakViewers: number;
  chatCount: number;
}

async function fetchTimeline(env: Env, sessionId: string): Promise<DoTimeline> {
  const stub = env.CHAT.get(env.CHAT.idFromName(sessionId));
  const res = await stub.fetch('https://do/timeline', {
    headers: internalAuthHeaders(env),
  });
  if (!res.ok) return { reactions: [], peakViewers: 0, chatCount: 0 };
  return (await res.json()) as DoTimeline;
}

export interface AssembledResult {
  trackId: string;
  totalReactions: number;
  markerCount: number;
  clipCount: number;
  peakViewers: number;
}

/**
 * End a live session and auto-save it as a searchable async commentary track with
 * its reaction markers preserved. A live event becomes a permanent catalog entry
 * that carries the room's reactions with it.
 */
export async function assembleLiveSession(
  db: Database,
  providers: Providers,
  env: Env,
  sessionId: string,
): Promise<AssembledResult> {
  const session = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
  if (!session) throw new Error('session_not_found');
  if (session.trackId) {
    return {
      trackId: session.trackId,
      totalReactions: 0,
      markerCount: 0,
      clipCount: 0,
      peakViewers: session.peakViewers,
    };
  }

  const timeline = await fetchTimeline(env, sessionId);
  const now = Math.floor(Date.now() / 1000);
  const startedAt = session.startedAt ?? now;
  const durationSeconds = Math.max(1, (session.endedAt ?? now) - startedAt);

  const reactions: ReactionEvent[] = timeline.reactions
    .filter((r): r is { t: number; type: ReactionType } => REACTION_SET.has(r.type as ReactionType))
    .map((r) => ({ t: r.t, type: r.type }));

  const suggestedChapters = await providers.ai.suggestChapters({ durationSeconds, reactions });
  const assembled = assembleTrackFromSession({
    durationSeconds,
    reactions,
    chapters: suggestedChapters,
  });

  const trackId = newId('trk');
  await db.insert(tracks).values({
    id: trackId,
    kind: 'commentary',
    filmSlug: session.filmSlug,
    creatorId: session.creatorId,
    title: session.title,
    audioKey: `audio/${trackId}.bin`,
    fingerprintKey: null,
    durationSeconds,
    platform: session.platform,
    tone: null,
    spoilerSafe: false,
    liveSessionId: session.id,
  });

  // Bake in reaction markers (colored dot clusters) from the live session.
  let markerCount = 0;
  const markerValues = assembled.reactionBins.flatMap((bin) =>
    (Object.entries(bin.counts) as [ReactionType, number][])
      .filter(([, count]) => count > 0)
      .map(([type, count]) => ({ id: newId('mrk'), trackId, t: bin.t, type, count })),
  );
  if (markerValues.length > 0) {
    await db.insert(reactionMarkers).values(markerValues);
    markerCount = markerValues.length;
  }

  if (assembled.chapters.length > 0) {
    await db
      .insert(chaptersTable)
      .values(
        assembled.chapters.map((ch) => ({ id: newId('chp'), trackId, t: ch.t, title: ch.title })),
      );
  }

  // Suggested clips (creator approves before publishing).
  if (assembled.clipCandidates.length > 0) {
    await db.insert(clips).values(
      assembled.clipCandidates.map((clip) => ({
        id: newId('clp'),
        trackId,
        startSeconds: clip.startSeconds,
        endSeconds: clip.endSeconds,
        peakSeconds: clip.peakSeconds,
        status: 'suggested' as const,
        assetKey: null,
        score: clip.score,
      })),
    );
  }

  await db
    .update(liveSessions)
    .set({
      status: 'ended',
      endedAt: session.endedAt ?? now,
      trackId,
      peakViewers: timeline.peakViewers,
    })
    .where(eq(liveSessions.id, sessionId));

  return {
    trackId,
    totalReactions: assembled.totalReactions,
    markerCount,
    clipCount: assembled.clipCandidates.length,
    peakViewers: timeline.peakViewers,
  };
}
