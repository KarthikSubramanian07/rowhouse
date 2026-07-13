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
  canChat: boolean;
}

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

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    const meta: SocketMeta = {
      userId: url.searchParams.get('uid'),
      name: url.searchParams.get('name') ?? 'guest',
      canChat: url.searchParams.get('chat') === '1',
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
    const msg = result.data;

    if (msg.kind === 'ping') {
      ws.send(JSON.stringify({ kind: 'pong' } satisfies Outbound));
      return;
    }
    if (msg.kind === 'chat') {
      if (!meta?.canChat) return;
      const at = Date.now();
      this.sql().exec(
        'INSERT INTO messages (name, body, at) VALUES (?, ?, ?)',
        meta.name,
        msg.body,
        at,
      );
      const row = this.sql().exec('SELECT last_insert_rowid() AS id').one();
      this.broadcast({ kind: 'chat', id: Number(row.id), name: meta.name, body: msg.body, at });
      return;
    }
    if (msg.kind === 'reaction') {
      this.sql().exec(
        'INSERT INTO reactions (t, type, at) VALUES (?, ?, ?)',
        msg.t,
        msg.type,
        Date.now(),
      );
      this.broadcast({ kind: 'reaction', t: msg.t, type: msg.type });
    }
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
