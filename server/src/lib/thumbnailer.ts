import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import pLimit from 'p-limit';
import exifr from 'exifr';
import { env } from '../env.js';
import { db } from '../db.js';

const CPUS = Math.max(2, os.cpus().length);
const CONCURRENCY = Number(process.env.THUMB_CONCURRENCY ?? CPUS);
const PREWARM_CONCURRENCY = Math.max(1, Math.floor(CONCURRENCY / 2));

// libvips is already multi-threaded per operation; cap so we don't oversubscribe.
sharp.concurrency(1);
sharp.cache({ items: 200, memory: 128 });

const onDemand = pLimit(CONCURRENCY);
const prewarm = pLimit(PREWARM_CONCURRENCY);
const inflight = new Map<string, Promise<string>>();

const SIZE = Number(process.env.THUMB_SIZE ?? 400);
const QUALITY = Number(process.env.THUMB_QUALITY ?? 78);

function thumbPath(hash: string): string {
  const shard = hash.slice(0, 2);
  return path.join(env.thumbsDir, shard, `${hash}.jpg`);
}

// EXIF previews are usually ~160px, which would be upscaled into a blurry grid
// thumb. Only use one when its short edge already covers SIZE.
async function extractEmbeddedThumb(sourcePath: string): Promise<Buffer | null> {
  if (!/\.(jpe?g)$/i.test(sourcePath)) return null;
  try {
    const raw = await exifr.thumbnail(sourcePath);
    if (!raw || raw.length === 0) return null;
    const buf = Buffer.from(raw);
    const { width = 0, height = 0 } = await sharp(buf).metadata();
    return Math.min(width, height) >= SIZE ? buf : null;
  } catch { return null; }
}

async function generate(sourcePath: string, hash: string): Promise<string> {
  const dst = thumbPath(hash);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  const tmp = `${dst}.${process.pid}.tmp`;

  const embedded = await extractEmbeddedThumb(sourcePath);
  const input: string | Buffer = embedded ?? sourcePath;

  await sharp(input, { failOn: 'none', sequentialRead: true, unlimited: true })
    .rotate()
    .resize({ width: SIZE, height: SIZE, fit: 'cover', kernel: 'mitchell' })
    .jpeg({ quality: QUALITY, mozjpeg: false, progressive: false, chromaSubsampling: '4:2:0' })
    .toFile(tmp);
  await fs.rename(tmp, dst);
  return dst;
}

async function run(hash: string, queue: typeof onDemand): Promise<string> {
  const dst = thumbPath(hash);
  try { await fs.access(dst); return dst; } catch { /* miss */ }

  const row = db.prepare('SELECT path FROM photos WHERE hash = ? LIMIT 1').get(hash) as { path: string } | undefined;
  if (!row) throw new Error('no_photo_for_hash');

  let job = inflight.get(hash);
  if (!job) {
    job = queue(() => generate(row.path, hash)).finally(() => inflight.delete(hash));
    inflight.set(hash, job);
  }
  return job;
}

export async function ensureThumb(hash: string): Promise<string | null> {
  try { return await run(hash, onDemand); }
  catch { return null; }
}

export function prewarmThumb(hash: string): void {
  // Fire and forget on the low-priority queue; ignore errors here.
  run(hash, prewarm).catch(() => {});
}

export async function clearThumbCache(): Promise<void> {
  await fs.rm(env.thumbsDir, { recursive: true, force: true });
  await fs.mkdir(env.thumbsDir, { recursive: true });
  // Scans only prewarm new/changed photos, so refill the whole cache here.
  const rows = db.prepare('SELECT hash FROM photos ORDER BY id DESC').all() as { hash: string }[];
  for (const r of rows) prewarmThumb(r.hash);
}

export async function thumbCacheStats(): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  async function walk(d: string) {
    let entries: import('node:fs').Dirent[] = [];
    try { entries = await fs.readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        files += 1;
        try { const st = await fs.stat(full); bytes += st.size; } catch { /* ignore */ }
      }
    }
  }
  await walk(env.thumbsDir);
  return { files, bytes };
}
