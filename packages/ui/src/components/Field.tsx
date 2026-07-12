import type * as React from 'react';
import { cn } from '../lib/cn.js';

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  /** id of the control this field labels (wires htmlFor). */
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

/** Labeled form field: label + control (children) + hint/error line. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  className,
  children,
  ...props
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label ? (
        <label
          htmlFor={htmlFor}
          className="font-mono text-xs uppercase tracking-[0.06em] text-text-mid"
        >
          {label}
          {required ? <span className="ml-1 text-accent">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-accent-hi">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-dim">{hint}</p>
      ) : null}
    </div>
  );
}
