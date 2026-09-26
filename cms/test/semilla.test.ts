/**
 * P2-06 (auditoría 2026-09): la semilla difería de lo publicado en 73 valores
 * y una base nueva arrancaba con textos antiguos. Ahora lo publicado manda.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultContentEntries } from '../content/defaultContent';

const publicado = JSON.parse(readFileSync('src/data/cms-content.json', 'utf8')).entries as Record<
  string,
  { fields: Record<string, { value: unknown }> }
>;

describe('P2-06: semilla y contenido publicado', () => {
  it('ningún campo sembrado difiere de lo publicado', () => {
    const distintos: string[] = [];
    for (const entrada of defaultContentEntries) {
      const p = publicado[entrada.id];
      if (!p) continue;
      for (const [key, campo] of Object.entries(entrada.fields)) {
        const valor = p.fields?.[key]?.value;
        if (valor === undefined || valor === null) continue;
        if (JSON.stringify(valor) !== JSON.stringify(campo.value)) {
          distintos.push(`${entrada.id}.${key}`);
        }
      }
    }
    expect(distintos).toEqual([]);
  });
});
