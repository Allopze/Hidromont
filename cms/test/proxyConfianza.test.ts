/**
 * P3-01 (auditoría 2026-09): con `CMS_TRUST_PROXY=1`, Fastify confiaba en toda
 * la cadena de X-Forwarded-For. Ahora solo en el proxy local.
 */
import fastify from 'fastify';
import { describe, expect, it } from 'vitest';

const CONFIANZA = ['127.0.0.1', '::1'];

async function ipVista(remoteAddress: string, xff: string) {
  const app = fastify({ trustProxy: CONFIANZA });
  app.get('/ip', async (request) => ({ ip: request.ip }));
  const res = await app.inject({
    method: 'GET',
    url: '/ip',
    remoteAddress,
    headers: { 'x-forwarded-for': xff },
  });
  await app.close();
  return res.json<{ ip: string }>().ip;
}

describe('P3-01: X-Forwarded-For', () => {
  it('detrás de Caddy (loopback) se usa la IP que pone Caddy', async () => {
    expect(await ipVista('127.0.0.1', '198.51.100.20')).toBe('198.51.100.20');
  });

  it('un cliente directo no puede falsificar su IP', async () => {
    expect(await ipVista('203.0.113.9', '1.2.3.4')).toBe('203.0.113.9');
  });

  it('una cadena con un salto falso solo cuenta lo que añadió el proxy', async () => {
    expect(await ipVista('127.0.0.1', '1.2.3.4, 198.51.100.20')).toBe('198.51.100.20');
  });
});

describe('la configuración usa esa lista', () => {
  it('CMS_TRUST_PROXY=1 no es `true`', async () => {
    process.env.CMS_TRUST_PROXY = '1';
    const { config } = await import('../config/unifiedConfig');
    expect(config.cms.trustProxy).toEqual(CONFIANZA);
  });
});
