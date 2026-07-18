import type { FastifyReply, FastifyRequest } from 'fastify';
import type { MediaService } from '../services/mediaService';
import { updateMediaSchema } from '../validators/cms.schema';
import { BaseController } from './BaseController';

function multipartFieldValue(field: unknown): string | undefined {
  if (!field || Array.isArray(field) || typeof field !== 'object') return undefined;
  const value = (field as { value?: unknown }).value;
  return typeof value === 'string' ? value : undefined;
}

export class MediaController extends BaseController {
  constructor(private readonly mediaService: MediaService) {
    super();
  }

  async list(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      this.handleSuccess(reply, { items: this.mediaService.listMedia() });
    } catch (error) {
      this.handleError(error, reply, 'listMedia');
    }
  }

  async getById(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      this.handleSuccess(reply, this.mediaService.getMediaWithUsages(params.id));
    } catch (error) {
      this.handleError(error, reply, 'getMedia');
    }
  }

  async upload(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const file = await request.file();
      if (!file) throw new Error('Archivo requerido');

      const buffer = await file.toBuffer();
      const asset = await this.mediaService.createMedia({
        filename: file.filename,
        mime: file.mimetype,
        buffer,
        alt: multipartFieldValue(file.fields.alt),
      });

      this.handleSuccess(reply, asset, 201);
    } catch (error) {
      this.handleError(error, reply, 'uploadMedia');
    }
  }

  async update(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const body = updateMediaSchema.parse(request.body);
      this.handleSuccess(reply, this.mediaService.updateMedia({ id: params.id, ...body }));
    } catch (error) {
      this.handleError(error, reply, 'updateMedia');
    }
  }

  async delete(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    try {
      const params = request.params as { id: string };
      const result = this.mediaService.deleteMedia(params.id);
      this.handleSuccess(reply, { ok: true, orphanedGalleryItems: result.orphanedGalleryItems });
    } catch (error) {
      this.handleError(error, reply, 'deleteMedia');
    }
  }
}
