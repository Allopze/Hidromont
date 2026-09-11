/**
 * `scripts/build-con-registro.mjs` no llama a `npm run build`: invoca cada
 * paso con la ruta absoluta de su binario, porque desde cron el PATH no trae
 * `astro` ni `tsx` —`node_modules` es un enlace al virtualenv de cPanel y npm
 * no añade su `.bin`—.
 *
 * El precio de esa decisión es que la definición del build vive en dos sitios.
 * Esta prueba es el precio del precio: si alguien añade o quita un paso en
 * `package.json`, aquí se entera. Sin ella, el build del servidor se quedaría
 * silenciosamente a medias respecto al de local, que es justo la clase de
 * fallo que no se ve hasta que algo falta en producción.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const paquete = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};
const guion = readFileSync('scripts/build-con-registro.mjs', 'utf8');

/** Los comandos de un script de npm encadenados con `&&`, normalizados. */
function pasosDe(script: string): string[] {
  return script
    .split('&&')
    .map((p) => p.trim())
    .filter(Boolean);
}

describe('los pasos del build no divergen entre package.json y el script de cron', () => {
  it('el build completo tiene los pasos que espera la prueba', () => {
    // Guarda anti-vacío: si el script cambia de forma, lo de abajo dejaría de
    // comprobar nada sin fallar.
    expect(pasosDe(paquete.scripts.build)).toEqual([
      'astro check',
      'astro build',
      'tsx scripts/sync-csp-headers.ts',
    ]);
  });

  it('cada paso de `build` aparece en build-con-registro.mjs', () => {
    const faltan = pasosDe(paquete.scripts.build).filter((paso) => {
      // Se busca una señal distintiva, no la línea literal: el script compone
      // las rutas con `path.join`, así que `scripts/x.ts` allí son dos
      // fragmentos. Para `astro check` la señal es el subcomando; para un
      // paso que ejecuta un archivo, su nombre.
      const [comando, ...resto] = paso.split(/\s+/);
      const senal = comando === 'tsx' ? path.basename(resto.join(' ')) : resto[0];
      return senal ? !guion.includes(senal) : false;
    });
    expect(faltan).toEqual([]);
  });

  it('`build:servidor` es `build` sin astro check', () => {
    // Es lo que ejecuta el servidor cuando la memoria aprieta, y lo que
    // `CMS_PUBLISH_CHECK_COMMAND` puede apuntar en producción.
    expect(pasosDe(paquete.scripts['build:servidor'])).toEqual(
      pasosDe(paquete.scripts.build).filter((p) => p !== 'astro check')
    );
  });
});
