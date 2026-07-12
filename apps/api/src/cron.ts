import { createDb, sessions } from '@rowhouse/db';
import { lt } from 'drizzle-orm';
import type { Env } from './env.js';

/** Cron handler. Two schedules (see wrangler.jsonc triggers). */
export async function handleScheduled(event: ScheduledController, env: Env): Promise<void> {
  const db = createDb(env.DB);
  const now = Math.floor(Date.now() / 1000);

  if (event.cron === '0 3 * * *') {
    // Nightly housekeeping: purge expired auth sessions.
    await db.delete(sessions).where(lt(sessions.expiresAt, now));
    return;
  }

  // */15 sweep — reserved for pending fingerprint/clip processing. The heavy work
  // is enqueued to the Queue at request time; this is the safety-net re-drive.
}
