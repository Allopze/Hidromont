/**
 * Toda clave que el sitio pide al CMS debe existir en el contenido exportado.
 *
 * Había 11 claves que el frontend pedía y que no existían en el export, más
 * 9 logos de cliente sin sembrar. No rompían nada —`getCmsText` cae al texto
 * escrito en el código— y por eso nadie las veía: el aviso solo sale por
 * consola en desarrollo. Pero significaba que esos textos parecían editables
 * desde el panel y no lo eran, que es peor que no ofrecerlos.
 *
 * La deriva vuelve sola en cuanto alguien añade un `getCmsText` con una clave
 * nueva y olvida sembrarla, así que se fija aquí.
 */
import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const cms = JSON.parse(readFileSync('src/data/cms-content.json', 'utf8')) as {
  entries: Record<string, { fields?: Record<string, unknown> }>;
};

/** `getCmsText('entrada', 'clave', …)` y sus hermanas, con claves literales. */
const LITERAL_CALL = /getCms(?:Text|Number|Value|Image)\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
/** Llamadas cuya clave se construye con una plantilla: no son analizables. */
const DYNAMIC_CALL = /getCms(?:Text|Number|Value|Image)\(\s*(?:`|[^)]*\$\{)/;

/**
 * Archivos que construyen la clave en tiempo de ejecución
 * (`project-image.${slug}.image` y equivalentes). Ningún análisis estático
 * puede resolverlas, así que se congela la lista: añadir un archivo nuevo
 * obliga a decidir conscientemente cómo se garantiza que la clave exista.
 */
const ARCHIVOS_CON_CLAVE_DINAMICA = [
  // Logos por nombre de cliente: `logo-${logoKeyFor(nombre)}`. Cubierto
  // porque el seed deriva las claves de la misma colección.
  'src/data/cliente-logos.ts',
  // Imágenes y galerías por slug: `project-image.${slug}.image`. Cubierto
  // porque el seed las genera del mismo listado de slugs.
  'src/data/project-galleries.ts',
  'src/data/project-images.ts',
  'src/data/service-galleries.ts',
  'src/data/service-images.ts',
  // Listas numeradas: `card${i}Label`, `item${i}Title`. Cubierto porque el
  // seed declara el mismo número de elementos que el bucle recorre.
  'src/pages/empresa.astro',
  // E-1: las tres cifras y las tres propuestas de valor de la home. El bucle
  // recorre [1,2,3] y el seed declara card1..3 y item1..3 en las dos entradas,
  // así que la correspondencia se rompería solo cambiando ambos a la vez. El
  // tercer argumento de getCmsText mantiene el texto anterior si faltara.
  'src/pages/index.astro',
  'src/pages/servicios/index.astro',
].sort();

const fuentes = [...globSync('src/**/*.astro'), ...globSync('src/**/*.ts')]
  .filter((file) => !file.includes('/test/'))
  .sort();

const referencias: Array<{ file: string; id: string; key: string }> = [];
const conClaveDinamica: string[] = [];

for (const file of fuentes) {
  const src = readFileSync(file, 'utf8');
  for (const match of src.matchAll(LITERAL_CALL)) {
    referencias.push({ file, id: match[1], key: match[2] });
  }
  if (DYNAMIC_CALL.test(src)) conClaveDinamica.push(file);
}

describe('claves del CMS referenciadas por el sitio', () => {
  it('encuentra referencias que validar', () => {
    // Sin esta guarda, un cambio en la expresión regular haría pasar el test
    // por no encontrar nada.
    expect(referencias.length).toBeGreaterThan(100);
  });

  it('toda clave literal existe en el contenido exportado', () => {
    const faltantes = referencias
      .filter(({ id, key }) => cms.entries[id]?.fields?.[key] === undefined)
      .map(({ id, key, file }) => `${id}.${key}  (${file})`);
    // Se acumulan para que el fallo enumere todo lo que hay que sembrar.
    expect([...new Set(faltantes)]).toEqual([]);
  });

  it('los archivos con clave dinámica son los conocidos', () => {
    expect(conClaveDinamica.sort()).toEqual(ARCHIVOS_CON_CLAVE_DINAMICA);
  });

  /**
   * E-1: las cifras y las propuestas de valor de la home se piden con clave
   * construida (`card${n}Label`), así que el test de claves literales no las
   * ve. Y `getCmsText` cae al literal en silencio: si estos campos
   * desaparecieran del seed, la home seguiría pintando lo mismo y nadie se
   * enteraría de que dejaron de ser editables. Se comprueban por su nombre.
   */
  it('las listas numeradas de la home existen en el contenido exportado', () => {
    const esperados = [
      ...[1, 2, 3].flatMap((n) => [
        `home.installations.card${n}Label`,
        `home.installations.card${n}Value`,
        `home.installations.card${n}Desc`,
      ]),
      ...[1, 2, 3].flatMap((n) => [
        `home.capabilities.item${n}Title`,
        `home.capabilities.item${n}Desc`,
      ]),
    ];
    const faltantes = esperados.filter((ref) => {
      const corte = ref.lastIndexOf('.');
      const id = ref.slice(0, corte);
      const key = ref.slice(corte + 1);
      return cms.entries[id]?.fields?.[key] === undefined;
    });
    expect(faltantes).toEqual([]);
  });
});
