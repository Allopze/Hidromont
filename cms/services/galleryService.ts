import { nanoid } from 'nanoid';
import type { GalleryRepository } from '../repositories/GalleryRepository';

export class GalleryService {
  constructor(private readonly galleryRepository: GalleryRepository) {}

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
    title: string;
    alt: string;
    caption?: string | null;
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
      title: input.title,
      alt: input.alt,
      caption: input.caption ?? null,
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
      title?: string;
      alt?: string;
      caption?: string | null;
      featured?: boolean;
      status?: 'published' | 'draft';
    }
  ) {
    if (input.categoryId) {
      const cat = this.galleryRepository.getCategory(input.categoryId);
      if (!cat) throw new Error(`Categoría ${input.categoryId} no encontrada`);
    }
    return this.galleryRepository.updateItem(id, input);
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
