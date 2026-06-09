import type Database from 'better-sqlite3';

interface AttemptRow {
  ip: string;
  count: number;
  reset_at: string;
}

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;

export class RateLimitRepository {
  constructor(private readonly db: Database.Database) {}

  check(ip: string): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const row = this.db
      .prepare('SELECT ip, count, reset_at FROM login_attempts WHERE ip = ?')
      .get(ip) as AttemptRow | undefined;

    if (!row || now > new Date(row.reset_at).getTime()) {
      this.db
        .prepare(
          `INSERT INTO login_attempts (ip, count, reset_at)
           VALUES (?, 1, ?)
           ON CONFLICT(ip) DO UPDATE SET count = 1, reset_at = excluded.reset_at`
        )
        .run(ip, new Date(now + WINDOW_MS).toISOString());
      return { allowed: true, retryAfterMs: 0 };
    }

    if (row.count >= MAX_ATTEMPTS) {
      return { allowed: false, retryAfterMs: new Date(row.reset_at).getTime() - now };
    }

    this.db.prepare('UPDATE login_attempts SET count = count + 1 WHERE ip = ?').run(ip);
    return { allowed: true, retryAfterMs: 0 };
  }

  /** Clean up expired windows (call periodically or at startup). */
  cleanup(): void {
    this.db
      .prepare("DELETE FROM login_attempts WHERE reset_at < ?")
      .run(new Date().toISOString());
  }
}
