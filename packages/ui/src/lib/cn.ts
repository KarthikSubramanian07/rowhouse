import { type ClassValue, clsx } from 'clsx';

/** Conditional className joiner. Thin wrapper over clsx for a stable import. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export type { ClassValue };
