import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { config } from '../config/unifiedConfig';
import type { UserRepository } from '../repositories/UserRepository';

// CMS-7 fix: when the email doesn't exist, login() previously threw before ever
// calling bcrypt.compare(), so a request against an unknown email returned much
// faster than one against a known email with a wrong password — a timing
// side-channel an attacker can use to enumerate valid admin emails. Comparing
// against this fixed dummy hash on the "user not found" path costs the same
// bcrypt work as a real comparison, without depending on any real credential
// (it's never a valid hash for any account). Computed lazily (bcrypt.hash is
// slow) and cached for the life of the process.
let dummyHashPromise: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = bcrypt.hash(nanoid(32), 12);
  }
  return dummyHashPromise;
}

export class AuthService {
  constructor(private readonly userRepository: UserRepository) {}

  async ensureAdminUser(): Promise<void> {
    return this.ensureAdminUserWith(config.admin.email, config.admin.password);
  }

  async ensureAdminUserWith(email: string, password: string, costFactor = 12): Promise<void> {
    const existing = this.userRepository.findByEmail(email);
    if (existing) return;

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, costFactor);
    this.userRepository.createUser({
      id: nanoid(),
      email,
      passwordHash,
      now,
    });
  }

  /**
   * A1-007: resetea la contraseña del admin definido en config.admin.
   * A diferencia de `ensureAdminUser`, este metodo SIEMPRE re-hashea y actualiza
   * la fila existente (o la crea si no existe). Invalida todas las sesiones
   * activas del usuario para forzar re-login con la nueva contraseña.
   *
   * Disparado por el script `npm run cms:reset-password`. No se ejecuta en cada
   * arranque para no pisar cambios de contraseña hechos manualmente.
   */
  async resetAdminPassword(
    email: string = config.admin.email,
    password: string = config.admin.password,
    costFactor = 12
  ): Promise<{ created: boolean; sessionsRevoked: number }> {
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, costFactor);
    const existing = this.userRepository.findByEmail(email);

    if (!existing) {
      this.userRepository.createUser({ id: nanoid(), email, passwordHash, now });
      return { created: true, sessionsRevoked: 0 };
    }

    this.userRepository.updatePassword(existing.id, passwordHash, now);
    const sessionsRevoked = this.userRepository.deleteSessionsByUser(existing.id);
    return { created: false, sessionsRevoked };
  }

  async login(
    email: string,
    password: string
  ): Promise<{ sessionId: string; csrfToken: string; expiresAt: string }> {
    const user = this.userRepository.findByEmail(email);
    if (!user) {
      // Pay the same bcrypt cost as a real comparison so response timing
      // doesn't reveal whether this email exists (CMS-7).
      await bcrypt.compare(password, await getDummyHash());
      throw new Error('Credenciales inválidas');
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) throw new Error('Credenciales inválidas');

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + config.cms.sessionDays * 24 * 60 * 60 * 1000
    ).toISOString();
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

  /**
   * M-6: cambio de contraseña desde el panel.
   *
   * Hasta ahora la única forma era `npm run cms:reset-password` por línea de
   * comandos, lo que en un servidor de producción significa pedírselo a un
   * desarrollador. Exige la contraseña actual —una sesión robada no debe
   * poder cambiarla— y revoca todas las demás sesiones, incluidas las del
   * atacante si lo hubiera.
   *
   * @returns cuántas sesiones se revocaron (sin contar la actual).
   */
  async changePassword(
    userId: string,
    actual: string,
    nueva: string,
    opts: { sessionId?: string; costFactor?: number } = {}
  ): Promise<{ sessionsRevoked: number }> {
    if (nueva.length < 12) {
      throw new Error('La contraseña nueva es demasiado corta: mínimo 12 caracteres.');
    }

    const user = this.userRepository.findById(userId);
    if (!user) throw new Error('Usuario no encontrado');

    if (!(await bcrypt.compare(actual, user.password_hash))) {
      throw new Error('La contraseña actual no es correcta');
    }
    if (await bcrypt.compare(nueva, user.password_hash)) {
      throw new Error('La contraseña nueva debe ser distinta de la actual');
    }

    const now = new Date().toISOString();
    this.userRepository.updatePassword(
      user.id,
      await bcrypt.hash(nueva, opts.costFactor ?? 12),
      now
    );

    // Se revocan todas y se recrea la actual, para no echar al operador de su
    // propia sesión mientras cambia la contraseña.
    const revocadas = this.userRepository.deleteSessionsByUser(user.id);
    let restauradas = 0;
    if (opts.sessionId) {
      this.userRepository.createSession({
        id: opts.sessionId,
        userId: user.id,
        csrfToken: nanoid(48),
        expiresAt: new Date(
          Date.now() + config.cms.sessionDays * 24 * 60 * 60 * 1000
        ).toISOString(),
        now,
      });
      restauradas = 1;
    }
    return { sessionsRevoked: Math.max(0, revocadas - restauradas) };
  }

  getSession(
    sessionId: string | undefined
  ): { user: { id: string; email: string }; csrfToken: string } | undefined {
    if (!sessionId) return undefined;
    const session = this.userRepository.findSession(sessionId);
    if (!session) return undefined;

    if (new Date(session.expires_at).getTime() <= Date.now()) {
      this.userRepository.deleteSession(sessionId);
      return undefined;
    }

    // P3-01 (auditoría 2026-09): caducidad por inactividad. La marca se
    // actualiza como mucho cada 5 minutos, para no escribir en cada petición.
    const visto = new Date(session.last_seen_at || session.created_at).getTime();
    const ahora = Date.now();
    if (ahora - visto > config.cms.sessionIdleHours * 60 * 60 * 1000) {
      this.userRepository.deleteSession(sessionId);
      return undefined;
    }
    if (ahora - visto > 5 * 60 * 1000) {
      this.userRepository.touchSession(sessionId, new Date(ahora).toISOString());
    }

    const user = this.userRepository.findById(session.user_id);
    if (!user) return undefined;

    return {
      user: { id: user.id, email: user.email },
      csrfToken: session.csrf_token,
    };
  }

  /** P3-01: «Cerrar las demás sesiones» desde Administración. */
  closeOtherSessions(userId: string, currentSessionId: string): number {
    return this.userRepository.deleteOtherSessions(userId, currentSessionId);
  }

  logout(sessionId: string | undefined): void {
    if (!sessionId) return;
    this.userRepository.deleteSession(sessionId);
  }
}
