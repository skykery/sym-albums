import path from 'node:path';

export function isWithin(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function safeResolve(base: string, requested: string | undefined): string {
  if (!requested) return base;
  const abs = path.isAbsolute(requested) ? requested : path.resolve(base, requested);
  if (!isWithin(abs, base) && abs !== base) {
    throw new Error(`path escapes root: ${requested}`);
  }
  return abs;
}
