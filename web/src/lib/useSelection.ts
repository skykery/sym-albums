import { create } from 'zustand';
import type { Photo } from './api';

type State = {
  items: Map<number, Photo>;
  toggle: (p: Photo) => void;
  add: (p: Photo) => void;
  remove: (id: number) => void;
  clear: () => void;
  set: (photos: Photo[]) => void;
  has: (id: number) => boolean;
  count: () => number;
  ids: () => number[];
};

export const useSelection = create<State>((set, get) => ({
  items: new Map(),
  toggle: (p) => {
    const next = new Map(get().items);
    if (next.has(p.id)) next.delete(p.id);
    else next.set(p.id, p);
    set({ items: next });
  },
  add: (p) => {
    if (get().items.has(p.id)) return;
    const next = new Map(get().items);
    next.set(p.id, p);
    set({ items: next });
  },
  remove: (id) => {
    if (!get().items.has(id)) return;
    const next = new Map(get().items);
    next.delete(id);
    set({ items: next });
  },
  clear: () => set({ items: new Map() }),
  set: (photos) => set({ items: new Map(photos.map(p => [p.id, p])) }),
  has: (id) => get().items.has(id),
  count: () => get().items.size,
  ids: () => Array.from(get().items.keys()),
}));
