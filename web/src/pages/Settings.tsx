import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FolderBrowser } from '../components/FolderBrowser';
import { useScanProgress } from '../lib/useScanProgress';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function Settings() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ['config'], queryFn: api.config });
  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: api.stats,
    refetchInterval: 5000,
  });
  const progress = useScanProgress();
  const scanning = !progress.done;
  const pct = progress.total > 0 ? Math.round((progress.scanned / progress.total) * 100) : 0;

  const [editing, setEditing] = useState<'photos' | 'albums' | null>(null);
  const [browsePath, setBrowsePath] = useState<string | undefined>(undefined);

  const saveRoot = useMutation({
    mutationFn: async (patch: { photo_root?: string; albums_root?: string }) => {
      await api.saveConfig(patch);
      if (patch.photo_root) await api.startScan();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['config'] });
      await qc.invalidateQueries({ queryKey: ['stats'] });
      setEditing(null);
    },
  });

  const rescan = useMutation({
    mutationFn: () => api.startScan(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stats'] }),
  });

  const clearCache = useMutation({
    mutationFn: () => api.clearCache(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stats'] }),
  });

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between pb-3">
          <h1 className="text-xl font-semibold">Change {editing === 'photos' ? 'photo root' : 'albums root'}</h1>
          <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
        </div>
        <FolderBrowser
          kind={editing}
          path={browsePath}
          onNavigate={setBrowsePath}
          onSelectFolder={(p) => saveRoot.mutate(editing === 'photos' ? { photo_root: p } : { albums_root: p })}
          showPhotoCounts={editing === 'photos'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className="card p-4">
        <div className="text-xs uppercase tracking-wide text-muted">Photo root</div>
        <div className="mt-1 break-all font-mono text-sm">{cfg.data?.photo_root || '—'}</div>
        <div className="mt-3 flex gap-2">
          <button className="btn-ghost" onClick={() => { setEditing('photos'); setBrowsePath(cfg.data?.photo_root); }}>Change</button>
          <button className="btn-primary" onClick={() => rescan.mutate()} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Rescan'}
          </button>
        </div>
        {scanning && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{progress.total > 0 ? `${progress.scanned.toLocaleString()} / ${progress.total.toLocaleString()} folders` : 'Discovering folders…'}</span>
              {progress.total > 0 && <span>{pct}%</span>}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel2">
              <div
                className={`h-full bg-accent transition-[width] duration-300 ${progress.total === 0 ? 'animate-pulse w-1/3' : ''}`}
                style={progress.total > 0 ? { width: `${pct}%` } : undefined}
              />
            </div>
            {progress.currentDir && (
              <div className="mt-1.5 truncate text-[11px] text-muted/80">{progress.currentDir}</div>
            )}
          </div>
        )}
      </section>

      <section className="card p-4">
        <div className="text-xs uppercase tracking-wide text-muted">Albums output</div>
        <div className="mt-1 break-all font-mono text-sm">{cfg.data?.albums_root || '—'}</div>
        <div className="mt-3">
          <button className="btn-ghost" onClick={() => { setEditing('albums'); setBrowsePath(cfg.data?.albums_root); }}>Change</button>
        </div>
      </section>

      <section className="card p-4">
        <div className="text-xs uppercase tracking-wide text-muted">Index</div>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-muted">Photos</dt><dd className="mt-0.5">{stats.data?.photo_count.toLocaleString() ?? '—'}</dd></div>
          <div><dt className="text-muted">Folders</dt><dd className="mt-0.5">{stats.data?.dir_count.toLocaleString() ?? '—'}</dd></div>
          <div><dt className="text-muted">Thumb cache</dt><dd className="mt-0.5">{stats.data ? `${stats.data.thumb_cache.files.toLocaleString()} files · ${formatBytes(stats.data.thumb_cache.bytes)}` : '—'}</dd></div>
          <div><dt className="text-muted">State</dt><dd className="mt-0.5">{scanning ? (progress.total > 0 ? `Scanning ${progress.scanned}/${progress.total}` : 'Discovering folders…') : 'Idle'}</dd></div>
        </dl>
        <div className="mt-3">
          <button className="btn-danger" onClick={() => { if (confirm('Clear the thumbnail cache? They will regenerate on demand.')) clearCache.mutate(); }}>
            Clear thumbnail cache
          </button>
        </div>
      </section>
    </div>
  );
}
