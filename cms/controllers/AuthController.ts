import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config/unifiedConfig';
import type { AuthService } from '../services/authService';
import { loginSchema } from '../validators/cms.schema';
import { BaseController } from './BaseController';

export class AuthController extends BaseController {
  constructor(private readonly authService: AuthService) {
    super();
  }

  async login(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const input = loginSchema.parse(request.body);
      const session = await this.authService.login(input.email, input.password);

      reply.setCookie(config.cms.cookieName, session.sessionId, {
        httpOnly: true,
        secure: config.cms.cookieSecure,
        sameSite: 'lax',
        path: '/',
        expires: new Date(session.expiresAt),
      });

      this.handleSuccess(reply, {
        ok: true,
        csrfToken: session.csrfToken,
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      this.handleError(error, reply, 'login');
    }
  }

  async logout(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.authService.logout(request.cookies[config.cms.cookieName]);
      reply.clearCookie(config.cms.cookieName, { path: '/' });
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'logout');
    }
  }

  async session(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const session = this.authService.getSession(request.cookies[config.cms.cookieName]);
      this.handleSuccess(reply, {
        authenticated: Boolean(session),
        user: session?.user,
        csrfToken: session?.csrfToken,
      });
    } catch (error) {
      this.handleError(error, reply, 'session');
    }
  }
}
