import type * as React from 'react';
import { Toaster as SonnerToaster, toast } from 'sonner';

export type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

/**
 * Themed sonner Toaster — dark, engineered, token-aligned. Mount once near the
 * app root. Fire toasts with the re-exported `toast`.
 */
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-hi)',
          borderRadius: 'var(--radius-2)',
          fontFamily: 'var(--rh-font-ui)',
          fontSize: 'var(--type-sm)',
        },
      }}
      {...props}
    />
  );
}

export { toast };
