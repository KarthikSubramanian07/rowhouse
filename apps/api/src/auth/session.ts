/**
 * Session auth using the ID.secret + SHA-256 pattern (the maintained successor to
 * the now-deprecated Lucia). Token is `<sessionId>.<secret>`, delivered in an
 * HttpOnly/Secure/SameSite=Lax cookie. Only SHA-256(secret [+ pepper]) is stored in
 * D1, so a DB leak can't be replayed. Runs entirely on Workers WebCrypto.
 */
import { sha256 } from '@oslojs/crypto/sha2';
import type { Database } from '@rowhouse/db';
import { sessions, users } from '@rowhouse/db';
import { eq } from 'drizzle-orm';
import { newId, randomToken } from '../lib/ids.js';

export const SESSION_COOKIE = 'rh_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const REFRESH_THRESHOLD = 60 * 60 * 24 * 15; // refresh when < 15 days remain

export interface SessionUser {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  isCreator: boolean;
  pro: boolean;
}

export interface ValidatedSession {
  sessionId: string;
  user: SessionUser;
}

function hashSecret(secret: string, pepper: string | undefined): Uint8Array {
  const data = new TextEncoder().encode(pepper ? `${secret}.${pepper}` : secret);
  return sha256(data);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/** Create a session for a user and return the raw token for the cookie. */
export async function createSession(
  db: Database,
  userId: string,
  pepper: string | undefined,
): Promise<string> {
  const id = newId('ses');
  const secret = randomToken(24);
  const now = Math.floor(Date.now() / 1000);
  await db.insert(sessions).values({
    id,
    secretHash: hashSecret(secret, pepper),
    userId,
    createdAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  });
  return `${id}.${secret}`;
}

/** Validate a token; refreshes the expiry when it's close to lapsing. */
export async function validateSession(
  db: Database,
  token: string,
  pepper: string | undefined,
): Promise<ValidatedSession | null> {
  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const secret = token.slice(dot + 1);

  const row = await db
    .select({
      sId: sessions.id,
      secretHash: sessions.secretHash,
      expiresAt: sessions.expiresAt,
      uId: users.id,
      email: users.email,
      handle: users.handle,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      isCreator: users.isCreator,
      pro: users.pro,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();

  if (!row) return null;
  const now = Math.floor(Date.now() / 1000);
  if (row.expiresAt <= now) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  const stored = new Uint8Array(row.secretHash as ArrayBuffer);
  if (!constantTimeEqual(stored, hashSecret(secret, pepper))) return null;

  if (row.expiresAt - now < REFRESH_THRESHOLD) {
    await db
      .update(sessions)
      .set({ expiresAt: now + SESSION_TTL_SECONDS })
      .where(eq(sessions.id, id));
  }

  return {
    sessionId: row.sId,
    user: {
      id: row.uId,
      email: row.email,
      handle: row.handle,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      isCreator: row.isCreator,
      pro: row.pro,
    },
  };
}

export async function invalidateSession(db: Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export const sessionCookieOptions = (secure: boolean) =>
  ({
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }) as const;
