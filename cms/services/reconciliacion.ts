/**
 * Pone la base al día con el código: lo que el servidor hace al arrancar antes
 * de servir nada.
 *
 * M-04 (auditoría 2026-09-28): esto vivía dentro de `registerCmsRoutes`, así
 * que `npm run cms:export` —el que usa `deploy-vps.sh` antes de compilar—
 * exportaba la base tal cual, sin las claves nuevas de la semilla y con fichas
 * que el servidor retira al arrancar. Con una base anterior al código, el build
 * del despliegue salía de un JSON con 134 claves de menos, y el servidor, al
 * arrancar después, reconciliaba y reexportaba sin recompilar. Ahora los dos
 * caminos llaman a esta función.
 *
 * Todo es idempotente: una segunda pasada no cambia nada.
 */
import type Database from 'better-sqlite3';
import type { AuditRepository } from '../repositories/AuditRepository';
import type { ContentRepository } from '../repositories/ContentRepository';
import type { SlugRepository } from '../repositories/SlugRepository';
import type { CmsEntry } from '../types/cms';
import type { ContentService } from './contentService';

export interface ResultadoDeReconciliacion {
  /** La base no tenía ninguna ficha antes de sembrar. */
  estabaVacia: boolean;
  inserted: number;
  fieldsInserted: number;
  companeras: number;
  retiradas: string[];
  camposRetirados: number;
  conRevisionNueva: number;
  /** Hubo algo que cambie lo que se exporta. */
  huboCambios: boolean;
}

export function reconciliarBase(deps: {
  db: Database.Database;
  contentService: ContentService;
  contentRepository: ContentRepository;
  slugRepository: SlugRepository;
  auditRepository: AuditRepository;
  log?: (mensaje: string) => void;
}): ResultadoDeReconciliacion {
  const { db, contentService, contentRepository, slugRepository, auditRepository } = deps;
  const log = deps.log ?? (() => {});

  const estabaVacia =
    (db.prepare('SELECT COUNT(*) n FROM content_entries').get() as { n: number }).n === 0;

  // P1-03: las fichas borradas antes de existir el historial de slugs quedan
  // en la auditoría (su snapshot de deshacer): se anotan para que su .md, si
  // reaparece, no se reimporte como ficha nueva ni siga publicado.
  for (const evento of auditRepository.listByAction('entry.delete')) {
    const borrada = (evento.data as { undo?: { snapshot?: { entry?: CmsEntry } } } | undefined)
      ?.undo?.snapshot?.entry;
    if (!borrada || (borrada.kind !== 'servicio' && borrada.kind !== 'proyecto')) continue;
    if (contentRepository.findCollectionEntryBySlug(borrada.kind, borrada.slug, borrada.locale))
      continue;
    slugRepository.record(borrada.kind, borrada.slug, borrada.id);
  }

  const { inserted, fieldsInserted } = contentService.importMissingEntries();

  // P1-02: toda ficha de colección tiene su foto de cabecera y su galería
  // editables, también las creadas antes de este cambio.
  const companeras = contentService.ensureCompanions();
  if (companeras > 0) {
    log(`[CMS] ${companeras} ficha(s) de imagen o galería creada(s) para fichas nuevas.`);
  }

  // La semilla solo añade; las fichas que ninguna página lee se retiran aquí.
  // El snapshot queda en la auditoría por si hubiera que rehacer alguna.
  const retiradas = contentService.retireObsoleteEntries();
  for (const snapshot of retiradas) {
    auditRepository.log({
      action: 'content.entry_retired',
      entityType: 'entry',
      entityId: snapshot.entry.id,
      data: snapshot,
    });
  }
  if (retiradas.length > 0) {
    log(
      `[CMS] retiradas ${retiradas.length} ficha(s) sin uso en el sitio: ${retiradas
        .map((r) => r.entry.id)
        .join(', ')}.`
    );
  }

  const camposRetirados = contentService.retireObsoleteFields();
  for (const campo of camposRetirados) {
    auditRepository.log({
      action: 'content.field_retired',
      entityType: 'field',
      entityId: `${campo.entryId}.${campo.key}`,
      data: campo,
    });
  }
  if (camposRetirados.length > 0) {
    log(`[CMS] retirados ${camposRetirados.length} campo(s) sin uso en el sitio.`);
  }

  // P1-06: toda entrada debe tener una revisión con su estado actual, para que
  // «Revisiones» nunca restaure un estado de meses atrás.
  const conRevisionNueva = contentRepository.ensureCurrentRevisions();
  if (conRevisionNueva.length > 0) {
    log(`[CMS] ${conRevisionNueva.length} ficha(s) sin revisión de su estado actual: creada.`);
  }

  const huboCambios =
    inserted > 0 || fieldsInserted > 0 || retiradas.length > 0 || camposRetirados.length > 0;
  if (huboCambios) {
    log(`[CMS] seed: ${inserted} entrada(s) y ${fieldsInserted} campo(s) nuevo(s) importado(s).`);
  }

  return {
    estabaVacia,
    inserted,
    fieldsInserted,
    companeras,
    retiradas: retiradas.map((r) => r.entry.id),
    camposRetirados: camposRetirados.length,
    conRevisionNueva: conRevisionNueva.length,
    huboCambios,
  };
}

/** El aviso cuando la base estaba vacía: lo sembrado es la semilla, no el sitio. */
export const AVISO_BASE_VACIA =
  '[CMS] La base estaba vacía y se ha sembrado desde defaultContent.ts.\n' +
  '[CMS] NO se exporta: los archivos del sitio son más nuevos que la semilla.\n' +
  '[CMS] Si esta es una instalación nueva de verdad, ejecute a mano\n' +
  '[CMS]   npm run cms:export -- --base-nueva\n' +
  '[CMS] Si esperaba encontrar contenido, revise CMS_DATABASE_PATH.\n';
