import { nanoid } from 'nanoid';
import type { GalleryRepository } from '../repositories/GalleryRepository';

export class GalleryService {
  constructor(private readonly galleryRepository: GalleryRepository) {}

  // ── Albums (GAL-19) ─────────────────────────────────────────
  //
  // A diferencia de las categorías, la clave es el slug y no se puede cambiar:
  // renombrar el slug dejaría huérfanas las fotos que lo referencian en
  // project_slug. Cambiar el nombre visible sí, que es justo para lo que existe
  // la tabla — antes vivía en un mapa hardcodeado en src/data/gallery.ts.

  listAlbums() {
    return this.galleryRepository.listAlbums();
  }

  createAlbum(input: { name: string; slug?: string }) {
    const slug = input.slug ?? this.slugify(input.name);
    if (!slug) throw new Error('El nombre del álbum no produce un slug válido');
    if (this.galleryRepository.getAlbum(slug)) {
      throw new Error(`Ya existe un álbum con el slug "${slug}"`);
    }

    const position = this.galleryRepository
      .listAlbums()
      .reduce((max, album) => Math.max(max, album.position), -1);

    return this.galleryRepository.createAlbum({
      slug,
      name: input.name,
      position: position + 1,
      now: new Date().toISOString(),
    });
  }

  updateAlbum(slug: string, input: { name?: string; position?: number }) {
    this.galleryRepository.updateAlbum(slug, { ...input, now: new Date().toISOString() });
    return this.galleryRepository.getAlbum(slug);
  }

  deleteAlbum(slug: string) {
    this.galleryRepository.deleteAlbum(slug);
  }

  reorderAlbums(slugs: string[]) {
    this.galleryRepository.reorderAlbums(slugs, new Date().toISOString());
  }

  // ── Categories ──────────────────────────────────────────────

  listCategories() {
    return this.galleryRepository.listCategories();
  }

  createCategory(input: { name: string; slug?: string }) {
    const slug = input.slug ?? this.slugify(input.name);
    const existing = this.galleryRepository.getCategoryBySlug(slug);
    if (existing) throw new Error(`Ya existe una categoría con el slug "${slug}"`);

    const now = new Date().toISOString();
    return this.galleryRepository.createCategory({
      id: nanoid(),
      name: input.name,
      slug,
      position: this.galleryRepository.maxCategoryPosition() + 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  updateCategory(id: string, input: { name?: string; slug?: string }) {
    if (input.slug) {
      const existing = this.galleryRepository.getCategoryBySlug(input.slug);
      if (existing && existing.id !== id) {
        throw new Error(`Ya existe una categoría con el slug "${input.slug}"`);
      }
    }
    return this.galleryRepository.updateCategory(id, input);
  }

  deleteCategory(id: string) {
    const existing = this.galleryRepository.getCategory(id);
    if (!existing) throw new Error(`Categoría ${id} no encontrada`);
    this.galleryRepository.deleteCategory(id);
  }

  reorderCategories(ids: string[]) {
    this.galleryRepository.reorderCategories(ids);
  }

  // ── Items ───────────────────────────────────────────────────

  listItems(opts?: { categoryId?: string; status?: string }) {
    return this.galleryRepository.listItems(opts);
  }

  getItem(id: string) {
    const item = this.galleryRepository.getItem(id);
    if (!item) throw new Error(`Item ${id} no encontrada`);
    return item;
  }

  createItem(input: {
    mediaId: string;
    categoryId?: string | null;
    projectSlug?: string | null;
    alt: string;
    featured?: boolean;
    status?: 'published' | 'draft';
  }) {
    if (input.categoryId) {
      const cat = this.galleryRepository.getCategory(input.categoryId);
      if (!cat) throw new Error(`Categoría ${input.categoryId} no encontrada`);
    }

    const now = new Date().toISOString();
    return this.galleryRepository.createItem({
      id: nanoid(),
      mediaId: input.mediaId,
      categoryId: input.categoryId ?? null,
      projectSlug: input.projectSlug ?? null,
      // La galería ya no rotula las fotos, pero `title` sigue siendo NOT NULL en
      // la tabla. En vez de una migración destructiva sobre la base del
      // operador, se rellena con el alt y deja de exportarse.
      title: input.alt,
      alt: input.alt,
      caption: null,
      position: this.galleryRepository.maxItemPosition() + 1,
      featured: input.featured ?? false,
      status: input.status ?? 'published',
      createdAt: now,
      updatedAt: now,
    });
  }

  updateItem(
    id: string,
    input: {
      mediaId?: string;
      categoryId?: string | null;
      projectSlug?: string | null;
      alt?: string;
      featured?: boolean;
      status?: 'published' | 'draft';
    }
  ) {
    if (input.categoryId) {
      const cat = this.galleryRepository.getCategory(input.categoryId);
      if (!cat) throw new Error(`Categoría ${input.categoryId} no encontrada`);
    }
    // `title` acompaña al alt para que la columna legada no quede desfasada.
    return this.galleryRepository.updateItem(id, {
      ...input,
      ...(input.alt !== undefined ? { title: input.alt } : {}),
    });
  }

  deleteItem(id: string) {
    const existing = this.galleryRepository.getItem(id);
    if (!existing) throw new Error(`Item ${id} no encontrada`);
    this.galleryRepository.deleteItem(id);
  }

  reorderItems(ids: string[]) {
    this.galleryRepository.reorderItems(ids);
  }

  private slugify(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
