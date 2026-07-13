import { createDb, follows, liveSessions, pushSubscriptions, users } from '@rowhouse/db';
import { eq, inArray } from 'drizzle-orm';
import { buildProviders } from './adapters/index.js';
import type { Env, JobMessage } from './env.js';
import { getFilmBySlug } from './services/films.js';
import { assembleLiveSession } from './services/live.js';

/** Queue consumer for background jobs that shouldn't block a request. */
export async function handleQueue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
  const db = createDb(env.DB);
  const providers = buildProviders(env);
  for (const message of batch.messages) {
    try {
      await handleJob(message.body, db, providers, env);
      message.ack();
    } catch (err) {
      console.error('job_failed', message.body.type, err);
      message.retry();
    }
  }
}

async function handleJob(
  job: JobMessage,
  db: ReturnType<typeof createDb>,
  providers: ReturnType<typeof buildProviders>,
  env: Env,
): Promise<void> {
  switch (job.type) {
    case 'assemble_track':
      await assembleLiveSession(db, providers, env, job.liveSessionId);
      return;
    case 'notify_live':
      await notifyLive(db, providers, env, job.liveSessionId);
      return;
    case 'process_fingerprint':
    case 'detect_clips':
    case 'render_clip':
      // Fingerprint maps are built client-side; clip candidates are detected at
      // assembly time; audiogram render (ffmpeg) is a Container-hosted follow-up.
      return;
  }
}

/**
 * Fan out Web Push to a creator's followers when they go live, e.g. "Your favorite
 * film critic is watching Mulholland Drive right now."
 */
async function notifyLive(
  db: ReturnType<typeof createDb>,
  providers: ReturnType<typeof buildProviders>,
  env: Env,
  sessionId: string,
): Promise<void> {
  const session = await db.select().from(liveSessions).where(eq(liveSessions.id, sessionId)).get();
  if (!session) return;
  const creator = await db.select().from(users).where(eq(users.id, session.creatorId)).get();
  const film = await getFilmBySlug(db, session.filmSlug);
  if (!creator || !film) return;

  const followerRows = await db
    .select({ id: follows.followerId })
    .from(follows)
    .where(eq(follows.creatorId, creator.id))
    .all();
  const followerIds = followerRows.map((f) => f.id);
  if (followerIds.length === 0) return;

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(inArray(pushSubscriptions.userId, followerIds))
    .all();
  const message = {
    title: `${creator.displayName} is live`,
    body: `Watching ${film.title} right now. Hold up your phone and sync in.`,
    url: `${env.APP_ORIGIN}/live/${sessionId}`,
    tag: `live-${sessionId}`,
  };
  await Promise.allSettled(
    subs.map((s) =>
      providers.push.send(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        message,
      ),
    ),
  );
}
