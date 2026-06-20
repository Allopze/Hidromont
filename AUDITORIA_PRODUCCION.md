# Auditoría de Producción

> Auditoría técnica integral del repositorio `hidromont-chile-web` (sitio Astro estático + CMS propio Fastify/SQLite).
> Fecha: 2026-06-20 · Rama auditada: `fix/auditoria-p0-p1` · Auditor: revisión senior automatizada.

## 1. Resumen ejecutivo

### Nota final

**Nota: 7/10**

### Veredicto

**Listo para producción: No** (muy cerca; bloqueado por 1 hallazgo Alto y la ambigüedad de cabeceras de despliegue).

### Justificación breve

El proyecto está **notablemente bien construido** para su categoría. La decisión arquitectónica clave —el sitio público es **100% estático** (`output: 'static'`) y el CMS se inyecta **solo en desarrollo** (`import.meta.env.DEV`)— elimina de raíz la mayor parte de la superficie de ataque de producción: el artefacto desplegado no contiene servidor, ni panel administrativo, ni secretos, ni código del CMS. Eso es exactamente lo que se quiere ver.

Las validaciones automáticas existen y pasan: `astro check` reporta **0 errores / 0 warnings** sobre 92 archivos, el build genera 21 páginas correctamente, y la suite de tests del CMS pasa **49/49** (más una suite E2E de Playwright). El CMS, aunque sea una herramienta local, implementa autenticación real (bcrypt cost 12), sesiones con cookie `httpOnly`, tokens CSRF, rate-limiting por IP, registro de auditoría, historial de revisiones y validación robusta de subidas (MIME + extensión + verificación con `sharp`). La documentación (`README.md`, `.env.example`) es completa y permite a un tercero instalar y desplegar sin adivinar.

No se encontró **ningún hallazgo Crítico**. La nota no sube de 8 por: (1) un hallazgo **Alto** —el CMS combina contraseña de administrador por defecto con bind por defecto a `0.0.0.0`, lo que lo expone en la LAN con credenciales conocidas si se ejecuta sin endurecer; (2) la configuración de cabeceras de seguridad depende de `.htaccess` (solo Apache) mientras `public/_redirects` sugiere Cloudflare Pages, donde **no se aplicarían** y no existe `_headers` ni CSP; (3) la página `/contacto` no tiene `<h1>`. Resueltos esos puntos, el proyecto califica cómodamente para un 8.

## 2. Estado general del proyecto

**Arquitectura.** Separación limpia y madura. El sitio (`src/`) y el CMS (`cms/`) están desacoplados. El CMS sigue un patrón por capas correcto: `routes → controllers → services → repositories → db`, con `validators` (Zod), `middleware` (auth/CORS/CSRF), `config` unificada y `types`. No se observa lógica de negocio en controladores ni acceso directo a SQL desde servicios. Reutilización adecuada de componentes Astro (`ui/`, `layout/`, `home/`, etc.).

**Astro.** Uso idiomático: `output: 'static'`, `site` definido, integración de `sitemap`, Tailwind con `applyBaseStyles:false`, colecciones de contenido tipadas con Zod (`src/content/config.ts`), rutas dinámicas (`[slug].astro`) para servicios y proyectos, e imágenes optimizadas a WebP en build. Cero islas hidratadas innecesarias; la interactividad usa `<script is:inline>` puntual. El overlay del CMS y todos los atributos `data-cms-*` se eliminan del build de producción por estar detrás de `import.meta.env.DEV`.

**CMS.** Es un CMS local/LAN serio, no un prototipo. Flujo completo: crear/editar/eliminar/publicar, revisiones con rollback, biblioteca de medios con detección de uso, exportación a `cms-content.json` + Markdown, y publicación que ejecuta `astro check` antes de dar por válido el contenido. El frontend nunca renderiza HTML crudo del CMS con `set:html` (los `set:html` existentes son `JSON.stringify` de datos estáticos), por lo que no hay vector de XSS almacenado en el sitio.

**Preparación.** Build reproducible con guard explícito que **falla** si falta `PUBLIC_WEB3FORMS_KEY` en producción (evita el único canal de conversión roto en silencio). `.env` está en `.gitignore` y no se rastrea; `.env.example` es exhaustivo. Quedan pendientes de endurecer la operación del CMS y la entrega de cabeceras de seguridad según el host real.

## 3. Hallazgos por severidad

### Críticos

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| — | No se identificaron hallazgos críticos. | — | — | — |

### Altos

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| SEC-H1 | El CMS define contraseña de admin por defecto (`Hidromont-Admin-ChangeMe`) y `CMS_HOST` por defecto `0.0.0.0`. Si se ejecuta `npm run cms` sin endurecer, el panel queda accesible en toda la LAN con credenciales públicas conocidas. Solo se imprime una advertencia; el servidor **arranca igual**. | `cms/config/unifiedConfig.ts:44-48`, `cms/server.ts:9-23` | Cualquiera en la red local podría autenticarse como administrador, editar contenido y subir archivos. | Hacer que el arranque **falle** (no solo advierta) si la contraseña es la de por defecto y el host no es loopback. Cambiar el default de `CMS_HOST` a `127.0.0.1`. Exigir `CMS_ADMIN_PASSWORD` sin valor por defecto utilizable. |

### Medios

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| SEC-M1 | Las cabeceras de seguridad están solo en `public/.htaccess` (exclusivo de Apache), pero `public/_redirects` indica Cloudflare Pages, donde `.htaccess` se ignora. No existe `_headers` ni Content-Security-Policy. | `public/.htaccess`, `public/_redirects` (no existe `public/_headers`) | En el host probable (Cloudflare Pages) el sitio se sirve **sin** `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` ni CSP: clickjacking y MIME-sniffing sin mitigar. | Añadir `public/_headers` con las mismas cabeceras + una CSP básica. Documentar el host real y eliminar la config que no aplique. |
| SEC-M2 | `npm audit` reporta 16 vulnerabilidades (14 moderadas, 2 altas), todas en la cadena de `@astrojs/check` → `yaml-language-server` → `yaml`. | `package.json` (deps), `package-lock.json` | Solo afectan herramientas de build/type-check, no el artefacto estático; aun así amplían la superficie de la instalación. | Ejecutar `npm audit fix`; mantener `@astrojs/check` actualizado. Ver también CFG-M1. |
| CFG-M1 | Dependencias exclusivas de build/dev (`@astrojs/check`, `typescript`, `tsx`, `concurrently`) están en `dependencies` en lugar de `devDependencies`. | `package.json:14-41` | Instalación de producción más pesada y mayor superficie de `npm audit`/supply-chain de lo necesario. | Mover herramientas de build/CLI a `devDependencies`. |
| A11Y-M1 | La página `/contacto` no tiene `<h1>`; su mayor encabezado es un `<h2>`. Verificado en `dist/contacto/index.html` (h1=0; el resto de páginas tiene exactamente 1). | `src/pages/contacto.astro:9-28` | Jerarquía de encabezados rota: perjudica lectores de pantalla (WCAG 2.4.6/1.3.1) y SEO on-page. | Añadir un `<h1>` visible (o `sr-only`) con el título de la página, p. ej. "Contacto". |
| SEC-M3 | CORS refleja con credenciales cualquier origen de red privada (`10.x`, `192.168.x`, `172.16–31.x`) y cualquier `localhost:*`. | `cms/middleware/security.ts:15-31` | Origen amplio para una API con cookies; mitigado por el token CSRF obligatorio en mutaciones, pero permisivo. | Restringir a `CMS_ALLOWED_ORIGINS` explícitos; evitar el reflejo automático de toda la LAN. |

### Bajos

| ID | Problema | Archivo/Ruta | Riesgo | Recomendación |
|---|---|---|---|---|
| REPO-L1 | Archivos pesados/no usados en build versionados en git: catálogo PDF de 5 MB, carpeta `fotos-hidromont/` (~141 imágenes en bruto), `LOGOTIPO - Editado.png`, `hidromont-chile.svg`, además de `brief.md`, `PLAN.md`, `DESIGN_SYSTEM.md`. | raíz del repo | Repo inflado, clones lentos; ninguno se despliega (no están en `public/`), pero ensucian el historial. | Mover material fuente a almacenamiento externo o `.gitignore`; conservar solo lo necesario para el build. |
| SEC-L1 | Enumeración de usuarios por timing: `login()` lanza de inmediato si el email no existe y solo ejecuta `bcrypt.compare` si existe. | `cms/services/authService.ts:30-35` | Un atacante podría inferir qué emails son válidos por diferencia de latencia. Bajo impacto (1 solo admin, mensaje genérico). | Ejecutar siempre un `bcrypt.compare` contra un hash dummy para igualar el tiempo. |
| SEC-L2 | La cookie de sesión no establece `Secure`. | `cms/controllers/AuthController.ts:21-26` | Aceptable en HTTP local; problemático si el CMS se expone por HTTPS en LAN. | Activar `secure` condicionalmente cuando el origen sea HTTPS. |
| QA-L1 | No hay ESLint/Prettier configurados; el formateo/estilo no se valida automáticamente. | (ausencia) | Inconsistencias de estilo a largo plazo; no bloqueante (existe `astro check` + tests). | Añadir ESLint + Prettier y un script `lint`. |
| DOC-L1 | Coexisten dos configuraciones de despliegue (`.htaccess` Apache y `_redirects` Cloudflare) sin documentar cuál es el host real. | `public/.htaccess`, `public/_redirects` | Confusión operativa; relacionado con SEC-M1. | Documentar el proveedor de hosting en el README y dejar solo la config aplicable. |

### Informativos

| ID | Observación | Archivo/Ruta | Recomendación |
|---|---|---|---|
| INFO-1 | Excelente decisión de seguridad: producción es estática y el overlay/credenciales del CMS quedan fuera del build (`import.meta.env.DEV`). | `src/components/cms/CmsOverlay.astro:4` | Mantener este invariante en futuras features. |
| INFO-2 | Guard de build que aborta si falta `PUBLIC_WEB3FORMS_KEY` en prod: evita formulario de contacto roto en silencio. | `src/components/contact/ContactForm.astro:14-22` | Patrón a replicar para otras integraciones externas. |
| INFO-3 | Cobertura de pruebas razonable: 49 tests unitarios/integración del CMS + E2E Playwright + type-check en cada build. | `cms/test/`, `e2e/` | Ampliar E2E al flujo público (formulario, navegación). |
| INFO-4 | SEO técnico sólido: `sitemap-index.xml`, `robots.txt`, canonical, Open Graph, Twitter Card y JSON-LD `Organization`. | `astro.config.mjs`, `src/layouts/BaseLayout.astro` | Considerar JSON-LD adicional (`Service`, `BreadcrumbList`). |
| INFO-5 | Subidas validadas por MIME + extensión + metadata `sharp`; SVG bloqueado en uploads de usuario para evitar XSS embebido. | `cms/services/mediaService.ts:10-13,96-110` | Mantener. |

## 4. Auditoría de arquitectura

**Análisis.** Estructura por capas correcta y consistente en el CMS (`controllers/`, `services/`, `repositories/`, `validators/`, `middleware/`, `config/`, `db/`, `types/`). Inyección de dependencias manual y explícita en `cms/routes/cmsRoutes.ts` (los repos reciben `db`, los servicios reciben repos, los controllers reciben servicios): testeable y sin acoplamiento global. El sitio Astro separa páginas, layouts, componentes por dominio y datos (`src/data/`). `ExportService` acepta `rootDir` inyectable para que los tests escriban a temporales y no pisen el contenido real: buena previsión.

**Problemas.** (1) Mezcla de dependencias de build con runtime (CFG-M1). (2) Archivos de documentación/diseño y assets en bruto en la raíz (REPO-L1) restan claridad. (3) Pequeña duplicación de helpers de cabeceras de seguridad entre `cms/server.ts` (onSend) y `.htaccess`.

**Recomendaciones.** Limpiar la raíz, separar dependencias de dev, y centralizar la lista de cabeceras de seguridad. La base arquitectónica es escalable y mantenible.

## 5. Auditoría específica de Astro

**Análisis.** `astro.config.mjs` correcto: `site` definido (necesario para canonical/sitemap), `output: 'static'`, `build.assets` personalizado, `trailingSlash: 'ignore'`. Colecciones tipadas con Zod, rutas dinámicas con `getStaticPaths` implícito en `[slug].astro`, imágenes optimizadas a WebP en build (visible en la salida). Fuentes auto-hospedadas con `preload` del peso de encabezado para evitar FOUT. Sin hidratación de cliente innecesaria.

**Problemas.** Sin endpoints SSR (esperado en sitio estático). El único riesgo conceptual sería contenido del CMS renderizado como HTML crudo; se verificó que **no ocurre** (los `set:html` son JSON estático y SVG de íconos controlado en `ServiceCard.astro`).

**Recomendaciones.** Considerar `astro:assets` también para imágenes servidas desde `public/` cuando se pueda, para `width/height` automáticos.

## 6. Auditoría del CMS propio

**Análisis.** CMS por capas con autenticación real:
- **Auth**: bcrypt (cost 12), sesiones en SQLite con expiración (`CMS_SESSION_DAYS`), cookie `httpOnly` + `sameSite:'lax'`, limpieza de sesiones expiradas.
- **CSRF**: token por sesión exigido en todos los métodos mutadores (`requireCsrf`).
- **Rate-limiting**: 10 intentos/min por IP, persistente en `login_attempts` con respuesta `429` + `Retry-After`.
- **Auditoría**: `audit_events` registra login, logout, CRUD de entradas/medios, export/publish, restauración de revisiones.
- **Validación**: Zod en login, creación/edición de entradas (incl. regex de `id`), campos y medios.
- **Subidas**: lista blanca de MIME, verificación extensión↔MIME, `safeFilename` con normalización, guard de path traversal en escritura y borrado.
- **Publicación**: `execFile` (no shell) con args como array y `timeout`, comando configurable por env (no por usuario) → sin inyección de comandos.
- **Revisiones**: snapshot por versión con restauración.

**Riesgos.** El principal es **operativo, no de código**: contraseña por defecto + bind `0.0.0.0` por defecto (SEC-H1). CORS amplio en LAN (SEC-M3). Enumeración por timing (SEC-L1). Cookie sin `Secure` (SEC-L2).

**Preparación.** El CMS **no se despliega a producción** (no forma parte del artefacto estático), por lo que no es un bloqueante del sitio público; sí debe endurecerse antes de operarse en cualquier red compartida.

## 7. Auditoría de seguridad

| Vector | Estado | Evidencia |
|---|---|---|
| XSS almacenado/reflejado en el sitio | Mitigado | Sin `set:html` con contenido de usuario; `set:html` solo sobre `JSON.stringify` estático y SVG de íconos controlado. |
| CSRF (CMS) | Mitigado | Token por sesión exigido en mutaciones (`cms/middleware/security.ts`). |
| Inyección de comandos (publish) | Mitigado | `execFile` con array de args, comando desde env. |
| Inyección SQL | Mitigado | Consultas parametrizadas en todos los repositorios. |
| Exposición de secretos | Mitigado | `.env` en `.gitignore` y no rastreado; producción estática sin secretos. |
| Credenciales por defecto | **Alto** | `Hidromont-Admin-ChangeMe` + host `0.0.0.0` por defecto (SEC-H1). |
| Cabeceras de seguridad / CSP | **Medio** | `.htaccess` no aplica en Cloudflare; sin `_headers` ni CSP (SEC-M1). |
| CORS | **Medio** | Reflejo de toda la LAN con credenciales (SEC-M3). |
| Subida de archivos maliciosos | Mitigado | MIME+extensión+`sharp`, SVG bloqueado en uploads. |
| Dependencias vulnerables | Medio | 16 vulns en cadena de `@astrojs/check` (build-only). |
| Enumeración de usuarios | Bajo | Timing en login (SEC-L1). |

## 8. Auditoría de performance

**Fortalezas.** Sitio estático (TTFB mínimo), imágenes optimizadas a WebP con `srcset` en build, `loading="lazy"` por defecto en imágenes editables y en el iframe del mapa, `fetchpriority` configurable, `preload` de la fuente crítica, y cabeceras de cache agresivas para assets inmutables (`max-age=31536000, immutable`) con HTML a TTL corto en `.htaccess`. JS de cliente mínimo (solo `<script is:inline>` puntuales). Sin frameworks de UI hidratados.

**Riesgos Core Web Vitals.** Bajos. Atención a: (1) `favicon.svg`/`logo.svg` de ~142 KB y `logo.png` de ~316 KB en `public/` —pesados para assets de marca; (2) las cabeceras de cache solo aplican si el host las respeta (ver SEC-M1: en Cloudflare habría que replicarlas en `_headers`).

**Recomendaciones.** Comprimir/optimizar los logos, garantizar cache headers en el host real, y mantener `width/height` explícitos para evitar CLS.

## 9. Auditoría SEO

**Fortalezas.** `site` definido, `canonical` por página, Open Graph + Twitter Card completos, JSON-LD `Organization`, `sitemap-index.xml` y `sitemap-0.xml` generados, `robots.txt` con `Allow: /` y referencia al sitemap, `404` con `noindex`, slugs limpios, `lang="es-CL"`. Una sola `<h1>` por página en 20 de 21 páginas.

**Problemas.** `/contacto` sin `<h1>` (A11Y-M1) afecta también SEO on-page. El sitio público no expone páginas del CMS a buscadores (el CMS no se despliega).

**Recomendaciones.** Corregir el `<h1>` de contacto; considerar JSON-LD de `Service`/`BreadcrumbList` por página de servicio/proyecto. SEO técnico apto para indexación tras corregir el `<h1>`.

## 10. Auditoría de accesibilidad

**Fortalezas.** HTML semántico (`header`, `main`, `h1`–`h3`), `lang` correcto, `alt` presente en imágenes (no se detectaron `<img>` sin `alt` en el home), labels asociados a inputs en el formulario de contacto, honeypot oculto también para lectores de pantalla (`aria-hidden` + `tabindex="-1"`), mensajes de validación con `aria-live`, e `iframe` del mapa con `title` descriptivo.

**Problemas.** A11Y-M1: `/contacto` sin `<h1>` (jerarquía rota). No se evaluó contraste de color de forma automatizada.

**Recomendaciones.** Añadir `<h1>` a contacto; ejecutar una pasada con axe/Lighthouse para contraste y foco visible en todos los componentes interactivos.

## 11. Auditoría de dependencias y configuración

**Análisis.** `package.json` con scripts completos y claros (`dev`, `cms`, `dev:cms`, `build`, `preview`, `check`, `test`, `test:coverage`, `test:e2e`). `build` encadena `astro check && astro build` (type-check obligatorio). `tsconfig.json` extiende `astro/tsconfigs/strict` con `strictNullChecks` y alias `@/*`. `.env.example` documenta **todas** las variables con comentarios y advertencia sobre la contraseña por defecto. `.gitignore` excluye `.env`, `dist/`, `node_modules/`, `cms/data/` y `public/uploads/cms/`.

**Problemas.** CFG-M1 (deps de build en `dependencies`); SEC-M2 (vulns en cadena de tooling); DEP-L1 (`nanoid` fijado en `^3`, existe v5); QA-L1 (sin linter).

**Veredicto de reproducibilidad.** Un tercero **puede** instalar, configurar y desplegar siguiendo el `README.md` sin adivinar: requisitos, variables, comandos y flujo de publicación están documentados. Aprobado.

## 12. Testing y confiabilidad

**Existente.** 49 tests (Vitest) sobre auth, contenido, export, media y seguridad, cubriendo casos límite (credenciales inválidas, IDs duplicados, regex de slug, MIME no permitido, recursos inexistentes). Suite E2E Playwright (`e2e/cms-overlay.spec.ts`) para carga de páginas, navegación y flujo del overlay. `vitest.config.ts` redirige `CMS_UPLOAD_DIR` a un temporal para no ensuciar `public/`. Type-checking en cada build. Manejo de errores centralizado (`BaseController.handleError`, `errorTracking` con Sentry opcional + log estructurado a stderr).

**Faltante.** Cobertura de tests no medida en esta auditoría (existe script `test:coverage`). E2E no cubre el formulario público real ni estados de error del sitio. Sin linter.

**Confiabilidad.** Estados vacíos contemplados (fallbacks en `getCmsText`/`getCmsValue`), estados de error con `aria-live`, `404` con CTA. Buen nivel para el tamaño del proyecto.

## 13. Checklist de producción

| Área | Estado | Comentario |
|---|---|---|
| Build | Aprobado | `astro check` 0 errores; 21 páginas generadas; build reproducible con guard de `PUBLIC_WEB3FORMS_KEY`. |
| Seguridad | No aprobado | SEC-H1 (credenciales/bind por defecto del CMS) + SEC-M1 (cabeceras/CSP) pendientes. |
| CMS | No aprobado | Auth/CSRF/rate-limit/auditoría correctos, pero falta endurecer arranque (SEC-H1) antes de operar en red. No bloquea el sitio público. |
| SEO | Aprobado | Sitemap, robots, canonical, OG, Twitter, JSON-LD presentes; corregir `<h1>` de contacto (menor). |
| Performance | Aprobado | Estático, imágenes WebP, lazy-load, preload de fuente; optimizar logos y garantizar cache en el host. |
| Accesibilidad | No aprobado | `/contacto` sin `<h1>` (A11Y-M1); resto correcto. |
| Testing | Aprobado | 49 unit + E2E + type-check; sin linter. |
| Variables de entorno | Aprobado | `.env.example` completo; `.env` no rastreado; guard de build. |
| Documentación | Aprobado | `README.md` exhaustivo (instalación, uso del CMS, despliegue, seguridad). |
| Deploy | No aprobado | Ambigüedad de host: `.htaccess` (Apache) vs `_redirects` (Cloudflare) sin `_headers` (SEC-M1/DOC-L1). |

## 14. Acciones obligatorias antes de producción

1. **[Prioridad: Alta] Endurecer el arranque del CMS.** — Zona: `cms/server.ts`, `cms/config/unifiedConfig.ts`. Problema: SEC-H1 (contraseña por defecto + `CMS_HOST` `0.0.0.0`). Resultado esperado: el servidor **falla al iniciar** si la contraseña es la de por defecto y el host no es loopback; `CMS_HOST` por defecto pasa a `127.0.0.1`; sin `CMS_ADMIN_PASSWORD` no se puede operar en red.
2. **[Prioridad: Alta] Entregar cabeceras de seguridad en el host real.** — Zona: `public/_headers` (nuevo) o config del host. Problema: SEC-M1 (`.htaccess` no aplica en Cloudflare; sin CSP). Resultado esperado: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y una CSP básica presentes en las respuestas del sitio en producción; documentar el host en el README.
3. **[Prioridad: Media] Añadir `<h1>` a `/contacto`.** — Zona: `src/pages/contacto.astro`. Problema: A11Y-M1 (jerarquía de encabezados rota). Resultado esperado: una sola `<h1>` por página en las 21 páginas.
4. **[Prioridad: Media] Restringir CORS del CMS.** — Zona: `cms/middleware/security.ts`. Problema: SEC-M3 (reflejo de toda la LAN con credenciales). Resultado esperado: solo orígenes de `CMS_ALLOWED_ORIGINS` aceptados.
5. **[Prioridad: Media] Separar dependencias y parchear vulns.** — Zona: `package.json`. Problema: CFG-M1 + SEC-M2. Resultado esperado: tooling en `devDependencies` y `npm audit` sin altas.

## 15. Acciones recomendadas después de producción

- Igualar el tiempo de respuesta del login con un `bcrypt.compare` dummy (SEC-L1).
- Activar `Secure` en la cookie cuando el CMS se sirva por HTTPS (SEC-L2).
- Añadir ESLint + Prettier y un script `lint` al pipeline (QA-L1).
- Sacar del repositorio los assets en bruto y documentos pesados (REPO-L1); considerar Git LFS o almacenamiento externo.
- Medir cobertura de tests y ampliar E2E al formulario público y estados de error.
- Optimizar el peso de `logo.png`/`logo.svg`/`favicon.svg`.
- Enriquecer datos estructurados (`Service`, `BreadcrumbList`).
- Actualizar `nanoid` a una versión mayor reciente (DEP-L1).

## 16. Conclusión final

El proyecto demuestra una ingeniería de calidad por encima del promedio: arquitectura limpia, sitio de producción estático sin superficie de servidor, CMS con controles de seguridad reales, build validado y documentación completa. No tiene hallazgos críticos. Sin embargo, existe **un hallazgo Alto sin resolver** (endurecimiento del arranque del CMS) y una **brecha de cabeceras de seguridad** dependiente del host, además de una corrección de accesibilidad menor. Conforme a los criterios de esta auditoría, no puede declararse apto mientras persista el hallazgo Alto.

**El proyecto no está listo para producción.**
