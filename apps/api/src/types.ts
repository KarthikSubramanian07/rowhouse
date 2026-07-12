import type { Database } from '@rowhouse/db';
import type { Providers } from './adapters/index.js';
import type { SessionUser } from './auth/session.js';
import type { Env } from './env.js';

/** Hono generics shared across the app + route modules. */
export interface AppEnv {
  Bindings: Env;
  Variables: {
    db: Database;
    providers: Providers;
    user?: SessionUser;
    sessionId?: string;
  };
}
