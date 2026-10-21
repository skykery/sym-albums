import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { db, config } from '../db.js';
import { env } from '../env.js';
import { writeAlbum, deleteAlbumDir, type PhotoRef } from '../lib/symlinks.js';

function albumsRoot(): string {
  return config.get('albums_root') || env.albumRootChroot;
}

function safeName(name: string): string {
  const clean = name.trim().replace(/[/\\:*?"<>|]/g, '_').replace(/\.+$/, '').slice(0, 120);
  if (!clean) throw new Error('empty_name');
  return clean;
}

// Also drops ids that aren't in the index, so stale client ids can't trip the FK.
function loadPhotos(ids: number[]): PhotoRef[] {
  const out: PhotoRef[] = [];
  const unique = Array.from(new Set(ids));
  for (let i = 0; i < unique.length; i += 10000) {
    const chunk = unique.slice(i, i + 10000);
    const placeholders = chunk.map(() => '?').join(',');
    out.push(...db.prepare(`SELECT id, path, dir, name FROM photos WHERE id IN (${placeholders})`).all(...chunk) as PhotoRef[]);
  }
  return out;
}

function nameTaken(name: string, exceptId?: number): boolean {
  return !!db.prepare('SELECT 1 FROM albums WHERE name = ? COLLATE NOCASE AND id IS NOT ?').get(name, exceptId ?? null);
}

// Moves the symlink folder; EXDEV (albums root moved to another disk) falls back
// to rebuilding at the new location.
async function moveAlbumDir(from: string, to: string, photos: PhotoRef[]): Promise<void> {
  try { await fs.rename(from, to); }
  catch (err: any) {
    if (err?.code === 'ENOENT') return;
    if (err?.code !== 'EXDEV') throw err;
    await writeAlbum(to, photos);
    await deleteAlbumDir(from);
  }
}

function previewHashes(albumId: number, limit = 4): string[] {
  const rows = db.prepare(`
    SELECT p.hash FROM album_photos ap
    JOIN photos p ON p.id = ap.photo_id
    WHERE ap.album_id = ?
    ORDER BY ap.added_at DESC
    LIMIT ?
  `).all(albumId, limit) as { hash: string }[];
  return rows.map(r => r.hash);
}

function albumCount(albumId: number): number {
  return (db.prepare('SELECT COUNT(*) as n FROM album_photos WHERE album_id = ?').get(albumId) as { n: number }).n;
}

export function registerAlbumsRoutes(app: FastifyInstance) {
  app.get('/albums', async () => {
    const rows = db.prepare('SELECT id, name, dir, created_at, updated_at FROM albums ORDER BY updated_at DESC').all() as Array<{ id: number; name: string; dir: string; created_at: number; updated_at: number }>;
    return {
      albums: rows.map(r => ({
        ...r,
        photo_count: albumCount(r.id),
        preview: previewHashes(r.id),
      })),
    };
  });

  app.get('/albums/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const album = db.prepare('SELECT id, name, dir, created_at, updated_at FROM albums WHERE id = ?').get(id) as { id: number; name: string; dir: string; created_at: number; updated_at: number } | undefined;
    if (!album) return reply.code(404).send({ error: 'not_found' });
    const photos = db.prepare(`
      SELECT p.id, p.path, p.dir, p.name, p.hash
      FROM album_photos ap
      JOIN photos p ON p.id = ap.photo_id
      WHERE ap.album_id = ?
      ORDER BY ap.added_at ASC
    `).all(id);
    return { album, photos };
  });

  // Disk is written before the DB so a failed symlink write leaves the index untouched;
  // re-saving converges because writeAlbum diff-writes.
  app.post('/albums', async (req, reply) => {
    const body = (req.body ?? {}) as { name?: string; photo_ids?: number[] };
    if (!body.name) return reply.code(400).send({ error: 'missing_name' });
    let name: string;
    try { name = safeName(body.name); } catch { return reply.code(400).send({ error: 'invalid_name' }); }
    if (nameTaken(name)) return reply.code(409).send({ error: 'name_taken' });
    const dir = path.join(albumsRoot(), name);
    const photos = loadPhotos(body.photo_ids ?? []);
    const result = await writeAlbum(dir, photos);

    const now = Date.now();
    const albumId = db.transaction(() => {
      const info = db.prepare('INSERT INTO albums(name, dir, created_at, updated_at) VALUES(?, ?, ?, ?)').run(name, dir, now, now);
      const id = Number(info.lastInsertRowid);
      const insert = db.prepare('INSERT OR IGNORE INTO album_photos(album_id, photo_id, added_at) VALUES(?, ?, ?)');
      for (const p of photos) insert.run(id, p.id, now);
      return id;
    })();
    return { id: albumId, name, dir, ...result };
  });

  app.put('/albums/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = (req.body ?? {}) as { name?: string; photo_ids?: number[] };
    const album = db.prepare('SELECT id, name, dir FROM albums WHERE id = ?').get(id) as { id: number; name: string; dir: string } | undefined;
    if (!album) return reply.code(404).send({ error: 'not_found' });

    let dir = album.dir;
    let name = album.name;
    if (body.name && body.name !== album.name) {
      try { name = safeName(body.name); } catch { return reply.code(400).send({ error: 'invalid_name' }); }
      if (nameTaken(name, id)) return reply.code(409).send({ error: 'name_taken' });
      dir = path.join(albumsRoot(), name);
    }

    const currentIds = (db.prepare('SELECT photo_id FROM album_photos WHERE album_id = ?').all(id) as { photo_id: number }[]).map(r => r.photo_id);
    const photos = loadPhotos(body.photo_ids ?? currentIds);

    if (dir !== album.dir) {
      try { await moveAlbumDir(album.dir, dir, photos); }
      catch (err: any) {
        if (err?.code === 'ENOTEMPTY' || err?.code === 'EEXIST') return reply.code(409).send({ error: 'folder_exists' });
        throw err;
      }
    }
    const result = await writeAlbum(dir, photos);

    const now = Date.now();
    db.transaction(() => {
      db.prepare('UPDATE albums SET name = ?, dir = ?, updated_at = ? WHERE id = ?').run(name, dir, now, id);
      if (body.photo_ids) {
        // Keep added_at for photos already in the album so ordering stays stable.
        const keep = new Set(photos.map(p => p.id));
        const del = db.prepare('DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?');
        for (const pid of currentIds) if (!keep.has(pid)) del.run(id, pid);
        const insert = db.prepare('INSERT OR IGNORE INTO album_photos(album_id, photo_id, added_at) VALUES(?, ?, ?)');
        for (const p of photos) insert.run(id, p.id, now);
      }
    })();
    return { id, name, dir, ...result };
  });

  app.delete('/albums/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const album = db.prepare('SELECT id, dir FROM albums WHERE id = ?').get(id) as { id: number; dir: string } | undefined;
    if (!album) return reply.code(404).send({ error: 'not_found' });
    db.prepare('DELETE FROM albums WHERE id = ?').run(id);
    await deleteAlbumDir(album.dir);
    return { ok: true };
  });
}
