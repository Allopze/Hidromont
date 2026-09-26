import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/unifiedConfig';
import type { AuthService } from '../services/authService';

// CMS-L1: a plain `!==` short-circuits on the first differing byte, leaking
// timing information about how much of the token an attacker guessed
// correctly. Tokens are fixed-length nanoid(48) strings so this is low-risk in
// practice, but a constant-time comparison costs nothing here.
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

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
    // P3-01: las cabeceras CORS solo tienen sentido en la API; el HTML del
    // sitio no debe anunciarlas.
    if (!request.url.startsWith('/api/')) return;
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
    if (
      !request.cmsSession ||
      typeof csrf !== 'string' ||
      !timingSafeStringEqual(csrf, request.cmsSession.csrfToken)
    ) {
      reply.status(403).send({ error: 'CSRF inválido' });
      return;
    }
  };
}
