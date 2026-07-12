import { formatTimecode } from '@rowhouse/types';
import { cn } from '../lib/cn.js';

export interface TimeCodeProps {
  /** Position in seconds. Formatted via `formatTimecode` from @rowhouse/types. */
  seconds: number;
  className?: string;
}

/**
 * TimeCode — the signature typographic object. Mono, tabular figures so digits
 * never jitter as they tick. Renders e.g. `1:23:14` or `4:07`.
 */
export function TimeCode({ seconds, className }: TimeCodeProps) {
  return (
    <span
      data-slot="timecode"
      className={cn(
        'font-mono text-text-hi tabular-nums [font-variant-numeric:tabular-nums] tracking-[-0.01em]',
        className,
      )}
    >
      {formatTimecode(seconds)}
    </span>
  );
}
