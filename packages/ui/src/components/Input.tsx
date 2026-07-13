import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Visual invalid state (also wire aria-invalid on the element). */
  invalid?: boolean;
}

/** Text input. Dark surface, cinema-red focus ring. */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid = false, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        'flex h-10 w-full rounded-md border bg-surface px-3 py-2',
        'font-sans text-base text-text-hi placeholder:text-text-dim',
        'transition-colors outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-50',
        invalid ? 'border-accent' : 'border-border focus-visible:border-text-dim',
        className,
      )}
      {...props}
    />
  );
});
