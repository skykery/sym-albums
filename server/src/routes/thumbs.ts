import type { FastifyInstance } from 'fastify';
import fs from 'node:fs';
import { ensureThumb } from '../lib/thumbnailer.js';

export function registerThumbsRoutes(app: FastifyInstance) {
  app.get('/thumb/:hash', async (req, reply) => {
    const { hash } = req.params as { hash: string };
    if (!/^[a-f0-9]{40}$/.test(hash)) return reply.code(400).send({ error: 'bad_hash' });
    const p = await ensureThumb(hash);
    if (!p) return reply.code(404).send({ error: 'not_found' });
    reply
      .header('Content-Type', 'image/jpeg')
      .header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(fs.createReadStream(p));
  });
}
