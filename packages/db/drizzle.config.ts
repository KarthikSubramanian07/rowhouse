import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config. Migrations are emitted into the API worker's migrations dir
 * so `wrangler d1 migrations apply` picks them up. The committed 0001_init.sql was
 * authored to match schema.ts exactly; regenerate with `pnpm --filter @rowhouse/db generate`.
 */
export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  schema: './src/schema.ts',
  out: '../../apps/api/migrations',
});
