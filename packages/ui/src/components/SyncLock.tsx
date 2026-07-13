import { RefreshCw } from 'lucide-react';
import { cn } from '../lib/cn.js';
import { TimeCode } from './TimeCode.js';

export type SyncStatus = 'idle' | 'listening' | 'locked';

export interface SyncLockProps {
  status: SyncStatus;
  /** Resolved position, shown when locked. */
  positionSeconds?: number;
  /** Match confidence 0..1, shown as a subtle readout when locked. */
  confidence?: number;
  /** Re-run the sync. Always available; it is precision tuning, not a failure state. */
  onResync?: () => void;
  className?: string;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: 'idle',
  listening: 'listening',
  locked: 'locked',
};

/**
 * SyncLock: an instrument panel, not a spinner.
 *
 *   idle       quiet, waiting. A muted readout.
 *   listening  a sweep scans for the position (oscilloscope-like). Reduced-motion
 *              collapses the sweep to a static "listening...".
 *   locked     resolves to the semantic "locked" green: the big mono TimeCode
 *              plus a confidence readout. Resync stays visible.
 */
export function SyncLock({
  status,
  positionSeconds,
  confidence,
  onResync,
  className,
}: SyncLockProps) {
  const isLocked = status === 'locked';
  const isListening = status === 'listening';
  const confidencePct =
    confidence != null ? Math.round(Math.max(0, Math.min(1, confidence)) * 100) : null;

  return (
    <div
      data-slot="sync-lock"
      data-status={status}
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col gap-3 rounded-md border bg-surface-2 p-3',
        isLocked ? 'border-locked/40' : 'border-border',
        className,
      )}
    >
      {/* Header: status dot + label + resync */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full',
              isLocked && 'bg-locked',
              isListening && 'animate-live-pulse bg-accent',
              status === 'idle' && 'bg-text-dim',
            )}
          />
          <span
            className={cn(
              'font-mono text-[0.6875rem] uppercase tracking-[0.14em]',
              isLocked ? 'text-locked' : 'text-text-mid',
            )}
          >
            sync: {STATUS_LABEL[status]}
          </span>
        </div>

        {onResync ? (
          <button
            type="button"
            onClick={onResync}
            aria-label="Resync"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-sm px-1.5 py-1',
              'font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-text-dim',
              'transition-colors hover:text-text-hi',
              'outline-none focus-visible:ring-2 focus-visible:ring-accent',
            )}
          >
            <RefreshCw className="size-3" aria-hidden />
            resync
          </button>
        ) : null}
      </div>

      {/* Readout */}
      {isLocked ? (
        <div className="flex items-baseline gap-3">
          <TimeCode seconds={positionSeconds ?? 0} className="text-2xl text-locked" />
          {confidencePct != null ? (
            <span className="font-mono text-xs text-text-dim">{confidencePct}% match</span>
          ) : null}
        </div>
      ) : isListening ? (
        <div className="flex items-center gap-3">
          <div className="relative h-9 flex-1 overflow-hidden rounded-sm border border-border bg-bg">
            {/* tick grid */}
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(90deg, var(--border) 0 1px, transparent 1px 12px)',
              }}
            />
            {/* baseline */}
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
            {/* the sweep */}
            <div
              aria-hidden
              data-rh-scan-sweep
              className="absolute inset-y-0 left-0 w-16 animate-scan"
              style={{
                background:
                  'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent) 55%, transparent), transparent)',
              }}
            />
          </div>
          <span className="shrink-0 font-mono text-xs text-accent-hi">listening...</span>
        </div>
      ) : (
        <div className="font-mono text-2xl text-text-dim tabular-nums">--:--</div>
      )}
    </div>
  );
}
