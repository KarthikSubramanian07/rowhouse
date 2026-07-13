import { cn } from '../lib/cn.js';

export interface LiveBadgeProps {
  className?: string;
  /** Label text. Defaults to "LIVE". */
  label?: string;
}

/**
 * Pulsing cinema-red "LIVE" pill.
 * The dot pulse is guarded for prefers-reduced-motion (resolves to a steady dot).
 */
export function LiveBadge({ className, label = 'LIVE' }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-accent/40 bg-accent/12 px-2 py-0.5',
        'font-mono text-xs font-medium uppercase tracking-[0.12em] text-accent-hi',
        className,
      )}
    >
      <span className="relative inline-flex size-2">
        <span className="absolute inset-0 animate-live-pulse rounded-full bg-accent" />
        <span className="relative inline-flex size-2 rounded-full bg-accent" />
      </span>
      {label}
    </span>
  );
}
