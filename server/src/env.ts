import path from 'node:path';

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), 'data');

export const env = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? '0.0.0.0',
  dataDir,
  dbPath: path.join(dataDir, 'sym-albums.sqlite'),
  thumbsDir: path.join(dataDir, 'thumbs'),
  webDist: process.env.WEB_DIST ?? path.resolve(process.cwd(), '../web/dist'),
  photoRootChroot: process.env.PHOTOS_ROOT ?? '/photos',
  albumRootChroot: process.env.ALBUMS_ROOT ?? '/albums',
  // Docker only: host path mounted at photoRootChroot. When set, symlinks point at the
  // host path so they resolve outside the container (they dangle inside it, which is fine).
  hostPhotosRoot: process.env.HOST_PHOTOS_ROOT || null,
};
