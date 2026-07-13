import { cn } from '../lib/cn.js';

export interface WordmarkProps {
  className?: string;
  /** Overall scale. Default 'md'. */
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'text-md',
  md: 'text-xl',
  lg: 'text-2xl',
} as const;

/**
 * "Rowhouse" wordmark. The "ow" carries the single cinema-red accent (a row of
 * seats lit by the screen).
 */
export function Wordmark({ className, size = 'md' }: WordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-baseline font-sans font-semibold leading-none tracking-[-0.02em] text-text-hi',
        SIZES[size],
        className,
      )}
      aria-label="Rowhouse"
    >
      <span aria-hidden>R</span>
      <span aria-hidden className="text-accent">
        ow
      </span>
      <span aria-hidden>house</span>
    </span>
  );
}

export interface LogoProps {
  className?: string;
  /** Pixel size of the square mark. Default 24. */
  size?: number;
  /** Accessible title. Set to null to mark decorative. */
  title?: string | null;
}

/**
 * Logo mark: a row of seats in the dark, one lit cinema-red. No gradients.
 */
export function Logo({ className, size = 24, title = 'Rowhouse' }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      {/* screen line */}
      <rect x="3" y="4" width="18" height="2" rx="1" className="fill-text-dim" />
      {/* row of seats */}
      <rect x="3" y="14" width="3" height="6" rx="1" className="fill-text-mid" />
      <rect x="7.5" y="14" width="3" height="6" rx="1" className="fill-text-mid" />
      <rect x="12" y="14" width="3" height="6" rx="1" className="fill-accent" />
      <rect x="16.5" y="14" width="3" height="6" rx="1" className="fill-text-mid" />
    </svg>
  );
}
