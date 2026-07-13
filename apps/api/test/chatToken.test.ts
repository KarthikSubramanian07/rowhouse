import { describe, expect, it } from 'vitest';
import { type ChatClaims, mintChatToken, verifyChatToken } from '../src/auth/chatToken.js';
import type { Env } from '../src/env.js';

function mockEnv(pepper?: string): Env {
  return {
    APP_ORIGIN: 'https://rowhouse-gg.pages.dev',
    PUBLIC_API_ORIGIN: 'https://rowhouse-api.workers.dev',
    SESSION_PEPPER: pepper,
  } as Env;
}

describe('chatToken', () => {
  it('round-trips a signed token for the matching session', async () => {
    const env = mockEnv('test-pepper');
    const claims: Omit<ChatClaims, 'exp'> = {
      sid: 'lvs_abc',
      uid: 'usr_1',
      name: 'Karthik',
      chat: true,
    };
    const token = await mintChatToken(env, claims, 60);
    const verified = await verifyChatToken(env, token, 'lvs_abc');
    expect(verified).toMatchObject(claims);
    expect(verified?.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('rejects tokens for the wrong session or wrong pepper', async () => {
    const env = mockEnv('test-pepper');
    const token = await mintChatToken(env, {
      sid: 'lvs_abc',
      uid: null,
      name: 'guest',
      chat: false,
    });
    expect(await verifyChatToken(env, token, 'lvs_other')).toBeNull();
    expect(await verifyChatToken(mockEnv('other-pepper'), token, 'lvs_abc')).toBeNull();
  });

  it('rejects expired tokens', async () => {
    const env = mockEnv('test-pepper');
    const token = await mintChatToken(
      env,
      { sid: 'lvs_abc', uid: null, name: 'guest', chat: false },
      -10,
    );
    expect(await verifyChatToken(env, token, 'lvs_abc')).toBeNull();
  });
});
