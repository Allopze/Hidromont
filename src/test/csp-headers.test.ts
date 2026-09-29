/**
 * Los hashes de la CSP deben corresponder a los scripts inline del build.
 *
 * Se encontró que los dos declarados en `public/_headers` no correspondían a
 * ningún script del build: como CSP nivel 3 ignora `'unsafe-inline'` en
 * cuanto hay un hash-source presente, los dos scripts inline del sitio
 * quedaban bloqueados en producción. Nada lo delataba — el sitio seguía
 * cargando, solo perdía en silencio el detector de JS y la red de seguridad
 * que fuerza visible el contenido animado si motion.ts falla.
 *
 * Mantener hashes a mano en un archivo de texto no es sostenible, así que ya
 * no se mantienen: `scripts/sync-csp-headers.ts` los escribe en
 * `dist/_headers` como último paso de `npm run build`, y el servidor Node los
 * recalcula del build que sirve. Los de `public/_headers` son solo la
 * plantilla y se sobreescriben.
 *
 * Este test verifica que ese paso corrió y quedó correcto, que es lo que
 * protege al despliegue detrás de Cloudflare o Apache. Requiere
 * `npm run build` previo: en CI el job build-and-test ya lo hace.
 */
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { collectInlineScriptHashes } from '../../cms/security/headers';

const DIST = 'dist';
const hayBuild = existsSync(`${DIST}/index.html`) && existsSync(`${DIST}/_headers`);

describe.skipIf(!hayBuild)('CSP del build', () => {
  // El archivo del build, no la plantilla de public/: es el que se despliega.
  //
  // B-03 (auditoría 2026-09-28): se leía en el cuerpo del `describe`, que
  // Vitest ejecuta aunque `skipIf` lo salte, así que en un clon sin compilar
  // el archivo entero fallaba con ENOENT en vez de omitirse.
  let declarados: string[] = [];
  let reales: string[] = [];
  beforeAll(() => {
    declarados = [...readFileSync(`${DIST}/_headers`, 'utf8').matchAll(/'sha256-([^']+)'/g)]
      .map((m) => m[1])
      .sort();
    reales = collectInlineScriptHashes(DIST);
  });

  it('el build tiene scripts inline que hashear', () => {
    expect(reales.length).toBeGreaterThan(0);
  });

  it('cada script inline del build está declarado en la CSP', () => {
    const sinDeclarar = reales.filter((h) => !declarados.includes(h));
    expect(sinDeclarar).toEqual([]);
  });

  it('no hay hashes declarados que ya no correspondan a ningún script', () => {
    // Un hash de más no rompe nada, pero significa que el paso de
    // sincronización no corrió — exactamente cómo empezó este problema.
    const sobrantes = declarados.filter((h) => !reales.includes(h));
    expect(sobrantes).toEqual([]);
  });
});
