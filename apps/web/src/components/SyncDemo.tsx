import {
  buildFingerprintMap,
  fingerprint,
  LiveSyncSession,
  type LiveSyncState,
} from '@rowhouse/sync-engine';
import { generateReference } from '@rowhouse/sync-engine/testing';
import { Button, SyncLock, Waveform } from '@rowhouse/ui';
import { useEffect, useRef, useState } from 'react';
import { playBuffer, startMicCapture } from '../lib/sync-capture';

const SR = 8000;
const REF_SECONDS = 48;
const DEMO_SEED = 7;
// Where "the film" is currently playing — the sync must discover this exact frame.
const START_OFFSET = 18;

const DEMO_MARKERS = [
  { t: 6, type: 'laugh' as const, count: 40 },
  { t: 15, type: 'shock' as const, count: 120 },
  { t: 22, type: 'fire' as const, count: 88 },
  { t: 33, type: 'cry' as const, count: 150 },
  { t: 41, type: 'shock' as const, count: 64 },
];

type Mode = 'idle' | 'simulate' | 'mic';

export default function SyncDemo() {
  const [state, setState] = useState<LiveSyncState>({
    status: 'idle',
    positionSeconds: 0,
    anchorSeconds: 0,
    confidence: 0,
    score: 0,
    agreement: 0,
    audioClockSeconds: 0,
  });
  const [mode, setMode] = useState<Mode>('idle');
  const [displayPos, setDisplayPos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const referenceRef = useRef<Float32Array | null>(null);
  const sessionRef = useRef<LiveSyncSession | null>(null);
  const feedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lockRef = useRef<{ pos: number; wall: number } | null>(null);
  const stopMicRef = useRef<(() => void) | null>(null);
  const playRef = useRef<{ stop: () => void } | null>(null);

  // Build the reference + fingerprint map once, entirely client-side.
  useEffect(() => {
    const ref = generateReference(REF_SECONDS, DEMO_SEED);
    referenceRef.current = ref;
    sessionRef.current = new LiveSyncSession(buildFingerprintMap(fingerprint(ref, SR)));
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (feedRef.current) clearInterval(feedRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    stopMicRef.current?.();
    playRef.current?.stop();
    feedRef.current = null;
    rafRef.current = null;
    stopMicRef.current = null;
    playRef.current = null;
  }

  function tickDisplay() {
    if (lockRef.current) {
      const { pos, wall } = lockRef.current;
      setDisplayPos(pos + (performance.now() - wall) / 1000);
    }
    rafRef.current = requestAnimationFrame(tickDisplay);
  }

  function onNewState(s: LiveSyncState) {
    setState(s);
    if (s.status === 'locked' && !lockRef.current) {
      lockRef.current = { pos: s.positionSeconds, wall: performance.now() };
      if (!rafRef.current) rafRef.current = requestAnimationFrame(tickDisplay);
    }
  }

  function reset() {
    cleanup();
    lockRef.current = null;
    sessionRef.current?.resync();
    setState((prev) => ({ ...prev, status: 'idle', positionSeconds: 0 }));
    setDisplayPos(0);
    setMode('idle');
  }

  /** Simulate: feed the reference straight into the engine — always works, no mic. */
  function startSimulate() {
    if (!referenceRef.current || !sessionRef.current) return;
    reset();
    setMode('simulate');
    const ref = referenceRef.current;
    const session = sessionRef.current;
    let i = 0;
    feedRef.current = setInterval(() => {
      const from = (START_OFFSET + i) * SR;
      const chunk = ref.subarray(from, from + SR);
      if (chunk.length < SR) {
        if (feedRef.current) clearInterval(feedRef.current);
        return;
      }
      onNewState(session.pushCapture(Float32Array.from(chunk), SR));
      i++;
      if (i >= 8 && feedRef.current) clearInterval(feedRef.current); // locked well before this
    }, 650);
  }

  /** Microphone: play the reference through the speakers and let the mic hear it. */
  async function startMic() {
    if (!referenceRef.current || !sessionRef.current) return;
    reset();
    setError(null);
    setMode('mic');
    const ref = referenceRef.current;
    const session = sessionRef.current;
    playRef.current = playBuffer(ref.subarray(START_OFFSET * SR), SR);
    try {
      stopMicRef.current = (
        await startMicCapture((chunk, sr) => onNewState(session.pushCapture(chunk, sr)))
      ).stop;
    } catch {
      setError('Microphone access was denied — try the simulation instead.');
      setMode('idle');
      playRef.current?.stop();
    }
  }

  const pos = state.status === 'locked' ? displayPos : state.positionSeconds;

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs uppercase tracking-widest text-text-mid">Sync demo</p>
        <p className="font-mono text-xs text-text-dim">
          reference @ {START_OFFSET}s · found automatically
        </p>
      </div>

      <SyncLock
        status={state.status}
        positionSeconds={pos}
        confidence={state.confidence}
        onResync={state.status === 'locked' ? startSimulate : undefined}
      />

      <div className="mt-5">
        <Waveform
          durationSeconds={REF_SECONDS}
          positionSeconds={pos}
          markers={DEMO_MARKERS}
          height={80}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {state.status !== 'locked' ? (
          <>
            <Button onClick={startSimulate}>
              {mode === 'simulate' ? 'Listening…' : 'Run the sync'}
            </Button>
            <Button variant="outline" onClick={startMic}>
              Try with your microphone
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={reset}>
            Reset
          </Button>
        )}
        <span className="font-mono text-xs text-text-dim">
          {state.status === 'locked'
            ? `locked · ${Math.round(state.confidence * 100)}% confidence · ${state.score} landmarks`
            : mode === 'mic'
              ? 'playing the reference — hold your phone near the speaker'
              : 'no film audio is ever stored — only a fingerprint'}
        </span>
      </div>
      {error && <p className="mt-3 text-sm text-accent-hi">{error}</p>}
    </div>
  );
}
