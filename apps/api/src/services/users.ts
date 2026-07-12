import type { Database } from '@rowhouse/db';
import { oauthAccounts, users } from '@rowhouse/db';
import { slugify } from '@rowhouse/types';
import { and, eq } from 'drizzle-orm';
import type { GoogleProfile } from '../auth/oauth.js';
import { newId } from '../lib/ids.js';

async function uniqueHandle(db: Database, base: string): Promise<string> {
  const root = slugify(base).replace(/-/g, '_').slice(0, 24) || 'cinephile';
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? root : `${root}_${attempt + 1}`;
    const existing = await db
      .select({ h: users.handle })
      .from(users)
      .where(eq(users.handle, candidate))
      .get();
    if (!existing) return candidate;
  }
  return `${root}_${newId('u').slice(2, 8)}`;
}

export interface AppUser {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isCreator: boolean;
  pro: boolean;
}

async function loadUser(db: Database, userId: string): Promise<AppUser | null> {
  const u = await db.select().from(users).where(eq(users.id, userId)).get();
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    handle: u.handle,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    isCreator: u.isCreator,
    pro: u.pro,
  };
}

/** Find or create a user from a verified Google profile. */
export async function upsertOAuthUser(
  db: Database,
  provider: 'google',
  profile: GoogleProfile,
): Promise<AppUser> {
  const link = await db
    .select({ userId: oauthAccounts.userId })
    .from(oauthAccounts)
    .where(
      and(
        eq(oauthAccounts.provider, provider),
        eq(oauthAccounts.providerUserId, profile.providerUserId),
      ),
    )
    .get();
  if (link) {
    const existing = await loadUser(db, link.userId);
    if (existing) return existing;
  }

  const id = newId('usr');
  const handle = await uniqueHandle(db, profile.name || profile.email.split('@')[0] || 'cinephile');
  await db.insert(users).values({
    id,
    email: profile.email || `${handle}@rowhouse.local`,
    displayName: profile.name || handle,
    handle,
    avatarUrl: profile.picture,
    isCreator: false,
    pro: false,
  });
  await db
    .insert(oauthAccounts)
    .values({ provider, providerUserId: profile.providerUserId, userId: id });
  const created = await loadUser(db, id);
  if (!created) throw new Error('user_create_failed');
  return created;
}

/** Zero-secret dev login: a stable demo user so the app runs without OAuth. */
export async function getOrCreateDevUser(db: Database): Promise<AppUser> {
  const existing = await db.select().from(users).where(eq(users.handle, 'demo')).get();
  if (existing) {
    const u = await loadUser(db, existing.id);
    if (u) return u;
  }
  const id = newId('usr');
  await db.insert(users).values({
    id,
    email: 'demo@rowhouse.local',
    displayName: 'Demo Cinephile',
    handle: 'demo',
    avatarUrl: null,
    isCreator: true,
    pro: true,
  });
  const u = await loadUser(db, id);
  if (!u) throw new Error('dev_user_failed');
  return u;
}
