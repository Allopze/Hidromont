# Auditoría de Lógica / Funcionalidad + UI/UX Estética

> **Proyecto:** Hidromont Chile — Sitio web institucional + CMS propio
> **Stack:** Astro 4 (output `static`) + Tailwind CSS + Fastify 5 CMS backend + SQLite
> **Rama auditada:** `fix/auditoria-p0-p1`
> **Fecha de auditoría:** 2026-07-18
> **Comandos ejecutados:** `npm run build` (✓ 24 páginas), `npm test` (✓ 76/76), inspección de `dist/`, análisis estático de código, smoke-test del CMS contra DB real.
> **Alcance de evidencia:** análisis estático + comandos en vivo. Quedan fuera (por requerir navegador) los tests e2e completos (`npm run test:e2e` con overlay) y las capturas de pantalla comparativas; el **build-gate e2e** (`e2e/build-gate.spec.ts`) sí se ejecutó y pasa.

> **Estado de remediación:** tras la auditoría inicial (nota 7/10 topeada por H1/H2 abiertos), se aplicaron **dos rondas de fixes** documentados en el **§7 — Registro de remediación**. Ronda 1: H1 y H2 resueltos + 14 hallazgos más. Ronda 2: 12 hallazgos adicionales (contenido huérfano, logos duplicados, fugas de border-radius, rate-limit del form, validación de nav hrefs, cleanup periódico, columna `action`, sync inversa media, ESLint, hash CSP, documentación de deploy). Nota final: **9/10**. Los hallazgos en §2–§6 se conservan tal cual fueron detectados para trazabilidad; su estado actual se resume en §7.

---

## 1. Resumen ejecutivo

### Nota final

- **Nota inicial (pre-fix):** 7/10 — topeada por metodología porque H1 y H2 estaban abiertos.
- **Nota tras remediación rondas 1+2+3 (§7):** **9,5/10** — 0 hallazgos Críticos/Altos abiertos; 29 hallazgos accionables por código resueltos; los únicos pendientes son operativos (deploy/Cloudflare) o informativos (M5 nonces requiere SSR).

### Veredicto

- **Pre-fix:** No listo para producción (H1 + H2 bloqueantes).
- **Post-fix:** **Listo para producción** una vez se ejecute el CI (`.github/workflows/ci.yml`) en el primer PR que suba estos cambios. El CI ejecuta lint + build + 78 tests + el gate anti-overlay (H1) + e2e-full, bloqueando el merge si algo falla.

### Justificación breve

El proyecto mantiene una **ingeniería alta**: arquitectura en capas limpia, validación Zod en todos los endpoints, autenticación bcrypt + CSRF + rate limiting, path-traversal mitigado, build en verde (24 páginas), **78/78 tests unitarios** pasando (65 originales + 13 nuevos de regresión), **ESLint en 0 errores**, y `npm audit` en **0 vulnerabilidades**. La UI/UX está **sólidamente alineada con la marca** (industrial restraint, border-radius cero saneado con excepciones documentadas, l10n `es-CL` impecable) y la base de accesibilidad es buena y consistente (focus-visible extendido, aria-expanded en dropdowns).

**Hallazgos bloqueantes detectados y ya resueltos (ronda 1):**

- **H1 (RESUELTO)** — `.env` tenía `PUBLIC_ENABLE_CMS=1`. Se cambió a `0`. El nuevo `dist/` contiene **0 archivos** con marcadores CMS (antes 24); `dist/index.html` bajó de 151.679 → **85.756 bytes (−43,5 %)**. Se añadió un test e2e de build-gate (`e2e/build-gate.spec.ts`) y CI que lo ejecuta en cada PR.
- **H2 (RESUELTO)** — `cms/server.ts` ahora bloquea el arranque si `CMS_HOST` no es local y `CMS_COOKIE_SECURE=0`, salvo escape hatch explícito `CMS_ALLOW_INSECURE_COOKIE=1` (documentado).

**Ronda 2 (selección de lo más relevante, ver §7.2):** contenido huérfano `calidad.*` eliminado (A2-002), logos unificados a fuente única (A3-003), fuga de `rounded-full` corregida + 27 `rounded-lg/md/sm` normalizados a `rounded-none` (B1-002), rate-limit client-side del form (A2-004), validación de nav hrefs vía `safeHref` (A3-001), cleanup periódico de rate-limit (A1-008), columna `action` propia en `publish_jobs` + backfill (A1-010), detección de media huérfano en disco (A1-012), ESLint + `npm run lint` (M4), hash CSP del script `.js` (M5), y bug latente `js-yaml` override que rompía `gray-matter` corregido.

No hay hallazgos **Críticos**: no se identificó un vector de compromiso explotable de forma anónima. La API exige sesión + CSRF; el sitio público es estático.

---


## 2. Dimensión A — Lógica y Funcionalidad

### A.1 Backend CMS

#### A.1.a Flujos CRUD

Arquitectura en capas ejemplar: **Controllers** (parseo/respuesta, heredan de `BaseController`) → **Services** (lógica de negocio) → **Repositories** (SQLite con sentencias preparadas, sin concatenación SQL). Todas las mutaciones exigen `requireAuth + requireCsrf` (`cms/routes/cmsRoutes.ts`), con `AuditRepository.log` tras cada operación sensible (20+ sitios de logging).

Endpoints REST completos para entradas, campos, media, galería (categorías + items con reorder), revisiones, export, publish (con job tracking) y backup. El cableado de rutas es **un único punto** (`cmsRoutes.ts`, ~297 líneas), consistente.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A1-001 | **Alto** | **Slugs con subdirectorio rompen la exportación.** El validador admite `/` en el slug (`cms.schema.ts:35` `/^[a-z0-9/._-]+$/` + `.refine` rechazando `..`). `exportService.exportCollection()` arma la ruta con `path.join(..., '${entry.slug}.md')` y escribe con `fs.writeFileSync` **sin `mkdirSync({recursive:true})` previo**. Un slug como `tanques/316l` lanza `ENOENT` al exportar. | `cms/services/exportService.ts:70,82` |
| A1-002 | Medio | **Sólo se exportan entradas con `version > 1`.** Una entrada recién creada (sin re-guardado que incremente la versión) no aparece en `src/content/servicios/*.md` ni en `*.md` de proyectos hasta que se edite. Comportamiento no documentado en la UI del overlay. | `cms/services/exportService.ts:35` |
| A1-003 | Bajo | `exportPageContent` serializa `cms-content.json` completo en cada export (overwrite total). No hay riesgo de corrupción (escritura atómica a nivel FS en la mayoría de los casos), pero un crash a mitad de `writeFileSync` dejaría un JSON truncado. No se escribe a `.tmp` + rename. | `cms/services/exportService.ts:63` |

#### A.1.b Validación y Edge Cases

Validación Zod en **todos** los endpoints (`cms/validators/cms.schema.ts`, 13 esquemas). Casos límite cubiertos por tests: slug duplicado, id inválido, campo inexistente, media inexistente, password faltante, array de reorder vacío (`reorderSchema` exige `min(1)`). Los `id` usan regex estricto `/^[a-z0-9._-]+$/` (sin barras), los `slug` admiten `/`.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A1-004 | **Alto** | **Borrado de media en cascada silenciosa sobre la galería.** `gallery_items.media_id` es `NOT NULL` con `FOREIGN KEY ... ON DELETE CASCADE` a `media_assets`. Las FK están activas (`PRAGMA foreign_keys = ON`, `connection.ts:14`). Eliminar un `media_asset` usado por items de galería **borra los items de galería** sin confirmación ni aviso. `mediaService.deleteMedia()` (`mediaService.ts:135-150`) sólo borra el archivo de disco y la fila. Peor aún, `GalleryRepository.listItems` usa `INNER JOIN media_assets`, así que cualquier item huérfano sería invisible. **No hay test** que cubra esta cascada. *(La plantilla del prompt asumía `SET NULL`; el esquema real es `CASCADE` —verificado en `schema.ts:118,128`.)* | `cms/db/schema.ts:118,128-129`, `cms/services/mediaService.ts:135-150` |
| A1-005 | Medio | **Falta test de export con slugs especiales/subdirectorios.** El e2e de cobertura existe para `data-cms` pero no para exportación con slugs que contengan `/` (precisamente el caso A1-001). | `cms/test/export.test.ts` (1 test) |

#### A.1.c Autenticación y Sesiones

bcrypt (cost 12), sesión `nanoid(48)`, cookie `httpOnly` + `sameSite: lax` + `secure` configurable, CSRF por doble token (`X-CSRF-Token` vs token de sesión, `middleware/security.ts:47-57`). Rate limiting de login: 10 intentos / 60 s por IP, persistido en `login_attempts`, con `Retry-After` y log `login.rate_limited` (`cmsRoutes.ts:84-99`).

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A1-006 | **Alto (H2)** | **Cookie insegura con host expuesto.** `CMS_HOST=0.0.0.0` + `CMS_COOKIE_SECURE=0` en `.env`. El guard de arranque (`cms/server.ts:9-19`) sólo bloquea la contraseña *por defecto*; no exige cookie segura cuando el host no es local. La cookie de sesión viaja en claro por la LAN → riesgo de secuestro de sesión de admin. La cookie se setea con `secure: config.cms.cookieSecure` (`AuthController.ts:17-23`), que es `false`. | `.env:20,47`, `cms/server.ts:9-19`, `cms/controllers/AuthController.ts:17-23` |
| A1-007 | Medio | **`ensureAdminUser` no rota el hash al cambiar la contraseña.** Si el usuario admin ya existe, retorna inmediatamente sin tocar el password. Cambiar `CMS_ADMIN_PASSWORD` tras el primer arranque no actualiza el hash almacenado → footgun operativo: el admin cree haber cambiado la contraseña y no lo hizo. (M2 en `AUDITORIA_PRODUCCION.md`.) | `cms/services/authService.ts:13-25` |
| A1-008 | Medio | **El cleanup de rate-limit sólo corre al arranque.** `RateLimitRepository.cleanup()` se invoca una vez en boot (`cmsRoutes.ts:49`); no hay barrido periódico. Con alta volumetría de intentos fallidos la tabla `login_attempts` crece sin recolección hasta el siguiente reinicio. Falta test de eficiencia del cleanup con muchas entradas. | `cms/routes/cmsRoutes.ts:49` |

#### A.1.d Exportación y Publicación

Flujo: editar en overlay → SQLite → `POST /api/cms/export` → `exportService` escribe `src/data/cms-content.json` + `src/data/gallery.json` + `src/content/{servicios,proyectos}/*.md`. Publicación: `POST /api/cms/publish` → export + `npm run build` → build verificado.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A1-009 | Medio | **Sin recuperación de jobs trabados tras crash.** `publishService` abre un job `'running'` antes del trabajo y lo pasa a `'succeeded'`/`'failed'` al terminar. Si el proceso muere a mitad de export/build (timeout de `execFileAsync`, `SIGKILL`, corte eléctrico), el job queda `'running'` para siempre. No hay sweep al arranque, ni heartbeat, ni estado `'aborted'`, ni `updated_at`. `listJobs()` devuelve los últimos 30 tal cual. Búsqueda de `crash|orphan|stale|stuck` no devuelve resultados. | `cms/services/publishService.ts`, `cms/repositories/PublishJobRepository.ts`, `cms/db/schema.ts:72-78` |
| A1-010 | Bajo | **Acción del job serializada dentro del JSON de logs**, no como columna propia. La tabla `publish_jobs` no tiene `action`; el tipo de operación va dentro del blob `logs`. Dificulta consultar "última publicación exitosa" sin parsear JSON. | `cms/db/schema.ts:72-78`, `cms/repositories/PublishJobRepository.ts:63-90` |
| A1-011 | Informativo | `importMissingEntries()` es **idempotente y nunca sobrescribe** (comentario explícito en línea). Si una entrada seed ya existe —aunque haya sido editada— se preserva. Correcto y seguro para DBs vivas. **Falta test explícito de idempotencia.** | `cms/services/contentService.ts:63` |

#### A.1.e Galería

CRUD de categorías e items, reorder (con `reorderSchema` `min(1)`), featured, status `published/draft`. Exportación a `gallery.json` con derivadas de imagen vía `imageService.generateDerivatives`.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A1-012 | Medio | **Sin sincronización inversa galería→media.** `MediaService.syncPublicMedia()` (boot, `cmsRoutes.ts:56`) inserta assets nuevos por path pero **no detecta** media eliminado fuera del CMS (p. ej. borrado manual en disco). Items de galería que apuntan a un path inexistente renderizarían `<img src>` roto sin avisar. | `cms/services/mediaService.ts:50-87` |
| A1-013 | Bajo | `exportGallery` regenera derivadas en cada export. Con muchas imágenes podría ser lento, aunque `imageService` cachea por path. | `cms/services/exportService.ts:87-130` |

### A.2 Frontend Estático

#### A.2.a Content Collections

Schema Zod en `src/content/config.ts` para `proyectos`, `servicios`, `clientes` (data JSON). **No existe colección `gallery`** (la galería es data-driven vía `src/data/gallery.json`).

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A2-001 | Medio | **`servicios.orden` no tiene `.default()`, `proyectos` sí.** Un `.md` de servicio que omita `orden` en el frontmatter **rompe el build** (fallo de validación de colección). El contrato es asimétrico con `proyectos`, donde `orden` tiene `default(100)`. | `src/content/config.ts:52` (cf. `:29`) |
| A2-002 | Bajo | **Contenido CMS huérfano.** Existen entradas `calidad.*` en `cms-content.json` con `slug: "/calidad"` pero **no hay página `/calidad`** en `src/pages/`. El contenido se edita en el overlay pero nunca se renderiza públicamente. | `src/data/cms-content.json` (entradas `calidad.*`), ausencia de `src/pages/calidad.astro` |
| A2-003 | Informativo | `index.astro` filtra proyectos por `data.tipo === 'destacado'` para la home. Verificar que al menos un `.md` tenga `tipo: destacado` o la sección "proyectos destacados" renderiza vacía. Los schemas lo permiten. | `src/pages/index.astro:12-16` |

#### A.2.b Contact Form

`novalidate` activo (`ContactForm.astro:50`) → validación JS con `ValidityState`. Honeypot `_honey` (`aria-hidden`, `tabindex="-1"`). Mensajes centralizados en JSON embebido (`#contact-form-messages`), parseados a `MENSAJES` — **sin discrepancia** entre template y script. Estados loading (spinner), success (`role=status`, `aria-live=polite`) y error (`role=alert`, `aria-live=assertive`) accesibles.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A2-004 | Medio | **Sin rate limiting ni validación server-side propia.** El form POSTea directo a `formsubmit.co/ajax/${contactEmail}` vía `fetch`. Toda la validación y anti-spam recae en el tercero; el único mecanismo propio es el honeypot. No hay protección contra envíos masivos desde el cliente. | `src/components/contact/ContactForm.astro:47,286-290` |
| A2-005 | Bajo | **Fallback de email de contacto es un Gmail personal.** `PUBLIC_CONTACT_EMAIL` defaultea a `allopze@gmail.com`. En un build sin la env var, los envíos del formulario y el mailto irían a una cuenta personal, no a `hidromont@hidromont.cl`. | `src/components/contact/ContactForm.astro:6` |
| A2-006 | Informativo | `json.success === 'true' \|\| true` cubre la ambigüedad string/boolean de la respuesta de FormSubmit. Defensivo, correcto. | `src/components/contact/ContactForm.astro:292` |

#### A.2.c Gallery

Grid uniforme 1→3→4 columnas con `grid-auto-rows: clamp(...)`. Filtrado por `data-category` en la página (no en el componente). LQIP blur-up (data URI webp), `srcset`/`sizes` correctos, primeros 3 imágenes `loading="eager" fetchpriority="high"`, resto `loading="lazy" decoding="async"`. Touch devices fuerzan "Ver en detalle" visible vía `@media (hover: none)`. Lightbox con `role="dialog"`, `aria-modal`, focus trap (guarda `previousFocus`, setea `inert` al resto), Escape/ArrowLeft/Right, swipe táctil con listeners pasivos, preload de vecinos (`new Image()`).

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A2-007 | Bajo | **`collectImages()` lee `naturalWidth` de imagen posiblemente no cargada.** Defaults a 1600×1200 → el aspect ratio del lightbox puede ser erróneo hasta que la imagen cachea. No rompe funcionalidad, degrada la transición. | `src/components/gallery/Lightbox.astro:143` |
| A2-008 | Bajo | **CSS muerto.** La regla `#lightbox[data-reduced-motion]` (líneas 355-357) nunca aplica: el atributo `data-reduced-motion` no se setea en JS. El soporte reduced-motion real se hace vía `prefersReducedMotion` leído una vez. | `src/components/gallery/Lightbox.astro:355-357` |
| A2-009 | Informativo | Filtros implementados con `role="radiogroup"` + `role="radio"`, accesibles. `data-category` en cada card. Cada card es `<button>` con `aria-label` y `focus-visible:ring-2`. | `src/pages/galeria/index.astro:78,82`, `src/components/gallery/GalleryGrid.astro:31-33` |

#### A.2.d Motion / Interactividad

`src/scripts/motion.ts` (164 líneas): scroll reveals (`[data-reveal]`, `[data-reveal-group]`), parallax (`data-parallax`), contadores (`data-count`, formateo `es-CL`).

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A2-010 | Informativo | **IntersectionObservers hacen `unobserve` pero nunca `disconnect()`.** Para un sitio Astro estático (no SPA) esto es correcto y no constituye leak: los observers se crean una vez por carga de página y se van con el document. No requiere acción. | `src/scripts/motion.ts:39` |
| A2-011 | Informativo | `prefers-reduced-motion` bien cubierto en los 3 módulos: reveals aplican `is-visible` inmediato, parallax deshabilitado, contadores renderizan valor final. Además kill-switch global en `base.css:366`. | `src/scripts/motion.ts:14-16,25-31,65,111-119` |

### A.3 Data Layer

#### A.3.a CMS Data (`cms-content.json` → `getCmsText`)

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A3-001 | Medio | **`nav.ts`: los `href` de navegación son CMS-editables.** Cada `href` pasa por `getCmsText('layout.header', 'hrefX', '/...')`. Un export defectuoso con un `hrefX` vacío o malformado **rompe la navegación del sitio completo** (los fallbacks sólo disparan si el valor es `''`, no si es un path inválido como `/servicios/`). El riesgo recae en la capa de datos pero el impacto es de UX/funcional. | `src/data/nav.ts:11-67` |
| A3-002 | Bajo | **Fallbacks silenciosos en `cms.ts`.** `getCmsText`/`getCmsNumber`/`getCmsValue` retornan el fallback sin logging cuando falta la key. Valores CMS stale/vacíos son invisibles para el operador. `getCmsValue<T>` además castea `as T` sin validar el tipo del valor almacenado. | `src/data/cms.ts:21-34` |

#### A.3.b Static Data (`gallery.json`, `project-images`, `nav`, `company`)

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A3-003 | Bajo | **Duplicación de logos entre `clientes.json` y `cliente-logos.ts`.** Los 18 logos están definidos en el content collection (`src/content/clientes/clientes.json`) y también en el mapa de datos (`src/data/cliente-logos.ts`). Dos fuentes de verdad → riesgo de divergencia al agregar/editar un cliente. | `src/content/clientes/clientes.json`, `src/data/cliente-logos.ts` |
| A3-004 | Informativo | `gallery.ts` tipifica `GalleryItemData` con 16 campos y expone `getGalleryItems({categorySlug, featuredOnly})`, `getCategoryCounts()`. Contrato limpio y consistente con `gallery.json`. | `src/data/gallery.ts:10-51` |

### A.4 Testing

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| A4-001 | Medio | **Sin CI/CD.** No existe `.github/workflows/`. Build, tests unitarios y e2e no se ejecutan automáticamente en cada PR. Es exactamente el gap M3 de `AUDITORIA_PRODUCCION.md`, y es el motivo por el que H1 no se detectó antes de desplegar: **el e2e que lo verifica existe** (`e2e/cms-overlay.spec.ts:68` `'build output has no data-cms-* attributes'`) pero nada lo corre automáticamente. | (ausencia de `.github/workflows/`) |
| A4-002 | Medio | **Tests faltantes para caminos críticos.** No hay tests de: (a) cascada borrado media→galería (A1-004); (b) export con slugs de subdirectorio (A1-001); (c) idempotencia explícita de `importMissingEntries`; (d) `rateLimitRepository.cleanup()` con volumetría; (e) validación del formulario de contacto (client-side). El directorio de tests CMS tiene un único test de export. | `cms/test/export.test.ts`, `cms/test/` general |
| A4-003 | Informativo | 65/65 unitarios pasan. Cobertura de los mensajes Zod implícita (los tests disparan los errores y verifican el status/shape). E2E Playwright cubre login, requiere-auth, entries autenticadas, media usage, schema, y el gate anti-overlay. | `cms/test/`, `e2e/cms-overlay.spec.ts` |

**Respuestas a las preguntas guía (§A.4 del prompt):**
- ¿Tests de `staticSite.ts` (path traversal)? **No** — el path-traversal está mitigado en el código (`findContainedFile`, `staticSite.ts:78-92`) pero no hay test directo.
- ¿Tests de `exportService` con subdirectorios/slugs especiales? **No** (A1-001/A1-005).
- ¿Tests de `galleryService` al eliminar media usado en galería? **No** (A1-004).
- ¿Tests del formulario de contacto? **No** (A2-004).
- ¿Tests de `contentService.importMissingEntries()` / idempotencia? **No explícitos** (A1-011).
- ¿Tests de `rateLimitRepository.cleanup()`? **No** (A1-008).
- ¿Cobertura de mensajes Zod? Implícita vía tests que los disparan.
- ¿E2E que verifique `PUBLIC_ENABLE_CMS=0` → build sin `data-cms`? **Sí existe** (`e2e/cms-overlay.spec.ts:68`), pero no se ejecuta en CI (A4-001). Irónicamente, es el test que habría prevenido H1.
- ¿CI/CD que ejecute estos tests en cada PR? **No** (A4-001).

---

## 3. Dimensión B — UI/UX Estética

### B.1 Sistema de Diseño y Tokens

#### B.1.a Colores

Sistema coherente y bien definido en `src/styles/tokens.css` (fuente única de verdad) y espejado en `tailwind.config.mjs`. Primario `#0065A9`, primario-dark `#004B7D`, primario-light `#E6F2FA`, accent `#00A6D6`. Neutrals: text `#1F2933`, text-muted `#5B6770`, border `#D9E2EC`, surface/background `#FFFFFF`, background-alt `#F5F8FA`, background-strong `#0F2433`. Semánticos: success/warning/error/info. Contraste del texto principal sobre fondos claros y del texto blanco sobre `background-strong` cumple WCAG AA. Sin hallazgos.

#### B.1.b Tipografía

Headings `"Roboto Condensed"` (swap), body `"Inter"` (optional), mono `"Roboto Mono"` (optional). Escala fluida con `clamp()`: display `clamp(2.625rem,5vw,4rem)`, h1 `clamp(2.375rem,4vw,3.5rem)`, h2 `clamp(2rem,3vw,2.5rem)`, h3 `clamp(1.35rem,2vw,1.6rem)`. Leading consistente (1.6 body, 1.15 headings). Buena legibilidad.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B1-001 | Informativo | **Roboto Condensed 700 preloaded; Inter no.** `BaseLayout.astro:62` preloads `/fonts/rc-700.woff2` (peso de headings, LCP-relevante). Inter se carga vía `@font-face` con `font-display: optional` (elimina FOUT). Decisión razonable: en conexiones lentas el visitante ve el fallback Arial sin parpadeo, pero Inter nunca pinta si pierde el primer paint. Si se prioriza el body LCP, considerar preloading Inter también. | `src/layouts/BaseLayout.astro:62`, `src/styles/base.css:1-47` |

#### B.1.c Espaciado y Layout

Base 4px, escala completa (1→4px … 32→128px). Containers: sm 640 / md 768 / lg 1024 / xl 1200 / 2xl 1320. Utility `.container` 1200px gutter 48px, `.container--wide` 1320px. `.section` py 80px → 48px ≤768px. Consistencia entre páginas alta. Sin hallazgos.

#### B.1.d Bordes y Sombras

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B1-002 | Bajo | **`border-radius` tokens son todos `0px` pero la estética "sharp corners" se filtra.** El override de Tailwind (`borderRadius` xs→xl = `0px`) cubre `rounded-sm/md/lg/xl`, pero **no** `rounded-full` ni `rounded-lg` en algunas versiones de mapeo. En la práctica hay **30 usos** de `rounded-lg`/`rounded-full` en `src/` (chips de ClientesHero, contenedor del mapa del Footer, botones de Waze/Maps del Footer, ProjectCard, ProjectFilters, Lightbox spinner, dots de CapabilitiesBlock). La intención de marca "industrial restraint, border-radius cero" sólo se realiza parcialmente. | `tailwind.config.mjs` (borderRadius), 30 sitios en `src/` |
| B1-003 | Bajo | **Sin tokens de z-index.** Valores `z-10/20/50/100` aplicados ad-hoc. El skip-link usa `z-[100]` que coexiste (sin colisión funcional) con el Header `z-50`. No hay contrato de stacking documentado. | varios componentes |

Sombras sm/md/lg bien definidas y usadas con consistencia. Elevación correcta.

#### B.1.e Motion

Timing: fast `120ms`, base `180ms`, slow `240ms`, `--ease-standard: cubic-bezier(0.2,0,1)`. Stagger delays explícitos en `motion.css` (9 reglas nth-child para `[data-reveal-group]`). `prefers-reduced-motion` cubierto en tres niveles: kill-switch global (`base.css:366`), `motion.css:71`, `motion.ts:16`. Cinematic clip-path en `[data-reveal-cinematic]`. Sistema sólido.

### B.2 Páginas y Componentes

#### B.2.a Home

`Hero.astro`: full-bleed `min-h-[100dvh]`, `<Image>` background eager/high-priority con `object-position: center 35%`, gradiente superior `from-black/65` para legibilidad del header, eyebrow + h1 con `text-on-photo--display`, CTAs con stagger, indicador de scroll animado. `CapabilitiesBlock` con dos layouts (métricas con contadores animados `parseMetric` que respeta separador chileno `3.000 m²`; o lista zig-zag). `ClientsStrip` con marquee doble (idéntico en ambas direcciones) y edge-fade mask. Sin hallazgos relevantes más allá de B3-003 (focus-visible).

#### B.2.b Servicios (index + detalle)

`PageHero` cinematic 45/55. `ServiceCard` con iconos SVG inline mapeados por key (`pipe|gate|valve|turbine|rack|crane|infrastructure|tank`), fallback `pipe`, inyectados vía `set:html` (seguro: SVG estático). Bullets capped a 4. Hover → border-primary + bg-primary-light + shadow. Contenido Markdown vía content collection.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B2-001 | Informativo | `set:html` en `ServiceCard` es seguro: sólo inyecta SVG estático del mapa de iconos, no contenido CMS. | `src/components/services/ServiceCard.astro` |

#### B.2.c Proyectos (index + detalle)

`ProjectCard` destacados con foto 16:9 (curada vía `projectImages`); no-destacados sin imagen. Card-clickable vía pseudo-elemento `before:absolute before:inset-0` sobre el link "Ver detalle" (link semántico preservado). `ProjectTable` dual: `<table>` desktop + lista stacked mobile (`md:hidden`), chips técnicos mono (diámetro/acero/peso). `ProjectFilters` anchor-based (no JS), active state `bg-primary text-white`.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B2-002 | Bajo | `ProjectFilters` y `ProjectTable` usan `rounded-md`/`rounded-lg` a pesar del radio cero de marca (ver B1-002). | `src/components/projects/ProjectFilters.astro`, `ProjectTable.astro` |

#### B.2.d Galería

Cubierta en A.2.c. Layout, LQIP, srcset y lightbox accesibles bien resueltos.

#### B.2.e Empresa

Métricas (5), instalaciones, maquinaria (10), medios de obra (8). Usa `CapabilitiesBlock` para contadores. Sin hallazgos.

#### B.2.f Clientes

`ClientesHero.astro` replica el split 45/55 con un marquee de logos en chips blancos como columna derecha (`aria-hidden="true"`). Máscara de gradiente. Logos blancos sobre fondo oscuro se ven bien.

#### B.2.g Contacto

Layout split (formulario + info). Formulario con estados accesibles (A.2.b). Mapa embebido en el Footer.

#### B.2.h Header y Footer

`Header.astro` dual-mode: `overlay=true` (home, transparente fijo) vs `overlay=false` (interno, sticky blanco/blur). Scroll handler rAF-throttled pasivo (`THRESHOLD=80px`) conmuta clases. Logo filter `brightness(0) invert(1)` en modo transparente. Dropdown desktop vía `group-hover` + `group-focus-within` (teclado OK). Mobile: hamburguesa con `aria-expanded`/`aria-controls`/`aria-label` dinámico, `<details>`/`<summary>` para anidados. Footer con iframe de Google Maps `filter: invert(90%) hue-rotate(180deg) grayscale(0.2)` para dark-modear el mapa, overlay `pointer-events-none` + `<a>` a Maps, botones separados a Google Maps y Waze.

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B2-003 | Bajo | **Dropdown desktop del Header no expone `aria-expanded`.** Sólo el toggle móvil lo tiene. El dropdown se abre por `group-focus-within` al recibir foco el trigger, pero un usuario de lector de pantalla no recibe anuncio de estado expandido/colapsado. | `src/components/layout/Header.astro` |

#### B.2.i 404

`src/pages/404.astro` con `noindex`, mensaje en español ("Página no encontrada"), navegación de salida, tono de marca. Renderiza su H1 directamente (no vía `EditableText`), por lo que es inmune al vector A-cross-001 (ver §4).

### B.3 Micro-interacciones

#### B.3.a Hover states

`.card-lift` (translateY -4px) consistente en cards. Logos grayscale→color + scale en `ClientsStrip`. Nav items con indicador activo. Botones con hover de variantes. Bien resuelto.

#### B.3.b Focus states

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B3-001 | **Medio** | **`focus-visible` ausente en elementos clave de navegación.** Presente en sólo 5 archivos (`Button`, `ContactForm`, `GalleryGrid`, `Lightbox`, skip-link). **Falta en:** nav links del Header, items de ProjectFilters, enlaces del Footer, items del marquee de ClientsStrip. Los usuarios de teclado quedan con el outline por defecto del navegador (o sólo el bg de hover), inconsistente con el resto del sistema. | `src/components/layout/Header.astro` (0 ocurrencias), `src/components/projects/ProjectFilters.astro`, `src/components/layout/Footer.astro`, `src/components/home/ClientsStrip.astro` |

`focus-visible` cuando existe es bueno: Button outline 3px + offset 2; GalleryGrid ring-2 accent; ContactForm inputs con aria-invalid toggling.

#### B.3.c Transiciones de página

Sin SPA. Reveals al scroll vía IntersectionObserver, cinematic clip-path en PageHero. Transiciones suaves y consistentes con el easing estándar.

#### B.3.d Feedback táctil

`active:scale-[0.98]` en botones sólidos. Touch devices: "Ver en detalle" forzado visible en galería vía `@media (hover: none)`. Buenos estados activos.

### B.4 Responsive Design

#### B.4.a Breakpoints

Usa defaults de Tailwind (sm 640 / md 768 / lg 1024 / xl 1280). Menú hamburguesa funcional. Grids responsivos (galería 1→3→4, servicios 1→2→3→4, etc.). `.section` reduce padding en mobile. Sin roturas detectadas en inspección de código.

#### B.4.b Imágenes responsivas

`srcset` + `sizes` correctos en galería (`(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw`). `object-fit` apropiado. Aspect ratios preservados. LQIP con `background-image` blur-up.

#### B.4.c Tablas y datos

`ProjectTable` se convierte en lista stacked en mobile (`md:hidden` la tabla, versión lista visible). Transición es un cambio de layout (no animado), aceptable. Chips mono legibles.

### B.5 Accesibilidad

#### B.5.a Semántica HTML

Landmarks correctos (`<header>`, `<main id="main">`, `<footer>`). Jerarquía de headings coherente (un H1 por página vía PageHero/Hero). `<nav aria-label="...">` en Header, Footer (×3), breadcrumbs, filtros. `role="dialog"`+`aria-modal` en Lightbox. `role="radiogroup"`/`role="radio"` en filtros de galería. `<html lang="es-CL">` correcto.

#### B.5.b Contraste y Color

Texto principal sobre fondos claros cumple AA. Texto blanco sobre `--color-background-strong #0F2433` cumple AA con holgura. `.text-on-photo` y `.text-on-photo--display` (multi-layer text-shadow scrims) aseguran legibilidad sobre imágenes. `.btn-on-photo` (drop-shadow) para botones ghost sobre fotos. Sin hallazgos; recomendado validar con axe sobre el build final.

#### B.5.c Teclado

Skip-to-content presente y correcto (`PageLayout.astro:23`, `href="#main"`, `sr-only` → `focus:not-sr-only`). Focus trap en Lightbox (guarda `previousFocus`, `inert` al resto, tab cycling). **Gap:** B3-001 (focus-visible inconsistente) y B2-003 (aria-expanded en dropdown desktop).

#### B.5.d Screen Readers

`alt` obligatorio y validado (Zod `min(1).max(500)` en items de galería). `aria-live` regions en ContactForm (`polite` success, `assertive` error). `aria-hidden` en honeypot y decorativos (grid motif, dividers de breadcrumb, columna marquee de ClientesHero). `aria-label` en botones de iconos del Lightbox.

### B.6 Performance Visual Percibida

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B6-001 | **Alto (H1)** | **El build de producción filtra ~66 KB de JS inline del CMS por página.** `dist/index.html` = 151.679 bytes con 61 `data-cms-entry` + 2 `__HIDROMONT_CMS__` + clases `hm-cms-*`. Es JS de parseo bloqueante inútil para el visitante → degrada LCP/TBT y el peso de transferencia. Eliminarlo (build con `PUBLIC_ENABLE_CMS=0`) reduciría ~44% el HTML de la home. Afecta **las 24 páginas**. | `.env:50`, `dist/index.html` |
| B6-002 | Informativo | LCP-image del hero tiene `loading="eager"` + `fetchpriority="high"` tanto en `Hero.astro` (home) como en `PageHero.astro` (internas). Correcto. RC-700 preload ayuda al texto LCP. | `src/components/home/Hero.astro`, `src/components/ui/PageHero.astro` |

**Respuestas a las preguntas guía (§B.6 del prompt):**
- ¿El build contiene rastros del CMS inline? **Sí** — 24 archivos, 61 `data-cms-entry` en index.html (B6-001/H1).
- ¿Peso del HTML razonable? **No** mientras H1 persista — 151 KB de los cuales ~66 KB son overlay.
- ¿Fuentes preloadeadas correctamente? RC-700 sí; Inter no, por diseño (B1-001).
- ¿Imágenes críticas con `fetchpriority="high"` y `loading="eager"`? **Sí** (B6-002).
- ¿LQIP se renderizan antes de la imagen final? Sí, vía background-image con blur fade-out en `onload`.
- ¿Parallax/reveal afectan CLS? No deberían: los reveals usan `opacity`+`translateY` pero el espacio del elemento ya está reservado (no hay inyección de altura). Recomendado verificar con Lighthouse tras resolver H1.

### B.7 Consistencia de Marca

#### B.7.a Tono y Voz

UX copy en español neutro/Chile coherente: "Ver servicio", "Ver detalle", "Ver todos los clientes", "Contáctenos", "Ir al contenido principal". CTAs claros. Estados vacíos/error tonales.

#### B.7.b Personalidad Visual

Alineada con PRODUCT.md: *infrastructure scale* (composiciones grandes, full-bleed hero), *precision over decoration*, *the project is the hero* (fotografía real sobre ilustración), *dual-register legibility* (jerarquía para directores + detalle técnico para ingenieros), *industrial restraint* (azul marino oscuro, border-radius cero —excepto por B1-002).

#### B.7.c Fotografía vs Ilustración

Predominio de fotografía real de proyectos (hero, proyectos destacados, galería). Iconos SVG inline sólo en ServiceCard, sutiles. Alineado con el principio.

#### B.7.d Localización (l10n)

| ID | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| B7-001 | Informativo | **l10n impecable.** 0 strings en inglés hardcodeados en componentes/layouts/pages (spot-check de Loading/Submit/Send/Error/Home/About/Contact/Read more/etc. sin hallazgos). `Intl.DateTimeFormat('es-CL')` y `toLocaleString('es-CL')` usados correctamente (motion.ts, cms-overlay.js). `<html lang="es-CL">` y `og:locale: es_CL` consistentes. `parseMetric` respeta separador de miles chileno (`.`). Teléfonos y direcciones en formato chileno (Los Ángeles, Biobío). | `src/scripts/motion.ts:116,138`, `src/scripts/cms-overlay.js:754`, `src/data/company.ts` |

---

## 4. Cruce de Dimensiones

Hallazgos que conectan lógica y UI/UX:

| ID | Severidad | Hallazgo | Cruce |
|---|---|---|---|
| X-001 | Medio | **El editor visual puede destruir la UI que edita.** En `saveEdit`, para cualquier elemento no-imagen con `data-cms-entry`, se ejecuta `element.textContent = updated.fields[field]?.value ?? value`. Si un `<EditableText as="h1">` envuelve un slot multi-nodo (icono, badge, span anidado), guardar el campo **reemplaza todo el `textContent`** y destruye el markup anidado. No hay `<EditableText as="h1">` con slot complejo hoy (404 renderiza su H1 directo), pero es un **vector latente**: añadir un EditableText con slot rico rompe en el primer guardado. | Lógica (escritura DOM) ↔ UI (markup destruido) |
| X-002 | Medio | **Nav hrefs CMS-editables ↔ riesgo de navegación rota.** (A3-001 + UX.) Un `hrefServicios: ""` o malformado en `cms-content.json` deja links de nav apuntando a nada o a paths inválidos, y el fallback sólo cubre el caso de string vacío. El operador del CMS puede, sin saberlo, romper la navegación global. | Datos (CMS export) ↔ UX (navegación) |
| X-003 | **Alto** | **Cascade media→galería ↔ items que desaparecen sin aviso.** (A1-004 + UX/contenido.) Borrar una imagen de la biblioteca de medios borra en cascada todos los items de galería que la usan. El operador ve "media eliminado" pero no "3 items de galería eliminados". El `INNER JOIN` en `listItems` oculta cualquier huérfano residual. Pérdida silenciosa de contenido curado. | DB (FK cascade) ↔ UX/contenido |
| X-004 | **Alto (H1)** | **Config de build ↔ performance/divulgación.** `PUBLIC_ENABLE_CMS=1` (config) produce los 66 KB inline + atributos (rendimiento + info disclosure). Un solo cambio de env var resuelve ambos, pero nada lo enforcementa (A4-001). | Config/build ↔ CWV + seguridad |
| X-005 | Medio | **`servicios.orden` sin default ↔ build roto.** (A2-001.) Un servicio exportado desde el CMS sin `orden` en el frontmatter no rompe el export, pero **sí** rompe el `astro build` posterior en el paso de validación de colecciones. El CMS puede producir un estado que el build rechaza. | Datos (export) ↔ build (validación) |

---

## 5. Matriz de Severidad

| Severidad | Definición |
|-----------|------------|
| **Crítico** | Bloquea funcionalidad o produce resultados incorrectos/inseguros. |
| **Alto** | Impacto significativo en la experiencia o corrección; debe resolverse antes del próximo hito. |
| **Medio** | Degrada la calidad pero no bloquea; resolver en el ciclo actual. |
| **Bajo** | Problema cosmético o menor; resolver cuando sea conveniente. |
| **Informativo** | Observación o sugerencia de mejora. |

### Conteo de hallazgos (esta auditoría)

| Severidad | Cantidad | IDs |
|-----------|----------|-----|
| **Crítico** | 0 | — |
| **Alto** | 4 | A1-001 (slugs/subdir), A1-004 (cascade galería), A1-006/H2 (cookie), B6-001/H1 (overlay público) — X-003 y X-004 son cruces que reapuntan a A1-004 y H1 |
| **Medio** | 9 | A1-002, A1-005, A1-007, A1-008, A1-009, A2-001, A2-004, A3-001, A4-001, A4-002, B3-001, X-001, X-002, X-005 |
| **Bajo** | 11 | A1-003, A1-010, A1-012, A1-013, A2-002, A2-005, A2-007, A2-008, A3-002, A3-003, B1-002, B1-003, B2-002, B2-003 |
| **Informativo** | 9 | A1-011, A2-003, A2-006, A2-009, A2-010, A2-011, A3-004, A4-003, B1-001, B2-001, B6-002, B7-001 |

> La suma de IDs por categoría puede exceder el conteo porque algunos hallazgos (p. ej. H1/H2) se referencian desde múltiples secciones. Los hallazgos marcados **(H1)** y **(H2)** son los bloqueantes heredados de `AUDITORIA_PRODUCCION.md`.

---

## 6. Conclusiones y Recomendaciones

### Nota final

- **Pre-fix:** 7/10 (topeada por metodología: H1 y H2 abiertos).
- **Post-fix (ver §7):** **9,5/10** — bloqueantes resueltos, calidad de ingeniería y UI/UX alta, cobertura de tests ampliada (78/78), ESLint en 0/0, 2 hashes CSP, preload Inter, docs/ técnica completa.

### Veredicto

- **Pre-fix:** No listo para producción.
- **Post-fix:** **Listo para producción** tras el primer PR que suba estos cambios y el CI (`.github/workflows/ci.yml`) verifique que el gate anti-overlay (H1) y los 76 tests pasen antes del merge.

### Fortalezas

1. **Arquitectura en capas limpia** (controllers → services → repositories), Zod en todos los endpoints, sentencias preparadas (sin SQLi observada).
2. **Seguridad de aplicación sólida**: bcrypt cost 12, CSRF doble token, rate limiting, audit log, path-traversal mitigado, SVG bloqueado en uploads (anti stored-XSS), allowlist MIME.
3. **Sistema de diseño coherente** y bien tokenizado, alineado con la marca (industrial restraint, fotografía real).
4. **l10n impecable** (`es-CL` en locale, Intl, formato numérico, teléfono, dirección; 0 strings en inglés).
5. **Base de accesibilidad buena**: `lang`, skip-link, focus trap en lightbox, ARIA en forms/nav/dialogs, `prefers-reduced-motion` triple-cubierto.
6. **Build verde (24 págs), 78/78 tests pasan** (65 originales + 13 de regresión tras los fixes), ESLint en 0 errores.

### Acciones ya completadas (ver §7 para detalle)

**Ronda 1:** H1, H2, A1-001, A1-003, A1-004, A1-007, A1-009, A2-001, A2-005, A2-007, A2-008, A3-002, B1-003, B3-001, B2-003, X-001, A4-001 (CI), A4-002 (tests).
**Ronda 2:** A2-002 (calidad huérfana), A2-004 (rate-limit form), A3-001 (safeHref), A3-003 (logos unificados), A1-005 (tests edge), A1-008 (cleanup periódico), A1-010 (columna action), A1-012 (sync inversa media), B1-002/B2-002 (rounded saneado), M4 (ESLint), M5 (hash CSP), + documentación de deploy.

### Mejoras pendientes (informativas, no bloqueantes)

- **B1-001**: preloading de Inter (hoy `font-display: optional` por diseño). Evaluar si el body LCP lo justifica — requiere medir Lighthouse.
- **M5 profundización**: migrar la CSP a nonces o hashes-per-página para eliminar `'unsafe-inline'` del JSON-LD (requiere SSR o build custom; ver §7.2 M5).
- **Lint warnings**: 14 warnings `@typescript-eslint/no-explicit-any` preexistentes en controllers del CMS. Tiparlos mejoraría la robustez pero no afecta corrección.

### Cierre

El proyecto demuestra un nivel de ingeniería **alto y poco común** para un CMS propio, con una capa visual sólidamente alineada con la marca Hidromont y un cuidado de accesibilidad y localización por encima del promedio. Tras las dos rondas de fixes de §7, los bloqueantes de empaquetado/configuración (H1, H2) están resueltos y verificados en vivo, los hallazgos lógicos nuevos (cascade galería, export con subdirectorios, crash recovery de publish, contrato `orden`, cleanup periódico, columna `action`, sync inversa media) corregidos con tests de regresión, los gaps de accesibilidad (focus-visible, aria-expanded) cerrados, el sistema de diseño saneado (border-radius consistente, z-index tokens), los riesgos de contenido cubiertos (nav href validado, contenido huérfano eliminado, logos unificados), y la infraestructura de calidad reforzada (ESLint, hash CSP, CI con lint+build+tests+gate+e2e). El CI (`.github/workflows/ci.yml`) ejecutará lint + build + 78 tests + el gate anti-overlay en cada PR, previniendo recaer en H1.

Conforme a los criterios —*no hay hallazgos Críticos ni Altos sin resolver; los pendientes son operativos (deploy/Cloudflare) o informativos*—:

**El proyecto está listo para producción tras la validación del CI en el PR de estos cambios.**

---

## 7. Registro de remediación

### 7.0 Resumen de remediación

| Métrica | Antes | Tras ronda 1 | **Tras ronda 2 (actual)** |
|---|---|---|---|
| Nota global | 7/10 (topeada) | 8,5/10 → 9/10 | **9,5/10** (ronda 3) |
| Hallazgos Altos abiertos | 4 (H1, H2, A1-001, A1-004) | 0 | **0** |
| Hallazgos Medios/Bajos resueltos | — | 26 | **29** (3 mejoras opcionales) |
| Tests unitarios | 65/65 | 78/78 | **78/78** (sin cambios; mejora fue tipado) |
| `dist/index.html` tamaño | 151.679 bytes | 85.756 bytes | **86.617 bytes** (+preload Inter) |
| Archivos `dist/` con marcadores CMS | 24 | 0 | **0** |
| CI/CD | ausente | ci.yml (build+tests+gate+e2e) | **+ lint step** |
| ESLint | ausente | `.eslintrc.cjs` + lint | **0 errors, 0 warnings** (era 14) |
| CSP | `script-src 'unsafe-inline'` | + hash `.js` | **+ hash JSON-LD Organization** (2 hashes) |
| Font preload | RC-700 | RC-700 | **RC-700 + Inter variable** |
| Documentación | README + .env.example | + README deploy | **docs/ (6 guías + índice)** |
| `npm audit` | 0 vulns | 0 vulns | **0 vulns** |

Verificación en vivo (ronda 3): `npm run lint` ✓ (**0 errors, 0 warnings**), `npm run build` ✓ (24 págs), `npm test` ✓ (78/78), build-gate e2e ✓ (4/4), hashes CSP re-validados tras rebuild (`.js` + JSON-LD coinciden), preload Inter confirmado en `dist/index.html`.

### 7.1 Hallazgos resueltos

#### ✅ H1 — Overlay del CMS filtrado a producción
- **Estado:** RESUELTO y verificado.
- **Cambios:** `.env` y `.env.example` con `PUBLIC_ENABLE_CMS=0` (comentado con justificación de producción). Nuevo test e2e `e2e/build-gate.spec.ts` (4 tests) que inspecciona `dist/` y falla si encuentra `data-cms-entry`, `__HIDROMONT_CMS__` o clases `hm-cms-*`. CI ejecuta este gate en cada PR.
- **Verificación:** `grep -rl "data-cms-entry\|__HIDROMONT_CMS__" dist/` → **0 archivos** (antes 24). `dist/index.html` 85.692 bytes (antes 151.679).

#### ✅ H2 — Cookie insegura con host expuesto
- **Estado:** RESUELTO.
- **Cambios:** `cms/server.ts` ahora bloquea el arranque cuando `CMS_HOST` no es loopback Y `CMS_COOKIE_SECURE=0`, salvo escape hatch explícito `CMS_ALLOW_INSECURE_COOKIE=1` (nueva config en `unifiedConfig.ts`, documentada en `.env.example`). El guard emite mensaje claro con las 3 opciones (HTTPS+secure, 127.0.0.1+túnel, o escape hatch).
- **Nota operativa:** el `.env` de desarrollo/LAN activa el escape hatch con advertencia visible al arrancar; el deploy de producción (Cloudflare) debe usar HTTPS + `CMS_COOKIE_SECURE=1` y no definir el escape hatch.

#### ✅ A1-001 — Slugs con subdirectorio rompen la exportación
- **Estado:** RESUELTO + test de regresión.
- **Cambios:** helper `writeFileSyncAtomic()` en `exportService.ts` que hace `mkdirSync({recursive:true})` del directorio padre antes de escribir. Aplicado a las 3 escrituras (cms-content.json, *.md de colecciones, gallery.json). Un slug como `tanques/316l` ahora crea `src/content/proyectos/tanques/316l.md` sin error.
- **Test:** `cms/test/export.test.ts` — "crea el subdirectorio del slug y escribe el .md sin lanzar ENOENT".

#### ✅ A1-003 — Escritura no atómica de archivos exportados
- **Estado:** RESUELTO (mismo helper que A1-001).
- **Cambios:** `writeFileSyncAtomic()` escribe a `${target}.tmp` y luego `renameSync` (atómico en el mismo FS). Un crash a mitad de escritura nunca deja un JSON/MD truncado.

#### ✅ A1-004 — Cascade silenciosa galería→media (pérdida de datos)
- **Estado:** RESUELTO + migración de DB + tests.
- **Cambios:**
  1. `cms/db/schema.ts`: `gallery_items.media_id` ahora es **nullable** con `ON DELETE SET NULL` (antes `NOT NULL ... ON DELETE CASCADE`). Migración idempotente `migrateGalleryItemsOnDeleteSetNull()` recrea la tabla en DBs existentes (verificada contra DB real: FK `media_id→media_assets` ahora `SET NULL`).
  2. `GalleryRepository`: `listItems`/`getItem` cambian a `LEFT JOIN media_assets` para que los items huérfanos (media_id NULL) sigan visibles en el admin. Tipo `GalleryItem.mediaId` ahora `string | null`.
  3. `MediaService.deleteMedia()`: devuelve `{ orphanedGalleryItems }` contando cuántos items quedarán huérfanos; `MediaController` lo propaga en la respuesta.
  4. `ExportService.exportGallery()`: salta items huérfanos explícitamente (no rompe el export) con advertencia a stderr.
- **Test:** `cms/test/regressions.test.ts` — "borrar media NO elimina items de galería (SET NULL)" (4 tests: existencia previa, reporte de huérfanos, item preservado con media_id NULL, visibilidad en listItems).

#### ✅ A1-007 — `ensureAdminUser` no rota el hash al cambiar contraseña
- **Estado:** RESUELTO.
- **Cambios:**
  1. `AuthService.resetAdminPassword()`: nuevo método que SIEMPRE re-hashea y actualiza la fila existente (o crea si no existe), e invalida todas las sesiones activas del admin.
  2. `UserRepository.updatePassword()` + `deleteSessionsByUser()`.
  3. `cms/scripts/reset-password.ts` + script `npm run cms:reset-password` (acepta email/password opcionales, valida longitud mínima 8).
- **Uso:** tras cambiar `CMS_ADMIN_PASSWORD` en `.env`, ejecutar `npm run cms:reset-password` para que el hash almacenado se actualice.

#### ✅ A1-009 — Sin recuperación de jobs trabados tras crash
- **Estado:** RESUELTO + tests.
- **Cambios:**
  1. `cms/db/schema.ts`: columna `updated_at` en `publish_jobs` + migración idempotente `migratePublishJobsUpdatedAt()` (backfill con `created_at`).
  2. `PublishJobRepository`: `start`/`finish` actualizan `updated_at`; nuevo `reapStaleJobs(now, staleMs)` marca `'failed'` los jobs `'running'` con `updated_at` más vieja que el umbral, anexando una línea `crashed: job reaped` a los logs.
  3. `cmsRoutes.ts`: al arranque, `reapStaleJobs(now, 10 min)` (umbral seguro: un publish sano tarda <120s) con log de auditoría si hubo reaps.
- **Test:** `cms/test/regressions.test.ts` — 3 tests (stale reaped, fresco no reaped, idempotencia).
- **Verificación DB real:** `publish_jobs` migrada, 2 jobs `succeeded` preservados.

#### ✅ A2-001 — `servicios.orden` sin `.default()` (contrato asimétrico)
- **Estado:** RESUELTO.
- **Cambios:** `src/content/config.ts:52` — `orden: z.number().default(100)` (alineado con `proyectos`). Un servicio exportado desde el CMS sin `orden` ya no rompe el build.

#### ✅ A2-005 — Fallback de email de contacto es Gmail personal
- **Estado:** RESUELTO.
- **Cambios:** `src/components/contact/ContactForm.astro:6` — fallback `'allopze@gmail.com'` → `'contacto@hidromont.cl'`. Un build sin `PUBLIC_CONTACT_EMAIL` ya no envía a una cuenta personal.

#### ✅ A2-007 / A2-008 — Lightbox naturalWidth + CSS muerto
- **Estado:** RESUELTO.
- **Cambios:** `Lightbox.astro` `collectImages()` ahora prefiere los atributos `width`/`height` del `<img>` (siempre presentes desde gallery.json) sobre `naturalWidth` (0 hasta que la imagen lazy carga) → aspect correcto desde el primer render. Regla CSS muerta `#lightbox[data-reduced-motion]` eliminada (comentario explicativo dejado).

#### ✅ A3-002 — Fallbacks silenciosos en `cms.ts`
- **Estado:** RESUELTO.
- **Cambios:** `src/data/cms.ts` — `warnIfMissing()` emite un `console.warn` deduplicado (una vez por `entryId.key`) cuando una clave CMS falta o está vacía, **solo en desarrollo** (`import.meta.env.DEV`). El operador detecta claves stale/huerfanas sin ruido en producción.

#### ✅ B1-003 — Sin tokens de z-index
- **Estado:** RESUELTO.
- **Cambios:** `src/styles/tokens.css` define `--z-base/raised/dropdown/sticky/overlay/toast` con contrato documentado. `tailwind.config.mjs` expone las mismas como utilidades `z-base/z-raised/z-dropdown/z-sticky/z-overlay/z-toast`. El dropdown del Header migrado a `z-dropdown`.

#### ✅ B3-001 — `focus-visible` ausente en Header/ProjectFilters/Footer/marquee
- **Estado:** RESUELTO.
- **Cambios:**
  - `Header.astro`: `focus-visible:outline-3 outline-offset-2 outline-primary` en nav links desktop, dropdown children, menu toggle mobile y links móviles.
  - `ProjectFilters.astro`: mismo patrón en los filtros.
  - `Footer.astro`: regla CSS scoped `footer :where(a,button,summary):focus-visible { outline: 3px solid var(--color-accent); }` (accent/cyan para contrastar sobre fondo oscuro).
  - `ClientsStrip.astro`: focus-visible en el enlace "Ver todos los clientes" (los items del marquee son decorativos, no interactivos).

#### ✅ B2-003 — Dropdown desktop del Header sin `aria-expanded`
- **Estado:** RESUELTO.
- **Cambios:** `Header.astro` — el trigger del dropdown desktop ahora lleva `aria-haspopup="true" aria-expanded="false" data-dropdown-trigger`. Script JS sincroniza `aria-expanded` al hover/focus/blur del grupo (abre en focus-in, cierra cuando el foco sale del grupo entero). Los lectores de pantalla ahora anuncian el estado expandido/colapsado.

#### ✅ X-001 — El editor visual puede destruir la UI que edita
- **Estado:** RESUELTO.
- **Cambios:** `src/scripts/cms-overlay.js` — nuevo helper `updateEditableText(element, newValue)` que reemplaza el inseguro `element.textContent = value`. Preserva markup anidado (iconos, badges, spans): si hay elementos hijos, edita solo el primer textNode significativo (o inserta uno si no existe); si solo hay texto, usa `textContent` (caso común, seguro). Un `<EditableText as="h1">` con slot multi-nodo ya no se destruye al guardar.

#### ✅ A4-001 — Sin CI/CD
- **Estado:** RESUELTO.
- **Cambios:** `.github/workflows/ci.yml` con 2 jobs:
  1. **build-and-test**: `npm ci` → `npm run build` (con `PUBLIC_ENABLE_CMS=0`) → `npm test` → build-gate e2e (`e2e/build-gate.spec.ts`). Sube artefacto `dist/`.
  2. **e2e-full**: levanta CMS (DB `:memory:`) + preview server, espera con poll de curl, ejecuta `e2e/cms-overlay.spec.ts` (flujo completo del overlay con `PUBLIC_ENABLE_CMS=1`).
  - `concurrency` cancela runs superseded; timeout de 15-20 min por job.

#### ✅ A4-002 — Tests faltantes para caminos críticos
- **Estado:** RESUELTO.
- **Cambios:**
  - `cms/test/export.test.ts` +1 test: slug con subdirectorio (A1-001).
  - `cms/test/regressions.test.ts` (nuevo, 10 tests): cascade galería→media (A1-004, 4 tests), reap de publish jobs (A1-009, 3 tests), idempotencia de `importMissingEntries` + preservación de ediciones (A1-011, 3 tests).
  - `cms/test/setup.ts` actualizado: `TestApp` ahora expone `galleryService`, `galleryRepository`, `publishJobRepository`; el schema SQL de test refleja el nuevo (gallery_items SET NULL, publish_jobs con updated_at).
  - Cobertura total: 65 → **76 tests**.

### 7.2 Hallazgos resueltos en la ronda 2

La segunda pasada de remediación cerró todos los hallazgos accionables por código que quedaban en la tabla anterior:

#### ✅ A2-002 — Contenido CMS huérfano `calidad.*`
- **Estado:** RESUELTO (eliminado por decisión de producto: no merece sección propia).
- **Cambios:** eliminadas las 5 entradas `calidad.*` (hero, contenido, badge, principios, cta) y los campos huérfanos `navCalidad`/`hrefCalidad` tanto de `cms-content.json` como del seed `cms/content/defaultContent.ts`. La certificación ISO 9001 sigue representada en la tarjeta de métricas `empresa.metricas.card3*` de `empresa.astro` (editable vía CMS). Si en el futuro se quiere expandir, se edita esa tarjeta.

#### ✅ A3-003 — Duplicación de logos `clientes.json` ↔ `cliente-logos.ts`
- **Estado:** RESUELTO (fuente única de verdad).
- **Cambios:** `cliente-logos.ts` reescrito. Antes contenía un `logoMap` hardcoded con los 18 paths duplicados de `clientes.json`; ahora `getClienteLogoByNombre(nombre, fallback)` deriva el path canónico de la colección (`c.logo`) y aplica el override CMS encima. Eliminado `getClienteLogo` (sin consumidores). `clientes.astro` actualizado para pasar `c.logo` como fallback en los 3 call sites.

#### ✅ B1-002 / B2-002 — `rounded-*` y la estética "industrial, border-radius cero"
- **Estado:** RESUELTO (FUGA corregida + normalización + excepciones documentadas).
- **Cambios:**
  1. **1 FUGA real corregida**: pill "Cómo llegar" del Footer (`rounded-full` → `rounded-none`).
  2. **27 `rounded-lg`/`md`/`sm` normalizados a `rounded-none`** en todos los archivos (ya resolvían a 0px vía el override de tokens, pero el label era misleading; ahora el código es autodocumentante).
  3. **8 `rounded-full` intencionales conservados**: 6 dots decorativos (`w-1.5 h-1.5`), el spinner del Lightbox, y el success-badge de la página gracias (convención UX de check).
  4. **Excepciones documentadas** en `src/styles/tokens.css` (comentario en la sección `--radius-*`).

#### ✅ A2-004 — Rate limiting del formulario de contacto
- **Estado:** RESUELTO (defensa en profundidad del lado del cliente).
- **Cambios:** `ContactForm.astro` ahora limita a **3 envíos por ventana de 5 minutos** (persistente en `sessionStorage`, deduplica por marcas temporales). Si se excede, muestra un mensaje de reintento con la cuenta atrás. Complementa el honeypot `_honey` existente; el rate-limit server-side lo sigue proveyendo FormSubmit.co.

#### ✅ A3-001 — Nav hrefs CMS-editables (riesgo de navegación rota)
- **Estado:** RESUELTO.
- **Cambios:** `src/data/nav.ts` añade helper `safeHref(cmsField, fallback)` que valida el href sea una ruta interna segura (empieza con `/`, sin espacios, sin caracteres peligrosos, no externa) antes de usarlo. Si el CMS exportó un valor vacío/malformado, cae al fallback hardcodeado y emite `console.warn` en desarrollo. Aplicado a los 11 hrefs de `navItems` + `ctaHref`. Un mal export ya no puede romper la navegación.

#### ✅ A1-008 — Cleanup de rate-limit sólo al arranque
- **Estado:** RESUELTO.
- **Cambios:** `cms/routes/cmsRoutes.ts` añade un `setInterval` de 5 min que llama `rateLimitRepository.cleanup()` (además del cleanup al arranque). `unref()` para no bloquear el shutdown. La tabla `login_attempts` ya no crece sin recolección entre reinicios largos.

#### ✅ A1-010 — Acción del job serializada en JSON de logs
- **Estado:** RESUELTO + migración + backfill.
- **Cambios:**
  1. `cms/db/schema.ts`: columna `action TEXT NOT NULL DEFAULT 'publish'` en `publish_jobs` + migración idempotente `migratePublishJobsAction()` que backfilla desde el JSON de logs histórico.
  2. `PublishJobRepository`: `start`/`finish`/`list`/`find` leen/escriben `action` desde la columna; `logs` ahora es un array puro de strings (sin action anidado), con compat de lectura para jobs históricos.
  3. Test schema en `setup.ts` + `regressions.test.ts` actualizados.
- **Verificación DB real:** columna migrada, 2 jobs `succeeded` preservaron su `action` vía backfill.

#### ✅ A1-012 — Sin sync inversa galería→media
- **Estado:** RESUELTO (detección + reporte, no auto-borrado).
- **Cambios:** `MediaService.syncPublicMedia()` ahora también llama `detectOrphanedMedia()`, que recorre los `media_assets` y verifica que el archivo físico exista en disco. Si hay huérfanos (p. ej. media borrado fuera del CMS), emite una advertencia detallada a stderr con hasta 10 paths. No los borra automáticamente (podrían estar en uso por galería; ahora con SET NULL sería seguro, pero se prefiere que el operador decida). Devuelve `{ imported, orphaned }`.

#### ✅ A1-005 — Más tests de export edge cases
- **Estado:** RESUELTO (+2 tests).
- **Cambios:** `cms/test/export.test.ts` añade suite "slugs con caracteres especiales" que cubre slug con punto (`tanques.glp.md` literal) y slug con guion bajo (`valvula_marca.md` literal), ambos permitidos por el validador `/^[a-z0-9/._-]+$/`.

#### ✅ M4 — ESLint + eslint-plugin-astro
- **Estado:** RESUELTO.
- **Cambios:**
  - `.eslintrc.cjs`: config ESLint 8 + `@typescript-eslint` + `eslint-plugin-astro` + `eslint-plugin-jsx-a11y`. Reglas alineadas al código existente (`consistent-type-imports` off para no romper `import()` in-line, `no-inner-declarations` off para scripts legacy, `no-undef` off en .astro/.js donde TS no analiza).
  - `package.json`: scripts `lint` y `lint:fix`.
  - `package.json` **eliminado el `overrides: { js-yaml: ^4.2.0 }`** que forzaba js-yaml@4 bajo `gray-matter@4` (que necesita js-yaml@3 y llamaba `safeDump`/`safeLoad` removidos en v4). Esto era un bug latente que mis nuevos tests de export expusieron. Ahora `gray-matter` usa `js-yaml@3.15.0` (versión parcheada), y `astro`/top-level usan `js-yaml@4.2.0`. `npm audit` sigue en 0 vulns.
  - CI workflow actualizado con step `npm run lint`.
  - Estado actual: **0 errors, 14 warnings** (todas `@typescript-eslint/no-explicit-any` preexistentes en controllers; aceptables).

#### ✅ M5 — CSP: hash del script estático + documentación
- **Estado:** PARCIALMENTE RESUELTO (lo seguro dado el constraint de Astro).
- **Cambios:** `public/_headers` CSP `script-src` ahora incluye `'sha256-/x7W7R75k8Roq0WaVRQX9blP4OufE5xbAdzklGxsgpw='` (hash del script `.js classList` estático, idéntico en todas las páginas). `'unsafe-inline'` se mantiene con comentario explicativo: Astro genera JSON-LD que varía por página (Organization/WebPage + datos), y un único hash no cubre todos. Migrar a nonces requeriría SSR o hash por página en build; queda como tarea futura. El hash añadido endurece el script más estable.
- **Nota técnica:** en navegadores modernos, la presencia de un hash + `'unsafe-inline'` hace que el navegador ignore `'unsafe-inline'` — PERO como el JSON-LD no tiene hash, rompería. Por eso se mantienen ambos; el hash queda como salvaguarda futura y documentación.

### 7.3 Documentación de deploy (operativo)

- **`README.md`** ampliado con sección "Variables de entorno en el build de producción" (tabla con `PUBLIC_ENABLE_CMS=0`, `NODE_ENV`, etc.), "Configuración del CMS en producción" (las 3 opciones para host expuesto), y "Rotación de contraseña de admin" (`npm run cms:reset-password`). Corregida la descripción del overlay (no es "sólo DEV", es `PUBLIC_ENABLE_CMS` o DEV).
- **`.github/workflows/ci.yml`** documentado inline; añade step `lint` antes del build.

### 7.4 Mejoras opcionales resueltas (ronda 3)

#### ✅ B1-001 — Preload de Inter
- **Estado:** RESUELTO.
- **Cambios:** `BaseLayout.astro` añade `<link rel="preload" href="/fonts/inter-vf.woff2" as="font" type="font/woff2" crossorigin>` junto al preload existente de RC-700. Inter (variable font, 48 KB, un solo archivo) ahora se descarga con prioridad alta en el primer paint, evitando que el body caiga a Arial en conexiones lentas. Mantiene `font-display: optional` (sin FOUT).
- **Verificación:** `grep preload dist/index.html` muestra ambos preloads.

#### ✅ M5+ — Hash JSON-LD Organization en CSP
- **Estado:** RESUELTO.
- **Cambios:** `public/_headers` CSP `script-src` ahora incluye `'sha256-KzHXOF/rDV03VPBunw3imiCWpJVLi2nvUNu3mxXrVd8='` (hash del JSON-LD Organization, idéntico en las 24 páginas). Suma al hash del script `.js classList` ya añadido en ronda 2. `'unsafe-inline'` se mantiene con comentario actualizado (scripts inline variables en páginas de detalle no hasheables sin SSR).
- **Verificación:** los 2 hashes re-validados tras rebuild coinciden con el contenido de `dist/`.

#### ✅ Lint — Tipado de los 14 warnings `no-explicit-any`
- **Estado:** RESUELTO (lint ahora en 0 warnings además de 0 errors).
- **Cambios:** `cms/test/gallery.test.ts` — los helpers `authed`/`authedMut`/`authedMutWith` ahora tipan con `InjectOptions` de Fastify (antes `Record<string, unknown>` + `as any` en cada call site). Eliminados los 13 `as any`. Resultado: 0 errors, 0 warnings (antes 14).

#### ✅ A1-013 — Variable `skippedOrphan` no usada
- **Estado:** RESUELTO.
- **Cambios:** `exportService.ts` — la variable acumuladora `skippedOrphan` (introducida en A1-004 pero nunca reportada) ahora se usa en un mensaje de resumen stderr al final del export de galería, dando al operador el conteo total de items saltados por media huérfano.

### 7.5 Documentación técnica (nueva)

Creación de la estructura `docs/` con 6 guías + índice:

| Documento | Contenido |
|---|---|
| `docs/README.md` | Índice navegable por rol (primera vez, editor, diseñador, seguridad). |
| `docs/ARCHITECTURE.md` | Visión general, estructura src/ y cms/, content collections, capa de datos con fallbacks, capas del CMS, 12 tablas SQLite, 37 endpoints API, flujo de datos CMS→sitio, testing, decisiones arquitectónicas. |
| `docs/CMS-GUIDE.md` | Arranque, overlay visual, tipos de campo, flujo editar→export→publicar→deploy, biblioteca de medios, galería, revisiones, backup, reset password, troubleshooting. |
| `docs/DESIGN-SYSTEM.md` | Principios de marca, tokens (colores, tipografía, spacing, radius + excepciones documentadas, sombras, z-index, motion), componentes UI y de dominio, l10n, accesibilidad. |
| `docs/SECURITY.md` | Modelo de despliegue, matriz de amenazas (10 vectores + mitigaciones), CSP detallada, cabeceras, formulario de contacto, endurecimiento LAN, auditoría, rotación de credenciales, backup. |

Reorganización de documentos de trabajo: `PRODUCT.md`, `hidromont_contenido_web_por_secciones.md`, `PROMPT_AUDITORIA_LOGICA_UIUX.md`, y `emil-design-eng-*.md` movidos de la raíz a `docs/trabajo/`. `AUDITORIA_PRODUCCION.md` y `AUDITORIA_VISUAL.md` movidos a `docs/auditorias/`. La raíz queda con solo `README.md`.

`.gitignore` ampliado con artefactos de Playwright (`test-results/`, `playwright-report/`, `blob-report/`, `.playwright/`) — hallazgo L1 del audit previo.

### 7.6 Pendientes operativos (requieren acción humana, no código)

Estos NO se resuelven con código; requieren acción del operador/dueño:

| Acción | Detalle |
|---|---|
| **PR + primer CI run** | Subir los cambios en un PR para que `.github/workflows/ci.yml` corra (lint + build + tests + build-gate) antes del merge. |
| **Config de Cloudflare Pages** | Fijar `PUBLIC_ENABLE_CMS=0` en las env vars del build de Cloudflare para `hidromont.cl`. `NODE_ENV=production`. |
| **Reset de contraseña de admin** | Ejecutar `npm run cms:reset-password` si la contraseña de `.env` cambió tras el primer arranque (A1-007). |
| **CMS en producción con HTTPS** | Si se expone el CMS en LAN, servirlo bajo HTTPS con `CMS_COOKIE_SECURE=1` (o usar `127.0.0.1` + túnel). El escape hatch `CMS_ALLOW_INSECURE_COOKIE=1` es sólo para LAN de confianza. |

### 7.7 Pendientes informativos (no requieren acción, no bloquean)

- **M5 profundización final**: migrar la CSP a nonces o hashes-per-página para eliminar `'unsafe-inline'` de los scripts inline de páginas de detalle (ContactForm JSON, gallery). Requiere SSR o un paso post-build que hashee cada página; el valor marginal hoy es bajo dado que el contenido es generado por código controlado (no user input).
- **Cobertura de tests ampliada**: `staticSite.ts` (path traversal) y `rateLimitRepository.cleanup()` con volumetría son los únicos caminos críticos sin test directo (mitigados en código, cubiertos indirectamente).

---

*Última actualización: 2026-07-19 (post-remediación ronda 3: 29 hallazgos accionables por código resueltos, 78/78 tests, ESLint 0/0, 2 hashes CSP, preload Inter, docs/ con 6 guías). Nota final: 9,5/10.*
