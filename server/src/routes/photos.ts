import type { FastifyInstance } from 'fastify';
import { db } from '../db.js';

export function registerPhotosRoutes(app: FastifyInstance) {
  app.get('/photos', async req => {
    const q = req.query as { dir?: string; recursive?: string; cursor?: string; limit?: string };
    if (!q.dir) return { photos: [], next: null };
    const limit = Math.min(5000, Math.max(1, Number(q.limit ?? 200)));
    const cursor = Number(q.cursor ?? 0);
    const recursive = q.recursive === '1' || q.recursive === 'true';

    const rows = recursive
      ? db.prepare(`
          SELECT id, path, dir, name, ext, size, mtime, hash, width, height
          FROM photos
          WHERE (dir = ? OR (dir >= ? || '/' AND dir < ? || '0')) AND id > ?
          ORDER BY id ASC
          LIMIT ?
        `).all(q.dir, q.dir, q.dir, cursor, limit)
      : db.prepare(`
          SELECT id, path, dir, name, ext, size, mtime, hash, width, height
          FROM photos
          WHERE dir = ? AND id > ?
          ORDER BY id ASC
          LIMIT ?
        `).all(q.dir, cursor, limit);

    const list = rows as Array<{ id: number; path: string; dir: string; name: string; ext: string; size: number; mtime: number; hash: string; width: number | null; height: number | null }>;
    const next = list.length === limit ? list[list.length - 1].id : null;
    return { photos: list, next };
  });
}
