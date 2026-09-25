/**
 * Qué se va a publicar: los cambios guardados desde la última publicación.
 *
 * Hasta sep-2026 «Publicar cambios» compilaba sin decir qué iba a salir, y el
 * distintivo de la barra solo sabía que había «cambios pendientes» si se
 * habían hecho en esa misma pestaña: al recargar desaparecía aunque nada se
 * hubiera publicado. La información ya existía en el registro de actividad;
 * aquí se lee desde la última publicación correcta y se resume en lo que
 * entiende quien edita: qué ficha o página, y qué partes.
 */
import type Database from 'better-sqlite3';
import type { ContentService } from './contentService';

/** Las acciones que cambian lo que el sitio mostrará al publicar. */
export const ACCIONES_QUE_PUBLICAN = [
  'field.update',
  'entry.create',
  'entry.update_meta',
  'entry.delete',
  'revision.restore',
  'gallery.item.create',
  'gallery.item.update',
  'gallery.item.delete',
  'gallery.album.create',
  'gallery.album.update',
  'gallery.album.delete',
  'gallery.category.create',
  'gallery.category.update',
  'gallery.category.delete',
  'undo.restore',
] as const;

export interface EventoDeCambio {
  action: string;
  entityType: string | null;
  entityId: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
}

export interface CambioPendiente {
  /** Estable: sirve de clave en la lista del panel. */
  clave: string;
  titulo: string;
  /** Las partes que cambiaron, ya en palabras de quien edita. */
  detalle: string[];
  /** Id de la entrada, para ofrecer «Editar» junto al cambio. */
  entryId?: string;
  ultimo: string;
}

export interface CambiosPendientes {
  /** Fin de la última publicación correcta, o null si nunca se publicó. */
  desde: string | null;
  total: number;
  cambios: CambioPendiente[];
}

export interface Nombres {
  /** Título y rótulos de campo de una entrada, o null si ya no existe. */
  entrada(id: string): { titulo: string; campo(key: string): string } | null;
}

const ACCION_DE_ENTRADA: Record<string, string> = {
  'entry.create': 'Entrada nueva',
  'entry.update_meta': 'Dirección o estado de publicación',
  'entry.delete': 'Entrada eliminada',
  'revision.restore': 'Se restauró una versión anterior',
  'undo.restore': 'Se recuperó tras borrarla',
};

const GALERIA: Record<string, [string, string]> = {
  gallery_item: ['foto', 'fotos'],
  gallery_album: ['álbum', 'álbumes'],
  gallery_category: ['categoría', 'categorías'],
};

/**
 * Agrupa los eventos por entrada y resume la galería en una sola línea.
 * Puro: recibe los eventos y cómo nombrar las cosas, y no toca la base.
 */
export function resumirCambios(eventos: EventoDeCambio[], nombres: Nombres): CambioPendiente[] {
  type Acumulado = CambioPendiente & { partes: Set<string>; creada: boolean; borrada: boolean };
  const porClave = new Map<string, Acumulado>();
  const galeria = new Map<string, Set<string>>();
  let ultimoGaleria = '';

  for (const e of eventos) {
    const tipo = e.entityType ?? '';
    if (tipo in GALERIA) {
      if (!galeria.has(tipo)) galeria.set(tipo, new Set());
      galeria.get(tipo)!.add(e.entityId ?? e.createdAt);
      if (e.createdAt > ultimoGaleria) ultimoGaleria = e.createdAt;
      continue;
    }
    if (tipo !== 'entry' || !e.entityId) continue;

    const clave = `entrada:${e.entityId}`;
    const info = nombres.entrada(e.entityId);
    let cambio = porClave.get(clave);
    if (!cambio) {
      cambio = {
        clave,
        titulo: info?.titulo || e.entityId,
        detalle: [],
        entryId: info ? e.entityId : undefined,
        ultimo: e.createdAt,
        partes: new Set(),
        creada: false,
        borrada: false,
      };
      porClave.set(clave, cambio);
    }
    if (e.createdAt > cambio.ultimo) cambio.ultimo = e.createdAt;
    if (e.action === 'entry.create') cambio.creada = true;
    if (e.action === 'entry.delete') {
      cambio.borrada = true;
      // El aviso de deshacer guarda «la entrada «Título»»: sirve para
      // nombrar una entrada que ya no existe.
      const etiqueta = (e.data?.undo as { etiqueta?: unknown } | undefined)?.etiqueta;
      const nombre = typeof etiqueta === 'string' ? /«(.+)»/.exec(etiqueta)?.[1] : undefined;
      if (!info && nombre) cambio.titulo = nombre;
    }
    const key = typeof e.data?.key === 'string' ? e.data.key : null;
    const parte =
      e.action === 'field.update' && key
        ? (info?.campo(key) ?? key)
        : (ACCION_DE_ENTRADA[e.action] ?? null);
    if (parte) cambio.partes.add(parte);
  }

  const cambios: CambioPendiente[] = [];
  for (const { partes, creada, borrada, ...c } of porClave.values()) {
    const existe = Boolean(c.entryId);
    // Creada y borrada antes de publicar: el sitio no llegó a verla.
    if (creada && !existe) continue;
    let detalle = [...partes];
    // Lo que importa de una entrada borrada o nueva es eso, no cada campo.
    if (!existe && borrada) detalle = [ACCION_DE_ENTRADA['entry.delete']];
    else if (creada) detalle = [ACCION_DE_ENTRADA['entry.create']];
    cambios.push({ ...c, detalle });
  }
  if (galeria.size) {
    cambios.push({
      clave: 'galeria',
      titulo: 'Galería',
      detalle: Object.keys(GALERIA)
        .filter((t) => galeria.has(t))
        .map((t) => {
          const n = galeria.get(t)!.size;
          const [uno, varios] = GALERIA[t];
          return `${n} ${n === 1 ? uno : varios}`;
        }),
      ultimo: ultimoGaleria,
    });
  }
  return cambios.sort((a, b) => (a.ultimo < b.ultimo ? 1 : -1));
}

export class PendingService {
  constructor(
    private readonly db: Database.Database,
    private readonly contentService: ContentService
  ) {}

  ultimaPublicacion(): string | null {
    const fila = this.db
      .prepare(
        `SELECT completed_at AS fin FROM publish_jobs
         WHERE action = 'publish' AND status = 'succeeded' AND completed_at IS NOT NULL
         ORDER BY completed_at DESC LIMIT 1`
      )
      .get() as { fin: string } | undefined;
    return fila?.fin ?? null;
  }

  pendientes(): CambiosPendientes {
    const desde = this.ultimaPublicacion();
    const marcadores = ACCIONES_QUE_PUBLICAN.map(() => '?').join(', ');
    const filas = this.db
      .prepare(
        `SELECT action, entity_type AS entityType, entity_id AS entityId,
                data_json AS dataJson, created_at AS createdAt
         FROM audit_events
         WHERE action IN (${marcadores}) AND (? IS NULL OR created_at > ?)
         ORDER BY created_at DESC
         LIMIT 2000`
      )
      .all(...ACCIONES_QUE_PUBLICAN, desde, desde) as Array<
      Omit<EventoDeCambio, 'data'> & { dataJson: string | null }
    >;

    const eventos: EventoDeCambio[] = filas.map(({ dataJson, ...e }) => {
      let data: Record<string, unknown> | null = null;
      try {
        data = dataJson ? JSON.parse(dataJson) : null;
      } catch {
        data = null;
      }
      return { ...e, data };
    });

    const cache = new Map<string, ReturnType<Nombres['entrada']>>();
    const nombres: Nombres = {
      entrada: (id) => {
        if (!cache.has(id)) {
          try {
            const entry = this.contentService.getEntry(id);
            cache.set(id, {
              titulo: entry.title,
              campo: (key) => entry.fields[key]?.label || key,
            });
          } catch {
            cache.set(id, null);
          }
        }
        return cache.get(id) ?? null;
      },
    };

    const cambios = resumirCambios(eventos, nombres);
    return { desde, total: cambios.length, cambios };
  }
}
