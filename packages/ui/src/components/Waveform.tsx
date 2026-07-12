import type { ReactionMarker } from '@rowhouse/types';
import * as React from 'react';
import { cn } from '../lib/cn.js';
import { REACTION_COLORS } from '../lib/reactions.js';

export interface WaveformProps {
  /** Precomputed peak amplitudes 0..1. If omitted, a deterministic pattern is synthesized. */
  peaks?: number[];
  durationSeconds: number;
  positionSeconds: number;
  /** Reaction clusters overlaid as colored dots, sized by count. */
  markers?: ReactionMarker[];
  /** Seek callback; receives the target position in seconds. */
  onSeek?: (seconds: number) => void;
  className?: string;
  /** Canvas height in px. Default 72. */
  height?: number;
}

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const SYNTH_RESOLUTION = 512;

/** Deterministic PRNG so a synthesized waveform is stable across renders. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Synthesize a plausible audio-looking peak pattern from a seed. */
function synthPeaks(seed: number, n: number): number[] {
  const rnd = mulberry32((Math.max(1, Math.floor(seed) || 1) * 2654435761) >>> 0);
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const env = 0.5 + 0.5 * Math.sin((i / n) * Math.PI * 6 + 0.6);
    const detail = 0.35 + 0.65 * rnd();
    const spike = rnd() > 0.94 ? 1 : 0.62;
    out[i] = Math.min(1, 0.14 + env * detail * spike);
  }
  return out;
}

function readVar(el: Element, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

/**
 * Waveform — the async player centerpiece. A canvas-rendered commentary
 * waveform with a cinema-red playhead and reaction-marker dots clustered along
 * the timeline. Click or use the arrow keys to seek.
 */
export function Waveform({
  peaks,
  durationSeconds,
  positionSeconds,
  markers,
  onSeek,
  className,
  height = 72,
}: WaveformProps) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const resolvedPeaks = React.useMemo<number[]>(
    () => (peaks && peaks.length > 0 ? peaks : synthPeaks(durationSeconds, SYNTH_RESOLUTION)),
    [peaks, durationSeconds],
  );

  const duration = durationSeconds > 0 ? durationSeconds : 1;
  const progress = Math.max(0, Math.min(1, positionSeconds / duration));

  const draw = React.useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = wrap.clientWidth;
    if (width <= 0) return;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const colPlayed = readVar(wrap, '--accent', '#e0362e');
    const colUnplayed = readVar(wrap, '--text-dim', '#64646d');
    const colPlayhead = readVar(wrap, '--accent-hi', '#ff5b54');

    const step = BAR_WIDTH + BAR_GAP;
    const numBars = Math.max(1, Math.floor(width / step));
    const mid = height / 2;
    const playedX = progress * width;
    // Leave headroom at the top for reaction dots.
    const maxBar = mid - 8;

    for (let i = 0; i < numBars; i++) {
      const peakIndex = Math.min(
        resolvedPeaks.length - 1,
        Math.floor((i / numBars) * resolvedPeaks.length),
      );
      const amp = resolvedPeaks[peakIndex] ?? 0;
      const barH = Math.max(1.5, amp * maxBar);
      const x = i * step;
      ctx.fillStyle = x <= playedX ? colPlayed : colUnplayed;
      ctx.globalAlpha = x <= playedX ? 0.95 : 0.5;
      ctx.fillRect(x, mid - barH, BAR_WIDTH, barH * 2);
    }
    ctx.globalAlpha = 1;

    // Reaction marker dots (clustered, sized by count).
    if (markers && markers.length > 0) {
      let maxCount = 1;
      for (const m of markers) maxCount = Math.max(maxCount, m.count);
      for (const m of markers) {
        const mx = Math.max(0, Math.min(1, m.t / duration)) * width;
        const r = 2.5 + (Math.min(m.count, maxCount) / maxCount) * 4.5;
        const my = 7;
        ctx.beginPath();
        ctx.arc(mx, my, r, 0, Math.PI * 2);
        ctx.fillStyle = REACTION_COLORS[m.type];
        ctx.globalAlpha = 0.9;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Playhead.
    ctx.fillStyle = colPlayhead;
    ctx.fillRect(Math.max(0, playedX - 1), 0, 2, height);
  }, [resolvedPeaks, progress, duration, markers, height]);

  React.useEffect(() => {
    draw();
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw]);

  const seekFromClientX = (clientX: number) => {
    const wrap = wrapRef.current;
    if (!wrap || !onSeek) return;
    const rect = wrap.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onSeek(ratio * duration);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onSeek) return;
    const stepSec = e.shiftKey ? 30 : 5;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      onSeek(Math.min(duration, positionSeconds + stepSec));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onSeek(Math.max(0, positionSeconds - stepSec));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSeek(duration);
    }
  };

  const interactive = Boolean(onSeek);

  return (
    <div
      ref={wrapRef}
      data-slot="waveform"
      role={interactive ? 'slider' : undefined}
      aria-label={interactive ? 'Seek' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? Math.round(duration) : undefined}
      aria-valuenow={interactive ? Math.round(positionSeconds) : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? onKeyDown : undefined}
      onPointerDown={interactive ? (e) => seekFromClientX(e.clientX) : undefined}
      className={cn(
        'relative w-full select-none',
        interactive &&
          'cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        className,
      )}
      style={{ height }}
    >
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
