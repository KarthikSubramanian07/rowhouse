import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export * as schema from './schema.js';
export * from './schema.js';

export type Database = ReturnType<typeof createDb>;

/** Wrap a D1 binding in a typed Drizzle client. */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
