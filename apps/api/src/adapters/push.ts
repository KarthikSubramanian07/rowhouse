/**
 * Web Push (VAPID). Free forever, no vendor. Mock is the default (no VAPID keys);
 * the real sender uses @pushforge/builder, which does VAPID + RFC 8291 payload
 * encryption on the Workers runtime via WebCrypto. The "creator went live" push
 * is the platform's single highest-value retention touchpoint (spec §06).
 */
import type { PushSubscriptionInput } from '@rowhouse/types';
import type { Env } from '../env.js';

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface PushProvider {
  readonly name: 'mock' | 'web-push';
  send(sub: PushSubscriptionInput, msg: PushMessage): Promise<{ ok: boolean; status: number }>;
}

export class MockPushProvider implements PushProvider {
  readonly name = 'mock' as const;
  async send(): Promise<{ ok: boolean; status: number }> {
    return { ok: true, status: 200 };
  }
}

export class WebPushProvider implements PushProvider {
  readonly name = 'web-push' as const;
  constructor(private readonly env: Env) {}

  async send(
    sub: PushSubscriptionInput,
    msg: PushMessage,
  ): Promise<{ ok: boolean; status: number }> {
    const { buildPushPayload } = await import('@pushforge/builder');
    const request = await buildPushPayload(
      { data: msg, options: { ttl: 60 * 60, urgency: 'high' } },
      { endpoint: sub.endpoint, keys: sub.keys },
      {
        subject: this.env.VAPID_SUBJECT,
        publicKey: this.env.VAPID_PUBLIC_KEY as string,
        privateKey: this.env.VAPID_PRIVATE_KEY as string,
      },
    );
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: request.headers as Record<string, string>,
      body: request.body,
    });
    return { ok: res.ok, status: res.status };
  }
}

export function resolvePush(env: Env): PushProvider {
  return env.VAPID_PRIVATE_KEY && env.VAPID_PUBLIC_KEY
    ? new WebPushProvider(env)
    : new MockPushProvider();
}
