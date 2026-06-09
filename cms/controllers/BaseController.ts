import type { FastifyReply } from 'fastify';
import { captureException } from '../utils/errorTracking';

export class BaseController {
  protected handleSuccess(reply: FastifyReply, data: unknown, status = 200): void {
    reply.status(status).send(data);
  }

  protected handleError(error: unknown, reply: FastifyReply, action: string): void {
    captureException(error, { action });
    const message = error instanceof Error ? error.message : 'Error interno';
    const status = message.includes('Credenciales') ? 401 : message.includes('no encontrada') ? 404 : 400;
    reply.status(status).send({ error: message });
  }
}
