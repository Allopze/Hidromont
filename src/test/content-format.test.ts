/**
 * A-5 — Los .md de contenido deben ser punto fijo del formateo del export.
 *
 * Si dejan de serlo, `npm run cms:export` vuelve a producir un diff de
 * cientos de líneas de puro formato y los cambios reales se pierden dentro.
 * Este test lo detecta en CI, que es lo que ninguna revisión manual sostiene
 * en el tiempo: el estilo del frontmatter lo fija el js-yaml 3.x que
 * `gray-matter` trae empaquetado, así que un `npm update` puede cambiarlo sin
 * que nadie toque una línea de este repositorio.
 *
 * Usa `canonicalMarkdown` del propio exportador a propósito. Una segunda
 * implementación aquí podría divergir del original, que es exactamente la
 * clase de problema que A-5 vino a arreglar.
 */
import { globSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { canonicalMarkdown } from '../../cms/services/exportService';

const files = globSync('src/content/**/*.md');

describe('formato canónico del contenido exportado', () => {
  it('encuentra archivos de contenido que validar', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('todos los .md son punto fijo del formateo del export', async () => {
    const desviados: string[] = [];
    for (const file of files) {
      const raw = readFileSync(file, 'utf8');
      const parsed = matter(raw);
      const canonico = await canonicalMarkdown(parsed.data, parsed.content, file);
      if (canonico !== raw) desviados.push(file);
    }
    // Se acumulan en lugar de fallar en el primero, para que el mensaje
    // enumere todo lo que hay que renormalizar de una vez.
    expect(desviados).toEqual([]);
  });

  it('el frontmatter está en orden canónico', () => {
    const desordenados: string[] = [];
    for (const file of files) {
      const claves = Object.keys(matter(readFileSync(file, 'utf8')).data);
      if (JSON.stringify(claves) !== JSON.stringify([...claves].sort())) desordenados.push(file);
    }
    expect(desordenados).toEqual([]);
  });
});
