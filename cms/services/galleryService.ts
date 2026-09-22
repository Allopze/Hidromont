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

  /**
   * Borra un álbum y devuelve su fila.
   *
   * Se lee antes: `deleteAlbum` valida que esté vacío y lanza si no, así que
   * capturar primero no cambia el comportamiento y deja el snapshot listo.
   */
  deleteAlbum(slug: string) {
    const existing = this.galleryRepository.getAlbumRow(slug);
    this.galleryRepository.deleteAlbum(slug);
    return existing;
  }

  /**
   * Rehace un álbum borrado.
   *
   * El slug lo elige una persona, así que es el único caso donde reusar el
   * identificador es realista: si alguien creó otro álbum con el mismo, no se
   * pisa nada y se avisa.
   */
  restoreDeletedAlbum(snap: {
    slug: string;
    name: string;
    position: number;
    createdAt: string;
    updatedAt: string;
  }): { slug: string } {
    if (this.galleryRepository.getAlbum(snap.slug)) {
      throw new Error(`Ya existe un álbum con el slug "${snap.slug}".`);
    }
    this.galleryRepository.restoreAlbum(snap);
    return { slug: snap.slug };
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

  /**
   * M-3: rechaza borrar una categoría con fotos.
   *
   * La FK es ON DELETE SET NULL, así que borrarla dejaba a todas sus fotos sin
   * categoría — fuera de todos los filtros de la galería pública — con una
   * confirmación que solo preguntaba «¿Eliminar la categoría X?» y no
   * mencionaba ninguna consecuencia. Los álbumes ya tenían esta guarda; las
   * categorías no. Reasignar 30 fotos a mano después no es una alternativa.
   */
  deleteCategory(id: string, confirm = false) {
    const existing = this.galleryRepository.getCategory(id);
    if (!existing) throw new Error(`Categoría ${id} no encontrada`);

    if (!confirm) {
      const enUso = this.galleryRepository.countItemsByCategory(id);
      if (enUso > 0) {
        throw new Error(
          `La categoría "${existing.name}" tiene ${enUso} foto(s). Si la borra, quedarán sin categoría y desaparecerán de los filtros de la galería. Reasígnelas antes, o repita la operación confirmando.`
        );
      }
    }
    // Los ids se capturan ANTES: el ON DELETE SET NULL los deja
    // indistinguibles de las fotos que nunca tuvieron categoría.
    const affectedItemIds = this.galleryRepository.listItemIdsByCategory(id);
    this.galleryRepository.deleteCategory(id);
    return { category: existing, affectedItemIds };
  }

  /**
   * Rehace una categoría y devuelve sus fotos, las que sigan sin categoría.
   *
   * Es el único punto donde el deshacer es legítimamente parcial, y hay que
   * decirlo: una foto recategorizada durante la ventana conserva lo nuevo.
   */
  restoreDeletedCategory(snap: {
    category: {
      id: string;
      name: string;
      slug: string;
      position: number;
      createdAt?: string;
      updatedAt?: string;
    };
    affectedItemIds?: string[];
  }): { id: string; revinculadas: number; omitidas: number } {
    if (this.galleryRepository.getCategory(snap.category.id)) {
      throw new Error(`Ya existe una categoría con el id "${snap.category.id}".`);
    }
    const now = new Date().toISOString();
    this.galleryRepository.createCategory({
      id: snap.category.id,
      name: snap.category.name,
      slug: snap.category.slug,
      position: snap.category.position,
      createdAt: snap.category.createdAt ?? now,
      updatedAt: now,
    });

    let revinculadas = 0;
    for (const itemId of snap.affectedItemIds ?? []) {
      if (this.galleryRepository.relinkItemCategory(itemId, snap.category.id, now)) revinculadas++;
    }
    return {
      id: snap.category.id,
      revinculadas,
      omitidas: (snap.affectedItemIds ?? []).length - revinculadas,
    };
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

  /** Borra una foto y devuelve lo necesario para volver a crearla igual. */
  deleteItem(id: string) {
    const existing = this.galleryRepository.getItem(id);
    if (!existing) throw new Error(`Item ${id} no encontrada`);
    this.galleryRepository.deleteItem(id);
    // Se descartan los campos del JOIN (media_*, category_*): se rehidratan
    // solos al releer, y guardarlos duplicaría datos que pueden haber
    // cambiado entre el borrado y el deshacer.
    return {
      id: existing.id,
      mediaId: existing.mediaId,
      categoryId: existing.categoryId ?? null,
      projectSlug: existing.projectSlug ?? null,
      title: existing.title,
      alt: existing.alt,
      caption: existing.caption ?? null,
      position: existing.position,
      featured: existing.featured,
      status: existing.status,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }

  /**
   * Rehace una foto borrada.
   *
   * Conserva su `position` original en vez de mandarla al final como hace
   * `createItem`: volver y aparecer la última se lee como pérdida aunque no lo
   * sea. `position` no es única y el orden desempata por `created_at`.
   */
  restoreDeletedItem(snap: {
    id: string;
    mediaId: string | null;
    categoryId: string | null;
    projectSlug: string | null;
    title: string;
    alt: string;
    caption: string | null;
    position: number;
    featured: boolean;
    status: 'published' | 'draft';
    createdAt: string;
    updatedAt: string;
  }): { id: string; avisos: string[] } {
    if (this.galleryRepository.getItem(snap.id)) {
      throw new Error(`Ya existe una foto con el id "${snap.id}".`);
    }
    const avisos: string[] = [];

    // Las claves foráneas están activas: si el medio o la categoría volaron
    // durante la ventana, el INSERT fallaría. El esquema contempla el nulo.
    let mediaId = snap.mediaId;
    if (mediaId && !this.galleryRepository.mediaExists(mediaId)) {
      mediaId = null;
      avisos.push('La imagen asociada ya no existe; reasígnela.');
    }
    let categoryId = snap.categoryId;
    if (categoryId && !this.galleryRepository.categoryExists(categoryId)) {
      categoryId = null;
      avisos.push('Su categoría ya no existe.');
    }

    this.galleryRepository.createItem({
      ...snap,
      mediaId: mediaId as string,
      categoryId,
    });
    return { id: snap.id, avisos };
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
