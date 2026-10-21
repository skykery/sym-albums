export type ScanProgress = {
  scanned: number;
  total: number;
  currentDir: string;
  done: boolean;
};

export type AppConfig = {
  photo_root: string;
  albums_root: string;
  thumb_size: number;
  first_run_done: boolean;
};

export type Photo = {
  id: number;
  path: string;
  dir: string;
  name: string;
  ext: string;
  size: number;
  mtime: number;
  hash: string;
  width: number | null;
  height: number | null;
};

export type AlbumSummary = {
  id: number;
  name: string;
  dir: string;
  created_at: number;
  updated_at: number;
  photo_count: number;
  preview: string[];
};

export type AlbumDetail = {
  album: Omit<AlbumSummary, 'photo_count' | 'preview'>;
  photos: Photo[];
};

export type BrowseChild = {
  name: string;
  path: string;
  direct_photos: number;
  total_photos: number;
};

export type BrowseResult = {
  home: string;
  user_home: string;
  path: string;
  parent: string | null;
  direct_photos: number;
  total_photos: number;
  children: BrowseChild[];
};

const ERROR_MESSAGES: Record<string, string> = {
  name_taken: 'An album with this name already exists.',
  folder_exists: 'A folder with this name already exists in the albums root.',
  invalid_name: 'That name can\'t be used as a folder name.',
  missing_name: 'Name is required.',
};

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let code: string | undefined;
    try { code = JSON.parse(text).error; } catch { /* not JSON */ }
    throw new Error((code && ERROR_MESSAGES[code]) || text);
  }
  return res.json() as Promise<T>;
}

export const api = {
  config: () => fetch('/api/config').then(j<AppConfig>),
  saveConfig: (patch: Partial<AppConfig>) =>
    fetch('/api/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).then(j),

  browse: (path: string | undefined, kind: 'photos' | 'albums' = 'photos') => {
    const qs = new URLSearchParams();
    if (path) qs.set('path', path);
    qs.set('kind', kind);
    return fetch(`/api/fs/browse?${qs}`).then(j<BrowseResult>);
  },
  mkdir: (path: string, kind: 'photos' | 'albums' = 'albums') =>
    fetch('/api/fs/mkdir', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, kind }) }).then(j),

  photos: (dir: string, opts: { recursive?: boolean; cursor?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams({ dir });
    if (opts.recursive) qs.set('recursive', '1');
    if (opts.cursor) qs.set('cursor', String(opts.cursor));
    if (opts.limit) qs.set('limit', String(opts.limit));
    return fetch(`/api/photos?${qs}`).then(j<{ photos: Photo[]; next: number | null }>);
  },

  // Follows the cursor so large folders aren't silently truncated.
  allPhotos: async (dir: string, opts: { recursive?: boolean } = {}): Promise<{ photos: Photo[] }> => {
    const out: Photo[] = [];
    let cursor: number | undefined;
    do {
      const page = await api.photos(dir, { ...opts, cursor, limit: 5000 });
      out.push(...page.photos);
      cursor = page.next ?? undefined;
    } while (cursor);
    return { photos: out };
  },

  startScan: () => fetch('/api/scan', { method: 'POST' }).then(j<{ started: boolean; running: boolean }>),

  stats: () => fetch('/api/stats').then(j<{ photo_count: number; dir_count: number; scanning: boolean; progress: ScanProgress; thumb_cache: { files: number; bytes: number } }>),

  clearCache: () => fetch('/api/cache/clear', { method: 'POST' }).then(j),

  albums: () => fetch('/api/albums').then(j<{ albums: AlbumSummary[] }>),
  album: (id: number) => fetch(`/api/albums/${id}`).then(j<AlbumDetail>),
  createAlbum: (name: string, photo_ids: number[]) =>
    fetch('/api/albums', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, photo_ids }) }).then(j<{ id: number }>),
  updateAlbum: (id: number, patch: { name?: string; photo_ids?: number[] }) =>
    fetch(`/api/albums/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }).then(j),
  deleteAlbum: (id: number) =>
    fetch(`/api/albums/${id}`, { method: 'DELETE' }).then(j),
};

export function thumbUrl(hash: string): string {
  return `/api/thumb/${hash}`;
}
