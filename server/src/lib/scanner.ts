import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { extOf, isPhoto } from './formats.js';
import { prewarmThumb } from './thumbnailer.js';

export type ScanProgress = {
  scanned: number;
  total: number;
  currentDir: string;
  done: boolean;
};

type Listener = (p: ScanProgress) => void;

const state = {
  running: false,
  progress: { scanned: 0, total: 0, currentDir: '', done: true } as ScanProgress,
  listeners: new Set<Listener>(),
};

function emit() {
  for (const l of state.listeners) l(state.progress);
}

export function subscribe(l: Listener): () => void {
  state.listeners.add(l);
  l(state.progress);
  return () => state.listeners.delete(l);
}

export function getProgress(): ScanProgress { return state.progress; }
export function isScanning(): boolean { return state.running; }

function hashKey(p: string, mtime: number, size: number): string {
  return crypto.createHash('sha1').update(`${p}|${mtime}|${size}`).digest('hex');
}

// Walks the tree; `failed` holds dirs we couldn't list, so nothing under them is
// treated as deleted (e.g. a flaky mount or permission change).
async function collectDirs(root: string): Promise<{ dirs: string[]; failed: string[] }> {
  const dirs: string[] = [];
  const failed: string[] = [];
  async function walk(dir: string) {
    let entries: import('node:fs').Dirent[];
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { failed.push(dir); return; }
    dirs.push(dir);
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) await walk(path.join(dir, e.name));
    }
  }
  await walk(root);
  return { dirs, failed };
}

const upsertStmt = db.prepare(`
INSERT INTO photos(path, dir, name, ext, size, mtime, hash)
VALUES (@path, @dir, @name, @ext, @size, @mtime, @hash)
ON CONFLICT(path) DO UPDATE SET
  dir=excluded.dir, name=excluded.name, ext=excluded.ext,
  size=excluded.size, mtime=excluded.mtime, hash=excluded.hash
`);
const existsStmt = db.prepare('SELECT size, mtime FROM photos WHERE path = ?');
const deleteStmt = db.prepare('DELETE FROM photos WHERE path = ?');
const listByDirStmt = db.prepare('SELECT path, hash FROM photos WHERE dir = ?');
const dirsUnderStmt = db.prepare("SELECT DISTINCT dir FROM photos WHERE dir = ? OR (dir >= ? || '/' AND dir < ? || '0')");
const deleteDirStmt = db.prepare('DELETE FROM photos WHERE dir = ?');

type Row = { path: string; dir: string; name: string; ext: string; size: number; mtime: number; hash: string };

const applyDir = db.transaction((toUpsert: Row[], toDelete: string[]) => {
  for (const r of toUpsert) upsertStmt.run(r);
  for (const p of toDelete) deleteStmt.run(p);
});

const purgeDirs = db.transaction((dirs: string[]) => {
  for (const d of dirs) deleteDirStmt.run(d);
});

function isUnder(child: string, parent: string): boolean {
  return child === parent || child.startsWith(parent.endsWith('/') ? parent : `${parent}/`);
}

export async function scan(root: string): Promise<void> {
  if (state.running) return;
  state.running = true;
  state.progress = { scanned: 0, total: 0, currentDir: root, done: false };
  emit();

  try {
    const { dirs, failed } = await collectDirs(root);
    // Root unreadable (unmounted drive, typo): bail out rather than wipe the index.
    if (failed.includes(root)) throw new Error(`photo root unreadable: ${root}`);
    state.progress = { ...state.progress, total: dirs.length };
    emit();

    for (const dir of dirs) {
      state.progress = { ...state.progress, currentDir: dir };

      let entries: import('node:fs').Dirent[];
      try { entries = await fs.readdir(dir, { withFileTypes: true }); }
      catch { failed.push(dir); state.progress = { ...state.progress, scanned: state.progress.scanned + 1 }; emit(); continue; }

      const seenPaths = new Set<string>();
      const upserts: Row[] = [];

      for (const e of entries) {
        if (!e.isFile()) continue;
        if (!isPhoto(e.name)) continue;
        const full = path.join(dir, e.name);
        seenPaths.add(full);
        let st;
        try { st = await fs.stat(full); } catch { continue; }
        const size = st.size;
        const mtime = Math.floor(st.mtimeMs);
        const prior = existsStmt.get(full) as { size: number; mtime: number } | undefined;
        if (prior && prior.size === size && prior.mtime === mtime) continue;
        upserts.push({
          path: full,
          dir,
          name: e.name,
          ext: extOf(e.name),
          size,
          mtime,
          hash: hashKey(full, mtime, size),
        });
      }

      const known = listByDirStmt.all(dir) as { path: string; hash: string }[];
      const removals = known.filter(k => !seenPaths.has(k.path)).map(k => k.path);

      if (upserts.length || removals.length) applyDir(upserts, removals);
      for (const u of upserts) prewarmThumb(u.hash);

      state.progress = { ...state.progress, scanned: state.progress.scanned + 1 };
      emit();
    }

    // Folders that vanished from disk entirely never get visited above, so drop them here.
    const visited = new Set(dirs);
    const indexed = (dirsUnderStmt.all(root, root, root) as { dir: string }[]).map(r => r.dir);
    const gone = indexed.filter(d => !visited.has(d) && !failed.some(f => isUnder(d, f)));
    if (gone.length) purgeDirs(gone);
  } finally {
    state.running = false;
    state.progress = { ...state.progress, done: true };
    emit();
  }
}
