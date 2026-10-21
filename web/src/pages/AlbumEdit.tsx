import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type Photo } from '../lib/api';
import { useSelection } from '../lib/useSelection';
import { FolderBrowser } from '../components/FolderBrowser';
import { PhotoGrid } from '../components/PhotoGrid';
import { SelectionBar } from '../components/SelectionBar';

type Pane = 'folders' | 'photos';

export function AlbumEdit() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const nav = useNavigate();
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [pane, setPane] = useState<Pane>('folders');
  const [currentDir, setCurrentDir] = useState<string | undefined>(undefined);
  const [browsePath, setBrowsePath] = useState<string | undefined>(undefined);
  const [nameError, setNameError] = useState<string | null>(null);
  const [showAllTab, setShowAllTab] = useState(false);

  const sel = useSelection();

  const detail = useQuery({
    queryKey: ['album', id],
    queryFn: () => api.album(Number(id)),
    enabled: !isNew,
  });

  // On first load of an existing album, seed the selection and clear on unmount.
  useEffect(() => {
    if (isNew) { sel.clear(); return; }
    if (!detail.data) return;
    setName(detail.data.album.name);
    sel.set(detail.data.photos);
    return () => sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.data?.album.id]);

  useEffect(() => {
    if (isNew) sel.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const photosQ = useQuery({
    queryKey: ['photos', currentDir],
    queryFn: () => api.allPhotos(currentDir!),
    enabled: !!currentDir && !showAllTab,
  });

  const folderPhotos = photosQ.data?.photos ?? [];
  const allSelectedInFolder = folderPhotos.length > 0 && folderPhotos.every(p => sel.has(p.id));

  const selectedPhotos = useMemo(() => Array.from(sel.items.values()), [sel.items]);

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Name is required');
      const ids = sel.ids();
      if (ids.length === 0) throw new Error('Pick at least one photo');
      if (isNew) return api.createAlbum(trimmed, ids);
      return api.updateAlbum(Number(id), { name: trimmed, photo_ids: ids });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['albums'] });
      await qc.invalidateQueries({ queryKey: ['album', id] });
      sel.clear();
      nav('/albums');
    },
    onError: (err: any) => setNameError(String(err?.message ?? err)),
  });

  const remove = useMutation({
    mutationFn: () => api.deleteAlbum(Number(id)),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['albums'] });
      sel.clear();
      nav('/albums');
    },
  });

  const openFolder = (p: string) => {
    setCurrentDir(p);
    setShowAllTab(false);
    setPane('photos');
  };

  return (
    <div>
      <div className="flex items-center gap-2 pb-3">
        <button className="btn-ghost" onClick={() => (pane === 'photos' ? setPane('folders') : nav(-1))}>
          ← {pane === 'photos' ? 'Folders' : 'Back'}
        </button>
        <input
          className="input flex-1"
          placeholder="Album name"
          value={name}
          onChange={e => { setName(e.target.value); setNameError(null); }}
        />
      </div>

      {nameError && <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{nameError}</div>}

      <div className="flex gap-2 pb-3">
        <button
          className={`chip ${pane === 'folders' && !showAllTab ? 'text-slate-100 border-accent/50 bg-accent2/10' : ''}`}
          onClick={() => { setPane('folders'); setShowAllTab(false); }}
        >
          Browse folders
        </button>
        {!isNew && (
          <button
            className={`chip ${showAllTab ? 'text-slate-100 border-accent/50 bg-accent2/10' : ''}`}
            onClick={() => { setShowAllTab(true); setPane('photos'); }}
          >
            Current album ({selectedPhotos.length})
          </button>
        )}
      </div>

      {pane === 'folders' && (
        <FolderBrowser
          kind="photos"
          path={browsePath}
          onNavigate={setBrowsePath}
          onSelectFolder={openFolder}
        />
      )}

      {pane === 'photos' && showAllTab && (
        <PhotoGrid
          photos={selectedPhotos}
          isSelected={id => sel.has(id)}
          onToggle={(p) => sel.toggle(p)}
          emptyMessage="This album is empty. Browse folders and tap photos to add them."
        />
      )}

      {pane === 'photos' && !showAllTab && currentDir && (
        <>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted">
            <div className="min-w-0 flex-1 truncate">{currentDir}</div>
            {folderPhotos.length > 0 && (
              <button
                className="chip hover:text-slate-100"
                onClick={() => {
                  if (allSelectedInFolder) for (const p of folderPhotos) sel.remove(p.id);
                  else for (const p of folderPhotos) sel.add(p);
                }}
              >
                {allSelectedInFolder ? 'Deselect all' : `Select all (${folderPhotos.length})`}
              </button>
            )}
          </div>
          {photosQ.isLoading ? (
            <div className="card p-6 text-center text-sm text-muted">Loading…</div>
          ) : (
            <PhotoGrid
              photos={folderPhotos}
              isSelected={id => sel.has(id)}
              onToggle={(p) => sel.toggle(p)}
              emptyMessage="No photos indexed in this folder. Try Rescan from Settings."
            />
          )}
        </>
      )}

      <SelectionBar
        count={sel.count()}
        onCancel={() => { sel.clear(); nav('/albums'); }}
        onSave={() => save.mutate()}
        disabled={save.isPending || !name.trim() || sel.count() === 0}
        saveLabel={isNew ? 'Create album' : 'Save changes'}
      />

      {!isNew && (
        <div className="mt-6 flex justify-end">
          <button
            className="btn-danger"
            onClick={() => {
              if (confirm('Delete this album? The originals are safe — only the symlink folder is removed.')) remove.mutate();
            }}
          >
            Delete album
          </button>
        </div>
      )}
    </div>
  );
}
