import { thumbUrl } from '../lib/api';

type Props = {
  hash: string;
  alt?: string;
  className?: string;
  selected?: boolean;
  onClick?: () => void;
};

export function Thumb({ hash, alt = '', className = '', selected = false, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-lg bg-panel2 ${selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-surface' : ''} ${className}`}
    >
      <img
        src={thumbUrl(hash)}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="h-full w-full object-cover transition group-active:scale-[0.98]"
      />
      {selected && (
        <span className="absolute inset-0 bg-accent2/25" />
      )}
      {selected && (
        <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-white shadow">
          ✓
        </span>
      )}
    </button>
  );
}
