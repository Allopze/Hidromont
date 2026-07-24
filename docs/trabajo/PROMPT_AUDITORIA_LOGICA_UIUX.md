# Prompt de Auditoría: Lógica/Funcionalidad + UI/UX Estética

> **Proyecto:** Hidromont Chile — Sitio web institucional + CMS propio  
> **Stack:** Astro 4 (output `static`) + Tailwind CSS + Fastify 5 CMS backend + SQLite  
> **Rama actual:** `fix/auditoria-p0-p1`  
> **Propósito del prompt:** Guiar una auditoría profunda que cubra dos dimensiones — (1) lógica de negocio, integridad de datos, flujos funcionales y manejo de errores; (2) calidad visual, interacciones, consistencia de marca y accesibilidad.

---

## Instrucciones generales

Eres un auditor técnico senior con doble especialización: **ingeniería de software** (claridad arquitectónica, corrección funcional, robustez) y **diseño de experiencia visual** (sistemas de diseño, micro-interacciones, jerarquía visual, brand craft). Tu tarea es auditar el proyecto **Hidromont Chile** en estas dos dimensiones y producir un informe estructurado con hallazgos clasificados por severidad.

### ⚠️ Verificación de regresión obligatoria

Antes de comenzar la auditoría, verifica que los siguientes hallazgos **Altos** de `AUDITORIA_PRODUCCION.md` estén corregidos:

1. **H1 — Overlay del CMS filtrado a producción:** Ejecuta `grep -r "data-cms-entry\|__HIDROMONT_CMS__" dist/ 2>/dev/null || echo "OK: no hay rastros del CMS en el build"`. Si hay coincidencias, el build contiene el editor visual (66 KB de JS inline + 58 atributos `data-cms-entry` por página). **Esto debe resolverse antes de continuar.**
2. **H2 — Cookie insegura con host expuesto:** Revisa `.env` o el entorno de ejecución: `CMS_HOST` no debe ser `0.0.0.0` sin `CMS_COOKIE_SECURE=1`.

Si H1 o H2 persisten sin resolver, detén la auditoría y escalar. La nota del proyecto no puede superar 7/10 mientras estos hallazgos estén abiertos.

### Formato del informe

El informe debe entregarse como un archivo Markdown (`AUDITORIA_LOGICA_UIUX.md`) en la raíz del proyecto, con esta estructura:

```markdown
# Auditoría de Lógica / Funcionalidad + UI/UX Estética

## 1. Resumen ejecutivo
[Puntaje general /10 y veredicto en una frase]

## 2. Dimensión A — Lógica y Funcionalidad

### A.1 Backend CMS
#### A.1.a Flujos CRUD
[Hallazgos sobre creación, lectura, actualización, eliminación de entradas, campos y media]

#### A.1.b Validación y Edge Cases
[Validación Zod, casos límite, entradas malformadas, concurrencia]

#### A.1.c Autenticación y Sesiones
[Login, logout, expiración, CSRF, rate limiting]

#### A.1.d Exportación y Publicación
[Flujo export → build, integridad de datos, errores de exportación]

#### A.1.e Galería
[CRUD de categorías e items, reorder, sync con media, featured]

### A.2 Frontend Estático
#### A.2.a Content Collections
[Schema Zod, proyección de datos en componentes, slugs, relaciones]

#### A.2.b Contact Form
[Validación cliente/servidor, estados de envío, manejo de errores, honeypot]

#### A.2.c Gallery
[Filtros, lightbox, lazy loading, srcset, LQIP, transiciones]

#### A.2.d Motion / Interactividad
[Scroll reveals, parallax, contadores, preferencias reduced-motion]

### A.3 Data Layer
#### A.3.a CMS Data (cms-content.json → getCmsText)
[Fallbacks, tipos, sincronización con CMS runtime]

#### A.3.b Static Data (gallery.json, project-images, nav, company)
[Integridad, consistencia con CMS, campos huérfanos]

### A.4 Testing
[Cobertura de tests unitarios y e2e, casos faltantes, CI/CD]

#### Preguntas guía:
- ¿Hay tests para `staticSite.ts` (path traversal en servir archivos)?
- ¿Hay tests para `exportService` con subdirectorios en slugs? ¿Slugs con caracteres especiales?
- ¿Hay tests para `galleryService` cuando se elimina un media usado por items de galería? (foreign key ON DELETE SET NULL)
- ¿Hay tests para el formulario de contacto? (validación de campos, estados de error, envío exitoso)
- ¿Hay tests para `contentService.importMissingEntries()`? ¿Idempotencia?
- ¿Hay tests para `rateLimitRepository.cleanup()`? ¿Eficiencia con muchas entradas?
- ¿La cobertura de tests incluye los mensajes de error definidos en los validadores Zod?
- ¿Hay tests e2e que verifiquen que `PUBLIC_ENABLE_CMS=0` produce un build sin atributos `data-cms`?
- ¿Hay CI/CD que ejecute estos tests automáticamente en cada PR?

## 3. Dimensión B — UI/UX Estética

### B.1 Sistema de Diseño y Tokens
#### B.1.a Colores
[Paleta primaria/secundaria, semántica, contraste, uso consistente]

#### B.1.b Tipografía
[Jerarquía, escalas fluidas, legibilidad, pairings]

#### B.1.c Espaciado y Layout
[Espaciado base, grid, containers, consistencia entre páginas]

#### B.1.d Bordes y Sombras
[border-radius: 0, uso de sombras, elevación]

#### B.1.e Motion
[Timing functions, duraciones, stagger delays, reduced-motion]

### B.2 Páginas y Componentes
#### B.2.a Home
[Hero, servicios grid, capabilities, instalaciones, proyectos destacados, clients strip, CTA]

#### B.2.b Servicios (index + detalle)
[PageHero, ServiceCard, grid, metodología, contenido Markdown]

#### B.2.c Proyectos (index + detalle)
[PageHero, ProjectCard, ProjectTable, ProjectFilters, banco de proyectos]

#### B.2.d Galería
[PageHero, GalleryGrid, Lightbox, filtros, metadata, LQIP]

#### B.2.e Empresa
[PageHero, métricas, instalaciones, maquinaria, medios de obra]

#### B.2.f Clientes
[ClientesHero, grid de logos, marquee, fallbacks]

#### B.2.g Contacto
[Layout split, formulario, mapa, info de contacto, estados]

#### B.2.h Header y Footer
[Navegación desktop/mobile, overlay scroll, footer map, datos de empresa]

#### B.2.i 404
[Mensaje, navegación de salida, tono de marca]

### B.3 Micro-interacciones
#### B.3.a Hover states
[Card lift, logo filters, nav items, botones, enlaces]

#### B.3.b Focus states
[Teclado, navegación ARIA, outline rings, skip-to-content]

#### B.3.c Transiciones de página
[Sin SPA, reveals al scroll, cinematic clip-path]

#### B.3.d Feedback táctil
[Active states en botones, touch feedback en galería]

### B.4 Responsive Design
#### B.4.a Breakpoints
[Comportamiento mobile/tablet/desktop, menú hamburguesa, grids responsivos]

#### B.4.b Imágenes responsivas
[srcset, sizes, object-fit, aspect ratios]

#### B.4.c Tablas y datos
[ProjectTable en mobile, scroll horizontal, listas alternativas]

### B.5 Accesibilidad
#### B.5.a Semántica HTML
[Landmarks, headings hierarchy, nav labels, roles ARIA]

#### B.5.b Contraste y Color
[WCAG 2.1 AA, text-on-photo, modo strong, enlaces]

#### B.5.c Teclado
[Focus order, focus trapping en lightbox, skip-to-content]

#### B.5.d Screen Readers
[Alt text, aria-live regions, aria-expanded, labels]

### B.6 Performance Visual Percibida
[Impacto de la carga en la experiencia, no métricas de laboratorio sino percepción del usuario]

#### Preguntas guía:
- ¿El build de producción contiene rastros del CMS inline? (`data-cms-entry`, `__HIDROMONT_CMS__`, clases `hm-cms-*`)
- ¿El peso del HTML de cada página es razonable para el contenido que muestra?
- ¿Hay fuentes preloadeadas correctamente? (RC-700 está, ¿Inter está?)
- ¿Las imágenes críticas (hero, LCP) tienen `fetchpriority="high"` y `loading="eager"`?
- ¿Los LQIP se renderizan correctamente antes de la imagen final?
- ¿El parallax y las animaciones de reveal afectan el Core Web Vital de Cumulative Layout Shift?

### B.7 Consistencia de Marca
#### B.7.a Tono y Voz
[UX copy, botones, CTAs, mensajes de error, empty states]

#### B.7.b Personalidad Visual
[Infrastructure scale, precision, industrial restraint]

#### B.7.c Fotografía vs Ilustración
[Uso de fotografía real de proyectos, calidad de imágenes]

#### B.7.d Localización (l10n)
- ¿Todo el texto visible está en español (Chile)?
- ¿Los formatos numéricos usan separador de miles con punto (`.`)? (ej: `11.000 m²`)
- ¿Los formatos de fecha usan locale `es-CL`? (ej: `Intl.DateTimeFormat('es-CL')`)
- ¿Los teléfonos usan formato chileno? (ej: `+56 43 32 84 14`)
- ¿No hay texto hardcodeado en inglés en componentes, mensajes de error o placeholders?

## 4. Cruce de Dimensiones
[Hallazgos que conectan lógica y UI/UX — ej: un error de validación que afecta la experiencia, un componente visual que oculta un problema funcional]

## 5. Matriz de Severidad

| Severidad | Definición |
|-----------|------------|
| **Crítico** | Bloquea funcionalidad o produce resultados incorrectos/no seguros. |
| **Alto** | Impacto significativo en la experiencia o corrección; debe resolverse antes del próximo hito. |
| **Medio** | Degrada la calidad pero no bloquea; resolver en el ciclo actual de desarrollo. |
| **Bajo** | Problema cosmetico o menor; resolver cuando sea conveniente. |
| **Informativo** | Observación o sugerencia de mejora. |

## 6. Conclusiones y Recomendaciones
[Resumen de los hallazgos más importantes por dimensión, puntaje final, acciones prioritarias]

```

---

## Contexto detallado del proyecto

### Stack y Arquitectura

```
hidromont-chile-web/
├── src/                    # Sitio estático Astro
│   ├── components/         # Componentes Astro organizados por dominio
│   │   ├── cms/            # EditableText, EditableImage, CmsOverlay
│   │   ├── clientes/       # ClientesHero
│   │   ├── contact/        # ContactForm, ContactInfo
│   │   ├── gallery/        # GalleryGrid, Lightbox
│   │   ├── home/           # Hero, CapabilitiesBlock, ClientsStrip
│   │   ├── layout/         # Header, Footer
│   │   ├── projects/       # ProjectCard, ProjectFilters, ProjectTable
│   │   ├── services/       # ServiceCard
│   │   └── ui/             # Button, Container, Section, PageHero, CTASection, Eyebrow, Badge, ArrowIcon
│   ├── data/               # Datos estáticos con CMS fallbacks
│   ├── layouts/            # BaseLayout, PageLayout
│   ├── pages/              # index, empresa, contacto, servicios/*, proyectos/*, galeria, clientes
│   ├── scripts/            # motion.ts (reveals, parallax, counters)
│   └── styles/             # tokens.css, base.css, motion.css, global.css
├── cms/                    # Backend Fastify + SQLite
│   ├── controllers/        # Auth, Content, Media, Publish, Gallery
│   ├── services/           # auth, content, media, gallery, publish, export, backup, image
│   ├── repositories/       # User, Content, Media, Gallery, PublishJob, Audit, RateLimit
│   ├── routes/             # cmsRoutes.ts — cableado único de rutas
│   ├── middleware/          # security.ts (CORS, requireAuth, requireCsrf)
│   ├── db/                 # connection.ts, schema.ts (11 tablas SQLite)
│   ├── validators/         # cms.schema.ts (Zod)
│   └── test/               # 65 tests unitarios
├── public/                 # Assets estáticos, fonts, logos, _headers, _redirects, robots.txt
└── e2e/                    # Tests Playwright
```

### Flujo de datos CMS

1. **Edición:** Overlay visual en el frontend → PATCH `/api/cms/entries/:id/fields/:key` → SQLite
2. **Exportación:** POST `/api/cms/export` → `exportService` escribe:
   - `src/data/cms-content.json` (todas las entradas/campos)
   - `src/data/gallery.json` (items + categorías de galería)
   - `src/content/proyectos/*.md` (proyectos como content collections)
   - `src/content/servicios/*.md` (servicios como content collections)
3. **Publicación:** POST `/api/cms/publish` → export + `npm run build` → build verificado
4. **Despliegue:** Manual a Cloudflare Pages (el CMS no deploya; solo exporta + valida)

### Sistema de tokens de diseño

- **Colores:** Primary `#0065A9`, Primary Dark `#004B7D`, Primary Light `#E6F2FA`, Accent `#00A6D6`
- **Neutrals:** Text `#1F2933`, Text Muted `#5B6770`, Border `#D9E2EC`, Background Strong `#0F2433`
- **Fonts:** `Roboto Condensed` (headings, swap), `Inter` (body, optional), `Roboto Mono` (mono, optional)
- **Border-radius:** `0px` en todos los tamaños (industrial aesthetic)
- **Motion:** Standard easing `cubic-bezier(0.2, 0, 0, 1)`, fast `120ms`, base `180ms`, slow `240ms`
- **Shadows:** sm `0 1px 2px rgba(15, 36, 51, 0.08)`, md `0 8px 24px rgba(15, 36, 51, 0.10)`, lg `0 16px 40px rgba(15, 36, 51, 0.14)`

### Principios de diseño (de PRODUCT.md)

1. **Infrastructure scale** — composiciones que se sientan tan grandes como las estructuras que Hidromont construye
2. **Precision over decoration** — cada elemento gana su lugar
3. **The project is the hero** — fotografía real de proyectos sobre ilustración
4. **Dual-register legibility** — directores hojean, ingenieros profundizan
5. **Industrial restraint** — azul marino oscuro, azul primario, border-radius cero

### Contenido del sitio

- **Servicios:** 8 líneas de servicio (tuberías forzadas, compuertas, válvulas, turbinas, limpiarrejas, montajes, tanques, infraestructuras)
- **Proyectos:** ~80+ proyectos ejecutados (destacados + banco), clasificados por categoría
- **Clientes:** ~25 empresas de sectores eléctrico, construcción, minero, sanitario, público, industrial
- **Galería:** Imágenes con LQIP, srcset, categorías, lightbox accesible
- **Empresa:** Historia, instalaciones (5 métricas), maquinaria (10 items), medios de obra (8 items)

---

## Guía detallada de auditoría

### Dimensión A — Lógica y Funcionalidad

Para cada sección, audita:

1. **Corrección:** ¿La lógica produce el resultado esperado en todos los casos?
2. **Edge cases:** ¿Qué pasa con entradas vacías, nulas, malformadas, duplicadas, extremas?
3. **Consistencia:** ¿El comportamiento es consistente entre componentes similares?
4. **Integridad de datos:** ¿Las operaciones mantienen la base de datos en estado consistente? ¿Transacciones?
5. **Manejo de errores:** ¿Los errores se capturan, registran y comunican adecuadamente? ¿Hay fallos silenciosos?
6. **Concurrencia:** ¿Qué pasa si dos operaciones ocurren simultáneamente? (rate limiting, sesiones)
7. **Seguridad:** ¿Hay vectores de ataque? (inyección, XSS, CSRF, path traversal, exposición de datos)

#### Áreas específicas a profundizar:

- **ContentService.importMissingEntries()**: ¿Qué entrada se considera "missing"? ¿Es idempotente? ¿Qué pasa si hay conflictos de slug?
- **AuthService.ensureAdminUser()**: Solo crea si no existe. ¿Qué pasa si se cambia `CMS_ADMIN_PASSWORD` después del primer arranque? (M2 en auditoría previa)
- **ExportService**: ¿Maneja correctamente subdirectorios en slugs? ¿Valida que los archivos exportados no sobrescriban contenido no CMS?
- **GalleryService**: ¿La sincronización con media_assets mantiene consistencia referencial? ¿Qué pasa si se elimina un media usado en galería?
- **PublishService**: ¿El job tracking es robusto ante crashes? ¿Los logs son completos?
- **Rate limiting**: ¿Se limpian las entradas expiradas? ¿El cleanup es eficiente?
- **ContactForm**: Validación duplicada (HTML5 + JS inline). ¿Hay discrepancia entre los mensajes de error definidos en el template y los usados en el script? ¿El honeypot funciona? ¿Qué pasa con el rate limiting de FormSubmit?
- **Motion module**: ¿Los IntersectionObserver se desconectan correctamente? ¿Hay memory leaks en navegación SPA (aunque Astro no es SPA)? ¿Parallax en elementos no visibles?
- **Content collections schema**: Los schemas Zod de `proyectos`, `servicios`, `clientes` — ¿Son correctos? ¿Cubren todos los campos usados en componentes?

### Dimensión B — UI/UX Estética

Para cada sección, audita:

1. **Consistencia visual:** ¿El componente sigue el sistema de diseño? ¿Hay desviaciones no intencionales?
2. **Jerarquía visual:** ¿La información más importante destaca primero? ¿Hay competencia visual?
3. **Contraste y legibilidad:** WCAG 2.1 AA mínimo (relación de contraste 4.5:1 texto normal, 3:1 texto grande)
4. **Estados:** ¿Hay hover, focus, active, disabled, loading, error, empty states bien resueltos?
5. **Responsive:** ¿Funciona en mobile, tablet, desktop? ¿Los layouts se rompen en algún punto?
6. **Micro-interacciones:** ¿Las transiciones se sienten naturales? ¿Los timing son consistentes?
7. **Brand alignment:** ¿Refleja la personalidad de marca (monumental, preciso, probado)?
8. **Fotografía:** ¿Las imágenes están bien recortadas, optimizadas, con alt text descriptivo?

#### Áreas específicas a profundizar:

- **PageHero:** El layout cinematic (45% texto + 55% imagen) — ¿funciona con textos largos/cortos? ¿La imagen parallax se ve bien en todos los viewports? ¿El scrim lateral izquierdo funciona?
- **ServiceCard:** Los SVG de iconos inline — ¿tienen el tamaño/viewBox correcto? ¿Se ven bien en high-DPI? ¿Los bullets se alinean correctamente?
- **ProjectTable:** En mobile se convierte en lista. ¿La transición entre layouts es suave? ¿Los chips técnicos (diámetro, acero, peso) son legibles?
- **GalleryGrid:** Grid uniforme 1→3→4 columnas. ¿El gap responsivo funciona? ¿Los LQIP se ven bien? ¿La animación de filtro (opacity + scale) es suave?
- **Lightbox:** Focus trapping, navegación por teclado, skeleton loader, precarga de vecinos. ¿El backdrop blur es performante? ¿La transición de opacidad es suficiente?
- **Header overlay:** Header transparente en home que se vuelve sólido al scrollear. ¿La transición es suave? ¿El filtro brightness(0) invert(1) del logo funciona en todos los navegadores?
- **ClientesHero:** El marquee de logos en la columna derecha. ¿La máscara de gradiente funciona en todos los navegadores? ¿Los logos blancos sobre fondo oscuro se ven bien?
- **ClientsStrip (home):** Marquee doble (izquierda/derecha). ¿La animación CSS keyframes es fluida? ¿Los logos en grayscale se ven bien? ¿El hover revive el color?
- **Contact form:** Los mensajes de error inline, loading spinner, success/error banners. ¿El estado de envío es claro? ¿Hay feedback para el usuario?
- **Footer:** El mapa embebido con filter invert. ¿Funciona consistentemente? Los enlaces a Google Maps y Waze.
- **Typography:** La escala fluida con `clamp()`. ¿Los tamaños se sienten correctos en todos los viewports? ¿La línea de altura (leading) es consistente?

---

## Metodología de auditoría

### Herramientas sugeridas

- **Lógica:** Inspección de código, revisión de tests, ejecución de build, playwright
- **UI/UX:** Lighthouse, axe DevTools, emulación responsive, inspección visual en Chrome/Firefox/Safari, capturas de pantalla comparativas

### Proceso

1. **Ejecutar build** (`npm run build`) y verificar que no hay errores
2. **Ejecutar tests** (`npm test`) y verificar que pasan 65/65
3. **Ejecutar tests e2e** (`npm run test:e2e`) y verificar que pasan
4. **Inspeccionar dist/** para verificar que no hay `data-cms-entry` ni `__HIDROMONT_CMS__` (contra H1)
5. **Revisar cada página** en navegador en 3 tamaños: 375px, 768px, 1440px
6. **Probar interacciones clave:** menú hamburguesa, filtros de galería, lightbox, parallax, contadores, formulario de contacto
7. **Verificar accesibilidad:** navegación por teclado, lector de pantalla (VoiceOver/NVDA), axe DevTools
8. **Revisar contraste:** Texto sobre fondos oscuros, text-on-photo, badges, chips, botones ghost sobre imágenes
9. **Comparar con existing audit:** `AUDITORIA_PRODUCCION.md` (nota 7/10) — verificar que los hallazgos H1 y H2 están resueltos

### Criterios de evaluación

| Dimensión | Peso sugerido |
|-----------|---------------|
| Corrección funcional | 30% |
| Robustez (edge cases, errores) | 20% |
| Consistencia visual y de marca | 20% |
| Interacciones y micro-detalles | 15% |
| Accesibilidad | 10% |
| Rendimiento visual percibido | 5% |

---

## Referencias clave

- **AUDITORIA_PRODUCCION.md** — Auditoría previa (nota 7/10, hallazgos H1 y H2 altos sin resolver)
- **PRODUCT.md** — Definición de producto, usuarios, personalidad de marca, principios de diseño
- **PROMPT_AUDITORIA_LOGICA_UIUX.md** — Este mismo documento

### Archivos a auditar con prioridad

| Prioridad | Archivo | Razón |
|-----------|---------|-------|
| 🔴 | `cms/services/contentService.ts` | Núcleo del CRUD de contenido |
| 🔴 | `cms/services/exportService.ts` | Integridad de datos exportados |
| 🔴 | `cms/services/authService.ts` | Seguridad de autenticación |
| 🔴 | `src/scripts/cms-overlay.js` | 66 KB de JS inline — hallazgo H1 de auditoría previa |
| 🔴 | `src/components/gallery/GalleryGrid.astro` | Componente visual complejo con lógica de filtros |
| 🔴 | `src/components/gallery/Lightbox.astro` | Accesibilidad + interacciones |
| 🔴 | `src/components/contact/ContactForm.astro` | Validación dual + UX de envío |
| 🟡 | `src/data/cms.ts` | Capa de datos con fallbacks |
| 🟡 | `src/styles/tokens.css` | Sistema de diseño |
| 🟡 | `src/styles/base.css` | Estilos base + utilidades |
| 🟡 | `src/styles/motion.css` | Sistema de motion |
| 🟡 | `src/scripts/motion.ts` | Lógica de reveals, parallax, counters |
| 🟡 | `tailwind.config.mjs` | Configuración de tema Tailwind |
| 🟡 | `cms/validators/cms.schema.ts` | Validación Zod |
| 🟡 | `cms/routes/cmsRoutes.ts` | Cableado de rutas + seguridad |
| 🟡 | `cms/services/galleryService.ts` | Sincronización con media, consistencia referencial |
| 🟡 | `cms/services/publishService.ts` | Job tracking, logs, robustez ante crashes |
| 🟢 | `src/data/gallery.ts`, `src/data/gallery.json` | Datos de galería |
| 🟢 | `src/data/nav.ts`, `src/data/company.ts` | Datos de navegación/empresa |
| 🟢 | `cms/db/schema.ts` | Esquema de base de datos |
| 🟢 | `cms/config/unifiedConfig.ts` | Configuración del CMS |
| 🟢 | `cms/middleware/security.ts` | Middleware de seguridad |
| 🟢 | `cms/staticSite.ts` | Path traversal, servir estáticos |

---

*Última actualización: 2026-07-18*
