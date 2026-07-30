> **⚠️ Documento histórico (DOC-4).** Esta auditoría (24-jul-2026) quedó desactualizada por el commit `a255dcb` (migración de galería a álbumes), que introdujo bugs críticos de interacción no cubiertos aquí (ver `JS-1`/`JS-2`/`ESTRUCT-1`/`ESTRUCT-2` en la auditoría posterior). La nota "9.5/10 — Listo para Producción" **no refleja el estado real en el momento en que se detectaron esos bugs**. Para el estado actual, ver el historial de commits `fix:` recientes y la auditoría integral más reciente.

# Auditoría UI/UX: Evaluación del Código Fuente vs. Directivas de la Skill (`allopze-ui-ux`)

**Sitio Web Corporativo e Infraestructura CMS**  
**Fecha de evaluación:** 24 de Julio de 2026  
**Auditor:** Especialista Senior UI/UX & Frontend Architecture  
**Repositorio:** `Hidromont Chile / pagina-web`  
**Skill de Referencia:** `allopze-ui-ux v1.0.0`

---

## 1. Contexto y Diagnóstico General

- **Superficie**: Sitio Web Corporativo B2B (Ingeniería Pesada e Infraestructura Hidráulica) + CMS In-Situ
- **Puntuación Global**: **9.5 / 10**
- **Veredicto**: **Listo para Producción** (Todas las correcciones críticas, alineación de tokens y reglas del sistema de diseño industrial de 0px han sido ejecutadas y verificadas con `npm run build` exitoso de 24 páginas).

Se ha realizado una inspección directa del código fuente frente a las directivas normativas de la skill `allopze-ui-ux` (_Jerarquía Visual_, _Sistema de Espaciado 8pt_, _Accesibilidad WCAG 2.2 AA_, _Objetivos Táctiles_, _Heurísticas de Nielsen_ y _Estética Industrial_).

---

## 2. Puntuación por Dimensiones

- **Usabilidad**: **9.5 / 10** — Modelos mentales claros, navegación consistente y prevención de errores en formularios.
- **Jerarquía Visual**: **9.5 / 10** — Estructura H1-H3 estricta, 1 único punto focal primario por vista y tipografía fluida `clamp()`.
- **Accesibilidad (WCAG 2.2 AA)**: **9.2 / 10** — Anillos de foco visibles (`focus-visible`), soporte para teclados/ARIA, `prefers-reduced-motion` y contraste $\ge 4.5:1$.
- **Responsividad & Táctil**: **9.5 / 10** — Enforzamiento explícito de $\ge 44 \times 44\text{px}$ en botones, filtros y toggles en móviles.
- **Consistencia Visual & Tokens**: **9.8 / 10** — Sitio público y script CMS 100% alineados a la estética industrial de 0px (`rounded-none` / `border-radius: 0px`).

---

## 3. Matriz de Contraste: Código Real vs. Directivas de la Skill

| Directiva de la Skill (`allopze-ui-ux`)                       | Regla Exigida                                                                                                       | Estado en el Código Fuente (`src/`) | Evidencia en Archivos                                                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------ | :---------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jerarquía Visual (`visual-design/hierarchy.md`)**           | 1 único punto focal Nivel 1 (`<h1>`) por vista; jerarquía semántica H1 $\rightarrow$ H2 $\rightarrow$ H3.           |           ✅ **CONFORME**           | En [Hero.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/home/Hero.astro#L63) y [PageHero.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/ui/PageHero.astro#L95) se renderiza un único `<h1>` por página (`index`, `empresa`, `servicios`, `proyectos`, `galeria`, `contacto`, `clientes`).                                                       |
| **Sistema 8pt Grid (`visual-design/spacing.md`)**             | Padding, margin y gap deben ser múltiplos de 8px (o 4px micro). Prohibidos valores aleatorios.                      |           ✅ **CONFORME**           | En [tokens.css](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/styles/tokens.css#L39-L52) los tokens `--space-1` a `--space-32` respetan la escala de 4px/8px. Tailwind aplica clases estándar `p-4`, `py-16`, `gap-6`, `gap-8`.                                                                                                                                                                |
| **Objetivos Táctiles (`responsive-design/touch-targets.md`)** | Elementos clicables deben medir $\ge 44 \times 44\text{px}$ en móviles para evitar errores de toque (Ley de Fitts). |           ✅ **CONFORME**           | [Button.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/ui/Button.astro#L28) (`min-h-[44px]`), [ProjectFilters.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/projects/ProjectFilters.astro#L20) (`min-h-[44px]`), [Header.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/layout/Header.astro#L145) (`w-11 h-11`). |
| **Foco y Teclado (`foundations/accessibility.md`)**           | Anillos de foco visibles (`focus-visible:outline`), navegación por teclado en modales y filtros ARIA.               |           ✅ **CONFORME**           | [Header.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/layout/Header.astro#L92) implementa `focus-visible:outline-primary`, [GalleryFilters.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/gallery/GalleryGrid.astro) soporta flechas de teclado (Radio Group).                                                                                 |
| **Prevención de Errores (`interaction-design/forms.md`)**     | Validación inline accesible, ARIA live regions, honeypot y rate limit contra spam.                                  |           ✅ **CONFORME**           | [ContactForm.astro](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/components/contact/ContactForm.astro) incluye `aria-describedby`, `aria-invalid`, honeypot `_honey` y control en `sessionStorage`.                                                                                                                                                                                           |
| **Soporte Vestibular (`foundations/accessibility.md`)**       | Respetar preferencia de usuario para movimiento reducido (`prefers-reduced-motion`).                                |           ✅ **CONFORME**           | Implementado en CSS global y en [motion.ts](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/scripts/motion.ts) pausando marquees y Ken Burns.                                                                                                                                                                                                                                                    |
| **Estética Industrial (Tokens 0px)**                          | Bordes rectos de 0px (`rounded-none`). `rounded-full` solo para dots decorativos o spinners.                        |           ✅ **RESUELTO**           | Todas las 28 reglas con `border-radius: 4px/6px/8px` en [cms-overlay.js](file:///Users/allopze/dev/Hidromont%20Chile/pagina-web/src/scripts/cms-overlay.js) fueron actualizadas a `border-radius: 0px` y color corporativo `#0065A9`.                                                                                                                                                                       |

---

## 4. Hallazgos Auditados y Resueltos

### [COD-001] Estilos in-line residuales con bordes redondeados y colores hexadecimales en `cms-overlay.js` — [RESUELTO]

- **Problema**: El script del CMS (`cms-overlay.js`) generaba dinámicamente elementos de edición con atributos `style="..."` conteniendo `border-radius: 4px/6px/8px` y colores hexadecimales desalineados.
- **Evidencia**: 28 líneas conteniendo `border-radius: 6px`, `border-radius: 8px` y `#2d9cdb`.
- **Principio Afectado**: Heurística #4 de Nielsen (Consistencia y Estándares) / Directiva de Sistema de Tokens (`visual-design/composition.md`).
- **Severidad**: Medio
- **Solución Implementada**: Se actualizaron todas las ocurrencias a `border-radius: 0px` y color primario de marca `#0065A9` en `src/scripts/cms-overlay.js`.
- **Estado**: ✅ **RESUELTO**

---

### [COD-002] Migración de colecciones de contenido a Astro Content Layer (`src/content.config.ts`) — [RESUELTO]

- **Problema**: Advertencia de deprecación en la configuración de colecciones de contenido para la versión actual de Astro.
- **Evidencia**: Eliminación de `src/content/config.ts` y creación de `src/content.config.ts` utilizando los loaders oficial de Astro `glob` y `file`.
- **Solución Implementada**: Creación de `src/content.config.ts` con parsers personalizados para proyectos, servicios y clientes.
- **Estado**: ✅ **RESUELTO**

---

## 5. Verificación de Compilación y Suite de Pruebas

- **TypeScript & Astro Check**: `npx astro check` $\rightarrow$ **0 errores, 0 advertencias** (108 archivos validados).
- **Build de Producción**: `npm run build` $\rightarrow$ **24 páginas estáticas compiladas exitosamente en `/dist` en 5.10s**.
