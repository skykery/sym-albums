import type { FastifyInstance } from 'fastify';
import { config } from '../db.js';

const KEYS = ['photo_root', 'albums_root', 'thumb_size', 'first_run_done'] as const;

export function registerConfigRoutes(app: FastifyInstance) {
  app.get('/config', async () => {
    const all = config.all();
    return {
      photo_root: all.photo_root ?? '',
      albums_root: all.albums_root ?? '',
      thumb_size: Number(all.thumb_size ?? 400),
      first_run_done: all.first_run_done === '1',
    };
  });

  app.patch('/config', async req => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    for (const k of KEYS) {
      if (k in body) {
        const v = body[k];
        config.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v ?? ''));
      }
    }
    return { ok: true };
  });
}
