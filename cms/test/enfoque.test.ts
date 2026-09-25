/**
 * El punto de enfoque llega al sitio.
 *
 * Hasta sep-2026 se guardaba en la biblioteca pero el export escribía los
 * campos de imagen solo con la ruta: ningún recorte lo respetaba. Ahora viaja
 * en cms-content.json junto al campo, y solo cuando no es el centro, para que
 * el archivo no cambie en las fotos que nadie ha tocado.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditRepository } from '../repositories/AuditRepository';
import { ContentRepository } from '../repositories/ContentRepository';
import { MediaRepository } from '../repositories/MediaRepository';
import { ExportService } from '../services/exportService';
import { PendingService } from '../services/pendingService';
import { createTestApp, type TestApp } from './setup';

const ahora = () => new Date().toISOString();

function medio(id: string, ruta: string, focalX: number, focalY: number) {
  return {
    id,
    name: path.basename(ruta),
    path: ruta,
    mime: 'image/webp',
    size: 10,
    focalX,
    focalY,
    checksum: id,
    createdAt: ahora(),
    updatedAt: ahora(),
  };
}

describe('export del punto de enfoque', () => {
  let ctx: TestApp;
  let raiz: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'hidromont-enfoque-'));
    const media = new MediaRepository(ctx.db);
    media.create(medio('m-arriba', '/fotos/arriba.webp', 0.5, 0.2));
    media.create(medio('m-centro', '/fotos/centro.webp', 0.5, 0.5));
    new ContentRepository(ctx.db).upsertEntry({
      id: 'page.enfoque',
      kind: 'page',
      slug: '/enfoque',
      title: 'Enfoque',
      fields: [
        { key: 'arriba', type: 'image', value: '/fotos/arriba.webp' },
        { key: 'centro', type: 'image', value: '/fotos/centro.webp' },
        { key: 'ajena', type: 'image', value: '/fotos/no-esta-en-la-biblioteca.webp' },
      ],
      now: ahora(),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
    fs.rmSync(raiz, { recursive: true, force: true });
  });

  it('escribe el enfoque de la foto junto al campo, salvo si es el centro', async () => {
    const exportService = new ExportService(
      new ContentRepository(ctx.db),
      raiz,
      undefined,
      undefined,
      new MediaRepository(ctx.db)
    );
    await exportService.exportContent();
    const json = JSON.parse(
      fs.readFileSync(path.join(raiz, 'src', 'data', 'cms-content.json'), 'utf8')
    );
    const campos = json.entries['page.enfoque'].fields;
    expect(campos.arriba.focal).toEqual({ x: 0.5, y: 0.2 });
    expect(campos.centro.focal).toBeUndefined();
    expect(campos.ajena.focal).toBeUndefined();
  });

  it('un cambio de encuadre cuenta como pendiente; uno de descripción no', () => {
    const auditoria = new AuditRepository(ctx.db);
    const pendientes = new PendingService(ctx.db, ctx.contentService);
    auditoria.log({
      action: 'media.update',
      entityType: 'media',
      entityId: 'm-centro',
      data: { enfoque: false },
    });
    expect(pendientes.pendientes().cambios.map((c) => c.clave)).not.toContain('encuadre');

    auditoria.log({
      action: 'media.update',
      entityType: 'media',
      entityId: 'm-arriba',
      data: { enfoque: true },
    });
    const encuadre = pendientes.pendientes().cambios.find((c) => c.clave === 'encuadre');
    expect(encuadre).toMatchObject({ titulo: 'Encuadre de fotos', detalle: ['1 foto'] });
  });
});
