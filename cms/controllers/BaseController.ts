import type { FastifyReply } from 'fastify';
import { captureException } from '../utils/errorTracking';

// H-15: Mensajes de error amigables para el cliente. Los errores internos (SQLite,
// filesystem, etc.) se loguean completos server-side pero se envían genéricamente
// al cliente para no filtrar detalles de implementación.
const USER_FACING_PATTERNS: { test: RegExp; status: number; message: string }[] = [
  { test: /Credenciales|inválidas/i, status: 401, message: 'Credenciales inválidas' },
  { test: /no encontrad[ao]/i, status: 404, message: 'Recurso no encontrado' },
  { test: /ya existe/i, status: 400, message: 'Ya existe un registro con ese identificador' },
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
    captureException(error, { action });
    const rawMessage = error instanceof Error ? error.message : 'Error interno';

    // Buscar si el mensaje coincide con un patrón de error conocido y amigable.
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
    reply.status(400).send({ error: 'Error al procesar la solicitud' });
  }
}
