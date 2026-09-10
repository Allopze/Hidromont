import type { FastifyReply, FastifyRequest } from 'fastify';
import type { GalleryService } from '../services/galleryService';
import {
  albumParamsSchema,
  createAlbumSchema,
  updateAlbumSchema,
  reorderAlbumsSchema,
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

  // ── Albums (GAL-19) ─────────────────────────────────────────

  listAlbums(_request: FastifyRequest, reply: FastifyReply): void {
    try {
      this.handleSuccess(reply, { items: this.galleryService.listAlbums() });
    } catch (error) {
      this.handleError(error, reply, 'listGalleryAlbums');
    }
  }

  createAlbum(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const body = createAlbumSchema.parse(request.body);
      this.handleSuccess(reply, this.galleryService.createAlbum(body), 201);
    } catch (error) {
      this.handleError(error, reply, 'createGalleryAlbum');
    }
  }

  updateAlbum(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = albumParamsSchema.parse(request.params);
      const body = updateAlbumSchema.parse(request.body);
      this.handleSuccess(reply, this.galleryService.updateAlbum(params.slug, body));
    } catch (error) {
      this.handleError(error, reply, 'updateGalleryAlbum');
    }
  }

  deleteAlbum(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const params = albumParamsSchema.parse(request.params);
      this.galleryService.deleteAlbum(params.slug);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'deleteGalleryAlbum');
    }
  }

  reorderAlbums(request: FastifyRequest, reply: FastifyReply): void {
    try {
      const body = reorderAlbumsSchema.parse(request.body);
      this.galleryService.reorderAlbums(body.slugs);
      this.handleSuccess(reply, { ok: true });
    } catch (error) {
      this.handleError(error, reply, 'reorderGalleryAlbums');
    }
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
      this.galleryService.deleteCategory(
        params.id,
        (request.query as { confirm?: string }).confirm === '1'
      );
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
