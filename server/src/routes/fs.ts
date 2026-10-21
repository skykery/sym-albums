import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { db, config } from '../db.js';
import { env } from '../env.js';
import { safeResolve } from '../lib/paths.js';

type BrowseKind = 'photos' | 'albums';

function homeFor(kind: BrowseKind): string {
  if (kind === 'albums') return config.get('albums_root') || env.albumRootChroot;
  return config.get('photo_root') || env.photoRootChroot;
}

const countStmt = db.prepare('SELECT COUNT(*) as n FROM photos WHERE dir = ?');
// Range on `dir` instead of LIKE: LIKE treats `_` in folder names as a wildcard,
// is case-insensitive, and can't use idx_photos_dir. '0' is the char after '/'.
const countPrefixStmt = db.prepare("SELECT COUNT(*) as n FROM photos WHERE dir = ? OR (dir >= ? || '/' AND dir < ? || '0')");

export function registerFsRoutes(app: FastifyInstance) {
  app.get('/fs/browse', async (req, reply) => {
    const q = req.query as { path?: string; kind?: BrowseKind };
    const kind: BrowseKind = q.kind === 'albums' ? 'albums' : 'photos';
    const home = homeFor(kind);
    const target = path.resolve(q.path && q.path.length > 0 ? q.path : home);

    let entries: import('node:fs').Dirent[];
    try { entries = await fs.readdir(target, { withFileTypes: true }); }
    catch (err) { return reply.code(400).send({ error: 'cannot_read', detail: String(err) }); }

    const children = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => {
        const full = path.join(target, e.name);
        const direct = (countStmt.get(full) as { n: number }).n;
        const recursive = (countPrefixStmt.get(full, full, full) as { n: number }).n;
        return {
          name: e.name,
          path: full,
          direct_photos: direct,
          total_photos: recursive,
        };
      })
      .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));

    const parent = target === '/' ? null : path.dirname(target);

    return {
      home,
      user_home: os.homedir(),
      path: target,
      parent,
      direct_photos: (countStmt.get(target) as { n: number }).n,
      total_photos: (countPrefixStmt.get(target, target, target) as { n: number }).n,
      children,
    };
  });

  app.post('/fs/mkdir', async (req, reply) => {
    const { path: p } = (req.body ?? {}) as { path?: string };
    if (!p) return reply.code(400).send({ error: 'missing_path' });
    // Only allowed inside the albums root; browsing stays open for picking roots.
    let abs: string;
    try { abs = safeResolve(homeFor('albums'), path.resolve(p)); }
    catch { return reply.code(403).send({ error: 'outside_albums_root' }); }
    try { await fs.mkdir(abs, { recursive: true }); }
    catch (err) { return reply.code(400).send({ error: 'mkdir_failed', detail: String(err) }); }
    return { ok: true, path: abs };
  });

  app.get('/fs/dirs-with-photos', async () => {
    const rows = db.prepare('SELECT DISTINCT dir FROM photos ORDER BY dir').all() as { dir: string }[];
    return { dirs: rows.map(r => r.dir) };
  });
}
