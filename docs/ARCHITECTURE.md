# Arquitectura

> Documentación técnica de la arquitectura del proyecto Hidromont Chile.
> Para instalación y comandos, ver [`README.md`](../README.md). Para el flujo de edición de contenido, ver [`CMS-GUIDE.md`](./CMS-GUIDE.md).

## Visión general

El proyecto tiene **dos dominios desacoplados** que comparten un mismo repositorio:

```
┌─────────────────────────────────────────────────────────────────┐
│  src/  —  Sitio público estático (Astro)                        │
│  • Páginas, layouts, componentes, content collections           │
│  • Datos exportados por el CMS (cms-content.json, gallery.json) │
│  • Build → dist/ → Cloudflare Pages                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │ export (escribe JSON + .md)
┌──────────────────────────┴──────────────────────────────────────┐
│  cms/  —  Backend del CMS (Fastify + SQLite)                    │
│  • API REST en :8787 (local/LAN, nunca en producción)           │
│  • Overlay visual inyectado en dev (PUBLIC_ENABLE_CMS=1)        │
│  • Export → escribe en src/data/ y src/content/                 │
└─────────────────────────────────────────────────────────────────┘
```

**Principio clave:** el sitio público es 100% estático y **no depende del CMS en runtime**. El CMS sólo corre cuando se edita contenido (local/LAN); su output son archivos JSON + Markdown que Astro consume en build time. Esto garantiza que el sitio sea ultrarrápido y que el CMS nunca sea un vector de ataque público.

## Sitio público (`src/`)

### Estructura

```
src/
├── components/
│   ├── ui/            # Button, Container, Section, PageHero, Eyebrow, Badge, ArrowIcon, CTASection
│   ├── home/          # Hero, CapabilitiesBlock, ClientsStrip
│   ├── services/      # ServiceCard
│   ├── projects/      # ProjectCard, ProjectTable, ProjectFilters
│   ├── gallery/       # GalleryGrid, Lightbox
│   ├── contact/       # ContactForm, ContactInfo
│   ├── clientes/      # ClientesHero
│   ├── layout/        # Header, Footer
│   └── cms/           # EditableText, EditableImage, CmsOverlay (solo si PUBLIC_ENABLE_CMS=1)
├── content/           # Content collections (Astro)
│   ├── config.ts      # Schemas Zod: proyectos, servicios, clientes
│   ├── proyectos/     # 40 .md (7 destacados + 33 banco)
│   ├── servicios/     # 8 .md
│   └── clientes/      # clientes.json (18 items)
├── data/              # Datos estáticos con fallbacks CMS
│   ├── cms.ts         # getCmsText/getCmsNumber/getCmsImage helpers
│   ├── cms-content.json  # Snapshot exportado por el CMS
│   ├── gallery.json   # Items + categorías de galería exportados
│   ├── gallery.ts     # Interfaces TS + getters
│   ├── nav.ts         # Navegación (hrefs validados vía safeHref)
│   ├── company.ts     # Datos de empresa con fallbacks
│   ├── cliente-logos.ts  # Helper que deriva logos de clientes.json
│   ├── categories.ts  # Labels de categorías de proyectos
│   └── project-images.ts, service-images.ts  # Imágenes curadas por slug
├── layouts/
│   ├── BaseLayout.astro   # <head>, SEO, fonts, JSON-LD, CmsOverlay
│   └── PageLayout.astro   # Header + <main> + Footer + motion.ts + skip-link
├── pages/
│   ├── index.astro, empresa.astro, contacto.astro, clientes.astro, 404.astro
│   ├── contacto/gracias.astro
│   ├── servicios/index.astro, servicios/[slug].astro
│   ├── proyectos/index.astro, proyectos/[slug].astro
│   └── galeria/index.astro
├── scripts/
│   ├── motion.ts      # Scroll reveals, parallax, counters (respeta prefers-reduced-motion)
│   └── cms-overlay.js # 1767 líneas, solo se emite si PUBLIC_ENABLE_CMS=1
└── styles/
    ├── tokens.css     # Design tokens (colores, tipografía, spacing, radius, shadows, z-index, motion)
    ├── base.css       # Reset, @font-face, utilidades, animaciones globales
    ├── motion.css     # Reveals, cinematic clip-path, parallax
    └── global.css     # Import cascade
```

### Content Collections

Tres colecciones definidas en `src/content/config.ts`:

| Colección   | Tipo            | Schema                                                                                                                                          | Cantidad                     |
| ----------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `proyectos` | content (`.md`) | `nombre`, `alcance`, `categoria` (enum), `tipo` (destacado/banco, default banco), `orden` (default 100), `heroImage`, `gallery`, specs técnicas | 40 (7 destacados + 33 banco) |
| `servicios` | content (`.md`) | `titulo`, `resumen`, `icono`, `orden` (default 100), `heroImage`, `tipos`, `aplicaciones`, `normas`, `procesos`                                 | 8                            |
| `clientes`  | data (`.json`)  | `items: [{ nombre, sector (enum), logo }]`                                                                                                      | 18                           |

**Categorías de proyecto** (enum `categoria`): `tuberias`, `compuertas`, `electromecanicos`, `limpiarrejas`, `estructuras`.

**Sectores de cliente** (enum `sector`): `electrica` (10), `construccion` (5), `industrial` (2), `publica` (1).

### Capa de datos con fallbacks CMS

Los componentes consumen datos vía helpers en `src/data/cms.ts`:

```typescript
getCmsText('empresa.hero', 'title', 'Empresa'); // string
getCmsNumber('empresa.metricas', 'card1Value', 1983); // number
getCmsImage('home.hero', fallbackImageData); // {src, alt, width, height}
getCmsValue<string[]>('contact.form', 'services', defaults); // genérico
```

Cada helper lee de `cms-content.json` (el snapshot exportado por el CMS) y cae a un fallback hardcodeado si la clave falta o está vacía. En desarrollo (`import.meta.env.DEV`), emite un `console.warn` deduplicado por clave faltante para que el operador detecte stale values.

## Backend CMS (`cms/`)

### Arquitectura en capas

```
┌─────────────────────────────────────────────────────────────┐
│  Routes (cms/routes/cmsRoutes.ts)                           │
│  Único punto de cableado. 42 endpoints bajo /api/cms/*.     │
│  preHandler: [requireAuth, requireCsrf] en todas las mut.   │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────────────┐
│  Controllers (cms/controllers/)                              │
│  Parseo/validación de request, forma de la respuesta.       │
│  Heredan de BaseController (manejo uniforme de errores).    │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────────────┐
│  Services (cms/services/)                                    │
│  Lógica de negocio: authService, contentService, mediaService,│
│  galleryService, exportService, publishService, backupService,│
│  imageService.                                               │
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────────────┐
│  Repositories (cms/repositories/)                            │
│  Acceso a SQLite con sentencias preparadas (sin SQLi).      │
│  User, Content, Media, Gallery, PublishJob, Audit, RateLimit.│
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────┴──────────────────────────────────────────────┐
│  DB (cms/db/)                                                │
│  connection.ts: better-sqlite3, WAL, foreign_keys=ON.        │
│  schema.ts: 13 tablas + 3 migraciones idempotentes.          │
└─────────────────────────────────────────────────────────────┘
```

### Base de datos (SQLite)

13 tablas en `cms/data/hidromont-cms.sqlite`:

| Tabla                | Propósito                                                   | FKs                                         |
| -------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| `users`              | Admin del CMS (1 fila típicamente)                          | —                                           |
| `sessions`           | Sesiones con CSRF token                                     | `user_id` → users CASCADE                   |
| `content_entries`    | Entradas (page/layout/component/settings/servicio/proyecto) | —                                           |
| `content_fields`     | Campos key-value de cada entrada                            | `entry_id` → content_entries CASCADE        |
| `media_assets`       | Imágenes (uploads + sync de public/)                        | —                                           |
| `media_usages`       | Referencias media↔entrada                                   | `media_id` CASCADE, `entry_id` CASCADE      |
| `revisions`          | Snapshots de versiones anteriores                           | `entry_id` CASCADE                          |
| `publish_jobs`       | Jobs de export/publish con tracking                         | —                                           |
| `audit_events`       | Log de acciones sensibles                                   | —                                           |
| `login_attempts`     | Rate limiting por IP                                        | —                                           |
| `gallery_categories` | Categorías de galería                                       | —                                           |
| `gallery_albums`     | Álbumes de galería (una obra); clave = slug                 | —                                           |
| `gallery_items`      | Items de galería                                            | `media_id` SET NULL, `category_id` SET NULL |

**Migraciones idempotentes** (corren en cada arranque, no dañan si ya están aplicadas):

- `migrateGalleryItemsOnDeleteSetNull` — FK `media_id` de CASCADE → SET NULL (preserva items al borrar media).
- `migratePublishJobsUpdatedAt` — añade columna `updated_at` (para reap de jobs stale).
- `migratePublishJobsAction` — añade columna `action` (publish/export, antes embebida en JSON de logs).

### API REST (42 endpoints)

A = `requireAuth`, C = `requireCsrf`. Ver [`CMS-GUIDE.md`](./CMS-GUIDE.md) para el flujo de uso.

| Dominio        | Endpoints                                                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Health/Auth    | `GET /health`, `POST /login` (rate-limited), `POST /logout` (A+C), `GET /session`, `GET /manifest` (A)                                                             |
| Entries        | `GET /entries` (A), `POST /entries` (A+C), `GET /entries/:id` (A), `PATCH /entries/:id` (A+C), `PATCH /entries/:id/fields/:key` (A+C), `DELETE /entries/:id` (A+C) |
| Media          | `GET /media` (A), `GET /media/:id` (A), `POST /media` (A+C), `PATCH /media/:id` (A+C), `DELETE /media/:id` (A+C)                                                   |
| Publish        | `POST /export` (A+C), `POST /publish` (A+C), `GET /publish/jobs` (A), `GET /publish/jobs/:id` (A)                                                                  |
| Revisions      | `GET /revisions/:entryId` (A), `POST /revisions/:entryId/restore/:revisionId` (A+C)                                                                                |
| Backup         | `POST /backup` (A+C), `GET /backup/list` (A)                                                                                                                       |
| Gallery albums | `GET/POST /gallery/albums` (A / A+C), `PATCH/DELETE /gallery/albums/:slug` (A+C), `POST /gallery/albums/reorder` (A+C)                                             |
| Gallery cats   | `GET/POST /gallery/categories` (A / A+C), `PATCH/DELETE /gallery/categories/:id` (A+C), `POST /gallery/categories/reorder` (A+C)                                   |
| Gallery items  | `GET/POST /gallery/items` (A / A+C), `GET/PATCH/DELETE /gallery/items/:id` (A / A+C), `POST /gallery/items/reorder` (A+C)                                          |
| Schema/Audit   | `GET /schema` (A), `GET /audit` (A)                                                                                                                                |

## Flujo de datos CMS → sitio

```
1. EDICIÓN
   Overlay visual (dev) ──PATCH──► API /entries/:id/fields/:key ──► SQLite

2. EXPORTACIÓN ("Exportar y validar")
   POST /export ──► exportService.escribe:
     • src/data/cms-content.json   (entries page/layout/component/settings)
     • src/data/gallery.json       (items + categorías + derivadas de imagen)
     • src/content/servicios/*.md  (entradas servicio, version > 1)
     • src/content/proyectos/*.md  (entradas proyecto, version > 1)
   Escritura atómica (.tmp + rename) con mkdir recursivo (slugs con subdirectorio).

3. PUBLICACIÓN ("Publicar")
   POST /publish ──► export + npm run build ──► job tracking (running→succeeded/failed)

4. DESPLIEGUE
   Manual: dist/ → Cloudflare Pages. El CMS no deploya.
```

## Testing

| Tipo            | Tool       | Cantidad              | Ubicación                 |
| --------------- | ---------- | --------------------- | ------------------------- |
| Unitarios       | Vitest     | 78 tests (7 archivos) | `cms/test/`               |
| E2E build-gate  | Playwright | 4 tests               | `e2e/build-gate.spec.ts`  |
| E2E overlay+API | Playwright | 20 tests              | `e2e/cms-overlay.spec.ts` |

CI (`.github/workflows/ci.yml`) ejecuta en cada PR: `lint` → `build` → `test` → `build-gate` → (job separado) `e2e-full` con servidores levantados.

## Decisiones arquitectónicas clave

1. **Sitio estático, CMS local.** El sitio público nunca depende del CMS en runtime. El CMS es una herramienta de edición offline cuyo output son archivos versionados.
2. **SQLite, no Postgres.** Suficiente para un solo operador editando contenido; WAL + foreign_keys ON; migraciones idempotentes. Backup trivial (copiar el .sqlite).
3. **Overlay condicional.** `PUBLIC_ENABLE_CMS=0` (producción) garantiza que `dist/` no contenga el editor. El CI lo verifica con `e2e/build-gate.spec.ts`.
4. **Validación Zod en todos los endpoints.** Slugs con regex estricto, IDs sin barras, reject de `..` (anti path traversal en export).
5. **Fallbacks CMS con dev-warn.** Los componentes nunca crashean si una clave CMS falta; caen al fallback y avisan en dev.
6. **Escritura atómica + mkdir recursivo.** Export nunca deja archivos truncados ni falla con slugs de subdirectorio.

## Referencias

- [`README.md`](../README.md) — instalación, comandos, deploy.
- [`CMS-GUIDE.md`](./CMS-GUIDE.md) — flujo de edición de contenido.
- [`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) — tokens, componentes, excepciones.
- [`SECURITY.md`](./SECURITY.md) — modelo de amenazas, hardening.
- [`AUDITORIA_LOGICA_UIUX.md`](./AUDITORIA_LOGICA_UIUX.md) — auditoría técnica + registro de remediación.
