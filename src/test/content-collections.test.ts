/**
 * Guardas del contenido de colecciones.
 *
 * Contexto: `src/content.config.ts` estuvo desde siempre en la ruta de Astro 5
 * mientras el proyecto corría Astro 4, que solo mira `src/content/config.*`.
 * El resultado es que los esquemas Zod de proyectos, servicios y clientes
 * **nunca validaron nada** y los `.default()` nunca se aplicaron. Al subir a
 * Astro 5 el config se activó y el desajuste salió a la primera compilación.
 *
 * Estas pruebas hacen el guarda explícito y rápido: fallan en 100 ms en vez de
 * esperar a que alguien mire la salida de un build de dos minutos.
 */
import { readFileSync, readdirSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CATEGORIA_PROYECTO,
  ICONO_SERVICIO,
  SERVICIO_SLUG,
  TIPO_PROYECTO,
} from '../data/content-vocabulary';

/** Réplica de los esquemas de `src/content.config.ts`. */
const proyecto = z.object({
  nombre: z.string(),
  cliente: z.string().optional(),
  mandante: z.string().optional(),
  contratista: z.string().optional(),
  alcance: z.string(),
  categoria: z.enum(CATEGORIA_PROYECTO),
  servicio: z.enum(SERVICIO_SLUG).optional(),
  tipo: z.enum(TIPO_PROYECTO).default('banco'),
  ubicacion: z.string().optional(),
  anio: z.number().optional(),
  diametro: z.string().optional(),
  longitud: z.string().optional(),
  peso: z.string().optional(),
  acero: z.string().optional(),
  normas: z.array(z.string()).optional(),
  orden: z.number().default(100),
});

const servicio = z.object({
  titulo: z.string(),
  resumen: z.string(),
  icono: z.enum(ICONO_SERVICIO),
  tipos: z.array(z.string()).optional(),
  aplicaciones: z.array(z.string()).optional(),
  normas: z.array(z.string()).optional(),
  procesos: z.array(z.object({ titulo: z.string(), descripcion: z.string() })).optional(),
  orden: z.number().default(100),
});

function fichas(coleccion: string) {
  const dir = `src/content/${coleccion}`;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ archivo: `${dir}/${f}`, datos: matter.read(`${dir}/${f}`).data }));
}

describe('frontmatter de las colecciones', () => {
  it('las 40 fichas de proyecto cumplen su esquema', () => {
    const malas = fichas('proyectos')
      .map((f) => ({ ...f, r: proyecto.safeParse(f.datos) }))
      .filter((f) => !f.r.success)
      .map(
        (f) =>
          `${f.archivo}: ${JSON.stringify(f.r.error!.issues.map((i) => i.path.join('.') + ' ' + i.message))}`
      );
    expect(malas).toEqual([]);
  });

  it('las 8 fichas de servicio cumplen su esquema', () => {
    const malas = fichas('servicios')
      .map((f) => ({ ...f, r: servicio.safeParse(f.datos) }))
      .filter((f) => !f.r.success)
      .map(
        (f) =>
          `${f.archivo}: ${JSON.stringify(f.r.error!.issues.map((i) => i.path.join('.') + ' ' + i.message))}`
      );
    expect(malas).toEqual([]);
  });

  /**
   * Los `.default()` solo existen si el config se carga. Mientras no se cargó,
   * una ficha sin `tipo` habría dado `undefined` y el filtro
   * `data.tipo === 'destacado'` de `proyectos/[slug].astro` la habría omitido
   * en silencio. Exigirlos explícitos deja de depender de ese matiz.
   */
  it('ninguna ficha depende de un valor por defecto para ordenarse o filtrarse', () => {
    const sinTipo = fichas('proyectos').filter((f) => f.datos.tipo === undefined);
    const sinOrden = [...fichas('proyectos'), ...fichas('servicios')].filter(
      (f) => f.datos.orden === undefined
    );
    expect(sinTipo.map((f) => f.archivo)).toEqual([]);
    expect(sinOrden.map((f) => f.archivo)).toEqual([]);
  });
});

describe('clientes.json', () => {
  const ruta = 'src/content/clientes/clientes.json';
  const bruto = JSON.parse(readFileSync(ruta, 'utf8')) as unknown;

  /**
   * Tiene TRES consumidores por DOS vías distintas, y por eso su forma es
   * frágil:
   *   · `clientes.astro` e `index.astro`, vía `getEntry('clientes','clientes')`
   *     — o sea, a través del loader `file()` de Astro.
   *   · `cms/content/defaultContent.ts`, que lo lee en crudo con `readFileSync`
   *     para sembrar las 24 claves de logo editables del panel.
   *
   * Cambiar la forma rompió el tercero sin que los dos primeros se enteraran.
   */
  it('es un array de entradas, que es lo que el loader file() espera', () => {
    expect(Array.isArray(bruto)).toBe(true);
    expect((bruto as unknown[]).length).toBe(1);
  });

  it('su única entrada se llama «clientes», que es lo que piden las páginas', () => {
    const [entrada] = bruto as Array<{ id?: string }>;
    expect(entrada.id).toBe('clientes');
  });

  it('todos los clientes tienen nombre y logo utilizable', () => {
    const [entrada] = bruto as Array<{ items: Array<{ nombre?: string; logo?: string }> }>;
    expect(entrada.items.length).toBeGreaterThan(0);
    expect(entrada.items.filter((c) => !c.nombre)).toEqual([]);
    // El logo es opcional en el esquema, pero un cliente sin logo no se pinta.
    expect(entrada.items.filter((c) => !c.logo).map((c) => c.nombre)).toEqual([]);
  });
});
