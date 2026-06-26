# Auditoría de Producción

> Proyecto: **Hidromont Chile — Sitio web + CMS propio**
> Stack: Astro 4 (output `static`) + CMS Fastify/SQLite (better-sqlite3, bcryptjs, zod)
> Fecha de auditoría: 2026-06-25
> Rama auditada: `fix/auditoria-p0-p1`
> Comandos ejecutados: `npm run build` (✓), `npm test` (✓ 65/65), `npm audit --omit=dev` (✓ 0 vulnerabilidades)

## 1. Resumen ejecutivo

### Nota final

**Nota: 7/10**

### Veredicto

**Listo para producción: No**

### Justificación breve

El proyecto está **técnicamente bien construido y por encima del promedio** de un CMS propio: arquitectura en capas limpia (controllers → services → repositories), validación con Zod en todos los endpoints, autenticación con bcrypt (cost 12), sesiones con cookie `httpOnly`, protección CSRF de doble token, rate limiting de login, registro de auditoría, protección contra path traversal en el servidor estático y en la subida de archivos, validación de MIME/extensión en uploads y bloqueo de SVG subido por usuario para evitar XSS almacenado. El build pasa con `astro check`, las 65 pruebas unitarias pasan, hay pruebas e2e con Playwright y `npm audit` no reporta vulnerabilidades. El SEO técnico (canonical, OG, Twitter, JSON-LD, sitemap, robots) y la base de accesibilidad están bien resueltos.

**Sin embargo, no puede declararse listo para producción** porque el build estático actual **filtra el CMS al público**: el `dist/index.html` generado con el `.env` real incluye **66 KB de JavaScript inline del editor visual** y **58 atributos `data-cms-entry`** que exponen la estructura interna de contenido en cada página. Esto se debe a que `.env` define `PUBLIC_ENABLE_CMS=1`, valor que debería ser `0` para producción. Es un hallazgo **Alto** (rendimiento + divulgación de información), y por sí solo bloquea el despliegue según los criterios de la auditoría. A esto se suma una configuración de servidor CMS endurecible (cookie no segura + host `0.0.0.0`), la ausencia de CI/lint y limpieza pendiente del repositorio.

No hay hallazgos **Críticos** (no se identificó un vector de compromiso explotable de forma anónima: la API del CMS exige sesión autenticada + CSRF, y el sitio público es estático). Resueltos los dos hallazgos Altos, el proyecto sube a **8/10** y queda apto para producción.

## 2. Estado general del proyecto

| Dimensión | Estado |
|---|---|
| Arquitectura | Sólida. Separación clara presentación / negocio / datos. |
| Astro | Uso correcto: `output: static`, sin islas innecesarias, imágenes optimizadas. |
| CMS | Funcional y razonablemente seguro (auth + CSRF + rate limit + audit). |
| Seguridad | Buena base; 2 endurecimientos pendientes antes de exponer el CMS. |
| Build | ✓ Pasa (`astro check && astro build`). |
| Tests | ✓ 65 unit (Vitest) + e2e (Playwright). Sin CI que los ejecute. |
| Dependencias | ✓ 0 vulnerabilidades. Versiones modernas. |
| SEO | ✓ Completo. |
| Accesibilidad | Buena base semántica; auditoría visual ya documentada. |
| Documentación | ✓ README + `.env.example` claros. |

El repositorio está organizado en dos dominios bien separados:

- `src/` → sitio Astro estático (páginas, layouts, componentes, content collections de servicios/proyectos en Markdown).
- `cms/` → backend Fastify con SQLite, estructurado en `controllers/`, `services/`, `repositories/`, `validators/`, `middleware/`, `db/`, `routes/`.

El flujo de publicación es: editar contenido en el overlay visual → el CMS persiste en SQLite → `export` escribe `src/data/cms-content.json` y los `.md` → se reconstruye el sitio estático → se despliega a Cloudflare Pages (`public/_headers`, `public/_redirects`). El CMS no se despliega; corre local/LAN para el administrador.

## 3. Hallazgos por severidad

### Críticos

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| — | No se identificaron hallazgos críticos. | — | — | — |

### Altos

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| H1 | El build de producción incluye el editor visual del CMS: 66 KB de JS inline (`__HIDROMONT_CMS__`, `hm-cms-bar`) y 58 atributos `data-cms-entry` reales por página. Causado por `PUBLIC_ENABLE_CMS=1` en `.env`. | `.env` (`PUBLIC_ENABLE_CMS=1`), `src/components/cms/CmsOverlay.astro:4`, `src/components/cms/EditableText.astro:23`, evidencia en `dist/index.html` | Divulgación de la estructura interna de contenido (ids de entradas/campos) y de los endpoints `/api/cms/*` a cualquier visitante; +66 KB de JS inútil en cada página afectando LCP/peso. | Construir producción con `PUBLIC_ENABLE_CMS=0` (o sin la variable). Añadir guard explícito y un test que falle si `dist/` contiene `data-cms-entry` o `__HIDROMONT_CMS__`. Ya existe el e2e que lo verifica: integrarlo en CI bloqueante. |
| H2 | Si el CMS se sirve por red (`CMS_HOST=0.0.0.0`) con `CMS_COOKIE_SECURE=0`, la cookie de sesión viaja en texto plano (HTTP) → secuestro de sesión. El guard de arranque sólo bloquea la contraseña *por defecto*, no contraseñas débiles ni la combinación host expuesto + cookie insegura. | `.env` (`CMS_HOST=0.0.0.0`, `CMS_COOKIE_SECURE=0`), `cms/server.ts:9-19`, `cms/controllers/AuthController.ts:17-23` | Robo de la sesión de administrador en redes no confiables; acceso total al CMS. | Para uso en red: forzar HTTPS y `CMS_COOKIE_SECURE=1`, o restringir a `CMS_HOST=127.0.0.1` + túnel. Endurecer el guard de `server.ts` para exigir cookie segura cuando el host no es local. |

### Medios

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| M1 | El servidor estático Fastify no emite CSP (sólo 3 cabeceras básicas). La CSP completa sólo existe en `public/_headers`, que **únicamente aplica en Cloudflare Pages**. | `cms/server.ts:29-33`, `cms/staticSite.ts`, `public/_headers` | Si el sitio se sirviera vía Fastify (`server.mjs`), no habría CSP → menor defensa ante XSS. | Replicar la CSP de `_headers` en el `onSend` de `server.ts`, o documentar que el despliegue oficial es Cloudflare Pages. |
| M2 | No hay política de fortaleza de contraseña ni rotación. El usuario admin se crea **una sola vez** (`ensureAdminUser` retorna si ya existe), por lo que cambiar `CMS_ADMIN_PASSWORD` tras el primer arranque no actualiza el hash. | `cms/services/authService.ts:9-25` | Footgun operativo: el admin cree haber cambiado la contraseña y no lo hizo. | Documentar el comportamiento; añadir script `cms:reset-password` o validación de longitud/entropía mínima en el seed. |
| M3 | No existe CI/CD (`.github/workflows` ausente). Build, type-check, tests unit y e2e no se ejecutan automáticamente al hacer push. | (ausencia) raíz del repo | Regresiones llegan a `main`/producción sin barrera automática. | Añadir workflow que ejecute `npm run build`, `npm test`, `npm run test:e2e` y el guard anti-overlay en cada PR. |
| M4 | No hay configuración de linter (ESLint). Sólo type-check vía `astro check`. | raíz del repo (`package.json` sin script `lint`) | Inconsistencias de estilo/calidad no detectadas; faltan reglas de seguridad estáticas. | Añadir ESLint (con `eslint-plugin-astro`) y script `lint`; integrarlo en CI. |
| M5 | La CSP usa `script-src 'self' 'unsafe-inline'`, requerido por los scripts inline de Astro (`is:inline`) y JSON-LD. | `public/_headers` | `unsafe-inline` debilita la mitigación de XSS. | Migrar a CSP basada en hashes/nonces para los scripts inline conocidos cuando sea viable. |

### Bajos

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| L1 | Directorio `test-results/` (21 archivos, artefactos de Playwright) versionado y **no** incluido en `.gitignore`. | `test-results/`, `.gitignore` | Ruido en el repo, diffs inútiles, posible filtrado de contexto de errores. | Añadir `test-results/` y `playwright-report/` a `.gitignore` y eliminarlos del control de versiones. |
| L2 | Documentos de trabajo y herramientas de agente versionados en la raíz (`AUDITORIA_VISUAL.md`, `PRODUCT.md`, `emil-design-eng-...md`, `hidromont_contenido_web_por_secciones.md`, `.commandcode/`, `.claude/`). | raíz del repo | Desorden; mezcla artefactos de desarrollo con el código de producto. | Mover a `docs/` o excluir del repo de producción. |
| L3 | Numerosos `.DS_Store` en el árbol de trabajo (no rastreados, correctamente ignorados). | varios directorios | Cosmético. | Sin acción (ya en `.gitignore`). |
| L4 | El correo de contacto se expone en cliente (`PUBLIC_CONTACT_EMAIL`) y el form usa FormSubmit.co con `_captcha=false`. | `src/components/contact/ContactForm.astro:47,54` | Spam dirigido al correo (mitigado por honeypot `_honey`). | Aceptable para el servicio elegido; considerar reCAPTCHA/hCaptcha si aumenta el spam. |

### Informativos

| ID | Observación | Archivo/Ruta | Recomendación |
|---|---|---|---|
| I1 | `robots.txt` bloquea correctamente `/api/cms/` y declara el sitemap. | `public/robots.txt` | Sin acción. |
| I2 | `npm audit --omit=dev` → 0 vulnerabilidades. Dependencias modernas (Astro 4.16, Fastify 5, Zod 4). | `package.json` | Mantener actualizado. |
| I3 | `.env` **no** está en el historial de git ni rastreado; `.env.example` usa placeholder `Hidromont-Admin-ChangeMe`. | `.gitignore`, `.env.example` | Sin acción. Buena práctica. |

## 4. Auditoría de arquitectura

**Análisis.** Arquitectura en capas ejemplar para el tamaño del proyecto:

- **Controllers** (`cms/controllers/`): parseo/validación de request y forma de la respuesta. Heredan de `BaseController` (manejo uniforme de errores/éxito).
- **Services** (`cms/services/`): lógica de negocio (auth, contenido, media, galería, export, publish, backup).
- **Repositories** (`cms/repositories/`): acceso a SQLite con sentencias preparadas (sin concatenación SQL → sin inyección SQL observada).
- **Validators** (`cms/validators/cms.schema.ts`): esquemas Zod reutilizados por los controllers.
- **Routes** (`cms/routes/cmsRoutes.ts`): un único punto de cableado con `preHandler: [requireAuth, requireCsrf]` consistente en todas las mutaciones.

El sitio (`src/`) separa correctamente datos (`src/data/`), contenido (`src/content/` como collections Markdown), componentes por dominio (`home/`, `contact/`, `gallery/`, `projects/`, `layout/`, `cms/`) y layouts.

**Problemas.** Acoplamiento bajo. La principal observación de arquitectura es la **frontera difusa entre "modo edición" y "modo producción"**: el mismo árbol de componentes emite atributos de edición y el overlay según una env var de build (H1). No hay separación física entre el bundle público y el de edición.

**Recomendaciones.** Garantizar por construcción (no por convención de `.env`) que el bundle de producción nunca incluya artefactos de edición: un test de build bloqueante (ya existe el e2e) y `PUBLIC_ENABLE_CMS=0` por defecto.

## 5. Auditoría específica de Astro

**Análisis.**
- `astro.config.mjs`: `output: 'static'`, `site: 'https://hidromont.cl'`, integraciones `@astrojs/tailwind` y `@astrojs/sitemap`. Correcto para un sitio de marketing.
- `build.assets: '_assets'` y `format: 'directory'`: URLs limpias.
- Imágenes optimizadas en build (`generating optimized images` → WebP, cache reusado).
- Uso mínimo y correcto de `is:inline` (flag `.js`, JSON-LD, mensajes de validación del form como JSON embebido, overlay).
- Rutas dinámicas (`servicios/[slug].astro`, `proyectos/[slug].astro`) sobre content collections. Build genera 24 páginas sin errores.
- No hay islas de framework (React/Vue/Svelte) → cero JS de hidratación de frameworks. Excelente para CWV.

**Problemas.** H1 (overlay inline en build). `set:html` se usa en 4 sitios; 3 son seguros (JSON-LD/JSON serializado por `JSON.stringify`, icono SVG estático en `ServiceCard`) y 1 es el overlay (H1).

**Recomendaciones.** Mantener `output: static`. Forzar `PUBLIC_ENABLE_CMS=0` en producción.

## 6. Auditoría del CMS propio

**Flujo CRUD/publicación.** Endpoints REST completos para entradas, campos, media, galería (categorías + items con reorder), revisiones (listar/restaurar), export, publish (con job tracking) y backup. Todas las mutaciones exigen `requireAuth` + `requireCsrf`.

**Validación.** Zod en todos los endpoints (`cms.schema.ts`). Slugs e IDs restringidos por regex (`/^[a-z0-9/._-]+$/`) con rechazo explícito de `..` (anti directory traversal en el nombre de archivo exportado). Casos límite cubiertos por tests (slug duplicado, id inválido, campo inexistente, media inexistente, password faltante, array de reorder vacío).

**Sanitización / XSS.**
- Subida de imágenes: allowlist de MIME (`jpeg/png/webp`), **SVG bloqueado para uploads de usuario** con comentario explícito sobre stored-XSS (`mediaService.ts:9-12`), verificación de coincidencia MIME↔extensión, límite de tamaño, nombre de archivo saneado + `nanoid`, contención de ruta (`fullPath.startsWith(uploadDir)`).
- El contenido de texto se renderiza como texto en componentes Astro (auto-escapado); no hay `set:html` con valores del CMS.

**Autenticación / sesiones.** bcrypt cost 12, sesión `nanoid(48)`, expiración configurable, cookie `httpOnly` + `sameSite: lax` + `secure` configurable, limpieza de sesiones expiradas. CSRF por doble token (cabecera `X-CSRF-Token` vs token de sesión).

**Defensa adicional.** Rate limiting de login (10 intentos/60 s por IP, persistido en SQLite) y registro de auditoría de todas las acciones sensibles (`AuditRepository`).

**Rutas administrativas.** No hay panel admin estático (`public/cms/` está vacío); el "panel" es el overlay inline + la API. `robots.txt` bloquea `/api/cms/`.

**Riesgos del CMS.** H1 (overlay filtrado al público) y H2 (cookie insegura si se expone en LAN). M2 (seed de admin idempotente que no rota contraseña). Path traversal en servir estáticos mitigado por `findContainedFile` (`staticSite.ts:78-92`).

**Preparación.** El núcleo del CMS está listo a nivel de seguridad de aplicación; el bloqueo es de **configuración/empaquetado**, no de lógica.

## 7. Auditoría de seguridad

| Vector | Estado | Evidencia |
|---|---|---|
| Inyección SQL | Mitigado | Sentencias preparadas en todos los repositories. |
| XSS reflejado/almacenado | Mitigado | Auto-escape de Astro; SVG bloqueado en upload; `escapeHtml` en el overlay. |
| CSRF | Mitigado | Doble token (`requireCsrf`, `middleware/security.ts:47-57`). |
| Path traversal (servir) | Mitigado | `findContainedFile` (`staticSite.ts`). |
| Path traversal (export/upload) | Mitigado | Regex de slug + rechazo de `..` + contención de ruta. |
| AuthN / AuthZ | Mitigado | bcrypt + `requireAuth` en todas las rutas privadas. |
| Brute force | Mitigado | Rate limit de login. |
| Secretos en repo | OK | `.env` ignorado y ausente del historial; `.env.example` con placeholder. |
| Dependencias | OK | `npm audit` 0 vulnerabilidades. |
| Exposición del CMS al público | **Alto (H1)** | Overlay + `data-cms-entry` en `dist/`. |
| Cookie en claro / host expuesto | **Alto (H2)** | `CMS_COOKIE_SECURE=0` + `CMS_HOST=0.0.0.0`. |
| CSP en servidor Fastify | Medio (M1) | Sólo en `_headers` (Cloudflare). |

**Clasificación:** Crítico 0 · Alto 2 · Medio 5 · Bajo 4 · Informativo 3.

## 8. Auditoría de performance

**Fortalezas.** Sitio estático sin hidratación de frameworks; imágenes a WebP con derivados responsive (`imageService.ts`: 640/1024/1600 + LQIP) y `srcset`; fuentes self-hosted con `preload` de la fuente de titulares; cache-control inmutable para assets/fuentes/imágenes en `_headers`.

**Problemas.**
- **H1 impacta CWV directamente:** 66 KB de JS inline del overlay en `dist/index.html` (de un total de ~150 KB de HTML), presente en **todas** las páginas. Es JS de parsing bloqueante e inútil para el visitante → degrada TBT/LCP y peso de transferencia. Eliminarlo (build con `PUBLIC_ENABLE_CMS=0`) reduce ~44 % el tamaño del HTML de la home.
- CSP `img-src ... https:` permite imágenes de cualquier origen HTTPS (laxo pero de bajo impacto).

**Recomendaciones.** Resolver H1; verificar Lighthouse tras el cambio (se espera salto notable de Performance).

## 9. Auditoría SEO

| Elemento | Estado | Evidencia |
|---|---|---|
| Title dinámico | ✓ | `BaseLayout.astro:24,64` |
| Meta description | ✓ | `:65` |
| Canonical | ✓ | `:67` (autogenerado por ruta) |
| Open Graph | ✓ | `:70-76` |
| Twitter Card | ✓ | `:79-82` |
| JSON-LD Organization | ✓ | `:28-45` |
| `noindex` opcional | ✓ | `:66` |
| Sitemap | ✓ | `@astrojs/sitemap` → `dist/sitemap-index.xml` |
| robots.txt | ✓ | bloquea `/api/cms/` |
| `lang` | ✓ | `html lang="es-CL"` |
| 404 | ✓ | `dist/404.html` + `_redirects` |
| Slugs | ✓ | limpios, validados |

**Riesgo SEO menor relacionado con H1:** los `data-cms-entry` en el HTML no afectan indexación, pero exponen estructura interna. El sitio público **sí está listo para indexación**; las rutas privadas del CMS no son páginas y están bloqueadas en robots.

## 10. Auditoría de accesibilidad

**Fortalezas.** HTML semántico, `lang` correcto, honeypot accesible (`aria-hidden`, `tabindex="-1"`), `alt` obligatorio y validado en items de galería (Zod `alt: min(1).max(500)`), preload de fuente para evitar FOUT. Existe un informe previo (`AUDITORIA_VISUAL.md`) que documenta el trabajo de UI/contraste.

**Pendientes a verificar.** Jerarquía de headings por página, foco visible en todos los interactivos y navegación por teclado en el lightbox de galería (no auditado dinámicamente en esta pasada). Recomendado: pasar axe/Lighthouse a11y sobre el build final.

## 11. Auditoría de dependencias y configuración

**package.json.** Scripts completos: `dev`, `cms`, `dev:cms`, `build` (`astro check && astro build`), `preview`, `check`, `test`, `test:watch`, `test:coverage`, `test:e2e`. Falta `lint` (M4).

**Dependencias.** Modernas y pertinentes: `fastify@5`, `better-sqlite3@12`, `bcryptjs@3`, `zod@4`, `sharp`, `@fastify/cookie`, `@fastify/multipart`, `@sentry/node`. `overrides` de `js-yaml@^4.2.0` para forzar versión segura. 0 vulnerabilidades.

**Variables de entorno.** `.env.example` (3 KB) **excelente**: documenta cada variable, valores por defecto y advertencias de seguridad (p. ej. "cambia `CMS_ADMIN_PASSWORD` si usas `0.0.0.0`"). `.env` correctamente ignorado. Otra persona puede instalar y desplegar sin adivinar.

**Configuración build/TS.** `tsconfig` extiende `astro/tsconfigs/strict` con `strictNullChecks` y alias `@/*`. Type-check integrado en el build.

**Faltan:** ESLint (M4) y CI (M3).

## 12. Testing y confiabilidad

| Tipo | Estado | Evidencia |
|---|---|---|
| Unit (Vitest) | ✓ 65/65 | `cms/test/*.test.ts` (auth, content, gallery, media, export, security) |
| E2E (Playwright) | ✓ presente | `e2e/cms-overlay.spec.ts` (login, requiere auth, build sin `data-cms`) |
| Type check | ✓ | `astro check` en `build` |
| Cobertura | Config presente | `vitest run --coverage` |
| Lint | ✗ | sin ESLint |
| CI | ✗ | sin `.github/workflows` |
| Manejo de errores | ✓ | `BaseController` + `errorTracking` (Sentry opcional) |
| Estados vacíos/error | ✓ | cubiertos en overlay y validadores |

**Confiabilidad.** Base de pruebas notable para un proyecto de este tamaño, incluyendo un e2e que verifica que el build público **no** contiene atributos `data-cms` — exactamente el contrato que H1 rompe cuando se construye con `.env` real. El gap clave es que **nada ejecuta esas pruebas automáticamente** antes de desplegar (M3).

## 13. Checklist de producción

| Área | Estado | Comentario |
|---|---|---|
| Build | Aprobado | `astro check && astro build` ✓, 24 páginas. |
| Seguridad | No aprobado | Base sólida, pero H1 (overlay público) y H2 (cookie/host) pendientes. |
| CMS | No aprobado | App segura; bloqueado por empaquetado (H1) y endurecimiento de despliegue (H2). |
| SEO | Aprobado | Completo. |
| Performance | No aprobado | H1 añade ~66 KB JS inline por página; resolver antes de medir CWV. |
| Accesibilidad | Aprobado (con reservas) | Buena base; validar headings/foco con axe sobre el build final. |
| Testing | Aprobado | 65 unit + e2e; falta ejecutarlos en CI. |
| Variables de entorno | Aprobado | `.env.example` ejemplar; `.env` ignorado. |
| Documentación | Aprobado | README + `.env.example` + READMEs del CMS. |
| Deploy | No aprobado | Falta CI y fijar `PUBLIC_ENABLE_CMS=0` en el pipeline de build. |

## 14. Acciones obligatorias antes de producción

1. **[Prioridad: Alta] Eliminar el CMS del build público (H1).**
   - Zona: `.env`/pipeline de build, `src/components/cms/CmsOverlay.astro`, `EditableText.astro`.
   - Problema: 66 KB de overlay inline + 58 `data-cms-entry` por página en `dist/`.
   - Resultado esperado: `grep -r "data-cms-entry\|__HIDROMONT_CMS__" dist/` no devuelve coincidencias; HTML de la home ~44 % más liviano. Construir con `PUBLIC_ENABLE_CMS=0` y dejar el e2e existente como gate bloqueante.

2. **[Prioridad: Alta] Endurecer el despliegue del CMS (H2).**
   - Zona: `.env` (`CMS_HOST`, `CMS_COOKIE_SECURE`), `cms/server.ts`.
   - Problema: cookie de sesión en claro si se expone en LAN/HTTP.
   - Resultado esperado: el CMS sólo arranca expuesto si `CMS_COOKIE_SECURE=1` (HTTPS) o queda restringido a `127.0.0.1`; el guard de arranque lo verifica.

3. **[Prioridad: Media] Añadir CI bloqueante (M3).**
   - Zona: `.github/workflows/ci.yml`.
   - Problema: build/tests/e2e no se ejecutan automáticamente.
   - Resultado esperado: cada PR ejecuta `build`, `test`, `test:e2e` y el guard anti-overlay; merge bloqueado si fallan.

4. **[Prioridad: Media] CSP en el servidor Fastify si se sirve desde él (M1).**
   - Zona: `cms/server.ts` (`onSend`).
   - Problema: sin CSP fuera de Cloudflare.
   - Resultado esperado: misma CSP que `_headers` aplicada por el servidor, o documentar que el deploy oficial es Cloudflare Pages.

5. **[Prioridad: Baja] Limpiar el repositorio (L1, L2).**
   - Zona: `.gitignore`, raíz.
   - Problema: `test-results/` versionado; documentos de trabajo en raíz.
   - Resultado esperado: artefactos y docs fuera del control de versiones del producto.

## 15. Acciones recomendadas después de producción

- Añadir ESLint + `eslint-plugin-astro` y script `lint` (M4).
- Migrar la CSP a hashes/nonces para reducir `unsafe-inline` (M5).
- Script `cms:reset-password` y política de fortaleza de contraseña (M2).
- Pasar axe-core/Lighthouse a11y sobre el build final y corregir hallazgos.
- Configurar Sentry en producción (`SENTRY_DSN`) para el CMS.
- Considerar captcha en el formulario si crece el spam (L4).
- Cobertura de tests para `staticSite.ts` (path traversal) y `exportService` (slugs con subdirectorios).

## 16. Conclusión final

El proyecto demuestra un nivel de ingeniería **alto y poco común** para un CMS propio: capas limpias, validación exhaustiva, autenticación y CSRF correctos, rate limiting, auditoría, protección contra traversal y XSS de uploads, build y pruebas en verde, SEO completo y documentación clara. No tiene hallazgos críticos ni vulnerabilidades de dependencias.

El bloqueo para producción **no es de calidad de código sino de empaquetado y configuración**: el build estático actual filtra el editor del CMS al público (H1) y la configuración por defecto del servidor CMS es insegura si se expone en red (H2). Ambos son corregibles en horas. Resueltos H1 y H2 (e idealmente añadido el CI que los previene), el proyecto pasa a 8/10 y queda apto.

Conforme a los criterios de la auditoría —existen hallazgos Altos sin resolver—:

**El proyecto no está listo para producción.**
