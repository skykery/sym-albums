import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { api } from '../lib/api';

export function RootGate() {
  const loc = useLocation();
  const { data, isLoading } = useQuery({ queryKey: ['config'], queryFn: api.config });

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        Loading…
      </div>
    );
  }

  const onSetup = loc.pathname.startsWith('/setup');
  if (!data?.first_run_done && !onSetup) return <Navigate to="/setup" replace />;
  if (data?.first_run_done && onSetup) return <Navigate to="/albums" replace />;
  return <Outlet />;
}
