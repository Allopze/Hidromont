/**
 * A-7 — El contenido del repositorio debe usar solo el vocabulario declarado.
 *
 * El vocabulario estaba duplicado en siete sitios y dos ya habían divergido:
 * el comentario de `requiredFieldTemplate` listaba 6 iconos cuando
 * `ServiceCard` define 8, y la base ya usaba los dos que faltaban. Ahora hay
 * un solo módulo del que consumen el schema de Astro, el validador del
 * servidor, el gate del export y el `<select>` del overlay, así que la
 * duplicación no puede reaparecer por código.
 *
 * Lo que este test cubre es la otra deriva posible: que el contenido en disco
 * salga del vocabulario, por una edición a mano o por un .md traído de fuera.
 * Un valor inválido hace que el export omita la entrada, así que sin esto el
 * proyecto desaparecería del sitio sin más aviso que una línea de stderr.
 */
import { globSync, readFileSync } from 'node:fs';
import matter from 'gray-matter';
import { describe, expect, it } from 'vitest';
import {
  CATEGORIA_PROYECTO,
  ICONO_SERVICIO,
  TIPO_PROYECTO,
  ICONO_SERVICIO_LABEL,
  ENTRY_STATUSES,
} from '../data/content-vocabulary';

function frontmatterDe(patron: string): Array<{ file: string; data: Record<string, unknown> }> {
  return globSync(patron).map((file) => ({
    file,
    data: matter(readFileSync(file, 'utf8')).data as Record<string, unknown>,
  }));
}

const proyectos = frontmatterDe('src/content/proyectos/**/*.md');
const servicios = frontmatterDe('src/content/servicios/**/*.md');

describe('vocabulario del contenido', () => {
  it('encuentra contenido que validar', () => {
    expect(proyectos.length).toBeGreaterThan(0);
    expect(servicios.length).toBeGreaterThan(0);
  });

  it('todos los proyectos usan una categoría del vocabulario', () => {
    const fuera = proyectos
      .filter((p) => !CATEGORIA_PROYECTO.includes(p.data.categoria as never))
      .map((p) => `${p.file}: categoria "${p.data.categoria}"`);
    expect(fuera).toEqual([]);
  });

  it('todos los proyectos usan un tipo del vocabulario', () => {
    const fuera = proyectos
      .filter((p) => p.data.tipo !== undefined && !TIPO_PROYECTO.includes(p.data.tipo as never))
      .map((p) => `${p.file}: tipo "${p.data.tipo}"`);
    expect(fuera).toEqual([]);
  });

  it('todos los servicios usan un icono del vocabulario', () => {
    const fuera = servicios
      .filter((s) => !ICONO_SERVICIO.includes(s.data.icono as never))
      .map((s) => `${s.file}: icono "${s.data.icono}"`);
    expect(fuera).toEqual([]);
  });

  it('ServiceCard dibuja un icono para cada valor del vocabulario', () => {
    // El tipado de `Record<IconoServicio, string>` ya lo exige en compilación;
    // esto lo comprueba también sobre el archivo, por si el mapa se
    // reescribiera con un tipo más laxo.
    const card = readFileSync('src/components/services/ServiceCard.astro', 'utf8');
    const sinDibujo = ICONO_SERVICIO.filter((icono) => !card.includes(`\n  ${icono}: \``));
    expect(sinDibujo).toEqual([]);
  });

  /**
   * E-3: un icono sin rótulo sale en el desplegable como `gate`, que no dice
   * nada a quien edita. Si alguien añade un icono al vocabulario, este test
   * obliga a nombrarlo.
   */
  it('todo icono de servicio tiene un rótulo legible', () => {
    const sinRotulo = ICONO_SERVICIO.filter((icono) => !ICONO_SERVICIO_LABEL[icono]);
    expect(sinRotulo).toEqual([]);
    // Y ningún rótulo sobrante que ya no corresponda a un icono válido.
    const sobrantes = Object.keys(ICONO_SERVICIO_LABEL).filter(
      (key) => !(ICONO_SERVICIO as readonly string[]).includes(key)
    );
    expect(sobrantes).toEqual([]);
  });

  /**
   * B-8: el validador y el desplegable del panel llegaron a divergir —tres
   * estados aceptados, dos ofrecidos—, y el que sobraba despublicaba en
   * silencio. Este test ata las dos puntas leyendo el overlay como texto, que
   * es el patrón que ya usan los demás guardas contra deriva de este archivo.
   */
  it('el overlay sabe rotular exactamente los estados que acepta el servidor', () => {
    // El overlay es ahora un directorio de módulos; los rótulos de estado y el
    // desplegable viven en `collections.js`, pero se leen todos por si se
    // mueven de módulo.
    const overlay = globSync('src/scripts/cms/overlay/*.{js,ts}')
      .sort()
      .map((archivo) => readFileSync(archivo, 'utf8'))
      .join('\n');
    const mapa = /\{ draft: 'Borrador'[^}]*\}/.exec(overlay);
    expect(mapa).not.toBeNull();
    const rotulados = [...(mapa?.[0].matchAll(/([a-z_]+):\s*'/g) ?? [])].map((m) => m[1]);
    expect(rotulados.sort()).toEqual([...ENTRY_STATUSES].sort());

    // Y el desplegable ofrece una opción por estado, ni más ni menos.
    const opciones = [...overlay.matchAll(/<option value="(published|draft|pending_review)"/g)].map(
      (m) => m[1]
    );
    expect([...new Set(opciones)].sort()).toEqual([...ENTRY_STATUSES].sort());
  });
});
