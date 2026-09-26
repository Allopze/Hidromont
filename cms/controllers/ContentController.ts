import fs from 'node:fs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { resolvePublicAssetPath } from '../config/unifiedConfig';
import type { ContentService } from '../services/contentService';
import { ENUM_FIELDS } from '../../src/data/content-vocabulary';
import {
  createEntrySchema,
  entryParamsSchema,
  fieldParamsSchema,
  listEntriesQuerySchema,
  manifestQuerySchema,
  updateEntryMetaSchema,
  updateFieldSchema,
} from '../validators/cms.schema';
import { problemaDeForma } from '../validators/fieldShape';
import { BaseController } from './BaseController';
import type { AuditRepository } from '../repositories/AuditRepository';
import { UndoService } from '../services/undoService';

/**
 * Campos que el sitio no puede publicar vacíos (P1-04/P2-15, auditoría
 * 2026-09). Vaciarlos publicaba un H1 vacío, `<title>` genérico, una
 * description en blanco, JSON-LD con `"name":""` o un enlace de menú sin texto.
 */
export function esCampoObligatorio(kind: string, entryId: string, key: string): boolean {
  if (kind === 'proyecto') return ['nombre', 'alcance', 'categoria', 'orden'].includes(key);
  if (kind === 'servicio') return ['titulo', 'resumen', 'icono', 'orden'].includes(key);
  if (key === 'seoTitle' || key === 'seoDescription') return true;
  if (entryId.endsWith('.hero') && key === 'title') return true;
  if (entryId === 'layout.header' && /^nav[A-Z]/.test(key)) return true;
  return false;
}

export class ContentController extends BaseController {
  /** Ver GalleryController: el evento se escribe antes de responder. */
  constructor(
    private readonly contentService: ContentService,
    private readonly auditRepository: AuditRepository
  ) {
    super();
  }

  async manifest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = manifestQuerySchema.parse(request.query);
      // manifest necesita todas las entradas para el path-matching — no paginar.
      const { entries } = this.contentService.listEntries(undefined, 10000, 0);
      const path = query.path ?? '/';
      this.handleSuccess(reply, {
        path,
        entries: entries.filter((entry) => {
          if (entry.slug === path) return true;
          if (entry.slug === '/' && path === '/') return true;
          if (['layout', 'component', 'settings'].includes(entry.kind)) return true;
          if (entry.kind === 'servicio' && path === `/servicios/${entry.slug}`) return true;
          if (entry.kind === 'proyecto' && path === `/proyectos/${entry.slug}`) return true;
          return false;
        }),
      });
    } catch (error) {
      this.handleError(error, reply, 'manifest');
    }
  }

  async getEntry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = entryParamsSchema.parse(request.params);
      this.handleSuccess(reply, this.contentService.getEntry(params.id));
    } catch (error) {
      this.handleError(error, reply, 'getEntry');
    }
  }

  async updateField(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = fieldParamsSchema.parse(request.params);
      const body = updateFieldSchema.parse(request.body);

      // H-09: validar que el valor sea compatible con el tipo declarado del campo.
      // Obtenemos la entrada para conocer el tipo actual antes de persistir.
      const entry = this.contentService.getEntry(params.id);
      const fieldMeta = entry.fields[params.key];
      // P2-15 (auditoría 2026-09): los textos de una línea se guardaban con los
      // espacios pegados («  xIngeniería…», o solo espacios, que publicaban una
      // description en blanco). Se recortan al guardar.
      if (
        typeof body.value === 'string' &&
        (fieldMeta?.type === 'text' || fieldMeta?.type === 'textarea')
      ) {
        body.value = body.value.trim();
      }
      // P3-12 (auditoría 2026-09): en una lista, un elemento de solo espacios
      // pintaba una insignia vacía en la ficha.
      if (fieldMeta?.type === 'list' && Array.isArray(body.value)) {
        body.value = body.value
          .map((v) => (typeof v === 'string' ? v.trim() : v))
          .filter((v) => v !== '');
      }
      // P3-12: «Ruta del archivo» aceptaba rutas que no existen: se guardaba y,
      // al publicar, la cabecera salía vacía.
      if (
        (fieldMeta?.type === 'image' || fieldMeta?.type === 'video') &&
        typeof body.value === 'string' &&
        body.value.startsWith('/') &&
        !fs.existsSync(resolvePublicAssetPath(body.value))
      ) {
        reply.status(400).send({
          error: `No hay ningún archivo en «${body.value}». Elige uno de la biblioteca o súbelo.`,
        });
        return;
      }
      // P2-15: los campos que el sitio no puede mostrar vacíos —el título de
      // cada ficha, su descripción, los títulos y textos para buscadores, los
      // rótulos del menú— no se guardan vacíos.
      if (
        fieldMeta &&
        (body.value === '' || body.value === null) &&
        esCampoObligatorio(entry.kind, entry.id, params.key)
      ) {
        reply.status(400).send({
          error: `«${fieldMeta.label || params.key}» es obligatorio: el sitio no puede mostrarlo vacío.`,
        });
        return;
      }
      if (fieldMeta) {
        const { type } = fieldMeta;
        const val = body.value;
        if (type === 'number' && val !== null && val !== undefined && typeof val !== 'number') {
          reply.status(400).send({ error: `El campo "${params.key}" debe ser numérico` });
          return;
        }
        if (type === 'list' && val !== null && val !== undefined && !Array.isArray(val)) {
          reply.status(400).send({ error: `El campo "${params.key}" debe ser una lista (array)` });
          return;
        }
        if (
          (type === 'text' ||
            type === 'textarea' ||
            type === 'richtext' ||
            type === 'image' ||
            type === 'video') &&
          val !== null &&
          val !== undefined &&
          typeof val !== 'string'
        ) {
          reply
            .status(400)
            .send({ error: `El campo "${params.key}" de tipo "${type}" debe ser texto` });
          return;
        }
        const problema = problemaDeForma(fieldMeta.label || params.key, fieldMeta.value, val);
        if (problema) {
          reply.status(400).send({ error: problema });
          return;
        }
      }

      // A-7: el valor de un campo de enumeración se valida aquí, donde el
      // editor puede corregirlo con contexto. El gate del export sigue
      // existiendo como red de seguridad para todo lo que no pasa por la API
      // (seed, scripts, restauración de revisiones, edición directa de SQLite).
      // P1-02: el servicio de un proyecto se elige entre los servicios que
      // existen, no entre una lista fija: uno creado desde el panel también.
      // Vacío está permitido (el proyecto enlaza por su categoría).
      const allowed =
        entry.kind === 'proyecto' && params.key === 'servicio'
          ? this.contentService.serviceOptions().map((o) => o.value)
          : ENUM_FIELDS[entry.kind]?.[params.key];
      const vacio = body.value === null || body.value === undefined || body.value === '';
      if (allowed && !vacio) {
        if (!allowed.includes(String(body.value))) {
          reply.status(400).send({
            error: `El campo "${params.key}" debe ser uno de: ${allowed.join(', ')}`,
          });
          return;
        }
      }

      this.handleSuccess(
        reply,
        this.contentService.updateField(
          params.id,
          params.key,
          body.value,
          body.mediaId,
          body.expectedVersion
        )
      );
    } catch (error) {
      this.handleError(error, reply, 'updateField');
    }
  }

  async listEntries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = listEntriesQuerySchema.parse(request.query);
      const offset = (query.page - 1) * query.limit;
      const { entries, total } = this.contentService.listEntries(
        query.kind,
        query.limit,
        offset,
        query.q
      );
      this.handleSuccess(reply, {
        entries,
        total,
        page: query.page,
        limit: query.limit,
        pages: Math.ceil(total / query.limit),
      });
    } catch (error) {
      this.handleError(error, reply, 'listEntries');
    }
  }

  async createEntry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const body = createEntrySchema.parse(request.body);
      const entry = this.contentService.createEntry({
        ...body,
        fields: body.fields as Record<string, { type: string; value: unknown }> | undefined,
      });
      this.handleSuccess(reply, entry, 201);
    } catch (error) {
      this.handleError(error, reply, 'createEntry');
    }
  }

  async updateEntryMeta(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = entryParamsSchema.parse(request.params);
      const body = updateEntryMetaSchema.parse(request.body);
      this.handleSuccess(reply, this.contentService.updateEntryMeta(params.id, body));
    } catch (error) {
      this.handleError(error, reply, 'updateEntryMeta');
    }
  }

  async deleteEntry(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = entryParamsSchema.parse(request.params);
      // P1-03 (auditoría 2026-09): borrar un servicio que citan proyectos no
      // avisaba y dejaba sus fichas enlazando a un 404. Ahora se pide
      // confirmación con la lista; al confirmar, esos proyectos pasan a
      // enlazar por su categoría (el export omite un servicio que no existe).
      const confirmado = (request.query as { confirm?: string } | undefined)?.confirm === '1';
      const aBorrar = this.contentService.getEntryIfExists(params.id);
      if (aBorrar?.kind === 'servicio' && !confirmado) {
        const citan = this.contentService.projectsReferencingService(aBorrar.slug);
        if (citan.length > 0) {
          reply.status(409).send({
            error:
              `El servicio «${aBorrar.title}» está en uso por ${citan.length} proyecto(s): ` +
              `${citan.map((p) => p.title).join(', ')}. Si lo eliminas, esos proyectos ` +
              'dejarán de enlazar a este servicio.',
          });
          return;
        }
      }
      const snapshot = this.contentService.deleteEntry(params.id);
      const token = snapshot.entry
        ? this.auditRepository.log({
            action: 'entry.delete',
            userId: request.cmsSession?.user.id,
            entityType: 'entry',
            entityId: params.id,
            data: {
              undo: UndoService.sobre('entry', `la entrada «${snapshot.entry.title}»`, snapshot),
            },
            ip: request.ip,
          })
        : null;
      this.handleSuccess(reply, {
        ok: true,
        undo: UndoService.oferta(token, `la entrada «${snapshot.entry?.title ?? params.id}»`),
      });
    } catch (error) {
      this.handleError(error, reply, 'deleteEntry');
    }
  }
}
