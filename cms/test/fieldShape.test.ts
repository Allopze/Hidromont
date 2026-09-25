/**
 * Una lista de grupos no puede guardarse como lista de textos.
 *
 * `procesos` de los servicios es `[{ titulo, descripcion }]`. El formulario de
 * colección la pintaba con `String(item)`, y tocar un elemento y guardar
 * reemplazaba los cuatro procesos por «[object Object]». Reproducido contra la
 * base real el 24-09-2026; el servidor lo aceptaba porque solo exigía un array.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ContentRepository } from '../repositories/ContentRepository';
import { problemaDeForma } from '../validators/fieldShape';
import { createTestApp, type TestApp } from './setup';

const PROCESOS = [
  { titulo: 'Ingeniería', descripcion: 'Diseño 3D.' },
  { titulo: 'Montaje', descripcion: 'Instalación en obra.' },
];

describe('problemaDeForma', () => {
  it('acepta una lista de grupos editada', () => {
    const editada = [{ ...PROCESOS[0], titulo: 'Ingeniería básica' }, PROCESOS[1]];
    expect(problemaDeForma('Procesos', PROCESOS, editada)).toBeNull();
  });

  it('rechaza que una lista de grupos vuelva como textos', () => {
    expect(problemaDeForma('Procesos', PROCESOS, ['Ingeniería', 'Montaje'])).toMatch(/Procesos/);
  });

  it('rechaza «[object Object]» en cualquier forma', () => {
    const casos = [
      '[object Object]',
      ['[object Object]'],
      [{ titulo: '[object Object]', descripcion: '' }],
    ];
    for (const caso of casos) expect(problemaDeForma('Campo', 'x', caso)).not.toBeNull();
  });

  it('permite vaciar la lista y no afecta a las listas de textos', () => {
    expect(problemaDeForma('Procesos', PROCESOS, [])).toBeNull();
    expect(problemaDeForma('Normas', ['DIN 19705-1'], ['DIN 19705-1', 'ASME'])).toBeNull();
    expect(problemaDeForma('Título', 'Compuertas', 'Compuertas de acero')).toBeNull();
  });
});

describe('PATCH de un campo con lista de grupos', () => {
  let ctx: TestApp;
  let csrfToken: string;
  let cookieHeader: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    ({ csrfToken, cookieHeader } = await ctx.login());
    new ContentRepository(ctx.db).upsertEntry({
      id: 'servicios.forma',
      kind: 'servicio',
      slug: 'forma',
      title: 'Forma',
      fields: [{ key: 'procesos', type: 'list', value: PROCESOS }],
      now: new Date().toISOString(),
    });
  });

  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
  });

  const patch = (value: unknown) =>
    ctx.app.inject({
      method: 'PATCH',
      url: '/api/cms/entries/servicios.forma/fields/procesos',
      headers: {
        cookie: cookieHeader,
        'x-csrf-token': csrfToken,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ value }),
    });

  it('rechaza el guardado dañado y conserva los grupos', async () => {
    const res = await patch(PROCESOS.map(() => '[object Object]'));
    expect(res.statusCode).toBe(400);
    expect(res.json<{ error: string }>().error).toMatch(/valor dañado/);
    expect(ctx.contentService.getEntry('servicios.forma').fields.procesos.value).toEqual(PROCESOS);
  });

  it('guarda los grupos editados', async () => {
    const editada = [{ titulo: 'Ingeniería', descripcion: 'Diseño 3D y cálculo.' }];
    const res = await patch(editada);
    expect(res.statusCode).toBe(200);
    expect(ctx.contentService.getEntry('servicios.forma').fields.procesos.value).toEqual(editada);
  });
});
