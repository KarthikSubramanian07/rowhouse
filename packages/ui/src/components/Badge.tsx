import type * as React from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { cn } from '../lib/cn.js';

export const badge = tv({
  base: [
    'inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5',
    'font-mono text-xs uppercase tracking-[0.06em] leading-none',
    'border',
  ],
  variants: {
    variant: {
      default: 'border-border bg-surface-2 text-text-mid',
      accent: 'border-transparent bg-accent/15 text-accent-hi',
      locked: 'border-transparent bg-locked/15 text-locked',
      outline: 'border-border bg-transparent text-text-mid',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

/** Small mono status pill. Uppercase, engineered, terse. */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badge({ variant }), className)} {...props} />;
}
