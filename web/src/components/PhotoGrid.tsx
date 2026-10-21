import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Photo } from '../lib/api';
import { Thumb } from './Thumb';

type Props = {
  photos: Photo[];
  isSelected: (id: number) => boolean;
  onToggle: (p: Photo) => void;
  onEndReached?: () => void;
  emptyMessage?: string;
};

function useColumns(): number {
  const [cols, setCols] = useState(() => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w >= 1024) return 6;
    if (w >= 768) return 5;
    if (w >= 480) return 4;
    return 3;
  });
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setCols(w >= 1024 ? 6 : w >= 768 ? 5 : w >= 480 ? 4 : 3);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return cols;
}

export function PhotoGrid({ photos, isSelected, onToggle, onEndReached, emptyMessage = 'No photos in this folder.' }: Props) {
  const cols = useColumns();
  const parentRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => {
    const out: Photo[][] = [];
    for (let i = 0; i < photos.length; i += cols) out.push(photos.slice(i, i + cols));
    return out;
  }, [photos, cols]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 128,
    overscan: 4,
  });

  useEffect(() => {
    if (!onEndReached) return;
    const el = parentRef.current;
    if (!el) return;
    const items = rowVirtualizer.getVirtualItems();
    if (!items.length) return;
    const last = items[items.length - 1];
    if (last.index >= rows.length - 2) onEndReached();
  }, [rowVirtualizer, rows.length, onEndReached, rowVirtualizer.getVirtualItems()]);

  if (photos.length === 0) {
    return <div className="card p-6 text-center text-sm text-muted">{emptyMessage}</div>;
  }

  return (
    <div ref={parentRef} className="h-[calc(100vh-260px)] overflow-y-auto rounded-2xl bg-panel/40">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {rowVirtualizer.getVirtualItems().map(v => {
          const row = rows[v.index];
          return (
            <div
              key={v.key}
              ref={rowVirtualizer.measureElement}
              data-index={v.index}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}
              className="px-1 py-1"
            >
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {row.map(p => (
                  <Thumb key={p.id} hash={p.hash} alt={p.name} selected={isSelected(p.id)} onClick={() => onToggle(p)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
