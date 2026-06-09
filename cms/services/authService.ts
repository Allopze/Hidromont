import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { config } from '../config/unifiedConfig';
import type { UserRepository } from '../repositories/UserRepository';

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async ensureAdminUser(): Promise<void> {
    const existing = this.userRepository.findByEmail(config.admin.email);
    if (existing) return;

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(config.admin.password, 12);
    this.userRepository.createUser({
      id: nanoid(),
      email: config.admin.email,
      passwordHash,
      now,
    });
  }

  async login(email: string, password: string): Promise<{ sessionId: string; csrfToken: string; expiresAt: string }> {
    const user = this.userRepository.findByEmail(email);
    if (!user) throw new Error('Credenciales inválidas');

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new Error('Credenciales inválidas');

    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.cms.sessionDays * 24 * 60 * 60 * 1000).toISOString();
    const sessionId = nanoid(48);
    const csrfToken = nanoid(48);

    this.userRepository.deleteExpiredSessions(now.toISOString());
    this.userRepository.createSession({
      id: sessionId,
      userId: user.id,
      csrfToken,
      expiresAt,
      now: now.toISOString(),
    });

    return { sessionId, csrfToken, expiresAt };
  }

  getSession(sessionId: string | undefined): { user: { id: string; email: string }; csrfToken: string } | undefined {
    if (!sessionId) return undefined;
    const session = this.userRepository.findSession(sessionId);
    if (!session) return undefined;

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      this.userRepository.deleteSession(sessionId);
      return undefined;
    }

    const user = this.userRepository.findById(session.user_id);
    if (!user) return undefined;

    return {
      user: { id: user.id, email: user.email },
      csrfToken: session.csrf_token,
    };
  }

  logout(sessionId: string | undefined): void {
    if (!sessionId) return;
    this.userRepository.deleteSession(sessionId);
  }
}
