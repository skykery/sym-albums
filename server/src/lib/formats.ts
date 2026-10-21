const ALLOWED = new Set([
  '.jpg', '.jpeg', '.png', '.heic', '.heif', '.webp', '.avif', '.gif',
]);

const RAW = new Set([
  '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.dng', '.raf', '.pef',
  '.srw', '.x3f', '.3fr', '.erf', '.mef', '.mos', '.mrw', '.nrw', '.rwl',
  '.ptx', '.iiq', '.kdc', '.dcr',
]);

export function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i < 0 ? '' : name.slice(i).toLowerCase();
}

export function isPhoto(name: string): boolean {
  if (name.startsWith('.')) return false;
  const ext = extOf(name);
  if (RAW.has(ext)) return false;
  return ALLOWED.has(ext);
}
