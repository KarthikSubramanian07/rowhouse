/**
 * Rowhouse backend Worker: Hono API + ChatRoom Durable Object + queue consumer +
 * cron. Runs fully on mock adapters with zero secrets. The public web app
 * (rowhouse-gg.pages.dev) proxies /api/* here server-side so session cookies stay
 * first-party; this Worker itself is the invisible backend.
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { withContext } from './auth/middleware.js';
import { handleScheduled } from './cron.js';
import { describeProviders, type Env, type JobMessage } from './env.js';
import { AppError } from './lib/http.js';
import { handleQueue } from './queue.js';
import { authRoutes } from './routes/auth.js';
import { creatorRoutes } from './routes/creators.js';
import { feedRoutes } from './routes/feed.js';
import { filmRoutes } from './routes/films.js';
import { liveRoutes } from './routes/live.js';
import { ogRoutes } from './routes/og.js';
import { pushRoutes } from './routes/push.js';
import { reportRoutes } from './routes/reports.js';
import { trackRoutes } from './routes/tracks.js';
import { watchlistRoutes } from './routes/watchlist.js';
import type { AppEnv } from './types.js';

const app = new Hono<AppEnv>();

app.use('*', (c, next) =>
  cors({
    origin: [c.env.APP_ORIGIN, 'http://localhost:4321', 'http://localhost:8788'],
    credentials: true,
  })(c, next),
);
app.use('*', withContext);

app.get('/health', (c) => c.json({ ok: true, providers: describeProviders(c.env) }));

app.route('/auth', authRoutes);
app.route('/films', filmRoutes);
app.route('/tracks', trackRoutes);
app.route('/creators', creatorRoutes);
app.route('/watchlist', watchlistRoutes);
app.route('/live', liveRoutes);
app.route('/feed', feedRoutes);
app.route('/push', pushRoutes);
app.route('/reports', reportRoutes);
app.route('/og', ogRoutes);

app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  if (err instanceof AppError) return c.json({ error: err.code, message: err.message }, err.status);
  if (err instanceof HTTPException)
    return c.json({ error: 'http_error', message: err.message }, err.status);
  console.error('unhandled_error', err);
  return c.json({ error: 'internal_error' }, 500);
});

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<JobMessage>, env: Env): Promise<void> {
    await handleQueue(batch, env);
  },
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    await handleScheduled(event, env);
  },
};

export { ChatRoom } from './durable/ChatRoom.js';
