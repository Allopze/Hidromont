import type { AuditRepository } from '../repositories/AuditRepository';
import type { ContentService } from './contentService';
import type { GalleryService } from './galleryService';

/**
 * Deshacer inmediato de un borrado.
 *
 * Los cinco DELETE de la API eran físicos e irreversibles, y el de fotos de
 * galería no tenía ni confirmación en servidor pese a destruir título, alt,
 * posición, categoría, álbum y destacado de un clic.
 *
 * No hace falta esquema nuevo: `audit_events` ya tiene una columna `data_json`
 * que en los borrados se escribía como `null` —solo el hecho, no el
 * contenido—. El snapshot va ahí, en el mismo evento, y el token es el id de
 * ese evento.
 *
 * Los medios quedan fuera a propósito: su borrado hace `unlink` del archivo, y
 * un «Deshacer» que no puede devolver los bytes miente. Eso sería una papelera
 * con cuarentena y purga, que es otro cambio.
 */

/** Cuánto tiempo se OFRECE deshacer. El cliente cuenta; el servidor manda. */
export const VENTANA_MS = 12_000;

/**
 * Margen sobre la ventana al validar en servidor.
 *
 * Sin él, la petición que sale en el segundo 11,9 y llega en el 12,05 recibe
 * un rechazo con el botón todavía encendido. No es una ventana secreta más
 * larga: la interfaz nunca la ofrece.
 */
const GRACIA_MS = 3_000;

export type TipoDeshacer = 'entry' | 'gallery_item' | 'gallery_category' | 'gallery_album';

export interface SobreDeshacer {
  v: 1;
  kind: TipoDeshacer;
  expiresAt: string;
  etiqueta: string;
  snapshot: unknown;
}

export class ErrorDeshacer extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export class UndoService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly contentService: ContentService,
    private readonly galleryService: GalleryService
  ) {}

  /**
   * Envuelve un snapshot para guardarlo junto al evento de auditoría.
   *
   * `etiqueta` es lo que verá el operador («la foto "Bifurcación"»), así que
   * se calcula aquí y no en la interfaz: el cliente no tiene el dato una vez
   * borrado.
   */
  static sobre(kind: TipoDeshacer, etiqueta: string, snapshot: unknown): SobreDeshacer {
    return {
      v: 1,
      kind,
      etiqueta,
      expiresAt: new Date(Date.now() + VENTANA_MS).toISOString(),
      snapshot,
    };
  }

  /** Lo que se devuelve al cliente tras un borrado deshacible. */
  static oferta(token: string | null, etiqueta: string) {
    return token ? { token, expiresInMs: VENTANA_MS, etiqueta } : undefined;
  }

  restore(
    token: string,
    quien: { userId?: string; ip?: string }
  ): { kind: TipoDeshacer; etiqueta: string; avisos: string[]; yaRestaurado?: boolean } {
    const evento = this.auditRepository.find(token);
    if (!evento) throw new ErrorDeshacer('Ese deshacer ya no está disponible.', 404);
    if (!evento.action.endsWith('.delete')) {
      throw new ErrorDeshacer('Ese registro no corresponde a un borrado.', 400);
    }

    const sobre = (evento.data as { undo?: SobreDeshacer } | undefined)?.undo;
    if (!sobre || sobre.v !== 1) {
      throw new ErrorDeshacer('Ese borrado se registró sin copia recuperable.', 400);
    }
    if (Date.now() > Date.parse(sobre.expiresAt) + GRACIA_MS) {
      throw new ErrorDeshacer('El plazo para deshacer venció.', 410);
    }

    // El doble clic satisface la intención —que vuelva a existir—, así que no
    // es un error. Se responde que ya estaba hecho.
    const yaHecho = this.auditRepository
      .listByEntity(evento.entityId ?? '', 20)
      .some(
        (e) => e.action === 'undo.restore' && (e.data as { undoOf?: string })?.undoOf === token
      );
    if (yaHecho) {
      return { kind: sobre.kind, etiqueta: sobre.etiqueta, avisos: [], yaRestaurado: true };
    }

    const avisos = this.reconstruir(sobre);

    this.auditRepository.log({
      action: 'undo.restore',
      userId: quien.userId,
      entityType: evento.entityType,
      entityId: evento.entityId,
      data: { undoOf: token },
      ip: quien.ip,
    });

    return { kind: sobre.kind, etiqueta: sobre.etiqueta, avisos };
  }

  /**
   * La reconstrucción vive en cada servicio de dominio, no aquí: así este no
   * acaba dependiendo de cuatro repositorios y la separación de capas se
   * mantiene como en el resto del proyecto.
   */
  private reconstruir(sobre: SobreDeshacer): string[] {
    try {
      switch (sobre.kind) {
        case 'entry': {
          const r = this.contentService.restoreDeletedEntry(
            sobre.snapshot as Parameters<ContentService['restoreDeletedEntry']>[0]
          );
          return r.fileRestored
            ? []
            : ['El archivo del sitio no se reescribió; vuelva a exportar.'];
        }
        case 'gallery_item':
          return this.galleryService.restoreDeletedItem(
            sobre.snapshot as Parameters<GalleryService['restoreDeletedItem']>[0]
          ).avisos;
        case 'gallery_category': {
          const r = this.galleryService.restoreDeletedCategory(
            sobre.snapshot as Parameters<GalleryService['restoreDeletedCategory']>[0]
          );
          return r.omitidas > 0
            ? [`${r.omitidas} foto(s) ya tenían otra categoría y se dejaron como estaban.`]
            : [];
        }
        case 'gallery_album':
          this.galleryService.restoreDeletedAlbum(
            sobre.snapshot as Parameters<GalleryService['restoreDeletedAlbum']>[0]
          );
          return [];
        default:
          throw new ErrorDeshacer('Tipo de borrado desconocido.', 400);
      }
    } catch (error) {
      if (error instanceof ErrorDeshacer) throw error;
      // «Ya existe...» es el caso del identificador reusado: es un conflicto,
      // no un fallo del servidor, y no se ha tocado nada.
      const mensaje = error instanceof Error ? error.message : 'No se pudo restaurar.';
      throw new ErrorDeshacer(mensaje, /^Ya existe/.test(mensaje) ? 409 : 400);
    }
  }

  /**
   * Vacía los snapshots caducados, conservando la fila.
   *
   * El rastro de auditoría es el punto: se anula `data.undo`, nunca el evento.
   * Sin esto, cada borrado dejaría su copia en la base para siempre.
   */
  purgeExpiredSnapshots(): number {
    let purgados = 0;
    for (const evento of this.auditRepository.list(500)) {
      if (!evento.undoAvailable || !evento.undoExpiresAt) continue;
      if (Date.now() <= Date.parse(evento.undoExpiresAt) + GRACIA_MS) continue;
      if (this.auditRepository.clearUndo(evento.id)) purgados++;
    }
    return purgados;
  }
}
