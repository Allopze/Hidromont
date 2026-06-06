# Plan: CMS Visual Inline para Hidromont Chile

## Summary
- Construir un CMS local/LAN con login de un admin, persistencia en SQLite y edición visual sobre la página renderizada.
- Mantener el sitio público como Astro estático; el CMS corre como servidor separado porque `output: static` no puede alojar APIs de escritura.
- Fase 1 permite editar textos e imágenes existentes haciendo click sobre el elemento; fases posteriores agregan creación de páginas, secciones y flujos editoriales.
- El contenido actual está mezclado entre `.astro`, `src/content`, `src/data` e imágenes públicas; primero se creará un registro editable con IDs estables para no editar markup a ciegas.

## Key Changes
- Añadir un servidor CMS local en `cms/` con Fastify + SQLite:
  - `npm run cms`: levanta API/admin.
  - `npm run dev:cms`: levanta Astro + CMS para edición visual desde LAN.
  - `npm run cms:import`: importa contenido actual a SQLite.
  - `npm run cms:export`: exporta desde SQLite a archivos consumidos por Astro.
  - Dependencias necesarias: `fastify`, `@fastify/cookie`, `@fastify/multipart`, `better-sqlite3`, `bcryptjs`, `nanoid`, `gray-matter`, `sharp`, `@astrojs/react`, `react`, `react-dom`, `@phosphor-icons/react`, `tsx`.
- Mantener Astro estático:
  - La DB será la fuente editorial.
  - Astro seguirá leyendo Markdown/JSON/TS generado o normalizado desde la DB.
  - El build público no incluirá overlay, rutas admin ni scripts CMS.
- Crear una capa de contenido editable:
  - Migrar textos hardcodeados de `src/pages/index.astro`, `empresa.astro`, `calidad.astro`, `contacto.astro`, `servicios/index.astro`, `proyectos/index.astro`, `Footer.astro`, `ClientsStrip.astro` y `ContactForm.astro` hacia entradas CMS.
  - Mantener `src/content/servicios`, `src/content/proyectos` y `src/content/clientes/clientes.json` como superficies exportables.
  - Reemplazar mapas de imágenes hardcodeados como `serviceImages` y `projectImages` por registros CMS exportados.
- Marcar elementos editables con wrappers:
  - `EditableText.astro`: renderiza texto con `data-cms-entry`, `data-cms-field`, `data-cms-type`.
  - `EditableImage.astro`: renderiza imagen con `data-cms-entry`, `data-cms-field`, `data-cms-alt-field`, foco/crop y fallback.
  - Estos atributos solo se activan en modo CMS/dev para no ensuciar producción.
- Crear el editor visual:
  - Overlay flotante sobrio, no invasivo, con paleta Hidromont, bordes técnicos y sin estética genérica de dashboard.
  - Click en texto: abre panel lateral con input, textarea o editor rich text según tipo.
  - Click en imagen: abre selector de medios con subir imagen, elegir existente, editar alt, foco visual y previsualización.
  - Estados obligatorios: cargando, guardando, error, conflicto, vacío, cambios sin publicar y publicado.
  - Accesibilidad: navegación por teclado, foco visible, Escape para cerrar, labels sobre campos, errores bajo inputs.
- Seguridad fase 1:
  - Login único de admin con hash de contraseña.
  - Cookie `HttpOnly`, `SameSite=Lax`, expiración configurable.
  - CSRF token para mutaciones.
  - API solo acepta LAN/local por defecto y CORS restringido al origen de Astro.
  - Uploads limitados por MIME/tamaño, nombres sanitizados, rechazo de path traversal.

## Interfaces y Modelo
- SQLite inicial:
  - `users`: admin único, email, password hash, timestamps.
  - `content_entries`: `id`, `kind`, `slug`, `locale`, `title`, `status`, `version`, timestamps.
  - `content_fields`: `entry_id`, `key`, `type`, `value_json`, `source_ref_json`, `updated_at`.
  - `media_assets`: nombre, path, mime, width, height, size, alt, focal point, checksum.
  - `revisions`: snapshots por entrada para historial y rollback.
  - `publish_jobs`: estado, logs y fecha de export/build.
- Tipos de campo v1:
  - `text`, `textarea`, `richtext`, `image`, `link`, `number`, `list`, `object`.
- API CMS:
  - `POST /api/cms/login`, `POST /api/cms/logout`, `GET /api/cms/session`.
  - `GET /api/cms/manifest?path=/ruta`: devuelve elementos editables de la página.
  - `GET /api/cms/entries/:id`, `PATCH /api/cms/entries/:id/fields/:key`.
  - `POST /api/cms/media`, `GET /api/cms/media`, `PATCH /api/cms/media/:id`.
  - `POST /api/cms/export`: escribe Markdown/JSON/TS generados para Astro.
  - `POST /api/cms/publish`: exporta, ejecuta validación y deja el sitio listo para build/deploy.
- Flujo de edición:
  - Admin abre `http://IP_LOCAL:4321?cms=1`.
  - Overlay valida sesión contra `http://IP_LOCAL:8787`.
  - Al hacer click, el editor lee el campo por ID estable.
  - Guardar actualiza SQLite y refresca visualmente el elemento.
  - Publicar ejecuta exportación y luego `npm run check`/build según configuración.

## Fases
- Fase 0: Auditoría y normalización
  - Crear inventario completo de campos editables por página.
  - Dar IDs estables tipo `home.hero.title`, `home.installations.image`, `services.index.hero.title`.
  - Importar contenido actual a SQLite sin cambiar todavía el diseño público.
- Fase 1: MVP visual de textos e imágenes
  - Cubrir Home, Empresa, Servicios index, Proyectos index, Contacto, Footer, Clientes y páginas detalle.
  - Permitir editar títulos, bajadas, CTAs, listas simples, cards, datos de contacto, logos e imágenes hero/curadas.
  - Exportar contenido a los formatos actuales para que Astro siga construyendo igual.
- Fase 2: Colecciones completas
  - CRUD visual para servicios, proyectos y clientes.
  - Edición de frontmatter, cuerpo Markdown, galerías, orden, categoría, destacados y SEO.
  - Historial, rollback y vista previa antes de publicar.
- Fase 3: Constructor de secciones
  - Modelar secciones reutilizables: hero, texto+imagen, métricas, lista técnica, galería, CTA, tabla de proyectos.
  - Permitir añadir, reordenar, duplicar y ocultar secciones en páginas existentes.
  - Validar que cada sección tenga schema, defaults y preview visual.
- Fase 4: Nuevas páginas
  - Crear páginas desde plantillas aprobadas.
  - Gestionar slug, SEO, navegación, sitemap y redirects.
  - Agregar flujo de borrador/publicado y opción futura de roles editor/revisor/admin.
- Fase 5: Producción online opcional
  - Migrar SQLite a Postgres si el CMS debe operar desde internet.
  - Agregar deployment hook, backups automáticos, auditoría avanzada y monitoreo.

## Test Plan
- Unit tests:
  - Import/export de Markdown frontmatter, JSON de clientes y data modules.
  - Validación de schemas Zod contra los datos exportados.
  - Sanitización de uploads, slugs, paths y rich text.
- API tests:
  - Login/logout/session, CSRF, rechazo sin auth, edición de campos, subida de medios, export y errores.
- E2E con Playwright:
  - Admin inicia sesión, edita hero title, cambia imagen, guarda, recarga y ve cambios.
  - Edita un servicio Markdown y confirma que la página detalle renderiza contenido actualizado.
  - Sube imagen inválida y recibe error claro.
  - Publica y verifica que el overlay no aparece en build público.
- Verificación visual:
  - Desktop y mobile para overlay, panel lateral, media picker y estados vacíos/error.
  - Confirmar que textos largos no rompen botones, cards, headers ni hero.
- Build gates:
  - `npm run check`.
  - `npm run build`.
  - Revisión de que `dist/` no contiene endpoints CMS ni secretos.

## Assumptions
- CMS fase 1 corre local/LAN, no público en internet.
- Persistencia elegida: base de datos; se usará SQLite por ser local, portable y suficiente para un admin.
- Acceso elegido: un único admin.
- El sitio público seguirá siendo estático y rápido.
- Idioma inicial: español de Chile solamente.
- No se implementan roles, aprobación editorial ni creación libre de componentes en fase 1.
- El diseño del CMS seguirá la identidad Hidromont: sobrio, industrial, claro, sin gradientes morados, sin emojis y sin panel genérico de tarjetas excesivas.
