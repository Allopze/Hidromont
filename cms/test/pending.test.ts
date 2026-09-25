/**
 * «Qué se va a publicar»: el resumen de lo guardado desde la última
 * publicación correcta, en palabras de quien edita.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditRepository } from '../repositories/AuditRepository';
import { ContentRepository } from '../repositories/ContentRepository';
import { PublishJobRepository } from '../repositories/PublishJobRepository';
import { PendingService, resumirCambios, type EventoDeCambio } from '../services/pendingService';
import { createTestApp, type TestApp } from './setup';

const evento = (e: Partial<EventoDeCambio>): EventoDeCambio => ({
  action: 'field.update',
  entityType: 'entry',
  entityId: 'servicios.compuertas',
  data: null,
  createdAt: '2026-09-24T10:00:00.000Z',
  ...e,
});

const nombres = {
  entrada: (id: string) =>
    id === 'servicios.compuertas'
      ? {
          titulo: 'Compuertas',
          campo: (key: string) => ({ resumen: 'Resumen', titulo: 'Título' })[key] ?? key,
        }
      : null,
};

describe('resumirCambios', () => {
  it('agrupa por entrada y nombra los campos como los ve quien edita', () => {
    const cambios = resumirCambios(
      [
        evento({ data: { key: 'resumen' } }),
        evento({ data: { key: 'resumen' }, createdAt: '2026-09-24T11:00:00.000Z' }),
        evento({ data: { key: 'titulo' } }),
      ],
      nombres
    );
    expect(cambios).toEqual([
      {
        clave: 'entrada:servicios.compuertas',
        titulo: 'Compuertas',
        detalle: ['Resumen', 'Título'],
        entryId: 'servicios.compuertas',
        ultimo: '2026-09-24T11:00:00.000Z',
      },
    ]);
  });

  it('resume la galería en una línea, contando cosas distintas y no eventos', () => {
    const cambios = resumirCambios(
      [
        evento({ action: 'gallery.item.update', entityType: 'gallery_item', entityId: 'a' }),
        evento({ action: 'gallery.item.update', entityType: 'gallery_item', entityId: 'a' }),
        evento({ action: 'gallery.item.create', entityType: 'gallery_item', entityId: 'b' }),
        evento({ action: 'gallery.album.update', entityType: 'gallery_album', entityId: 'x' }),
      ],
      nombres
    );
    expect(cambios).toHaveLength(1);
    expect(cambios[0]).toMatchObject({ titulo: 'Galería', detalle: ['2 fotos', '1 álbum'] });
  });

  it('una entrada borrada aparece con su nombre, solo como eliminada', () => {
    const [cambio] = resumirCambios(
      [
        evento({ action: 'field.update', entityId: 'proyectos.antiguo', data: { key: 'nombre' } }),
        evento({
          action: 'entry.delete',
          entityId: 'proyectos.antiguo',
          data: { undo: { etiqueta: 'la entrada «Presa Antigua»' } },
        }),
      ],
      nombres
    );
    expect(cambio).toMatchObject({ titulo: 'Presa Antigua', detalle: ['Entrada eliminada'] });
    expect(cambio.entryId).toBeUndefined();
  });

  it('una entrada creada y borrada antes de publicar no cuenta', () => {
    const cambios = resumirCambios(
      [
        evento({ action: 'entry.create', entityId: 'servicio.prueba' }),
        evento({ action: 'field.update', entityId: 'servicio.prueba', data: { key: 'titulo' } }),
        evento({ action: 'entry.delete', entityId: 'servicio.prueba' }),
      ],
      nombres
    );
    expect(cambios).toEqual([]);
  });
});

describe('PendingService', () => {
  let ctx: TestApp;
  let servicio: PendingService;
  let auditoria: AuditRepository;

  beforeAll(async () => {
    ctx = await createTestApp();
    auditoria = new AuditRepository(ctx.db);
    servicio = new PendingService(ctx.db, ctx.contentService);
    new ContentRepository(ctx.db).upsertEntry({
      id: 'page.pendiente',
      kind: 'page',
      slug: '/pendiente',
      title: 'Página pendiente',
      fields: [{ key: 'lead', type: 'text', value: 'Hola' }],
      now: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
  });

  it('cuenta solo lo guardado después de la última publicación correcta', async () => {
    auditoria.log({
      action: 'field.update',
      entityType: 'entry',
      entityId: 'page.pendiente',
      data: { key: 'lead' },
    });
    expect(servicio.pendientes().cambios.map((c) => c.titulo)).toContain('Página pendiente');

    // Una publicación fallida no cuenta; una correcta deja la lista vacía.
    const jobs = new PublishJobRepository(ctx.db);
    const fallida = jobs.start({ action: 'publish', now: new Date().toISOString() });
    jobs.finish({ id: fallida.id, status: 'failed', logs: [], now: new Date().toISOString() });
    expect(servicio.pendientes().total).toBeGreaterThan(0);

    await new Promise((r) => setTimeout(r, 5));
    const correcta = jobs.start({ action: 'publish', now: new Date().toISOString() });
    jobs.finish({ id: correcta.id, status: 'succeeded', logs: [], now: new Date().toISOString() });
    const despues = servicio.pendientes();
    expect(despues.total).toBe(0);
    expect(despues.desde).not.toBeNull();
  });

  it('los inicios de sesión no son cambios del sitio', () => {
    auditoria.log({ action: 'login.success', entityType: 'user', entityId: 'x' });
    expect(servicio.pendientes().total).toBe(0);
  });
});
