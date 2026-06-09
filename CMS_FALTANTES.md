# CMS Faltantes

Este documento resume lo que falta para completar el CMS visual inline de Hidromont Chile según `PLAN.md` y el estado actual del código.

## Estado Actual

Implementado:

- Servidor CMS local en `cms/` con Fastify, SQLite, cookies, CSRF y capas separadas.
- Scripts `npm run cms`, `npm run dev:cms`, `npm run cms:import`, `npm run cms:export` y `npm run cms:backup`.
- Importación inicial de páginas base, servicios y proyectos hacia SQLite.
- `importMissingEntries()` al iniciar el servidor: importa entradas nuevas sin sobreescribir ediciones existentes.
- Exportación de contenido editable de páginas hacia `src/data/cms-content.json`.
- Exportación de colecciones Markdown solo cuando una entrada importada cambia de versión.
- Overlay visual activado en dev con `?cms=1`.
- Edición click-to-edit de textos e imágenes en: Home, héroes de todas las páginas index, Footer, Clientes strip, Contacto.
- **Empresa.astro**: historia, métricas, ubicación, instalaciones (4 items), maquinaria (12 items), medios de obra (7 items) y CTA — todos editables.
- **Calidad.astro**: contenido ISO, badge, principios (4 items) y CTA — todos editables.
- **Servicios/index.astro**: metodología (6 items) y CTA — todos editables.
- **Proyectos/index.astro**: destacados heading, banco heading/intro y CTA — todos editables.
- **Clientes.astro**: hero con cmsEntry, sectores heading y CTA — todos editables.
- Datos corporativos `site.company` exportados al sitio y reutilizados por `company.ts`.
- Navegación/Header exportados como `layout.header`, con labels principales editables desde el overlay.
- Contacto cubierto: `ContactForm`, `ContactInfo`, encabezados de `contacto.astro` y `contacto/gracias`.
- Imágenes hero de páginas detalle de servicios/proyectos exportadas como entradas `service-image.*` y `project-image.*`.
- `src/data/service-images.ts` y `src/data/project-images.ts` consumen `src/data/cms-content.json` con fallbacks.
- Upload de medios con validación básica de MIME, tamaño, nombre seguro y metadata.
- Media picker básico en el overlay: galería de medios existentes, búsqueda local, preview, selección sin escribir ruta manual y persistencia de `alt`/foco.
- Sincronización inicial de assets existentes en `public/fotos`, `public/logos-clientes` y `public/uploads/cms` hacia `media_assets` al iniciar el CMS.
- `publish_jobs` registra exportaciones/publicaciones con estado, logs, timestamps y resultado.
- API de historial de publicación: `GET /api/cms/publish/jobs` y `GET /api/cms/publish/jobs/:id`.
- **API de revisiones**: `GET /api/cms/revisions/:entryId` y `POST /api/cms/revisions/:entryId/restore/:revisionId`.
- Tabla `revisions` en SQLite con snapshots automáticos por versión.
- Rate limiting en login: máximo 10 intentos/60 segundos por IP (en memoria).
- Cabeceras de seguridad básicas: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`.
- Advertencia en stderr si se usa la contraseña por defecto fuera de localhost.
- Script `npm run cms:backup` — copia timestamped de la DB en `cms/data/backups/`.
- Overlay con vista básica de historial de exportaciones/publicaciones y logs resumidos.
- `npm run check` pasa con 0 errores, 0 warnings y 0 hints (75 archivos).
- `npm run build` pasa correctamente.
- Build público sin atributos `data-cms-*` ni script del overlay.

Pendiente crítico:

- Construir UI de administración para colecciones (servicios, proyectos, clientes) sin tocar archivos.
- Agregar tests automatizados (unitarios, API, E2E).
- Endurecer seguridad adicional: auditoría, SVG sanitización, rate limiting persistente.
- Editor de campos complejos: richtext real, list con UI drag-and-drop, gallery.

## Prioridad Alta

### 1. Cobertura completa de campos editables

✅ Completado en esta iteración:
- `empresa.astro`: historia (3 párrafos), métricas (4 cards), ubicación, instalaciones (4 items), maquinaria (12 items), medios de obra (7 items), CTA.
- `calidad.astro`: contenido ISO (2 párrafos), badge, principios (4 items con título/descripción), CTA.
- `servicios/index.astro`: metodología (6 items con título/descripción), CTA.
- `proyectos/index.astro`: destacados heading, banco heading/intro, CTA.
- `clientes.astro`: hero con `cmsEntry="clientes.hero"`, sectores heading, CTA.

Pendiente parcial:

- `Header.astro`: ya tiene labels/wordmark/CTA editables; falta edición visual del logo como media y links/hrefs desde UI.
- `ContactForm.astro`: ya tiene labels, placeholders, opciones, errores y CTA editables; falta UI para editar listas de opciones sin tocar JSON.
- Páginas detalle de servicios y proyectos: frontmatter, cuerpo Markdown, sidebars, CTA y datos técnicos (siguen en colecciones Markdown).
- `src/data/nav.ts`: ya lee labels desde `layout.header`; falta CRUD/reordenamiento de navegación y edición de hrefs.

Criterio de aceptación:

- ✅ Cada texto o imagen visible importante tiene `entryId` estable y campo editable.
- ✅ El build público mantiene HTML limpio sin atributos CMS.
- ✅ `cms:export` regenera los archivos consumidos por Astro sin ruido de formato cuando no hay cambios.

### 2. Imágenes curadas y mapas hardcodeados

Avance implementado:

- `serviceImages` ya no vive en `src/pages/servicios/[slug].astro`; ahora se consume desde `src/data/service-images.ts`.
- `projectImages` ahora se hidrata desde entradas CMS `project-image.*`.
- Imágenes hero y alt text de servicios/proyectos destacados se leen desde `src/data/cms-content.json`.
- Las imágenes hero de detalle tienen `entryId` estable y son editables con `EditableImage`.

Falta:

- Galerías de servicios/proyectos.
- Logos de clientes en `src/content/clientes/clientes.json`.
- Relación formal `media_usages` para saber dónde se usa cada asset.
- Recomendaciones/validación visual de dimensiones por campo.
- Detección de imágenes sin uso.

Criterio de aceptación:

- Las imágenes de detalle se editan desde el CMS.
- La DB guarda `src`, `alt`, dimensiones, foco y referencia de media.
- Astro consume `cms-content.json`; los mapas TypeScript solo mantienen fallbacks.

### 3. Editor de medios real

El overlay actual permite subir una imagen desde el campo seleccionado y ya tiene un media picker básico:

- Galería de medios existentes desde `GET /api/cms/media`.
- Búsqueda local por nombre, alt, ruta o MIME.
- Previsualización del asset seleccionado.
- Selección de medio existente sin escribir rutas manualmente.
- Edición de alt text y punto focal persistida en `media_assets`.
- Reemplazo de imagen por upload o por asset existente.

Falta evolucionarlo a un gestor de medios completo:

- Filtros avanzados por fecha, tipo y uso.
- Detección de imágenes sin uso.
- Validación visual de dimensiones recomendadas por tipo de campo.
- Paginación o virtualización si el catálogo crece mucho.
- Vista de usos por asset cuando exista `media_usages`.

Criterio de aceptación:

- El editor puede subir, seleccionar, reutilizar y actualizar medios sin escribir rutas manuales.
- Los metadatos quedan persistidos en `media_assets`.

### 4. Estados editoriales y publicación

Avance implementado:

- `POST /api/cms/export` crea un job `export` con archivos exportados y logs.
- `POST /api/cms/publish` crea un job `publish`, exporta contenido, ejecuta el check configurado y guarda stdout/stderr resumido.
- `GET /api/cms/publish/jobs` lista el historial reciente.
- `GET /api/cms/publish/jobs/:id` entrega detalle y logs.
- El overlay tiene botón de historial y muestra los últimos logs de cada job.
- ✅ `GET /api/cms/revisions/:entryId` — lista revisiones de una entrada.
- ✅ `POST /api/cms/revisions/:entryId/restore/:revisionId` — restaura a una revisión anterior.

Falta completar el flujo editorial usable:

- Estados claros: borrador, cambios sin publicar, publicado, error de exportación y conflicto.
- Separación entre guardar en SQLite y publicar a archivos.
- Confirmación antes de publicar.
- Bloqueo o aviso si hay cambios no exportados.
- UI en el overlay para seleccionar y restaurar revisiones.

Criterio de aceptación:

- Un admin entiende qué está guardado, qué está exportado y qué está publicado.
- Cada publish deja job, logs y resultado.
- Una revisión puede restaurarse desde UI/API.

### 5. Tests automatizados

Actualmente la validación principal es manual con `npm run check`, `npm run build` y pruebas `curl`. Falta suite automatizada:

- Unit tests de `ContentService`, `ExportService`, `MediaService` y auth.
- Tests de repositorios con SQLite temporal.
- API tests para login/logout/session, CSRF, permisos, manifest, edición, media, export y publish.
- Tests de import/export de Markdown, JSON de clientes y data modules.
- Tests de sanitización de uploads, paths, MIME y tamaños.
- E2E con Playwright para flujo visual: login, click en campo, guardar, exportar, recargar y verificar.
- Test de build público sin `data-cms-*`, overlay, endpoints ni secretos.

Criterio de aceptación:

- `npm test` o scripts equivalentes corren localmente.
- Los casos críticos del plan están cubiertos.
- CI/build puede bloquear regresiones.

## Prioridad Media

### 6. CRUD visual de colecciones

Falta UI para administrar colecciones completas:

- Servicios: crear, editar, ordenar, ocultar, destacar, cambiar slug y editar cuerpo Markdown.
- Proyectos: crear, editar, ordenar, categoría, cliente, alcance, datos técnicos, tipo destacado/banco, SEO y cuerpo.
- Clientes: crear, editar, sector, logo, orden y eliminación segura.
- Validación por schema antes de guardar/exportar.
- Vista previa de detalle antes de publicar.

Criterio de aceptación:

- Un admin puede mantener servicios, proyectos y clientes sin tocar archivos.
- Las colecciones exportadas pasan `astro check`.

### 7. Editor de campos complejos

El overlay actual resuelve `text`, `textarea` e `image` de forma básica. Faltan controles adecuados para:

- `richtext`: editor Markdown o rich text con preview.
- `list`: añadir, ordenar, borrar y editar ítems.
- `object`: formularios anidados por schema.
- `number`: input numérico con restricciones.
- `link`: label, href, target y validación.
- Galerías: múltiples imágenes ordenables.
- CTAs: texto, URL, variante visual y visibilidad.

Criterio de aceptación:

- Cada tipo de campo tiene control específico y validación clara.
- No se requiere editar JSON manualmente desde el panel.

### 8. Inventario editorial formal

Falta un inventario completo de IDs estables por página y componente:

- Tabla `entryId.field`.
- Tipo de campo.
- Ubicación visual.
- Archivo fuente original.
- Archivo exportado destino.
- Estado de cobertura: implementado, parcial o pendiente.

Criterio de aceptación:

- Se puede auditar qué contenido es editable y qué no.
- Nuevos cambios usan IDs consistentes sin duplicados.

### 9. Seguridad adicional

✅ Implementado en esta iteración:
- Advertencia en stderr al arrancar si la contraseña es la por defecto y el host no es localhost.
- Rate limiting en login: 10 intentos/60s por IP (en memoria; se reinicia al reapagar el servidor).
- Cabeceras de seguridad básicas: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`.

Falta:

- Cambiar credenciales por defecto obligatoriamente en primer arranque (formulario de setup).
- Rate limiting persistente (Redis o archivo) para sobrevivir reinicios.
- SameSite/Secure cookie configurable para escenarios HTTPS.
- Auditoría de acciones: tabla `audit_events` con usuario, acción, entry, field, antes/después, IP y timestamp.
- Escaneo de SVG o política de bloqueo de SVG (sin SVGO/DOMPurify).
- Protección contra archivos duplicados o payloads con extensión falsa.

Criterio de aceptación:

- El CMS puede usarse en LAN sin credenciales débiles ni uploads peligrosos.
- Cada mutación queda auditable.

### 10. Observabilidad operacional

Falta observabilidad más allá de logs Fastify y Sentry opcional:

- Request IDs/correlation IDs visibles en errores.
- Logs estructurados por acción editorial.
- Métricas básicas: logins, saves, uploads, exports, publish failures.
- Endpoint health profundo: DB, permisos de escritura, directorios, versión.
- Runbook de errores comunes.

Criterio de aceptación:

- Ante un fallo de publish/upload/export hay logs útiles para diagnosticar.

### 11. Backups y recuperación

✅ Completado parcialmente:
- `npm run cms:backup` — copia timestamped en `cms/data/backups/hidromont-cms-TIMESTAMP.sqlite`.

Falta:
- Export completo a JSON portable.
- Restore validado (comando `cms:restore`).
- Backup automático antes de publish y antes de migraciones.
- Documentación de dónde vive la DB y qué copiar.

Criterio de aceptación:

- Se puede restaurar contenido desde backup sin tocar internals de SQLite.

## Prioridad Baja / Fases Futuras

### 12. Constructor de secciones

Falta Fase 3 completa:

- Modelar secciones reutilizables: hero, texto+imagen, métricas, lista técnica, galería, CTA y tabla.
- Añadir, duplicar, ocultar, eliminar y reordenar secciones.
- Schemas por tipo de sección.
- Defaults seguros y preview visual.
- Restricciones para mantener diseño Hidromont.

### 13. Nuevas páginas

Falta Fase 4:

- Crear páginas desde plantillas aprobadas.
- Gestionar slug, SEO, navegación, sitemap y redirects.
- Estados borrador/publicado.
- Eliminación segura con redirects opcionales.

### 14. Roles y flujo editorial

Falta soporte multiusuario:

- Roles editor, revisor y admin.
- Permisos por acción.
- Revisión/aprobación antes de publish.
- Comentarios editoriales.
- Bloqueo de edición concurrente.

### 15. Producción online opcional

Si el CMS sale de LAN/local, falta Fase 5:

- Migrar SQLite a Postgres.
- Autenticación más robusta.
- HTTPS obligatorio.
- Backups automáticos.
- Deployment hooks.
- Monitoreo/alertas.
- Rate limiting distribuido.
- Política formal de secretos.

## API Faltante

Endpoints por agregar o completar:

- `GET /api/cms/entries`: listado paginado y filtrable.
- `POST /api/cms/entries`: crear entrada.
- `PATCH /api/cms/entries/:id`: actualizar metadata, slug, status y title.
- `DELETE /api/cms/entries/:id`: eliminación segura o soft delete.
- ✅ `GET /api/cms/revisions/:entryId`: historial de revisiones.
- ✅ `POST /api/cms/revisions/:entryId/restore/:revisionId`: rollback a revisión anterior.
- `POST /api/cms/preview`: export temporal o snapshot preview.
- `POST /api/cms/backup`: crear backup vía API (el script `cms:backup` ya existe).
- `POST /api/cms/restore`: restaurar backup.
- `DELETE /api/cms/media/:id`: eliminar asset de medios.
- `GET /api/cms/schema`: schemas de campos/secciones para UI dinámica.

## Modelo de Datos Faltante

Tablas o campos a considerar:

- `audit_events`: trazabilidad de cambios.
- `entry_locks`: prevención de edición concurrente.
- `content_schemas`: schemas versionados por tipo de entrada.
- `redirects`: redirects al cambiar slugs.
- `settings`: configuración editable del sitio y CMS.
- `media_usages`: relación entre medios y campos.
- `backups`: registro de backups.

## UI Faltante

El overlay debe evolucionar hacia:

- Panel de login más pulido y sin password prellenado en producción.
- Panel lateral con pestañas: campo, medios, historial, publicación. Hay una vista básica de historial, falta integrarla como pestaña formal.
- Toolbar de estado global: guardado, sin publicar, error, publicado.
- Media picker completo: ya existe selección/búsqueda/preview básica; faltan usos, filtros avanzados, dimensiones recomendadas y detección de no usados.
- Vistas de listado para servicios, proyectos y clientes.
- Validación inline por tipo de campo.
- Confirmaciones para acciones destructivas.
- Estados vacíos y errores recuperables.
- Mejor soporte teclado: tab order, foco al abrir panel, Escape, Enter/Cmd+S.
- Pruebas visuales desktop/mobile.

## Integración con Astro Faltante

Pendientes para que Astro consuma CMS de forma más completa:

- Mover más contenido hardcodeado a `src/data/cms-content.json` o colecciones exportadas.
- Exportar más contenido hacia `src/data/cms-content.json`; `company.ts`, `nav.ts` e imágenes de proyecto/servicios ya consumen datos CMS con fallbacks.
- Asegurar que campos de SEO por página sean editables.
- Generar redirects/sitemap desde contenido CMS cuando existan nuevas páginas.
- Evitar cualquier dependencia runtime del CMS en build público.

## Orden Sugerido de Implementación

1. ✅ Completar inventario editorial por página.
2. ✅ Conectar `clientes.astro`, secciones internas y CTAs restantes.
3. ✅ Implementar revisiones y rollback básico.
4. ✅ Agregar backup (`cms:backup`) y seguridad básica.
5. Agregar galerías, logos de clientes y `media_usages`.
6. Completar CRUD de servicios/proyectos/clientes (sin tocar archivos).
7. Agregar tests unitarios/API/E2E.
8. Endurecer seguridad y auditoría (audit_events, rate limiting persistente, SVG sanitización).
9. Agregar backup/restore vía API.
10. Avanzar a constructor de secciones y nuevas páginas.

## Riesgos Abiertos

- La DB local puede perderse si no hay backup.
- Cambios en Markdown pueden reordenar frontmatter si el export no preserva formato.
- Páginas detalle ya leen imágenes principales desde CMS con fallbacks; galerías y datos técnicos siguen pendientes.
- Sin tests E2E, el overlay puede romper por cambios de markup.
- Sin auditoría, no hay trazabilidad fina de cambios editoriales.
- Si se usa en LAN con password default, hay riesgo operativo.

## Definición de CMS Completo para Fase 1

La Fase 1 puede considerarse completa cuando:

- Todo texto e imagen principal existente se edita desde el overlay.
- Servicios, proyectos y clientes existentes se pueden editar sin tocar archivos.
- Upload y selección de imágenes funciona con alt/foco.
- Guardar actualiza SQLite y publicar exporta archivos.
- Hay historial y rollback básico.
- `npm run check` y `npm run build` pasan.
- Tests API y E2E críticos pasan.
- `dist/` no contiene overlay, endpoints ni secretos CMS.
