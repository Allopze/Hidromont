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
import type { AuditRepository } from '../repositories/AuditRepository';
import { UndoService, type TipoDeshacer } from '../services/undoService';

export class GalleryController extends BaseController {
  /**
   * `auditRepository` llega aquí y no se queda en la ruta porque el evento
   * tiene que escribirse ANTES de responder: su id es el token de deshacer y
   * viaja en el cuerpo. Los `log()` de las rutas corren después de
   * `reply.send()`, cuando ya no hay dónde meterlo.
   */
  constructor(
    private readonly galleryService: GalleryService,
    private readonly auditRepository: AuditRepository
  ) {
    super();
  }

  /** Registra el borrado con su copia y devuelve la oferta de deshacer. */
  private ofrecerDeshacer(
    request: FastifyRequest,
    accion: string,
    entityType: string,
    entityId: string,
    kind: TipoDeshacer,
    etiqueta: string,
    snapshot: unknown
  ) {
    const token = this.auditRepository.log({
      action: accion,
      userId: request.cmsSession?.user.id,
      entityType,
      entityId,
      data: { undo: UndoService.sobre(kind, etiqueta, snapshot) },
      ip: request.ip,
    });
    return UndoService.oferta(token, etiqueta);
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
      const snapshot = this.galleryService.deleteAlbum(params.slug);
      const undo = snapshot
        ? this.ofrecerDeshacer(
            request,
            'gallery.album.delete',
            'gallery_album',
            params.slug,
            'gallery_album',
            `el álbum «${snapshot.name}»`,
            snapshot
          )
        : undefined;
      this.handleSuccess(reply, { ok: true, undo });
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
      const snapshot = this.galleryService.deleteCategory(
        params.id,
        (request.query as { confirm?: string }).confirm === '1'
      );
      this.handleSuccess(reply, {
        ok: true,
        undo: this.ofrecerDeshacer(
          request,
          'gallery.category.delete',
          'gallery_category',
          params.id,
          'gallery_category',
          `la categoría «${snapshot.category.name}»`,
          snapshot
        ),
      });
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
      const snapshot = this.galleryService.deleteItem(params.id);
      this.handleSuccess(reply, {
        ok: true,
        undo: this.ofrecerDeshacer(
          request,
          'gallery.item.delete',
          'gallery_item',
          params.id,
          'gallery_item',
          `la foto «${snapshot.title || snapshot.alt}»`,
          snapshot
        ),
      });
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
