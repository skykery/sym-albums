import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import { env } from './env.js';
import './db.js';
import { registerConfigRoutes } from './routes/config.js';
import { registerFsRoutes } from './routes/fs.js';
import { registerPhotosRoutes } from './routes/photos.js';
import { registerThumbsRoutes } from './routes/thumbs.js';
import { registerAlbumsRoutes } from './routes/albums.js';
import { registerScanRoutes } from './routes/scan.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

await app.register(async api => {
  registerConfigRoutes(api);
  registerFsRoutes(api);
  registerPhotosRoutes(api);
  registerThumbsRoutes(api);
  registerAlbumsRoutes(api);
  registerScanRoutes(api);
}, { prefix: '/api' });

if (fs.existsSync(env.webDist)) {
  await app.register(fastifyStatic, { root: env.webDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not_found' });
    return reply.sendFile('index.html');
  });
}

app.listen({ host: env.host, port: env.port }).then(addr => {
  app.log.info(`sym-albums listening on ${addr}`);
});
