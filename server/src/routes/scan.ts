import type { FastifyInstance } from 'fastify';
import { db, config } from '../db.js';
import { env } from '../env.js';
import { scan, subscribe, isScanning, getProgress } from '../lib/scanner.js';
import { thumbCacheStats, clearThumbCache } from '../lib/thumbnailer.js';

function indexStats(): { photo_count: number; dir_count: number } {
  const p = db.prepare('SELECT COUNT(*) as n FROM photos').get() as { n: number };
  const d = db.prepare('SELECT COUNT(DISTINCT dir) as n FROM photos').get() as { n: number };
  return { photo_count: p.n, dir_count: d.n };
}

export function registerScanRoutes(app: FastifyInstance) {
  app.post('/scan', async () => {
    if (isScanning()) return { started: false, running: true };
    const root = config.get('photo_root') || env.photoRootChroot;
    scan(root).catch(err => app.log.error(err, 'scan failed'));
    return { started: true, running: true, root };
  });

  app.get('/scan/progress', (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (p: unknown) => reply.raw.write(`data: ${JSON.stringify(p)}\n\n`);
    send(getProgress());
    const unsub = subscribe(p => send(p));
    req.raw.on('close', () => unsub());
  });

  app.get('/stats', async () => {
    const cache = await thumbCacheStats();
    return {
      ...indexStats(),
      thumb_cache: cache,
      scanning: isScanning(),
      progress: getProgress(),
    };
  });

  app.post('/cache/clear', async () => {
    await clearThumbCache();
    return { ok: true };
  });
}
