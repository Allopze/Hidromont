import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveStaticDir } from '../../cms/config/staticDir';

describe('resolveStaticDir', () => {
  it('defaults to dist under the repository root', () => {
    expect(resolveStaticDir('/repo')).toBe(path.resolve('/repo', 'dist'));
  });

  it('resolves a relative capture output under the repository root', () => {
    expect(resolveStaticDir('/repo', '.capture/public')).toBe(
      path.resolve('/repo', '.capture/public')
    );
  });

  it('preserves an absolute capture output', () => {
    expect(resolveStaticDir('/repo', '/tmp/hidromont-cms')).toBe('/tmp/hidromont-cms');
  });
});
