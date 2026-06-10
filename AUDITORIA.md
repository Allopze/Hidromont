# Auditoría UI/UX y CMS — Hidromont Chile S.A.

> **Fecha:** 2026-06-09 · **Alcance:** sitio público (Astro estático) + CMS propio (Fastify/SQLite + overlay visual) · **Referencia a11y:** WCAG 2.2 AA
>
> Reemplaza la auditoría técnica del 2026-05-29. Limitaciones: no se ejecutó el sitio en navegador ni Lighthouse; los contrastes se calcularon matemáticamente desde los tokens; no se puede verificar si `PUBLIC_WEB3FORMS_KEY` está configurada en el entorno de build de producción.

## 1. Resumen ejecutivo

**Estado general del sitio: bueno-muy bueno.** Arquitectura sólida: content collections tipadas con Zod, tokens de diseño, JS mínimo (solo menú, scroll-header y motion), fuentes auto-hospedadas con `font-display` correcto, SEO estructural (canonical, OG, JSON-LD Organization, sitemap), skip-link, `prefers-reduced-motion` respetado, estados vacíos previstos. El registro visual (azul industrial + navy + Roboto Condensed) es coherente con el brief y evita la estética SaaS genérica.

**Estado general del CMS: funcional pero con una brecha conceptual grave.** El overlay de edición inline es ingenioso (solo existe en dev, cero código CMS en producción — verificado por test E2E), con auditoría, revisiones, backups, rate-limit persistente y 46+ tests. Pero el botón «Publicar» **no publica**: exporta JSON/MD y corre `npm run check`; nadie reconstruye ni despliega el sitio estático. El badge «✓ Publicado» le miente al editor. Además el campo `status` (draft/published) **se ignora en el export**, y crear una entrada nueva desde el overlay produce contenido que rompe el build (sin campos requeridos por el schema Zod).

**Principales riesgos:** (1) editores creyendo que publicaron cambios que nunca llegan a producción; (2) formulario de contacto — única conversión del sitio — dependiente de una env var sin guard ni medición alguna; (3) submenú «Servicios» inaccesible por teclado; (4) contrastes bajo AA en breadcrumbs/footer y en el color accent sobre blanco; (5) deuda silenciosa: dependencias fantasma (`sharp`, `zod`, `nanoid`, `gray-matter` usadas sin declararse) y tokens duplicados en 3 sitios.

**Principales oportunidades:** cerrar el ciclo de publicación (export → build → deploy con un clic), instrumentar analítica mínima sobre CTAs/formulario, y subir el piso editorial (labels humanos, validaciones de longitud, dirty-check).

**Top 5 acciones recomendadas:**
1. Cerrar el ciclo publicar→deploy (o renombrar honestamente el botón y documentar el flujo real) — CMS-001/002/003.
2. Guard de build para `PUBLIC_WEB3FORMS_KEY` + página de error propia del formulario — FORM-001.
3. Submenú de servicios operable por teclado (`:focus-within` o disclosure con botón) — A11Y-001.
4. Corregir contrastes `white/40`, `white/30` y `accent` sobre blanco — A11Y-002/003.
5. Declarar dependencias fantasma en `package.json` — TECH-001.

## 2. Stack y estructura detectada

- **Framework:** Astro 4.16, `output: 'static'`, site `https://hidromont.cl`, integraciones `@astrojs/tailwind` + `@astrojs/sitemap` (`astro.config.mjs`).
- **Estilos:** Tailwind 3.4 + tokens CSS propios (`src/styles/tokens.css`) + base/motion CSS. Tipografía: Inter (body), Roboto Condensed (headings), Roboto Mono (datos), woff2 locales.
- **Contenido:** Content collections Zod (`proyectos` 37 entradas: 7 destacado/30 banco; `servicios` 6; `clientes` JSON) en `src/content/config.ts` + capa CMS `getCmsText()` sobre `src/data/cms-content.json` generado por export.
- **CMS:** Fastify 5 + better-sqlite3 en `cms/` (puerto 8787); overlay visual `src/scripts/cms-overlay.js` inyectado **solo en dev** vía `CmsOverlay.astro`; activación `?cms=1`.
- **Formulario:** Web3Forms (POST externo + redirect a `/contacto/gracias`).
- **Tests:** Vitest (46 CMS) + Playwright E2E (14, `e2e/cms-overlay.spec.ts`).
- **Deploy:** estático; hay `public/.htaccess` (Apache) **y** `public/_redirects` (Cloudflare Pages) — doble target, conviene confirmar cuál es el real.
- **Scripts:** `dev`, `cms`, `dev:cms`, `build` (= `astro check && astro build`), `cms:import/export/backup`, `test`, `test:e2e`.

## 3. Mapa de experiencia del sitio público

- **Rutas:** `/` · `/servicios` + 6 fichas · `/proyectos` + 7 fichas destacadas · `/empresa` · `/calidad` · `/clientes` · `/contacto` · `/contacto/gracias` · `/404`.
- **Flujo crítico:** Home (hero full-viewport con header transparente→sólido) → Servicios/Proyectos como prueba → CTA «Ponerse en contacto» → formulario → gracias. Único objetivo de conversión: el formulario (más `tel:`/`mailto:` en footer y contacto).
- **CTAs:** consistentes («Ponerse en contacto», «Contactar equipo técnico») vía `CTASection` reutilizado en todas las páginas. Bien.
- **Fricción detectada:** (a) chips de «filtros» en /proyectos que son anclas sin estado activo — prometen filtrar y solo hacen scroll; (b) tarjetas de proyecto destacado solo clicables en el link «Ver detalle», no en toda la tarjeta; (c) submenú Servicios inalcanzable por teclado; (d) breadcrumbs casi ilegibles (white/40 a 12px).
- **Jerarquía:** correcta (PageHero h1 → secciones h2 → bloques h3). El mensaje principal («Ingeniería, fabricación y montaje de equipos hidromecánicos… desde 1983») responde de inmediato qué hace la empresa.
- **Estados:** 404 correcto, empty-state para proyectos destacados en home, fallback text-pill para clientes sin logo. Bien cubierto.

## 4. Mapa de experiencia editorial del CMS

- **Tipos de contenido:** entries `page/layout/component/settings` (campos sueltos por sección, ej. `home.hero.title`) + `servicio`/`proyecto` (exportan a `.md` de collections). Media library con alt, focal point, usos (`media_usages`), checksum.
- **Flujo real de edición:** correr `npm run dev:cms` localmente → abrir el sitio con `?cms=1` → login → clic en elemento → editar → «Guardar» (SQLite) → «Publicar» (export a archivos + `npm run check`). **Para que llegue a producción alguien debe además hacer build + deploy + commit del JSON/MD** — esto no existe en el sistema ni está señalizado en la UI.
- **Riesgos para editores:**
  - Badge «✓ Publicado» tras export — el sitio público no cambió (`cms-overlay.js:1034,1159`).
  - `status: draft` no excluye del export (`cms/services/exportService.ts:14-20` filtra por `kind`/`version`, nunca por `status`) — el borrador "se publica".
  - «+ Nueva entrada» de servicio/proyecto crea entries sin los campos que exige el schema Zod (`titulo`, `resumen`, `icono`, `orden`) → al editar un campo (version>1) el export escribe un `.md` inválido y `astro check` revienta con un error críptico para un no-técnico.
  - Cerrar el panel o pulsar Escape descarta cambios sin confirmación (sin dirty-check, `cms-overlay.js:1249-1251`).
  - Labels = claves crudas (`item3Desc`, `card1Value`) sin descripciones ni ayuda contextual; el editor adivina.
  - El selector de archivo acepta SVG (`accept="...image/svg+xml"`, `cms-overlay.js:512`) pero el server lo rechaza (`cms/services/mediaService.ts:90`) — error tardío y confuso.
  - `richtext` es un textarea plano; al guardar texto, el overlay hace `element.textContent = value` y aplasta cualquier marcado hijo.
- **Validaciones faltantes:** `updateFieldSchema.value` es `z.unknown()` (`cms/validators/cms.schema.ts:17-20`) — sin tipo por campo, sin límites de longitud para títulos/CTAs/eyebrows que sí tienen presupuesto visual.
- **Positivo:** revisiones con restore + confirm, auditoría completa de mutaciones, rate-limit persistente, backups por API, CSRF + cookie httpOnly, MIME spoof-check en uploads, sync de media de `public/`, overlay ausente del build de producción (E2E lo verifica).

## 5. Hallazgos priorizados

| ID | Severidad | Área | Hallazgo | Evidencia | Impacto | Recomendación | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|---|
| CMS-001 | Crítica | CMS | «Publicar» exporta y valida pero no reconstruye/despliega; badge «✓ Publicado» miente | `cms/services/publishService.ts:49-91` (`publishCheckCommand: 'npm run check'`), `cms-overlay.js:1152-1163` | Editores creen publicado; producción no cambia; pérdida de confianza en el CMS | Encadenar build+deploy (hook a CI/Pages) o renombrar a «Exportar y validar» + texto explícito del paso pendiente | Medio | P0 |
| CMS-002 | Alta | CMS | `status` draft/published ignorado en export — borradores se publican | `cms/services/exportService.ts:11-23` sin filtro `status` | El concepto borrador es ficticio; contenido a medias llega al sitio | Filtrar `status === 'published'` en ambos exports; test de regresión | Bajo | P0 |
| CMS-003 | Alta | CMS | Entrada nueva de servicio/proyecto desde overlay carece de campos requeridos por Zod → export genera `.md` que rompe `astro check` | `cms-overlay.js:936-967` (form solo id/título/slug/status), `src/content/config.ts:11-52` exige `titulo,resumen,icono,orden` | Publicación bloqueada con error críptico; editor no puede autodiagnosticar | Plantilla de campos mínimos por kind al crear; validar contra schema antes de exportar | Medio | P1 |
| FORM-001 | Alta | UX/Conversión | Única conversión depende de `PUBLIC_WEB3FORMS_KEY`; sin guard de build, si falta la clave el form envía `access_key=""` y el usuario cae en error externo en inglés | `src/components/contact/ContactForm.astro:6,47`, `.env.example` | Pérdida total y silenciosa de leads | Fallar el build si falta la clave (assert en frontmatter); considerar envío AJAX con manejo de error propio | Bajo | P0 |
| A11Y-001 | Alta | Accesibilidad | Submenú «Servicios» del header solo abre con hover (`group-hover`); sin `:focus-within` ni patrón disclosure — teclado no llega a 6 páginas de servicio | `src/components/layout/Header.astro:110-135` | WCAG 2.1.1 (teclado); usuarios de teclado/AT dependen del footer | Añadir `group-focus-within:` o botón disclosure con `aria-expanded` | Bajo | P1 |
| A11Y-002 | Alta | Accesibilidad | Texto `white/40` (3.7:1) y `white/30` (2.7:1) sobre navy a 12px: breadcrumbs de PageHero, labels y legal del footer — bajo AA (4.5:1) | `src/components/ui/PageHero.astro:65`, `src/components/layout/Footer.astro:23,78-84` | WCAG 1.4.3; ilegible para baja visión | Subir a `white/70`+ (8.4:1) | Bajo | P1 |
| A11Y-003 | Media | Accesibilidad | Accent `#00A6D6` sobre blanco = 2.83:1 — falla incluso el umbral 3:1 de texto grande (métricas de empresa, badge ISO, «404») | `src/pages/empresa.astro:59,105`, `src/pages/calidad.astro:48-53`, `src/pages/404.astro:11` | Cifras clave (la "prueba" del sitio) poco legibles | En fondos claros usar `--color-primary`; reservar accent para fondos navy (5.4:1) | Bajo | P1 |
| TECH-001 | Alta | Frontend/CMS | Dependencias fantasma: `sharp`, `zod`, `nanoid`, `gray-matter` usadas pero no declaradas (resuelven por hoisting transitivo) | `cms/services/mediaService.ts:4-5`, `cms/validators/cms.schema.ts:1`, `cms/services/exportService.ts:3` vs `package.json` | Cualquier update de Astro puede romper el CMS sin tocar su código | `npm i sharp zod nanoid gray-matter` (declararlas) | Bajo | P1 |
| CMS-004 | Media | CMS | `updateField` acepta `z.unknown()` sin tipo ni longitudes máximas por campo | `cms/validators/cms.schema.ts:17-20` | Editores pueden romper layout (títulos kilométricos) o tipos (texto en number) | Validar tipo según `field.type` + maxLength por tipo (title 120, eyebrow 40, etc.) | Medio | P2 |
| CMS-005 | Media | CMS | Editor muestra claves crudas (`item3Desc`, `card1Value`) sin label humano ni descripción | `cms-overlay.js:611,953-958`; `cms/content/defaultContent.ts` sin metadatos de label | Edición a ciegas; errores de contenido | Añadir `label`/`help` por campo en el seed y mostrarlos en el panel | Medio | P2 |
| CMS-006 | Media | CMS | Sin dirty-check: Escape o «Cerrar» descartan edición sin confirmar | `cms-overlay.js:447-451,1249-1251` | Pérdida de trabajo editorial | Confirmar si hay cambios sin guardar | Bajo | P2 |
| CMS-007 | Media | CMS/UI | Logos de clientes con doble fuente de verdad: home (`ClientsStrip`) lee `clientes.json`, `/clientes` lee overrides CMS (`cliente-logos.ts`) | `src/components/home/ClientsStrip.astro:17,37` vs `src/pages/clientes.astro:63` | Editor cambia un logo y home no se entera | Unificar en `getClienteLogoByNombre()` también en el strip | Bajo | P2 |
| NAV-001 | Media | Arquitectura | Footer con enlaces hardcodeados que duplican el nav CMS-able (hrefs editables en header, fijos en footer) | `src/components/layout/Footer.astro:35-54` vs `src/data/nav.ts` | Drift de navegación al editar desde CMS | Derivar footer de `navItems`/colección servicios | Bajo | P2 |
| UI-001 | Media | UI/Mantenibilidad | Tokens triplicados: mismos hex en `tokens.css`, `tailwind.config.mjs` y dentro del bloque `typography` | `src/styles/tokens.css:1-22`, `tailwind.config.mjs:8-29,59-92` | Cambiar la marca exige tocar 3 archivos sincronizados | Tailwind leyendo `var(--color-*)` o generar config desde tokens | Medio | P2 |
| UX-001 | Baja | UX | «Filtros» de proyectos son anclas; prop `active` existe pero nunca se pasa — ningún chip se marca activo; anclas a categorías vacías no llevan a nada | `src/components/projects/ProjectFilters.astro:13`, `src/pages/proyectos/index.astro:100-108` | Promesa de filtrado incumplida; desorientación leve | Scroll-spy ligero o renombrar a "Ir a sección"; ocultar chips de categorías vacías | Bajo | P2 |
| UI-002 | Baja | UI | `group-hover:scale` muerto en ProjectCard (el `article` no tiene clase `group`); tarjeta no clicable en toda su superficie | `src/components/projects/ProjectCard.astro:22,31` | Hover prometido que no ocurre; target de clic pequeño | Añadir `group` + stretched-link en «Ver detalle» | Bajo | P2 |
| MOB-001 | Media | Mobile | Inputs del form a 14px (`--font-size-small`) → iOS hace zoom automático al enfocar | `src/styles/base.css:192-202` (`.form-input`), select/textarea `text-sm` en ContactForm | Salto de viewport molesto en el momento más delicado (conversión) | `font-size: 16px` en controles bajo 768px | Bajo | P1 |
| FORM-002 | Media | Accesibilidad/Conversión | Honeypot `botcheck` es un checkbox `sr-only` alcanzable por lectores de pantalla (solo `tabindex=-1`) | `src/components/contact/ContactForm.astro:52` | Usuario de AT que lo marque será descartado como spam silenciosamente | `aria-hidden="true"` + `display:none` (Web3Forms lo soporta) | Bajo | P1 |
| FORM-003 | Baja | Contenido | Microcopy contradictorio: label «Servicio requerido» + placeholder «(opcional)»; ContactInfo promete «puede adjuntar planos…» pero el form no tiene adjuntos | `src/components/contact/ContactForm.astro:130-137`, `src/components/contact/ContactInfo.astro:64-66` | Confusión y expectativa rota en pleno funnel | «Servicio de interés (opcional)»; reescribir la nota o añadir adjuntos | Bajo | P2 |
| SEO-001 | Media | SEO | Fichas de proyecto sin JSON-LD (servicio sí tiene) y sin `og:image` propia (todas comparten `og-default.jpg` pese a tener foto hero); sitemap incluye `/contacto/gracias` (noindex) | `src/pages/proyectos/[slug].astro:39-42`, `src/layouts/BaseLayout.astro:18`, astro.config sin `sitemap.filter` | Shares pobres en LinkedIn/WhatsApp (canal B2B real); señal inconsistente a buscadores | Pasar `image={heroImg.src}` y BreadcrumbList en fichas; `sitemap({ filter })` excluyendo gracias | Bajo | P2 |
| AN-001 | Media | Analítica | Cero analítica: ni pageviews ni eventos de CTA/submit/errores de formulario | grep `gtag\|analytics\|plausible\|posthog…` = 0 hits en todo el repo | Imposible saber si el sitio convierte o qué secciones funcionan | Plausible/GA4 + eventos: submit ok/error, clics CTA, tel/mailto | Bajo | P2 |
| OPS-001 | Media | Operación | Basura desplegable/repo: uploads de prueba `passwd-*.jpg` en `public/uploads/cms/` (van a producción), PDF catálogo 2018, `LOGOTIPO - Editado.png`, md sueltos en raíz | listado raíz del repo | Artefactos de test expuestos en prod; repo confuso | Limpiar uploads de prueba; mover materiales fuente a `/docs` o excluir | Bajo | P1 |
| SEC-001 | Baja | CMS/Seguridad | CMS binds `0.0.0.0` por defecto y solo *advierte* con password default; cookie sin flag `Secure`; CORS permite cualquier origen LAN privado | `cms/config/unifiedConfig.ts:25`, `cms/server.ts:8-19`, `cms/middleware/security.ts:14-36` | Aceptable como herramienta local; riesgo si alguien lo expone | Negarse a arrancar no-local con password default; `Secure`/SameSite configurables (ya en backlog CMS_FALTANTES) | Bajo | P3 |
| MOT-001 | Baja | Rendimiento percibido | Contenido `[data-reveal]` queda `opacity:0` si `motion.ts` falla tras setear `html.js` (el gate inline corre siempre, el observer puede no llegar) | `src/styles/motion.css:11-23`, `src/layouts/BaseLayout.astro:57` | Página parcialmente en blanco en fallos raros de carga JS | Fallback `setTimeout` que añada `.is-visible`, o setear `.js` desde motion.ts | Bajo | P3 |
| DES-001 | Mejora | Diseño visual | Eyebrow uppercase-tracked sobre *cada* sección — patrón saturado (tell genérico); botones sin feedback `:active` (scale 0.97) | `src/components/ui/Eyebrow.astro` usado ~20×, `src/components/ui/Button.astro:22-38` | Pierde distintividad; pulsaciones sin respuesta táctil | Variar cadencia de aperturas de sección; añadir `active:scale-[0.98]` | Medio | P3 |
| PERF-001 | Baja | Rendimiento | Fuentes de imagen pesadas en repo: `hero-home.png` 2.8 MB y `logo_hidromont.png` 1.8 MB (Astro las optimiza en build, solo afecta repo/build time); logos clientes PNG hasta 128 KB servidos tal cual | `src/assets/fotos/`, `public/logos-clientes/` | Build más lento; logos no optimizados sí se sirven | Convertir fuentes a tamaño razonable; logos a WebP ≤ 30 KB | Bajo | P3 |

## 6. Accesibilidad

**Fortalezas reales:** `lang="es-CL"`, skip-link visible al foco (`src/layouts/PageLayout.astro:22-27`), landmarks correctos (`header/nav/main/footer/aside`), labels reales en todo el formulario con errores `aria-live="polite"` + `aria-invalid` + focus al primer inválido, `aria-expanded/aria-controls` en el toggle móvil, menú móvil con `details/summary` (teclado OK), `prefers-reduced-motion` doble (global + motion.css), targets ≥44px en botones/inputs, iconos decorativos con `aria-hidden`.

**Problemas (detalle de A11Y-001/002/003 + adicionales):**
- **Teclado / WCAG 2.1.1:** dropdown desktop solo `group-hover` (`Header.astro:125`). Afecta usuarios de teclado y switch. Fix: `group-focus-within:visible group-focus-within:opacity-100` (1 línea) o disclosure button.
- **Contraste / WCAG 1.4.3:** breadcrumbs `text-white/40` 12px (3.7:1), footer `white/40`/`white/30` (3.7/2.7:1), accent sobre blanco (2.83:1 incluso como texto grande). El resto del sistema pasa: `text-muted` 5.6:1, `white/70` 8.4:1, `white/60` 6.6:1.
- **Honeypot accesible** (FORM-002): checkbox `botcheck` perceptible por AT → riesgo de descarte silencioso del mensaje.
- **Select sin mensaje de error asociado** (no es required — menor) y spinner del submit comunicado solo visualmente; el texto «Enviando...» sí queda en el DOM (aceptable).
- **Quick wins a11y:** las 3 primeras correcciones son cambios de clase CSS de minutos.

## 7. UI y sistema de diseño

- **Tokens:** sistema completo (color/spacing/radius/shadow/motion/containers) en tokens.css, **pero triplicado** en tailwind.config (UI-001). No hay dark mode (correcto para este registro — no es una falta).
- **Componentes base:** `Button` (4 variantes, focus-visible, disabled), `Badge`, `Eyebrow`, `Section`, `Container`, `PageHero`, `CTASection` — consistentes y bien reutilizados. `ServiceCard`/`ProjectCard` comparten patrón.
- **Inconsistencias:** ProjectCard sin `group` (UI-002); inline `style="font-size: var(--font-size-h2)"` repetido ~25 veces en vez de una clase utilitaria `.text-h2` — verboso pero coherente.
- **Anti-patrones:** sin gradient-text, sin glassmorphism, sin side-stripes. El tell presente es el **eyebrow en cada sección** (DES-001). El hero-metric pattern aparece suavizado (CapabilitiesBlock con valores en mono) y está justificado por el registro industrial.
- **Riesgo de escalabilidad:** páginas `empresa/calidad/servicios.index` llevan contenido editorial como arrays inline + 60-70 llamadas `getCmsText` por página — funciona, pero cada sección nueva exige tocar código (el "constructor de secciones" ya está en CMS_FALTANTES fase 3).

## 8. Responsive y mobile

- **Breakpoints:** uso disciplinado de `sm/md/lg` de Tailwind; grids colapsan razonablemente; `ProjectTable` tiene vista dual tabla/cards (duplica DOM ×37 proyectos — aceptable en estático, vigilar peso).
- **Menú móvil:** correcto (toggle 44px, details/summary anidado, CTA al final). No bloquea scroll del body al abrir — menor.
- **Riesgos:** (a) MOB-001 zoom iOS por inputs 14px; (b) header `h-24` (96px) + logo `h-20` consume mucho viewport móvil — considerar `h-16/h-20` bajo `lg`; (c) título display "hidromecánicos" a 42px en 320px roza el borde — verificar en device real; (d) tooltips `title=` en logos de clientes no existen en touch (info redundante, OK).
- **Táctil:** chips de filtro y nav links ≥40px de alto efectivo; correcto.

## 9. Formularios y conversión

- **Detectado:** un único formulario (contacto) — Web3Forms, honeypot, validación cliente custom con mensajes CMS-ables, estado loading en submit, redirect a `/contacto/gracias` (noindex). Sin newsletter/búsqueda.
- **Problemas:** FORM-001 (env var sin guard — P0), FORM-002 (honeypot AT), FORM-003 (microcopy contradictorio + promesa de adjuntos inexistente). Además: con `novalidate` y JS deshabilitado no hay validación alguna antes del POST externo; y si Web3Forms falla (5xx), el usuario ve la página de error de un tercero en inglés — sin manejo de error propio.
- **Riesgo de abandono:** formulario corto y bien etiquetado (bajo riesgo); el riesgo real es **pérdida silenciosa** (clave ausente, spam-flag del honeypot, error externo) sin ninguna medición (AN-001) que permita detectarlo.
- **Recomendación de conversión:** envío `fetch` con estados éxito/error inline (manteniendo el fallback POST), evento analytics en submit/error, y datos de contacto directo visibles también en el hero de contacto.

## 10. Integración frontend-CMS

- **Mecanismo:** `getCmsText/Number/Value/Image` (`src/data/cms.ts`) leen `cms-content.json` **en build**; todo campo tiene fallback hardcodeado en el call-site. Robusto por diseño: contenido faltante nunca rompe la página.
- **Costo del patrón:** los defaults viven duplicados en (1) las páginas Astro y (2) `cms/content/defaultContent.ts` del seed — dos fuentes que ya pueden divergir silenciosamente (el fallback solo se ve cuando el JSON no trae el campo).
- **Riesgos:** CMS-002 (status ignorado), CMS-003 (entries nuevas rompen build), CMS-007 (logos con doble fuente), tipado débil del JSON (`value: unknown` casteado con `as T` en `getCmsValue`).
- **Sin preview real:** el editor ve el cambio en su dev server (que ES el preview), pero no hay vista del sitio de producción vs editado; aceptable para el modelo actual si se arregla la semántica de «Publicar».
- **Recomendación:** filtrar por status en export, validar entries contra los schemas Zod de Astro antes de escribir `.md`, y generar tipos del JSON (`satisfies`) para que `getCmsText` con entry/field inexistente falle en CI.

## 11. Contenido, SEO técnico y social sharing

- **Base sólida:** title pattern `{página} | Hidromont Chile S.A.`, descriptions únicas por página, canonical autocalculado, OG/Twitter completos, `og:locale es_CL`, JSON-LD Organization global + Service/BreadcrumbList en fichas de servicio, sitemap + robots correctos, slugs legibles en español, `noindex` en 404/gracias.
- **Brechas (SEO-001):** fichas de proyecto sin BreadcrumbList/`og:image` propia — los 7 proyectos destacados son el mejor material compartible del sitio y todos comparten la misma imagen genérica; sitemap incluye página noindex (`/contacto/gracias`); `og:type` siempre `website` (las fichas podrían ser `article` — menor).
- **Headings:** jerarquía limpia; sin headings decorativos detectados.

## 12. Analítica UX

- **Eventos detectados: ninguno.** No hay tag de analítica, ni eventos de CTA, ni medición de errores/éxitos del único formulario (AN-001). No hay banner de cookies porque no hay tracking (coherente y legalmente cómodo).
- **Mínimo recomendado:** Plausible (sin consentimiento requerido) o GA4: pageviews, `contact_submit` / `contact_error`, clics en `tel:`/`mailto:`, clics CTA por sección, descargas si se publica el catálogo. Sin esto, cualquier decisión de rediseño es a ciegas.

## 13. Backlog recomendado

### P0 — Resolver de inmediato
| Prioridad | Tarea | Área | Impacto esperado | Esfuerzo | Dependencias |
|---|---|---|---|---|---|
| P0 | Cerrar o sincerar el ciclo de publicación (deploy hook o renombrar botón + doc del flujo) | CMS | Editores dejan de creer publicado lo que no lo está | Medio | Decidir hosting real (Apache vs CF Pages) |
| P0 | Filtrar `status==='published'` en exportService + test | CMS | Borradores dejan de filtrarse a producción | Bajo | — |
| P0 | Guard de build para `PUBLIC_WEB3FORMS_KEY` | Conversión | Elimina el modo de fallo silencioso del único canal de leads | Bajo | — |

### P1 — Alta prioridad
| Prioridad | Tarea | Área | Impacto esperado | Esfuerzo | Dependencias |
|---|---|---|---|---|---|
| P1 | Submenú Servicios accesible por teclado (`focus-within`/disclosure) | A11y | WCAG 2.1.1; 6 páginas clave alcanzables | Bajo | — |
| P1 | Contrastes: `white/40→/70`, `white/30→/60`, accent→primary sobre blanco | A11y | WCAG 1.4.3 en breadcrumbs, footer, métricas | Bajo | — |
| P1 | Declarar `sharp`, `zod`, `nanoid`, `gray-matter` en package.json | Deuda | CMS sobrevive a updates de Astro | Bajo | — |
| P1 | Honeypot oculto a AT (`display:none` + `aria-hidden`) | A11y/Conv | Sin falsos positivos de spam para usuarios AT | Bajo | — |
| P1 | Inputs ≥16px en mobile | Mobile | Sin zoom iOS en el formulario | Bajo | — |
| P1 | Plantilla de campos + validación Zod al crear entries (CMS-003) | CMS | «Nueva entrada» deja de poder romper el build | Medio | — |
| P1 | Limpiar `public/uploads/cms/passwd-*.jpg` y basura de raíz | Operación | Sin artefactos de test en producción | Bajo | — |

### P2 — Próximo ciclo
| Prioridad | Tarea | Área | Impacto esperado | Esfuerzo | Dependencias |
|---|---|---|---|---|---|
| P2 | Labels/ayudas humanos por campo + dirty-check en overlay | CMS | Edición sin adivinanzas ni pérdidas | Medio | — |
| P2 | maxLength/tipo por campo en `updateField` | CMS | Editores no rompen el layout | Medio | — |
| P2 | Unificar fuente de logos (strip+página) y footer derivado de nav | Arquitectura | Una sola verdad navegación/logos | Bajo | — |
| P2 | `og:image`+BreadcrumbList en fichas de proyecto; sitemap filter | SEO | Shares B2B decentes; señales coherentes | Bajo | — |
| P2 | Analítica mínima + eventos de conversión | Analítica | Medición del único objetivo del sitio | Bajo | Elegir Plausible/GA4 |
| P2 | Filtros de proyectos con estado activo (scroll-spy) o renombrar | UX | Promesa de UI cumplida | Bajo | — |
| P2 | Consolidar tokens (Tailwind ← CSS vars) | UI | Cambio de marca en un solo archivo | Medio | — |

### P3 — Nice to have
| Prioridad | Tarea | Área | Impacto esperado | Esfuerzo | Dependencias |
|---|---|---|---|---|---|
| P3 | `:active` scale en botones; variar cadencia de eyebrows | UI | Tacto y distintividad | Bajo–Medio | — |
| P3 | Fallback anti-blank para `[data-reveal]` | Robustez | Sin contenido invisible en fallos JS | Bajo | — |
| P3 | Optimizar fuentes de imagen del repo y logos PNG→WebP | Perf | Build y payload menores | Bajo | — |
| P3 | Cookie `Secure`/host check duro con password default | CMS/Seg | Endurecimiento si el CMS sale de localhost | Bajo | — |
| P3 | Editor richtext real (TipTap) — ya en CMS_FALTANTES | CMS | Cuerpos de servicio/proyecto editables de verdad | Alto | — |

## 14. Quick wins

1. **`group-focus-within` en el dropdown** — `Header.astro:125`. Beneficio: teclado accede a servicios. Riesgo si no: WCAG 2.1.1 + páginas clave invisibles para AT.
2. **Subir opacidades de texto sobre navy** — PageHero/Footer. Beneficio: AA en breadcrumbs/legal. Riesgo: ilegibilidad, exposición legal a11y.
3. **`status` filter en export** — `exportService.ts`. Beneficio: drafts reales. Riesgo: contenido a medias publicado.
4. **Assert de `PUBLIC_WEB3FORMS_KEY` en build** — ContactForm frontmatter. Beneficio: imposible desplegar un form roto. Riesgo: cero leads sin enterarse.
5. **`npm i sharp zod nanoid gray-matter`**. Beneficio: deps explícitas. Riesgo: rotura sorpresa del CMS.
6. **Borrar `passwd-*.jpg` de uploads** y mover PDF/PNG/md sueltos de la raíz. Beneficio: prod limpio. Riesgo: confusión/artefactos públicos.
7. **`display:none` al honeypot**. Beneficio: AT no pierde mensajes. Riesgo: leads descartados como spam.
8. **`font-size:16px` en form controls móviles**. Beneficio: sin zoom iOS. Riesgo: fricción en conversión móvil.
9. **`accept` del overlay sin SVG** (`cms-overlay.js:512`). Beneficio: error temprano coherente. Riesgo: frustración del editor.
10. **`image={heroImg}` como og:image en fichas de proyecto**. Beneficio: shares B2B con foto real. Riesgo: tarjetas genéricas en LinkedIn/WhatsApp.

## 15. Riesgos si no se corrige

- **Errores de publicación:** el riesgo #1 es organizacional — el CMS promete publicar y no publica; el día que un editor no-técnico lo use solo, habrá contenido perdido o un build roto (CMS-001/002/003).
- **Pérdida de conversión invisible:** un solo canal de leads, tres modos de fallo silencioso (clave, honeypot-AT, error externo) y cero medición.
- **Exposición a11y/reputacional:** fallos AA concretos y citables (contraste, teclado) en un sitio que vende precisión técnica.
- **Deuda técnica latente:** deps fantasma y tokens triplicados convierten mantenciones triviales en regresiones.
- **Carga editorial creciente:** sin labels, validaciones ni dirty-check, cada edición requiere acompañamiento de un desarrollador — exactamente lo que el CMS quería evitar.

## 16. Recomendaciones finales

**Días 0–30 (cerrar los modos de fallo):** los 3 P0 + los 7 P1. Es casi todo esfuerzo Bajo; un par de jornadas de trabajo enfocado. Decidir formalmente el hosting (Apache `.htaccess` vs Cloudflare `_redirects` — hoy hay config para ambos) porque condiciona el deploy-hook del CMS.

**Días 31–60 (subir el piso editorial y medir):** P2 de CMS (labels, validaciones, dirty-check), analítica con eventos de conversión, unificación logos/footer/tokens, SEO de fichas de proyecto. Al final de este ciclo, un editor no-técnico debería poder editar y publicar sin desarrollador y debería poder verse cuántos leads genera el sitio.

**Días 61–90 (pulir y escalar):** richtext real (TipTap), constructor de secciones (fase 3 de CMS_FALTANTES), refinamientos de motion/feedback (DES-001), revisión con datos de la analítica recién instalada, y re-auditoría de los puntos P1 para verificar cierre.
