import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../env.js';

export type PhotoRef = { id: number; path: string; dir: string; name: string };

function safeSegment(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, '_').slice(0, 80);
}

export function linkNameFor(photo: PhotoRef): string {
  const folder = safeSegment(path.basename(photo.dir) || 'root');
  return `${folder}__${photo.name}`;
}

function linkTarget(albumDir: string, photoPath: string): string {
  const root = env.photoRootChroot;
  if (env.hostPhotosRoot && (photoPath === root || photoPath.startsWith(`${root}/`))) {
    return path.join(env.hostPhotosRoot, photoPath.slice(root.length));
  }
  return path.relative(albumDir, photoPath);
}

async function safeReadlink(p: string): Promise<string | null> {
  try { return await fs.readlink(p); } catch { return null; }
}

export async function writeAlbum(
  albumDir: string,
  photos: PhotoRef[],
): Promise<{ added: number; removed: number; unchanged: number }> {
  await fs.mkdir(albumDir, { recursive: true });

  const desired = new Map<string, PhotoRef>();
  for (const p of photos) {
    let name = linkNameFor(p);
    if (desired.has(name)) {
      const ext = path.extname(p.name);
      const stem = name.slice(0, name.length - ext.length);
      let n = 2;
      while (desired.has(`${stem}_${n}${ext}`)) n += 1;
      name = `${stem}_${n}${ext}`;
    }
    desired.set(name, p);
  }

  let entries: import('node:fs').Dirent[] = [];
  try { entries = await fs.readdir(albumDir, { withFileTypes: true }); }
  catch { /* fresh dir */ }

  let removed = 0;
  for (const e of entries) {
    if (!e.isSymbolicLink()) continue;
    if (!desired.has(e.name)) {
      await fs.unlink(path.join(albumDir, e.name));
      removed += 1;
    }
  }

  let added = 0;
  let unchanged = 0;
  for (const [name, p] of desired) {
    const link = path.join(albumDir, name);
    const current = await safeReadlink(link);
    const target = linkTarget(albumDir, p.path);
    if (current === target) { unchanged += 1; continue; }
    if (current !== null) await fs.unlink(link);
    await fs.symlink(target, link);
    added += 1;
  }

  return { added, removed, unchanged };
}

export async function deleteAlbumDir(albumDir: string): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try { entries = await fs.readdir(albumDir, { withFileTypes: true }); }
  catch { return; }
  for (const e of entries) {
    if (e.isSymbolicLink() || e.isFile()) {
      await fs.unlink(path.join(albumDir, e.name)).catch(() => {});
    }
  }
  await fs.rmdir(albumDir).catch(() => {});
}
