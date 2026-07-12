import { Slot } from 'radix-ui';
import * as React from 'react';
import { tv, type VariantProps } from 'tailwind-variants';
import { cn } from '../lib/cn.js';

export const button = tv({
  base: [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
    'font-sans font-medium rounded-md',
    'transition-colors duration-150',
    'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
    'disabled:pointer-events-none disabled:opacity-45',
  ],
  variants: {
    variant: {
      primary: 'bg-accent text-text-hi hover:bg-accent-hi active:bg-accent',
      ghost: 'bg-transparent text-text-mid hover:text-text-hi hover:bg-surface-2',
      outline:
        'border border-border bg-transparent text-text-hi hover:border-text-dim hover:bg-surface',
    },
    size: {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
    },
  },
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  /** Render the child element as the button (Radix Slot), merging props. */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      className={cn(button({ variant, size }), className)}
      {...(asChild ? {} : { type: type ?? 'button' })}
      {...props}
    />
  );
});
