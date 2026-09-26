import { nanoid } from 'nanoid';
import type Database from 'better-sqlite3';
import { captureException } from '../utils/errorTracking';

export interface AuditEvent {
  id: string;
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  data?: unknown;
  ip?: string;
  createdAt: string;
  /**
   * Solo en los listados: dice si el evento lleva un snapshot canjeable, sin
   * incluirlo. El snapshot completo sale únicamente por `find()`.
   */
  undoAvailable?: boolean;
  undoExpiresAt?: string;
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

  // CMS-L3: route handlers call this AFTER the response has already been
  // prepared/sent for a successful mutation. A DB error here must never
  // propagate — it would surface as a 500 for a request that already
  // succeeded. Swallow and report to error tracking instead.
  log(event: Omit<AuditEvent, 'id' | 'createdAt'>): string | null {
    const id = nanoid();
    try {
      this.db
        .prepare(
          `INSERT INTO audit_events (id, user_id, action, entity_type, entity_id, data_json, ip, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          event.userId ?? null,
          event.action,
          event.entityType ?? null,
          event.entityId ?? null,
          event.data !== undefined ? JSON.stringify(event.data) : null,
          event.ip ?? null,
          new Date().toISOString()
        );
      return id;
    } catch (error) {
      captureException(error, { action: 'auditLog', data: { auditAction: event.action } });
      // Devolver null y no lanzar: el registro de auditoría no debe convertir
      // una mutación correcta en un 500. Quien necesite el id —el deshacer—
      // se queda sin ofrecerlo, que es la degradación correcta.
      return null;
    }
  }

  /**
   * Un evento por su id, con su `data` completo.
   *
   * Es la búsqueda que necesita el deshacer, y por eso no vale `listByEntity`:
   * esa busca por `entity_id`, que se repite en cuanto se borra dos veces algo
   * con el mismo identificador —realista con los slugs de álbum, que los
   * elige una persona— y colisiona justo en el caso que hay que distinguir.
   */
  find(id: string): AuditEvent | null {
    const row = this.db.prepare('SELECT * FROM audit_events WHERE id = ?').get(id) as
      AuditRow | undefined;
    return row ? toEvent(row) : null;
  }

  /**
   * Vacía el snapshot de un evento, conservando la fila.
   *
   * El rastro de auditoría no se borra nunca: lo que caduca es la copia
   * recuperable, no el hecho de que alguien borró algo.
   */
  clearUndo(id: string): boolean {
    const row = this.db.prepare('SELECT data_json FROM audit_events WHERE id = ?').get(id) as
      { data_json: string | null } | undefined;
    if (!row?.data_json) return false;
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
    if (!data.undo) return false;
    delete data.undo;
    const restante = Object.keys(data).length ? JSON.stringify(data) : null;
    this.db.prepare('UPDATE audit_events SET data_json = ? WHERE id = ?').run(restante, id);
    return true;
  }

  list(limit = 100): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_events ORDER BY created_at DESC LIMIT ?')
      .all(limit) as AuditRow[];

    return rows.map(toListedEvent);
  }

  /** Todos los eventos de una acción, con su `data` completo (arranque). */
  listByAction(action: string): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_events WHERE action = ? ORDER BY created_at ASC')
      .all(action) as AuditRow[];
    return rows.map(toEvent);
  }

  listByEntity(entityId: string, limit = 50): AuditEvent[] {
    const rows = this.db
      .prepare('SELECT * FROM audit_events WHERE entity_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(entityId, limit) as AuditRow[];

    return rows.map(toListedEvent);
  }
}

function toEvent(r: AuditRow): AuditEvent {
  return {
    id: r.id,
    userId: r.user_id ?? undefined,
    action: r.action,
    entityType: r.entity_type ?? undefined,
    entityId: r.entity_id ?? undefined,
    data: r.data_json ? (JSON.parse(r.data_json) as unknown) : undefined,
    ip: r.ip ?? undefined,
    createdAt: r.created_at,
  };
}

/**
 * Igual que `toEvent`, pero sin el snapshot.
 *
 * El registro de actividad devuelve los últimos 200 eventos de golpe. Una
 * entrada de proyecto con su cuerpo en Markdown son varios KB, así que
 * incluirlos inflaría esa respuesta —y la paga el panel de Administración, que
 * es justo donde se lee—. En su lugar se dice si hay algo canjeable y hasta
 * cuándo.
 */
function toListedEvent(r: AuditRow): AuditEvent {
  const evento = toEvent(r);
  const undo = (evento.data as { undo?: { expiresAt?: string } } | undefined)?.undo;
  if (!undo) return evento;

  const { undo: _descartado, ...resto } = evento.data as Record<string, unknown>;
  return {
    ...evento,
    data: Object.keys(resto).length ? resto : undefined,
    undoAvailable: true,
    undoExpiresAt: undo.expiresAt,
  };
}
