/**
 * P3-01 (auditoría 2026-09): sesiones de 7 días sin caducidad por inactividad
 * y sin forma de cerrar las de otros equipos.
 */
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { migrate } from '../db/schema';
import { UserRepository } from '../repositories/UserRepository';
import { AuthService } from '../services/authService';

function montar() {
  const db = new Database(':memory:');
  migrate(db);
  const users = new UserRepository(db);
  const now = new Date().toISOString();
  users.createUser({ id: 'u1', email: 'a@b.cl', passwordHash: 'x', now });
  const crear = (id: string, visto: string) => {
    users.createSession({
      id,
      userId: 'u1',
      csrfToken: `t-${id}`,
      expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      now,
    });
    db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(visto, id);
  };
  return { db, auth: new AuthService(users), crear };
}

describe('P3-01: sesiones', () => {
  it('una sesión sin uso en más de 24 h caduca', () => {
    const { auth, crear } = montar();
    crear('vieja', new Date(Date.now() - 25 * 3_600_000).toISOString());
    crear('reciente', new Date(Date.now() - 60_000).toISOString());
    expect(auth.getSession('vieja')).toBeUndefined();
    expect(auth.getSession('reciente')?.user.id).toBe('u1');
  });

  it('usarla la mantiene viva', () => {
    const { db, auth, crear } = montar();
    crear('s', new Date(Date.now() - 23 * 3_600_000).toISOString());
    expect(auth.getSession('s')).toBeDefined();
    const fila = db.prepare('SELECT last_seen_at FROM sessions WHERE id = ?').get('s') as {
      last_seen_at: string;
    };
    expect(Date.now() - new Date(fila.last_seen_at).getTime()).toBeLessThan(60_000);
  });

  it('«Cerrar las demás sesiones» deja solo la actual', () => {
    const { auth, crear } = montar();
    const ahora = new Date().toISOString();
    crear('esta', ahora);
    crear('portatil', ahora);
    crear('movil', ahora);
    expect(auth.closeOtherSessions('u1', 'esta')).toBe(2);
    expect(auth.getSession('esta')).toBeDefined();
    expect(auth.getSession('portatil')).toBeUndefined();
  });

  it('la migración añade la columna a una base existente sin perder sesiones', () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, created_at TEXT, updated_at TEXT);
      CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, csrf_token TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO sessions VALUES ('s', 'u', 't', '2099-01-01', '2026-09-01T00:00:00.000Z');`);
    migrate(db);
    const fila = db.prepare('SELECT last_seen_at FROM sessions').get() as { last_seen_at: string };
    expect(fila.last_seen_at).toBe('2026-09-01T00:00:00.000Z');
  });
});
