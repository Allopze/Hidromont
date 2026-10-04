# Auditoría integral Hidromont Chile

- **Sistema auditado:** sitio público https://hidromontchile.cl y su CMS (overlay de edición + API Fastify/SQLite), tratados como un único sistema.
- **Commit auditado:** `2281504` (`main`, árbol limpio, sincronizado con `origin/main`). Producción sirve exactamente este commit: las 26 URL del sitemap coinciden texto a texto e imagen a imagen con un build local de `2281504`.
- **Fecha:** 2026-09-25.
- **Método:** lectura de código; ejecución de las suites existentes (vitest, `astro check`, ESLint, Playwright); builds en los dos perfiles (`PUBLIC_ENABLE_CMS=1` y `=0`); pruebas E2E reales CMS → SQLite → export → `npm run build:log` → HTML servido, sobre **clones desechables** del repositorio (base SQLite, `uploads/` y `src/` copiados); rastreo, SEO, consola/red, accesibilidad (axe-core + revisión manual), responsive (320–1440 px), Chromium y WebKit (escritorio e iPhone 13) y Lighthouse/CDP contra producción **solo con GET/HEAD**. El formulario de contacto se probó con respuestas simuladas: no salió ninguna petición a FormSubmit.
- **El proyecto quedó intacto:** `git status` limpio, `dist/` sin tocar, ningún servidor de prueba en marcha. Lo único añadido es este informe y la carpeta `auditoria-hidromont-evidencias/` (capturas seleccionadas y el registro de la reproducción del P0), ambos sin versionar.
- **No se pudo inspeccionar el VPS por SSH** (permiso denegado en esta sesión). Todo lo que depende de la base de producción (cuántas fotos publicadas tiene, si su árbol git está limpio, su `.env`) queda marcado como «no verificado». Las cifras de base de datos son de la base **local**, que va por detrás del JSON versionado.

---

## 1. Resumen ejecutivo

**Estado general.** El **sitio público** está bien construido y se comporta bien para el visitante: 0 errores de JavaScript, 0 violaciones de CSP y 0 recursos rotos en las 27 páginas; 0 violaciones de axe-core en escritorio y móvil; ningún desbordamiento horizontal entre 320 y 1440 px; CLS 0; Lighthouse móvil entre 96 y 100; producción idéntica al repositorio. Le faltan arreglos puntuales de accesibilidad y del menú móvil antes de darlo por terminado.

El **CMS no está listo para que lo use una persona no técnica**. Tiene un fallo bloqueante (borrar una sola foto de la galería impide publicar nada más) y varias funciones que la interfaz ofrece pero que dejan contenido roto o imposible de completar: crear un proyecto o un servicio, cambiar la dirección de una ficha, vaciar un número, borrar una imagen en uso. La causa raíz común es que las relaciones entre fichas, imágenes y galerías se apoyan en **listas de slugs escritas a mano en el código** y en **archivos versionados en git**, no en la base de datos, y que la validación del CMS es más permisiva que la del sitio.

| Severidad | Nº     | Qué agrupa                                                                                                                                                                                                                                                  |
| --------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0**    | **1**  | Publicar queda bloqueado tras borrar u ocultar una foto de la galería                                                                                                                                                                                       |
| **P1**    | **12** | Fuentes de verdad git ↔ VPS; fichas nuevas o renombradas rotas; valores que rompen el build; imágenes rotas publicadas; revisiones/importación que pisan contenido; navegación y barra del editor; CI roja; menú móvil; foco de teclado; foco en la galería |
| **P2**    | **38** | Separación público/editor, XSS por el cuerpo con la CSP anulada, dependencias vulnerables, errores y estados del panel, clientes/servicios/alt, URLs duplicadas, vídeo y galería pesados…                                                                   |
| **P3**    | **14** | Endurecimiento, caché, SEO menor, favicon, residuos de datos, pulido visual y de accesibilidad                                                                                                                                                              |

**Principales riesgos**

1. **Publicación bloqueada por una acción normal** (P0-01): tras borrar una foto de la galería, todas las publicaciones fallan con una instrucción de terminal (`CMS_ALLOW_GALLERY_SHRINK=1`). No se ha podido comprobar si la base del VPS ya está en esa situación.
2. **Dos fuentes de verdad del contenido** (P1-01): «Publicar» escribe en archivos versionados del servidor; el siguiente `npm run deploy` se niega a desplegar, y las correcciones de contenido hechas en git se pierden en la siguiente publicación.
3. **Contenido nuevo que nace roto** (P1-02, P1-03): un proyecto o servicio creado desde el panel no admite foto, galería ni datos técnicos, y editarlo en su página abre la pantalla de «Acceso». Renombrar o borrar deja páginas fantasma publicadas que reaparecen al reiniciar.
4. **El CMS deja publicar cosas rotas** (P1-04, P1-05, P2-15, P2-02): un número vaciado bloquea el build, una imagen borrada queda rota en la página, un H1 o un título SEO pueden publicarse vacíos, y un `<script>` pegado en el cuerpo de una ficha se ejecuta porque la CSP autoriza automáticamente los scripts del contenido.
5. **Nada protege `main`** (P1-09): la CI lleva siete semanas en rojo (78 de 79 ejecuciones fallidas) y ninguna prueba ejercita una publicación real, por eso el P0 y los P1 del CMS pasan todas las suites.

**Principales fortalezas**

1. Autenticación y autorización sólidas: las 45 rutas de la API exigen sesión (401) y las mutaciones CSRF (403); cookie `__Host-`, `HttpOnly`, `SameSite=Lax`; sin secretos en git ni en el bundle.
2. Build atómico (`build:log`): un build fallido nunca dejó el sitio sin páginas en ninguna prueba.
3. Sitio público rápido, estable y semántico, con identidad industrial coherente y responsive sin desbordes.
4. Edición en contexto con confirmaciones propias, deshacer, borradores locales, bloqueo optimista y teclado bien resuelto.
5. Vocabulario compartido (enums) entre el sitio, la API, el export y los desplegables del panel.

### 1.1 Respuestas a las preguntas de la auditoría

| #   | Pregunta                                                             | Respuesta                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ¿Está el sitio listo para producción?                                | **Casi.** Funciona y rinde bien; antes de cerrar la versión hay que corregir el menú móvil (P1-10) y los dos fallos de foco (P1-11, P1-12).                                                                                                                                                                                   |
| 2   | ¿Está el CMS listo para personal no técnico?                         | **No.** P0-01 y P1-02 a P1-08 afectan a tareas habituales (quitar una foto, crear un proyecto, cambiar de página, publicar desde una tablet).                                                                                                                                                                                 |
| 3   | ¿Puede un usuario del CMS romper una página?                         | **Sí**, sin darse cuenta: vaciar «Orden» o borrar una foto bloquea la publicación; borrar una imagen en uso la deja rota; renombrar una ficha le quita las fotos y deja un duplicado; se pueden publicar H1 y títulos SEO vacíos. Lo que sí está garantizado es que un build fallido no tira el sitio.                        |
| 4   | ¿Hay una única fuente de verdad para proyectos y servicios?          | **No.** El texto vive en `.md` versionados y en SQLite del VPS sin reconciliación; sus fotos de cabecera y galerías dependen de listas de 10 y 8 slugs en `src/data/*.ts`; los nombres de servicio están copiados en 5–6 sitios.                                                                                              |
| 5   | ¿Llega contenido administrativo al frontend público?                 | **Sí, al HTML, pero no a la pantalla.** 43 nodos «solo editor» (`hidden`) en 12 páginas, 8.463 atributos `data-cms-*`, el chunk del editor descargable y la API respondiendo en el dominio público. No son visibles en ningún navegador probado, no están en el árbol de accesibilidad y no revelan nada sensible. Ver P2-01. |
| 6   | ¿Puede editarse desde el CMS todo lo que debería?                    | **Casi todo lo existente sí.** Faltan: fotos y datos técnicos de fichas nuevas, orden de la galería, redirecciones al cambiar una dirección, y las opciones del formulario de contacto, que son una lista manual en lugar de derivarse de los servicios.                                                                      |
| 7   | ¿Hay cosas en el CMS que no afectan al sitio?                        | **Sí:** «Destacada» en la galería, «Título» y «Dirección» de las fichas de página, «Nueva página», el orden de la lista de clientes en /clientes.                                                                                                                                                                             |
| 8   | ¿Hay archivos o imágenes huérfanos?                                  | **Sí, moderados:** 48 derivados sin referencia (4,7 MB) que se despliegan, 5 fotos, 11 logos y 18 `.jp2` sin uso; los derivados de fotos borradas nunca se limpian. `uploads/cms` (317 MB) es la biblioteca: sin uso público, pero es lo esperado. 0 referencias rotas en los datos publicados hoy.                           |
| 9   | ¿Hay inconsistencias entre proyectos, clientes, servicios y galería? | **Sí:** hasta 4 nombres para un mismo servicio; 12 variantes de nombres de cliente en proyectos; 8 álbumes con nombre distinto al de su ficha; 3 obras en /galeria sin ficha; el formulario omite 2 servicios. Los datos técnicos de cada proyecto sí coinciden entre home, listado y ficha.                                  |
| 10  | ¿Son seguras las rutas del CMS?                                      | **Sí en lo esencial** (auth, CSRF, CORS, cookie, path traversal, sin secretos). Pendientes: XSS almacenado por el cuerpo con la CSP anulada (P2-02) y dependencias con avisos altos/críticos (P2-03). El límite de intentos de login funciona detrás de Caddy (verificado con un Caddy 2.10 local).                           |
| 11  | ¿Es usable completamente en móvil?                                   | **El sitio sí, salvo el menú** en horizontal o con «Servicios» desplegado (P1-10). **El CMS sí a ≤ 640 px; en tablet no** (P1-08).                                                                                                                                                                                            |
| 12  | ¿Cumple razonablemente WCAG 2.2 AA?                                  | **Todavía no.** axe da 0 violaciones, pero la revisión manual encontró fallos AA reales: foco invisible (2.4.7/1.4.11), pérdida de foco (2.4.3) y contraste del hero móvil (1.4.3). Son acotados y corregibles.                                                                                                               |
| 13  | ¿Es correcto el SEO técnico?                                         | **Mayormente sí:** títulos y descriptions únicos, un H1 por página, JSON-LD válido, sitemap, 404 real, redirecciones www/http. A corregir: cada página responde en 2–4 URL (P2-27), descriptions largas, OG pobres en fichas y el texto de editor oculto en el HTML.                                                          |
| 14  | ¿Hay problemas graves de performance?                                | **No graves.** TBT 0, CLS 0, INP 32–56 ms. Mejorables: el vídeo de 8 MB, el LCP de /galeria en móvil lento (8,2 s) por una miniatura `lazy`, los logos sin optimizar y el visor que descarga cada foto dos veces.                                                                                                             |
| 15  | ¿Qué bugs deben corregirse antes de terminar esta versión?           | **P0-01 y los 12 P1** (sección 21, fases A y B).                                                                                                                                                                                                                                                                              |

---

## 2. Arquitectura observada

### 2.1 Stack real

| Capa          | Tecnología                                                                                                                                                                                                                                                                              | Dónde                                             |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Sitio         | Astro 5.18 (`output: 'static'`, `build.format: 'directory'`, `trailingSlash: 'ignore'`), Tailwind 3, `@astrojs/sitemap`                                                                                                                                                                 | `astro.config.mjs`, `src/`                        |
| Contenido     | Content collections: `proyectos` (40 `.md`), `servicios` (8 `.md`), `clientes` (`clientes.json`); esquemas zod en `src/content.config.ts`                                                                                                                                               | `src/content/`                                    |
| Datos del CMS | `src/data/cms-content.json` (80 entradas, 578 claves) y `src/data/gallery.json` (173 fotos), escritos por el export; más listas en TS (`project-images.ts`, `project-galleries.ts`, `service-images.ts`, `service-galleries.ts`, `nav.ts`, `cliente-logos.ts`, `content-vocabulary.ts`) | `src/data/`                                       |
| Editor        | Overlay JS modular (29 `.js` + 9 `.ts`, ~9.500 líneas) cargado en todas las páginas; solo se monta en `editor.*`                                                                                                                                                                        | `src/scripts/cms/overlay/`, `src/components/cms/` |
| API           | Fastify 5 + better-sqlite3 (WAL), 45 rutas bajo `/api/cms/*`; controllers → services → repositories                                                                                                                                                                                     | `cms/`                                            |
| Imágenes      | sharp 0.33: derivados WebP 640/1024/1600 en `public/gallery/derived/`; subidas en `uploads/cms` (fuera de `public/`)                                                                                                                                                                    | `cms/services/imageService.ts`, `mediaService.ts` |
| Servidor      | Un proceso Node (`server.mjs` → `cms/server.ts`) sirve `dist/`, `/uploads/cms` y la API en `127.0.0.1:8787`; systemd (`User=root`, `ProtectSystem=full`)                                                                                                                                | `deploy/hidromont.service`, `cms/staticSite.ts`   |
| Borde         | Caddy 2 con TLS de Let's Encrypt; `hidromontchile.cl` (12 MB), `editor.hidromontchile.cl` (64 MB, `X-Robots-Tag: noindex`), `www` → 301                                                                                                                                                 | `deploy/Caddyfile`                                |
| Externos      | FormSubmit.co (formulario, `fetch` a `/ajax/<correo>`), Google Maps (iframe), Sentry (solo backend y solo si hay DSN)                                                                                                                                                                   | `ContactForm.astro`, `ContactInfo.astro`          |

### 2.2 Despliegue y proceso

```
                           Internet
                              │
       ┌──────────────────────┴───────────────────────┐
       │ Caddy (VPS)  hidromontchile.cl · editor.* · www│  TLS automático, zstd/gzip
       └──────────────────────┬───────────────────────┘
                              │ reverse_proxy 127.0.0.1:8787  (los dos hosts al mismo proceso)
       ┌──────────────────────┴──────────────────────────────────────────┐
       │ node server.mjs → cms/server.ts (Fastify 5, systemd, root)        │
       │  ├─ onSend: CSP (hashes leídos de dist/ en caliente), HSTS, XFO…  │
       │  ├─ /api/cms/*   45 rutas: health, login, session públicas;       │
       │  │               resto requireAuth (+ requireCsrf en mutaciones)   │
       │  └─ GET /*       staticSite.ts → dist/ (+ /uploads/cms, _redirects)│
       └───────┬──────────────────────────────────┬──────────────────────┘
               │ better-sqlite3                   │ execFile(CMS_PUBLISH_CHECK_COMMAND)
               ▼                                  ▼
   cms/data/hidromont-cms.sqlite        npm run build:log → astro check → astro build
   (13 tablas, 6 migraciones)           → dist.nuevo → rename a dist (atómico)
```

`npm run deploy` (`scripts/deploy-vps.sh`) exige árbol limpio y empujado, hace `git pull --ff-only`, `npm ci`, `npm run build:log` y `systemctl restart`; no toca la base ni `uploads/`.

### 2.3 Rutas públicas (27 páginas)

| Ruta                                                                                               | Fuente                                                                                          | Generación                                                                            |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/`, `/empresa`, `/clientes`, `/galeria`, `/contacto`, `/contacto/gracias`, `/404`                 | `src/pages/*.astro` + `cms-content.json`, `gallery.json`, `clientes.json`                       | estáticas                                                                             |
| `/servicios`, `/servicios/[slug]` (8)                                                              | colección `servicios`                                                                           | `getStaticPaths` → todos                                                              |
| `/proyectos`, `/proyectos/[slug]` (10)                                                             | colección `proyectos` (40)                                                                      | `getStaticPaths` → solo `tipo: destacado`; los 30 del banco solo aparecen en la tabla |
| `/_assets/*`, `/fotos/*`, `/gallery/derived/*`, `/uploads/cms/*`, `/videos/*`, `/logos-clientes/*` | build, `public/`, `uploads/cms`                                                                 | estáticos                                                                             |
| `/sitemap-index.xml`, `/sitemap-0.xml` (26 URL), `/robots.txt`                                     | `@astrojs/sitemap`, `public/robots.txt`                                                         | build                                                                                 |
| Redirecciones                                                                                      | `public/_redirects` (1 regla: `ch-dorias` → `ch-doiras`), leídas en memoria por `staticSite.ts` | runtime                                                                               |

No hay páginas huérfanas salvo `/contacto/gracias/` (destino del formulario). Las rutas inexistentes dan un 404 real.

### 2.4 Modo público y modo edición

- La decisión es **de build**: `import.meta.env.DEV || PUBLIC_ENABLE_CMS === '1'`, repetida en 13 archivos. Producción compila con `=1`, así que **los dos dominios sirven el mismo `dist/`, byte a byte**.
- En runtime, `src/scripts/cms/overlay/index.ts` solo importa el editor (`mount.*.js`, 203 KB) si `hostname.startsWith('editor.')`; `?cms=1` solo existe en desarrollo. Un visitante de `hidromontchile.cl` descarga un arranque de ~1 KB y no hace ninguna llamada a `/api/cms/*`.
- Lo que es solo del editor se pinta en el HTML con `hidden` + `data-cms-solo-editor` (`src/utils/soloEditor.ts`) y el overlay lo destapa al montarse (`shell.js:89-93`). El servidor no sabe quién es editor: el HTML es estático.

### 2.5 Autenticación, sesiones y publicación

- Un único rol de administrador. Login con bcryptjs (coste 12), hash ficticio contra enumeración, límite de 10 intentos/min por IP, cookie `__Host-…` `Secure` `HttpOnly` `SameSite=Lax` sin `Domain` (no se comparte entre dominios), 7 días. CSRF por token ligado a la sesión en cabecera `X-CSRF-Token`, comparado en tiempo constante. Guardas de arranque contra la contraseña por defecto (también contra los hashes de la base).
- **Guardar** escribe en SQLite (con revisión y bloqueo optimista `expectedVersion`). **Publicar** exporta (`cms-content.json`, `.md` de colecciones, derivados WebP, `gallery.json`), ejecuta el comando de build y refresca las cabeceras de seguridad. No hay revalidación incremental ni caché intermedia: el HTML va con `no-cache` y todo lo publicado aparece al terminar el build.

---

## 3. Mapa CMS → sitio

```
Overlay (solo en editor.hidromontchile.cl)
   │  PATCH /api/cms/entries/:id/fields/:key   { value, expectedVersion }
   ▼
Validación  ── zod de la API (tipos y enums de content-vocabulary.ts)
   │           ⚠ admite null y slugs con «/» o «.» que el zod del sitio rechaza (P1-04)
   ▼
Persistencia ── SQLite: content_entries/content_fields, revisions, media_*, gallery_*, audit_events
   │
   ▼  «Publicar» (POST /api/cms/publish, síncrono, cerrojo en memoria)
Export ── src/data/cms-content.json · src/content/**/*.md · public/gallery/derived/*.webp · src/data/gallery.json
   │        ⚠ son archivos VERSIONADOS en el clon git del servidor (P1-01)
   │        ⚠ la guarda de galería aborta si hay menos fotos que en el JSON (P0-01)
   ▼
Capa de datos del sitio ── getCollection() + getCmsText/Value/Image (con fallback literal en el código)
   │        ⚠ fotos y galerías de fichas indexadas por listas fijas de slugs en src/data/*.ts (P1-02)
   ▼
Render ── astro check + astro build → dist.nuevo → rename a dist  (atómico)
   │
   ▼
Caché ── HTML no-cache (sin ETag); /_assets y derivados immutable; fotos sin hash también immutable (P3-03)
   │
   ▼
Usuario público ── Caddy → Fastify static (mismo dist para hidromontchile.cl y editor.*)
```

### 3.1 Matriz de entidades

| Entidad                              | CMS                                              | Fuente de datos                                                 | Página pública                                            | Sincronización                   | Problema                                                                                                 |
| ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Textos de páginas, cabecera y pie    | Sí (edición en contexto y «Textos del sitio»)    | `cms-content.json` + fallback literal en el código              | todas                                                     | export → build                   | 48 fallbacks obsoletos reaparecen si una ficha pasa a borrador (P2-06)                                   |
| Datos de empresa                     | Sí (`site.company`)                              | `cms-content.json` + `company.ts`                               | pie, contacto, JSON-LD, `<title>`                         | export                           | destino del mapa y localidad del JSON-LD son literales en código (P3-09)                                 |
| Menú (rótulos)                       | Sí; destinos ocultos (bien)                      | `nav.ts` + `layout.header`                                      | cabecera, pie                                             | automática para servicios nuevos | el rótulo corto del menú ≠ título del servicio (P2-12)                                                   |
| Servicio (ficha)                     | Sí (colección)                                   | `.md` versionado                                                | /servicios, ficha, home, menú, pie, sitemap               | export `.md`                     | no se puede asignar a proyectos ni aparece en el formulario si es nuevo (P1-02, P2-12)                   |
| Cabecera y galería de servicio       | Sí, **solo 8 slugs fijos**                       | `cms-content.json` + `service-images.ts`/`service-galleries.ts` | ficha                                                     | listas en código                 | nuevo o renombrado: sin foto y no editable; 5/8 galerías vacías (P1-02, P2-09)                           |
| Proyecto                             | Sí (colección)                                   | `.md` versionado                                                | /proyectos (tabla y destacados), ficha si destacado, home | export `.md`                     | renombrado → `.md` fantasma; `null` rompe el build (P1-03, P1-04)                                        |
| Cabecera y galería de proyecto       | Sí, **solo 10 slugs fijos**                      | `cms-content.json` + `project-images.ts`/`project-galleries.ts` | ficha, tarjetas                                           | listas en código                 | destacado nuevo sin foto; 5/10 galerías vacías (P1-02, P2-09)                                            |
| Medidas de la foto de cabecera       | No (ocultas)                                     | `imageWidth`/`imageHeight`                                      | ficha                                                     | **ninguna**                      | no se recalculan al cambiar la foto (P2-14)                                                              |
| Relación proyecto → servicio         | Sí (`servicio`, enum fijo)                       | `.md` + `servicioHref`                                          | ficha de proyecto                                         | manual                           | borrar o renombrar el servicio → enlace 404 (P1-03)                                                      |
| Relación servicio → proyectos        | **No existe**                                    | —                                                               | —                                                         | —                                | la ficha de servicio no enlaza a sus obras (P2-34)                                                       |
| Categoría de proyecto                | Nombre sí; código no                             | enum + `proyectos.categorias`                                   | filtros, tabla, badge                                     | export                           | nombres distintos de los servicios (P2-12)                                                               |
| Redirecciones                        | No                                               | `public/_redirects`                                             | —                                                         | manual                           | cambiar un slug no crea 301 (P1-03)                                                                      |
| Lista de clientes                    | Sí (`clientes.lista`)                            | `cms-content.json` (respaldo `clientes.json`)                   | /clientes, franja de la home                              | export                           | renombrar pierde el logo; el orden no rige en /clientes (P2-11)                                          |
| Logo de cliente                      | Sí (`clientes.logos`, clave derivada del nombre) | `cms-content.json` (respaldo `clientes.json`)                   | /clientes, home                                           | export                           | se sirve el PNG original, hasta 3.840 px (P2-38)                                                         |
| Cliente citado en un proyecto        | Sí (texto libre)                                 | `.md`                                                           | ficha, tabla                                              | ninguna                          | sin relación con la lista: 12 variantes (P3-09)                                                          |
| Galería (fotos, álbumes, categorías) | Sí (pestañas de galería)                         | SQLite → `gallery.json`                                         | /galeria                                                  | export completo                  | quitar una foto bloquea publicar (P0-01); «Destacada» sin efecto; sin ordenar en el panel (P2-09, P2-25) |
| Biblioteca de medios                 | Sí                                               | `media_assets` + `uploads/cms`                                  | indirecta                                                 | —                                | 82 % de alt = nombre de archivo y se copia al elegir (P2-13)                                             |
| Iconos de servicio                   | Sí (`icono` + `iconoPropio`)                     | `.md`                                                           | tarjetas                                                  | export                           | — (correcto)                                                                                             |
| Vídeo de cabecera                    | Sí (`video`, `videoAlt`)                         | `cms-content.json`                                              | fichas                                                    | export                           | 8 MB en 1080p sin versión móvil (P2-35)                                                                  |
| Opciones del formulario de contacto  | Sí (`contact.form.services`)                     | `cms-content.json`                                              | /contacto                                                 | copia manual                     | faltan 2 de 8 servicios (P2-12)                                                                          |
| SEO por página                       | Sí («Datos para buscadores»)                     | `cms-content.json`                                              | `<head>`                                                  | export                           | se puede publicar vacío (P2-15); las fichas usan el alcance/resumen entero como description (P3-06)      |
| Fichas de página (`page`)            | Sí («Título», «Dirección», «Nueva página»)       | `content_entries`                                               | **ninguna**                                               | —                                | controles sin efecto (P2-22)                                                                             |

**Contenido fijo en código que sí conviene sacar a datos** (por riesgo y frecuencia de cambio, no por hacerlo todo editable): qué fichas tienen cabecera y galería (derivarlo de la colección), las opciones del formulario (derivarlas de los servicios publicados), el destino del mapa y la dirección del JSON-LD (derivarlos de `site.company`) y las medidas de las fotos (calcularlas en el export). **Bien como está en código:** los href del menú, los códigos de categoría y la lista de fichas con cabecera «contenida».

---

## 4. Hallazgos críticos P0

### [P0] P0-01 — Tras borrar u ocultar una sola foto de la galería, «Publicar» falla siempre hasta que alguien toque el servidor

**Área:** CMS / Integración  
**Ubicación:** `cms/services/exportService.ts:78-101` (`assertNoSilentGalleryShrink`), `cms/services/exportService.ts:581`, `cms/services/publishService.ts:155-166`, `cms/controllers/GalleryController.ts:220-239`, `src/scripts/cms/overlay/gallery.js:535`  
**Ruta afectada:** todas (no se publica ningún cambio), en especial `/galeria`  
**Evidencia:**  
Reproducido de forma independiente en tres clones del repositorio con la base local y las rutas reales del CMS (registro en `auditoria-hidromont-evidencias/log-p0-galeria-publicar.txt`):

```
[3] Publicar tras editar texto: 200 succeeded
[4] fotos publicadas en la base: 173
[4] DELETE foto 200
[5] Publicar tras borrar 1 foto: 409 {"error":"… Export de galería abortado: la base de datos tiene 172 foto(s)
    publicada(s) pero gallery.json ya contiene 173. Exportar borraría 1 foto(s) que el CMS no conoce.
    • Si faltan fotos en el CMS, impórtalas antes: npx tsx cms/scripts/import-gallery-json.ts
    • Si la reducción es intencional …, repite con CMS_ALLOW_GALLERY_SHRINK=1."}
[6] exportaciones posteriores: 409 (mismo mensaje)
```

En la prueba E2E se cambió además el subtítulo de la home antes de publicar: tampoco salió (`dist/index.html` sin cambios). Como `gallery.json` no se reescribe al fallar, la condición no desaparece: **todas** las publicaciones posteriores fallan, también las de solo texto. Pasa igual al marcar una foto como «Oculta (borrador)» o al borrar la imagen que usa una foto de la galería. El deshacer del borrado solo dura 12 s (`undoService.ts:23`). `CMS_ALLOW_GALLERY_SHRINK` no aparece en `.env.production.example` ni en `deploy/`.

**Causa probable:**  
Confirmada. La guarda GAL-1 se escribió para frenar una importación rota (168 fotos en el JSON contra 23 en la base) y compara el **número** de fotos publicadas en SQLite con el del `gallery.json` en disco. No distingue un borrado legítimo hecho desde el propio CMS y su única salida es una variable de entorno del servidor. Además, `publishContent` exporta el contenido antes que la galería, así que el job fallido deja `cms-content.json` y los `.md` escritos sin compilar.

**Impacto:**  
Una acción normal que la interfaz ofrece con su propio botón deja a la persona editora sin poder publicar nada, con un mensaje de terminal que no puede seguir. Ninguna prueba lo detecta (las e2e borran fotos que ellas mismas crean y nunca publican; el sandbox usa `CMS_PUBLISH_CHECK_COMMAND=false`). **No verificado:** si la base del VPS tiene hoy menos fotos publicadas que el `gallery.json` desplegado; si es así, todas las publicaciones ya están fallando.

**Corrección recomendada:**  
Que la guarda compare por **identificador** y contra el estado conocido de la base (fotos borradas o despublicadas registradas en `audit_events` o en el deshacer desde el último export correcto), no contra el recuento del archivo. Alternativa: guardar en la base el recuento del último export correcto. Si se quiere mantener una confirmación, pedirla en la interfaz («Vas a quitar N fotos del sitio») y pasar la autorización en la petición. Exportar la galería antes que el contenido, o ambos a un directorio temporal con renombrado final, para no dejar medio export. Mientras tanto, comprobar en el VPS `select count(*) from gallery_items where status='published'` frente a `jq '.items|length' src/data/gallery.json`.

**Validación posterior:**  
Test de integración sobre `registerCmsRoutes`: borrar una foto publicada → `POST /api/cms/publish` responde 200 y `gallery.json` tiene n−1 ítems. Mantener el test GAL-1 actual para el caso de un JSON escrito fuera del CMS. Repetir la reproducción del registro.

---

## 5. Hallazgos graves P1

### [P1] P1-01 — El contenido publicado tiene dos fuentes de verdad sin reconciliar: «Publicar» escribe en archivos versionados del servidor

**Área:** Integración / Arquitectura  
**Ubicación:** `cms/services/exportService.ts:202-252`, `:328-378`, `:405-471`; `cms/services/imageService.ts:44-46`; `cms/services/contentService.ts:330-366`; `cms/routes/cmsRoutes.ts:654-712`; `scripts/deploy-vps.sh:136-142`; `.gitignore` (no ignora `public/gallery/derived/`)  
**Ruta afectada:** todas  
**Evidencia:**  
En un clon limpio del repositorio (`git status` vacío): arrancar el CMS con una base distinta del JSON versionado ya modifica `src/data/cms-content.json`; editar un texto y publicar deja ` M src/data/cms-content.json  M src/data/gallery.json`; crear un proyecto y exportar deja `?? src/content/proyectos/<slug>.md`; borrar una entrada borra su `.md` en ese momento. `deploy-vps.sh:136-142` aborta si `git status --porcelain --untracked-files=no` del servidor no está vacío («El servidor tiene cambios locales sin commitear; git pull los pisaría»). En sentido contrario, los desarrolladores editan esos archivos a mano: `bded6cc` cambió `contact.form.subject` solo en el JSON y `cc9a0a0` añadió ~120 campos con `updatedAt` congelado; en el VPS manda la base, así que la siguiente publicación los revertiría. La base local va además 10 entradas y 134 campos por detrás del JSON versionado.

**Causa probable:**  
Confirmada. El diseño original (CMS en local → commit → hosting estático) se mantuvo al llevar el CMS a producción: SQLite es la fuente de verdad en el servidor, pero su proyección se escribe en archivos que git también considera fuente, sin regla de quién manda.

**Impacto:**  
(a) Tras la primera publicación desde el panel que cambie algo, `npm run deploy` se niega a desplegar código. (b) La salida manual (`git checkout -- .` o `stash`) compila el contenido viejo de git y el sitio retrocede hasta la siguiente publicación. (c) Los arreglos de contenido hechos en git se pierden en la siguiente publicación. (d) El contenido de producción nunca vuelve a git. Para la persona editora se ve como «mis cambios desaparecen» o «el arreglo que me hicieron volvió atrás». Hoy producción coincide con git, lo que indica que no se ha publicado desde el panel del VPS tras el último despliegue.

**Corrección recomendada:**  
Declarar la base del VPS como única fuente de verdad del contenido y sacar su proyección del árbol versionado: exportar a un directorio de datos fuera de git (`CMS_CONTENT_ROOT_DIR` ya existe) del que lea el build, o dejar de versionar `src/data/cms-content.json`, `src/data/gallery.json`, `src/content/**` y `public/gallery/derived/` y sembrarlos desde la base. Los cambios de contenido del desarrollador deben entrar como migraciones o semillas aplicadas a la base (como ya hace `importMissingEntries`), no editando el JSON. Mientras tanto, que `deploy-vps.sh` distinga «solo hay cambios del export» y los respalde en vez de abortar.

**Validación posterior:**  
En un clon del servidor: publicar desde el panel → `git status --porcelain --untracked-files=no` vacío → `npm run deploy` no se detiene; arrancar el CMS no modifica archivos versionados; un cambio de contenido del desarrollador llega a la base por el camino documentado.

### [P1] P1-02 — Un proyecto o servicio creado desde el CMS nace incompleto y no se puede completar: sin foto, sin galería, sin datos técnicos, y editarlo en su página abre «Acceso»

**Área:** CMS / Integración  
**Ubicación:** `src/scripts/cms/overlay/collections.js:198-221` (línea 205: prefijos `servicio`/`proyecto` en singular) frente a `src/pages/proyectos/[slug].astro:54` (`proyectos.${slug}`) y `src/pages/servicios/[slug].astro:38` (`servicios.${slug}`); `cms/services/contentService.ts:17-43` (`requiredFieldTemplate`); `cms/repositories/ContentRepository.ts:319-320` («Field … does not exist»); `src/data/project-images.ts:10-78`, `src/data/project-galleries.ts:12-23`, `src/data/service-images.ts:3-59`, `src/data/service-galleries.ts:12-14`; `src/data/content-vocabulary.ts:37-46` (`SERVICIO_SLUG`); `src/scripts/cms/overlay/events.js:742`  
**Ruta afectada:** `/proyectos/<nuevo>`, `/servicios/<nuevo>`, tarjetas de la home y de /proyectos  
**Evidencia:**  
Colecciones → Proyectos → «Nuevo proyecto» → «Central Prueba Auditoría», destacado, publicado. La base guarda el id `proyecto.central-prueba-auditoria`; la página pinta `data-cms-entry="proyectos.central-prueba-auditoria"`. Al pulsar el título o «+ Agregar imagen 1», el panel muestra **«Acceso · Entra para editar el sitio»** con «Recurso no encontrado» y la sesión abierta (`auditoria-hidromont-evidencias/cmsux-115-proyecto-nuevo-clic-titulo.png`). La ficha nueva solo trae Nombre, Alcance = «Alcance pendiente de completar.», Cuerpo = «Contenido pendiente de completar.» (como `textarea`, sin barra de formato), Tipo, Categoría y Orden; `PATCH …/fields/{cliente|servicio|diametro|longitud|peso|acero|ubicacion|normas}` da **400** en los ocho, porque esas claves no existen (`cmsux-47-nuevo-proyecto-creado.png`). No hay `project-image.<slug>` ni `project-gallery.<slug>`: la cabecera sale vacía y los huecos de galería dan 404. En servicios pasa lo mismo con `tipos`, `aplicaciones` y `normas`, y un proyecto no puede asignarse al servicio nuevo (`servicio` es un enum fijo de 8 → 400). Un proyecto del banco pasado a destacado (p. ej. `ch-pangal`, 12 fotos en /galeria) también queda sin foto de cabecera.

**Causa probable:**  
Confirmada, tres causas que se suman: (1) el panel sugiere un id en singular y las plantillas buscan el plural; (2) la plantilla de alta solo inyecta los campos obligatorios del zod y `updateField` rechaza claves inexistentes; (3) las relaciones ficha → imagen y ficha → galería son listas estáticas de 10 y 8 slugs repetidas en 5–9 sitios (`src/data/*`, `defaultContent.ts`), y solo esos slugs tienen sus entradas compañeras sembradas. Además, `selectElement(...).catch((error) => loginView(error.message))` convierte cualquier error en la pantalla de acceso (P2-04).

**Impacto:**  
Crear un proyecto o un servicio, una de las tareas principales del CMS, produce una página publicada con textos de relleno, sin foto ni datos técnicos, que la persona no puede completar y que la «expulsa» a la pantalla de acceso al intentarlo.

**Corrección recomendada:**  
Usar el mismo prefijo que las plantillas (`proyectos.`/`servicios.`) o derivar el id en el servidor y no mostrarlo; migrar las entradas ya creadas en singular. Sembrar al crear todos los campos editables del tipo (vacíos) con el cuerpo como `richtext` y sin textos de relleno visibles. Derivar `projectImages`, `projectGalleries`, `serviceImages` y `serviceGalleries` de `getCollection()` y crear las entradas compañeras en la misma transacción que la ficha (o extender `campoQueSeCreaAlGuardar`). Validar `servicio` contra los servicios existentes, no contra una constante.

**Validación posterior:**  
E2E: crear un proyecto destacado y un servicio desde el panel → publicar → en su página pulsar título, cuerpo, foto principal y huecos de galería (sin 404) → rellenar datos técnicos y asignar el servicio nuevo al proyecto → publicar → todo visible. Test unitario que falle si un slug de la colección no tiene imagen y galería editables.

### [P1] P1-03 — Cambiar la dirección o borrar una ficha deja páginas fantasma publicadas, le quita las fotos y rompe enlaces sin redirección

**Área:** Integración / Sitio / SEO  
**Ubicación:** `cms/services/exportService.ts:397-427` (`pruneStaleCollectionFiles`), `cms/services/contentService.ts:330-366` (`deleteEntry`), `cms/services/contentSeed.ts:22-70` y `cms/routes/cmsRoutes.ts:652-656` (importación al arrancar), `src/data/project-images.ts:73-78`, `src/data/project-galleries.ts:25-36`, `src/pages/galeria/index.astro:65-67`, `src/pages/proyectos/[slug].astro:97-115`, `public/_redirects`  
**Ruta afectada:** `/`, `/proyectos`, `/proyectos/<slug-viejo>`, `/proyectos/<slug-nuevo>`, `/servicios/<slug>`, `/galeria`, `/sitemap-0.xml`  
**Evidencia:**  
En el clon E2E con el pipeline real de publicación:

- Proyecto creado desde el panel, dirección cambiada una vez: quedan los dos `.md`, dos fichas en 200, el proyecto dos veces en /proyectos y dos URL en el sitemap (`e2e-t1i-proyectos-duplicados.png`).
- Proyecto sembrado: el primer cambio limpia el `.md` viejo, el segundo (`-nuevo` → `-tercero`) deja `-nuevo.md` y la tarjeta duplicada en la home (`e2e-t1i-home-duplicados.png`). Cambiar `ruta-nahuelbuta-pasarelas` a `-peatonales` y volver deja `-peatonales.md` publicado para siempre.
- Borrar las dos fichas de prueba y publicar: sus `.md` siguen publicados. Al reiniciar el CMS, el log dice «seed: 2 entrada(s) … importado(s)» y **lo borrado reaparece en el panel**.
- Renombrar un proyecto real con álbum: la ficha nueva sale **sin foto de cabecera ni galería** (`e2e-t1n-renombrado-sin-imagen.png`), la URL vieja da 404 sin 301, los 15 ítems de galería conservan el slug viejo (el visor oculta «Ver proyecto relacionado») y la edición en contexto da 404.
- Borrar un servicio referenciado (`infraestructuras`) no avisa; `/proyectos/ruta-nahuelbuta-pasarelas` sigue enlazando a `/servicios/infraestructuras` (404) y quedan `service-image.*`/`service-gallery.*` huérfanas.

**Causa probable:**  
Confirmada. La poda de archivos solo conoce el slug derivado del id (y solo si el id empieza por `proyectos.`/`servicios.`, lo que no ocurre con los creados en el panel, P1-02) y el actual, nunca los intermedios. `deleteEntry` borra solo el `.md` del slug actual. Al arrancar, `importMissingEntries` convierte cada `.md` sin dueño en una entrada nueva. Cabecera, galería, álbum e id de edición cuelgan del slug y nada los migra. No hay comprobación de referencias al borrar ni generación de redirecciones.

**Impacto:**  
Contenido borrado o renombrado que sigue publicado, duplicado y desactualizado (también para buscadores); fotos que desaparecen al corregir una dirección; enlaces internos y externos rotos. Es exactamente la clase de «cosas raras» que el CMS debe evitar.

**Corrección recomendada:**  
Guardar en la base el historial de slugs (o el nombre de archivo exportado) de cada entrada y podar todos al exportar y al borrar. Al cambiar un slug publicado: migrar en la misma transacción `project-image.*`/`project-gallery.*` (o eliminarlas, ver P1-02), el álbum y `gallery_items.project_slug`, y registrar una 301 (en `_redirects` o en una tabla de redirecciones que lea `staticSite.ts`); avisar en el formulario. Que la importación al arrancar no resucite entradas borradas (lista de borrados en la auditoría) o que avise en lugar de crear. Antes de borrar un servicio, listar los proyectos que lo citan y pedir reasignación; en la plantilla, enlazar solo si la ficha existe.

**Validación posterior:**  
Crear desde el panel, renombrar dos veces, volver al original, borrar, publicar y reiniciar: en cada paso 0 o 1 `.md`, 0 o 1 ficha, 0 o 1 URL en el sitemap y ninguna entrada reaparecida; la URL vieja responde 301; la foto y la galería se conservan; ningún `href="/servicios/…"` del build da 404.

### [P1] P1-04 — El CMS acepta valores que el esquema del sitio rechaza: un número vaciado o un slug con «/» bloquean la publicación

**Área:** Integración / CMS  
**Ubicación:** `src/scripts/cms/overlay/collections.js:528-530` (manda `null` si el campo numérico está vacío), `cms/controllers/ContentController.ts:70-72` (acepta `null`), `cms/validators/cms.schema.ts:52-60` y `:69-78` (slug admite `/` y `.`), `src/content.config.ts:35` (`orden: z.number().default(100)`), `:61`, `cms/controllers/BaseController.ts:84-86`  
**Ruta afectada:** todas (el build falla y no se publica nada)  
**Evidencia:**  
`PATCH /api/cms/entries/proyectos.ch-besaya/fields/orden {value:null}` → 200; el export escribe `orden: null`; `POST /api/cms/publish` → **400 «Error al procesar la solicitud»** y el job queda `failed` con `InvalidContentEntryDataError … orden: Expected type "number", received "null"`. El `dist/` anterior queda intacto (la sustitución atómica funciona), pero **todas las publicaciones siguientes fallan** hasta que alguien corrija ese campo, y el subtítulo editado a la vez tampoco sale. Lo mismo con `cliente: null`. Con el slug `tanques/316l` el build falla («Missing parameter: slug»); con `tanques.glp` la página sale en `/proyectos/tanquesglp` y no en la «Ruta sugerida» que muestra el panel; `/etc/passwd` se acepta y crea `src/content/proyectos/etc/passwd.md` (contenido dentro del árbol, no hay traversal).

**Causa probable:**  
Confirmada. La API valida tipos JS pero admite `null`, y su regex de slug es más permisiva que el enrutado de Astro; `validateCollectionEntry` solo valida los enums. El error de Astro no casa con ningún patrón «amigable» y llega como mensaje genérico.

**Impacto:**  
Una edición inocente («no quiero orden») o una dirección con barra bloquea la publicación con un error incomprensible que no dice qué ficha ni qué campo lo provoca.

**Corrección recomendada:**  
Validar en la API y en el export cada entrada de colección con **los mismos esquemas zod del sitio** antes de guardarla o escribirla (u omitir del frontmatter las claves `null`). Restringir el slug de colección a `^[a-z0-9]+(?:-[a-z0-9]+)*$`, como ya se hace con álbumes y categorías. Marcar «Orden» como obligatorio en el formulario. Devolver al panel el error de contenido traducido («Proyecto C.H. Besaya: el campo Orden debe ser un número»).

**Validación posterior:**  
Vaciar «Orden» da error al guardar o publica con 100; un slug con «/» o «.» se rechaza con 400 legible; test que valide todos los `.md` exportados contra `src/content.config.ts`.

### [P1] P1-05 — Borrar una imagen en uso (confirmando el aviso) publica imágenes rotas sin ningún aviso

**Área:** CMS / Integración  
**Ubicación:** `cms/services/mediaService.ts:326-367`, `cms/services/exportService.ts:318-325` (derivado fallido → se exporta la ruta cruda), `cms/services/pendingService.ts:15-32` (`media.delete` no cuenta como cambio pendiente)  
**Ruta afectada:** `/servicios/compuertas` (reproducido) y cualquier página que use la imagen  
**Evidencia:**  
`DELETE /api/cms/media/<id>` responde 409 con la lista de usos (correcto). Con `?confirm=1` → 200: el archivo se borra de `uploads/cms`, el ítem de galería queda con `media_id NULL`, pero `service-gallery.compuertas.gallery1` **sigue apuntando** a `/uploads/cms/auditoria-test-001-hero-TCg5Ve2Q.jpg`. Publicar da 200 sin avisos y la página muestra la imagen rota (404) (`e2e-t6b-compuertas-imagen-rota.png`). Restaurar una revisión antigua de `project-image.ch-besaya` volvió a poner la ruta de una imagen borrada, también sin aviso. «Qué se va a publicar» dice 0 cambios tras el borrado.

**Causa probable:**  
Confirmada. El borrado confirmado no limpia ni sustituye las referencias de contenido; el export solo avisa por stderr; el resumen de pendientes no incluye `media.delete`.

**Impacto:**  
El CMS permite publicar páginas con imágenes rotas y la persona editora no se entera.

**Corrección recomendada:**  
Al confirmar el borrado, vaciar las referencias (y los ítems de galería) en la misma transacción, o impedirlo mientras haya usos. Al exportar, incluir en el resultado de la publicación cada campo que apunte a un archivo inexistente. Al restaurar una revisión, comprobar que sus imágenes existen. Contar `media.delete` como cambio pendiente.

**Validación posterior:**  
Borrar una imagen usada y publicar: la casilla queda vacía u oculta y el resultado lo indica; ningún `<img>` del build da 404 (script de integridad sobre `dist/`).

### [P1] P1-06 — La importación y la sincronización pisan contenido sin revisión ni respaldo; «Revisiones» puede restaurar contenido de junio

**Área:** CMS / Integración  
**Ubicación:** `cms/repositories/ContentRepository.ts:43-75` (`upsertEntry` actualiza sin crear revisión ni subir versión), `:337-346` (la revisión guarda el estado posterior al cambio), `cms/services/contentService.ts:177-195` (`importInitialContent`), `cms/content/defaultContent.ts:13-203`, `scripts/sync-datos-vps.sh:84-86`, `README.md:120`  
**Ruta afectada:** `/servicios/turbinas` (reproducido); potencialmente todas las fichas  
**Evidencia:**

- En la base local, **87 de 127 entradas** tienen una última revisión que no coincide con su contenido actual (las 40 de colección incluidas). `servicios.turbinas` está en versión 1 con una revisión del 2026-06-09. Se editó el título (v2) y el resumen (v3) y se restauró la versión anterior disponible (v1): el `.md` revirtió `orden 7→4`, el cuerpo, los tipos y el resumen a junio (~40 líneas).
- `npm run cms:import` (documentado como «importa el contenido estático actual») sobre una copia desechable de la base revierte **73 campos** publicados a la semilla: el nombre y la dirección de la empresa, 6 fotos de galería y **7 rutas de cabecera hacia 5 archivos que no existen**.
- `scripts/sync-datos-vps.sh` borra el WAL remoto y sube la base local encima de la del servidor sin comparar fechas ni hacer respaldo remoto. La base local está atrasada y contaminada (41 categorías de prueba, P3-08).

**Causa probable:**  
Confirmada. La semilla quedó congelada mientras lo publicado evolucionaba; `upsertEntry` modifica campos sin dejar revisión, así que no existe una revisión con el estado inmediatamente anterior a la primera edición. Las dos herramientas asumen que su origen es el más reciente.

**Impacto:**  
Quien intente deshacer su primera edición con «Revisiones» pierde en silencio meses de contenido de esa ficha. Un comando documentado o un script de despliegue pueden sustituir lo publicado por datos viejos y dejar cabeceras rotas en 6 páginas.

**Corrección recomendada:**  
Crear una revisión del estado actual en cada `upsertEntry` o actualización masiva y ejecutar una vez una tarea que la cree para las entradas con deriva (también en el VPS). Que `cms:import` solo inserte lo que falta (como `importMissingEntries`) o importe desde `cms-content.json`; regenerar la semilla desde lo publicado. Que `sync-datos-vps.sh` haga respaldo remoto con fecha, compare `max(updated_at)` y pida confirmación explícita.

**Validación posterior:**  
Script de deriva de revisiones = 0 en local y en el VPS; editar un campo y restaurar la revisión anterior devuelve exactamente el `.md` previo; `cms:import` sobre una copia da 0 diferencias frente a `cms-content.json`; el sync deja un respaldo remoto.

### [P1] P1-07 — En modo edición no se puede navegar por el sitio: el menú, las tarjetas y los botones abren el editor

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/events.js:139-147` y `:719-743` (clic capturado con `preventDefault` sobre cualquier `[data-cms-entry]` o su enlace anfitrión), `src/scripts/cms/overlay/inline-edit-accessibility.js:50-62`  
**Ruta afectada:** todas; p. ej. `/` → menú «Proyectos», tarjetas de servicio, pie  
**Evidencia:**  
Con sesión, pulsar «Proyectos» en el menú abre «Editar texto · Header › Menú · Proyectos» y la URL sigue en `/` (`cmsux-122-clic-menu-abre-editor.png`). En la home, 44 de los 50 enlaces internos visibles son editables (solo 6 «Ver detalle» navegan). Cmd/Ctrl+clic tampoco abre pestaña. No existe «Ir a esta página» ni selector de páginas.

**Causa probable:**  
Confirmada: decisión deliberada para que el relleno de un botón no navegue, sin ofrecer otra vía de navegación.

**Impacto:**  
La persona no sabe cómo llegar a «Empresa», «Clientes» o a un servicio para editarlo; la única salida es escribir la URL a mano. Es la mayor barrera de entrada del editor.

**Corrección recomendada:**  
Una vía explícita: botón «Ir a esta página» en el editor de un texto de enlace (con el destino en palabras), un selector «Páginas del sitio» en la barra y respetar Ctrl/Cmd+clic y clic central. Explicarlo en la barra la primera vez.

**Validación posterior:**  
E2E: desde la home con sesión, llegar a `/empresa` y a `/servicios/compuertas` usando solo la interfaz (sin `goto`).

### [P1] P1-08 — Entre 641 y ~950 px de ancho la barra del CMS se sale de la pantalla: «Publicar cambios» y «Más» quedan inalcanzables en tablet

**Área:** CMS (tablet)  
**Ubicación:** `src/scripts/cms/overlay/styles.js:512-527` (`.hm-cms-bar` fija en `flex` sin `flex-wrap`, `max-width` ni scroll), `src/scripts/cms/mobile-menu.ts:73-76` (el menú móvil solo aparece a ≤ 640 px), `src/scripts/cms/overlay/actions.ts:40-72`  
**Ruta afectada:** cualquier página en 768×1024, 800×1280 y 1024×768 táctil  
**Evidencia:**  
A 768×1024 la barra termina en x=1059: quedan fuera «Guías editables», «Publicar cambios» y «Más» (Salir, Historial, Administrar) (`cmsux-91-tablet-barra.png`, se corta en «Guías ed…»); a 800 px, fuera «Publicar» y «Más»; a 1024 táctil, fuera «Más». La barra es `position: fixed`: no hay desplazamiento que los revele.

**Causa probable:**  
Confirmada: 6–8 botones en una fila sin ajuste y un umbral de menú móvil (640 px) menor que el ancho real de la barra (~1.040 px).

**Impacto:**  
En una tablet, dispositivo típico de una persona no técnica, no se puede publicar ni cerrar sesión: parece que el botón no existe.

**Corrección recomendada:**  
`flex-wrap` o mover acciones al menú «Más» según el ancho disponible; o subir el umbral del menú móvil a ~1.024 px / basarlo en `pointer: coarse`. Garantizar que «Publicar cambios» sea siempre visible.

**Validación posterior:**  
En 768, 800 y 1024 (táctil y no táctil) todos los botones de la barra quedan dentro de `window.innerWidth` y se pueden pulsar.

### [P1] P1-09 — La CI lleva siete semanas en rojo y ninguna prueba ejercita una publicación real

**Área:** Pruebas  
**Ubicación:** `.github/workflows/ci.yml:54`, `:77-90`, `:108-130`; `playwright.config.ts:13-18`, `:30-46`; `scripts/e2e-cms-sandbox.mjs:24-28`, `:116`; `e2e/build-gate.spec.ts:25`, `:140-156`; `e2e/cms-publicacion.spec.ts:118`, `:144`; `cms/test/setup.ts:110-300`  
**Ruta afectada:** —  
**Evidencia:**  
API pública de GitHub: 79 ejecuciones, **78 fallidas**; la última verde es del 2026-08-08 y las 15 más recientes (hasta `2281504`) fallan en «Build gate» y «Run E2E tests». Reproducido en local: la config de Playwright rechaza el `127.0.0.1` que usa el job («CMS_URL debe apuntar al CMS local aislado (http://localhost:8787)») y el sandbox exige la base SQLite del desarrollador, que no está en git («No existe la base CMS de origen»). En local la suite pasa (vitest 409/409, Playwright 155 pasan / 4 omitidos, `astro check` y ESLint 0 errores), pero: el build-gate valida el `dist/` del 22-sep (4 commits atrás) y contra un build fresco del perfil de producción **falla** un test que describe un comportamiento ya retirado (`?cms=1`); los dos tests de publicación interceptan `POST /api/cms/publish` y el sandbox fija `CMS_PUBLISH_CHECK_COMMAND=false`; 14 de 21 archivos de `cms/test` usan un cableado de rutas duplicado a mano; cobertura de `publishService.ts` 5,7 %, `PublishController.ts` 7,3 %, `staticSite.ts` 17,6 %.

**Causa probable:**  
Confirmada. El endurecimiento de `playwright.config.ts` (`d714932`) no se trasladó a `ci.yml`; las pruebas de artefacto leen `dist/` sin reconstruirlo; publicar de verdad requiere compilar, y el arnés se escribió antes de que las rutas tuvieran lógica propia.

**Impacto:**  
Nada protege `main`: todo lo desplegado en septiembre salió sin una ejecución verde. El P0 y los P1 del CMS pasan todas las suites. Los comentarios de `ci.yml` y `docs/SECURITY.md` («CI lo ejecuta en cada PR») dan una falsa sensación de seguridad.

**Corrección recomendada:**  
Una base de fixtures mínima y versionada (generada con `migrate()` + `defaultContentEntries` + unas pocas fotos) que el sandbox use cuando no exista `cms/data/…`; que el job e2e deje arrancar los servidores a Playwright o use `reuseExistingServer: !!process.env.CI`; aceptar `127.0.0.1` y `localhost`. Un `globalSetup` que compile a un directorio temporal para el build-gate. Un test de integración de «Publicar» con `CMS_CONTENT_ROOT_DIR` temporal y un build real a `outDir` temporal, y un E2E «editar → publicar → GET de la página servida contiene el texto nuevo». Sustituir `cms/test/setup.ts` por un `buildApp()` exportado desde `cmsRoutes.ts`. Poner la CI como check obligatorio.

**Validación posterior:**  
Ejecución verde de los dos jobs desde un clon limpio sin `cms/data/` ni `.env`; cobertura de `publishService` y `PublishController` > 80 %; el E2E de reflejo público falla si se rompe cualquier eslabón.

### [P1] P1-10 — Menú móvil: en horizontal o con «Servicios» desplegado, «Clientes», «Contacto» y «Contáctenos» no se pueden alcanzar

**Área:** Sitio / Responsive  
**Ubicación:** `src/components/layout/Header.astro:46-54` (header `sticky`/`fixed`), `:234-296` (`#mobile-menu` sin `max-height` ni `overflow-y`), `:441-458` (`body.overflow-hidden`)  
**Ruta afectada:** todas las páginas · móvil en horizontal (568×320, 844×390, iPhone 13 664×390) y móvil vertical con «Servicios» desplegado (390×844, iPhone 13 390×664, Pixel 7)  
**Evidencia:**  
En 568×320 el menú acaba en y=516 y solo se ven Inicio → Empresa (`webb-menu-mobile-open-landscape-568x320.png`). En vertical con «Servicios» desplegado, el CTA «Contáctenos» termina en y=932 con 844 px (Chromium), 664 px (WebKit iPhone 13) y 839 px (Pixel 7) de alto (`webb-menu-mobile-servicios-expandido-390x844.png`). Arrastre táctil y rueda dejan `scrollY=0`: ni el menú ni la página se desplazan. Reproducido en Chromium, Pixel 7 y WebKit iPhone 13.

**Causa probable:**  
Confirmada: el panel vive dentro de un header pegado, no tiene scroll propio y el `overflow-hidden` de `body` bloquea el scroll del viewport.

**Impacto:**  
En móvil el menú es la navegación principal; en horizontal (o tras desplegar Servicios en un teléfono pequeño) el visitante no llega a Contacto ni a Clientes, los destinos de conversión de un sitio B2B.

**Corrección recomendada:**  
Dar al panel scroll propio: `max-height: calc(100dvh - altura del header)`, `overflow-y: auto`, `overscroll-behavior: contain`; o convertirlo en overlay `fixed inset-0` con scroll interno. Mantener el bloqueo de `body` solo si el panel se desplaza por sí mismo.

**Validación posterior:**  
En 390×844 con Servicios desplegado y en 844×390/568×320, arrastrar dentro del menú hasta que el CTA quede dentro del viewport; repetir en WebKit iPhone 13 y en un iPhone real.

### [P1] P1-11 — El foco del teclado es casi invisible en los botones principales (1,29–1,60:1) y no existe en el buscador de la galería

**Área:** A11y  
**Ubicación:** `src/components/ui/Button.astro:34-42` (`focus-visible:outline-primary/30`, `outline-white/30`), `src/components/contact/ContactForm.astro:236`, `src/layouts/PageLayout.astro:24-29` (skip link), `src/pages/galeria/index.astro:142` (`focus:outline-none focus:bg-background`)  
**Ruta afectada:** todo el sitio (CTA «Contáctenos» de la cabecera, CTAs del hero y de las secciones oscuras, «Contactar», «Enviar consulta») y `/galeria/`  
**Evidencia:**  
Recorrido con Tab midiendo el `outline` calculado contra su fondo: botón primario sobre fondo oscuro `rgba(0,101,169,.3)` sobre `#0F2433` → **1,29:1**; sobre blanco → **1,60:1**; `secondary-light` → 2,67:1; «Contactar» → 1,83:1; `#gallery-search` sin `outline` ni `box-shadow` (solo cambia el fondo de #F5F8FA a #FFF). Antes/después indistinguibles (`webb-foco-cta-hero-primario-antes-despues.png`, `webb-foco-buscador-galeria-antes-despues.png`). Contraejemplo correcto en el propio sitio: las píldoras de filtro de /proyectos (`outline-primary` sólido).

**Causa probable:**  
Confirmada: el modificador de opacidad `/30` en el color del `outline` de las variantes de `Button` (copiado en el botón de envío y en el skip link) y `focus:outline-none` sin sustituto en el buscador.

**Impacto:**  
Quien navega con teclado no ve dónde está el foco justo en los CTAs de conversión y en el buscador. Incumple 2.4.7 (Foco visible) y 1.4.11 (Contraste de componentes, indicador < 3:1). axe no lo detecta.

**Corrección recomendada:**  
Colores opacos como en los filtros: `outline-primary` (o `primary-dark`) de 2–3 px sobre fondos claros y `outline-white`/`outline-accent` sobre oscuros, con `outline-offset: 2px`. En `#gallery-search`, un `focus-visible:outline` sólido o un anillo en el contenedor.

**Validación posterior:**  
Repetir la medición: indicador ≥ 3:1 contra los fondos adyacentes en todos los objetivos; capturas antes/después distinguibles.

### [P1] P1-12 — Galería: el foco se destruye al cargar más fotos y no vuelve a la foto al cerrar el visor (en Safari nunca vuelve)

**Área:** A11y  
**Ubicación:** `src/pages/galeria/index.astro:388-415` (`renderWall` → `photoWall.replaceChildren(...)`), `:624-635` (cada lote repinta el muro entero), `src/components/gallery/Lightbox.astro:496` (`previousFocus = document.activeElement`), `:525-528`  
**Ruta afectada:** `/galeria/` · teclado y lector de pantalla; Chromium 1280 y 390; WebKit escritorio e iPhone 13  
**Evidencia:**  
Tabulando por el muro, el foco salta a `BODY` en cada lote (Tab 4, 14 y 30 en 1280; 8, 28 y 59 en 390); un `MutationObserver` registra un repintado completo por lote. Si se carga un lote con el visor abierto, al pulsar Escape el foco queda en `BODY` y la página aparece desplazada (`scrollY≈1180` desde 0). En WebKit, tras abrir con clic o toque y cerrar, el foco queda **siempre** en `BODY` (Safari no enfoca un `<button>` al hacer clic).

**Causa probable:**  
Confirmada: el muro se recrea entero en vez de añadir nodos, y el visor recuerda el elemento enfocado por referencia en lugar de la foto (`data-item-id`) que lo abrió.

**Impacto:**  
Quien usa teclado o lector de pantalla pierde su posición varias veces al recorrer las 173 fotos y vuelve al principio del documento al cerrar el visor. Incumple 2.4.3 (Orden del foco).

**Corrección recomendada:**  
En los lotes, añadir solo las tarjetas nuevas (`append`). En `open(card)`, guardar `card.dataset.itemId` y al cerrar enfocar `.gallery-card[data-item-id=…]` con `scrollIntoView({block:'nearest'})`, usando la tarjeta que disparó la apertura aunque el clic no la haya enfocado.

**Validación posterior:**  
Tabular hasta el pie sin saltos a `BODY`; tras cerrar el visor, foco en la tarjeta y `scrollY` sin cambios, en Chromium y WebKit.

---

## 6. Hallazgos moderados P2

### [P2] P2-01 — Público y editor comparten el mismo build: la interfaz del editor viaja en el HTML público, oculta solo con `hidden`

**Área:** Integración / Arquitectura / SEO  
**Ubicación:** `src/utils/soloEditor.ts:13-15`; `src/pages/servicios/[slug].astro:254-300`; `src/pages/proyectos/[slug].astro:447-497`; `src/pages/clientes.astro:120-133`; `src/scripts/cms/overlay/shell.js:89-93`; `src/components/cms/EditableText.astro:42-50`, `EditableImage.astro:76-83`; condición `PUBLIC_ENABLE_CMS === '1'` en `src/layouts/BaseLayout.astro:15,135` y en 13 archivos; `deploy/Caddyfile:18-72`  
**Ruta afectada:** `/servicios/{compuertas,infraestructuras,otros-montajes,tanques-especiales,tuberias-forzadas,valvulas}/`, `/proyectos/{ch-besaya,ch-doiras,ch-rio-frio,embalse-chacrillas,embalse-chironta}/`, `/clientes/`; atributos en las 27 páginas  
**Evidencia:**  
`curl -s https://hidromontchile.cl/servicios/compuertas/ | grep -c 'Agregar imagen'` → 3; en `/clientes/` aparece «Lista de clientes · solo la ve quien edita. Púlsala para añadir, quitar o renombrar…». En total **43 nodos `data-cms-solo-editor` en 12 páginas** (18 KB), más **8.463 atributos `data-cms-*`** (237 KB en bruto, ~16,6 KB comprimidos) con los ids internos del modelo (`service-gallery.compuertas`, `plantilla.servicio`…), el `window.__HIDROMONT_CMS__` en línea, el chunk del editor (`/_assets/mount.CY11D3M9.js`, 203 KB) descargable por URL y la API (`/api/cms/health`, `/login`) respondiendo en `hidromontchile.cl`. Comprobación de visibilidad (Chromium y WebKit, escritorio y móvil, con y sin JS, sin CSS de autor, modo lectura con Readability, `ariaSnapshot`): **ningún nodo es visible** (`display:none`, `checkVisibility()=false`) ni está en el árbol de accesibilidad; ninguna clase anula `[hidden]`. Sí aparecen en el HTML crudo y en cualquier extracción de texto sin CSS. La lista oculta de /clientes tiene los mismos 24 nombres que la cuadrícula visible (`weba-crop_public_compuertas_galeria.png` frente a `weba-crop_editor_compuertas_galeria.png`). Si el texto se vio renderizado en pantalla, corresponde a la versión anterior a `soloEditor()`, cuyo propio comentario documenta que «en sep-2026 /servicios/compuertas enseñaba tres casillas vacías en hidromontchile.cl».

**Causa probable:**  
Confirmada. `PUBLIC_ENABLE_CMS` es una decisión de build y producción genera un único artefacto para dos públicos; el servidor no sabe quién edita porque el HTML es estático. `soloEditor()` oculta en cliente lo que ya se envió.

**Impacto:**  
No hay contenido sensible expuesto ni impacto visible hoy, por eso no es P0/P1. Quedan tres efectos: texto de interfaz de administración y un `<h2>` «Galería de imágenes» vacío en el HTML de 11 fichas, que leen buscadores, scrapers y herramientas SEO; el modelo interno y el mapa de la API expuestos en el dominio público; y **fragilidad**: basta añadir una clase `flex`, `grid` o `block` a uno de esos nodos para que aparezca en público, porque las utilidades de Tailwind van después de la regla `[hidden]` del preflight.

**Corrección recomendada:**  
Separar los perfiles: compilar en cada publicación `dist/` con `PUBLIC_ENABLE_CMS=0` para `hidromontchile.cl` y `dist-editor/` con `=1` para `editor.*`, y elegir el directorio por `Host` en `staticSite.ts` (el build tarda 2–3 s por perfil en local). Así desaparecen los nodos, los atributos, el arranque del overlay y el chunk del dominio público; que `/api/*` responda 404 en `hidromontchile.cl`. Arreglo mínimo si no se hace lo anterior: emitir los placeholders como `<template data-cms-solo-editor>` (fuera del DOM y de `textContent`) y que el overlay los clone al montarse; y un test que falle si un nodo `[hidden][data-cms-solo-editor]` lleva clases `flex|grid|block|inline*`. Centralizar la condición en un único helper.

**Validación posterior:**  
`curl -s https://hidromontchile.cl/servicios/compuertas/ | grep -c 'data-cms-\|Agregar imagen'` → 0; `curl -o /dev/null -w '%{http_code}' https://hidromontchile.cl/api/cms/health` → 404; en `editor.hidromontchile.cl` las casillas siguen apareciendo; el build-gate de perfil público se ejecuta contra el `dist/` que se sirve.

### [P2] P2-02 — El HTML escrito en el cuerpo de una ficha se publica y se ejecuta, porque la CSP autoriza automáticamente los scripts del contenido

**Área:** Seguridad / Integración  
**Ubicación:** `src/pages/proyectos/[slug].astro:48,169` y `src/pages/servicios/[slug].astro:112` (`<Content />` con HTML crudo del Markdown), `cms/validators/cms.schema.ts:26-30` (`value: z.unknown()`), `cms/security/headers.ts:21-47` (`collectInlineScriptHashes` recorre **todo** `dist/`), `scripts/sync-csp-headers.ts:30-39`  
**Ruta afectada:** `/proyectos/<slug>`, `/servicios/<slug>`  
**Evidencia:**  
En el clon E2E, un cuerpo con `<script>alert("body")</script>` se guarda (200), se exporta tal cual y aparece literal en el HTML; el cálculo de la CSP añade su hash a `script-src` en la cabecera servida y **Chromium ejecuta el `alert`**. Los campos de texto sí se escapan (un cliente `<b>x</b><script>…` sale como texto; un `alt` con `<img onerror>` también). La vista previa del overlay escapa y valida enlaces, así que el panel no es vulnerable.

**Causa probable:**  
Confirmada. Astro trata el Markdown de colección como confiable y pasa el HTML crudo; los hashes de la CSP se calculan leyendo el HTML final, incluido lo que viene del contenido, así que cualquier `<script>` en línea queda autorizado. La CSP, pensada como defensa en profundidad, no protege en este caso.

**Impacto:**  
Requiere sesión de administrador (un único usuario de confianza), por eso no es P1. Pero un script pegado en el cuerpo, incluso sin intención desde otra web, se ejecuta en el sitio público, y una sesión robada permite XSS persistente sin que la CSP lo frene.

**Corrección recomendada:**  
Sanear el HTML del cuerpo al exportar o al renderizar (p. ej. `rehype-sanitize` con lista blanca: sin `script`, `on*`, `javascript:`), o rechazar HTML crudo en los campos `richtext`. Calcular los hashes de la CSP solo a partir de los scripts del código (lista blanca generada en el build del código), no de todo `dist/`. No debilitar la CSP.

**Validación posterior:**  
Con el mismo cuerpo, el HTML publicado no contiene `<script>alert` ni `onerror`, el navegador no muestra el diálogo y el número de hashes de `script-src` no cambia al publicar contenido.

### [P2] P2-03 — Dependencias con avisos altos y críticos (sharp/libvips, Astro) procesando archivos subidos en un proceso que corre como root

**Área:** Seguridad  
**Ubicación:** `package.json` (`"sharp": "^0.33.5"`, `"astro": "^5.18.2"`), `cms/services/mediaService.ts:5,165,222-306`, `cms/services/imageService.ts:4,70,82,105`, `cms/services/publishService.ts:166-170`, `deploy/hidromont.service` (`User=root`)  
**Ruta afectada:** `POST /api/cms/media`, `POST /api/cms/publish`  
**Evidencia:**  
`npm audit` en un clon: `sharp <=0.35.4-rc.0` **high** (GHSA-f88m-g3jw-g9cj, libvips; GHSA-rgj7-g3m4-5g8c, libheif); instaladas sharp 0.33.5, libvips 8.15.3, libheif 1.18.2. `astro <=7.2.7` **critical** (GHSA-26w7-cxv4-gfx2, RCE por optimización AVIF) más varios XSS. En local, un AVIF y un TIFF renombrados a `.jpg` con MIME `image/jpeg` se aceptaron (201) porque `sharp().metadata()` los decodifica: el contenedor real no se verifica.

**Causa probable:**  
Dependencias directas desactualizadas; la validación de subidas confía en extensión + MIME declarado.

**Impacto:**  
Explotarlo exige sesión de administrador; con el servicio como root (decisión aceptada por el propietario, con el endurecimiento systemd que lo acota), una corrupción de memoria en libvips/libheif tendría más alcance. El vector AVIF de Astro no se confirmó explotable aquí (no se vio optimización AVIF en el pipeline). No se construyeron exploits.

**Corrección recomendada:**  
Actualizar sharp a ≥ 0.35.4 y planificar Astro ≥ 7.2.8 con pruebas de regresión del build. Verificar el formato real por _magic bytes_ antes de pasar a sharp y aceptar solo JPEG/PNG/WebP (HEIF/AVIF/TIFF no se usan en el sitio).

**Validación posterior:**  
`npm audit --omit=dev` sin avisos altos/críticos; un AVIF renombrado a `.jpg` se rechaza con un mensaje claro.

### [P2] P2-04 — Errores mal clasificados: 400 genérico para fallos del servidor, 500 con mensaje crudo, y el panel muestra «Acceso» ante cualquier error

**Área:** CMS  
**Ubicación:** `cms/controllers/BaseController.ts:14`, `:38-42`, `:52-87`; `cms/routes/cmsRoutes.ts:398-416`; `src/scripts/cms/overlay/events.js:503`, `:565`, `:579`, `:742`; `src/scripts/cms/overlay/api.js:14-36`; `src/scripts/cms/overlay/auth.js:69-73`  
**Ruta afectada:** `editor.hidromontchile.cl`  
**Evidencia:**  
Dos exportaciones simultáneas: la segunda recibe `400 {"error":"Error al procesar la solicitud"}` en vez de «Ya hay una publicación en curso» (y se reporta a Sentry como excepción). Restaurar una revisión inexistente: `500 {"statusCode":500,…,"message":"Revisión no-existe no encontrada"}`. Un 500 simulado al abrir un campo muestra «Acceso · Entra para editar el sitio» con la sesión activa; con el CMS caído, el mismo formulario dice «Failed to fetch», en inglés (`cmsux-110-error-al-abrir-campo.png`). Un archivo no válido o un error de build llegan como «Error al procesar la solicitud».

**Causa probable:**  
Confirmada: la clasificación depende de expresiones regulares sobre mensajes en español; la ruta de revisiones no tiene `try/catch`; el overlay canaliza todo error de `selectElement` a `loginView()` y no trata el 401 de forma global.

**Impacto:**  
Mensajes que confunden y hacen que la persona vuelva a escribir su contraseña sin motivo (gastando intentos del límite de 10/min); estados HTTP que ocultan fallos del servidor en la monitorización.

**Corrección recomendada:**  
Clases de error de dominio (`{status, mensajeUsuario}`) y un `setErrorHandler` global en Fastify que devuelva 500 genérico para lo no clasificado. En el overlay, un único punto que distinga 401 (reautenticar: «Tu sesión terminó»), 404/409 (mensaje en el panel) y 5xx/red («No se pudo abrir este texto. Revisa tu conexión», con «Reintentar»), todo en español.

**Validación posterior:**  
Tests de ruta real: el cerrojo da 409 con su mensaje, una revisión inexistente da 404 con JSON uniforme, un error interno da 500 sin detalle. E2E: simular 404/500/sin red y 401 por separado; solo el 401 muestra el acceso.

### [P2] P2-05 — Builds concurrentes chocan en `dist.nuevo`, el cerrojo es solo del proceso y los jobs interrumpidos quedan «en curso» para siempre

**Área:** Integración  
**Ubicación:** `scripts/build-con-registro.mjs:156-158`, `:225-237`; `cms/services/publishService.ts:47-55`, `:166-170`; `cms/routes/cmsRoutes.ts:80-86`; `cms/repositories/PublishJobRepository.ts:55-78`; `cms/config/unifiedConfig.ts:92`; `deploy/hidromont.service:41`  
**Ruta afectada:** —  
**Evidencia:**  
Cinco pares de `build:log` lanzados con desfases de 0,3–2,2 s: en 3 de 5 falló un build (`ENOENT … dist.nuevo/gallery/derived/…`, `ENOTEMPTY … dist.nuevo`, «no hay index.html: no se sustituye nada»); en los cinco el `dist/` final quedó completo. Un job `running` de hace 60 s sigue `running` tras reiniciar el CMS (el reaper solo corre al arrancar y con umbral de 10 min); en la prueba E2E, un reinicio a mitad de build dejó un job «en curso» fantasma en el historial. El valor por defecto de `CMS_PUBLISH_CHECK_COMMAND` es `npm run build`, que **no** es atómico, y el comentario del servicio dice `build:servidor`.

**Causa probable:**  
Confirmada: `dist.nuevo` es un nombre fijo sin bloqueo entre procesos; el cerrojo `busy` vive en memoria y no ve un `npm run deploy` por SSH (que además ejecuta `npm ci` mientras un build del panel puede estar leyendo `node_modules`).

**Impacto:**  
Un «Publicar» que coincide con un despliegue o con un build manual falla sin motivo aparente; el historial muestra publicaciones eternas. Un `dist/` servido a medias no se observó.

**Corrección recomendada:**  
Lockfile entre procesos (`fs.openSync(…,'wx')` con PID, o `flock`) compartido por `build-con-registro.mjs`, el CMS y `deploy-vps.sh`, y un directorio temporal único por build. Que el despliegue espere o se niegue si hay una publicación en curso. Al arrancar, marcar como fallidos todos los `running` (tras un arranque ninguno puede seguir vivo). `npm run build:log` como valor por defecto; corregir el comentario.

**Validación posterior:**  
Repetir el bucle de concurrencia: 0 fallos o el segundo espera; reiniciar durante una publicación y comprobar que el job queda `failed`.

### [P2] P2-06 — Cada texto vive en tres sitios que ya han divergido: 48 textos por defecto obsoletos reaparecen al pasar una ficha a borrador

**Área:** Arquitectura / CMS  
**Ubicación:** `src/data/cms.ts:50-56`, `:77-83` (fallbacks), `src/pages/*.astro` y componentes (263 llamadas `getCmsText(id, key, 'literal')`), `cms/content/defaultContent.ts` (semilla, 1.499 líneas), `src/data/cms-content.json` (export)  
**Ruta afectada:** `/empresa`, `/`, `/servicios`, `/proyectos`, `/clientes`, pie  
**Evidencia:**  
Build instrumentado: de 538 lecturas únicas, 337 tienen fallback igual a lo publicado, 153 vacío y **48 distinto**; la semilla difiere en 73 valores. Ejemplos: `layout.footer.brand` «Hidromont Chile» (código) frente a «Hidromont Chile S.A.» (publicado); `layout.footer.description` «…Presencia en Chile desde 1997.» frente a «…Desde 1983 ejecutando proyectos…»; `empresa.metricas.card2Desc` «Ingeniería, fabricación y montaje» frente a «Los Ángeles, Biobío». El aviso `DRAFT_EFFECT` dice que «Borrador» vuelve al texto del código, pero ese texto está desactualizado.

**Causa probable:**  
Confirmada: el patrón «fallback en el componente» nació cuando el CMS era opcional y siguió cuando pasó a ser la fuente de verdad.

**Impacto:**  
Despublicar una sección o vaciar un campo muestra de golpe textos antiguos, a veces con datos distintos, que nadie ve en el panel. Multiplica los puntos de mantenimiento y es la raíz de P1-02 y P1-06.

**Corrección recomendada:**  
Una sola fuente: generar semilla y fallbacks desde lo publicado, o reducir los fallbacks a cadena vacía salvo textos estructurales, con un test que exija que cada clave exista en la semilla y que fallback, semilla y publicado coincidan.

**Validación posterior:**  
Repetir el build instrumentado: fallback ≠ publicado = 0 (o solo vacíos intencionados); semilla frente a JSON = 0 diferencias.

### [P2] P2-07 — El overlay son 8.300 líneas de JavaScript sin tipos con un manejador de clic de 626 líneas y estado global mutable

**Área:** Arquitectura  
**Ubicación:** `src/scripts/cms/overlay/events.js:121-747` (click), `:748-1214`; `src/scripts/cms/overlay/context.js` (`state`); `src/scripts/cms/overlay/fields.js:300-372`; `src/scripts/cms/overlay/styles.js` (2.005 líneas de CSS en un string)  
**Ruta afectada:** `editor.hidromontchile.cl`  
**Evidencia:**  
29 archivos `.js` (8.327 líneas) frente a 9 `.ts` (1.244). `astro check` no revisa los `.js` (sin `checkJs` ni `@ts-check`) y ESLint desactiva `no-undef` en `src/scripts/**/*.js`. `events.js` registra un único `click` en `document` con 54 ramas `if (action === …)`, algunas sin `return`. `state` se reasigna en 17 puntos de varios módulos; `selectElement` repinta tras un `await` sin comprobar que sigue siendo la última selección (solo `media.js` tiene guarda de secuencia). No se encontraron fugas de listeners. El bloqueo optimista impide escribir sobre datos viejos.

**Causa probable:**  
Confirmada: la modularización de septiembre partió el monolito en archivos pero mantuvo el despachador central y el estado compartido.

**Impacto:**  
Cada función nueva toca el mismo manejador y los errores de tipo solo aparecen en uso real: es donde más probable es que salgan las «cosas raras» (P2-16, P2-18 y P2-20 nacen aquí).

**Corrección recomendada:**  
`// @ts-check` (o migrar a `.ts`) empezando por `events.js`, `fields.js` y `gallery.js`; sustituir la cadena de `if` por un mapa `acciones[action](ctx)` con retorno explícito; encapsular `state` con un contador de generación para descartar respuestas obsoletas; sacar `styles.js` a un `.css`.

**Validación posterior:**  
`astro check` cubre el overlay con 0 errores; test unitario del mapa de acciones; E2E de doble clic rápido en dos campos: el panel muestra el último.

### [P2] P2-08 — La documentación de arquitectura y seguridad describe otro sistema

**Área:** Arquitectura  
**Ubicación:** `docs/ARCHITECTURE.md:9-26`, `:39`, `:95`, `:127`, `:153`, `:183`, `:233`, `:245`; `docs/SECURITY.md:11-19`, `:41`, `:48`, `:73`, `:128`; `README.md:22`, `:178`, `:206`, `:268`; `.github/workflows/ci.yml:20-22`; `deploy/hidromont.service:41`  
**Ruta afectada:** —  
**Evidencia:**  
17 afirmaciones contradichas por el código en 6 archivos. `ARCHITECTURE.md` dice «Build → dist/ → Cloudflare Pages», «API … nunca en producción» y «el CMS nunca sea un vector de ataque público», cuando Fastify sirve el sitio y la API en los dos dominios del VPS. `ARCHITECTURE.md:245` y `SECURITY.md:41` dan por mitigado (H1 «✅») que `PUBLIC_ENABLE_CMS=0` en producción garantiza que `dist/` no contiene el editor y que «CI lo ejecuta en cada PR»: producción compila con `=1` y la CI está roja. Cifras desactualizadas (42 endpoints frente a 45; 3 migraciones frente a 6; «78 tests» frente a 409), archivos inexistentes (`GalleryGrid`, `src/content/config.ts`), CSP en `public/_headers` (la sirve `cms/security/headers.ts`). `DESPLIEGUE-CPANEL.md` (458 líneas) sigue enlazado como guía.

**Causa probable:**  
Confirmada: cada migración de hosting (Cloudflare → cPanel → VPS) actualizó el código y comentarios sueltos, no los documentos de referencia.

**Impacto:**  
Quien lea `SECURITY.md` concluirá que el editor no está en el build público y que la CI lo vigila, y decidirá sobre esa base; un desarrollador nuevo reconstruiría el flujo equivocado.

**Corrección recomendada:**  
Reescribir `ARCHITECTURE.md` a partir de la sección 2 de este informe; marcar H1 de `SECURITY.md` como riesgo aceptado/pendiente con el estado real; mover `DESPLIEGUE-CPANEL.md` a un histórico.

**Validación posterior:**  
Revisión cruzada de las 17 afirmaciones: 0 discrepancias.

### [P2] P2-09 — La galería pública y las galerías de las fichas son modelos desconectados; «Destacada» no tiene efecto

**Área:** Integración  
**Ubicación:** `src/data/project-galleries.ts:25-36`, `src/data/service-galleries.ts:17-27`, `src/pages/galeria/index.astro:25-60`, `src/scripts/cms/overlay/gallery.js:538-541`, `src/data/gallery.ts:54-67`, `cms/db/schema.ts:139-153`  
**Ruta afectada:** `/proyectos/<destacado>`, `/servicios/<slug>`, `/galeria`  
**Evidencia:**  
Galerías de ficha vacías en 5 de 10 proyectos (besaya, doiras, rio-frio, chacrillas, chironta) y 5 de 8 servicios (tuberias-forzadas, compuertas, otros-montajes, infraestructuras, tanques-especiales); válvulas tiene 1 de 3. Mientras, /galeria tiene para esos servicios 71, 8, 29, 26 y 12 fotos en su categoría. Los álbumes llevan `project_slug` de texto libre sin FK: 3 obras (Chacayes, Lican, Trueno) están en /galeria pero no en /proyectos. La casilla «Destacada» (23 marcadas, estrella en el panel) no la lee ninguna página (`grep featured src/pages src/components` → 0).

**Causa probable:**  
Confirmada: dos implementaciones de «fotos de la obra» (3 huecos en `cms-content.json` y álbumes/categorías en SQLite) que nunca se unificaron; `featured` quedó de un diseño anterior.

**Impacto:**  
La persona sube fotos a la galería esperando verlas en la ficha de la obra o del servicio y no aparecen; una opción del editor no hace nada.

**Corrección recomendada:**  
Que la galería de ficha tome por defecto las fotos del álbum del proyecto o de la categoría del servicio (las destacadas primero), dejando los huecos como selección manual opcional, o retirar los huecos. Dar ese uso a `featured` o quitar la casilla. Validar `project_slug` contra proyectos existentes.

**Validación posterior:**  
`/servicios/tuberias-forzadas` muestra fotos sin edición manual; marcar o desmarcar «Destacada» cambia algo visible, o la casilla desaparece.

### [P2] P2-10 — En una galería de ficha con huecos, las fotos cambian de casilla y «+ Agregar imagen N» sobrescribe una foto existente

**Área:** Integración / CMS  
**Ubicación:** `src/data/service-galleries.ts:19-24`, `src/data/project-galleries.ts:28-33`, `src/pages/servicios/[slug].astro:271-297`, `src/pages/proyectos/[slug].astro:465-497`  
**Ruta afectada:** `/servicios/compuertas` (reproducido) y cualquier ficha con huecos  
**Evidencia:**  
Con `gallery1` y `gallery3` puestas y `gallery2` vacía, el HTML pinta la foto de la casilla 3 con `data-cms-field="gallery2"` y el hueco del editor dice `gallery3`. Editar la «segunda» foto escribe en `gallery2` (la de la casilla 3 queda duplicada o escondida) y «+ Agregar imagen 3» sustituye la foto que ya estaba en `gallery3`. La casilla 2 se pinta además sin su srcset, con el original de `/uploads`.

**Causa probable:**  
Confirmada: se filtran las casillas vacías y se vuelve a numerar por posición (`images[n-1]` junto a `gallery${n}`).

**Impacto:**  
La persona puede perder una foto sin darse cuenta; lo que ve no coincide con lo que guarda.

**Corrección recomendada:**  
Conservar el número de campo de cada imagen (`{src, alt, campo: n}`) en vez de renumerar, o compactar los huecos al guardar.

**Validación posterior:**  
Con las casillas 1 y 3, el HTML marca `gallery1` y `gallery3` en sus fotos y el hueco marca `gallery2`.

### [P2] P2-11 — Clientes: renombrar uno le quita el logo; tres fuentes paralelas y el orden del CMS no rige en /clientes

**Área:** Integración / Contenido  
**Ubicación:** `src/data/cliente-logos.ts:19-61`, `src/content/clientes/clientes.json`, `src/pages/clientes.astro:28`, `src/content.config.ts:83-97`  
**Ruta afectada:** `/clientes`, `/` (franja de logos)  
**Evidencia:**  
En `clientes.lista.nombres` se cambió «Colbún» por «Colbún S.A.» y se publicó: /clientes lo pinta sin logo y la home lo pasa a «También trabajamos con Colbún S.A.»; `logo-colbun` queda huérfano. La identidad del cliente es `logo-${slugify(nombre)}`, con `clientes.json` como respaldo por nombre exacto. `clientes.json` tiene 4 logos distintos de los publicados (Acciona, Besalco, Colbún, Elecnor) y un campo `sector` que ninguna página lee. /clientes reordena alfabéticamente e ignora el orden del CMS. «Acciona» repetido se pinta dos veces.

**Causa probable:**  
Confirmada: tres archivos paralelos y la clave del logo depende del nombre visible.

**Impacto:**  
Corregir el nombre de un cliente (añadir «S.A.») lo saca de la franja de logos sin avisar; el orden que la persona fija no se respeta.

**Corrección recomendada:**  
Un id estable por cliente (la clave del logo fijada al crearlo) y migrar el logo al renombrar desde el editor de la lista; reducir `clientes.json` a semilla; retirar `sector` o usarlo; decidir si /clientes respeta el orden del CMS; deduplicar.

**Validación posterior:**  
Renombrar un cliente con logo lo conserva en /clientes y en la home; el orden del CMS se refleja donde se haya decidido.

### [P2] P2-12 — El mismo servicio aparece con hasta 4 nombres y el formulario de contacto omite dos servicios

**Área:** Contenido / Integración  
**Ubicación:** `src/data/nav.ts:96-140`, `src/data/content-vocabulary.ts:118-124`, `src/components/contact/ContactForm.astro:30-38`, `src/data/cms-content.json:337-348` (`contact.form.services`), `cms/content/defaultContent.ts:852-863`  
**Ruta afectada:** menú y pie (todas), `/proyectos`, `/galeria`, `/contacto`, `/servicios`  
**Evidencia:**

| Slug                                 | Ficha (H1)                           | Menú y pie            | Categoría de proyecto                       | Formulario                          |
| ------------------------------------ | ------------------------------------ | --------------------- | ------------------------------------------- | ----------------------------------- |
| tuberias-forzadas                    | Tuberías Forzadas y Blindajes        | Tuberías y Blindajes  | Tuberías y Blindajes                        | Tuberías Forzadas y Blindajes       |
| compuertas / valvulas                | Compuertas / Válvulas Hidráulicas    | Compuertas / Válvulas | **Compuertas y Válvulas** (una sola)        | ambas                               |
| otros-montajes                       | Montajes y Fabricaciones Especiales  | Montajes Especiales   | Montajes Especiales / Estructuras y Tanques | Montajes y Fabricaciones Especiales |
| infraestructuras, tanques-especiales | Infraestructuras, Tanques Especiales | ídem                  | (Estructuras y Tanques)                     | **ausentes**                        |

El `<select>` de /contacto tiene 6 servicios + «Otro»; faltan Infraestructuras y Tanques Especiales. Cuatro textos que enumeran servicios omiten esos dos y «Ocho líneas de trabajo» está escrito a mano.

**Causa probable:**  
Confirmada: cada superficie guarda su copia del nombre (rótulo corto del menú, etiqueta de categoría, categoría de galería, opción del formulario) sin derivar del título de la ficha.

**Impacto:**  
El visitante no puede pedir por el formulario dos servicios que el sitio ofrece; renombrar un servicio exige hasta 5 cambios en sitios distintos que la persona no conoce.

**Corrección recomendada:**  
Derivar las opciones del formulario de `getCollection('servicios')` + «Otro»; decidir si el menú usa rótulo corto y, si es así, mostrar ambos juntos en la ficha del CMS; documentar la diferencia entre categoría de proyecto y servicio; evitar cifras fijas en los textos.

**Validación posterior:**  
El `<select>` lista 8 servicios + «Otro» y coincide con el submenú; renombrar un servicio en el CMS cambia las superficies previstas.

### [P2] P2-13 — Descripciones de imagen: el 82 % de la biblioteca tiene como alt el nombre del archivo, se copia al elegir la foto y al cambiarla se arrastra la anterior

**Área:** A11y / Contenido / CMS  
**Ubicación:** `src/scripts/cms/overlay/media.js:198-205` (`applyMediaSelection`), `cms/services/mediaService.ts:180`, `src/scripts/cms/overlay/fields.js:126-133`, `:566-590`, `:648-664`  
**Ruta afectada:** cualquier campo de imagen editable (cabeceras, galerías de ficha, logos)  
**Evidencia:**  
En `media_assets`, 1.663 de 2.025 alts tienen patrón de nombre de archivo («001», «DSCF2109», «101 1746») y 1.197 son idénticos al nombre. Elegir una foto de la biblioteca reemplaza un alt bueno por ese valor. Al subir una foto nueva sobre «Compuertas planas azules…», la revisión guardó la foto nueva con la descripción antigua; vaciar la descripción se guarda sin aviso. En la galería el alt sí es obligatorio (173/173 descriptivos y únicos), así que el criterio es incoherente.

**Causa probable:**  
Confirmada: la sincronización de medios fija el alt como el nombre de archivo y el editor lo trata como un alt real.

**Impacto:**  
Peor accesibilidad y SEO de imágenes tras ediciones normales, sin que la persona lo note.

**Corrección recomendada:**  
Guardar `alt` NULL cuando proviene del nombre de archivo; no sobrescribir un alt existente con uno de patrón de archivo; al cambiar de foto, vaciar y resaltar la descripción; pedirla con una explicación breve (con casilla explícita para imágenes decorativas).

**Validación posterior:**  
Elegir `DSCF2109.webp` para una cabecera con alt existente lo conserva; cambiar la foto no arrastra la descripción anterior; recuento de alts con patrón de archivo = 0.

### [P2] P2-14 — Las medidas de la foto de cabecera no se recalculan al cambiarla, y quitarla deja el alt y las medidas de la quitada

**Área:** CMS / Sitio  
**Ubicación:** `src/components/cms/EditableImage.astro:65-66`, `src/components/ui/PageHero.astro:244-247`, `src/scripts/cms/overlay/secciones.ts:112-119`, `src/data/cms.ts:142-149` (`getCmsImage`)  
**Ruta afectada:** `/proyectos/*`, `/servicios/*`; sobre todo las 5 fichas con cabecera «contenida» (ch-besaya, ch-doiras, ch-queltehues, tanques-glp-coyhaique, tanques-glp-puerto-williams)  
**Evidencia:**  
`imageWidth`/`imageHeight` son números ocultos en el formulario con el comentario «que el editor de imagen ya calcula», que no es cierto: ningún código del overlay ni del servidor los recalcula. `EditableImage` los prioriza sobre los del derivado y en las fichas contenidas limita la foto con `max-width:${imageWidth}px`: cambiar la cabecera de ch-doiras (441×259) por una de 1.600×900 la mostraría como máximo a 441×259 y con la proporción equivocada. Con `image=""`, el HTML queda `<img src="/fotos/curadas/proyecto-montaje-tuberia.webp" alt="AUDITORIA reemplazo alt" width="1800" height="1000">`: la foto por defecto con el alt y las medidas de la foto quitada. Hoy las 18 cabeceras coinciden con sus archivos.

**Causa probable:**  
Confirmada: el recurso por defecto se aplica solo a `image`, no a `imageAlt`/`imageWidth`/`imageHeight`, y nadie calcula medidas.

**Impacto:**  
Fotos nuevas diminutas o deformadas tras una edición normal; alt incorrecto y proporciones declaradas erróneas cuando se quita una foto.

**Corrección recomendada:**  
Que el export (o `updateField` de un campo `image`) escriba las medidas desde `media_assets`/sharp, o que el sitio use siempre las del derivado; si `image` queda vacío, tomar alt y medidas del recurso por defecto y avisar de que «quitar» equivale a volver a la foto original.

**Validación posterior:**  
Cambiar la cabecera de ch-doiras por una foto 16:9 y publicar: `width`/`height`/`max-width` casan con la nueva; vaciarla da alt y medidas de la foto por defecto.

### [P2] P2-15 — Se pueden publicar H1, títulos SEO, descripciones y rótulos del menú vacíos, con solo espacios o de 300 caracteres

**Área:** SEO / CMS / Sitio  
**Ubicación:** `src/data/cms.ts:77-83` (la cadena vacía se respeta), `src/layouts/BaseLayout.astro:26-35`, `cms/controllers/ContentController.ts:58-127` (sin obligatoriedad), `src/scripts/cms/overlay/secciones.ts:49-64` (solo 4 campos protegidos), `src/scripts/cms/overlay/fields.js:286-290`, `src/scripts/cms/overlay/collections.js:275-286`, `src/data/nav.ts:63-75`  
**Ruta afectada:** `/proyectos`, `/proyectos/ch-besaya`, `/servicios/turbinas`, `/`, cabecera de todas las páginas  
**Evidencia:**  
Todos estos PATCH dan 200: `seoTitle=""`, `seoDescription="   "`, H1 `""`, `nombre=""`, `alcance="   "`, `titulo=""`, `resumen=""`, `layout.header.navProyectos=""`. Resultado publicado: `<title>Hidromont Chile S.A.</title>` duplicado en tres páginas, `<meta name="description" content="   ">`, `<h1>` vacío, `BreadcrumbList` y `Service` con `"name":""` y el enlace «Proyectos» del menú sin texto en todas las páginas. El panel ofrece «Vaciar» para el H1, los textos SEO y los rótulos del menú. Un título de 300 caracteres se guarda sin aviso y en 390 px llena la portada con la primera línea tapada por la cabecera (`cmsux-14-titulo-300-en-390.png`). No se recortan espacios iniciales.

**Causa probable:**  
Confirmada: no hay reglas de obligatoriedad ni de longitud por campo en el cliente ni en el servidor, y la regla «vacío = ocultar» se aplica también a campos que no pueden faltar.

**Impacto:**  
Títulos duplicados, descripciones vacías, datos estructurados no válidos y un enlace de navegación sin nombre (problema de accesibilidad) a un clic de distancia.

**Corrección recomendada:**  
Declarar en el servidor los campos obligatorios por ficha (títulos, SEO, rótulos de menú, nombre/alcance/titulo/resumen) y rechazar vacíos tras `trim()`; en la plantilla, usar el valor por defecto cuando la cadena recortada esté vacía; longitudes recomendadas con contador y aviso suave (p. ej. título > 70, description > 160); confirmación al vaciar un texto principal.

**Validación posterior:**  
Los PATCH anteriores dan 400 con un mensaje legible; ningún build contiene `<title>` sin nombre de página, `content="   "`, `"name":""` ni enlaces de navegación vacíos.

### [P2] P2-16 — Guardar una ficha no limpia el aviso de «sin guardar»

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/collections.js:445-566` (`saveEntryForm` nunca llama a `setFormDirty(false)`), `src/scripts/cms/overlay/events.js:804-816`, `src/scripts/cms/overlay/shell.js:167-174`  
**Ruta afectada:** toda ficha de Colecciones («Editar este servicio/proyecto», «Datos para buscadores», Textos del sitio)  
**Evidencia:**  
Cambiar el Resumen → «Guardar cambios» → «Guardado. Se verá al publicar…», pero el punto ámbar sigue y la X abre «Tienes cambios sin guardar · Cerrar de todos modos» (`cmsux-23-cerrar-ficha-tras-guardar.png`); el `beforeunload` también saltaría. El editor de campo suelto sí limpia el estado.

**Causa probable:**  
Confirmada. Es la regresión que el propio código (A-11, `shell.js:167-174`) describe como causa de que se aprendiera a ignorar el aviso.

**Impacto:**  
Mensajes contradictorios en cada guardado de ficha; la persona duda de si se guardó y aprende a pulsar «Cerrar de todos modos» sin leer, justo cuando el aviso importa.

**Corrección recomendada:**  
Llamar a `setFormDirty(false)` al terminar bien `saveEntryForm` y en «No hay cambios que guardar».

**Validación posterior:**  
Guardar una ficha y cerrar sin confirmación ni punto ámbar; recargar sin aviso del navegador.

### [P2] P2-17 — Lo guardado «desaparece» al recargar: la página muestra lo publicado y el editor lo guardado

**Área:** CMS / Integración  
**Ubicación:** `src/data/cms.ts:1,77-83` (el sitio lee `cms-content.json`, que solo cambia al publicar), `src/scripts/cms/overlay/edicion.js:183-250` (la vista previa en la página vive solo mientras el panel está abierto)  
**Ruta afectada:** cualquier campo editado; reproducido en `/` → título principal  
**Evidencia:**  
Guardar un título nuevo y recargar: el H1 vuelve al texto publicado mientras el editor del mismo campo muestra el guardado con «Todo guardado» (`cmsux-15-recarga-pagina-vs-editor.png`).

**Causa probable:**  
Confirmada por diseño: la página es el sitio publicado, no una vista previa de la base.

**Impacto:**  
La persona cree que su cambio se perdió, lo repite o edita mirando una página que ya no corresponde a lo guardado. Es la «cosa rara» más visible del flujo guardar/publicar.

**Corrección recomendada:**  
Con sesión, pintar en la página los valores guardados sin publicar (el overlay ya sabe escribir textos, listas e imágenes) con un distintivo «Guardado, sin publicar»; como mínimo, un aviso persistente en la barra («Estás viendo la versión publicada; tus N cambios guardados aparecen al publicar»).

**Validación posterior:**  
Guardar, recargar y navegar: la página muestra lo guardado marcado como pendiente, o el aviso explícito.

### [P2] P2-18 — Acceso y sesión caducada con callejones sin salida

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/events.js:752-801` (el botón queda en carga tras entrar y el `<form>` con la contraseña se queda en el DOM), `:781`, `:1201-1213`; `src/scripts/cms/overlay/auth.js:20-29`; `src/scripts/cms/overlay/shell.js:98-106`  
**Ruta afectada:** `editor.hidromontchile.cl` sin sesión o con la sesión caducada (7 días, cambio de contraseña en otro equipo)  
**Evidencia:**  
(1) Con un campo abierto y la cookie borrada, «Guardar» dice «No se pudo guardar: No autenticado», sin forma de volver a entrar. (2) Si la sesión caduca después de entrar, al pulsar un texto reaparece el formulario de acceso **con el correo y la contraseña ya rellenos** y el botón bloqueado en «Entrando…». (3) Cerrar la pantalla de acceso (Escape, X o clic fuera) deja la barra en «Hidromont CMS» sin ningún botón: solo se sale recargando. El aviso del límite de intentos trata de «usted» cuando el resto del panel tutea.

**Causa probable:**  
Confirmada: tras el login no se hace `setButtonLoading(false)` ni se destruye el formulario; `loginView()` lo reabre tal cual; sin sesión la barra solo muestra el rótulo.

**Impacto:**  
Sin recargar no hay salida y la persona cree que el editor se rompió; la contraseña queda en el DOM de la página tras entrar.

**Corrección recomendada:**  
Destruir el formulario de acceso tras entrar; ante un 401 al guardar, conservar lo escrito (ya hay borrador local) y ofrecer «Tu sesión terminó — Entrar de nuevo» en el propio panel, reintentando el guardado después; botón «Entrar» siempre visible en la barra sin sesión; unificar el tono.

**Validación posterior:**  
Entrar, borrar la cookie y pulsar un texto: formulario vacío y habilitado con aviso de sesión terminada; guardar sin cookie ofrece volver a entrar y luego guarda; cerrar el acceso deja un botón visible para reabrirlo.

### [P2] P2-19 — Subir un archivo no válido rompe la vista previa, se anuncia en verde como correcto y al guardar solo dice «Error al procesar la solicitud»

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/dropzone.js:16-32`, `:59-70` (sin validación de tipo ni tamaño en el cliente), `src/scripts/cms/overlay/events.js:1062-1098`, `src/scripts/cms/overlay/fields.js:426-438`, `cms/controllers/BaseController.ts:38-42`, `:84-86`  
**Ruta afectada:** `/servicios/compuertas` → imagen del servicio (y cualquier editor de imagen, galería o vídeo)  
**Evidencia:**  
Con `documento-falso.jpg` (texto renombrado): la foto desaparece de la página y del marco, la zona muestra en verde «documento-falso.jpg · se subirá al guardar» y al guardar aparece «Error al procesar la solicitud» (`cmsux-34-archivo-falso-elegido.png`). Con un archivo de 10 MB el mensaje es claro («el máximo es 8 MB») pero solo después de subirlo entero. No hay barra de progreso, relevante con vídeos de hasta 60 MB.

**Causa probable:**  
Confirmada: el cliente no valida; el error de sharp («unsupported image format») no casa con ningún patrón del servidor.

**Impacto:**  
La persona ve su página «rota», un mensaje que no explica qué hacer y, con vídeos, esperas sin indicación.

**Corrección recomendada:**  
Validar tipo real (decodificar la imagen en el navegador) y tamaño al elegir o soltar, con mensajes en palabras («Este archivo no es una foto. Usa JPG, PNG o WebP»); no aplicar la vista previa si no decodifica; traducir el error de sharp en el servidor; barra de progreso en subidas.

**Validación posterior:**  
Con un `.txt` renombrado, un archivo de 10 MB y un vídeo de 50 MB: aviso inmediato, vista previa intacta y progreso visible.

### [P2] P2-20 — «Volver» y «Cancelar» descartan lo escrito sin preguntar (la X sí pregunta)

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/events.js:283-285`, `:470-472`; `src/scripts/cms/overlay/collections.js:392-397`; `src/scripts/cms/overlay/gallery.js:549-552`; `src/scripts/cms/overlay/panel.js:40-49`  
**Ruta afectada:** fichas de Colecciones («Volver»), «Editar imagen» de la galería («Cancelar»), pestañas de Colecciones y Galería  
**Evidencia:**  
Con el Resumen modificado, «Volver» lleva a la lista sin confirmación; en la galería, cambiar la descripción y pulsar «Cancelar» tampoco pregunta. Al reabrir aparece «Hay cambios sin guardar… Recuperar lo escrito», que la persona no sabe que existe.

**Causa probable:**  
Confirmada: la confirmación solo vive en `closePanel`; `openPanel` borra el estado sucio.

**Impacto:**  
Incoherencia (un botón avisa y el de al lado no) y sensación de pérdida de trabajo.

**Corrección recomendada:**  
Aplicar la misma confirmación a toda navegación interna del panel (Volver, Cancelar, pestañas, abrir otra vista desde la barra), con opción «Guardar y salir».

**Validación posterior:**  
Editar y pulsar cada salida: siempre aparece la misma confirmación.

### [P2] P2-21 — El panel tapa el elemento que se está editando y, con una ficha abierta, tapa «Publicar cambios»

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/panel.js:34-40`, `:60`; `src/scripts/cms/overlay/styles.js:604-626` (440 px / 680 px fijos a la derecha, `z-index: 30` sobre la barra `z-index: 20`)  
**Ruta afectada:** `/` → botón «Contáctenos» de la cabecera; `/servicios/compuertas` → listas de la columna derecha; `/clientes`; cualquier ficha ancha  
**Evidencia:**  
Al editar «Contáctenos» (x≈1100–1275) el botón queda entero bajo el panel (x ≥ 1000): se escribe sin ver el resultado (`cmsux-120-panel-tapa-elemento-editado.png`). Con una ficha abierta, la barra se corta en «Publica…» (`cmsux-21-ficha-servicio-arriba.png`). El aviso de la lista de clientes queda cortado en /clientes.

**Causa probable:**  
Confirmada por maquetación: el panel no desplaza la página ni reserva su ancho.

**Impacto:**  
La gran ventaja del editor en contexto, ver el cambio en la página, se pierde en la mitad derecha de cada página.

**Corrección recomendada:**  
Reservar el ancho del panel en la página (`padding-right`) o desplazar el elemento a la zona visible; mover la barra a la izquierda del panel mientras esté abierto.

**Validación posterior:**  
Editar un elemento de la derecha: su caja resaltada queda completa fuera del panel; «Publicar cambios» siempre visible.

### [P2] P2-22 — El panel expone el modelo interno: controles sin efecto y nombres técnicos a la vista

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/collections.js:24-30` («Nueva página»), `:140`, `:149`, `:341-346`, `:373-381` («ID interno», «Dirección»); `src/scripts/cms/overlay/fields.js:326-330` (miga con `entry.title`); `src/data/field-labels.ts:295-312`; `src/data/content-vocabulary.ts:196`; `src/scripts/cms/overlay/admin.js:128-135`; `src/data/cms.ts:25-33`  
**Ruta afectada:** migas del editor; Colecciones → Páginas / Textos del sitio / Nuevo proyecto; «Datos para buscadores»; Administrar  
**Evidencia:**  
«Título» y «Dirección en el sitio» de las fichas de página y el botón «Nueva página» no tienen ningún efecto: el sitio solo lee `fields` y ninguna ruta de Astro pinta una página nueva. En «Datos para buscadores» de la home, el primer campo es «Título: Hero home» (el nombre interno) y más abajo hay otro «Título» (el H1 real). Migas y listas con nombres internos: «Hero home › Título», «Header › Texto del botón», «Banco proyectos»; rótulos generados de claves en inglés: «Rótulo del campo company», «Error si generic es demasiado corto», «Texto de ejemplo del campo phone» (`cmsux-43-textos-del-sitio-formulario.png`); «ID interno», «Borrador — la página deja de existir (su URL dará 404)»; servicios listados como «/compuertas»; registro de actividad con «content.field_retired project-gallery.ch-besaya.images», ids nanoid e IP «::1».

**Causa probable:**  
Confirmada: títulos de entrada y rótulos generados a partir de claves técnicas; controles heredados del modelo genérico de entradas.

**Impacto:**  
La persona cambia cosas y no pasa nada, o cambia el «Título» equivocado, y no reconoce qué parte del sitio está tocando: carga cognitiva alta y pérdida de confianza.

**Corrección recomendada:**  
Ocultar «Título», «Dirección» y «Nueva página» en las fichas de página, como ya se hace en «Textos del sitio»; nombres visibles en español llano por ficha («Portada — cabecera», «Menú y cabecera»); rótulos traducidos (Empresa, Correo, Teléfono, Mensaje); derivar y ocultar el id al crear; direcciones completas; registro de actividad legible, con ids e IP en «Detalles técnicos». Test que falle si un rótulo contiene una clave en inglés.

**Validación posterior:**  
Cada control visible produce un cambio comprobable tras publicar; revisión de textos con la persona editora.

### [P2] P2-23 — El cuerpo con formato de servicios y proyectos se edita en Markdown crudo

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/richtext.js:31-43` (botones H2/H3/«Código»), `src/scripts/cms/overlay/markdown.ts:155-165` (el enlace inserta `[texto del enlace]()`)  
**Ruta afectada:** «Editar este servicio/proyecto» → «Cuerpo del texto»; editor en contexto del cuerpo  
**Evidencia:**  
El área muestra `## Proyectos destacados…` y `**C.H. San Pedro**`; el botón de enlace inserta `[texto del enlace]()` para escribir la URL entre paréntesis; hay botón «Código» y rótulos «H2/H3». La vista previa es un modo aparte (`cmsux-28-editor-cuerpo-markdown.png`).

**Causa probable:**  
Confirmada: editor de texto plano sobre Markdown.

**Impacto:**  
Borrar un asterisco o un `#` rompe el formato en el sitio: alta probabilidad de errores en la prosa principal de cada ficha.

**Corrección recomendada:**  
Editor visual que guarde Markdown, o al menos un diálogo propio para enlaces (texto + dirección); quitar «Código»; rotular H2/H3 como «Título de sección/Subtítulo».

**Validación posterior:**  
Prueba con la persona editora: añadir un subtítulo, una negrita y un enlace sin ver símbolos de Markdown.

### [P2] P2-24 — Durante la publicación se pueden abrir otros paneles; el error no explica nada y el resumen no refleja los cambios reales

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/publish.js:189-259`; `src/scripts/cms/overlay/events.js:274-279`, `:544-547`; `cms/services/pendingService.ts:15-32`, `:86-150`; `cms/routes/cmsRoutes.ts:537-542`, `:589-595`, `:645-651`  
**Ruta afectada:** barra → «Publicar cambios» → «Publicar ahora»  
**Evidencia:**  
Con la respuesta de `/api/cms/publish` retrasada 4 s, pulsar «Colecciones» sustituye el aviso «no cierres esta pestaña» por la lista y al terminar el panel salta solo a «No se pudo publicar». El error visible es «El sitio sigue mostrando la versión anterior… avisa a quien administra el CMS» + «Error al procesar la solicitud», sin detalles técnicos; el historial solo dice «Falló». El resumen previo lista cambios ya deshechos y «288 categorías» de la galería; reordenar fotos o borrar una imagen deja el contador en 0 aunque ambos cambian el sitio (`cmsux-60-publicar-resumen.png`).

**Causa probable:**  
Confirmada: la barra no se bloquea durante la publicación; el resultado abre el panel sin comprobar qué hay abierto; el resumen se construye con eventos de auditoría, no con la diferencia real, y los reordenamientos y `media.delete` no están en `ACCIONES_QUE_PUBLICAN`.

**Impacto:**  
Si la persona abre un formulario mientras publica, el resultado lo reemplaza; ante un fallo no sabe qué hacer ni qué decir a soporte; el panel dice «No hay cambios nuevos» cuando sí los hay.

**Corrección recomendada:**  
Mostrar el progreso en la barra sin tocar el panel (o bloquear sus acciones); devolver el `job` también en error y mostrar un motivo en palabras con un identificador para soporte; resumen basado en diferencias reales entre la base y lo último exportado.

**Validación posterior:**  
Publicar con respuesta lenta: la barra no deja abrir otras vistas; forzar un fallo: se ven motivo e identificador; reordenar o borrar una imagen sube el contador.

### [P2] P2-25 — La galería no permite ordenar fotos, álbumes ni categorías desde el panel, aunque la API sí lo soporta

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/gallery.js:380-446` (sin controles de orden); `cms/routes/cmsRoutes.ts:537-649` (`/gallery/{albums,categories,items}/reorder`); `src/data/gallery.ts:50-58` (el sitio ordena por `position`)  
**Ruta afectada:** barra → «Galería» → Imágenes / Álbumes / Categorías; `/galeria`  
**Evidencia:**  
Ninguna vista ofrece subir/bajar ni arrastrar; `grep reorder src/scripts/cms/overlay` → 0.

**Causa probable:**  
Confirmada: funcionalidad de servidor sin interfaz.

**Impacto:**  
La persona no puede decidir qué fotos se ven primero en /galeria ni el orden de los filtros.

**Corrección recomendada:**  
Botones subir/bajar (como en el editor de listas) o arrastrar con alternativa de teclado en las tres vistas.

**Validación posterior:**  
Cambiar el orden en el panel, publicar y comprobarlo en /galeria.

### [P2] P2-26 — «Revisiones» es a ciegas: solo número y fecha, y restaurar revierte la ficha entera

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/admin.js:210-262`; `src/scripts/cms/overlay/events.js:501-543`; `src/scripts/cms/overlay/html.js:27-36`  
**Ruta afectada:** cualquier editor → «Revisiones»  
**Evidencia:**  
La lista muestra «Versión 9 · 25-09-26, 8:03 p. m. · Actual», «Versión 8 · Restaurar»… sin el texto de cada versión ni qué campo cambió. Abierta desde el campo «Título», «Restaurar» devuelve toda la ficha «Hero home» (título, subtítulo, botones…). Desde una ficha de Colecciones, «Volver» cierra el panel entero. Fechas «25-09-26» ambiguas. Combinado con P1-06, restaurar puede devolver contenido de junio.

**Causa probable:**  
Confirmada en el código.

**Impacto:**  
Para recuperar un texto la persona tiene que adivinar la versión y puede deshacer sin querer otros cambios de la misma sección.

**Corrección recomendada:**  
Mostrar el valor (o una diferencia) del campo en cada versión y permitir «Restaurar solo este texto»; «Volver» regresa a la vista de origen; fechas tipo «25 sept. 2026, 20:03».

**Validación posterior:**  
Restaurar el título a una versión anterior sin alterar el subtítulo, viendo el texto antes de restaurar.

### [P2] P2-27 — Cada página responde 200 en varias URL y todo el enlazado interno apunta a la variante no canónica

**Área:** SEO / Integración  
**Ubicación:** `astro.config.mjs:8` (`trailingSlash: 'ignore'`); `cms/staticSite.ts:162-168` (sirve `x` y `x/index.html` sin redirigir), `:190-196` (`new URL(url, base)` convierte `//x` en host), `:111-114`; `public/_redirects:3`; enlaces sin barra en `src/data/nav.ts:47,88-160`, `src/components/projects/ProjectCard.astro:180`, `src/pages/index.astro:111-115,165`, `src/pages/servicios/[slug].astro:92,239,319,324`, `src/pages/proyectos/[slug].astro:148,425,504`; canonical con barra en `src/layouts/BaseLayout.astro:36`  
**Ruta afectada:** las 25 rutas del sitio  
**Evidencia:**  
`/servicios/compuertas` y `/servicios/compuertas/` responden 200 con el mismo HTML (md5 idéntico) y sin `Location`. Los **1.233** `<a href>` internos van sin barra; sitemap, canonical, `og:url` y `BreadcrumbList` usan la barra. `/index.html` y `/servicios/compuertas/index.html` dan 200; `https://hidromontchile.cl//xyz-no-existe` devuelve **la home con 200**; la 301 de `ch-dorias` apunta a la variante sin barra.

**Causa probable:**  
Confirmada: `trailingSlash:'ignore'` con `build.format:'directory'`, componentes que enlazan sin barra y un servidor que no normaliza.

**Impacto:**  
Cada contenido existe en 2–4 URL indexables; el canonical mitiga, pero choca con la señal más fuerte del enlazado interno, y Search Console se llena de «duplicadas». No afecta al visitante.

**Corrección recomendada:**  
Elegir la forma con barra (`trailingSlash: 'always'`); en `serveStaticSite`, 301 de `/ruta` a `/ruta/` cuando exista `ruta/index.html`, 301 de `/…/index.html` al directorio, colapsar `//+` y tratar `/404.html` como 404; cambiar los href internos a la forma canónica; apuntar `_redirects` a `/proyectos/ch-doiras/`.

**Validación posterior:**  
`curl -sI https://hidromontchile.cl/servicios/compuertas` → 301 a la variante con barra; `//x` → 301 o 404; `/index.html` → 301 `/`; un rastreo da 26 URL sin duplicados 200.

### [P2] P2-28 — Hero de la portada en móvil: el antetítulo cian y parte del subtítulo no llegan a 4,5:1 sobre la foto

**Área:** A11y  
**Ubicación:** `src/components/home/Hero.astro:99-104` (velo `rgba(0,0,0,.6)` → `.35` → transparente), `:116-118` (antetítulo #00A6D6 a 12 px), `:132-142` (subtítulo blanco al 90 %)  
**Ruta afectada:** `/` · 390×844 (Chromium y WebKit iPhone 13); casos puntuales en escritorio  
**Evidencia:**  
Contraste calculado píxel a píxel con el texto oculto: en 390, el antetítulo tiene mediana 4,14:1 y el **65 %** de los píxeles por debajo de 4,5 (30 % contando la sombra); el subtítulo, 22 % (mínimos de 2,3:1 sobre la fachada blanca). En 1440 el subtítulo baja a 1,9:1 sobre los tanques blancos (1,5 % de los píxeles). El H1 cumple (`webb-vp-home-390.png`, `webb-vp-home-1440.png`).

**Causa probable:**  
Confirmada: en móvil el velo se desvanece justo donde cae el texto sobre la fachada blanca, y el cian de 12 px se queda corto.

**Impacto:**  
La primera frase del sitio se lee mal en el móvil a pleno sol; incumple 1.4.3 en tramos del texto.

**Corrección recomendada:**  
En móvil, un velo uniforme detrás del bloque de texto (degradado vertical `rgba(15,36,51,.55–.7)` de antetítulo a botones) y el antetítulo en blanco o en un cian más claro (#7FD3EE), manteniendo la estética técnica. Si el CMS cambia la foto de portada, el velo debe seguir garantizando el contraste.

**Validación posterior:**  
0 % de píxeles bajo el umbral en 390, 1280 y 1440 (sin contar la sombra).

### [P2] P2-29 — Cabecera: el submenú «Servicios» se abre al recibir el foco (10 tabulaciones) y el menú móvil deja la página congelada al girar la tablet

**Área:** A11y / Responsive  
**Ubicación:** `src/components/layout/Header.astro:381-384` (`focusin` → `setOpen(true)`), `:386-412`, `:441-458` (`overflow-hidden` en `body`), `:464-466` (Escape solo dentro de `#mobile-menu`)  
**Ruta afectada:** todas las páginas · escritorio ≥ 1024 px (Chromium, WebKit); tablet 820×1180 → 1180×820  
**Evidencia:**  
Con Tab: Inicio → Servicios (se abre) → chevron → 8 servicios → Proyectos: saltarse Servicios cuesta 10 pulsaciones y Shift+Tab lo vuelve a abrir. En WebKit, el clic en el chevron deja el foco en `BODY` y **Escape no cierra el panel**. Con el menú móvil abierto en 820×1180, girar a 1180×820 oculta el menú (`lg:hidden`) pero `body` sigue con `overflow:hidden`: la página queda sin scroll hasta recargar. Si Tab sale del panel móvil, Escape deja de cerrarlo.

**Causa probable:**  
Confirmada: el disclosure se abre también con `focusin`; el `keydown` se escucha en el grupo o en el panel; el estado del menú no se reinicia al cruzar el breakpoint.

**Impacto:**  
Navegación por teclado lenta y confusa; en Safari el submenú queda tapando contenido; una página congelada en tablet tras girar.

**Corrección recomendada:**  
Abrir el submenú con teclado solo mediante el chevron (Enter/Espacio) y conservar `pointerenter` para el ratón; escuchar Escape en `document` mientras un panel esté abierto; `matchMedia('(min-width:1024px)')` → cerrar el menú móvil al cruzar el breakpoint.

**Validación posterior:**  
Tab desde «Inicio» llega a «Proyectos» en 3 pulsaciones; en WebKit, chevron + Escape cierra; tras girar, la rueda desplaza la página.

### [P2] P2-30 — Buscador de /proyectos: los diámetros sin separador de miles y «CH» no encuentran nada, y al volver atrás la lista no respeta el texto del campo

**Área:** Sitio  
**Ubicación:** `src/components/projects/ProjectTable.astro:31-43` (el índice pasa por `formatDiameters` → «Ø 1.600»), `src/pages/proyectos/index.astro:280-288`, `:379-383`, `:397`  
**Ruta afectada:** `/proyectos/` · todos los navegadores  
**Evidencia:**  
«Ø 1.600» → 3 resultados (Embalse Ancoa, C.H. Huasco, Embalse El Bato), pero «1600» y «ø1600» → 0. «C.H. Ralco» → 1, pero «CH Ralco» → 0. Funcionan bien mayúsculas/minúsculas, tildes («colbun» = «COLBÚN» = 4; «biobio» = «Biobío»), cliente y ubicación; `%`, `"` y `<script>` son inertes. Tras buscar «ralco», navegar y volver con Atrás, el campo conserva «ralco» pero se ven 12 de 30 proyectos; el filtro vuelve a «Todos». Ni el filtro ni la búsqueda se reflejan en la URL.

**Causa probable:**  
Confirmada: índice y consulta no se normalizan igual; el script arranca con `searchQuery = ''` sin leer el valor que el navegador restaura.

**Impacto:**  
El público técnico busca por cotas («1600», «DN 800») y recibe «sin resultados» aunque haya obras; la interfaz se contradice al volver atrás y no se puede compartir un enlace filtrado.

**Corrección recomendada:**  
Normalizar ambos lados con la misma función (minúsculas, sin tildes, sin puntos de miles entre dígitos, ø/Ø/⌀ unificados, sin puntuación: `C.H.` → `ch`); leer `search.value` al iniciar y en `pageshow`; guardar `?q=` y `?cat=` con `history.replaceState` (lo que además permite enlazar desde las fichas de servicio, P2-34).

**Validación posterior:**  
«1600», «ø1600» y «Ø 1.600» dan 3; «CH Ralco» da 1; tras volver, las filas visibles coinciden con el campo; `/proyectos/?cat=compuertas` abre filtrado.

### [P2] P2-31 — Se pierde el foco cuando el control enfocado desaparece o se deshabilita («Ver N proyectos más», errores del formulario)

**Área:** A11y  
**Ubicación:** `src/pages/proyectos/index.astro:315`; `src/components/contact/ContactForm.astro:448` (`submitBtn.disabled = true` con el foco en el botón), `:489-497`  
**Ruta afectada:** `/proyectos/`, `/contacto/`  
**Evidencia:**  
En /proyectos, tras el último «Ver 6 proyectos más», el botón se oculta y el foco pasa a `BODY`. En /contacto, al enviar con Enter el foco pasa a `BODY` durante el envío y **sigue ahí tras los errores simulados** (422, 500, 200 con `success:false`, red abortada, offline); en el caso de éxito sí va al mensaje (`webb-contacto-timeout-20s-1280.png` para el estado de envío).

**Causa probable:**  
Confirmada: se oculta o deshabilita el elemento que tiene el foco sin reubicarlo.

**Impacto:**  
Tras un error de envío, quien usa teclado tiene que buscar el botón desde el principio de la página; incumple 2.4.3 en la práctica.

**Corrección recomendada:**  
En /proyectos, mover el foco a la primera fila recién mostrada antes de ocultar el botón; en el formulario, `aria-disabled="true"` con un indicador `isSubmitting` en vez de `disabled`, y al fallar enfocar `#contacto-error` (`tabindex="-1"`) o devolver el foco al botón.

**Validación posterior:**  
Tras cada error simulado el foco no está en `BODY`; tras «Ver más», tampoco.

### [P2] P2-32 — El formulario de contacto no tiene límite de tiempo: si el proveedor no responde, «Enviando…» se queda para siempre

**Área:** Sitio  
**Ubicación:** `src/components/contact/ContactForm.astro:461-468` (`fetch` sin `AbortController`)  
**Ruta afectada:** `/contacto/`  
**Evidencia:**  
Con una respuesta simulada que nunca llega, a los 20 s el botón sigue deshabilitado con «Enviando…», `aria-busy="true"` y «Enviando su consulta, por favor espere…», sin error ni salida (`webb-contacto-timeout-20s-1280.png`). El resto está bien resuelto: contenido conservado tras error, correo alternativo, doble clic = 1 petición, offline con aviso, límite de 3 envíos por sesión, honeypot.

**Causa probable:**  
Confirmada: no hay límite de tiempo en la petición.

**Impacto:**  
En conexiones móviles malas o con FormSubmit degradado, la consulta (la conversión del sitio) queda en un limbo y el usuario no sabe si se envió.

**Corrección recomendada:**  
`AbortController` con un tope de 15–20 s; al vencer, mostrar el aviso de error con el correo directo y reactivar el botón conservando los datos.

**Validación posterior:**  
Con una respuesta colgada, a los 20 s aparece `#contacto-error` y el botón vuelve a estar activo.

### [P2] P2-33 — Los enlaces compartidos a una foto (`/galeria/?foto=N`) fallan cuando N > 24: se abre la foto 1 y la URL se reescribe

**Área:** Sitio  
**Ubicación:** `src/components/gallery/Lightbox.astro:363-386`, `:615-633` (`openFromUrl` en `requestAnimationFrame` antes de que la galería rellene los datos); `src/pages/galeria/index.astro:317` (`set:html="[]"`), `:637`  
**Ruta afectada:** `/galeria/?foto=25…173`  
**Evidencia:**  
Avanzando en el visor hasta «30 / 173», la URL pasa a `?foto=30`; al abrir esa URL aparecen «1 / 24», otra foto y la URL reescrita a `?foto=1` (`webb-lightbox-deeplink-foto30.png`). `?foto=24` funciona; con `?foto=7` la foto es correcta pero el contador dice «/ 24» y → vuelve al principio en la 24.

**Causa probable:**  
Confirmada: carrera entre dos scripts; el visor lee `#lightbox-data` cuando todavía vale `[]` y recurre a las 24 tarjetas del DOM.

**Impacto:**  
«Compartir una foto» solo funciona para 24 de las 173, y quien recibe el enlace ve otra imagen.

**Corrección recomendada:**  
Abrir desde la URL tras la primera carga de datos (evento `gallery:ready`) o leyendo directamente los datos del muro, y localizar la foto por `data-item-id` en vez de por índice; si no existe, no reescribir la URL.

**Validación posterior:**  
`?foto=50` muestra la foto 50 con «50 / 173».

### [P2] P2-34 — Las fichas de servicio no llevan a sus obras: «Ver proyectos» abre el listado general

**Área:** Sitio / SEO  
**Ubicación:** `src/pages/servicios/[slug].astro:310-331` («Obras ejecutadas en {servicio}» → `Button href="/proyectos"`); `src/pages/proyectos/index.astro:258-398` (no lee filtros de la URL)  
**Ruta afectada:** `/servicios/*` (las 8) → `/proyectos/`  
**Evidencia:**  
En compuertas, tanques-especiales, infraestructuras, tuberias-forzadas y valvulas hay 0 enlaces a `/proyectos/<slug>`, aunque «Tanques Especiales» menciona Coyhaique y Puerto Williams y «Compuertas» el Embalse Chacrillas, que tienen ficha. El CTA abre `/proyectos/` sin filtrar. En sentido contrario, las fichas de proyecto sí enlazan al servicio.

**Causa probable:**  
Confirmada: enlace fijo al listado y sin relación servicio → proyectos en los datos (matriz, sección 3).

**Impacto:**  
El CTA promete «obras ejecutadas en X» y entrega 40 obras mezcladas: se pierde la prueba de experiencia en el momento de decisión y enlazado interno útil para SEO.

**Corrección recomendada:**  
Un bloque «Proyectos de referencia» con las `ProjectCard` cuyo `servicio`/`categoria` coincida, y el CTA a `/proyectos/?cat=<categoría>` (requiere P2-30).

**Validación posterior:**  
Cada ficha de servicio tiene al menos un enlace a una ficha de proyecto cuando existe una obra destacada, y el CTA abre la lista filtrada.

### [P2] P2-35 — El vídeo de cabecera de Limpiarrejas pesa 8,1 MB en 1080p, se descarga entero en móvil y también con `prefers-reduced-motion`

**Área:** Performance  
**Ubicación:** `src/components/ui/PageHero.astro:193-225` (`autoplay preload="metadata"`), `:388-400` (en reduced-motion solo `display:none`)  
**Ruta afectada:** `/servicios/limpiarrejas/`  
**Evidencia:**  
`/videos/limpiarrejas-hero.mp4`: 1920×1080, H.264 2,5 Mb/s, 25,7 s, 8,14 MB, pintado a 412×314 CSS en móvil. Con Slow 4G satura el enlace y deja el LCP en 4,58 s (póster de 212 KB). Con `reducedMotion:'reduce'` el vídeo queda oculto pero `readyState = 4` (≈5 MB descargados). Se reproduce bien en Chromium, WebKit e iPhone 13, con botón de pausa (cumple 2.2.2) y Range/206 correctos. Recodificado localmente: 720p −61 %, 480p −81 %. El archivo no está en la biblioteca del CMS: si se cambia, no se puede volver a elegir.

**Causa probable:**  
Confirmada: una sola fuente de 1080p y ocultar con CSS no detiene la carga de un `<video autoplay>`.

**Impacto:**  
8 MB de datos móviles en la página de un servicio, también para quien pidió reducir el movimiento.

**Corrección recomendada:**  
Fuentes por ancho (`<source media>` 480p/720p/1080p, o que el CMS genere las variantes al subir); no poner `autoplay`/`src` en el HTML e inyectarlos solo si `prefers-reduced-motion: no-preference`; póster a la medida.

**Validación posterior:**  
En móvil se descarga ≤ 2 MB de vídeo; con reduced-motion, ninguna petición al `.mp4`; LCP aplicado < 2,5 s.

### [P2] P2-36 — Galería y cabeceras: la imagen LCP de /galeria va con `lazy` y las miniaturas se sirven al doble de lo necesario por falta de escalones pequeños

**Área:** Performance  
**Ubicación:** `src/pages/galeria/index.astro:237-257`, `:388-415`; `cms/services/imageService.ts:21` (solo 640/1024/1600 px); `sizes` de las tarjetas y cabeceras en `src/components/projects/ProjectCard.astro` y `src/components/ui/PageHero.astro`  
**Ruta afectada:** `/galeria/`, fichas de servicio y proyecto, `/proyectos/`, `/`  
**Evidencia:**  
En /galeria las 6 primeras fotos (LCP) llevan `loading="lazy"`, compiten con otras 23 con prioridad baja y el LCP con Slow 4G + CPU 4× es **8,22 s** (Lighthouse: `lcp-lazy-loaded`). Las miniaturas 640w se pintan a 182 px (2× en móvil): 1,1 MB en la carga inicial y **7,7 MB** al llegar al final (173 fotos); con 360w pesarían −78 %. Las cabeceras de ficha usan el derivado 1024w q82 (97–217 KB) y dejan el LCP aplicado en 3,3–4,5 s; con 768w q72 serían −60 %. Lighthouse simulado da 96–100 porque subestima la competencia por ancho de banda; CLS 0 en todo el scroll.

**Causa probable:**  
Confirmada: escalera de derivados sin tamaños pequeños ni intermedios y `lazy` aplicado también a las primeras tarjetas.

**Impacto:**  
La página con más imágenes tarda mucho en mostrar su contenido en móvil lento y consume datos innecesarios.

**Corrección recomendada:**  
Añadir derivados 360w y 768w (y calidad 72–75); `loading="eager"` + `fetchpriority="high"` en las primeras 2–4 tarjetas visibles; `sizes` exactos por componente.

**Validación posterior:**  
LCP de /galeria con Slow 4G < 3 s; peso al fondo de la galería < 3 MB; Lighthouse sin `lcp-lazy-loaded`.

### [P2] P2-37 — El visor de la galería descarga cada foto dos veces en móvil

**Área:** Performance  
**Ubicación:** `src/components/gallery/Lightbox.astro:440-474`  
**Ruta afectada:** `/galeria/` (visor)  
**Evidencia:**  
En móvil precarga la variante 1024w pero muestra la 1600w: en 5 fotos se descargan 891 KB, de ellos 341 KB en precargas que nunca se muestran; «siguiente» tarda 2,16 s y 1,19 s en fotos con srcset frente a 41–43 ms en las que no lo tienen.

**Causa probable:**  
Confirmada: la precarga elige el candidato con un criterio distinto del que usa el `<img>` visible.

**Impacto:**  
Navegar el visor en móvil es lento y gasta el doble de datos.

**Corrección recomendada:**  
Precargar con el mismo `srcset`/`sizes` que el `<img>` (p. ej. creando un `Image()` con esos atributos) o elegir explícitamente el mismo candidato.

**Validación posterior:**  
Cada foto del visor se descarga una sola vez; «siguiente» con la vecina precargada < 150 ms.

### [P2] P2-38 — Logos sin optimizar: el de la cabecera mide 1.181 px en todas las páginas y los de clientes son PNG de hasta 3.840 px

**Área:** Performance  
**Ubicación:** `src/components/layout/Header.astro:81-99`; `src/components/home/ClientsStrip.astro:84-114`; `src/components/clientes/ClientesHero.astro:150-178`; `src/data/cliente-logos.ts`  
**Ruta afectada:** todas (logo de cabecera), `/`, `/clientes/`  
**Evidencia:**  
`logo_hidromont…webp` de 1181×708 (67 KB) se pinta a 107–133 px en todas las páginas y es el elemento LCP de /contacto y /clientes (a 266 px pesaría 10 KB). La franja de la home y el carrusel de /clientes cargan los PNG originales: 24 logos, **1,3 MB** en la home; `endesa.png`, `iberdrola.png` y `ferrovial.png` miden 3.840 px (171, 120 y 108 KB) para 150×48; `electrica-puntilla.png` pesa 470 KB. El export ya genera derivados para esos campos y la cuadrícula de /clientes los usa, pero la franja y el carrusel no.

**Causa probable:**  
Confirmada: esos componentes leen la ruta cruda con `getClienteLogoByNombre` sin pasar por `getCmsImageDerived`; el logo de cabecera no tiene una variante a su tamaño.

**Impacto:**  
~1,3 MB de más en la página más visitada y 67 KB en cada página; más datos en móvil.

**Corrección recomendada:**  
Usar los derivados (o uno dedicado de ~320 px) en la franja y el carrusel; variante de 266 px del logo de cabecera; recortar los PNG fuente a ~600 px.

**Validación posterior:**  
Peso total de logos en `/` < 200 KB; ningún `<img>` de logo apunta a un archivo > 50 KB; logo de cabecera < 15 KB.

---

## 7. Hallazgos de pulido P3

Los P3 se agrupan por causa raíz; cada grupo lista sus casos concretos.

### [P3] P3-01 — Endurecimiento de seguridad pendiente (sin vulnerabilidad explotable hoy)

**Área:** Seguridad  
**Ubicación:** `cms/config/unifiedConfig.ts:69-75`, `cms/server.ts:131`, `cms/services/authService.ts:79-102`, `:148-158`, `cms/middleware/security.ts:26-43`, `cms/services/mediaService.ts:84-99`, `:222-306`, `deploy/Caddyfile:47-76`  
**Ruta afectada:** `/api/cms/*`, `/uploads/cms/*`, todas (cabeceras)  
**Evidencia:**

- `CMS_TRUST_PROXY=1` se traduce en `trustProxy: true`, que confía en toda la cadena de `X-Forwarded-For`. Directo contra Fastify, `XFF: 203.0.113.7` → `req.ip=203.0.113.7`. **Detrás de Caddy no es explotable:** con un Caddy 2.10 local y la misma configuración que `deploy/Caddyfile`, un XFF falsificado llega a Fastify sustituido por la IP real (`{"ip":"127.0.0.1","xff":"127.0.0.1"}`). El límite de intentos de login funciona hoy; se rompería si se pusiera un proxy que añada en vez de sustituir (p. ej. Cloudflare en modo proxy).
- `bcryptjs` (JS puro, coste 12, ~200 ms) corre en el mismo hilo que sirve el sitio: 8 logins concurrentes producen ~800 ms de retraso del bucle de eventos. Con el límite por IP funcionando, un DoS necesita muchas IP.
- Sesiones de 7 días sin caducidad por inactividad y sin tope de sesiones simultáneas (el logout y el cambio de contraseña sí invalidan en el servidor).
- `Access-Control-Allow-Methods/Headers` en todas las respuestas, incluido el HTML público (sin reflejar orígenes no permitidos: correcto).
- La API responde también en `hidromontchile.cl`, donde no la necesita nadie (ver P2-01).
- Los rásteres subidos se guardan con sus bytes originales: el EXIF/GPS se conservaría (hoy 0 fotos con GPS), un SVG con `<script>` subido como `.png` se acepta (lo neutralizan `nosniff` y el `Content-Type` por extensión) y un «MP4» con cabecera `ftyp` y HTML pasa `esVideoReal`.

**Causa probable:**  
Confirmada en el código; valores por defecto pensados para un único administrador.

**Impacto:**  
Bajo hoy; son controles que dependen de condiciones externas (el proxy, `nosniff`) o que limitan el daño de una sesión robada.

**Corrección recomendada:**  
`trustProxy: '127.0.0.1'` (o `1`) y Fastify ≥ 5.12.1; límite adicional por cuenta; bcrypt nativo o argon2 fuera del hilo principal; caducidad por inactividad y «cerrar todas las sesiones»; CORS solo en `/api/cms/*`; que `hidromontchile.cl` devuelva 404 a `/api/*`; recomprimir o normalizar los rásteres con sharp (quita EXIF y polyglots) y sanear SVG por contenido, no por MIME. Las decisiones del propietario sobre `basic_auth`/IP y sobre el usuario root no se cuestionan aquí.

**Validación posterior:**  
Directo contra Fastify, un XFF falso ya no cambia `req.ip`; 50 logins concurrentes no degradan una página pública; una foto con GPS sale sin EXIF; el HTML público no lleva `access-control-*`.

### [P3] P3-02 — Restos de despliegues anteriores publicados y código muerto

**Área:** Arquitectura / Seguridad  
**Ubicación:** `public/_headers`, `public/_redirects`, `public/.htaccess`, `cms/staticSite.ts:153-172`, `cms/security/headers.ts:59`; `scripts/build-cms-overlay.mjs`, `deploy-ftp.mjs`, `pack-deploy.mjs`, `instalar-deps-servidor.mjs`, `probar-wasm.mjs`, `normalize-photo-filenames.mjs`, `curate-and-optimize-images.mjs`, `curate-images-smart.mjs`, `generate-images.mjs`; `cms/scripts/seed-gallery.ts`, `fix-album-covers.ts`; `server.mjs:1-14`, `cms/server.ts:13-37`; `package.json` (`deploy:ftp`, `pack:deploy`, `probar:wasm`)  
**Ruta afectada:** `/_headers`, `/_redirects`, `/.htaccess`  
**Evidencia:**  
En producción `GET /_headers` → 200 (3.702 B, con la CSP completa y comentarios internos como «Pendiente: mover el bootstrap del overlay…»), `/_redirects` → 200, `/.htaccess` → 200, todos `application/octet-stream`. `build-cms-overlay.mjs` comprueba archivos que no existen; ocho scripts no tienen referencias; los de cPanel/FTP suman ~900 líneas más 458 de `DESPLIEGUE-CPANEL.md`. La CSP permite `https://api.web3forms.com`, que nada usa. En local, `_deploy/` guarda 526 MB de zips de cPanel con una base y un `.env` (fuera de git).

**Causa probable:**  
Confirmada: cada migración de hosting dejó sus herramientas.

**Impacto:**  
Ruido de mantenimiento, configuración muerta publicada (divulgación menor) y una CSP más amplia de lo necesario.

**Corrección recomendada:**  
Devolver 404 a esos nombres en `serveStaticSite` o sacarlos de `public/` (las redirecciones pueden leerse de una ruta no pública); archivar los scripts sin referencias; quitar web3forms de `connect-src` y `form-action`; borrar `_deploy/`.

**Validación posterior:**  
`curl -o /dev/null -w '%{http_code}' https://hidromontchile.cl/_headers` → 404; ningún script de `scripts/` sin referencias.

### [P3] P3-03 — Caché y cabeceras HTTP mejorables

**Área:** Performance / Integración  
**Ubicación:** `cms/staticSite.ts:124-151` (HEAD), `:198-221` (`cacheControlFor`), mapa de tipos `:8-28`  
**Ruta afectada:** `/og/og-default.jpg`, `/logos-clientes/*`, `/logo.svg`, `/fotos/*`, `/fonts/*`, todo el HTML  
**Evidencia:**  
Toda `.webp/.png/.jpg/.svg` sale `public, max-age=31536000, immutable` sin mirar la ruta; en git se reemplazaron en sitio `public/og/og-default.jpg` (`2a5cc88`) y 14 logos de cliente. HTML con `no-cache` pero sin `ETag` ni `Last-Modified`: cada visita repite la descarga completa. Fuentes con `max-age=600`, sin validadores y como `application/octet-stream`. `HEAD` responde `content-length: 0` en todo el sitio (`curl -sI …/og/og-default.jpg` → 0 frente a 31.288 con GET).

**Causa probable:**  
Confirmada en el código (la causa exacta del `content-length: 0` en HEAD —Fastify o Caddy— no está confirmada).

**Impacto:**  
Quien vuelve puede ver un logo o una imagen de portada viejos durante meses; transferencia evitable; verificadores de enlaces y validadores de OG que usan HEAD ven 0 bytes.

**Corrección recomendada:**  
`immutable` solo para `/_assets/`, `/gallery/derived/` y `/uploads/cms/` (nombres con hash o nanoid); el resto de `public/` con `max-age=86400` o con hash en el nombre; `ETag`/`Last-Modified` a partir del `stat` con respuesta 304; fuentes `font/woff2` con caché de un año; HEAD con la longitud real.

**Validación posterior:**  
`curl -sI …/logo.svg` no es `immutable`; `curl -sI -H 'If-None-Match: <etag>' …/` → 304; `content-type: font/woff2`; HEAD y GET con la misma `content-length`.

### [P3] P3-04 — Configuración frágil: límites duplicados y el CMS depende de devDependencies

**Área:** Arquitectura  
**Ubicación:** `cms/config/unifiedConfig.ts:76-79`, `:92`; `deploy/Caddyfile:29`, `:54`; `src/scripts/cms/overlay/dropzone.js:19`, `:24`; `cms/routes/cmsRoutes.ts:47`, `:81`; `cms/test/setup.ts:118`; `cms/services/exportService.ts:4`, `:79`; `cms/services/publishService.ts:166`; `.npmrc:1-4`; `package.json`  
**Ruta afectada:** —  
**Evidencia:**  
8 MB y 60 MB están en la config; Caddy los traduce a mano a 12 y 64 MB, el overlay los escribe como texto («hasta 8 MB») y el arnés de pruebas fija 8 MB. `CMS_ALLOW_GALLERY_SHRINK` se lee fuera de la config central. El comentario del reaper («un publish sano tarda < 120 s») no cuadra con el timeout de 600 s. `exportService.ts` importa `prettier` (devDependency) al cargar el módulo y publicar requiere `astro` (dev): con `npm ci --omit=dev` el CMS no arranca; lo sostiene `include=dev` en `.npmrc`. `publishCheckCommand.split(' ')` rompe un comando con argumentos entrecomillados.

**Causa probable:**  
Confirmada.

**Impacto:**  
Hoy no hay divergencia; basta cambiar una variable o limpiar dependencias para que el panel mienta o el servicio no arranque.

**Corrección recomendada:**  
Exponer los límites en `GET /api/cms/schema` y que el overlay los lea; test que compare config y `Caddyfile`; leer toda variable en `unifiedConfig.ts`; `prettier` y `astro` en `dependencies` o importación dinámica; comando de publicación como lista de argumentos.

**Validación posterior:**  
`npm ci --omit=dev && node server.mjs` arranca; test de límites en verde.

### [P3] P3-05 — Ruido y huecos menores en la cadena de calidad

**Área:** Pruebas  
**Ubicación:** `src/components/cms/CmsOverlay.astro:1-33`, `src/layouts/BaseLayout.astro:36`, `package.json` (`lint`), `.gitignore`, `e2e/*.spec.ts`  
**Ruta afectada:** —  
**Evidencia:**  
Cada arranque del servidor de desarrollo en las e2e imprime `[vite] Failed to scan for dependencies … Expected ";" but found "{"` (comillas invertidas en comentarios del frontmatter) con re-optimización a mitad de la suite. `npm run lint` usa `--ext .js,.ts,.astro` y deja fuera los 17 `scripts/*.mjs` y `server.mjs` (3.528 líneas). `coverage/` no está en `.gitignore`. Cinco `waitForTimeout` fijos en e2e.

**Causa probable:**  
Confirmada.

**Impacto:**  
Inestabilidad y ruido que ocultan errores reales en la salida.

**Corrección recomendada:**  
Añadir `.mjs` al lint y `coverage/` a `.gitignore`; esperas por condición; reescribir esos comentarios o fijar `optimizeDeps.entries`.

**Validación posterior:**  
La salida de Playwright no contiene `[ERROR] [vite]`; el lint lista los `.mjs`.

### [P3] P3-06 — SEO técnico: señales contradictorias, descriptions largas y vistas previas pobres

**Área:** SEO  
**Ubicación:** `astro.config.mjs:13` (`sitemap()` sin `filter`); `src/pages/contacto/gracias.astro:16`; `src/layouts/BaseLayout.astro:36-56`, `:104-120`; `src/pages/404.astro:18`; `src/pages/proyectos/[slug].astro:134-137`; `src/pages/servicios/[slug].astro:58-62`, `:83`  
**Ruta afectada:** `/contacto/gracias/`, `/404`, `/404.html`, 10 fichas de proyecto, 8 de servicio, home  
**Evidencia:**

- `sitemap-0.xml` incluye `/contacto/gracias/`, que es `noindex`; la 404 declara canonical `/404/` (que responde 404); `/404.html` responde 200; el sitemap no trae `lastmod`.
- 14 de 26 descriptions superan 160 caracteres (hasta 335: Embalse Chacrillas), porque las fichas reutilizan el `alcance` o el `resumen` completos; 3 títulos > 60 caracteres; `/galeria/` se queda en 81.
- `og:image` de proyectos pequeñas o verticales (ch-besaya 429×491, ch-doiras 441×259, ch-los-condores 1086×1448, tanques 1200×1600…), todas `.webp`, sin `og:image:width/height/alt`; las 8 fichas de servicio usan la imagen por defecto.
- JSON-LD: `Service.provider.name` «Hidromont Chile» frente a `Organization.name` «Hidromont Chile S.A.», sin `@id` que los una; sin `LocalBusiness` pese a tener dirección y teléfono.

**Causa probable:**  
Confirmada: integración de sitemap sin filtro, canonical siempre emitido, reutilización de campos de contenido como metadatos.

**Impacto:**  
Avisos en Search Console, snippets truncados o reescritos y vistas previas pobres en WhatsApp/LinkedIn. Bajo.

**Corrección recomendada:**  
`sitemap({ filter })` que excluya las páginas `noindex`; no emitir canonical con `noindex`; campo opcional `seoDescription` por ficha y recorte por frase a ≤ 155; OG de 1200×630 en JPG generada en el build con el punto focal existente; `@id` en `Organization` y `provider: {'@id': …}`; valorar `LocalBusiness`.

**Validación posterior:**  
El sitemap no contiene `gracias`; la 404 no tiene canonical; 0 descriptions > 160; todas las OG ≥ 1200×630 y horizontales; Rich Results Test sin avisos.

### [P3] P3-07 — El favicon es el logotipo completo: 142 KB, 2,2:1, ilegible a 32 px, y no hay `/favicon.ico`

**Área:** SEO / Performance  
**Ubicación:** `public/favicon.svg` (idéntico a `public/logo.svg`), `src/layouts/BaseLayout.astro:123`  
**Ruta afectada:** todas  
**Evidencia:**  
`md5(favicon.svg) = md5(logo.svg)`, 142.250 B, `viewBox="0 0 1500 675"`; a 32×32 se ve un rótulo ilegible (`weba-favicon_32_zoom.png`); `/favicon.ico` → 404 con 46 KB de HTML. El `apple-touch-icon.png` sí es correcto (180×180, cuadrado).

**Causa probable:**  
Confirmada: se copió el logo como favicon.

**Impacto:**  
Icono de pestaña ilegible; Google exige un favicon cuadrado para mostrarlo en resultados; 142 KB en la primera visita.

**Corrección recomendada:**  
`favicon.svg` cuadrado con solo el isotipo (el del apple-touch-icon), de pocos KB, y un `favicon.ico` de 48×48.

**Validación posterior:**  
`/favicon.ico` → 200 `image/x-icon`; `favicon.svg` < 10 KB con `viewBox` cuadrado.

### [P3] P3-08 — Residuos de datos: derivados huérfanos, imágenes sin uso, respaldos incompletos y una base local contaminada

**Área:** Contenido / CMS  
**Ubicación:** `cms/services/imageService.ts:29-118`, `public/gallery/derived/`, `public/fotos/`, `public/logos-clientes/`, `uploads/cms/`, `cms/repositories/ContentRepository.ts:350-385`, `cms/services/backupService.ts:12-31`, `cms/services/exportService.ts:246-252`, `:522-531`, tabla `gallery_categories` y entrada `galeria.items` de `cms/data/hidromont-cms.sqlite` (local)  
**Ruta afectada:** `/gallery/derived/*`; panel; `src/data/gallery.json` si se publica desde la base local  
**Evidencia:**

- 48 derivados sin referencia (4,7 MB) versionados y desplegados; los de fotos reemplazadas o borradas se acumulan y siguen siendo accesibles.
- 5 fotos de `public/fotos` y 11 logos sin uso; 18 `.jp2` (6,5 MB) en `uploads/cms` sin fila en la biblioteca y no servibles en la mayoría de navegadores; 13 duplicados exactos (1,9 MB).
- 28 de 70 campos de imagen o vídeo publicados no tienen fila en `media_usages` (base local): el panel diría «sin uso» y dejaría borrar sin aviso.
- El respaldo del panel solo copia la base (sin fotos), no se puede restaurar desde el CMS, no rota (59 archivos) e incluye la tabla `sessions`; el panel dice «descárgala» sin botón para hacerlo.
- Base local: 41 categorías de galería de prueba («Teclado 1790…», «Repintado 1790…», «Axe 1790…», creadas el 22–23 sep por e2e antes del sandbox) que la primera publicación añadió a `gallery.json` en la copia (+246 líneas); y la ficha `galeria.items` (borrador, 90 rutas inexistentes) que provoca «⚠ vuelve al texto por defecto: galeria.items» en **cada** publicación.
- Una foto de galería cuya imagen se borró desaparece del sitio y la publicación termina «succeeded» sin mencionarlo.

**Causa probable:**  
Confirmada: nadie recolecta derivados; los usos solo se registran al editar (existe `cms:backfill-media-usages`, sin ejecutar en esta base); pruebas antiguas contra la base de desarrollo; `galeria.items` no está en `ENTRADAS_RETIRADAS`.

**Impacto:**  
~13 MB de peso de despliegue sin uso, avisos de «en uso» poco fiables, una advertencia permanente que enseña a ignorar advertencias y riesgo de llevar basura a producción con `sync-datos-vps.sh` (P1-06).

**Corrección recomendada:**  
Borrar al exportar los derivados que no referencien `gallery.json` ni `cms-content.json`; retirar los `.jp2` y los logos sin uso; ejecutar el backfill de usos en el servidor y registrar el vídeo en la biblioteca; limpiar las 41 categorías y añadir `galeria.items` a `ENTRADAS_RETIRADAS`; respaldo con rotación, sin sesiones y con procedimiento de restauración (y de `uploads/`); incluir en el resultado de la publicación las fotos sin imagen. Comprobar lo mismo en la base del VPS.

**Validación posterior:**  
Derivados sin referencia = 0; campos sin uso registrado = 0; `select count(*) from gallery_categories` = 8; publicar sin cambios no muestra advertencias.

### [P3] P3-09 — Consistencia de contenido: nombres, notación y datos sueltos

**Área:** Contenido  
**Ubicación:** `src/pages/proyectos/[slug].astro:169` (cuerpo Markdown sin `formatDiameters`), `src/pages/servicios/[slug].astro:60`, `src/components/contact/LocationCard.astro:27`, `src/layouts/BaseLayout.astro:47-54`, `src/content/proyectos/*.md` (`cliente`, `mandante`), tabla `gallery_albums`, `src/data/cms-content.json` (`proyectos.index.hero.seoDescription`, enlace `mailto`), `src/pages/proyectos/[slug].astro:97-115` (`servicioHref`)  
**Ruta afectada:** `/proyectos/ch-doiras`, `/proyectos/embalse-chironta`, `/servicios/turbinas`, `/proyectos/`, `/contacto/`, `/galeria/`, JSON-LD  
**Evidencia:**

- `/proyectos/ch-doiras` muestra «DN 2.700» en la ficha técnica y «DN 2700» en el texto; `/servicios/turbinas`, «DN 1600». Ø con miles, «m» y «t» son coherentes; no aparecen «mts» ni «ton».
- 12 variantes de clientes de la lista en los proyectos («Colbún S.A.» en 4, «Constructora OHL», «Minera El Toqui» frente a «Nyrstar – El Toqui»…), 11 fuera de la lista y 7 clientes de la lista sin ningún proyecto.
- 8 álbumes con nombre distinto al de su ficha («Pangal» / «C.H. Pangal», «Sifones BioBío Sur» / «Sifones Canalistas Biobío Sur»…); C.H. Chacayes, Lican y Trueno están en /galeria sin ficha.
- Embalse Chironta (válvulas y tubería) enlaza a «Compuertas».
- La description de /proyectos promete «más de 80 proyectos» y el banco lista 40; el asunto del `mailto` de Contacto dice «Consulta desde Hidromont.cl».
- «Hidromont Chile S.A.» (184 veces) y «Hidromont Chile» (114) sin regla; el destino del mapa y la localidad del JSON-LD son literales.

**Causa probable:**  
Confirmada: `formatDiameters` no se aplica al Markdown; `cliente` y `project_slug` son texto libre; datos de empresa copiados en el código.

**Impacto:**  
Incoherencias visibles menores y una búsqueda por cliente en /proyectos que no casa con /clientes.

**Corrección recomendada:**  
Normalizar DN y Ø en origen (una vez) o con un plugin remark; normalizar los nombres de cliente en los proyectos (o relación opcional con la lista); alinear nombres de álbum; revisar el servicio de Chironta, la cifra de 80 y el asunto del `mailto`; derivar mapa y JSON-LD de `site.company`; fijar una regla marca/razón social.

**Validación posterior:**  
`grep -oE "DN [0-9]{4}\b"` en el HTML de producción = 0; script que liste clientes de proyectos que no casan con la lista = 0 (o solo los intencionados).

### [P3] P3-10 — Accesibilidad menor del sitio

**Área:** A11y  
**Ubicación:** `src/components/layout/Footer.astro:118-125`, `:155-189`, `:262-290`; `src/styles/base.css:65-67`, `:202-227`; `src/components/ui/PageHero.astro:90`, `:110-155`; `src/components/contact/ContactInfo.astro:62`, `:84`; `src/pages/galeria/index.astro:211-226`, `:499-529`; `src/components/gallery/Lightbox.astro:322-328`; `src/components/projects/ProjectFilters.astro:22-27`; `src/pages/proyectos/index.astro:26-28`, `:59-63`; `src/components/projects/ProjectTable.astro:88`  
**Ruta afectada:** pie (todas), fichas (migas), `/contacto/`, `/proyectos/`, `/galeria/`, `/servicios/`  
**Evidencia:**

- En escritorio los títulos del pie (`<summary>`) siguen siendo tabulables y Enter pliega la columna hasta recargar.
- Placeholders a 2,54:1 (#9CA3AF sobre blanco) en el formulario y los buscadores.
- Objetivos táctiles < 44 px en móvil: migas 52×16, «Google Maps» 120×30, «Waze» 78×30, enlaces del pie de 24 px (cumplen los 24 px de AA salvo las migas, por la excepción de espaciado).
- Con el espaciado de texto de 1.4.12 a 320 px, el H1 de /servicios se recorta («hidromecánico»).
- Galería: el menú de categorías no se cierra al salir con Tab, las 9 opciones son tabulables y con el visor abierto el `footer` no es `inert`.
- /proyectos: filtros dentro de un `<nav>` y `radiogroup` sin nombre; «Mostrando 1 de 1 proyectos.»; «España» da 0 aunque el subtítulo del banco la menciona; las filas se tiñen al pasar el ratón sin ser clicables.
- Sin `scroll-padding-top`: al retroceder con Shift+Tab en /galeria, fotos enfocadas quedan ~98 px bajo la cabecera (cumple 2.4.11 AA, no 2.4.12 AAA).

**Causa probable:**  
Confirmada en cada caso (detalles de marcado y estilos).

**Impacto:**  
Fricción para teclado, lector de pantalla y uso táctil; ninguno bloquea una tarea.

**Corrección recomendada:**  
Encabezado estático en el pie de escritorio; `::placeholder { color: var(--color-text-muted) }`; `min-h-[44px]` en migas y botones de mapas; `overflow-wrap: anywhere` en los H1 del hero; `focusout` y tabindex itinerante en el menú de la galería y `footer` en `getInertTargets()`; `div role="radiogroup" aria-label="Filtrar por categoría"`, plurales correctos y alcance de búsqueda explicado; `html { scroll-padding-top: 6.5rem }`.

**Validación posterior:**  
Repetir las mediciones de foco, objetivos y contraste de placeholders; Tab no se detiene en los títulos del pie; `footer[inert]` con el visor abierto.

### [P3] P3-11 — Accesibilidad menor del CMS

**Área:** A11y / CMS  
**Ubicación:** `src/scripts/cms/overlay/collections.js:104-107`, `:374`; `src/scripts/cms/overlay/gallery.js:35-44`, `:199`, `:296`; `src/scripts/cms/overlay/fields.js:105`, `:161`, `:220-231`; `src/scripts/cms/overlay/encuadre-ui.js:97`; `src/scripts/cms/overlay/events.js:599-617`; `src/scripts/cms/overlay/list-editor.js:26-48`; `src/scripts/cms/overlay/panel.js:81-91`; `src/components/home/ClientsStrip.astro:74-105`; `src/scripts/cms/mobile-menu.ts:195-203`  
**Ruta afectada:** panel del CMS  
**Evidencia:**

- Pestañas de Colecciones sin `aria-current`/`aria-selected` (Galería sí lo tiene).
- Marco de encuadre: `aria-label` en un `div` sin rol (única violación de axe en todo el panel).
- Selector de iconos con `role="radio"` sin navegación por flechas (8 paradas de Tab).
- `pattern="[a-z0-9._-]+"` inválido con la bandera `v` de Chrome: el navegador ignora la validación de «ID interno» e identificadores (error en consola).
- Botones de mover/quitar en listas de 32 px (40 px en móvil); campos que muestran ~20 caracteres en móvil.
- Al abrir un campo el cursor queda al principio y lo tecleado se antepone (se guardó « xIngeniería…»).
- La franja de logos sigue moviéndose en modo edición y cuesta pulsar el logo a cambiar.
- El lanzador móvil muestra «Editar sitio» con `aria-label` «Abrir menú para editar el sitio» (2.5.3).

**Causa probable:**  
Confirmada en cada caso.

**Impacto:**  
Fricción con teclado, lector de pantalla y voz; errores de tecleo silenciosos.

**Corrección recomendada:**  
`aria-current` en las pestañas; `role="group"` y texto vivo en el encuadre (o dos deslizadores); tabindex itinerante en los iconos; escapar el `-` en los `pattern`; objetivos ≥ 44 px en táctil; cursor al final (o seleccionar todo en campos cortos); pausar animaciones con la clase `hm-cms-sesion`; nombre accesible que empiece por el texto visible.

**Validación posterior:**  
axe sin violaciones en el editor de imagen; sin errores de `pattern` en consola; `selectionStart === value.length` al abrir un campo.

### [P3] P3-12 — Pulido del CMS: comportamientos poco explicados o con mensajes técnicos

**Área:** CMS  
**Ubicación:** `src/scripts/cms/overlay/fields.js:145-150`, `:592-598`; `src/scripts/cms/overlay/admin.js:147-153`; `src/pages/index.astro:274`; `cms/services/contentService.ts:38`; `src/pages/proyectos/[slug].astro:24-30`, `:88-92`, `:293-393`; `cms/validators/cms.schema.ts:62`, `:68`; `src/scripts/cms/overlay/events.js:1148-1151`; `src/scripts/cms/overlay/collections.js:503-508`; `cms/services/publishService.ts:49-56`  
**Ruta afectada:** panel; `/`, `/proyectos/<slug>`  
**Evidencia:**

- «Ruta del archivo» (opciones avanzadas) acepta rutas inexistentes: `/fotos/no-existe.jpg` → «Guardado.» y cabecera vacía tras publicar; no hay «volver a la imagen original».
- Un destacado nuevo (orden 100) no llega a la home, que muestra los 6 primeros por orden; el panel no lo explica.
- Pasar un proyecto de destacado a banco elimina su página (404) sin redirección (el rótulo sí lo anticipa).
- Un nombre de proyecto de más de 240 caracteres aborta **todo** el guardado con «title: No puede superar 240 caracteres.» (el formulario copia el nombre al título oculto).
- Valores de solo espacios cuentan como rellenos: `mandante="   "` muestra «Mandante» vacío y **oculta el cliente**; `normas` con espacios pinta una insignia vacía.
- Publicar dos veces a la vez: el bloqueo funciona, pero el segundo intento dice «Error al procesar la solicitud».

**Causa probable:**  
Confirmada en cada caso.

**Impacto:**  
Sorpresas y mensajes técnicos en tareas corrientes.

**Corrección recomendada:**  
Validar que la ruta existe en la biblioteca y ofrecer «Usar la imagen original»; ayuda en «Destacado» y «Orden»; confirmación y 301 propuesta al pasar a banco; recortar el título oculto o aplicar el mismo límite con aviso junto a «Nombre»; `trim()` al guardar y al pintar; patrón `en curso` → 409 con el mensaje real.

**Validación posterior:**  
Cada caso da un aviso comprensible o se comporta como la persona espera.

### [P3] P3-13 — Pulido visual y de contenido del sitio público

**Área:** Sitio  
**Ubicación:** `src/assets/logo/logo_hidromont.png` (columna x=0 opaca), `src/components/layout/Header.astro:81-100`; `src/components/layout/Footer.astro:216-222` (`break-all`); `src/components/contact/ContactForm.astro:111-122`, `:172-179`, `:214-228`, `:298-303`; `src/pages/contacto.astro:55-66`; `src/data/nav.ts:165`; `src/pages/servicios/[slug].astro:241`, `:254-307`, `:324`; `src/pages/proyectos/[slug].astro:447-501`  
**Ruta afectada:** todas (logo, pie), `/contacto/`, `/servicios/*`, `/proyectos/*`  
**Evidencia:**

- Línea vertical parásita a la izquierda del logo en todas las cabeceras (raya blanca sobre el hero por el filtro `invert`).
- El correo del pie se parte en «hidromont@hidromont.» / «cl» a 1280–1440 px (`webb-full-servicios_compuertas-1440.png`).
- El aviso de error del formulario toca el botón; la dirección aparece 3 veces en /contacto móvil; el mismo destino se rotula «Contáctenos», «Contactar», «Contacto» y «Ponerse en contacto».
- El mensaje se trunca en silencio a 2.000 caracteres; un nombre de tres espacios se da por válido; el teléfono acepta `abc<>!!`.
- Fichas desiguales: 3 de 8 servicios y 5 de 10 proyectos con galería; cuerpos de 258 a 1.928 caracteres; las miniaturas de galería de ficha no se pueden ampliar.

**Causa probable:**  
Confirmada: recorte defectuoso del PNG, CSS de corte, componentes y textos editados por separado.

**Impacto:**  
Sensación de acabado menos cuidado; consultas largas que pierden el final sin aviso.

**Corrección recomendada:**  
Limpiar la columna 0 del PNG y regenerar variantes; `overflow-wrap:anywhere` en el correo; `mt-4` en `#contacto-error`; unificar el CTA en uno o dos rótulos; contador «n / 2000», `trim()` y `inputmode="tel"`; reutilizar el `Lightbox` en las galerías de ficha; plantilla mínima común de contenido por ficha.

**Validación posterior:**  
Capturas de cabecera y pie sin defectos; aviso al superar 2.000 caracteres; clic en una miniatura de ficha abre el visor.

### [P3] P3-14 — Performance menor

**Área:** Performance  
**Ubicación:** `src/pages/galeria/index.astro` (LQIP en línea), `src/components/ui/PageHero.astro`, `src/components/projects/ProjectCard.astro` (`sizes`), `src/styles/global.css`, `src/components/contact/ContactInfo.astro` / `LocationCard.astro` (iframe), `src/components/home/Hero.astro`  
**Ruta afectada:** `/galeria/`, `/`, `/servicios/`, `/contacto/`  
**Evidencia:**

- 61 KB de LQIP en base64 que no se usan dentro del HTML de /galeria (pasaría de 69 a 27 KB comprimido).
- `sizes` ausentes o inexactos en banners y tarjetas (`0fc8b6b3-1600.webp` pintado a 554 px en /servicios).
- CSS único de 12,5 KB comprimido con ~80 % sin usar en cada página.
- Google Maps en /contacto de escritorio: 75 peticiones y 691 KB sobre el pliegue (en móvil no se carga).
- La foto de portada de la home en móvil se amplía ×4,4 y se ve borrosa (nitidez, no peso).
- Con Slow 4G la primera vista se pinta con la fuente de respaldo aunque Inter va en preload (`font-display: optional`).

**Causa probable:**  
Confirmada en las mediciones; la del recorte de la portada, no confirmada en código.

**Impacto:**  
Bajo; mejoras de peso y nitidez.

**Corrección recomendada:**  
Quitar el LQIP no usado; `sizes` exactos; valorar CSS por página si crece; mapa como fachada clicable (imagen estática + «Abrir mapa»); recorte y variante móvil de la portada.

**Validación posterior:**  
HTML de /galeria < 30 KB comprimido; /contacto de escritorio < 20 peticiones antes de interactuar con el mapa.

---

## 8. CMS

**Qué administra y cómo.** Todo el contenido visible del sitio sale del CMS (574 de 578 claves exportadas se leen en el build; las 4 restantes son condicionales legítimas). La edición es en contexto: se pulsa un texto o una imagen de la propia página publicada en `editor.hidromontchile.cl` y se abre un panel lateral; hay además fichas completas por colección (servicios, proyectos), «Textos del sitio», «Datos para buscadores», galería con pestañas (imágenes, álbumes, categorías), biblioteca de medios con subida y encuadre por arrastre, vídeo de cabecera, iconos de servicio, revisiones, deshacer de borrados, respaldos, historial de publicaciones y cambio de contraseña.

**Operaciones auditadas.**

| Operación                              | Resultado                                                                                                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear                                  | Servicio/proyecto: se crea pero nace incompleto e ineditable en su página (P1-02). Álbum, categoría, foto, cliente: correcto.                                                                                          |
| Ver / editar / guardar                 | Correcto en fichas existentes (se refleja en home, listados, ficha, sitemap y SEO); estados «sin guardar» incoherentes (P2-16); la página muestra lo publicado, no lo guardado (P2-17).                                |
| Cancelar                               | «Volver»/«Cancelar» descartan sin preguntar (P2-20); la X sí pregunta.                                                                                                                                                 |
| Eliminar                               | Con confirmación propia y deshacer de 12 s (bien). Pero: foto de galería → bloquea publicar (P0-01); imagen en uso → imagen rota (P1-05); ficha → `.md` fantasma que resucita (P1-03); servicio → enlaces 404 (P1-03). |
| Duplicar                               | No existe.                                                                                                                                                                                                             |
| Ordenar                                | Listas de ficha y lista de clientes: sí. Galería: no desde el panel (P2-25). Proyectos y servicios: por el campo «Orden», que vaciado rompe el build (P1-04).                                                          |
| Subir / reemplazar / eliminar imágenes | Subida con validación en servidor, derivados y srcset correctos; sin validación previa ni progreso (P2-19); alt arrastrado o de nombre de archivo (P2-13); medidas no recalculadas (P2-14).                            |
| Asociar / desasociar                   | Proyecto → servicio por enum fijo (P1-02); servicio → proyectos inexistente (P2-34); galería de ficha desconectada de la galería pública (P2-09).                                                                      |
| Publicar                               | Resumen previo en lenguaje llano, avance y resultado; build atómico. Fallos: P0-01, P1-04, P2-24, P2-05.                                                                                                               |
| Despublicar                            | «Borrador» devuelve el texto del código, que en 48 claves está obsoleto (P2-06).                                                                                                                                       |
| Cambiar slug                           | Pierde fotos y galería, deja fantasmas, sin 301 (P1-03).                                                                                                                                                               |

**Guardar frente a Publicar.** Está bien explicado en el panel («Guardado. Se verá al publicar») y el contador «N cambios sin publicar» se consulta al servidor. Lo que confunde es que tras recargar la página muestra lo publicado (P2-17) y que el resumen no refleja los cambios reales (P2-24).

**¿Puede un usuario no técnico romper una página?** Sí; ver 1.1, pregunta 3. El diseño protege contra lo peor (un build fallido no deja el sitio caído), pero no contra publicar contenido roto ni contra bloquear la publicación.

## 9. Sitio público

- **Rutas:** 27 páginas; 26 en el sitemap; 404 real; http → https (308), www → apex (301) y la 301 antigua de `ch-dorias` funcionan; sin páginas huérfanas salvo `/contacto/gracias/`. Duplicados con y sin barra (P2-27).
- **Consola y red (Chromium, 27 páginas):** 0 errores JS, 0 warnings propios, 0 violaciones CSP, 0 recursos 4xx/5xx, 0 peticiones fallidas, 0 descargas duplicadas reales. Enlaces: 51 internos, 206 recursos, 27 anclas y 3 externos, todos correctos; 0 `target=_blank` sin `rel`.
- **Servicios:** las 8 fichas son coherentes con /servicios (título, resumen, tipos truncados a 3 en el índice a propósito). Fichas pobres: 5 sin galería (sus secciones se ocultan correctamente al público), Infraestructuras sin normas, cuerpos desiguales (P3-13). No enlazan a sus obras (P2-34).
- **Proyectos:** cliente, ubicación, diámetro, longitud y peso coinciden entre home, /proyectos y ficha; filtros y contadores exactos; búsqueda indiferente a mayúsculas y tildes, con fallos de normalización de cotas y estado al volver atrás (P2-30). Solo los 10 destacados tienen ficha; los 30 del banco solo aparecen en la tabla (decisión de producto razonable).
- **Galería:** 173 fotos, recuentos por categoría exactos, alt descriptivos y únicos, lazy real por lotes, CLS 0, visor con teclado, swipe y precarga. Fallos: foco (P1-12), deep links (P2-33), LCP y peso (P2-36), doble descarga (P2-37).
- **Clientes:** carrusel bien resuelto (clones `aria-hidden` sin enfocables, pausa con `aria-pressed`, hover y foco lo pausan, reduced-motion lo detiene, sin huecos a 2.560 px). La lista oculta del editor está en el HTML (P2-01); renombrar pierde el logo (P2-11).
- **Contacto:** validación accesible, honeypot, protección contra doble envío, contenido conservado tras error, offline cubierto, límite de 3 envíos por sesión, `_next` fijo al propio dominio (sin redirección abierta). Falta el timeout (P2-32) y el foco tras error (P2-31). Los correos en copia son corporativos y quedan en el HTML (inherente a FormSubmit en cliente). No hay rate limit propio en el servidor: depende del de FormSubmit.

## 10. Integración CMS ↔ sitio

La matriz de la sección 3.1 resume qué controla el CMS. Los puntos de fricción, por causa raíz:

1. **Identidad por slug y listas en código** (P1-02, P1-03, P2-09, P2-10, P2-14): cabeceras, galerías, álbumes, enlaces proyecto → servicio y logos de cliente se enlazan por texto (slug o nombre) sin integridad referencial.
2. **Dos destinos de verdad** (P1-01, P1-06, P2-06): SQLite en el VPS, archivos versionados en git y fallbacks en el código.
3. **Validación asimétrica** (P1-04, P2-15, P2-02): el CMS acepta lo que el build rechaza o lo que no debería publicarse.
4. **Salida de errores** (P0-01, P1-05, P2-04, P2-24): el resultado de la publicación no traduce ni resume lo que pasó.

Lo que funciona de punta a punta: editar cualquier texto, lista, imagen o dato técnico de una ficha existente; alta y baja de servicios en el menú (submenú automático); galería (álbumes, categorías, fotos) hasta que se borra una foto; clientes (alta, baja, logo) salvo el renombrado; SEO por página.

## 11. UI/UX

**Sitio.** Identidad industrial y técnica coherente (esquinas rectas, rejilla técnica en los hero, tipografía condensada, datos en mono, fotos reales de taller y obra): no hace falta rediseño. Jerarquía clara, CTAs visibles, tablas técnicas que pasan a tarjetas legibles en móvil, estados vacíos con acción «Limpiar búsqueda y filtros». Problemas: menú móvil (P1-10), foco (P1-11), contraste del hero móvil (P2-28), CTA de servicio sin obras (P2-34), rótulos del CTA dispersos y pulido del pie (P3-13).

**CMS.** Como herramienta de trabajo tiene buenas bases (edición en contexto, confirmaciones claras, deshacer, borradores, contador de pendientes, resumen previo a publicar). La carga cognitiva sube por la jerga (P2-22), el Markdown crudo (P2-23), la imposibilidad de navegar (P1-07), el panel que tapa lo editado (P2-21) y los estados contradictorios (P2-16, P2-17). La prevención de errores es la mayor carencia: longitudes, obligatoriedad, validación de subidas y salidas sin aviso (P2-15, P2-19, P2-20).

## 12. Responsive

| Ancho                          | Sitio (14 páginas, Chromium)                             | WebKit iPhone 13 / escritorio | CMS                                              |
| ------------------------------ | -------------------------------------------------------- | ----------------------------- | ------------------------------------------------ |
| 320 · 375 · 390 · 430          | sin overflow; reflow correcto (equivale a 1280 al 400 %) | sin overflow                  | menú móvil del CMS con objetivos de 48 px (bien) |
| 568×320 · 844×390 (horizontal) | **menú inalcanzable** (P1-10)                            | **menú inalcanzable**         | —                                                |
| 768                            | sin overflow; tablas pasan a tarjetas bajo 768           | —                             | **barra cortada** (P1-08)                        |
| 1024                           | sin overflow                                             | —                             | «Más» fuera en táctil (P1-08)                    |
| 1280 · 1440                    | sin overflow; correo del pie partido (P3-13)             | sin overflow                  | panel tapa la mitad derecha (P2-21)              |

Giro de tablet con el menú abierto: página congelada (P2-29). Objetivos táctiles < 44 px en migas, botones de mapas y pie (P3-10).

## 13. Accesibilidad

| Página                                                                                                                                                                               | axe escritorio 1440 | axe móvil 390 | Revisión manual                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Las 12 páginas tipo (`/`, `/servicios/`, 2 fichas de servicio, `/proyectos/`, ficha de proyecto, `/galeria/`, `/clientes/`, `/contacto/`, `/empresa/`, `/contacto/gracias/`, `/404`) | 0 violaciones       | 0 violaciones | foco invisible en CTAs (P1-11); pérdida de foco en galería, «Ver más» y formulario (P1-12, P2-31); contraste del hero (P2-28); submenú por foco (P2-29); menores (P3-10) |
| Panel del CMS (acceso, texto, diálogo, ficha, colecciones, galería, publicar)                                                                                                        | 0 violaciones       | —             | 1 violación en el encuadre y menores (P3-11); teclado y foco del panel bien resueltos                                                                                    |

**Bien:** un H1 por página, sin saltos de encabezado, landmarks con nombre, `lang="es-CL"`, sin IDs duplicados, skip link funcional, formulario con `aria-invalid`/`aria-describedby`/`aria-live`, carrusel y vídeo pausables (2.2.2), `prefers-reduced-motion` respetado en animaciones, parallax, marquee y vídeo, zoom al 200 % y reflow a 320 px correctos. **Conclusión:** no cumple todavía WCAG 2.2 AA por P1-11, P1-12, P2-28 y P2-31; ninguno exige rediseño.

## 14. SEO

- **Bien:** 0 títulos o descriptions duplicados o vacíos entre las 26 páginas; un H1 por página; canonical absoluto; `og:*` y `twitter:card` en todas; JSON-LD válido (Organization en todas, Service y BreadcrumbList en fichas); sitemap coherente con las rutas; `robots.txt` correcto; 404 con `noindex`; `editor.*` con `X-Robots-Tag: noindex, nofollow` y canonical al dominio público; redirecciones www/http.
- **A corregir:** URLs duplicadas y enlazado a la variante no canónica (P2-27); texto de editor en el HTML (P2-01); títulos y descriptions que el CMS deja vaciar (P2-15); sitemap con `noindex`, canonical de la 404, descriptions largas, OG pobres, JSON-LD sin `@id` (P3-06); favicon (P3-07); cambios de slug sin 301 (P1-03).
- **`/proyectos/[slug]` y `/servicios/[slug]`:** la description es el `alcance`/`resumen` entero (7/10 y 7/8 > 160 caracteres); los servicios no tienen OG propia; 5 fichas llevan un `<h2>` «Galería de imágenes» oculto.

## 15. Performance

| Página                        | Lighthouse móvil (perf / LCP simulado) | LCP con Slow 4G + CPU 4× aplicado | Peso 1.ª visita (móvil)              |
| ----------------------------- | -------------------------------------- | --------------------------------- | ------------------------------------ |
| `/`                           | 98 / 2,22 s                            | 1,86 s                            | 262 KB                               |
| `/servicios/`                 | 99 / 2,07 s                            | 1,96 s                            | 226 KB                               |
| `/servicios/limpiarrejas/`    | 96 / 2,77 s                            | **4,58 s**                        | 458 KB + **8,14 MB de vídeo**        |
| `/servicios/compuertas/`      | 96 / 2,74 s                            | 3,25 s                            | 374 KB                               |
| `/proyectos/`                 | 98 / 2,39 s                            | 4,18 s                            | 835 KB                               |
| `/proyectos/ch-los-condores/` | 96 / 2,74 s                            | 4,51 s                            | 603 KB                               |
| `/galeria/`                   | 97 / 2,55 s                            | **8,22 s**                        | 1.324 KB (7,7 MB al llegar al final) |
| `/clientes/`                  | 99 / 2,04 s                            | 2,00 s                            | 1.045 KB                             |
| `/contacto/`                  | 100 / 1,69 s                           | 2,11 s                            | 184 KB                               |

Escritorio: 100 en todas. TBT 0, CLS 0 (también durante el scroll de la galería), INP 32–56 ms con CPU 4×. El overlay del CMS cuesta a un visitante anónimo una petición de ~1 KB y 0,4–1,9 KB comprimidos de atributos por página. **No hay problemas graves**; los puntos a mejorar son P2-35 a P2-38 y P3-03, P3-14.

## 16. Seguridad

| Control                  | Estado          | Evidencia                                                                                                                                                                                                    |
| ------------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Autorización en servidor | ✅              | 45 rutas: sin cookie → 401; con cookie sin CSRF → 403 (local); en producción `manifest`, `schema`, `media`, `gallery/items`, `audit`, `backup/list`, `publish/jobs` → 401; solo `health` es público y mínimo |
| CSRF                     | ✅              | token `nanoid(48)` ligado a la sesión, cabecera propia, tiempo constante, `SameSite=Lax`                                                                                                                     |
| CORS                     | ✅              | sin reflexión de orígenes no permitidos (`evil.example`, `null`, sufijos)                                                                                                                                    |
| Cookie de sesión         | ✅              | `__Host-`, `Secure`, `HttpOnly`, `Path=/`, sin `Domain`                                                                                                                                                      |
| Login                    | ✅              | bcrypt 12, hash ficticio anti-enumeración, 10/min por IP (efectivo detrás de Caddy), sin flujo de recuperación                                                                                               |
| Guardas de arranque      | ✅              | contraseña por defecto (también en hashes de la base), uploads dentro de `public/`, cookie insegura en host expuesto                                                                                         |
| Path traversal           | ✅              | `/uploads/cms/..%2f..`, `/%2e%2e/`, `/.env`, `/.git/config`, `/cms/data/*.sqlite` → 404 (local y producción)                                                                                                 |
| SVG                      | ✅              | rechaza `<script>`, `on*`, `foreignObject`, XXE, referencias externas, bombas; librsvg sin recursos externos                                                                                                 |
| Inyección de comandos    | ✅              | `execFile` con comando fijo y timeout; ningún dato del usuario en la línea de comandos                                                                                                                       |
| Secretos                 | ✅              | `.env`, `.env.deploy`, base y originales fuera de git; historial sin contraseñas reales; bundle sin rutas ni claves                                                                                          |
| Cabeceras                | ✅              | CSP con hashes sin `unsafe-inline` en `script-src`, `object-src 'none'`, HSTS, `nosniff`, XFO, Referrer y Permissions-Policy                                                                                 |
| XSS almacenado           | ⚠️ P2-02        | HTML del cuerpo se ejecuta; la CSP lo autoriza                                                                                                                                                               |
| Dependencias             | ⚠️ P2-03        | sharp y Astro con avisos altos/críticos                                                                                                                                                                      |
| Endurecimiento           | ⚠️ P3-01, P3-02 | `trustProxy`, bcryptjs en el hilo, sesiones, CORS global, EXIF, `/_headers` público                                                                                                                          |

No se hicieron pruebas destructivas ni de disponibilidad, ni login contra producción. **Conclusión:** la superficie de administración está bien protegida; el riesgo real está en la XSS por el cuerpo (con sesión) y en mantener dependencias con avisos altos en un proceso que corre como root.

## 17. Arquitectura y código

- **Estructura:** capas limpias en el backend (routes → controllers → services → repositories con sentencias preparadas), vocabulario compartido, escritura atómica e idempotente del export, CSP calculada del build, `writeFileSyncAtomic`, bloqueo optimista, sandbox de e2e.
- **Deuda principal:** proyección del contenido en archivos versionados (P1-01), relaciones por listas de slugs en código (P1-02), textos triplicados (P2-06), un único build para dos públicos (P2-01), overlay sin tipos con un despachador central (P2-07), errores clasificados por texto (P2-04), cerrojo solo en memoria (P2-05), documentación desfasada (P2-08), restos de cPanel/Cloudflare/FTP (P3-02), configuración duplicada (P3-04).
- **Código muerto:** 8 scripts sin referencias, `build-cms-overlay.mjs` roto, entrada `galeria.items`, columnas `gallery_items.title` (duplica `alt` en 173/177) y `caption` sin uso, `featured` sin lector, `sector` de clientes sin lector.
- **No se encontraron:** fugas de listeners (los de `document` se registran una vez en `mount()`), IDs duplicados en el HTML ni tipos `any`/`@ts-ignore` en el código TypeScript (0 fuera de las pruebas; los `.js` del overlay directamente no tienen tipos). No se perfilaron las consultas SQL.

**Archivos y módulos con mayor concentración de problemas**

| #   | Módulo                                                                                                                                                    | Hallazgos                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | Tubería de publicación: `cms/services/exportService.ts`, `publishService.ts`, `PublishController.ts`, `scripts/build-con-registro.mjs`                    | P0-01, P1-01, P1-03, P1-04, P2-02, P2-05, P3-08; 6–7 % de cobertura |
| 2   | Relaciones de fichas: `src/data/{project,service}-{images,galleries}.ts`, `cms/content/defaultContent.ts`, `src/pages/{servicios,proyectos}/[slug].astro` | P1-02, P1-03, P2-01, P2-09, P2-10, P2-14                            |
| 3   | Overlay: `src/scripts/cms/overlay/events.js`, `collections.js`, `fields.js`, `auth.js`, `gallery.js`, `styles.js`                                         | P1-02, P1-07, P1-08, P2-04, P2-07, P2-16 a P2-26                    |
| 4   | Contenido del CMS: `cms/services/contentService.ts`, `cms/repositories/ContentRepository.ts`, `contentSeed.ts`, `cms/validators/cms.schema.ts`            | P1-02, P1-03, P1-04, P1-06, P2-15                                   |
| 5   | Cadena de pruebas: `.github/workflows/ci.yml`, `playwright.config.ts`, `scripts/e2e-cms-sandbox.mjs`, `e2e/build-gate.spec.ts`, `cms/test/setup.ts`       | P1-09, P3-05                                                        |
| 6   | Galería pública: `src/pages/galeria/index.astro`, `src/components/gallery/Lightbox.astro`                                                                 | P1-12, P2-33, P2-36, P2-37, P3-10                                   |
| 7   | Cabecera: `src/components/layout/Header.astro`                                                                                                            | P1-10, P2-29, P2-38                                                 |
| 8   | Servidor estático: `cms/staticSite.ts`                                                                                                                    | P2-27, P3-02, P3-03                                                 |

## 18. Cobertura de pruebas

| Comando (ejecutado en un clon)                        | Resultado                                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run`                                      | 45 archivos, **409/409** pasan (12 s)                                                                                                           |
| `npx vitest run --coverage` (solo `cms/**`)           | 69,6 % sentencias, 64,4 % ramas; `publishService` 5,7 %, `PublishController` 7,3 %, `staticSite` 17,6 %, `imageService` 17,1 %, `server.ts` 0 % |
| `npx astro check`                                     | 255 archivos, 0 errores (no revisa los `.js` del overlay)                                                                                       |
| `npx eslint . --ext .js,.ts,.astro`                   | 232 archivos, 0 problemas (no incluye `.mjs`)                                                                                                   |
| `npx playwright test`                                 | 155 pasan, 4 omitidos, 0 fallan (contra el `dist/` del 22-sep)                                                                                  |
| Build-gate + CSP contra un build fresco de producción | **1 falla** (test de `?cms=1` ya retirado)                                                                                                      |
| CI en GitHub                                          | 78 de 79 ejecuciones fallidas; última verde 2026-08-08                                                                                          |

**Flujos críticos**

| Flujo                     | Cubierto por                                                | Hueco                                                                              |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Login CMS              | vitest de auth; e2e de login, logout y sesión expirada      | el 429 del login no se prueba sobre la ruta real                                   |
| 2. Crear proyecto         | e2e crea un _servicio_ en el panel                          | nadie comprueba que la página exista, se pueda editar y admita fotos (P1-02)       |
| 3. Editar proyecto        | e2e de edición en contexto, conflictos 409, revisiones      | —                                                                                  |
| 4. Publicación            | vitest de export e idempotencia                             | publish real nunca ejecutado (mock / `false`): P0-01 sin detectar                  |
| 5. Reflejo público        | canario del build-gate                                      | contra `dist/` viejo; ningún export → build → GET                                  |
| 6. Subida de imagen       | vitest de medios; e2e de subida sintética, vídeo, SVG       | límites de Caddy (12/64 MB) y archivos no válidos en el panel                      |
| 7. Eliminación            | e2e borra lo que crea; deshacer                             | borrar contenido existente y publicar (P0-01, P1-03, P1-05)                        |
| 8. Permisos               | `cmsRoutes.test.ts` exige 401 en cada ruta no pública       | un solo rol: correcto                                                              |
| 9. Formulario de contacto | e2e de validación, error 500, límite cliente, `connect-src` | timeout, foco tras error                                                           |
| 10. Navegación pública    | smoke, navegación, axe, responsive 320–1440                 | contra servidor de desarrollo, no contra `dist/` servido; menú móvil en horizontal |

**Conclusión:** buena base unitaria y de accesibilidad automatizada, pero la calidad no se mide en porcentaje: el flujo que más importa (publicar de verdad y verlo en el sitio) no tiene ninguna prueba, y la CI no corre.

## 19. Contenido e integridad de datos

| Carpeta                  | Archivos | Tamaño  | Referenciados por el sitio | Sin referencia               |
| ------------------------ | -------- | ------- | -------------------------- | ---------------------------- |
| `public/fotos`           | 189      | 32,6 MB | 184                        | 5 (375 KB)                   |
| `public/gallery/derived` | 547      | 52,8 MB | 499                        | **48 (4,7 MB)**, desplegados |
| `public/logos-clientes`  | 39       | 1,6 MB  | 28                         | 11 (303 KB)                  |
| `uploads/cms`            | 1.815    | 317 MB  | 0 (es la biblioteca)       | 18 `.jp2` sin registrar      |
| `uploads/_originales`    | 1.703    | 2,2 GB  | —                          | respaldo fuera de git        |

- **Referencias rotas en lo publicado hoy:** 0 en `cms-content.json`, `gallery.json`, `.md` y `clientes.json`; en producción, 452 de 452 imágenes referenciadas responden 200. Hay 5 rutas rotas en la semilla (`defaultContent.ts`), que reaparecerían con `cms:import` (P1-06).
- **Filas de `media_assets` sin archivo:** 0. **Duplicados exactos:** 13 grupos (1,9 MB). **Alt:** galería 173/173 descriptivos; biblioteca 82 % con nombre de archivo (P2-13).
- **Producción frente a git:** idénticos (26/26 páginas, 1.954 textos marcados, campos de proyectos, servicios y clientes).
- **Consistencia:** nombres de servicio (P2-12), clientes (P2-11, P3-09), álbumes y notación DN (P3-09). Unidades Ø, m y t coherentes.
- **Base local:** atrasada respecto al JSON versionado (10 entradas y 134 campos), con 41 categorías de prueba, la ficha obsoleta `galeria.items` y deriva de revisiones en 87 de 127 entradas (P1-06, P3-08). **La base del VPS no se pudo revisar.**

## 20. Aspectos positivos

Lo siguiente está bien implementado y conviene conservarlo tal cual:

1. **Autenticación y autorización del lado servidor** uniformes (solo 3 rutas públicas, 401/403 verificados en las 45), CSRF y cookie correctos, guardas de arranque contra la contraseña por defecto.
2. **Build atómico** (`build:log` → `dist.nuevo` → rename) y **export atómico e idempotente**: en ninguna prueba un fallo dejó el sitio sin páginas.
3. **CSP calculada del build** sin `unsafe-inline` en `script-src` (a corregir solo la fuente de los hashes, P2-02), HSTS y cabeceras de seguridad completas; path traversal contenido.
4. **Carga diferida del editor:** el visitante anónimo solo descarga ~1 KB y no llama a la API.
5. **Sitio público estable:** 0 errores JS/CSP/recursos rotos, 0 violaciones axe, CLS 0, TBT 0, sin overflow de 320 a 1440 px en Chromium y WebKit, 404 real, redirecciones correctas.
6. **Identidad visual industrial** coherente y responsive sólido (tablas técnicas que pasan a tarjetas).
7. **Galería:** alt descriptivos y únicos, recuentos exactos, lazy por lotes, visor con teclado y swipe, carrusel de clientes con clones inertes y pausable.
8. **Formulario de contacto:** validación accesible, honeypot, anti doble envío, contenido conservado tras error, alternativa `mailto:`, sin redirección abierta.
9. **Edición en contexto** con vista previa en vivo, confirmaciones propias (destructivo en rojo, foco en la salida segura), deshacer de 12 s, borradores locales, bloqueo optimista con «Ver el valor guardado / Guardar el mío», teclado y foco del panel bien resueltos, menú móvil del CMS con objetivos de 48 px.
10. **Vocabulario compartido** (`content-vocabulary.ts`) entre el schema del sitio, la API, el export y los desplegables; validaciones de enums y slugs repetidos con mensajes claros.
11. **Sandbox de e2e** que clona base, contenido y uploads a un temporal, y 409 pruebas unitarias en verde.
12. **Datos de estrés** (tildes, ñ, Ø × ² ³, comillas tipográficas, rayas, NBSP, soft hyphen, ZWSP, `\r\n`, tabuladores, emoji, `---`, `: `, Markdown, URL, 347 caracteres) con ida y vuelta exacta SQLite → API → YAML, build correcto, texto escapado y sin desbordes a 390 px.

## 21. Plan de corrección

Agrupado por causa raíz; no repite cada hallazgo. Las casillas marcan el avance de la implementación (rama `fix/auditoria-2026-09`); cada tarea hecha lleva la verificación que la respalda.

### Fase A — Bloqueantes (P0)

- [x] **A1. Rehacer la guarda de galería** (P0-01). La guarda compara ahora **por id** contra las fotos que el CMS conoce (las de la base en cualquier estado y las borradas desde el panel, que quedan en `audit_events`), y solo aborta si el `gallery.json` tiene fotos que el CMS nunca tuvo. La galería se exporta antes que el contenido, así que un aborto ya no deja medio export. El mensaje está en palabras. — `cms/services/exportService.ts` (`assertNoSilentGalleryShrink`), `cms/repositories/GalleryRepository.ts` (`knownItemIds`), `cms/services/publishService.ts`. _Verificado:_ 3 pruebas nuevas en `cms/test/galleryExportGuard.test.ts` con base real (borrar → n−1, ocultar → sin ella, JSON ajeno → sigue abortando); suite 412/412; reproducción con las rutas reales sobre un clon de la base local: 173 fotos → borrar una y ocultar otra → dos publicaciones seguidas `200 succeeded`, `gallery.json` con 171.
- [ ] **A2. Comprobar el VPS antes de desplegar** — _pendiente de quien tenga acceso por SSH_ (desde esta sesión está denegado): `select count(*) from gallery_items where status='published'` frente a `jq '.items|length' src/data/gallery.json`, y `git status --porcelain --untracked-files=no`. Con A1 desplegado, un recuento menor ya no bloquea.

### Fase B — Antes de producción (P1)

- [x] **B1. Red de pruebas mínima** (P1-09). Sin `cms/data/`, el sandbox de e2e arranca con una base nueva que el propio CMS migra y siembra (y vacía la galería de su copia para que la guarda no bloquee), en vez de abortar (`scripts/e2e-cms-sandbox.mjs`). `playwright.config.ts` acepta `127.0.0.1` como local. El job e2e de `ci.yml` deja que Playwright levante sus servidores (antes chocaban por los puertos). El build-gate falla si `dist/` es más viejo que `src/` y la prueba obsoleta de `?cms=1` ahora comprueba el interruptor real (host `editor.*` y sin persistencia en `localStorage`). Tres e2e que dependían de los datos del desarrollador (plurales, categorías y álbumes existentes) ahora son autosuficientes. Nueva prueba de integración `cms/test/publicar.test.ts` sobre las rutas reales con raíz temporal: editar → publicar → `cms-content.json`, y quitar/ocultar fotos → publicar dos veces. _Verificado:_ los dos jobs de la CI reproducidos en un clon sin `cms/data/`, sin `.env` y sin `uploads/`: job 1 (build + gate público) en verde; job 2 (build con CMS + suite e2e completa) **154 pasan, 4 omitidos, 0 fallan** (2 inestables que pasan al reintentar: `cms-edicion-en-contexto.spec.ts:45`, `cms-overlay.spec.ts:275`). _Pendiente:_ confirmar la CI en GitHub tras el push y un E2E que compile de verdad (export → `astro build` → GET).
- [x] **B2. Una fuente de verdad del contenido** (P1-01, P1-06). Regla: en el servidor manda la base SQLite. `scripts/deploy-vps.sh` ya no se bloquea por los archivos que exporta el panel: los respalda en `cms/data/backups/export-antes-de-deploy-<fecha>.tar.gz`, los descarta antes del `pull`, avisa si los commits entrantes tocan contenido y, tras `npm ci`, los **regenera desde la base** con `npm run cms:export` antes de compilar (si falla, no compila y el sitio sigue con el build anterior). `npm run cms:import` solo añade lo que falta (antes pisaba 73 campos). `upsertEntry` sube versión y deja revisión al actualizar, y el arranque crea una revisión del estado actual en toda ficha con deriva (`ContentRepository.ensureCurrentRevisions`, idempotente). `scripts/sync-datos-vps.sh` compara la última edición de cada base, pide escribir `SOBRESCRIBIR` (`--forzar` para saltarlo) y guarda antes la base remota. Semilla: las 7 rutas de imagen rotas de `defaultContent.ts` alineadas con lo publicado. Documentado en `docs/DESPLIEGUE-VPS.md`. _Verificado:_ comandos de reconciliación del deploy ejecutados sobre un clon (respaldo tar, `checkout`, aviso de contenido entrante); consulta de fechas del sync probada; `cms/test/revisiones.test.ts` (2 pruebas); sobre una copia de la base local, 93 fichas reciben su revisión actual, Turbinas restaura su estado vigente y una segunda pasada no cambia nada; 0 rutas rotas en la semilla; suite 416/416. _No hecho (decisión):_ sacar la proyección del árbol git; se optó por reconciliar en el despliegue, que no cambia dónde lee el build. _Pendiente:_ probar `npm run deploy` real contra el VPS.
- [x] **B3. Fichas por colección, no por listas** (P1-02, P1-03; y de paso P2-10). El servidor decide el id de una ficha de colección (`proyectos.<slug>`) y resuelve por slug los ids que pide el sitio, así que también funcionan las fichas ya creadas en singular (`ContentService.resolveEntryId`); el panel sigue el id devuelto. Una ficha nueva nace con todos sus campos editables (cliente, diámetro, normas, tipos…), sin textos de relleno, y con sus fichas compañeras de foto y galería; el arranque las crea para cualquier ficha que no las tenga (`ensureCompanions`). Fotos y galerías de ficha se derivan de las entradas del CMS además de los sembrados (`cmsEntrySlugs`), y la cabecera sin foto ofrece «+ Agregar foto de cabecera» a quien edita. `servicio` se valida y se ofrece contra los servicios que existen (schema del sitio `z.string()`; el export omite uno no publicado y la ficha enlaza por categoría). Nuevo historial de slugs (`collection_slugs`) y redirecciones (`redirects`, servidas por `staticSite.ts` con y sin barra): cambiar la dirección se lleva la foto, la galería, las fotos de /galeria y las referencias de otros proyectos, y crea una 301 si estaba publicada; el export poda todo slug que no sea el vigente de una ficha publicada; borrar quita los `.md` de todas sus direcciones y las redirecciones hacia ella; el arranque no reimporta el `.md` de una ficha borrada o renombrada (también de borrados anteriores, tomados de la auditoría). Borrar un servicio citado pide confirmación con la lista de proyectos. Galerías de ficha: cada foto conserva su hueco (`campo`), ya no se corre de casilla. _Verificado:_ `cms/test/fichas.test.ts` (rutas reales, raíz temporal): alta con id del sitio y fotos/datos editables, servicio nuevo asignable, doble cambio de dirección con fotos migradas, `.md` podados y 301 servidos, servicio citado con 409 → confirmar, borrado + reinicio sin resurrección y poda del resto; suite 425/425; `astro check` sin errores; e2e de colecciones corregido (seguía el id tecleado). _Pendiente de C/D:_ medidas de la foto de cabecera (P2-14), unificar galería de ficha y /galeria (P2-09).
- [x] **B4. Validación única** (P1-04; y P2-15). El export no escribe `null` ni vacíos opcionales (el schema del sitio aplica su valor por defecto: `orden` 100), así que un número vaciado ya no rompe el build. La API rechaza direcciones de colección con barra, punto, espacios o mayúsculas (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), recorta espacios en textos de una línea y de párrafo, y no deja guardar vacíos los campos que el sitio no puede mostrar vacíos: nombre/alcance/categoría/orden de proyecto, título/resumen/icono/orden de servicio, títulos y descripciones para buscadores, el título de las cabeceras (`*.hero`) y los rótulos del menú (`ContentController.esCampoObligatorio`). _Verificado:_ pruebas en `cms/test/fichas.test.ts` (slugs `tanques/316l`, `tanques.glp`, `Con Espacios` → 400; `orden: null` → 400; `seoTitle` de espacios → 400; `«  Colbún S.A.  »` se guarda recortado). _No hecho:_ validar cada `.md` con el zod real de Astro antes de escribirlo (el schema depende de `astro:content`); se replicaron sus reglas.
- [x] **B5. Integridad de medios** (P1-05). El aviso de «imagen en uso» busca también por ruta (no solo en `media_usages`, que estaba incompleto), y al confirmar el borrado los campos que la usaban quedan vacíos con su revisión (`MediaService.deleteMedia`). Cada publicación lista los campos que apuntan a fotos o vídeos que no existen, y el panel lo muestra («Fotos o videos que ya no existen»). _Verificado:_ pruebas en `cms/test/publicar.test.ts`: uso no registrado → 409 nombrando el campo; confirmar → campo vacío; ruta inexistente → aparece en `exported.missingFiles`.
- [x] **B6. Navegación y barra del editor** (P1-07, P1-08). Nueva acción «Ir a otra página» (en «Más» y en el menú compacto) que lista como enlaces normales las páginas enlazadas en la cabecera y el pie (`overlay/paginas.js`); el editor del texto de un enlace ofrece «Ir a esta página →»; Ctrl/Cmd/Mayús+clic sobre un enlace navega como siempre. El menú compacto del editor (el de móvil, con objetivos de 48 px) sustituye a la barra hasta 1.100 px en vez de hasta 640: la barra completa mide ~1.070 px. _Verificado:_ `e2e/cms-navegacion.spec.ts` (5 pruebas: llegar a /empresa desde «Ir a otra página», a /proyectos desde el editor del menú, y «Publicar cambios» dentro de la pantalla a 768, 800 y 1.024 px con la barra oculta); recuentos de acciones actualizados en `cms-overlay.spec.ts` y `cms-ui-ux.spec.ts`; 34/34 en las tres suites del panel.
- [x] **B7. Accesibilidad y móvil del sitio** (P1-10, P1-11, P1-12; y de paso parte de P2-29). Menú móvil con scroll propio limitado a lo que queda de pantalla (se recalcula al girar); Escape lo cierra aunque el foco haya salido, y al pasar a escritorio con él abierto se cierra y devuelve el scroll (`Header.astro`). Foco con doble anillo opaco en `Button` (contorno `primary-dark` + halo blanco sobre claro; blanco + halo oscuro sobre foto), en «Enviar consulta» y en el enlace de salto; el buscador de /galeria marca el foco. Galería: los lotes del scroll infinito se añaden sin repintar el muro, y el visor recuerda la foto que lo abrió por su id (también en Safari, donde el clic no enfoca botones) y no roba el foco si se cierra antes del siguiente fotograma. _Verificado:_ `e2e/public-foco-y-menu.spec.ts` (8 pruebas: CTA alcanzable a 568×320, 844×390 y 390×664 con Servicios desplegado; giro de tablet; contorno opaco; buscador; 40 Tab por el muro sin salir de las fotos; foco devuelto al cerrar el visor) en Chromium, y en WebKit escritorio e iPhone 13 las de menú y visor; 29/29 con galería, navegación y accesibilidad. _Pendiente:_ comprobar en un iPhone real.

### Fase C — Calidad (P2)

- [x] **C1. Separar público y editor** (P2-01). Con `PUBLIC_ENABLE_CMS=1`, `npm run build:log` (el de «Publicar» y del deploy) compila dos perfiles: `dist/` con `PUBLIC_ENABLE_CMS=0` y `dist-editor/` con `=1`, y los sustituye juntos solo si los dos terminan bien. `cms/staticSite.ts` sirve `dist-editor/` en `editor.*` y `dist/` en el resto; la CSP se calcula por directorio; con los dos perfiles desplegados, `/api/*` responde 404 en el dominio público (sigue en `editor.*` y en local, que usa el health del deploy). Sin `dist-editor/` todo se comporta como antes. _Verificado:_ build real en un clon: en `dist/` 0 atributos `data-cms-*`, 0 «Agregar imagen», 0 «solo la ve» y sin chunk del editor; en `dist-editor/` sí. Servidor real con cabecera `Host`: `hidromontchile.cl` → página limpia y API 404; `editor.hidromontchile.cl` → perfil del editor y API 200; `127.0.0.1` → página limpia y API 200. `cms/test/perfilesDelSitio.test.ts` (2 pruebas). Documentado en `docs/DESPLIEGUE-VPS.md`.
- [x] **C2. Seguridad** (P2-02, P2-03). El Markdown de las fichas ya no publica HTML crudo: plugin propio `src/utils/rehypeSinHtml.mjs` (quita nodos `raw`, atributos `on*` y enlaces `javascript:`/`data:`/`vbscript:`), así que ningún `<script>` del contenido llega a `dist/` y la CSP vuelve a autorizar solo scripts del código. `sharp` 0.33.5 → **0.35.4** (libvips 8.18.6, libheif 1.23.2). Las subidas verifican que el contenido real es del formato que dice la extensión (un PNG, SVG, AVIF o texto renombrado a `.jpg` se rechaza con un mensaje en palabras). _Verificado:_ página con `<script>`, `onerror` y `javascript:` en el cuerpo → 0 apariciones en el HTML, negrita, enlaces y autoenlaces intactos; el build del sitio con y sin el plugin es **idéntico**; prueba nueva en `cms/test/media-video-svg.test.ts`; `npm audit --omit=dev` ya no lista sharp; suite completa en verde. _Hecho después (fase D):_ **Astro 5.18 → 7.3.3.**
  - `@astrojs/tailwind` solo admite hasta Astro 5, así que Tailwind 3 pasa a PostCSS (`postcss.config.cjs`); las directivas ya estaban en `global.css`.
  - Se añade `@astrojs/markdown-remark`, que hace falta para los plugins de rehype.
  - `build-con-registro.mjs` lee el ejecutable del campo `bin` (Astro 7 lo movió a `bin/astro.mjs`).
  - Playwright fija `ASTRO_DEV_BACKGROUND`, porque Astro 7 pasa `astro dev` a segundo plano si lo lanza un agente.
  - El build-gate admite las comillas invertidas del minificador nuevo, y `engines` pide Node ≥ 22.12 (el VPS usa Node 24).
  - Con eso sharp queda en 0.35.4 en todo el árbol, y con Vitest 5 `npm audit` da **0 avisos**.
  - _Verificado:_
    - En un clon nuevo: `astro check` 0 errores, `build:log` de dos perfiles correcto (`dist` sin marcas del CMS y `dist-editor` con 11 en la portada), Tailwind genera el mismo CSS (65 frente a 67 KB), 504/504 pruebas unitarias.
    - Batería final en un clon nuevo del estado completo de la rama: lint y `tsc` limpios, 504/504 unitarias y **230 e2e en verde**, 3 omitidas (las del perfil CMS en el build-gate) y 0 fallos. Por el camino apareció un falso positivo del build-gate (la cadena `hm-cms-active` en el paquete público del visor), ya corregido.
- [x] **C3. Errores y estados del panel** (P2-04, P2-05, P2-16, P2-17, P2-18, P2-24).
  - P2-04: clase `ErrorDeUsuario` (estado + mensaje para la persona) que `BaseController` respeta; manejador de errores global en la API (una revisión inexistente da 404, no el 500 crudo); el cerrojo de publicación da 409 con su texto; lo no clasificado es 500, no 400. Los fallos de «Publicar» se explican en palabras (dato que el sitio no acepta, otro build en curso, tiempo agotado) y llevan el identificador del job, que el panel muestra «para soporte». En el panel, solo un 401 pide entrar de nuevo; cualquier otro error al abrir un campo se explica en el panel, y la red caída se dice en español.
  - P2-05: al arrancar se cierran todos los jobs «en curso»; `CMS_PUBLISH_CHECK_COMMAND` usa por defecto el build atómico `npm run build:log`; `build:log` toma un cerrojo entre procesos (`.build.lock`, con recuperación si su proceso murió).
  - P2-16: guardar una ficha limpia el aviso de «sin guardar».
  - P2-18: tras entrar se destruye el formulario de acceso (no queda la contraseña en el DOM ni el botón bloqueado); sin sesión hay siempre un botón «Entrar» (en la barra y, en tablet y móvil, flotante); si la sesión caduca al guardar, el editor lo dice y ofrece «Entrar de nuevo» (lo escrito queda como borrador). El foco automático del panel ya no roba el foco si la persona empezó a escribir.
  - P2-17: con sesión, los textos guardados y aún sin publicar de las fichas que aparecen en la página se pintan con su valor guardado y una marca discontinua «Guardado, sin publicar» (se quitan al publicar). Las fotos y el cuerpo con formato siguen viéndose al publicar.
  - P2-24: mientras se publica, la barra y el menú compacto no abren otras vistas; el resultado de un fallo muestra el motivo y el identificador para soporte; el contador de cambios cuenta también reordenar fotos, álbumes o categorías (ahora se registran en la auditoría) y borrar fotos de la biblioteca. _No hecho:_ el resumen sigue construyéndose con eventos de auditoría, no con una diferencia real entre la base y lo publicado.
  - El cerrojo de publicación es un `ErrorDeUsuario` 409 y ya no se envía a Sentry como fallo.
  - De paso (P3-05): los comentarios que rompían el escáner de dependencias de Vite, y la marca `body[data-cms-listo]` que las e2e esperan tras abrir el editor, que eliminó una carrera antigua (pulsar un enlace antes de que el editor montara).
  - _Verificado:_ `e2e/cms-sesion.spec.ts` (5 pruebas), `e2e/cms-guardado-sin-publicar.spec.ts`, prueba del contador en `cms/test/publicar.test.ts`, pruebas de errores en `cms/test/publicar.test.ts` (revisión inexistente 404, doble exportación 409, traducción de fallos de compilación), dos builds simultáneos (uno se niega con mensaje claro); suite unitaria 431/431 y **e2e completa sin reintentos y sin caché de Vite: 174 pasan, 0 fallan**.
- [x] **C4. Prevención de errores en el panel** (P2-19, P2-20, P2-21, P2-13, P2-26): validación de subidas en el cliente con progreso; confirmación en todas las salidas; panel que no tapa lo editado; alt obligatorio y no heredado; revisiones con diferencias y restauración por campo.
  - _Hecho (P2-20):_ «Volver», «Cancelar», las pestañas y el resto de acciones que cambian de vista (`CAMBIAN_DE_VISTA` en `events.js`) piden confirmar con «Tienes cambios sin guardar» si el formulario está sucio. _Verificado:_ `e2e/cms-salidas.spec.ts`.
  - _Hecho (P2-13):_ una foto nueva no hereda la descripción de la anterior, y un nombre de archivo no cuenta como descripción (`overlay/alt.ts`, `pareceNombreDeArchivo`). `saveEdit` no sube nada sin descripción. _Verificado:_ la prueba P2-13 de `e2e/cms-media-upload.spec.ts` y `src/test/cms-alt.test.ts`.
  - _Hecho (P2-19):_ `validarArchivo` en `overlay/dropzone.js` comprueba, al elegir o soltar el archivo, el tipo, el tamaño (8 MB para fotos, 60 MB para videos) y que la foto se pueda abrir. Si falla, lo dice en la zona de subida y deja el archivo sin elegir. `subirArchivo` usa XHR y muestra «Subiendo el archivo… N %». _Verificado:_ la prueba P2-19 de `e2e/cms-media-upload.spec.ts` (un texto con nombre `.jpg` y un PNG de 9 MB) comprueba que se rechazan sin hacer ninguna petición a `/api/cms/media`.
  - _Hecho (P2-21):_ en escritorio (≥1101 px), mientras el panel está abierto, la página le deja libre su ancho: `html.hm-cms-con-panel` pone `margin-right` en `body`, ajusta la cabecera fija de la portada y hace que la barra pase a dos líneas en vez de cortarse. Si lo que se edita queda fuera de la vista, se desplaza hasta él. _Verificado:_ `e2e/cms-panel-no-tapa.spec.ts` a 1280 px: «Contáctenos» queda entero a la izquierda del panel, y con una ficha abierta «Publicar cambios» también.
  - _Hecho (P2-26):_ `GET /api/cms/revisions/:id?field=` devuelve el valor del campo en cada versión y la lista de campos que cambiaron (`listRevisionsDetailed`). `POST …/restore/:rev?field=` restaura solo ese campo (`restoreRevisionField`) y deja una revisión nueva. Desde un campo, el panel lista los valores distintos que ha tenido, con su texto o miniatura, y ofrece «Restaurar este valor». Desde una ficha, cada versión dice qué cambió, y «Volver» regresa a la ficha. Fechas en formato «25 sept 2026, 20:03». _Verificado:_ dos pruebas nuevas en `cms/test/revisiones.test.ts` (restaurar el título no toca el subtítulo), `e2e/cms-revisiones.spec.ts`, y `cms-collections-crud` sigue en verde.
- [x] **C5. Lenguaje y controles del panel** (P2-22, P2-23, P2-25): ocultar controles sin efecto, nombres en español llano, editor visual del cuerpo, orden de la galería.
  - _Hecho (P2-22):_
    - Las fichas de página se tratan como las de «Textos del sitio»: sin «Título», «Dirección», estado ni botón de borrar, y sin «Nueva página».
    - Nuevo `src/data/entry-names.ts` (`nombreDeFicha`) con nombres llanos («Portada — cabecera», «Cabecera y menú», «Fotos del proyecto C.H. Besaya»). Lo usan las migas, las listas, las revisiones y el resumen de publicación del servidor (`pendingService`).
    - Los rótulos del formulario dicen «Nombre del campo «Empresa»» y «Error si un campo es demasiado corto», sin claves en inglés.
    - Al crear una ficha, el identificador interno se deduce de la dirección y no se muestra. Los servicios y proyectos aparecen con su dirección completa (`/servicios/compuertas`), y el borrador se rotula «Oculto — su página deja de verse en el sitio».
    - El registro de actividad nombra la ficha y el campo; la acción, los identificadores y la IP quedan en «Detalles técnicos».
    - _Verificado:_ nuevos `src/test/entry-names.test.ts` y «ningún rótulo sembrado deja a la vista una clave en inglés» en `src/test/field-labels.test.ts`; `cms-collections-crud` y `cms-publicacion` adaptados y en verde.
  - _Hecho (P2-23):_
    - Editor visual (`overlay/richtext-visual.js`) que sigue guardando Markdown. El textarea queda oculto como fuente de lo que se envía.
    - Barra con «Título» y «Subtítulo» en vez de «H2» y «H3», y sin «Código». El enlace se pone con un diálogo propio (texto y dirección, con validación), y lo pegado entra como texto.
    - Si un cuerpo trae algo que el editor visual no reproduce sin pérdida (imágenes, separadores, HTML, listas anidadas…), se abre el editor de texto de antes.
    - La vista previa entiende los escapes `\*`, `\[`…
    - _Verificado:_ `e2e/cms-richtext.spec.ts` reescrito (7 pruebas: negrita, título, enlace, respaldo al editor de texto, XSS, barra con flechas, guardado como Markdown); dos pruebas nuevas en `src/test/cms-markdown.test.ts`; los 48 cuerpos de `src/content` quedan fuera de los patrones de respaldo, y los 16 abiertos en el navegador abren en modo visual.
  - _Hecho (P2-25):_
    - Botones «Subir» y «Bajar» en Álbumes y Categorías. En cada foto, un bloque «Orden en la galería» («Es la foto N de M», con «Al principio», «Antes», «Después» y «Al final»).
    - Se envía siempre el orden completo a `…/reorder`, y el foco sigue al elemento movido.
    - _Verificado:_ `e2e/cms-galeria-orden.spec.ts`: la categoría subida queda antes según la API, y la última foto pasa a ser la primera.
- [x] **C6. Contenido derivado** (P2-06, P2-11, P2-12): una sola fuente para los textos por defecto; id estable de cliente; opciones del formulario y nombres de servicio derivados de la colección.
  - _Hecho (P2-06):_
    - `cms/content/defaultContent.ts` toma los valores de `src/data/cms-content.json` (`conLoPublicado`), solo para las claves que declara la semilla, así que un campo retirado no vuelve a sembrarse. Las diferencias entre semilla y publicado bajan de 73 a 0.
    - Los textos por defecto del código ya no llegan a verse: `src/test/cms-keys.test.ts` exige que cada clave literal que pide el sitio exista en el export (escaneo: 0 faltan de 263), un campo vaciado se respeta como vacío (`getCmsText`), y las fichas de página ya no se pueden pasar a borrador ni borrar desde el panel (C5).
    - Los literales del código no se reescribieron: pasan a ser un respaldo que no se alcanza.
    - _Verificado:_ `cms/test/semilla.test.ts` falla con la semilla anterior y pasa con la nueva.
  - _Hecho (P2-11):_
    - Al guardar la lista de clientes, si desaparecen tantos nombres como aparecen, se toman como renombrados y el logo pasa al nombre nuevo, salvo que ya tenga uno (`migrarLogosRenombrados`).
    - /clientes respeta el orden del CMS (ya no se reordena alfabéticamente) y no repite clientes.
    - _Verificado:_ `cms/test/clientes.test.ts` (3 casos) y `e2e/public-contenido-derivado.spec.ts`.
    - _Pendiente de decisión:_ `clientes.json` sigue como semilla y respaldo del logo, y su campo `sector` sigue sin uso.
  - _Hecho (P2-12):_
    - Las opciones del formulario de contacto salen de las fichas de servicio (en su orden y con su nombre) más «Otro».
    - El campo `contact.form.services`, que dejaría de tener efecto, se retira del CMS (`CAMPOS_RETIRADOS`) y de la semilla.
    - _Verificado:_ e2e: 8 servicios más «Otro», incluidos Infraestructuras y Tanques Especiales, cada uno igual al título de su ficha.
    - _Queda como está:_ los rótulos cortos del menú («Tuberías y Blindajes») y las categorías de proyecto, que son una clasificación distinta del servicio.
- [x] **C7. Sitio** (P2-27 a P2-34): normalizar URLs a la variante con barra con 301; velo del hero; submenú y menú móvil; buscador con normalización y estado en la URL; foco tras «Ver más» y errores; timeout del formulario; deep links de la galería por id; relación servicio → proyectos.
  - _Hecho (P2-27):_
    - `cms/staticSite.ts` (`direccionCanonica`) responde con 301 a la forma con barra (`/x` → `/x/`, conservando `?…`) en `/…/index.html` → directorio, colapsa `//+` y sirve `/404.html` con estado 404. Las redirecciones del CMS van directas a la forma con barra, y `_redirects` apunta a `/proyectos/ch-doiras/`.
    - La integración `src/utils/enlacesConBarra.mjs` pasa a la forma canónica los enlaces internos del HTML generado, incluidos los que vienen del contenido del CMS.
    - `trailingSlash` sigue en `'ignore'`: pasarlo a `'always'` rompe `astro dev` para las rutas sin barra.
    - _Verificado:_ `cms/test/urlsCanonicas.test.ts`; `e2e/public-urls-canonicas.spec.ts` contra el servidor del CMS (6 casos 301, canónica 200, `/404.html` 404); en el `dist` del clon, 0 de 1.498 enlaces internos quedan sin barra.
  - _Hecho (P2-28):_
    - En móvil, velo uniforme `rgba(15,36,51,.6–.75)`; en escritorio, el degradado lateral con el tramo medio a 0,58.
    - Antetítulo en el nuevo token `accent-light` (#B3E6F6, 5,2:1 en el peor caso) y subtítulo en blanco pleno.
    - _Verificado:_ `e2e/public-hero-contraste.spec.ts` mide píxel a píxel con el texto oculto, a 390 y a 1440 px (menos del 1 % de píxeles bajo 4,5:1). Con el hero anterior falla: 68 % del antetítulo por debajo.
  - _Hecho (P2-29):_ el submenú ya no se abre con el foco, solo con Intro o Espacio en el chevron o al pasar el ratón. Se cierra al salir tabulando, y Escape se escucha en `document`. El cierre al cruzar el punto de corte y el Escape del menú móvil ya estaban hechos en B7. _Verificado:_ dos pruebas nuevas en `e2e/public-navigation.spec.ts`.
  - _Hecho (P2-30):_
    - Nueva `src/utils/busqueda.ts` (`normalizarBusqueda`, `coincide`), usada para el índice (`ProjectTable`) y para la consulta. Una consulta de varias palabras exige todas, en cualquier orden.
    - La búsqueda y el filtro se guardan en `?q=` y `?cat=` con `replaceState` y se restauran al iniciar y en `pageshow`.
    - _Verificado:_ `src/test/busqueda.test.ts` (12 casos) y `e2e/public-busqueda-proyectos.spec.ts`: «1600», «ø1600» y «Ø 1.600» dan el mismo resultado; «CH Ralco» encuentra la obra; volver atrás conserva la lista.
  - _Hecho (P2-31 y P2-32):_
    - El botón de envío usa `aria-disabled` (el foco no se pierde), y un error lleva el foco al aviso (`tabindex="-1"`).
    - `AbortController` corta la petición a los 20 s y conserva lo escrito.
    - Tras «Ver más», el foco pasa a la primera fila nueva.
    - _Verificado:_ `e2e/public-envio-y-foco.spec.ts` (el tiempo de espera, con `page.clock`) y `public-forms.spec.ts` sigue en verde.
  - _Hecho (P2-33):_ `?foto=` lleva el id de la foto; los enlaces viejos, numéricos, se siguen leyendo como posición. El visor espera a `gallery:ready` antes de abrir una foto enlazada, y si la foto no existe no toca la URL. _Verificado:_ `e2e/public-galeria-enlace.spec.ts`: el enlace de la foto 30 abre esa foto, con el mismo contador, en otra pestaña.
  - _Hecho (P2-34):_
    - Nuevo `src/data/servicio-proyectos.ts`, con la tabla categoría ↔ servicio que ya usaba la ficha de proyecto.
    - Cada servicio muestra hasta 3 de sus obras con ficha, y «Ver proyectos» abre `/proyectos/?cat=<categoría>`.
    - _Verificado:_ `e2e/public-servicio-proyectos.spec.ts` y capturas a 1280 y a 390 px.
- [x] **C8. Performance** (P2-35 a P2-38): variantes de vídeo y carga condicionada a reduced-motion; derivados 360w/768w y `eager` en las primeras tarjetas; precarga del visor con el mismo `srcset`; logos a su tamaño.
  - _Hecho (P2-35):_
    - Nuevas variantes `public/videos/limpiarrejas-hero-480.mp4` (1,6 MB, −81 %) y `-720.mp4` (3,1 MB, −61 %), en H.264 CRF 28, sin audio y con faststart.
    - `PageHero` ya no pone `src` ni `autoplay` en el HTML (`data-src`, `data-src-480`, `data-src-720`, `preload="none"`). Un script elige la variante por el ancho pintado × densidad, y solo si no se pidió reducir el movimiento.
    - _Verificado:_ `e2e/public-video-cabecera.spec.ts`: con `reduce` no se pide ningún `.mp4`; a 390 px se reproduce la de 480p. `cms-video-iconos` adaptado y en verde.
    - _Queda:_ los videos subidos desde el CMS no generan variantes (haría falta ffmpeg en el servidor). Se sirven con la misma carga diferida.
  - _Hecho (P2-36):_
    - `imageService` añade 360w (q72) y 768w (q74); los derivados que ya existen no cambian.
    - /galeria usa `sizes` exacto por columna (medido en el navegador), y las 4 primeras tarjetas van con `eager` y `fetchpriority="high"`.
    - `sizes` ajustado en `ProjectCard` y en la foto de `PageHero`.
    - _Verificado:_ export en un clon (200 derivados de 360w nuevos). Carga inicial de /galeria a 390 px y densidad 2: de 977 KB a 307 KB (−69 %).
    - _Pendiente de despliegue:_ los derivados nuevos y su `srcset` aparecen con la primera publicación en el VPS, porque `deploy-vps.sh` exporta tras `npm ci`. En este repo no se exportó desde la base local, para no mezclar su contenido con lo publicado.
  - _Hecho (P2-37):_ la imagen visible, la que se carga y las vecinas usan el mismo `sizes` y `srcset` (`prepararCarga`). Además se descarta una carga que llega tarde, lo que evitaba ver otra foto con el contador correcto. _Verificado:_ `e2e/public-visor-precarga.spec.ts` (densidad 2): cada foto se pide en un solo ancho; con el visor anterior falla.
  - _Hecho (P2-38):_
    - Logo de cabecera con `widths={[140, 280, 400]}`: en escritorio con densidad 2 se sirve el de 280w en vez del de 1.181 px.
    - La franja del inicio y el carrusel de /clientes usan los derivados del export (`srcsetDeLogo`) con `sizes` al ancho pintado.
    - Los PNG de `public/logos-clientes` bajan a 640 px como máximo y se recomprimen con paleta: de 1.547 KB a 259 KB, sin diferencia visible (hoja comparativa revisada).
    - _Verificado:_ en la portada del clon, los logos pasan de 125 KB a 56 KB.
- [x] **C9. Documentación** (P2-07, P2-08): reescribir `ARCHITECTURE.md` y `SECURITY.md` con el estado real; `@ts-check` progresivo en el overlay.
  - _Hecho (P2-08):_
    - `docs/ARCHITECTURE.md` y `docs/SECURITY.md`, reescritos desde el código: VPS con Caddy, un proceso Node, dos perfiles de build, API cerrada en el host público, 45 rutas, 15 tablas y 6 migraciones, CSP de `cms/security/headers.ts`, pruebas actuales. H1 queda como «mitigado al desplegar esta rama».
    - `DESPLIEGUE-CPANEL.md` pasa a `docs/historico/`, con aviso y referencias actualizadas (README, `DESPLIEGUE-VPS.md`, `docs/README.md`, `pack-deploy.mjs`).
    - El README ya no habla de Cloudflare ni de cPanel como destino, y el comentario de `deploy/hidromont.service` dice `build:log`.
  - _Hecho en parte (P2-07):_
    - `// @ts-check` en 11 módulos del overlay (`api`, `auth`, `context`, `dropzone`, `html`, `icons`, `mount`, `paginas`, `pendientes`, `styles`, `submit`), con sus tipos JSDoc corregidos. `tsc` y `astro check` los revisan desde ahora. Nuevo tipo global `Window.__HIDROMONT_CMS__` en `src/env.d.ts`.
    - `src/test/overlay-ts-check.test.ts` impide quitar la marca.
    - `selectElement` toma un turno y solo pinta la última selección (la guarda de secuencia que faltaba).
    - _Pendiente:_ los módulos grandes (`events.js` 164 errores, `gallery.js` 90, `fields.js` 72, `panel.js` y `collections.js` 49), cambiar la cadena de `if (action === …)` por un mapa de acciones y sacar `styles.js` a un `.css`. Son refactorizaciones amplias sin cambio de comportamiento; conviene hacerlas en una rama aparte, con los e2e como red.

### Fase D — Pulido (P3)

- [x] **D1.** Endurecimiento de seguridad y restos publicados (P3-01, P3-02).
  - _Hecho (P3-01):_
    - Proxy y CORS:
      - `trustProxy` solo confía en `127.0.0.1` y `::1` (Caddy).
      - Fastify pasa de 5.8.5 a 5.12.5, y `npm audit fix` resuelve sin romper los avisos de `find-my-way`, `fast-uri` y el resto de transitivos.
      - `overrides` hace que Astro use el mismo sharp 0.35.4, con lo que desaparece el aviso alto de libvips.
      - Las cabeceras CORS solo salen en `/api/`.
      - Que la API responda 404 en el host público ya estaba hecho (C1).
    - Sesiones:
      - Caducan tras 24 h sin uso (`CMS_SESSION_IDLE_HOURS`, migración idempotente `last_seen_at`).
      - Nuevo «Cerrar las demás sesiones» en Administración (`POST /api/cms/sessions/cerrar-otras`, auditado).
    - Las fotos subidas se reescriben con sharp: se aplica la orientación y salen sin EXIF, GPS ni bytes añadidos (las animaciones WebP se conservan).
    - _Verificado:_
      - `cms/test/proxyConfianza.test.ts`: un XFF falso de un cliente directo no cambia `req.ip`.
      - `cms/test/sesiones.test.ts` (4 casos) y la e2e nueva de `cms-sesion.spec.ts`: la sesión del otro contexto queda cerrada y esta sigue abierta.
      - La prueba P3-01 de `media-video-svg.test.ts`: un JPEG con EXIF y orientación 6 se guarda sin EXIF y de 20×40.
      - El build de Astro compila y optimiza imágenes con sharp 0.35.
    - _No hecho, a propósito:_
      - Un límite de intentos por cuenta dejaría que cualquiera bloquee el acceso de quien edita; ya hay límite por IP, la contraseña debe ser fuerte y bcrypt tiene coste 12.
      - Sacar bcrypt del hilo principal exigiría una dependencia nativa o un worker; `bcryptjs` ya trabaja de forma asíncrona.
      - Queda el aviso de Astro ≤ 7.2.7: afecta a `define:vars`, que aquí solo recibe valores del build, y a las server islands, que no se usan. La actualización a Astro 7 sigue pendiente (C2).
  - _Hecho (P3-02):_
    - `/_headers`, `/_redirects`, `/.htaccess` y cualquier ruta con un segmento que empiece por `.` responden 404; las redirecciones se siguen leyendo del archivo.
    - La CSP ya no autoriza `api.web3forms.com`.
    - Diez scripts sin uso (cPanel, FTP, WASM, curado inicial) pasan a `scripts/historico/`, y dos siembras puntuales a `cms/scripts/historico/`, con README. Se quitan `pack:deploy`, `deploy:ftp` y `probar:wasm` de `package.json`.
    - _Verificado:_ dos pruebas nuevas en `cms/test/urlsCanonicas.test.ts`; `tsc` en verde.
    - _Queda para ti:_ borrar `_deploy/` en tu equipo (526 MB de zips de cPanel con una base y un `.env`, fuera de git). No lo borré porque no es reversible.
- [x] **D2.** Caché, HEAD y configuración (P3-03, P3-04, P3-05).
  - _Hecho (P3-03):_
    - `immutable` solo para `/_assets/`, `/gallery/derived/` y `/uploads/cms/`. El resto de imágenes de `public/` se revalida al día; las fuentes, un año (`font/woff2`).
    - `ETag` y `Last-Modified` a partir del `stat`, con 304 para `If-None-Match` e `If-Modified-Since`.
    - HEAD da la longitud real: GET y HEAD van en la misma ruta, sin la HEAD automática de Fastify, que ponía 0.
    - _Verificado:_ tres pruebas nuevas en `cms/test/urlsCanonicas.test.ts` (HEAD igual a GET, 304 con el ETag, `/logo.svg` sin `immutable`). Queda por comprobar en producción que Caddy no altere HEAD.
  - _Hecho (P3-04):_
    - Los topes de subida se publican en `GET /api/cms/schema` (`limites`); el panel los lee (`state.limites`) para el texto de ayuda y para la comprobación.
    - `cms/test/configuracion.test.ts` comprueba que el `Caddyfile` deja pasar lo que acepta el CMS.
    - `CMS_ALLOW_GALLERY_SHRINK` se lee en `unifiedConfig` (como getter).
    - `prettier` se importa solo al formatear, así que el CMS arranca sin dependencias de desarrollo. `astro` sigue haciendo falta para publicar; lo cubre `include=dev` en `.npmrc`.
    - El comando de publicación se parte respetando comillas (`argumentosDeComando`, 6 casos), y el comentario del limpiador de publicaciones ya dice lo que hace.
  - _Hecho (P3-05):_
    - `npm run lint` incluye los `.mjs` (`scripts/`, `server.mjs`), sin lo archivado; queda en 0 problemas.
    - `coverage/` va en `.gitignore`.
    - Las esperas fijas de `cms-edicion-completa`, `accessibility`, `csp` y `public-visor-precarga` pasan a esperar una condición. El contador de cifras marca `data-contado` al terminar.
    - La salida de Playwright ya no trae `[vite] Failed to scan` (lo arregló C3).
    - Siguen dos esperas cortas dentro de bucles de scroll que ya tienen su condición de salida.
- [x] **D3.** SEO menor y favicon (P3-06, P3-07).
  - _Hecho (P3-06):_
    - `sitemap({ filter })` deja fuera `/contacto/gracias/` y la 404, y una página `noindex` ya no declara canonical. `/404.html` responde 404 desde P2-27.
    - Las descriptions se recortan por frase a ≤ 155 caracteres (`src/utils/seo.ts`), también en OG y Twitter.
    - La integración `src/utils/imagenesParaRedes.mjs` sustituye cada `og:image` por un JPG de 1200×630 recortado con `attention`, y declara ancho, alto y tipo.
    - `og:image:alt`, y las fichas de servicio usan su foto de cabecera.
    - `Organization` lleva `@id` y los `Service` remiten a él con `provider`.
    - _Verificado:_ build en un directorio aparte: 0 de 27 descriptions pasan de 160, y las 11 imágenes para redes son de 1200×630 (revisada la de C.H. Los Cóndores, que era vertical). Cuatro pruebas nuevas en `e2e/build-gate.spec.ts` y `src/test/seo.test.ts`.
    - _No hecho:_ `lastmod` en el sitemap (la fecha del build no es la del contenido), `LocalBusiness` y acortar los 3 títulos de más de 60 caracteres, que son textos del CMS.
  - _Hecho (P3-07):_
    - `favicon.ico` de 48×48 (PNG embebido, 2,6 KB) y `favicon-32.png`, sacados del isotipo central del `apple-touch-icon`.
    - Se quita `favicon.svg`, que era el logotipo entero (142 KB).
    - _Verificado:_ `file` identifica el ICO de 48×48, y el build-gate comprueba los dos archivos.
    - _A revisar por ti:_ qué parte del logotipo usar de favicon. Elegí la rueda central porque es la que se reconoce a 32 px.
- [x] **D4.** Limpieza de datos y respaldos (P3-08).
  - _Hecho:_
    - Derivados:
      - `ExportService.pruneOrphanDerivatives()` borra, tras cada export (al publicar y en `npm run cms:export`), los derivados que no citan ni `gallery.json` ni `cms-content.json`. Si no encuentra ninguna referencia, no borra nada.
      - Aplicado al repositorio con los JSON versionados: se quitan 62 derivados (547 → 485, 54 → 49 MB).
      - `cms:export` exporta ya la galería antes que el contenido, como la publicación.
    - `galeria.items` pasa a `ENTRADAS_RETIRADAS`: se acaba el aviso en cada publicación.
    - La publicación avisa de las fotos de galería que se quedaron sin imagen, en el registro y en el panel.
    - Respaldos:
      - La copia sale sin `sessions` ni `login_attempts`.
      - Se conservan las 20 más recientes (`CMS_BACKUP_KEEP`).
      - Se descargan desde Administración (`GET /api/cms/backup/descargar/:archivo`, solo nombres de respaldo válidos).
    - Nuevo `npm run cms:limpiar-categorias-de-prueba`: solo lista por defecto, y con `-- --aplicar` borra las categorías de prueba sin fotos.
    - _Verificado:_
      - `cms/test/residuos.test.ts` (5 casos), y `image-derivatives` e `image-references` siguen en verde tras la poda.
      - El script, en una copia de la base local, deja `gallery_categories` en 8.
  - _Queda para ti o para el despliegue:_
    - Ejecutar en local y en el VPS `npm run cms:limpiar-categorias-de-prueba -- --aplicar` y `npm run cms:backfill-media-usages` (los 28 campos sin uso registrado).
    - Retirar a mano los 18 `.jp2` y los 13 duplicados de `uploads/cms` del servidor, los 11 logos y las 5 fotos sin uso de `public/`, y registrar el video en la biblioteca.
    - No los borré: son archivos del servidor o de contenido que conviene revisar antes.
- [x] **D5.** Consistencia de contenido (P3-09). _Hecho en lo que es código; el contenido queda para quien edita._
  - _Hecho:_
    - Nuevo plugin `src/utils/rehypeDiametros.mjs`: aplica `formatDiameters` al texto del cuerpo en Markdown (fuera de `code` y `pre`). C.H. Doiras pasa a mostrar «DN 2.700» también en el texto, igual que en la ficha técnica.
    - La localidad y la región del JSON-LD salen ya de «Datos de la empresa», no de literales.
    - El destino del mapa (`LocationCard`) sigue siendo un literal, a propósito. El mismo texto sirve para el mapa incrustado y para «Cómo llegar», y la dirección de «Datos de la empresa» («Av. Las Industrias N° 10.950, Longitudinal Sur, Km 513…») podría hacer que Google pusiera el pin en otro sitio. No se cambia sin comprobar el pin.
    - _Verificado:_ prueba del plugin en `src/test/format.test.ts`; un build muestra 2 × «DN 2.700» y ningún «DN 2700» en `/proyectos/ch-doiras/`.
  - _Queda para quien edita, desde el panel._ Son textos de la base: cambiarlos en los archivos los pisaría la siguiente publicación.
    - Unificar los nombres de cliente de los proyectos con la lista de /clientes («Colbún S.A.», «Constructora OHL», «Minera El Toqui» / «Nyrstar – El Toqui»…).
    - Alinear los 8 nombres de álbum con su ficha («Pangal» / «C.H. Pangal»…).
    - Poner `servicio: válvulas` a Embalse Chironta, que hoy remite a Compuertas por su categoría.
    - Revisar «más de 80 proyectos» en la descripción de /proyectos (el banco lista 40) y el asunto del `mailto` de Contacto («Consulta desde Hidromont.cl»).
    - Fijar la regla marca / razón social («Hidromont Chile» o «Hidromont Chile S.A.»).
- [x] **D6.** Accesibilidad menor del sitio y del CMS (P3-10, P3-11).
  - _Hecho (P3-10):_
    - Pie: en escritorio, los títulos del pie tienen `tabindex="-1"` y un clic ya no pliega la columna.
    - Contraste y tamaños:
      - Los textos de ejemplo usan `--color-text-muted` (5,9:1), en una regla que va después del preflight de Tailwind.
      - Las migas y los botones de Google Maps y Waze miden 44 px de alto.
      - El H1 de las cabeceras admite `overflow-wrap: anywhere`.
      - `scroll-padding-top: 6.5rem`.
    - Galería: el menú de categorías es una sola parada de Tab (las flechas se mueven dentro) y se cierra al salir; con el visor abierto, el `footer` también queda `inert`.
    - /proyectos: los filtros son un `radiogroup` con nombre (sin `<nav>`), el recuento dice «1 proyecto» y las filas ya no se tiñen al pasar el ratón, porque no se pueden pulsar.
    - _Verificado:_ `e2e/public-a11y-menor.spec.ts` (5 casos) y `public-navigation.spec.ts` en verde.
  - _Hecho (P3-11):_
    - Colecciones: la pestaña activa lleva `aria-current`.
    - Encuadre e iconos:
      - El marco de encuadre tiene `role="group"`.
      - El selector de iconos es una sola parada de Tab, y las flechas mueven la selección.
    - Los `pattern` de la galería escapan el `-`, que era inválido con la bandera `v`.
    - Los botones de las listas miden 44 px al tacto.
    - El cursor queda al final al abrir un campo.
    - La franja de logos se detiene con el editor abierto.
    - El lanzador móvil se llama «Editar sitio: abrir el menú».
    - _Verificado:_ `e2e/cms-a11y-menor.spec.ts` (5 casos); `cms-ui-ux`, `cms-overlay` y `cms-navegacion` actualizados al nombre nuevo.
    - _No hecho:_ explicar en /proyectos que «España» no da resultados; es contenido (la ubicación de esas fichas no dice «España»).
- [x] **D7.** Pulido del panel, visual y de rendimiento (P3-12, P3-13, P3-14).
  - _Hecho (P3-12):_
    - Datos que se guardan:
      - Una ruta de imagen o video que no existe se rechaza al guardar («No hay ningún archivo en…»).
      - En las listas se recortan los elementos y se quitan los vacíos.
      - En el esquema de las colecciones, los textos opcionales y las listas se recortan, así que `mandante: "   "` ya no oculta al cliente ni pinta insignias vacías.
    - Destacado y banco:
      - Al pasar un proyecto de destacado a banco se pide confirmación y su página redirige a `/proyectos/`; al volver a destacado, la redirección se quita.
      - «Tipo» y «Orden» explican su efecto, incluidos los 6 destacados de la portada.
    - El nombre de la ficha admite como máximo 240 caracteres y el título interno se recorta, así que el guardado ya no se aborta.
    - Lo de «publicar dos veces» ya estaba resuelto en C3 (409 «en curso»).
    - _Verificado:_ la prueba de `publicar.test.ts`, adaptada: la API rechaza la ruta y la publicación sigue avisando si el archivo desaparece después. `astro check` en verde.
    - _No hecho:_ «Usar la imagen original».
  - _Hecho (P3-13):_
    - Logo y pie:
      - La columna 0 del PNG del logo, opaca de arriba abajo (la raya a la izquierda), pasa a ser transparente.
      - El correo del pie ya no se parte (`overflow-wrap: anywhere` en vez de `break-all`).
    - Formulario:
      - El aviso de error se separa del botón.
      - El mensaje lleva un contador «n / 2000».
      - Un nombre de solo espacios no pasa la validación.
      - El teléfono lleva `inputmode="tel"` y un patrón de dígitos.
    - Las fotos de la galería de servicios y proyectos se amplían en el mismo visor de /galeria, con clic o teclado, y no con el editor abierto sobre una foto editable.
    - _Verificado:_ e2e nuevas en `public-envio-y-foco.spec.ts` y `public-servicio-proyectos.spec.ts`; `imagenes.spec.ts` adaptada a los logos nuevos.
    - _Queda para quien edita:_ unificar los rótulos de los botones a Contacto y completar las fichas desiguales (contenido).
  - _Hecho en parte (P3-14):_
    - El JSON del muro de /galeria ya no lleva los LQIP en base64 (comprobado en e2e).
    - Los `sizes`, ya en C8.
    - _No hecho:_
      - La fachada del mapa de /contacto se probó y se retiró: `public-responsive.spec.ts` recoge que el mapa se repuso a petición del propietario, visible.
      - Tampoco se hicieron el CSS por página, el recorte móvil de la portada ni la fuente con Slow 4G, que son mejoras menores.

---

## Anexo A. Limitaciones

- **VPS sin inspeccionar por SSH** (permiso denegado en esta sesión): no se verificó la base de producción (recuento de fotos publicadas frente a `gallery.json`, deriva de revisiones, categorías de prueba, `media_usages`), el `.env` real (`CMS_PUBLISH_CHECK_COMMAND`, `CMS_TRUST_PROXY`, `CMS_ALLOW_GALLERY_SHRINK`), el estado del árbol git del servidor ni la versión exacta de Caddy.
- **Firefox no se probó:** el binario se instaló en la caché global de Playwright, pero no arranca dentro del sandbox de este entorno. Hay un script listo para ejecutarlo en otra máquina (`browsers.mjs firefox-desktop`, en los artefactos de trabajo).
- **WebKit de Playwright no equivale a Safari en un iPhone real** (barra dinámica, scroll elástico, VoiceOver). No se usaron lectores de pantalla reales: la accesibilidad se evaluó con teclado, ARIA calculado y axe-core.
- **Formulario de contacto:** solo respuestas simuladas; el comportamiento real de FormSubmit (formato, límites, inyección de cabeceras de correo) no se verificó.
- **Performance de laboratorio** desde una sola red cercana al VPS; sin datos de campo (CrUX/RUM). Lighthouse simulado y el throttling aplicado difieren; lo real queda probablemente entre ambos.
- **Pruebas E2E del CMS** hechas en clones con la **base local** (atrasada respecto a git) y, para la interfaz, con `astro dev` y un comando de publicación que falla a propósito; la publicación real se probó por API con `npm run build:log`.
- **Explotabilidad de los avisos de sharp y Astro** no demostrada (no se construyeron exploits).
- El límite de intentos de login detrás de Caddy se verificó con un Caddy 2.10 local con la misma configuración, no contra el VPS.

## Anexo B. Evidencias

En `auditoria-hidromont-evidencias/` (junto a este informe, sin versionar):

| Tema                                              | Archivos                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0: publicar tras borrar una foto                 | `log-p0-galeria-publicar.txt`                                                                                                                                                                                                                                                                                          |
| Fichas nuevas y renombradas                       | `cmsux-115-proyecto-nuevo-clic-titulo.png`, `cmsux-47-nuevo-proyecto-creado.png`, `e2e-t1i-proyectos-duplicados.png`, `e2e-t1i-home-duplicados.png`, `e2e-t1n-renombrado-sin-imagen.png`, `e2e-t6b-compuertas-imagen-rota.png`                                                                                         |
| Barra y panel del CMS                             | `cmsux-05-barra-tras-login.png`, `cmsux-91-tablet-barra.png`, `cmsux-122-clic-menu-abre-editor.png`, `cmsux-120-panel-tapa-elemento-editado.png`, `cmsux-21-ficha-servicio-arriba.png`, `cmsux-82-movil-menu-editor.png`                                                                                               |
| Estados y errores del panel                       | `cmsux-23-cerrar-ficha-tras-guardar.png`, `cmsux-15-recarga-pagina-vs-editor.png`, `cmsux-34-archivo-falso-elegido.png`, `cmsux-60-publicar-resumen.png`                                                                                                                                                               |
| Editor de servicio, imágenes y textos             | `cmsux-31-editor-imagen-biblioteca.png`, `cmsux-28-editor-cuerpo-markdown.png`, `cmsux-43-textos-del-sitio-formulario.png`, `cmsux-14-titulo-300-en-390.png`                                                                                                                                                           |
| Editor oculto en el público                       | `weba-crop_public_compuertas_galeria.png`, `weba-crop_editor_compuertas_galeria.png`, `weba-crop_editor_clientes_lista.png`                                                                                                                                                                                            |
| Menú móvil y foco                                 | `webb-menu-mobile-open-landscape-568x320.png`, `webb-menu-mobile-servicios-expandido-390x844.png`, `webb-foco-cta-hero-primario-antes-despues.png`, `webb-foco-buscador-galeria-antes-despues.png`                                                                                                                     |
| Sitio: home, fichas, proyectos, galería, contacto | `webb-vp-home-1440.png`, `webb-vp-home-390.png`, `webb-vp-servicios_compuertas-390.png`, `webb-full-servicios_compuertas-1440.png`, `webb-proyectos-banco-lista-390.png`, `webb-proyectos-sin-resultados-1440.png`, `webb-lightbox-390.png`, `webb-lightbox-deeplink-foto30.png`, `webb-contacto-timeout-20s-1280.png` |
| Favicon                                           | `weba-favicon_32_zoom.png`                                                                                                                                                                                                                                                                                             |
