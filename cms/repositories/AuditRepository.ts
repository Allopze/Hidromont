import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';

export interface AuditEvent {
  id: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  data?: unknown;
  ip?: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  data_json: string | null;
  ip: string | null;
  created_at: string;
}

export class AuditRepository {
  constructor(private readonly db: Database.Database) {}

  log(event: Omit<AuditEvent, 'id' | 'createdAt'>): void {
    this.db
      .prepare(
        `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, data_json, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        nanoid(),
        event.userId ?? null,
        event.action,
        event.entityType ?? null,
        event.entityId ?? null,
        event.data !== undefined ? JSON.stringify(event.data) : null,
        event.ip ?? null,
        new Date().toISOString()
      );
  }

  list(limit = 100): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?')
      .all(limit) as AuditRow[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id ?? undefined,
      action: r.action,
      entityType: r.entity_type ?? undefined,
      entityId: r.entity_id ?? undefined,
      data: r.data_json ? (JSON.parse(r.data_json) as unknown) : undefined,
      ip: r.ip ?? undefined,
      createdAt: r.created_at,
    }));
  }

  listByEntity(entityId: string, limit = 50): AuditEvent[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM audit_events WHERE entity_id = ? ORDER BY created_at DESC LIMIT ?'
      )
      .all(entityId, limit) as AuditRow[];

    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id ?? undefined,
      action: r.action,
      entityType: r.entity_type ?? undefined,
      entityId: r.entity_id ?? undefined,
      data: r.data_json ? (JSON.parse(r.data_json) as unknown) : undefined,
      ip: r.ip ?? undefined,
      createdAt: r.created_at,
    }));
  }
}
