/**
 * Formulario de contacto (M-03, auditoría 2026-09-28).
 *
 * El navegador posteaba directo a `formsubmit.co/<correo>` con las copias en
 * un `_cc` oculto: los tres buzones quedaban en el HTML para cualquier
 * recolector, y cualquiera podía mandar al endpoint sin pasar por el sitio,
 * así que el honeypot y el límite por pestaña no frenaban a un bot.
 *
 * Ahora el formulario postea aquí, en el mismo dominio. Los correos salen del
 * `.env` del servidor y nunca llegan al navegador; este proceso valida, limita
 * por IP y reenvía a FormSubmit con las mismas cabeceras `Origin`/`Referer` que
 * mandaba el navegador, para que el buzón ya activado siga funcionando igual.
 *
 * Responde JSON al envío con JavaScript y redirige a /contacto/gracias/ al
 * envío nativo (sin JS).
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Rutas de `/api/` que responden también en el dominio público. */
export const RUTAS_API_PUBLICAS = ['/api/contacto'];

export const esRutaApiPublica = (url: string) =>
  RUTAS_API_PUBLICAS.some((ruta) => url === ruta || url.startsWith(`${ruta}?`));

// El mismo `site` que declara astro.config.mjs. FormSubmit asocia el buzón
// activado al sitio desde el que se envía: el navegador mandaba este origen.
const SITIO = 'https://hidromontchile.cl';

const CUERPO_MAXIMO = 32 * 1024;
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_IP = 5;
const MAX_TOTAL = 60;

const LARGOS = {
  nombre: 120,
  empresa: 150,
  email: 254,
  telefono: 40,
  servicio: 100,
  mensaje: 2000,
  _subject: 150,
} as const;

type Campo = keyof typeof LARGOS;

export interface OpcionesContacto {
  /** Inyectable en pruebas: nunca se manda nada real desde la suite. */
  enviar?: typeof fetch;
  destino?: string;
  copias?: string[];
  ahora?: () => number;
}

function copiasDelEntorno(): string[] {
  return [1, 2, 3, 4]
    .map((n) => process.env[`FORMSUBMIT_CC_${n}`]?.trim())
    .filter((c): c is string => !!c);
}

const correoValido = (valor: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);

function texto(cuerpo: Record<string, unknown>, campo: Campo): string {
  const valor = cuerpo[campo];
  return typeof valor === 'string' ? valor.trim() : '';
}

function quiereJson(request: FastifyRequest): boolean {
  return (request.headers.accept ?? '').includes('application/json');
}

function paginaDeError(mensaje: string): string {
  return `<!doctype html><html lang="es-CL"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>No se pudo enviar la consulta</title></head><body><h1>No se pudo enviar la consulta</h1><p>${mensaje}</p><p><a href="/contacto/">Volver al formulario de contacto</a></p></body></html>`;
}

export function registerContactRoutes(app: FastifyInstance, opciones: OpcionesContacto = {}) {
  const enviar = opciones.enviar ?? fetch;
  const ahora = opciones.ahora ?? Date.now;
  const envios = new Map<string, number[]>();
  let todos: number[] = [];

  function responder(
    request: FastifyRequest,
    reply: FastifyReply,
    estado: number,
    mensaje?: string
  ) {
    if (quiereJson(request)) {
      return reply
        .status(estado)
        .send(estado === 200 ? { success: 'true' } : { success: 'false', error: mensaje });
    }
    if (estado === 200) return reply.redirect('/contacto/gracias/', 303);
    return reply
      .status(estado)
      .type('text/html; charset=utf-8')
      .send(paginaDeError(mensaje ?? ''));
  }

  return app.register(async (sub) => {
    // Solo en este ámbito: el envío nativo llega como formulario codificado, y
    // el resto de la API no debe aceptar ese tipo de cuerpo.
    sub.addContentTypeParser(
      'application/x-www-form-urlencoded',
      { parseAs: 'string', bodyLimit: CUERPO_MAXIMO },
      (_request, cuerpo, done) => {
        done(null, Object.fromEntries(new URLSearchParams(cuerpo as string)));
      }
    );

    sub.post('/api/contacto', { bodyLimit: CUERPO_MAXIMO }, async (request, reply) => {
      const cuerpo = (request.body ?? {}) as Record<string, unknown>;

      // Honeypot: un bot lo rellena. Se le dice que salió bien y no se manda.
      if (typeof cuerpo._honey === 'string' && cuerpo._honey !== '') {
        return responder(request, reply, 200);
      }

      const campos = Object.fromEntries(
        (Object.keys(LARGOS) as Campo[]).map((c) => [c, texto(cuerpo, c)])
      ) as Record<Campo, string>;

      const demasiadoLargo = (Object.keys(LARGOS) as Campo[]).some(
        (c) => campos[c].length > LARGOS[c]
      );
      if (
        campos.nombre.length < 2 ||
        !correoValido(campos.email) ||
        !campos.mensaje ||
        demasiadoLargo
      ) {
        return responder(
          request,
          reply,
          400,
          'Revise los campos obligatorios: nombre, un correo válido y el mensaje.'
        );
      }

      const momento = ahora();
      const ip = request.ip;
      if (envios.size > 5000) {
        for (const [clave, marcas] of envios) {
          if (marcas.every((t) => momento - t >= VENTANA_MS)) envios.delete(clave);
        }
      }
      const recientes = (envios.get(ip) ?? []).filter((t) => momento - t < VENTANA_MS);
      todos = todos.filter((t) => momento - t < 60 * 60 * 1000);
      if (recientes.length >= MAX_POR_IP || todos.length >= MAX_TOTAL) {
        reply.header('Retry-After', String(Math.ceil(VENTANA_MS / 1000)));
        return responder(
          request,
          reply,
          429,
          'Recibimos varias consultas seguidas. Inténtelo de nuevo en unos minutos.'
        );
      }

      const destino =
        opciones.destino ??
        (process.env.CONTACT_EMAIL || process.env.PUBLIC_CONTACT_EMAIL || 'hidromont@hidromont.cl');
      const copias = opciones.copias ?? copiasDelEntorno();

      const datos: Record<string, string> = {
        nombre: campos.nombre,
        empresa: campos.empresa,
        email: campos.email,
        telefono: campos.telefono,
        servicio: campos.servicio,
        mensaje: campos.mensaje,
        // Un salto de línea en el asunto no tiene uso legítimo.
        _subject:
          campos._subject.replace(/[\r\n]+/g, ' ') || 'Nuevo contacto desde hidromontchile.cl',
        _captcha: 'false',
      };
      if (copias.length) datos._cc = copias.join(',');

      try {
        const respuesta = await enviar(
          `https://formsubmit.co/ajax/${encodeURIComponent(destino)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              Origin: SITIO,
              Referer: `${SITIO}/`,
            },
            body: JSON.stringify(datos),
            signal: AbortSignal.timeout(15_000),
          }
        );
        const json = (await respuesta.json().catch(() => ({}))) as {
          success?: string | boolean;
          message?: string;
        };
        if (!respuesta.ok || (json.success !== 'true' && json.success !== true)) {
          request.log.error(
            { contacto: 'rechazado', estado: respuesta.status, motivo: json.message },
            'FormSubmit no aceptó la consulta'
          );
          return responder(
            request,
            reply,
            502,
            'El servicio de correo no respondió. Inténtelo de nuevo en unos minutos.'
          );
        }
      } catch (error) {
        request.log.error(
          { contacto: 'sin respuesta', error },
          'No se pudo contactar a FormSubmit'
        );
        return responder(
          request,
          reply,
          502,
          'El servicio de correo no respondió. Inténtelo de nuevo en unos minutos.'
        );
      }

      // Solo cuentan los envíos aceptados: un fallo del proveedor se puede reintentar.
      recientes.push(momento);
      envios.set(ip, recientes);
      todos.push(momento);
      request.log.info({ contacto: 'enviado' }, 'Consulta de contacto reenviada');
      return responder(request, reply, 200);
    });
  });
}
