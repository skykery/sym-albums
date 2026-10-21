import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type BrowseChild } from '../lib/api';

type Props = {
  kind: 'photos' | 'albums';
  path: string | undefined;
  onNavigate: (p: string) => void;
  onSelectFolder?: (p: string) => void;
  showPhotoCounts?: boolean;
};

export function FolderBrowser({ kind, path, onNavigate, onSelectFolder, showPhotoCounts = true }: Props) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['browse', kind, path ?? '__home__'],
    queryFn: () => api.browse(path, kind),
  });

  const [input, setInput] = useState<string>(path ?? '');
  useEffect(() => { if (data?.path) setInput(data.path); }, [data?.path]);

  const submit = () => {
    const p = input.trim();
    if (p) onNavigate(p);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {data?.parent != null && (
          <button className="btn-ghost" onClick={() => onNavigate(data.parent!)} aria-label="Up one level">
            ← Up
          </button>
        )}
        <input
          className="input flex-1 font-mono text-sm"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="/absolute/path"
          inputMode="text"
        />
        <button className="btn-ghost" onClick={submit} aria-label="Go to path">Go</button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {data?.home && (
          <button className="chip hover:text-slate-100" onClick={() => onNavigate(data.home)}>
            ⌂ Home ({shortPath(data.home)})
          </button>
        )}
        {data?.user_home && data.user_home !== data.home && (
          <button className="chip hover:text-slate-100" onClick={() => onNavigate(data.user_home)}>
            ~ ({shortPath(data.user_home)})
          </button>
        )}
        <button className="chip hover:text-slate-100" onClick={() => onNavigate('/')}>/ root</button>
        <button className="chip hover:text-slate-100" onClick={() => onNavigate('/Volumes')}>/Volumes</button>
        {onSelectFolder && data && (
          <button className="btn-primary ml-auto" onClick={() => onSelectFolder(data.path)}>
            Use this folder
          </button>
        )}
      </div>

      {isLoading && <div className="p-4 text-sm text-muted">Loading…</div>}
      {isError && (
        <div className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
          Can't read this folder: {String(error)}
        </div>
      )}

      {data && (data.children.length === 0 ? (
        <div className="card p-6 text-center text-sm text-muted">No subfolders here.</div>
      ) : (
        <ul className="card divide-y divide-edge/50">
          {data.children.map(c => (
            <FolderRow key={c.path} child={c} onOpen={() => onNavigate(c.path)} showCounts={showPhotoCounts} />
          ))}
        </ul>
      ))}
    </div>
  );
}

function shortPath(p: string): string {
  if (p.length <= 24) return p;
  return '…' + p.slice(-22);
}

function FolderRow({ child, onOpen, showCounts }: { child: BrowseChild; onOpen: () => void; showCounts: boolean }) {
  return (
    <li>
      <button onClick={onOpen} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-panel2 active:bg-edge">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-lg bg-panel2 text-lg text-muted">▸</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-slate-100">{child.name}</span>
          {showCounts && (
            <span className="text-xs text-muted">
              {child.direct_photos.toLocaleString()} here · {child.total_photos.toLocaleString()} total
            </span>
          )}
        </span>
        <span className="text-muted">›</span>
      </button>
    </li>
  );
}
