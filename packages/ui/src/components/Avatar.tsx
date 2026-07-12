import { Avatar as AvatarPrimitive } from 'radix-ui';
import * as React from 'react';
import { cn } from '../lib/cn.js';

export interface AvatarProps extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> {
  src?: string | null;
  alt?: string;
  /** Shown while the image loads or if it fails (usually initials). */
  fallback?: React.ReactNode;
}

/** Radix Avatar with graceful image → fallback resolution. */
export const Avatar = React.forwardRef<
  React.ComponentRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(function Avatar({ className, src, alt, fallback, ...props }, ref) {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        'relative inline-flex size-9 shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-border bg-surface-2',
        className,
      )}
      {...props}
    >
      {src ? (
        <AvatarPrimitive.Image src={src} alt={alt ?? ''} className="size-full object-cover" />
      ) : null}
      <AvatarPrimitive.Fallback
        delayMs={src ? 300 : 0}
        className="flex size-full items-center justify-center font-mono text-xs uppercase text-text-mid"
      >
        {fallback}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});
