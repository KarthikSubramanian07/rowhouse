import type { ReactionType } from '@rowhouse/types';
import type { SyncStatus } from '@rowhouse/ui';
import {
  Avatar,
  Badge,
  Button,
  LiveBadge,
  ReactionBar,
  SyncLock,
  TimeCode,
  Waveform,
} from '@rowhouse/ui';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/client';
import { startMicCapture } from '../lib/sync-capture';

// Props (mirrors GET /live/:id).
export interface LiveSessionInfo {
  id: string;
  title: string;
  status: 'scheduled' | 'live' | 'ended' | 'canceled';
  mode: 'audio' | 'video';
  filmSlug: string;
  scheduledFor: number | null;
  startedAt: number | null;
  endedAt: number | null;
  peakViewers: number;
  trackId: string | null;
  platform: string | null;
}
export interface LiveCreatorInfo {
  handle: string;
  name: string;
  avatarUrl: string | null;
}
export interface LiveFilmInfo {
  title: string;
  slug: string;
  durationSeconds?: number;
}
export interface LiveDetail {
  session: LiveSessionInfo;
  creator: LiveCreatorInfo;
  film: LiveFilmInfo | null;
  wsUrl: string;
}

// Realtime message contracts.
type WsIn =
  | { kind: 'chat'; id: number; name: string; body: string; at: number }
  | { kind: 'reaction'; t: number; type: ReactionType }
  | { kind: 'presence'; viewers: number }
  | { kind: 'pong' };

type ConnState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface ChatLine {
  id: number;
  name: string;
  body: string;
  at: number;
}
interface Float {
  id: number;
  type: ReactionType;
  left: number;
}

const REACTION_EMOJI: Record<ReactionType, string> = {
  fire: '🔥',
  laugh: '😂',
  cry: '😢',
  shock: '⚡',
};

// Local keyframes for the equalizer + reaction bursts. Both carry data-rh-anim,
// which the design system disables under prefers-reduced-motion.
const LOCAL_STYLE = `
@keyframes rh-eq { 0%,100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
@keyframes rh-react-float {
  0% { opacity: 0; transform: translateY(6px) scale(0.7); }
  15% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-84px) scale(1.15); }
}`;

const CONN_LABEL: Record<ConnState, string> = {
  idle: 'offline',
  connecting: 'connecting',
  open: 'connected',
  closed: 'disconnected',
  error: 'error',
};

export default function LivePlayer({ session, creator, film, wsUrl }: LiveDetail) {
  const isLive = session.status === 'live';
  const duration = film?.durationSeconds ?? 5400;

  const wsRef = useRef<WebSocket | null>(null);
  const anchorRef = useRef<{ pos: number; wall: number } | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);
  const listenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const floatIdRef = useRef(0);

  const [conn, setConn] = useState<ConnState>('idle');
  const [messages, setMessages] = useState<ChatLine[]>([]);
  const [viewers, setViewers] = useState(session.peakViewers || 0);
  const [floats, setFloats] = useState<Float[]>([]);
  const [markers, setMarkers] = useState<{ t: number; type: ReactionType; count: number }[]>([]);
  const [draft, setDraft] = useState('');
  const [displayPos, setDisplayPos] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [manual, setManual] = useState('');
  const [note, setNote] = useState<string | null>(null);

  /** Current playback position: manual anchor if set, else elapsed since start. */
  function currentPos(): number {
    const a = anchorRef.current;
    if (a) return a.pos + (Date.now() - a.wall) / 1000;
    if (session.startedAt) return Math.max(0, Date.now() / 1000 - session.startedAt);
    return 0;
  }

  // Tick the display position (drives the waveform + locked readout).
  useEffect(() => {
    setDisplayPos(currentPos());
    const t = setInterval(() => setDisplayPos(currentPos()), 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open the live socket (only while the session is live).
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    let ping: ReturnType<typeof setInterval> | null = null;

    function spawnFloat(type: ReactionType) {
      const id = floatIdRef.current++;
      const left = 8 + Math.random() * 78;
      setFloats((prev) => [...prev.slice(-24), { id, type, left }]);
      setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1400);
    }

    function handleMessage(data: unknown) {
      if (typeof data !== 'string') return;
      let msg: WsIn;
      try {
        msg = JSON.parse(data) as WsIn;
      } catch {
        return;
      }
      switch (msg.kind) {
        case 'chat':
          setMessages((prev) => [
            ...prev.slice(-99),
            { id: msg.id, name: msg.name, body: msg.body, at: msg.at },
          ]);
          break;
        case 'reaction':
          spawnFloat(msg.type);
          setMarkers((prev) => [...prev.slice(-59), { t: msg.t, type: msg.type, count: 1 }]);
          break;
        case 'presence':
          setViewers(msg.viewers);
          break;
        case 'pong':
          break;
      }
    }

    (async () => {
      let name = 'guest';
      try {
        const me = await api<{ user: { displayName?: string } | null }>('/auth/me');
        if (me.user?.displayName) name = me.user.displayName;
      } catch {
        /* fall back to guest */
      }
      if (cancelled) return;
      setConn('connecting');
      ws = new WebSocket(`${wsUrl}?name=${encodeURIComponent(name)}&chat=1`);
      wsRef.current = ws;
      ws.onopen = () => setConn('open');
      ws.onmessage = (ev) => handleMessage(ev.data);
      ws.onclose = () => setConn('closed');
      ws.onerror = () => setConn('error');
      ping = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ kind: 'ping' }));
      }, 25000);
    })();

    return () => {
      cancelled = true;
      if (ping) clearInterval(ping);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [isLive, wsUrl]);

  // Release the mic if we unmount mid-listen.
  useEffect(
    () => () => {
      stopMicRef.current?.();
      if (listenTimerRef.current) clearTimeout(listenTimerRef.current);
    },
    [],
  );

  function sendChat(e: React.FormEvent) {
    e.preventDefault();
    const ws = wsRef.current;
    const body = draft.trim();
    if (!body || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ kind: 'chat', body }));
    setDraft('');
  }

  function sendReaction(type: ReactionType) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ kind: 'reaction', t: currentPos(), type }));
  }

  /**
   * Live sessions ship no fingerprint map yet, so the mic can only listen; it
   * can't lock on automatically. We still show the listening state, then hand
   * off to the manual entry, which is always visible.
   */
  async function startSync() {
    setNote(null);
    setSyncStatus('listening');
    try {
      const cap = await startMicCapture(() => {
        /* no fingerprint map for live, so the capture is discarded */
      });
      stopMicRef.current = cap.stop;
      listenTimerRef.current = setTimeout(() => {
        stopMicRef.current?.();
        stopMicRef.current = null;
        setSyncStatus((s) => (s === 'listening' ? 'idle' : s));
        setNote('No fingerprint map for this live session. Set your position manually below.');
      }, 2600);
    } catch {
      setSyncStatus('idle');
      setNote('Could not access the microphone. Set your position manually below.');
    }
  }

  function applyManual() {
    const parts = manual.split(':').map((n) => Number.parseInt(n, 10));
    let seconds = 0;
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n)))
      seconds = parts[0]! * 60 + parts[1]!;
    else if (parts.length === 3 && parts.every((n) => Number.isFinite(n)))
      seconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    else return;
    seconds = Math.min(duration, Math.max(0, seconds));
    anchorRef.current = { pos: seconds, wall: Date.now() };
    setDisplayPos(seconds);
    setSyncStatus('locked');
    setNote(null);
  }

  const initials = creator.name.slice(0, 1).toUpperCase();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <style dangerouslySetInnerHTML={{ __html: LOCAL_STYLE }} />

      {/* Left column: stream and sync. */}
      <div className="flex flex-col gap-6">
        {/* Stream panel (audio transport is stubbed in this build). */}
        <div className="relative overflow-hidden rounded-lg border border-border bg-surface/60">
          <div className="flex aspect-video flex-col items-center justify-center gap-5 bg-[radial-gradient(circle_at_50%_35%,var(--surface-2),var(--bg))] p-6">
            {/* Floating reaction bursts. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {floats.map((f) => (
                <span
                  key={f.id}
                  data-rh-anim
                  className="absolute bottom-20 text-2xl"
                  style={{ left: `${f.left}%`, animation: 'rh-react-float 1.4s ease-out forwards' }}
                  aria-hidden
                >
                  {REACTION_EMOJI[f.type]}
                </span>
              ))}
            </div>

            <Avatar
              src={creator.avatarUrl}
              alt={creator.name}
              fallback={initials}
              className="size-16 text-base"
            />
            <div className="text-center">
              <p className="font-display text-lg text-text-hi">{creator.name}</p>
              <div className="mt-2 flex items-center justify-center gap-2">
                {isLive ? (
                  <LiveBadge label={`Live ${session.mode} commentary`} />
                ) : (
                  <Badge variant="outline">{session.status}</Badge>
                )}
              </div>
            </div>

            {/* Calm equalizer. Suggests audio without claiming it plays. */}
            <div className="flex h-10 items-end gap-1" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <span
                  key={i}
                  data-rh-anim
                  className="w-1 rounded-full bg-accent/70"
                  style={{
                    height: '100%',
                    transformOrigin: 'bottom',
                    animation: isLive ? `rh-eq 1.1s ease-in-out ${i * 0.12}s infinite` : 'none',
                    opacity: isLive ? 1 : 0.3,
                  }}
                />
              ))}
            </div>
          </div>
          <p className="border-t border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-text-dim">
            audio transport is stubbed in this build
          </p>
        </div>

        {/* Sync panel. Manual entry and resync stay visible. */}
        <div className="rounded-lg border border-border bg-surface/60 p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-text-mid">Sync to my film</p>
              <p className="text-xs text-text-dim">
                Press play on {film ? film.title : 'your film'}, then line the commentary up to your
                frame.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={startSync}>
              {syncStatus === 'listening' ? 'Listening...' : 'Sync to my film'}
            </Button>
          </div>

          <SyncLock
            status={syncStatus}
            positionSeconds={displayPos}
            confidence={syncStatus === 'locked' ? 1 : 0}
            onResync={startSync}
          />

          <div className="mt-5">
            <Waveform
              durationSeconds={duration}
              positionSeconds={displayPos}
              markers={markers}
              height={80}
            />
          </div>

          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-text-dim hover:text-text-mid">
              I&apos;m at a specific timecode
            </summary>
            <div className="mt-3 flex items-center gap-2">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="14:32"
                inputMode="numeric"
                className="w-24 rounded-md border border-border bg-bg px-2 py-1.5 font-mono text-sm text-text-hi outline-none focus:border-accent"
              />
              <Button size="sm" variant="ghost" onClick={applyManual}>
                Lock here
              </Button>
            </div>
          </details>

          {note && <p className="mt-3 text-sm text-accent-hi">{note}</p>}
        </div>
      </div>

      {/* Right column: chat and reactions. */}
      <aside className="flex min-h-[420px] flex-col rounded-lg border border-border bg-surface/60">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase tracking-widest text-text-mid">
              Live chat
            </span>
            <Badge variant={conn === 'open' ? 'accent' : 'default'}>{CONN_LABEL[conn]}</Badge>
          </div>
          <span className="font-mono text-xs text-text-dim">
            {viewers.toLocaleString()} watching
          </span>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3" style={{ maxHeight: 420 }}>
          {messages.length === 0 ? (
            <p className="text-sm text-text-dim">
              {isLive ? 'No messages yet. Say hi.' : 'Chat opens when the session goes live.'}
            </p>
          ) : (
            messages.map((m) => (
              <p key={m.id} className="text-sm leading-snug">
                <span className="font-mono text-xs text-accent-hi">{m.name}</span>{' '}
                <span className="text-text-mid">{m.body}</span>
              </p>
            ))
          )}
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-dim">
              React
            </span>
            <ReactionBar onReact={sendReaction} disabled={!isLive || conn !== 'open'} />
          </div>
          <form onSubmit={sendChat} className="flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={isLive ? 'Say something...' : 'Chat is closed'}
              disabled={!isLive || conn !== 'open'}
              className="h-9 flex-1 rounded-md border border-border bg-bg px-3 text-sm text-text-hi outline-none placeholder:text-text-dim focus:border-accent disabled:opacity-50"
            />
            <Button size="sm" type="submit" disabled={!isLive || conn !== 'open' || !draft.trim()}>
              Send
            </Button>
          </form>
        </div>
      </aside>

      {/* Elapsed readout for the whole session. */}
      <p className="font-mono text-xs text-text-dim lg:col-span-2">
        {isLive && session.startedAt ? (
          <>
            elapsed <TimeCode seconds={displayPos} className="text-text-mid" /> · peak{' '}
            {session.peakViewers.toLocaleString()} viewers
          </>
        ) : session.status === 'ended' ? (
          'this session has ended'
        ) : session.scheduledFor ? (
          `scheduled for ${new Date(session.scheduledFor * 1000).toLocaleString()}`
        ) : (
          'not started yet'
        )}
      </p>
    </div>
  );
}
