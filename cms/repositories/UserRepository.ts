import type Database from 'better-sqlite3';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  csrf_token: string;
  expires_at: string;
}

export class UserRepository {
  constructor(private readonly db: Database.Database) {}

  findByEmail(email: string): UserRow | undefined {
    return this.db
      .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
      .get(email) as UserRow | undefined;
  }

  findById(id: string): UserRow | undefined {
    return this.db
      .prepare('SELECT id, email, password_hash FROM users WHERE id = ?')
      .get(id) as UserRow | undefined;
  }

  createUser(input: { id: string; email: string; passwordHash: string; now: string }): void {
    this.db
      .prepare(
        'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.id, input.email, input.passwordHash, input.now, input.now);
  }

  createSession(input: {
    id: string;
    userId: string;
    csrfToken: string;
    expiresAt: string;
    now: string;
  }): void {
    this.db
      .prepare(
        'INSERT INTO sessions (id, user_id, csrf_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(input.id, input.userId, input.csrfToken, input.expiresAt, input.now);
  }

  findSession(id: string): SessionRow | undefined {
    return this.db
      .prepare('SELECT id, user_id, csrf_token, expires_at FROM sessions WHERE id = ?')
      .get(id) as SessionRow | undefined;
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  }

  deleteExpiredSessions(now: string): void {
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
  }

  /** A1-007: actualiza el hash de contraseña de un usuario existente. */
  updatePassword(userId: string, passwordHash: string, now: string): void {
    this.db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(passwordHash, now, userId);
  }

  /** Invalida todas las sesiones de un usuario (tras reset de contraseña). */
  deleteSessionsByUser(userId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
  }
}
