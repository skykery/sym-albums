import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ScanProgress } from './api';

const INITIAL: ScanProgress = { scanned: 0, total: 0, currentDir: '', done: true };

export function useScanProgress(): ScanProgress {
  const [progress, setProgress] = useState<ScanProgress>(INITIAL);
  const wasRunning = useRef(false);
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource('/api/scan/progress');
    es.onmessage = e => {
      try {
        const next = JSON.parse(e.data) as ScanProgress;
        setProgress(next);
        const running = !next.done;
        if (wasRunning.current && !running) {
          qc.invalidateQueries({ queryKey: ['stats'] });
          qc.invalidateQueries({ queryKey: ['albums'] });
        }
        wasRunning.current = running;
      } catch { /* ignore */ }
    };
    return () => es.close();
  }, [qc]);

  return progress;
}
