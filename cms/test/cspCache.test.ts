/**
 * La CSP del sitio público se calcula leyendo los scripts inline del build, y
 * el resultado se cachea. Estas pruebas fijan cuándo esa caché debe soltarse.
 *
 * El fallo que las motiva: la caché solo se invalidaba al publicar desde el
 * panel, así que recompilar a mano en el servidor —el paso 6 de la guía de
 * despliegue— dejaba al proceso sirviendo los hashes del build anterior. La
 * CSP bloqueaba entonces los scripts inline del propio sitio, sin error
 * visible y sin entrada en el log, hasta el siguiente reinicio del servicio.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildContentSecurityPolicy,
  collectInlineScriptHashes,
  publicContentSecurityPolicy,
  refreshPublicSecurityHeaders,
} from '../security/headers';

let distDir: string;

/** Escribe un `index.html` con el script inline indicado. */
function escribirBuild(script: string, mtime?: Date): void {
  const file = path.join(distDir, 'index.html');
  fs.writeFileSync(file, `<html><body><script>${script}</script></body></html>`);
  // El sello es la fecha de modificación; en una prueba las dos escrituras
  // pueden caer en el mismo milisegundo, así que se fija explícitamente.
  if (mtime) fs.utimesSync(file, mtime, mtime);
}

beforeEach(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hm-csp-'));
  refreshPublicSecurityHeaders();
});

afterEach(() => {
  fs.rmSync(distDir, { recursive: true, force: true });
  refreshPublicSecurityHeaders();
});

describe('CSP del sitio público', () => {
  it('declara el hash del script inline del build', () => {
    escribirBuild('console.log(1)');
    const csp = publicContentSecurityPolicy(distDir);
    const [esperado] = collectInlineScriptHashes(distDir);
    expect(esperado).toBeTruthy();
    expect(csp).toContain(`'sha256-${esperado}'`);
  });

  it('se recalcula cuando el build cambia bajo los pies', () => {
    escribirBuild('console.log(1)', new Date(Date.now() - 60_000));
    const antes = publicContentSecurityPolicy(distDir);

    // Recompilar fuera del panel: mismo directorio, HTML distinto.
    escribirBuild('console.log(2)', new Date());
    const despues = publicContentSecurityPolicy(distDir);

    expect(despues).not.toBe(antes);
    expect(despues).toContain(`'sha256-${collectInlineScriptHashes(distDir)[0]}'`);
  });

  it('no recorre el build de nuevo mientras nada cambia', () => {
    escribirBuild('console.log(1)');
    const primera = publicContentSecurityPolicy(distDir);
    expect(publicContentSecurityPolicy(distDir)).toBe(primera);
  });

  it('refreshPublicSecurityHeaders() sigue soltando la caché', () => {
    escribirBuild('console.log(1)');
    publicContentSecurityPolicy(distDir);

    // Sin tocar la fecha: solo la invalidación explícita puede notarlo.
    const file = path.join(distDir, 'index.html');
    const { atime, mtime } = fs.statSync(file);
    escribirBuild('console.log(3)');
    fs.utimesSync(file, atime, mtime);

    refreshPublicSecurityHeaders();
    expect(publicContentSecurityPolicy(distDir)).toContain(
      `'sha256-${collectInlineScriptHashes(distDir)[0]}'`
    );
  });

  it('un build ausente no rompe la política', () => {
    // El proceso puede arrancar antes de que `dist` esté extraído.
    const csp = publicContentSecurityPolicy(path.join(distDir, 'no-existe'));
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
  });

  it('los scripts JSON no cuentan: nunca se ejecutan', () => {
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<html><script type="application/ld+json">{"a":1}</script></html>'
    );
    expect(collectInlineScriptHashes(distDir)).toEqual([]);
    expect(buildContentSecurityPolicy([])).toContain("script-src 'self'");
  });
});
