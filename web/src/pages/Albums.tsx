import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, thumbUrl, type AlbumSummary } from '../lib/api';

function AlbumCard({ a }: { a: AlbumSummary }) {
  return (
    <Link
      to={`/albums/${a.id}`}
      className="card group flex overflow-hidden transition hover:border-accent/40"
    >
      <div className="grid w-32 flex-none grid-cols-2 gap-px bg-edge/70 sm:w-40">
        {[0, 1, 2, 3].map(i => {
          const h = a.preview[i];
          return (
            <div key={i} className="aspect-square bg-panel2">
              {h && <img src={thumbUrl(h)} alt="" loading="lazy" className="h-full w-full object-cover" />}
            </div>
          );
        })}
      </div>
      <div className="min-w-0 flex-1 p-4">
        <div className="truncate text-base font-medium text-slate-100">{a.name}</div>
        <div className="mt-1 text-xs text-muted">
          {a.photo_count.toLocaleString()} photo{a.photo_count === 1 ? '' : 's'}
        </div>
        <div className="mt-2 truncate text-[11px] text-muted/80">{a.dir}</div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="card mt-8 flex flex-col items-center gap-4 px-6 py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent2/20 text-2xl text-accent">＋</div>
      <div>
        <div className="text-lg font-medium">No albums yet</div>
        <div className="mt-1 text-sm text-muted">Pick photos from anywhere on your library — we'll wire them up as a folder of symlinks.</div>
      </div>
      <Link to="/albums/new" className="btn-primary">Create your first album</Link>
    </div>
  );
}

export function Albums() {
  const { data, isLoading } = useQuery({ queryKey: ['albums'], queryFn: api.albums });
  const albums = data?.albums ?? [];

  return (
    <div>
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-xl font-semibold tracking-tight">Albums</h1>
        <span className="chip">{albums.length}</span>
      </div>

      {isLoading ? (
        <div className="mt-4 grid gap-3">
          {[0, 1, 2].map(i => <div key={i} className="card h-28 animate-pulse" />)}
        </div>
      ) : albums.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-2 grid gap-3">
          {albums.map(a => <AlbumCard key={a.id} a={a} />)}
        </div>
      )}

      <Link
        to="/albums/new"
        aria-label="New album"
        className="fixed bottom-6 right-6 z-50 grid h-14 w-14 place-items-center rounded-full bg-accent2 text-2xl text-white shadow-lg shadow-accent2/30 transition hover:bg-accent active:scale-95"
        style={{ bottom: `calc(env(safe-area-inset-bottom, 0px) + 1.25rem)` }}
      >
        ＋
      </Link>
    </div>
  );
}
