import { reports } from '@rowhouse/db';
import { reportSchema } from '@rowhouse/types';
import { Hono } from 'hono';
import { requireAuth } from '../auth/middleware.js';
import { badRequest } from '../lib/http.js';
import { newId } from '../lib/ids.js';
import type { AppEnv } from '../types.js';

export const reportRoutes = new Hono<AppEnv>();

/** Flag content for moderation (spec §11 — queue reviewed within 24h). */
reportRoutes.post('/', requireAuth, async (c) => {
  const parsed = reportSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) throw badRequest('invalid_report');
  await c
    .get('db')
    .insert(reports)
    .values({
      id: newId('rep'),
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
      detail: parsed.data.detail ?? null,
      reporterId: c.get('user')!.id,
      status: 'open',
    });
  return c.json({ ok: true });
});
