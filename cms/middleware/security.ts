import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/unifiedConfig';
import type { AuthService } from '../services/authService';

declare module 'fastify' {
  interface FastifyRequest {
    cmsSession?: {
      user: { id: string; email: string };
      csrfToken: string;
    };
  }
}

export function registerCors(app: FastifyInstance): void {
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    const isAllowed = !origin || config.cms.allowedOrigins.includes(origin);

    if (origin && isAllowed) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Credentials', 'true');
      reply.header('Vary', 'Origin');
    }

    reply.header('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

    if (request.method === 'OPTIONS') {
      reply.status(204).send();
    }
  });
}

export function requireAuth(authService: AuthService) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = request.cookies[config.cms.cookieName];
    const session = authService.getSession(sessionId);
    if (!session) {
      reply.status(401).send({ error: 'No autenticado' });
      return;
    }

    request.cmsSession = session;
  };
}

export function requireCsrf() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;

    const csrf = request.headers['x-csrf-token'];
    if (!request.cmsSession || csrf !== request.cmsSession.csrfToken) {
      reply.status(403).send({ error: 'CSRF inválido' });
      return;
    }
  };
}
