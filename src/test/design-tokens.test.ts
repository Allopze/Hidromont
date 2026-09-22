/**
 * B-3 — La interfaz del CMS pintaba con 40 colores escritos a mano, nueve de
 * ellos copias literales de los tokens del sitio, y el visor de la galería era
 * el único componente público que usaba la paleta por defecto de Tailwind
 * (`neutral-*`). En los dos casos el síntoma es el mismo: cambiar la marca deja
 * una parte de la interfaz con los colores viejos.
 *
 * Estos guardas impiden que reaparezca. Van sobre el texto de los archivos, que
 * es el patrón que ya usan los demás guardas contra deriva de este proyecto.
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `#fff` se deja a propósito: el blanco puro no necesita indirección y
 * envolverlo en una variable solo añadiría ruido. `#039` no es un color, es la
 * entidad `&#039;` de `escapeHtml`.
 */
const LITERALES_PERMITIDOS = new Set(['#fff', '#039']);

/**
 * El overlay dejó de ser un archivo y pasó a ser el directorio
 * `src/scripts/cms/overlay/`. El guarda recorre todos sus módulos, no solo la
 * hoja de estilos: los colores también pueden colarse en un `style="..."`
 * escrito dentro de una plantilla de cualquiera de ellos.
 */
function fuenteDelOverlay(): string {
  return globSync('src/scripts/cms/overlay/*.{js,ts}')
    .sort()
    .map((archivo) => readFileSync(archivo, 'utf8'))
    .join('\n');
}

/** El bloque `:root` de la hoja del overlay es donde SÍ viven los literales. */
function sinBloqueDeVariables(fuente: string): string {
  // Sin sangría fija: al pasar el overlay de un IIFE a módulos, el CSS perdió
  // dos espacios y el recorte dejó de encajar en silencio. Un guarda que no
  // recorta nada sigue en verde mientras mira el archivo entero, así que el
  // fallo solo se vio al ampliar la búsqueda.
  const apertura = /^(\s*):root \{$/m.exec(fuente);
  if (!apertura) return fuente;
  const inicio = apertura.index;
  const cierre = fuente.indexOf(`\n${apertura[1]}}`, inicio);
  if (cierre === -1) return fuente;
  return fuente.slice(0, inicio) + fuente.slice(cierre);
}

describe('sistema de color', () => {
  it('el overlay del CMS no tiene colores escritos a mano fuera de su bloque de variables', () => {
    const fuente = fuenteDelOverlay();
    // Guarda anti-vacío: si el bloque cambiara de forma, el recorte podría
    // dejar el archivo entero fuera y el test pasaría por no mirar nada.
    expect(fuente).toContain('--hm-cms-primary: var(--color-primary');

    const resto = sinBloqueDeVariables(fuente);
    expect(resto.length).toBeGreaterThan(fuente.length / 2);

    const literales = [...resto.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)]
      .map((m) => m[0])
      .filter((c) => !LITERALES_PERMITIDOS.has(c));
    expect([...new Set(literales)]).toEqual([]);
  });

  it('el menú móvil del CMS reutiliza las variables del overlay', () => {
    const fuente = readFileSync('src/scripts/cms/mobile-menu.ts', 'utf8');
    const literales = [...fuente.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)]
      .map((m) => m[0])
      .filter((c) => !LITERALES_PERMITIDOS.has(c));
    expect([...new Set(literales)]).toEqual([]);
    expect(fuente).toContain('var(--hm-cms-dark)');
  });

  it('las nueve variables que el sitio ya declara leen su token', () => {
    const fuente = fuenteDelOverlay();
    const esperadas: Array<[string, string]> = [
      ['--hm-cms-primary', '--color-primary'],
      ['--hm-cms-primary-dark', '--color-primary-dark'],
      ['--hm-cms-primary-light', '--color-primary-light'],
      ['--hm-cms-accent', '--color-accent'],
      ['--hm-cms-ink', '--color-text'],
      ['--hm-cms-muted', '--color-text-muted'],
      ['--hm-cms-line', '--color-border'],
      ['--hm-cms-dark', '--color-background-strong'],
      ['--hm-cms-alt', '--color-background-alt'],
      ['--hm-cms-error', '--color-error'],
      ['--hm-cms-success', '--color-success'],
    ];
    const tokens = readFileSync('src/styles/tokens.css', 'utf8');
    const sinToken = esperadas.filter(([local, token]) => {
      // La variable local lee el token…
      if (!new RegExp(`${local}:\\s*var\\(${token},`).test(fuente)) return true;
      // …y el token existe de verdad en tokens.css.
      return !tokens.includes(`${token}:`);
    });
    expect(sinToken.map(([l]) => l)).toEqual([]);
  });

  it('ningún componente público usa la paleta por defecto de Tailwind', () => {
    const archivos = [
      ...globSync('src/components/**/*.astro'),
      ...globSync('src/pages/**/*.astro'),
      ...globSync('src/layouts/**/*.astro'),
    ];
    expect(archivos.length).toBeGreaterThan(20);

    // `neutral`, `slate`, `gray`, `zinc` y `stone` son las escalas grises que
    // Tailwind trae de fábrica; el proyecto declara las suyas en
    // tailwind.config.mjs y son las que debe usar.
    const escalas =
      /\b(?:bg|text|border|ring|from|via|to|divide|outline|decoration|shadow|fill|stroke|placeholder|accent|caret)-(?:neutral|slate|gray|zinc|stone)-\d{2,3}\b/g;
    const infractores = archivos
      .flatMap((file) => {
        const encontrados = [...new Set(readFileSync(file, 'utf8').match(escalas) ?? [])];
        return encontrados.map((clase) => `${file}: ${clase}`);
      })
      .sort();
    expect(infractores).toEqual([]);
  });
});
