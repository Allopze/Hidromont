/**
 * P1-06 (auditoría 2026-09): «Revisiones» restauraba estados de meses atrás
 * porque la importación (`upsertEntry`) cambiaba campos sin dejar revisión.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { ContentRepository } from '../repositories/ContentRepository';

function repo() {
  const db = new Database(':memory:');
  migrate(db);
  return { db, repo: new ContentRepository(db) };
}

const entrada = (titulo: string, now: string) => ({
  id: 'page.prueba',
  kind: 'page',
  slug: 'prueba',
  title: 'Prueba',
  fields: [{ key: 'title', type: 'text' as const, value: titulo }],
  now,
});

describe('P1-06: revisiones fieles al contenido', () => {
  it('upsertEntry sobre una entrada existente sube versión y deja revisión', () => {
    const { repo: r } = repo();
    r.upsertEntry(entrada('Uno', '2026-06-01T00:00:00.000Z'));
    r.upsertEntry(entrada('Dos', '2026-09-01T00:00:00.000Z'));

    const revisiones = r.listRevisions('page.prueba');
    expect(revisiones.map((v) => v.version)).toEqual([2, 1]);
    // Restaurar «la anterior» devuelve exactamente el estado previo.
    expect(r.getRevision(revisiones[1].id)?.fields.title.value).toBe('Uno');
    expect(r.getRevision(revisiones[0].id)?.fields.title.value).toBe('Dos');
  });

  it('ensureCurrentRevisions corrige la deriva y es idempotente', () => {
    const { db, repo: r } = repo();
    r.upsertEntry(entrada('Junio', '2026-06-01T00:00:00.000Z'));
    // Deriva como la de la base local: el campo cambia sin revisión.
    db.prepare(
      `UPDATE content_fields SET value_json = ? WHERE entry_id = 'page.prueba' AND key = 'title'`
    ).run(JSON.stringify('Septiembre'));

    expect(r.ensureCurrentRevisions()).toEqual(['page.prueba']);
    const [ultima] = r.listRevisions('page.prueba');
    expect(r.getRevision(ultima.id)?.fields.title.value).toBe('Septiembre');
    expect(r.findEntry('page.prueba')?.version).toBe(ultima.version);

    expect(r.ensureCurrentRevisions()).toEqual([]);
  });
});

describe('P2-26: revisiones con valores y restauración por campo', () => {
  const dosCampos = (titulo: string, subtitulo: string, now: string) => ({
    id: 'page.prueba',
    kind: 'page',
    slug: 'prueba',
    title: 'Prueba',
    fields: [
      { key: 'title', type: 'text' as const, value: titulo },
      { key: 'subtitle', type: 'text' as const, value: subtitulo },
    ],
    now,
  });

  it('cada versión dice qué cambió y, con campo, trae su valor', () => {
    const { repo: r } = repo();
    r.upsertEntry(dosCampos('Uno', 'Sub', '2026-06-01T00:00:00.000Z'));
    r.updateField('page.prueba', 'title', 'Dos', '2026-09-01T00:00:00.000Z');
    r.updateField('page.prueba', 'subtitle', 'Sub 2', '2026-09-02T00:00:00.000Z');

    const todas = r.listRevisionsDetailed('page.prueba');
    expect(todas.map((v) => v.changed)).toEqual([['subtitle'], ['title'], []]);
    expect(todas[0]).not.toHaveProperty('value');

    const delTitulo = r.listRevisionsDetailed('page.prueba', 'title');
    expect(delTitulo.map((v) => v.value)).toEqual(['Dos', 'Dos', 'Uno']);
  });

  it('restaurar un campo no toca los demás', async () => {
    const { db, repo: r } = repo();
    r.upsertEntry(dosCampos('Uno', 'Sub', '2026-06-01T00:00:00.000Z'));
    r.updateField('page.prueba', 'title', 'Dos', '2026-09-01T00:00:00.000Z');
    r.updateField('page.prueba', 'subtitle', 'Sub 2', '2026-09-02T00:00:00.000Z');
    const antigua = r.listRevisionsDetailed('page.prueba', 'title').at(-1)!;

    const { ContentService } = await import('../services/contentService');
    const servicio = new ContentService(r) as unknown as {
      restoreRevisionField(
        e: string,
        rev: string,
        k: string
      ): { fields: Record<string, { value: unknown }> };
    };
    const entrada = servicio.restoreRevisionField('page.prueba', antigua.id, 'title');
    expect(entrada.fields.title.value).toBe('Uno');
    expect(entrada.fields.subtitle.value).toBe('Sub 2');
    // Queda en el historial como un guardado más.
    expect(r.listRevisionsDetailed('page.prueba')[0].changed).toEqual(['title']);
    db.close();
  });
});
