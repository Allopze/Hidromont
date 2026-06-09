import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import type { PublishJob, PublishJobAction, PublishJobStatus } from '../types/cms';

interface PublishJobRow {
  id: string;
  status: PublishJobStatus;
  logs: string;
  created_at: string;
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
      .prepare('INSERT INTO publish_jobs (id, status, logs, created_at, completed_at) VALUES (?, ?, ?, ?, ?)')
      .run(job.id, job.status, this.serializeLogs(job.action, job.logs), job.createdAt, null);

    return job;
  }

  finish(input: { id: string; status: Exclude<PublishJobStatus, 'running'>; logs: string[]; now: string }): PublishJob {
    const existing = this.find(input.id);
    if (!existing) throw new Error(`Publish job ${input.id} not found`);

    this.db
      .prepare('UPDATE publish_jobs SET status = ?, logs = ?, completed_at = ? WHERE id = ?')
      .run(input.status, this.serializeLogs(existing.action, input.logs), input.now, input.id);

    const updated = this.find(input.id);
    if (!updated) throw new Error(`Publish job ${input.id} disappeared after update`);
    return updated;
  }

  list(limit = 30): PublishJob[] {
    return (this.db
      .prepare('SELECT id, status, logs, created_at, completed_at FROM publish_jobs ORDER BY created_at DESC LIMIT ?')
      .all(limit) as PublishJobRow[]).map((row) => this.fromRow(row));
  }

  find(id: string): PublishJob | undefined {
    const row = this.db
      .prepare('SELECT id, status, logs, created_at, completed_at FROM publish_jobs WHERE id = ?')
      .get(id) as PublishJobRow | undefined;
    return row ? this.fromRow(row) : undefined;
  }

  private serializeLogs(action: PublishJobAction, lines: string[]): string {
    return JSON.stringify({ action, lines });
  }

  private fromRow(row: PublishJobRow): PublishJob {
    const parsed = this.parseLogs(row.logs);
    return {
      id: row.id,
      action: parsed.action,
      status: row.status,
      logs: parsed.lines,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    };
  }

  private parseLogs(raw: string): { action: PublishJobAction; lines: string[] } {
    try {
      const parsed = JSON.parse(raw) as StoredLogs | string[];
      if (Array.isArray(parsed)) return { action: 'publish', lines: parsed.map(String) };
      return {
        action: parsed.action === 'export' ? 'export' : 'publish',
        lines: Array.isArray(parsed.lines) ? parsed.lines.map(String) : [],
      };
    } catch {
      return { action: 'publish', lines: raw ? [raw] : [] };
    }
  }
}
