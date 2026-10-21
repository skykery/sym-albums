import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { FolderBrowser } from '../components/FolderBrowser';

type Step = 'welcome' | 'photos' | 'albums' | 'done';

export function Wizard() {
  const [step, setStep] = useState<Step>('welcome');
  const [photoRoot, setPhotoRoot] = useState<string | undefined>(undefined);
  const [albumsRoot, setAlbumsRoot] = useState<string | undefined>(undefined);
  const [photoBrowsePath, setPhotoBrowsePath] = useState<string | undefined>(undefined);
  const [albumBrowsePath, setAlbumBrowsePath] = useState<string | undefined>(undefined);
  const nav = useNavigate();
  const qc = useQueryClient();

  const finish = useMutation({
    mutationFn: async () => {
      await api.saveConfig({ photo_root: photoRoot!, albums_root: albumsRoot!, first_run_done: true });
      await api.startScan();
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['config'] });
      nav('/albums', { replace: true });
    },
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-6 safe-t safe-b">
      <StepDots step={step} />

      {step === 'welcome' && (
        <div className="mt-8 flex flex-1 flex-col justify-center">
          <div className="card p-8 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent2/20 text-2xl text-accent">◫</div>
            <h1 className="text-2xl font-semibold tracking-tight">Sym Albums</h1>
            <p className="mt-2 text-muted">
              Curate photo albums as folders of symbolic links — pull shots from anywhere on the server, leave the originals in place.
            </p>
            <button className="btn-primary mt-6 w-full" onClick={() => setStep('photos')}>Get started</button>
          </div>
        </div>
      )}

      {step === 'photos' && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Where are your photos?</h2>
          <p className="text-sm text-muted">Pick the folder that contains your photo collection. Subfolders will be included.</p>
          <div className="mt-4">
            <FolderBrowser
              kind="photos"
              path={photoBrowsePath}
              onNavigate={setPhotoBrowsePath}
              onSelectFolder={(p) => { setPhotoRoot(p); setStep('albums'); }}
              showPhotoCounts={false}
            />
          </div>
        </div>
      )}

      {step === 'albums' && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Where should albums live?</h2>
          <p className="text-sm text-muted">Each album becomes a folder here, filled with symlinks back to your originals.</p>
          <div className="mt-4">
            <FolderBrowser
              kind="albums"
              path={albumBrowsePath}
              onNavigate={setAlbumBrowsePath}
              onSelectFolder={(p) => { setAlbumsRoot(p); setStep('done'); }}
              showPhotoCounts={false}
            />
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="mt-8 flex flex-1 flex-col justify-center">
          <div className="card space-y-4 p-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Photo root</div>
              <div className="mt-1 break-all font-mono text-sm">{photoRoot}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted">Albums output</div>
              <div className="mt-1 break-all font-mono text-sm">{albumsRoot}</div>
            </div>
            <p className="text-sm text-muted">Indexing runs in the background — you can start making albums right away, thumbnails fill in as they're generated.</p>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setStep('welcome')}>Back</button>
              <button className="btn-primary flex-1" onClick={() => finish.mutate()} disabled={finish.isPending}>
                {finish.isPending ? 'Starting…' : 'Finish setup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StepDots({ step }: { step: Step }) {
  const order: Step[] = ['welcome', 'photos', 'albums', 'done'];
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-2">
      {order.map((_, i) => (
        <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-6 bg-accent' : i < idx ? 'w-2 bg-accent2/60' : 'w-2 bg-edge'}`} />
      ))}
    </div>
  );
}
