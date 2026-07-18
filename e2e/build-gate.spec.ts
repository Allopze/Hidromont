/**
 * Build gate — verifica que el build de producción NO filtra el editor del CMS.
 *
 * H1 (de AUDITORIA_PRODUCCION.md / AUDITORIA_LOGICA_UIUX.md): con PUBLIC_ENABLE_CMS=1,
 * el dist/ incluye ~66 KB de JS inline del overlay + atributos data-cms-entry en cada
 * página. Este test inspecciona directamente los archivos generados en dist/ y falla
 * si encuentra marcadores del CMS, independientemente del servidor.
 *
 * Requisito: ejecutar `npm run build` antes (PUBLIC_ENABLE_CMS debe ser 0 en el build
 * de producción). En CI se ejecuta tras el build.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const DIST_DIR = process.env.BUILD_DIST ?? join(process.cwd(), 'dist');

function listHtmlFiles(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listHtmlFiles(full, acc);
    } else if (entry.endsWith('.html')) {
      acc.push(full);
    }
  }
  return acc;
}

test.describe('Production build gate (H1)', () => {
  test('dist/ exists and contains HTML pages', () => {
    const files = listHtmlFiles(DIST_DIR);
    expect(files.length, 'expected at least one HTML page in dist/').toBeGreaterThan(0);
  });

  test('no data-cms-entry attributes in any built page', () => {
    const files = listHtmlFiles(DIST_DIR);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, `${file} should not contain data-cms-entry`).not.toContain('data-cms-entry');
    }
  });

  test('no __HIDROMONT_CMS__ markers in any built page', () => {
    const files = listHtmlFiles(DIST_DIR);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, `${file} should not contain __HIDROMONT_CMS__`).not.toContain('__HIDROMONT_CMS__');
    }
  });

  test('no hm-cms-* CSS classes in any built page', () => {
    const files = listHtmlFiles(DIST_DIR);
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      expect(content, `${file} should not contain hm-cms- classes`).not.toMatch(/hm-cms-/);
    }
  });
});
