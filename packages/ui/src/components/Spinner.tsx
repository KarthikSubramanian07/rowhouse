import { LoaderCircle } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface SpinnerProps {
  /** Pixel size of the spinner. Default 16. */
  size?: number;
  className?: string;
  /** Accessible label; when omitted the spinner is aria-hidden. */
  label?: string;
}

/**
 * Minimal loading spinner. The spin is guarded for prefers-reduced-motion
 * (via the `animate-spin` class → static in reduced-motion).
 */
export function Spinner({ size = 16, className, label }: SpinnerProps) {
  return (
    <LoaderCircle
      size={size}
      className={cn('animate-spin text-text-mid', className)}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
