/**
 * B-01 (auditoría 2026-09-28): la API aceptaba en campos de imagen valores que
 * no son una foto del sitio, textos de cualquier largo y, al crear, valores de
 * enumeración que no existen.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { esArchivoDelSitio } from '../controllers/ContentController';
import { createTestApp, type TestApp } from './setup';

const FOTO = '/fotos/catalogo/turbinas-mecanizado-brida-camara-espiral.webp';

describe('esArchivoDelSitio', () => {
  it.each([
    ['https://evil.example/x.png', false],
    ['javascript:alert(1)', false],
    ['fotos/catalogo/x.webp', false],
    ['//evil.example/x.png', false],
    ['/../package.json', false],
    ['/fotos/../../package.json', false],
    ['/fotos/no-existe.webp', false],
    [FOTO, true],
  ])('%s → %s', (valor, esperado) => {
    expect(esArchivoDelSitio(valor)).toBe(esperado);
  });
});

describe('B-01: validación de campos por la API', () => {
  let ctx: TestApp;
  let H: Record<string, string>;

  beforeAll(async () => {
    ctx = await createTestApp();
    ctx.contentService.importMissingEntries();
    const { csrfToken, cookieHeader } = await ctx.login();
    H = { cookie: cookieHeader, 'x-csrf-token': csrfToken, 'content-type': 'application/json' };
  });
  afterAll(async () => {
    await ctx.app.close();
    ctx.cleanup();
  });

  const cambiar = (entry: string, key: string, value: unknown) =>
    ctx.app.inject({
      method: 'PATCH',
      url: `/api/cms/entries/${entry}/fields/${key}`,
      headers: H,
      body: JSON.stringify({ value }),
    });

  it('una imagen solo puede ser un archivo del sitio que exista, o vacía', async () => {
    for (const malo of ['https://evil.example/x.png', 'javascript:alert(1)', 'fotos/x.webp']) {
      expect((await cambiar('home.hero', 'image', malo)).statusCode, malo).toBe(400);
    }
    expect((await cambiar('home.hero', 'image', FOTO)).statusCode).toBe(200);
    expect((await cambiar('home.hero', 'image', '')).statusCode).toBe(200);
  });

  it('un texto de una línea no puede tener 100.000 caracteres', async () => {
    const res = await cambiar('home.hero', 'secondaryLabel', 'x'.repeat(100_000));
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/demasiado largo/);
    expect((await cambiar('home.hero', 'secondaryLabel', 'Ver proyectos')).statusCode).toBe(200);
  });

  it('al crear un proyecto, una categoría que no existe se rechaza', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/cms/entries',
      headers: H,
      body: JSON.stringify({
        id: 'proyectos.validacion-b01',
        kind: 'proyecto',
        slug: 'validacion-b01',
        title: 'Validación',
        fields: { categoria: { type: 'text', value: 'inventada' } },
      }),
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/categoria/);
  });
});
