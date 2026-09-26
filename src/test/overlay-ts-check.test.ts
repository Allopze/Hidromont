/**
 * P2-07 (auditoría 2026-09): el overlay eran miles de líneas de JavaScript
 * sin comprobar tipos: `astro check` no revisa un `.js` que no lo pida.
 *
 * Se va activando `// @ts-check` módulo a módulo (los que no dan errores o se
 * corrigieron); `astro check` y `tsc` los revisan desde entonces. Esta lista
 * solo crece: quitarle la marca a un módulo la hace fallar.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const CON_TS_CHECK = [
  'api.js',
  'auth.js',
  'context.js',
  'dropzone.js',
  'html.js',
  'icons.js',
  'mount.js',
  'paginas.js',
  'pendientes.js',
  'styles.js',
  'submit.js',
];

describe('P2-07: tipos en el overlay', () => {
  it.each(CON_TS_CHECK)('%s sigue con // @ts-check', (archivo) => {
    const fuente = readFileSync(`src/scripts/cms/overlay/${archivo}`, 'utf8');
    expect(fuente.startsWith('// @ts-check')).toBe(true);
  });
});
