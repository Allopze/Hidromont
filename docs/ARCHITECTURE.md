# Arquitectura

> Cómo está construido el sitio de Hidromont Chile y su CMS, tal como está en
> el código. Para instalar y los comandos, ver [`README.md`](../README.md); para
> desplegar, [`DESPLIEGUE-VPS.md`](./DESPLIEGUE-VPS.md); para editar contenido,
> [`CMS-GUIDE.md`](./CMS-GUIDE.md); para seguridad, [`SECURITY.md`](./SECURITY.md).
>
> Reescrito en septiembre de 2026 a partir de la auditoría
> (`AUDITORIA-HIDROMONT.md`, sección 2). La versión anterior describía un
> sitio en Cloudflare Pages con un CMS que solo corría en local; ya no es así.

## Visión general

Un solo repositorio, un solo proceso Node en un VPS y dos dominios:

- **`hidromontchile.cl`**: el sitio público. HTML estático generado por Astro.
- **`editor.hidromontchile.cl`**: el mismo sitio con el editor visual montado
  encima y la API del CMS.

```text
                              Internet
                                 │
        ┌────────────────────────┴─────────────────────────┐
        │ Caddy 2 (VPS) · TLS Let's Encrypt · zstd/gzip      │
        │  hidromontchile.cl (12 MB) · editor.* (64 MB,      │
        │  X-Robots-Tag: noindex) · www → 301                │
        └────────────────────────┬─────────────────────────┘
                                 │ reverse_proxy 127.0.0.1:8787
        ┌────────────────────────┴──────────────────────────────────────┐
        │ node server.mjs → cms/server.ts (Fastify 5, systemd)           │
        │  ├─ onRequest: /api en el host público → 404 (con dos perfiles) │
        │  ├─ onSend: CSP con hashes del build servido, HSTS, XFO, PP…    │
        │  ├─ /api/cms/*  45 rutas (auth + CSRF en las mutaciones)        │
        │  └─ GET /*      cms/staticSite.ts                               │
        │                   host público → dist/                          │
        │                   editor.*     → dist-editor/                   │
        │                   + /uploads/cms, redirecciones, URL canónicas  │
        └───────┬───────────────────────────────────┬──────────────────────┘
                │ better-sqlite3 (WAL)              │ «Publicar»
                ▼                                   ▼
   cms/data/hidromont-cms.sqlite       export (JSON + .md + derivados)
   15 tablas                           → npm run build:log (dos perfiles)
                                       → cambio atómico de dist/ y dist-editor/
```

## Stack

| Capa          | Tecnología                                                                                                     | Dónde                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Sitio         | Astro 7 (`output: 'static'`, `build.format: 'directory'`), Tailwind 3 por PostCSS, `@astrojs/sitemap`          | `astro.config.mjs`, `src/`                                     |
| Contenido     | Colecciones `proyectos` y `servicios` (`.md`) y `clientes` (`clientes.json`), con esquemas zod                 | `src/content/`, `src/content.config.ts`                        |
| Datos del CMS | `src/data/cms-content.json` y `src/data/gallery.json`, que escribe el export                                   | `src/data/`                                                    |
| Editor        | Overlay en módulos ES (`.js` y `.ts`), cargado con `import()` solo en `editor.*` o con `?cms=1` en desarrollo  | `src/scripts/cms/overlay/`, `src/components/cms/`              |
| API           | Fastify 5 + better-sqlite3; rutas → controllers → services → repositories                                      | `cms/`                                                         |
| Imágenes      | sharp: derivados WebP de 360, 640, 768, 1024 y 1600 px en `public/gallery/derived/`; subidas en `uploads/cms`  | `cms/services/imageService.ts`, `cms/services/mediaService.ts` |
| Servidor      | Un proceso Node bajo systemd                                                                                   | `deploy/hidromont.service`                                     |
| Borde         | Caddy 2                                                                                                        | `deploy/Caddyfile`                                             |
| Externos      | FormSubmit.co (formulario de contacto), Google Maps (iframe), Sentry (solo backend y solo si hay `SENTRY_DSN`) | `ContactForm.astro`, `cms/utils/errorTracking.ts`              |

## Dos perfiles de build

La presencia del editor se decide **al compilar** (`PUBLIC_ENABLE_CMS`). Con
`PUBLIC_ENABLE_CMS=1` (lo que lleva el `.env` de producción),
`scripts/build-con-registro.mjs` compila dos veces:

- `dist/` con `PUBLIC_ENABLE_CMS=0`: sin marcas `data-cms-*` ni el arranque del
  editor. Es lo que recibe `hidromontchile.cl`.
- `dist-editor/` con `PUBLIC_ENABLE_CMS=1`: lo que recibe `editor.*`.

`cms/staticSite.ts` elige el directorio por el host (`distParaHost`), y
`cms/server.ts` responde 404 a `/api/*` en el host público mientras exista
`dist-editor/` (`apiFueraDeEsteHost`). Los dos directorios se sustituyen a la
vez al terminar el build (`*.nuevo` → rename), bajo un cerrojo entre procesos
(`.build.lock`), así que un build a medias nunca queda servido.

Lo que solo debe ver quien edita (el recuadro de la lista de clientes, los
huecos «+ Agregar foto») se pinta con `hidden` y `data-cms-solo-editor`
(`src/utils/soloEditor.ts`); el overlay lo destapa al montarse.

## Sitio público (`src/`)

- **Páginas**: `index`, `empresa`, `clientes`, `galeria`, `contacto`,
  `contacto/gracias`, `404`, `servicios/` y `servicios/[slug]` (una por
  servicio), `proyectos/` y `proyectos/[slug]` (solo los de `tipo: destacado`;
  los del banco aparecen en la tabla de `/proyectos/`).
- **Lectura del CMS**: `src/data/cms.ts` (`getCmsText`, `getCmsValue`,
  `getCmsNumber`, `getCmsImageDerived`…). Una clave presente pero vacía se
  respeta como vacía; el texto del código solo aparece si la clave falta, y
  `src/test/cms-keys.test.ts` exige que toda clave literal exista en el export.
- **Fichas de colección**: las fotos y galerías de cada servicio o proyecto se
  derivan de sus fichas del CMS (`project-images.ts`, `service-images.ts`,
  `project-galleries.ts`, `service-galleries.ts`). La relación servicio ↔
  proyecto vive en `src/data/servicio-proyectos.ts`.
- **Nombres legibles**: `src/data/field-labels.ts` (campos) y
  `src/data/entry-names.ts` (fichas), compartidos por el panel y el servidor.
- **URLs**: la forma canónica lleva barra final. El servidor redirige con 301
  el resto (`/x`, `/x/index.html`, `//x`), y la integración
  `src/utils/enlacesConBarra.mjs` pasa a esa forma los enlaces internos del HTML
  generado. `trailingSlash` sigue en `'ignore'` para no romper `astro dev`.

## Editor (overlay)

- `src/scripts/cms/overlay/index.ts` decide si cargar el editor (host
  `editor.*`, o `?cms=1` en desarrollo) y lo importa con `import()`: un
  visitante del sitio público no descarga nada del editor.
- `events.js` delega los eventos en `document`; `fields.js` edita un campo
  suelto; `collections.js`, las fichas de servicios, proyectos y páginas;
  `gallery.js`, la galería; `publish.js`, el resumen y la publicación;
  `richtext.js` y `richtext-visual.js`, el cuerpo con formato (editor visual que
  guarda Markdown).
- Tipos: los módulos se van pasando a `// @ts-check` uno a uno;
  `src/test/overlay-ts-check.test.ts` impide que un módulo marcado pierda la
  marca.

## Backend (`cms/`)

```text
routes/cmsRoutes.ts        cableado de las 45 rutas y tareas de arranque
controllers/               validación (zod) y forma de la respuesta; BaseController
                           traduce errores (ErrorDeUsuario → su estado, el resto 500)
services/                  auth, content, media, image, gallery, export, publish,
                           pending, backup, undo
repositories/              SQL con sentencias preparadas
db/schema.ts               15 tablas y 6 migraciones idempotentes
security/headers.ts        CSP con los hashes de los scripts inline del build
staticSite.ts              sirve dist/ o dist-editor/, uploads, redirecciones
```

Tablas: `users`, `sessions`, `content_entries`, `content_fields`,
`media_assets`, `media_usages`, `revisions`, `publish_jobs`, `audit_events`,
`login_attempts`, `gallery_categories`, `gallery_albums`, `gallery_items`,
`collection_slugs` (qué slugs ha tenido cada ficha) y `redirects` (las que crea
el CMS al cambiar la dirección de una ficha publicada).

Al arrancar, `cmsRoutes` completa lo que falte sin pisar lo existente:
importa fichas y campos nuevos de la semilla (`cms/content/defaultContent.ts`,
que toma sus valores del `cms-content.json` publicado), crea las fichas de foto
y galería de cada servicio o proyecto, retira los campos sin uso
(`CAMPOS_RETIRADOS`), deja una revisión con el estado actual de cada ficha y
descarta publicaciones colgadas.

## Guardar y publicar

1. **Guardar** escribe en SQLite: sube la versión, crea una revisión y usa
   bloqueo optimista (`expectedVersion`).
2. **Publicar** (`publishService`):
   - exporta primero la galería y después el contenido: `gallery.json`,
     `cms-content.json`, los `.md` de las colecciones y los derivados WebP;
   - no deja que el export encoja la galería en silencio
     (`assertNoSilentGalleryShrink`) y avisa de los archivos que faltan;
   - ejecuta `CMS_PUBLISH_CHECK_COMMAND` (por defecto `npm run build:log`) y
     refresca la CSP.

   Un solo trabajo a la vez: el segundo recibe 409 «en curso». El HTML se sirve
   con `no-cache`, así que el cambio se ve al terminar el build.

3. **Despliegue de código** (`scripts/deploy-vps.sh`): comprueba que no haya
   cambios locales fuera del contenido exportado, respalda ese contenido,
   `git pull --ff-only`, `npm ci`, `npm run cms:export`, `npm run build:log` y
   reinicia el servicio. La base de datos manda sobre el contenido del
   repositorio; ver `DESPLIEGUE-VPS.md`.

## Pruebas

| Tipo      | Herramienta | Dónde                                 |
| --------- | ----------- | ------------------------------------- |
| Unitarias | Vitest      | `cms/test/`, `src/test/` (≈460 casos) |
| E2E       | Playwright  | `e2e/` (≈210 casos, Chromium en CI)   |

Los e2e levantan `astro dev` y un CMS de sandbox con una copia de la base
(`scripts/e2e-cms-sandbox.mjs`), así que nunca tocan la base real. La CI
(`.github/workflows/ci.yml`) ejecuta lint, `astro check`, build, Vitest, el
build-gate y los e2e.

## Decisiones

1. **Estático y servido por el propio CMS.** El sitio no depende de la API
   para mostrarse; el mismo proceso lo sirve y lo regenera al publicar, sin
   paso manual.
2. **SQLite.** Suficiente para una persona editando; WAL, claves foráneas y
   migraciones idempotentes. El respaldo es copiar un archivo.
3. **El editor, fuera del build público.** Dos perfiles de build y la API
   cerrada en el host público (ver arriba).
4. **Validación zod en la API**, slugs con patrón estricto y contención de
   rutas al servir, subir y exportar.
5. **Escrituras atómicas.** El export escribe en `.tmp` y renombra; el build,
   en `*.nuevo`, y cambia los directorios al final.
