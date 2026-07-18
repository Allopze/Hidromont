## Entregable

Redactar `AUDITORIA_LOGICA_UIUX.md` en la raíz del proyecto siguiendo la plantilla del prompt (16 secciones). Reporte **completo y exhaustivo**; H1/H2 quedan como hallazgos Altos bloqueantes y la nota final se topea en **7/10** (sin tocar código). Evidencia = análisis estático + comandos en vivo (build, tests unit, grep de `dist/`); **sin e2e ni capturas** (requieren servidor CMS corriendo y navegador).

## Fase 1 — Verificación en vivo (antes de escribir)

Comandos a ejecutar para obtener evidencia real, no asumida:
- `npm run build` → confirmar 24 páginas, sin errores de `astro check`.
- `npm test` → confirmar 65/65 unitarios pasan.
- `grep -rl "data-cms-entry\|__HIDROMONT_CMS__" dist/ | wc -l` → evidencia H1 (esperado: 24 archivos).
- `grep -c "data-cms-entry" dist/index.html` → densidad por página (esperado: ~58-61).
- `ls dist/*.html | wc -l` + tamaños de `dist/index.html`.
- `npm ls --depth=0 2>/dev/null | head` y revisar `package.json` (versiones de Astro/Fastify/Zod, presencia/ausencia de ESLint, scripts).
- Confirmar ausencia de `.github/workflows/` (M3).

## Fase 2 — Redacción del reporte

Estructura fiel a la plantilla del prompt. Hallazgos ya verificados que entraran al reporte (con `file_path:line` y severidad):

**§2 Dimensión A — Lógica/Funcionalidad**
- **A.1.a/b CRUD & validación**: capas limpias; Zod en todos los endpoints (`cms.schema.ts`); slugs admiten `/` + rechazan `..`. *Alto* — `exportService.ts:70,82` escribe `path.join(..., '${slug}.md')` sin `mkdirSync` recursivo → slug con subdirectorio (`tanques/316l`) lanza `ENOENT`. *Medio* — sólo se exportan entries con `version > 1`; entries recién creadas no se exportan sin un re-guardado.
- **A.1.a/b Galería — integridad referencial**: *Alto/Medio* — `schema.ts:118,128` `gallery_items.media_id NOT NULL` + `ON DELETE CASCADE` a `media_assets`; FKs activas (`connection.ts:14`). Borrar un media usado por galería **borra silenciosamente** los items de galería (el prompt asumía `SET NULL`; es peor: pérdida de datos). `mediaService.deleteMedia()` no advierte del cascade; `GalleryRepository.listItems` usa `INNER JOIN` así que huérfanos serían invisibles. Test faltante.
- **A.1.c Auth/sesiones**: bcrypt cost 12, CSRF doble token, rate limit login (10/60s). *Medio* — `authService.ts:13-25` `ensureAdminUser` retorna sin re-hashear si el usuario existe → cambiar `CMS_ADMIN_PASSWORD` tras el primer arranque no actualiza el hash (footgun M2). H2 (cookie insegura) como Alto bloqueante.
- **A.1.d Export/publicación**: *Medio* — `publishService.ts` abre job `'running'` y lo pasa a `'succeeded'`/`'failed'`, pero **no hay recuperación de crashes**: un proceso muerto a mitad de export deja el job en `'running'` para siempre; no hay sweep al arranque ni heartbeat ni estado `'aborted'`. `importMissingEntries()` (`contentService.ts:63`) sí es idempotente y nunca sobrescribe (correcto).
- **A.1.e Galería CRUD**: reorder featured OK; falta cobertura de test para la cascada de borrado de media.
- **A.2.a Content collections**: *Medio* — `servicios.orden: z.number()` **sin default** (`config.ts:52`) vs `proyectos.orden.default(100)` — un servicio sin `orden` rompe el build (contrato asimétrico). *Bajo* — contenido CMS huérfano `calidad.*` con `slug: /calidad` y **ninguna página** que lo renderice.
- **A.2.b Contact form**: honeypot OK (`_honey`, `aria-hidden`), validación JS con mensajes centralizados en JSON embebido (sin discrepancias), estados loading/success/error accesibles. *Medio* — sin rate limiting ni validación server-side propia; depende 100% de FormSubmit.co. *Bajo/Informativo* — fallback `PUBLIC_CONTACT_EMAIL` = Gmail personal (`ContactForm.astro:6`); `_captcha=false`.
- **A.2.c Gallery frontend**: filtros por `data-category`, LQIP blur-up, srcset/sizes, primeros 3 `eager`+`fetchpriority="high"`. *Bajo* — `Lightbox.astro:143` `collectImages()` lee `naturalWidth` de imagen posiblemente no cargada → default 1600×1200 puede dar aspect erróneo hasta cache.
- **A.2.d Motion**: `motion.ts` respeta `prefers-reduced-motion` en los 3 módulos; IntersectionObservers hacen `unobserve` pero **nunca `disconnect()`** (aceptable para sitio estático, no es leak real).
- **A.3 Data layer**: `cms.ts` getters con fallback **silencioso** (sin logging) y `getCmsValue` castea `as T` sin chequeo — *Bajo*. *Medio* — `nav.ts`: hrefs de navegación son CMS-editables vía `getCmsText` → un export defectuoso puede romper la navegación. *Bajo* — duplicación logos entre `clientes.json` y `cliente-logos.ts` (divergencia).
- **A.4 Testing**: 65 unit ✓, e2e Playwright ✓ (incl. test que verifica build sin `data-cms` en `e2e/cms-overlay.spec.ts:68`), pero **sin CI** (M3) que los ejecute. Tests faltantes para: cascade borrado media→galería, subdirectorios en slug, `rateLimitRepository.cleanup()`, idempotencia `importMissingEntries`.

**§3 Dimensión B — UI/UX**
- **B.1 Tokens**: sistema coherente; colores primarios `#0065A9`/dark/accent, neutrals, semánticos; escalas fluidas `clamp()`; motion con `--ease-standard`. *Bajo* — `borderRadius` tokens todos `0px` pero componentes usan `rounded-lg`/`rounded-full` (que **no** están en el override de Tailwind) → la estética "industrial sharp corners" se filtra en chips de ClientesHero, contenedor del mapa del Footer, ProjectFilters. *Bajo* — sin tokens de z-index (valores ad-hoc `z-10/20/50/100`).
- **B.1 Motion**: reduced-motion bien cubierto (`base.css:366` kill-switch global + `motion.css` + `motion.ts`). *Bajo* — CSS muerto en `Lightbox.astro:355-357` (`#lightbox[data-reduced-motion]`, atributo nunca seteado).
- **B.2 Componentes**: PageHero 45/55 con scrim y parallax bien resuelto; ServiceCard iconos SVG inline con fallback `pipe`; ProjectCard card-clickable vía pseudo overlay; ProjectTable dual desktop/mobile; ClientesHero marquee con `aria-hidden`; Header transparente→sólido con `group-focus-within` (teclado OK); Footer mapa con filter invert. *Bajo* — Header: el **dropdown desktop no expone `aria-expanded`** (sólo el hamburguesa móvil lo tiene).
- **B.3 Micro-interacciones**: hover card-lift, active `scale-[0.98]` táctil, focus-visible 3px en Button/Contact/Gallery/Lightbox. *Medio* — **`focus-visible` ausente en nav links del Header, ProjectFilters, enlaces del Footer, items del marquee** → usuarios de teclado sólo ven el outline por defecto del navegador.
- **B.4 Responsive**: grids responsivos, `sizes` correctos, `.form-input` min-height 44px + font 16px mobile (evita zoom iOS).
- **B.5 Accesibilidad**: `lang="es-CL"` ✓, skip-to-content ✓ (`PageLayout.astro:23`), landmarks y jerarquía de headings correctos, lightbox con focus trap + teclado. Pendiente: el gap de focus-visible anterior + falta `aria-expanded` en dropdown desktop.
- **B.6 Performance visual**: *Alto* — H1 mete ~66KB JS inline por página (~44% del HTML de la home). *Informativo* — Inter **no** se preloaded (`font-display: optional`, por diseño); RC-700 sí preloaded. Pendiente confirmar LCP con `fetchpriority="high"` en hero (sí está en PageHero y Hero).
- **B.7 Marca/l10n**: 0 strings en inglés hardcoded; `Intl`/`toLocaleString` usan `es-CL` consistentemente; tono de marca alineado a PRODUCT.md; parallax/fotografía real sobre ilustración. Sin hallazgos.

**§4 Cruce de dimensiones**
- `cms-overlay.js:917` `element.textContent = value` en save destruye markup anidado en `<EditableText as="h1">` con slot multi-nodo (cruce de lógica ↔ UI: el editor visual rompe la UI que edita). Informativo (no hay `<EditableText as="h1">` con slot complejo hoy, pero es un vector latente).
- Nav hrefs CMS-editables (lógica de datos) ↔ riesgo de navegación rota (UX).
- Cascade media→galería (lógica DB) ↔ items de galería que desaparecen sin aviso (UX/contenido).

**§5 Matriz de severidad** (tabla conforme al prompt).

**§6 Conclusiones**: nota topeada 7/10, veredicto "no listo para producción"; acciones priorizadas: 1) H1, 2) H2, 3) focus-visible a11y + cascade galería, 4) subdirectorios de slug + crash recovery publish, 5) CI/ESLint.

## Fase 3 — Entrega
- Escribir el archivo y reportar al usuario: score, bloqueantes (H1/H2 confirmados abiertos), top-5 hallazgos nuevos vs. `AUDITORIA_PRODUCCION.md` (cascade galería, subdirectorios slug, crash recovery publish, `servicios.orden` sin default, gaps de focus-visible), y nota de que e2e/capturas quedan fuera por scope.

## Notas
- No modificaré código ni `.env` (decisión del usuario: reporte topeado, no fixes).
- Corregiré dos supuestos del prompt con evidencia: el FK media→galería es `CASCADE` no `SET NULL`, y la nota está topeada por H1/H2 según su propia metodología.
- Toda afirmación de código llevará `file_path:line_number`.