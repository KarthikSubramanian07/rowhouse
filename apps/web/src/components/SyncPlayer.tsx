import { FingerprintMap, LiveSyncSession, type SyncStatus } from '@rowhouse/sync-engine';
import { formatTimecode, type ReactionType } from '@rowhouse/types';
import { Button, ReactionBar, SyncLock, TimeCode, Waveform } from '@rowhouse/ui';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/client';
import { startMicCapture } from '../lib/sync-capture';

export interface TrackDetail {
  track: {
    id: string;
    title: string;
    durationSeconds: number;
    completionRate: number;
    hasFingerprint: boolean;
    isLiveReplay: boolean;
    tone: string | null;
  };
  creator: { handle: string; name: string };
  film: { title: string; slug: string } | null;
  markers: { t: number; type: ReactionType; count: number }[];
  chapters: { t: number; title: string }[];
  audioUrl: string;
  fingerprintUrl: string | null;
}

export default function SyncPlayer({ detail }: { detail: TrackDetail }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionRef = useRef<LiveSyncSession | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);
  const listenLogged = useRef(false);

  const [position, setPosition] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [confidence, setConfidence] = useState(0);
  const [manual, setManual] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const duration = detail.track.durationSeconds;

  useEffect(() => () => stopMicRef.current?.(), []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio
        .play()
        .catch(() => setNote('Commentary audio is not available for this demo track.'));
      if (!listenLogged.current) {
        listenLogged.current = true;
        void api(`/tracks/${detail.track.id}/listen`, {
          method: 'POST',
          body: JSON.stringify({ completed: false }),
        }).catch(() => {});
      }
    } else {
      audio.pause();
    }
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (audio) audio.currentTime = seconds;
    setPosition(seconds);
  }

  /** Hold up your phone: match the film audio and jump the commentary to that frame. */
  async function startSync() {
    if (!detail.fingerprintUrl) {
      setNote('This track has no fingerprint map yet. Use the manual position below.');
      return;
    }
    setNote(null);
    setSyncStatus('listening');
    try {
      const buf = await fetch(detail.fingerprintUrl).then((r) => r.arrayBuffer());
      const session = new LiveSyncSession(FingerprintMap.deserialize(buf));
      sessionRef.current = session;
      stopMicRef.current = (
        await startMicCapture((chunk, sr) => {
          const s = session.pushCapture(chunk, sr);
          setSyncStatus(s.status);
          setConfidence(s.confidence);
          if (s.status === 'locked') {
            seek(s.positionSeconds);
            void audioRef.current?.play().catch(() => {});
            stopMicRef.current?.();
            stopMicRef.current = null;
          }
        })
      ).stop;
    } catch {
      setSyncStatus('idle');
      setNote('Could not access the microphone. Use the manual position below.');
    }
  }

  function applyManual() {
    const parts = manual.split(':').map((n) => Number.parseInt(n, 10));
    let seconds = 0;
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n)))
      seconds = parts[0]! * 60 + parts[1]!;
    else if (parts.length === 3) seconds = parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    else return;
    seek(Math.min(duration, Math.max(0, seconds)));
    void audioRef.current?.play().catch(() => {});
  }

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5 sm:p-6">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        src={detail.audioUrl}
        preload="none"
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          void api(`/tracks/${detail.track.id}/listen`, {
            method: 'POST',
            body: JSON.stringify({ completed: true }),
          }).catch(() => {});
        }}
      />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? 'Pause' : 'Play commentary'}
          </Button>
          <TimeCode seconds={position} className="text-text-mid" />
          <span className="text-text-dim">/</span>
          <TimeCode seconds={duration} className="text-text-dim" />
        </div>
        <ReactionBar onReact={() => {}} />
      </div>

      <div className="mt-5">
        <Waveform
          durationSeconds={duration}
          positionSeconds={position}
          markers={detail.markers}
          onSeek={seek}
          height={84}
        />
      </div>

      {detail.chapters.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {detail.chapters.map((ch) => (
            <button
              key={`${ch.t}-${ch.title}`}
              type="button"
              onClick={() => seek(ch.t)}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text-mid transition-colors hover:border-accent/50 hover:text-text-hi"
            >
              <span className="font-mono text-text-dim">{formatTimecode(ch.t)}</span> · {ch.title}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="text-sm text-text-mid">Watching along?</p>
          <p className="text-xs text-text-dim">
            Press play on your film, then sync. The commentary jumps to your exact frame.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={startSync}>
            {syncStatus === 'listening' ? 'Listening...' : 'Sync to my film'}
          </Button>
        </div>
      </div>

      {syncStatus !== 'idle' && (
        <div className="mt-4">
          <SyncLock
            status={syncStatus}
            positionSeconds={position}
            confidence={confidence}
            onResync={startSync}
          />
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-text-dim hover:text-text-mid">
          No mic? Enter your position manually
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
            Jump here
          </Button>
        </div>
      </details>

      {note && <p className="mt-3 text-sm text-accent-hi">{note}</p>}
    </div>
  );
}
