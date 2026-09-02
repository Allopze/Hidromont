import path from 'node:path';

export function resolveStaticDir(rootDir: string, configuredDir?: string): string {
  return path.resolve(rootDir, configuredDir || 'dist');
}
