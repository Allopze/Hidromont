import type { FastifyReply, FastifyRequest } from 'fastify';
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
          (type === 'text' || type === 'textarea' || type === 'richtext' || type === 'image') &&
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
      const allowed = ENUM_FIELDS[entry.kind]?.[params.key];
      if (allowed && body.value !== null && body.value !== undefined) {
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
