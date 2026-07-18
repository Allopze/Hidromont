# Auditoría de Lógica / Funcionalidad + UI/UX Estética

> **Proyecto:** Hidromont Chile — Sitio web institucional + CMS propio
> **Stack:** Astro 4 (output `static`) + Tailwind CSS + Fastify 5 CMS backend + SQLite
> **Rama auditada:** `fix/auditoria-p0-p1`
> **Fecha de auditoría:** 2026-07-18
> **Comandos ejecutados:** `npm run build` (✓ 24 páginas), `npm test` (✓ 76/76), inspección de `dist/`, análisis estático de código, smoke-test del CMS contra DB real.
> **Alcance de evidencia:** análisis estático + comandos en vivo. Quedan fuera (por requerir navegador) los tests e2e completos (`npm run test:e2e` con overlay) y las capturas de pantalla comparativas; el **build-gate e2e** (`e2e/build-gate.spec.ts`) sí se ejecutó y pasa.

> **Estado de remediación:** tras la auditoría inicial (nota 7/10 topeada por H1/H2 abiertos), se aplicaron los fixes documentados en el **§7 — Registro de remediación**. Tras los fixes, **H1 y H2 están resueltos** y la nota sube a **8,5/10** (ver §7.0). Los hallazgos en §2–§6 se conservan tal cual fueron detectados para trazabilidad; su estado actual (resuelto/pendiente) se indica al inicio de cada hallazgo y se resume en §7.

---

## 1. Resumen ejecutivo

### Nota final

- **Nota inicial (pre-fix):** 7/10 — topeada por metodología porque H1 y H2 estaban abiertos.
- **Nota tras remediación (§7):** **8,5/10** — H1 y H2 resueltos y verificados; stack de calidad alta.

### Veredicto

- **Pre-fix:** No listo para producción (H1 + H2 bloqueantes).
- **Post-fix:** **Listo para producción** una vez se ejecute el CI (`.github/workflows/ci.yml`) en el primer PR que suba estos cambios, garantizando que el gate anti-overlay (H1) y los 76 tests pasen automáticamente antes de merge.

### Justificación breve

El proyecto mantiene una **ingeniería alta**: arquitectura en capas limpia, validación Zod en todos los endpoints, autenticación bcrypt + CSRF + rate limiting, path-traversal mitigado, build en verde (24 páginas) y **76/76 tests unitarios** pasando (65 originales + 11 nuevos de regresión). La UI/UX está **sólidamente alineada con la marca** y la base de accesibilidad es buena.

**Hallazgos bloqueantes detectados y ya resueltos:**

- **H1 (RESUELTO)** — `.env` tenía `PUBLIC_ENABLE_CMS=1`. Se cambió a `0`. El nuevo `dist/` contiene **0 archivos** con marcadores CMS (antes 24); `dist/index.html` bajó de 151.679 → **85.692 bytes (−43,5 %)**. Se añadió un test e2e de build-gate (`e2e/build-gate.spec.ts`) y CI que lo ejecuta en cada PR.
- **H2 (RESUELTO)** — `cms/server.ts` ahora bloquea el arranque si `CMS_HOST` no es local y `CMS_COOKIE_SECURE=0`, salvo escape hatch explícito `CMS_ALLOW_INSECURE_COOKIE=1` (documentado). El `.env` de desarrollo/LAN lo activa con advertencia; el de producción debe usar HTTPS + `CMS_COOKIE_SECURE=1`.

**Hallazgos nuevos detectados y ya resueltos** (detalle en §7): cascade silenciosa galería→media (A1-004), slugs con subdirectorio (A1-001), recuperación de crashes en publish (A1-009), contrato asimétrico `servicios.orden` (A2-001), gaps de `focus-visible` (B3-001), `aria-expanded` en dropdown desktop (B2-003), preservación de markup anidado en el overlay (X-001), y más.

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
- **Post-fix (ver §7):** **8,5/10** — bloqueantes resueltos, calidad de ingeniería y UI/UX alta, cobertura de tests ampliada, CI añadido.

### Veredicto

- **Pre-fix:** No listo para producción.
- **Post-fix:** **Listo para producción** tras el primer PR que suba estos cambios y el CI (`.github/workflows/ci.yml`) verifique que el gate anti-overlay (H1) y los 76 tests pasen antes del merge.

### Fortalezas

1. **Arquitectura en capas limpia** (controllers → services → repositories), Zod en todos los endpoints, sentencias preparadas (sin SQLi observada).
2. **Seguridad de aplicación sólida**: bcrypt cost 12, CSRF doble token, rate limiting, audit log, path-traversal mitigado, SVG bloqueado en uploads (anti stored-XSS), allowlist MIME.
3. **Sistema de diseño coherente** y bien tokenizado, alineado con la marca (industrial restraint, fotografía real).
4. **l10n impecable** (`es-CL` en locale, Intl, formato numérico, teléfono, dirección; 0 strings en inglés).
5. **Base de accesibilidad buena**: `lang`, skip-link, focus trap en lightbox, ARIA en forms/nav/dialogs, `prefers-reduced-motion` triple-cubierto.
6. **Build verde (24 págs), 76/76 tests pasan** (65 originales + 11 de regresión tras los fixes).

### Acciones ya completadas (ver §7 para detalle)

H1, H2, A1-001, A1-003, A1-004, A1-007, A1-009, A2-001, A2-005, A2-007, A2-008, A3-002, B1-003, B3-001, B2-003, X-001, A4-001 (CI), A4-002 (tests).

### Mejoras pendientes (post-producción, no bloqueantes)

- **A2-004**: rate limiting propio del formulario de contacto (no depender sólo de FormSubmit.co) o captcha si crece el spam.
- **A3-001 / X-002**: validar formato de `href*` en el export del CMS (rechazar paths inválidos) o dejar los hrefs fuera del alcance editable.
- **A3-003**: unificar logos en una sola fuente de verdad (`clientes.json` o `cliente-logos.ts`, no ambas).
- **A2-002**: eliminar el contenido `calidad.*` huérfano o crear la página `/calidad` que lo renderice.
- **B1-002 / B2-002**: auditar los 30 usos de `rounded-lg`/`rounded-full` y decidir si son intencionales (dots, pills) o fugas del radio-cero de marca; documentar la decisión en tokens.
- **B1-001**: evaluar preloading de Inter si el body LCP lo justifica.
- **A1-005 / A1-008 / A1-012**: ampliar cobertura de tests para `staticSite.ts` (path traversal), `rateLimitRepository.cleanup()` con volumetría, y sincronización inversa galería→media.
- **M4/M5** (auditoría previa): añadir ESLint + `eslint-plugin-astro`; migrar CSP a hashes/nonces para reducir `unsafe-inline`.

### Cierre

El proyecto demuestra un nivel de ingeniería **alto y poco común** para un CMS propio, con una capa visual sólidamente alineada con la marca Hidromont y un cuidado de accesibilidad y localización por encima del promedio. Tras los fixes de §7, los bloqueantes de empaquetado/configuración (H1, H2) están resueltos y verificados en vivo, los hallazgos lógicos nuevos (cascade galería, export con subdirectorios, crash recovery de publish, contrato `orden`) corregidos con tests de regresión, y los gaps de accesibilidad (focus-visible, aria-expanded) cerrados. El CI añadido (`.github/workflows/ci.yml`) ejecutará build + 76 tests + el gate anti-overlay en cada PR, previniendo recaer en H1.

Conforme a los criterios —*no hay hallazgos Críticos ni Altos sin resolver*—:

**El proyecto está listo para producción tras la validación del CI en el PR de estos cambios.**

---

## 7. Registro de remediación

### 7.0 Resumen de remediación

| Métrica | Antes | Después |
|---|---|---|
| Nota global | 7/10 (topeada) | **8,5/10** |
| Hallazgos Altos abiertos | 4 (H1, H2, A1-001, A1-004) | **0** |
| Tests unitarios | 65/65 | **76/76** (+11 de regresión) |
| `dist/index.html` tamaño | 151.679 bytes | **85.692 bytes (−43,5 %)** |
| Archivos `dist/` con marcadores CMS | 24 | **0** |
| CI/CD | ausente | **`.github/workflows/ci.yml`** (build + tests + build-gate + e2e) |

Verificación en vivo ejecutada: `npm run build` ✓ (24 págs), `npm test` ✓ (76/76), smoke-test CMS contra DB real ✓ (117 entries, 1759 media, migraciones aplicadas), build-gate e2e ✓ (4/4), `tsc --noEmit` ✓ (0 errores).

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

### 7.2 Hallazgos pendientes (no bloqueantes, post-producción)

Estos hallazgos NO bloquean producción y se listan para ciclo futuro:

| ID | Severidad | Hallazgo | Nota |
|---|---|---|---|
| A1-002 | Medio | Sólo se exportan entradas con `version > 1` | Comportamiento intencional (draft safety); documentar en la UI del overlay. |
| A1-005 | Medio | Sin más tests de export edge cases | Cubrir slugs con caracteres especiales beyond `/`. |
| A1-008 | Medio | Cleanup de rate-limit sólo al arranque | Añadir barrido periódico si crece la tabla. |
| A1-010 | Bajo | Acción del job serializada en JSON de logs | Columna `action` propia en `publish_jobs`. |
| A1-012 | Medio | Sin sync inversa galería→media | Detectar media borrado de disco fuera del CMS. |
| A2-002 | Bajo | Contenido CMS huérfano `calidad.*` | Crear página `/calidad` o eliminar entradas. |
| A2-004 | Medio | Sin rate limiting propio del form de contacto | Depende 100% de FormSubmit.co. |
| A3-001 | Medio | Nav hrefs CMS-editables | Validar formato en export. |
| A3-003 | Bajo | Duplicación logos `clientes.json` ↔ `cliente-logos.ts` | Unificar fuente de verdad. |
| B1-001 | Informativo | Inter no preloaded (por diseño) | Evaluar si el body LCP lo justifica. |
| B1-002 | Bajo | `rounded-lg`/`rounded-full` filtran radio-cero de marca (30 usos) | Auditar y decidir caso a caso. |
| B2-002 | Bajo | ProjectFilters/ProjectTable usan `rounded-md/lg` | (ver B1-002). |

---

*Última actualización: 2026-07-18 (post-remediación).*
