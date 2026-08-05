/**
 * ChatRoom is one Durable Object per live session. It uses the WebSocket
 * Hibernation API so idle rooms cost no GB-s (needed to stay at $0). It fans out
 * chat and reaction markers to all connected clients and persists them in the DO's
 * SQLite, so late joiners get backfill and the finished session can be assembled
 * into an async track with the room's reactions preserved.
 */
import { DurableObject } from 'cloudflare:workers';
import type { ReactionType } from '@rowhouse/types';
import { liveClientMessageSchema } from '@rowhouse/types';
import { checkInternalAuth } from '../auth/chatToken.js';
import type { Env } from '../env.js';

interface SocketMeta {
  userId: string | null;
  name: string;
  /** Signed-in participant (may send chat text). Guests may still react. */
  canChat: boolean;
  /** Sliding-window rate-limit state (per connection). */
  winStart: number;
  count: number;
}

/** Per-connection abuse limits. */
const RATE_WINDOW_MS = 10_000;
const RATE_MAX = 15; // posts (chat + reactions) per window
const MAX_CONNECTIONS = 2_000; // per room
const MAX_MESSAGES = 500; // retained chat rows (backfill window)
const MAX_REACTIONS = 20_000; // retained reaction rows (DoS ceiling)

interface ChatOut {
  kind: 'chat';
  id: number;
  name: string;
  body: string;
  at: number;
}
interface ReactionOut {
  kind: 'reaction';
  t: number;
  type: ReactionType;
}
interface PresenceOut {
  kind: 'presence';
  viewers: number;
}
type Outbound = ChatOut | ReactionOut | PresenceOut | { kind: 'pong' };

export class ChatRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.sql().exec(
        `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, body TEXT, at INTEGER);
         CREATE TABLE IF NOT EXISTS reactions (t REAL, type TEXT, at INTEGER);
         CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER);`,
      );
    });
  }

  private sql() {
    return this.ctx.storage.sql;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Internal: the API pulls the reaction timeline to assemble the async track.
    if (url.pathname.endsWith('/timeline')) {
      if (!checkInternalAuth(this.env, request)) {
        return new Response('forbidden', { status: 403 });
      }
      return Response.json(this.timeline());
    }

    if (request.headers.get('upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    if (this.ctx.getWebSockets().length >= MAX_CONNECTIONS) {
      return new Response('room full', { status: 503 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const meta: SocketMeta = {
      userId: url.searchParams.get('uid'),
      name: (url.searchParams.get('name') ?? 'guest').slice(0, 40),
      canChat: url.searchParams.get('chat') === '1',
      winStart: 0,
      count: 0,
    };
    // Hibernatable accept: the runtime tracks the socket across eviction.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment(meta);

    this.backfill(server);
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    const result = liveClientMessageSchema.safeParse(parsed);
    if (!result.success) return;
    const meta = ws.deserializeAttachment() as SocketMeta | null;
    if (!meta) return;
    const msg = result.data;

    if (msg.kind === 'ping') {
      ws.send(JSON.stringify({ kind: 'pong' } satisfies Outbound));
      return;
    }

    // Rate-limit every post (chat + reactions) per connection to prevent flooding
    // and storage amplification. Guests may react; only signed-in users may chat.
    if (!this.allow(ws, meta)) return;

    if (msg.kind === 'chat') {
      if (!meta.canChat) return;
      const at = Date.now();
      this.sql().exec(
        'INSERT INTO messages (name, body, at) VALUES (?, ?, ?)',
        meta.name,
        msg.body,
        at,
      );
      const row = this.sql().exec('SELECT last_insert_rowid() AS id').one();
      this.sql().exec(
        'DELETE FROM messages WHERE id <= (SELECT MAX(id) FROM messages) - ?',
        MAX_MESSAGES,
      );
      this.broadcast({ kind: 'chat', id: Number(row.id), name: meta.name, body: msg.body, at });
      return;
    }
    if (msg.kind === 'reaction') {
      const count = Number(this.sql().exec('SELECT COUNT(*) AS c FROM reactions').one().c ?? 0);
      if (count >= MAX_REACTIONS) return;
      this.sql().exec(
        'INSERT INTO reactions (t, type, at) VALUES (?, ?, ?)',
        msg.t,
        msg.type,
        Date.now(),
      );
      this.broadcast({ kind: 'reaction', t: msg.t, type: msg.type });
    }
  }

  /** Per-connection sliding-window rate limit. Updates the socket attachment. */
  private allow(ws: WebSocket, meta: SocketMeta): boolean {
    const now = Date.now();
    if (now - meta.winStart > RATE_WINDOW_MS) {
      meta.winStart = now;
      meta.count = 0;
    }
    meta.count++;
    ws.serializeAttachment(meta);
    return meta.count <= RATE_MAX;
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    try {
      ws.close();
    } catch {
      /* already closed */
    }
    this.broadcastPresence();
  }

  override async webSocketError(): Promise<void> {
    this.broadcastPresence();
  }

  private backfill(ws: WebSocket): void {
    const recent = this.sql()
      .exec('SELECT id, name, body, at FROM messages ORDER BY id DESC LIMIT 50')
      .toArray()
      .reverse();
    for (const r of recent) {
      ws.send(
        JSON.stringify({
          kind: 'chat',
          id: Number(r.id),
          name: String(r.name),
          body: String(r.body),
          at: Number(r.at),
        } satisfies ChatOut),
      );
    }
  }

  private broadcast(msg: Outbound): void {
    const payload = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(payload);
      } catch {
        /* socket gone */
      }
    }
  }

  private broadcastPresence(): void {
    const viewers = this.ctx.getWebSockets().length;
    const prevPeak = Number(
      this.sql().exec("SELECT v FROM meta WHERE k='peak'").toArray()[0]?.v ?? 0,
    );
    if (viewers > prevPeak) {
      this.sql().exec(
        "INSERT INTO meta (k, v) VALUES ('peak', ?) ON CONFLICT(k) DO UPDATE SET v=?",
        viewers,
        viewers,
      );
    }
    this.broadcast({ kind: 'presence', viewers });
  }

  /** Reaction timeline and peak viewers, consumed by track assembly on session end. */
  timeline(): { reactions: { t: number; type: string }[]; peakViewers: number; chatCount: number } {
    const reactions = this.sql()
      .exec('SELECT t, type FROM reactions ORDER BY t ASC')
      .toArray()
      .map((r) => ({ t: Number(r.t), type: String(r.type) }));
    const peakViewers = Number(
      this.sql().exec("SELECT v FROM meta WHERE k='peak'").toArray()[0]?.v ?? 0,
    );
    const chatCount = Number(this.sql().exec('SELECT COUNT(*) AS c FROM messages').one().c ?? 0);
    return { reactions, peakViewers, chatCount };
  }
}
