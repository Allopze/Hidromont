/**
 * P3-04 (auditoría 2026-09): límites duplicados a mano entre la configuración,
 * Caddy y el panel, y un comando de publicación partido por espacios.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { config } from '../config/unifiedConfig';
import { argumentosDeComando } from '../services/publishService';

/** `max_size 12MB` de cada bloque de host del Caddyfile, en bytes. */
function limitesDeCaddy(): Record<string, number> {
  const texto = readFileSync('deploy/Caddyfile', 'utf8');
  const salida: Record<string, number> = {};
  for (const m of texto.matchAll(/^([a-z.]+) \{([\s\S]*?)^\}/gm)) {
    const max = /max_size\s+(\d+)MB/.exec(m[2]);
    if (max) salida[m[1]] = Number(max[1]) * 1000 * 1000;
  }
  return salida;
}

describe('P3-04: límites de subida', () => {
  it('Caddy deja pasar lo que el CMS acepta, con margen para el formulario', () => {
    const caddy = limitesDeCaddy();
    expect(caddy['hidromontchile.cl']).toBeGreaterThan(config.cms.uploadMaxBytes);
    expect(caddy['editor.hidromontchile.cl']).toBeGreaterThan(config.cms.videoMaxBytes);
  });
});

describe('P3-04: comando de publicación', () => {
  it.each([
    ['npm run build:log', ['npm', 'run', 'build:log']],
    ['  npm   run  build  ', ['npm', 'run', 'build']],
    ['node "scripts/con espacio.mjs" --x', ['node', 'scripts/con espacio.mjs', '--x']],
    ["sh -c 'echo hola'", ['sh', '-c', 'echo hola']],
    ['cmd ""', ['cmd', '']],
  ])('%s', (comando, esperado) => {
    expect(argumentosDeComando(comando)).toEqual(esperado);
  });

  it('comillas sin cerrar es un error, no un comando raro', () => {
    expect(() => argumentosDeComando('node "sin cerrar')).toThrow(/comillas/);
  });
});
