type Props = {
  count: number;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  disabled?: boolean;
};

export function SelectionBar({ count, onCancel, onSave, saveLabel = 'Save', disabled }: Props) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge/60 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3 safe-b">
        <div className="text-sm">
          <span className="text-slate-100">{count}</span> <span className="text-muted">selected</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn-primary disabled:opacity-40" onClick={onSave} disabled={disabled}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
