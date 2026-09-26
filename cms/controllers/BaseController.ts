import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { captureException } from '../utils/errorTracking';
import { fieldErrorsFromZod, summarizeZod } from '../validators/zodError';
import { ErrorDeUsuario } from '../utils/errorDeUsuario';

// H-15: Mensajes de error amigables para el cliente. Los errores internos (SQLite,
// filesystem, etc.) se loguean completos server-side pero se envían genéricamente
// al cliente para no filtrar detalles de implementación.
const USER_FACING_PATTERNS: { test: RegExp; status: number; message: string }[] = [
  { test: /Credenciales|inválidas/i, status: 401, message: 'Credenciales inválidas' },
  { test: /no encontrad[ao]/i, status: 404, message: 'Recurso no encontrado' },
  // C-1: el mensaje original nombra la entrada en conflicto y su slug, que es
  // justo lo que el editor necesita para resolverlo. El genérico lo ocultaba.
  { test: /ya existe/i, status: 400, message: undefined as unknown as string },
  // A-3: el conflicto de edición merece un 409, no un 400: el overlay lo
  // distingue para ofrecer comparar y reintentar en vez de tratarlo como un
  // dato mal escrito. El mensaje ya trae la versión actual y la esperada.
  { test: /Conflicto de edición/i, status: 409, message: undefined as unknown as string },
  // A-4: borrar una imagen en uso se rechaza con el detalle de dónde se usa.
  { test: /está en uso/i, status: 409, message: undefined as unknown as string },
  { test: /^Field .+ does not exist$/, status: 400, message: 'Ese campo no existe en esta ficha.' },
  // P2-04: el cerrojo de publicación («Ya hay una exportación o publicación
  // en curso») es un 409 con su texto, no un 400 genérico.
  { test: /en curso/i, status: 409, message: undefined as unknown as string },
  // M-3: borrar una categoría o un álbum con fotos se rechaza con el recuento.
  { test: /tiene \d+ foto/i, status: 409, message: undefined as unknown as string },
  // GAL-19: borrar un álbum con fotos se rechaza con su motivo intacto — el
  // operador necesita saber cuántas fotos hay que mover antes de reintentar.
  {
    test: /antes de eliminarlo/i,
    status: 409,
    message: undefined as unknown as string,
  },
  // M-6: al cambiar la contraseña, «la actual no es correcta» o «la nueva es
  // demasiado corta» son datos que el operador necesita leer tal cual. El
  // genérico le dejaba adivinando cuál de los dos campos rechazó el servidor.
  {
    test: /contraseña (actual|nueva)/i,
    status: 400,
    message: undefined as unknown as string,
  },
  {
    test: /no permitido|MIME|extensión|demasiado grande|tipo de archivo/i,
    status: 400,
    message: undefined as unknown as string,
  },
  {
    test: /obligatori[ao]|requerid[ao]|mínimo|máximo|inválid[ao]/i,
    status: 400,
    message: undefined as unknown as string,
  },
];

export class BaseController {
  protected handleSuccess(reply: FastifyReply, data: unknown, status = 200): void {
    reply.status(status).send(data);
  }

  protected handleError(error: unknown, reply: FastifyReply, action: string): void {
    // A-1: un fallo de validación es entrada del usuario, no un defecto. Se
    // responde con el campo y el motivo, y no se reporta a Sentry: antes
    // ensuciaba el monitoreo con cada tecla mal puesta y, de paso, llegaba al
    // editor como un genérico inútil porque el `message` de un ZodError es el
    // JSON de sus issues y ningún patrón de abajo casaba con él.
    if (error instanceof ZodError) {
      const details = fieldErrorsFromZod(error);
      reply.status(400).send({ error: summarizeZod(details), details });
      return;
    }

    if (error instanceof ErrorDeUsuario) {
      if (error.statusCode >= 500) captureException(error, { action });
      reply.status(error.statusCode).send({ error: error.mensajeUsuario, ...error.extra });
      return;
    }

    const rawMessage = error instanceof Error ? error.message : 'Error interno';

    // Buscar si el mensaje coincide con un patrón de error conocido y amigable.
    // Los que casan son condiciones previstas —credenciales, slug repetido,
    // conflicto de edición, MIME rechazado—, no defectos, así que por el mismo
    // criterio que el ZodError de arriba no se reportan: antes cada contraseña
    // mal escrita entraba en el monitoreo como una excepción.
    for (const pattern of USER_FACING_PATTERNS) {
      if (pattern.test.test(rawMessage)) {
        // Si el patrón define un mensaje de reemplazo, usarlo; si no, el mensaje
        // original ya es suficientemente amigable (p.ej. validaciones Zod).
        const clientMessage = pattern.message ?? rawMessage;
        reply.status(pattern.status).send({ error: clientMessage });
        return;
      }
    }

    // Error no reconocido: responder genéricamente. El detalle queda en logs/Sentry.
    // P2-04: es un fallo del servidor, no un dato mal escrito: 500, no 400.
    captureException(error, { action });
    reply.status(500).send({
      error:
        'No se pudo completar la operación. Inténtalo de nuevo; si se repite, avisa a quien administra el sitio.',
    });
  }
}
