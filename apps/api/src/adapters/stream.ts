/**
 * Live-stream transport. Behind an adapter so the platform is fully functional
 * (chat, reactions, sync, auto-save) without any streaming vendor. Real audio/
 * video transport (100ms.live free tier, or Cloudflare Realtime as the in-
 * ecosystem alternative) plugs in later. Mock is the default.
 */
import type { StreamMode } from '@rowhouse/types';
import type { Env } from '../env.js';

export interface StreamRoom {
  roomId: string;
  /** Token the creator's client uses to publish. */
  publishToken: string;
  /** Token/URL listeners use to subscribe. */
  subscribeToken: string;
  provider: string;
}

export interface StreamProvider {
  readonly name: 'mock' | 'hundred-ms' | 'cloudflare-realtime';
  createRoom(sessionId: string, mode: StreamMode): Promise<StreamRoom>;
  endRoom(roomId: string): Promise<void>;
}

/** No external transport; the live experience runs on the ChatRoom DO alone. */
export class MockStreamProvider implements StreamProvider {
  readonly name = 'mock' as const;
  async createRoom(sessionId: string, mode: StreamMode): Promise<StreamRoom> {
    return {
      roomId: `mock-${sessionId}`,
      publishToken: `pub-${sessionId}-${mode}`,
      subscribeToken: `sub-${sessionId}`,
      provider: 'mock',
    };
  }
  async endRoom(): Promise<void> {
    /* no-op */
  }
}

export function resolveStream(_env: Env): StreamProvider {
  // 100ms / Cloudflare Realtime activate here when their secrets are supplied.
  return new MockStreamProvider();
}
