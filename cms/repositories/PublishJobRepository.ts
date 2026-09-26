import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { PublishJob, PublishJobAction, PublishJobStatus } from '../types/cms';

interface PublishJobRow {
  id: string;
  status: PublishJobStatus;
  action: PublishJobAction;
  logs: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface StoredLogs {
  action?: PublishJobAction;
  lines?: string[];
}

export class PublishJobRepository {
  constructor(private readonly db: Database.Database) {}

  start(input: { action: PublishJobAction; logs?: string[]; now: string }): PublishJob {
    const job: PublishJob = {
      id: nanoid(),
      action: input.action,
      status: 'running',
      logs: input.logs ?? [],
      createdAt: input.now,
    };

    this.db
      .prepare(
        'INSERT INTO publish_jobs (id, status, action, logs, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        job.id,
        job.status,
        job.action,
        this.serializeLogs(job.logs),
        job.createdAt,
        job.createdAt,
        null
      );

    return job;
  }

  finish(input: {
    id: string;
    status: Exclude<PublishJobStatus, 'running'>;
    logs: string[];
    now: string;
  }): PublishJob {
    const existing = this.find(input.id);
    if (!existing) throw new Error(`Publish job ${input.id} not found`);

    this.db
      .prepare(
        'UPDATE publish_jobs SET status = ?, logs = ?, updated_at = ?, completed_at = ? WHERE id = ?'
      )
      .run(input.status, this.serializeLogs(input.logs), input.now, input.now, input.id);

    const updated = this.find(input.id);
    if (!updated) throw new Error(`Publish job ${input.id} disappeared after update`);
    return updated;
  }

  /**
   * A1-009: marca como 'failed' (crashed) los jobs que siguen en 'running' despues
   * de `staleMs` milisegundos desde su ultima actualizacion. Llamado al arranque del
   * CMS para limpiar jobs trabados por un crash del proceso (SIGKILL, power loss,
   * timeout de execFile). Devuelve cuantos jobs fueron reaped.
   */
  reapStaleJobs(now: string, staleMs: number): number {
    const cutoff = new Date(Date.now() - staleMs).toISOString();
    const stale = this.db
      .prepare('SELECT id, logs, action FROM publish_jobs WHERE status = ? AND updated_at < ?')
      .all('running', cutoff) as Array<{ id: string; logs: string; action: PublishJobAction }>;

    if (stale.length === 0) return 0;

    const update = this.db.prepare(
      'UPDATE publish_jobs SET status = ?, updated_at = ?, completed_at = ?, logs = ? WHERE id = ?'
    );
    const txn = this.db.transaction((rows: typeof stale) => {
      for (const row of rows) {
        const lines = this.parseLogs(row.logs);
        update.run(
          'failed',
          now,
          now,
          this.serializeLogs([
            ...lines,
            `${now} crashed: job reaped at startup (stale > ${Math.round(staleMs / 1000)}s)`,
          ]),
          row.id
        );
      }
    });
    txn(stale);
    return stale.length;
  }

  list(limit = 30): PublishJob[] {
    return (
      this.db
        .prepare(
          'SELECT id, status, action, logs, created_at, updated_at, completed_at FROM publish_jobs ORDER BY created_at DESC LIMIT ?'
        )
        .all(limit) as PublishJobRow[]
    ).map((row) => this.fromRow(row));
  }

  find(id: string): PublishJob | undefined {
    const row = this.db
      .prepare(
        'SELECT id, status, action, logs, created_at, updated_at, completed_at FROM publish_jobs WHERE id = ?'
      )
      .get(id) as PublishJobRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  private serializeLogs(lines: string[]): string {
    return JSON.stringify(lines);
  }

  private fromRow(row: PublishJobRow): PublishJob {
    return {
      id: row.id,
      action: row.action,
      status: row.status,
      logs: this.parseLogs(row.logs),
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    };
  }

  private parseLogs(raw: string): string[] {
    try {
      const parsed = JSON.parse(raw) as StoredLogs | string[];
      // A1-010: el formato nuevo es un array de strings. El formato viejo era
      // { action, lines }; conservamos compat de lectura para jobs historicos.
      if (Array.isArray(parsed)) return parsed.map(String);
      return Array.isArray(parsed.lines) ? parsed.lines.map(String) : [];
    } catch {
      return raw ? [raw] : [];
    }
  }
}
