/**
 * M-03 (auditoría 2026-09-28): el formulario de contacto pasa por el servidor
 * para que los correos no aparezcan en el HTML. Ninguna prueba manda nada
 * real: `enviar` es un doble que registra lo que habría salido.
 */
import fastify, { type FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { esRutaApiPublica, registerContactRoutes } from '../routes/contactRoutes';

const valido = {
  nombre: 'Carlos Pérez',
  email: 'carlos@ejemplo.cl',
  mensaje: 'Necesitamos una compuerta.',
  _subject: 'Nuevo contacto desde hidromontchile.cl',
};

let app: FastifyInstance;
let llamadas: Array<{ url: string; init: RequestInit }>;
let respuestaProveedor: { status: number; body: unknown };
let reloj: number;

async function crear() {
  llamadas = [];
  respuestaProveedor = { status: 200, body: { success: 'true' } };
  reloj = 1_000_000;
  app = fastify({ trustProxy: true });
  await registerContactRoutes(app, {
    destino: 'buzon@hidromont.cl',
    copias: ['uno@hidromont.cl', 'dos@hidromont.cl'],
    ahora: () => reloj,
    enviar: (async (url: string, init: RequestInit) => {
      llamadas.push({ url, init });
      return new Response(JSON.stringify(respuestaProveedor.body), {
        status: respuestaProveedor.status,
      });
    }) as typeof fetch,
  });
  await app.ready();
}

const enviarJson = (cuerpo: Record<string, string>, ip = '10.0.0.1') =>
  app.inject({
    method: 'POST',
    url: '/api/contacto',
    headers: {
      accept: 'application/json',
      'content-type': 'application/x-www-form-urlencoded',
      'x-forwarded-for': ip,
    },
    payload: new URLSearchParams(cuerpo).toString(),
  });

afterEach(async () => {
  await app?.close();
});

describe('POST /api/contacto', () => {
  it('reenvía a FormSubmit con el destino y las copias del servidor', async () => {
    await crear();
    const res = await enviarJson(valido);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: 'true' });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('https://formsubmit.co/ajax/buzon%40hidromont.cl');
    const cabeceras = llamadas[0].init.headers as Record<string, string>;
    expect(cabeceras.Origin).toBe('https://hidromontchile.cl');
    const datos = JSON.parse(llamadas[0].init.body as string);
    expect(datos).toMatchObject({
      nombre: 'Carlos Pérez',
      email: 'carlos@ejemplo.cl',
      _cc: 'uno@hidromont.cl,dos@hidromont.cl',
    });
  });

  it('el envío sin JavaScript termina en /contacto/gracias/', async () => {
    await crear();
    const res = await app.inject({
      method: 'POST',
      url: '/api/contacto',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'text/html' },
      payload: new URLSearchParams(valido).toString(),
    });
    expect(res.statusCode).toBe(303);
    expect(res.headers.location).toBe('/contacto/gracias/');
  });

  it('el honeypot responde como si saliera bien, sin enviar nada', async () => {
    await crear();
    const res = await enviarJson({ ...valido, _honey: 'http://spam' });
    expect(res.statusCode).toBe(200);
    expect(llamadas).toHaveLength(0);
  });

  it.each([
    ['sin nombre', { ...valido, nombre: ' ' }],
    ['correo inválido', { ...valido, email: 'no-es-correo' }],
    ['sin mensaje', { ...valido, mensaje: '' }],
    ['mensaje demasiado largo', { ...valido, mensaje: 'a'.repeat(2001) }],
  ])('rechaza %s con 400 y no envía', async (_caso, cuerpo) => {
    await crear();
    const res = await enviarJson(cuerpo);
    expect(res.statusCode).toBe(400);
    expect(llamadas).toHaveLength(0);
  });

  it('un salto de línea en el asunto no llega al correo', async () => {
    await crear();
    await enviarJson({ ...valido, _subject: 'Hola\r\nBcc: otro@x.cl' });
    expect(JSON.parse(llamadas[0].init.body as string)._subject).toBe('Hola Bcc: otro@x.cl');
  });

  it('limita a 5 envíos aceptados por IP cada 10 minutos', async () => {
    await crear();
    for (let i = 0; i < 5; i++) expect((await enviarJson(valido)).statusCode).toBe(200);
    expect((await enviarJson(valido)).statusCode).toBe(429);
    // Otra IP no se ve afectada.
    expect((await enviarJson(valido, '10.0.0.2')).statusCode).toBe(200);
    reloj += 10 * 60 * 1000;
    expect((await enviarJson(valido)).statusCode).toBe(200);
  });

  it('si FormSubmit rechaza, responde 502 y el intento no consume cupo', async () => {
    await crear();
    respuestaProveedor = { status: 200, body: { success: 'false', message: 'x' } };
    for (let i = 0; i < 6; i++) expect((await enviarJson(valido)).statusCode).toBe(502);
    respuestaProveedor = { status: 200, body: { success: 'true' } };
    expect((await enviarJson(valido)).statusCode).toBe(200);
  });
});

describe('esRutaApiPublica', () => {
  it('solo deja pasar el formulario de contacto en el dominio público', () => {
    expect(esRutaApiPublica('/api/contacto')).toBe(true);
    expect(esRutaApiPublica('/api/contacto?x=1')).toBe(true);
    expect(esRutaApiPublica('/api/contactos')).toBe(false);
    expect(esRutaApiPublica('/api/cms/health')).toBe(false);
  });
});
