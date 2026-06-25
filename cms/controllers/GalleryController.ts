import type { FastifyReply, FastifyRequest } from 'fastify';
import type { GalleryService } from '../services/galleryService';
import {
  createCategorySchema,
  updateCategorySchema,
  reorderSchema,
  createGalleryItemSchema,
  updateGalleryItemSchema,
} from '../validators/cms.schema';
import { BaseController } from './BaseController';

export class GalleryController extends BaseController {
  constructor(private readonly galleryService: GalleryService) {
    super();
  }

  // ── Categories ──────────────────────────────────────────────

  listCategories(_request: FastifyRequest, reply: FastifyReply): void {
    try {
      this.handleSuccess(reply, { items: this.galleryService.listCategories() });
    } catch (error) {
      this.handleError(error, reply, 'listGalleryCategories');
    }
  }

  createCategory(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const body = createCategorySchema.parse(request.body);
      this.handleSuccess(reply, this.galleryService.createCategory(body), 201);
    } catch (error) {
      this.handleError(error, reply, 'createGalleryCategory');
    }
  }

  updateCategory(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = request.params as { id: string };
      const body = updateCategorySchema.parse(request.body);
      this.handleSuccess(reply, this.galleryService.updateCategory(params.id, body));
    } catch (error) {
      this.handleError(error, reply, 'updateGalleryCategory');
    }
  }

  deleteCategory(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = request.params as { id: string };
      this.galleryService.deleteCategory(params.id);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'deleteGalleryCategory');
    }
  }

  reorderCategories(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const body = reorderSchema.parse(request.body);
      this.galleryService.reorderCategories(body.ids);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'reorderGalleryCategories');
    }
  }

  // ── Items ───────────────────────────────────────────────────

  listItems(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const query = request.query as { categoryId?: string; status?: string };
      this.handleSuccess(reply, {
        items: this.galleryService.listItems({
          categoryId: query.categoryId,
          status: query.status,
        }),
      });
    } catch (error) {
      this.handleError(error, reply, 'listGalleryItems');
    }
  }

  getItem(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = request.params as { id: string };
      this.handleSuccess(reply, this.galleryService.getItem(params.id));
    } catch (error) {
      this.handleError(error, reply, 'getGalleryItem');
    }
  }

  createItem(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const body = createGalleryItemSchema.parse(request.body);
      this.handleSuccess(reply, this.galleryService.createItem(body), 201);
    } catch (error) {
      this.handleError(error, reply, 'createGalleryItem');
    }
  }

  updateItem(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = request.params as { id: string };
      const body = updateGalleryItemSchema.parse(request.body);
      this.handleSuccess(reply, this.galleryService.updateItem(params.id, body));
    } catch (error) {
      this.handleError(error, reply, 'updateGalleryItem');
    }
  }

  deleteItem(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = request.params as { id: string };
      this.galleryService.deleteItem(params.id);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'deleteGalleryItem');
    }
  }

  reorderItems(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const body = reorderSchema.parse(request.body);
      this.galleryService.reorderItems(body.ids);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'reorderGalleryItems');
    }
  }
}
