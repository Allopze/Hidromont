import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ContentService } from '../services/contentService';
import {
  createEntrySchema,
  entryParamsSchema,
  fieldParamsSchema,
  listEntriesQuerySchema,
  manifestQuerySchema,
  updateEntryMetaSchema,
  updateFieldSchema,
} from '../validators/cms.schema';
import { BaseController } from './BaseController';

export class ContentController extends BaseController {
  constructor(private readonly contentService: ContentService) {
    super();
  }

  async manifest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = manifestQuerySchema.parse(request.query);
      const entries = this.contentService.listEntries();
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
      this.handleSuccess(reply, this.contentService.updateField(params.id, params.key, body.value));
    } catch (error) {
      this.handleError(error, reply, 'updateField');
    }
  }

  async listEntries(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const query = listEntriesQuerySchema.parse(request.query);
      this.handleSuccess(reply, { entries: this.contentService.listEntries(query.kind) });
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
      this.contentService.deleteEntry(params.id);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'deleteEntry');
    }
  }
}
