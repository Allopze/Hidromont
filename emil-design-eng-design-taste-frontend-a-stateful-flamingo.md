# Plan: Galería gestionable por CMS + rediseño UI/UX (Hidromont Chile)

## Contexto

La página `/galeria` ([src/pages/galeria/index.astro](src/pages/galeria/index.astro)) hoy **escanea dos carpetas en build** y vuelca **1.745 imágenes** en una sola grilla: 23 fotos curadas (con nombres buenos) + **1.722 subidas del CMS (2,7 GB)** con nombres tipo `001.jpg` / `101_1746.JPG`. Consecuencias visibles incluso en la captura actual (la tarjeta central muestra `OTROS / 002`):

- **Metadatos basura**: las 1.722 reciben título "002" y caen todas en "Otros" (categoría sin botón de filtro).
- **Rendimiento roto**: 1.722 `<img>` a tamaño completo, sin `srcset`, sin `width/height` → LCP y DOM enormes, CLS.
- **Orden invertido**: las del CMS van primero; las buenas (curadas) quedan al final.
- **Etiquetas solo en hover** → invisibles en móvil/táctil.
- **No accesible**: tarjetas son `<div>` con click (sin teclado); el lightbox no atrapa foco ni lo restaura.
- **Filtros genéricos** (pills grises), mucho espacio en blanco muerto, y tamaños bento **aleatorios** (hash) que recortan mal fotos de teléfono.

**Decisiones del cliente (confirmadas):**
1. **Contenido:** galería **curada** (no las 1.700), pero **gestionable por el cliente vía CMS** — subir fotos, crear/editar/eliminar categorías, asignar metadatos, ordenar.
2. **Metadatos:** reales por imagen (título, categoría, alt).
3. **Alcance:** completo production-ready (visual + rendimiento + accesibilidad).

**Resultado buscado:** una galería curada, rápida, accesible y on-brand (monumental, precisa), donde el cliente administra qué se muestra desde el CMS, y donde cada imagen tiene metadatos reales. El volcado de 1.722 archivos queda como **biblioteca de medios** desde la que el cliente elige; ya no se publica automáticamente.

> Identidad de marca fijada: navy `#0F2433`, azul `#0065A9`, cian `#00A6D6`, Roboto Condensed (títulos) / Inter (cuerpo) / Roboto Mono (etiquetas), `border-radius: 0`. El rediseño respeta el sistema existente ([src/styles/tokens.css](src/styles/tokens.css), [src/styles/motion.css](src/styles/motion.css)).

---

## Arquitectura recomendada

Modelo de datos **dedicado** en el CMS (SQLite/Fastify), siguiendo el patrón existente de `repositories/controllers/services/validators`. Es más limpio que reusar el sistema genérico `content_entries/content_fields` (que solo soporta slots fijos `gallery1..3`) para N imágenes con orden, destacado y categoría CRUD.

**Flujo extremo a extremo:**
CMS overlay → API `/api/cms/gallery/*` → tablas SQLite → `cms:export` (con generación de derivados responsive vía `sharp`) → `src/data/gallery.json` → página `/galeria` lee el JSON y renderiza grilla + lightbox.

La galería deja de escanear `public/uploads/cms` en build.

---

## Fase 0 — Modelo de datos CMS

Archivo: [cms/db/schema.ts](cms/db/schema.ts) (añadir tablas; misma convención TEXT id/created_at/updated_at, FK con `ON DELETE`):

- `gallery_categories`: `id`, `name`, `slug` (único), `position` (INTEGER), `created_at`, `updated_at`.
- `gallery_items`: `id`, `media_id` (FK `media_assets`), `category_id` (FK `gallery_categories`, nullable, `ON DELETE SET NULL`), `title`, `alt` (fallback al alt del media), `caption` (opcional), `position` (INTEGER), `featured` (INTEGER 0/1), `status` (`published`/`draft`), `created_at`, `updated_at`.

**Seed inicial** (script `cms/scripts/seed-gallery.ts`, idempotente): crear las 4 categorías reales + "Otros" y poblar `gallery_items` desde las **23 curadas** mapeando con la lógica de `getCategory` actual, para que la galería no quede vacía tras el cambio. **No** importar las 1.722 (siguen como media library).

## Fase 1 — API CMS (CRUD + reorder)

- Nuevo `cms/repositories/GalleryRepository.ts` (patrón [cms/repositories/MediaRepository.ts](cms/repositories/MediaRepository.ts)): consultas de categorías e items con `JOIN media_assets` para resolver path/dimensiones/focal.
- Nuevo `cms/controllers/GalleryController.ts` (patrón [cms/controllers/MediaController.ts](cms/controllers/MediaController.ts)) + `cms/services/galleryService.ts`.
- Registrar rutas en [cms/routes/cmsRoutes.ts](cms/routes/cmsRoutes.ts) con `requireAuth` + `requireCsrf`:
  - `GET/POST /api/cms/gallery/categories`, `PATCH/DELETE /api/cms/gallery/categories/:id`, `POST /api/cms/gallery/categories/reorder`
  - `GET/POST /api/cms/gallery/items`, `PATCH/DELETE /api/cms/gallery/items/:id`, `POST /api/cms/gallery/items/reorder`
- Esquemas Zod en [cms/validators/cms.schema.ts](cms/validators/cms.schema.ts).
- Tests Vitest siguiendo `cms/test/*.test.ts`.

Subida de imágenes: **reutilizar** `POST /api/cms/media` existente; el item solo referencia `media_id`.

## Fase 2 — Export + imágenes responsive

- Extender [cms/services/exportService.ts](cms/services/exportService.ts) para escribir **`src/data/gallery.json`**: `{ categories: [...], items: [{ id, title, alt, caption, categorySlug, featured, position, src, width, height, focalX, focalY, srcset, lqip }] }`.
- **Generación de derivados con `sharp`** (ya es dependencia, `^0.33.5`) en un paso de export/`cms/services/imageService.ts`: por cada imagen de la galería (set chico, ~decenas) emitir WebP en 3 anchos (p. ej. 640/1024/1600) a `public/gallery/derived/`, más un LQIP base64 minúsculo. Guardar `srcset` + dimensiones en `gallery.json`. (Evita procesar las 1.722; solo las curadas/elegidas.)
- Enganchar en [cms/scripts/export.ts](cms/scripts/export.ts) / `npm run cms:export`.

## Fase 3 — Panel admin (overlay)

Archivo: [src/scripts/cms-overlay.js](src/scripts/cms-overlay.js) (vanilla JS, estilos inline; reutilizar el media picker/upload existente y el patrón de "Colecciones"):

- Nuevo botón **"Galería"** en la barra del CMS abriendo un panel con dos vistas:
  - **Categorías**: listar, crear (name→slug auto), renombrar, eliminar, reordenar (↑/↓).
  - **Imágenes**: subir (reusa upload→media), asignar título/categoría(select)/alt/`featured`, reordenar, eliminar. Vista de grilla con miniatura, categoría y badge "Destacada".
- Mensajes de éxito/error y refresco, igual que el editor actual.

## Fase 4 — Rediseño UI/UX de `/galeria`

Reescribir [src/pages/galeria/index.astro](src/pages/galeria/index.astro) para leer de un nuevo helper `src/data/gallery.ts` (patrón [src/data/cms.ts](src/data/cms.ts) / [src/data/project-galleries.ts](src/data/project-galleries.ts)). Extraer componentes `src/components/gallery/GalleryGrid.astro` y `src/components/gallery/Lightbox.astro`.

**Encuadre / espaciado**
- Alinear con el ritmo del sitio usando `Container` ([src/components/ui/Container.astro](src/components/ui/Container.astro)); reducir el whitespace muerto (`py-20 md:py-28` → `pt-12 md:pt-16`).
- Fila editorial sobre los filtros: contexto breve + **conteo** ("64 imágenes · 5 categorías") a un lado, control de filtros al otro (apilado en móvil).

**Filtros (control segmentado industrial)**
- Reemplazar pills grises por un segmented control conectado, radio 0, etiquetas en `font-mono` mayúsculas con **conteo por categoría**. Activo = relleno primario o regla cian inferior. Categorías **dinámicas desde el CMS**. Accesible (`aria-pressed`, navegación por teclado).

**Tarjetas (grilla)**
- Sustituir el bento **aleatorio** por **tamaños intencionales** según `featured` + `position` (destacadas 2×2 / 2×1; resto estándar) → ritmo diseñado, no recortes al azar.
- **Caption persistente** (no solo hover): scrim inferior siempre legible con categoría (micro-label cian mono) + título (Roboto Condensed). Hover profundiza scrim, hace zoom y revela "Ver en detalle". Arregla móvil.
- Tarjetas como `<button>` con `aria-label`, `:focus-visible` (anillo cian), activación Enter/Espacio.
- `<img>` responsive (`srcset`/`sizes`/`width`/`height`), `object-cover` + `object-position` desde el focal point. Radio 0, sombras de token.
- Entrada escalonada reutilizando `[data-reveal-group]` de [src/styles/motion.css](src/styles/motion.css) (con alternativa `prefers-reduced-motion`).

**Lightbox (premium + accesible)**
- Foco atrapado, mover foco al abrir, **restaurar al cerrar**, fondo `inert`/`aria-hidden`, bloquear scroll del body, diálogo etiquetado.
- Imagen mayor + panel de caption (título/categoría/descripción), contador, prev/next (mantener), teclado (mantener), **skeleton/spinner** mientras carga, **precarga de vecinos**, y servir el derivado grande (no el original de varios MB). Filmstrip opcional de miniaturas. Cross-fade respetando reduced-motion.

**Rendimiento / A11y**
- `width/height` para evitar CLS; `loading="lazy"` + `decoding="async"`; `fetchpriority="high"` en las 1-2 primeras; contraste de captions ≥4.5:1 (blanco sobre scrim oscuro).

## Fase 5 — Verificación

- **CMS API:** `npm run cms` + tests Vitest nuevos (CRUD categorías/items, reorder, validación Zod, borrado en cascada).
- **Flujo admin:** `npm run dev:cms`, abrir `?cms=1`, crear categoría, subir imagen, asignar metadatos, reordenar, exportar.
- **Export:** confirmar `src/data/gallery.json` + derivados en `public/gallery/derived/`.
- **Front-end:** `npm run dev`, revisar `/galeria` con Playwright/screenshots en breakpoints (móvil/tablet/desktop): grilla, filtros con conteo, captions persistentes, foco por teclado en tarjetas y lightbox, `prefers-reduced-motion`, sin CLS.
- **Build:** `npm run build` sin errores; verificar que ya **no** se escanean las 1.722.

---

## Archivos críticos

- Front-end: [src/pages/galeria/index.astro](src/pages/galeria/index.astro) (reescritura), nuevos `src/components/gallery/GalleryGrid.astro` + `Lightbox.astro`, nuevo `src/data/gallery.ts`.
- CMS backend: [cms/db/schema.ts](cms/db/schema.ts), nuevos `cms/repositories/GalleryRepository.ts` · `cms/controllers/GalleryController.ts` · `cms/services/galleryService.ts` · `cms/services/imageService.ts`, [cms/routes/cmsRoutes.ts](cms/routes/cmsRoutes.ts), [cms/validators/cms.schema.ts](cms/validators/cms.schema.ts), [cms/services/exportService.ts](cms/services/exportService.ts), `cms/scripts/seed-gallery.ts`.
- Admin: [src/scripts/cms-overlay.js](src/scripts/cms-overlay.js).
- Datos generados: `src/data/gallery.json`, `public/gallery/derived/*`.

## Fuera de alcance (salvo que se pida)

Galerías por proyecto/servicio (ya tienen su propio sistema de slots fijos), paginación del media picker para las 1.722 (mejora futura), e i18n (sitio solo en español).
