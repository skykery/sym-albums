import { Link, Outlet, useLocation } from 'react-router-dom';
import { useScanProgress } from '../lib/useScanProgress';

function ScanPill() {
  const p = useScanProgress();
  if (p.done) return null;
  const label = p.total > 0 ? `Indexing… ${p.scanned}/${p.total}` : 'Discovering folders…';
  return (
    <span className="chip bg-accent2/10 border-accent2/30 text-accent">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      {label}
    </span>
  );
}

export function AppShell() {
  const loc = useLocation();
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col">
      <header className="safe-t sticky top-0 z-30 flex items-center justify-between gap-3 bg-surface/90 px-4 pb-2 backdrop-blur">
        <Link to="/albums" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent2/20 text-accent">◫</span>
          <span>Sym Albums</span>
        </Link>
        <div className="flex items-center gap-2">
          <ScanPill />
          <Link
            to="/settings"
            className={`chip hover:text-slate-100 ${loc.pathname.startsWith('/settings') ? 'text-slate-100' : ''}`}
            aria-label="Settings"
          >
            ⚙ Settings
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 pb-24 pt-2">
        <Outlet />
      </main>
    </div>
  );
}
