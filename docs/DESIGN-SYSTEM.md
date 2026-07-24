# Sistema de Diseño

> Tokens, componentes y principios de diseño del sitio Hidromont Chile.
> Para la arquitectura técnica, ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Principios de marca (de PRODUCT.md)

1. **Infrastructure scale** — composiciones que se sienten tan grandes como las estructuras que Hidromont construye.
2. **Precision over decoration** — cada elemento gana su lugar; nada decorativo.
3. **The project is the hero** — fotografía real de proyectos sobre ilustración.
4. **Dual-register legibility** — directores hojean, ingenieros profundizan.
5. **Industrial restraint** — azul marino oscuro, azul primario, border-radius cero.

## Tokens (`src/styles/tokens.css`)

Fuente única de verdad, espejada en `tailwind.config.mjs`.

### Colores

**Primarios:**
| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#0065A9` | CTAs, links, acentos principales |
| `--color-primary-dark` | `#004B7D` | Headings, hover de primario |
| `--color-primary-light` | `#E6F2FA` | Fondos suaves, hovers de cards |
| `--color-accent` | `#00A6D6` | Detalles (dots, focus rings sobre oscuro) |

**Neutrals:**
| Token | Valor | Uso |
|---|---|---|
| `--color-text` | `#1F2933` | Body text |
| `--color-text-muted` | `#5B6770` | Texto secundario, captions |
| `--color-border` | `#D9E2EC` | Bordes de cards, dividers |
| `--color-surface` | `#FFFFFF` | Cards, inputs |
| `--color-background` | `#FFFFFF` | Fondo base |
| `--color-background-alt` | `#F5F8FA` | Secciones alternas |
| `--color-background-strong` | `#0F2433` | Footer, hero scrims, secciones dark |

**Semánticos:** success `#2E7D32`, warning `#B7791F`, error `#C62828`, info `#0065A9`.

### Tipografía

| Token | Familia | Uso |
|---|---|---|
| `--font-heading` | `"Roboto Condensed", Arial, sans-serif` | H1-H4, eyebrows, labels mono |
| `--font-body` | `"Inter", Arial, sans-serif` | Body text, párrafos |
| `--font-mono` | `"Roboto Mono", monospace` | Datos técnicos, specs, métricas |

**Carga de fuentes:**
- Roboto Condensed 700 (headings): **preloaded** en BaseLayout, `font-display: swap`.
- Inter variable (body): **preloaded**, `font-display: optional`.
- Roboto Mono 400/500 (mono): carga on-demand, `font-display: optional`.

**Escala fluida (clamp):**
| Token | Tamaño |
|---|---|
| display | `clamp(2.625rem, 5vw, 4rem)` |
| h1 | `clamp(2.375rem, 4vw, 3.5rem)` |
| h2 | `clamp(2rem, 3vw, 2.5rem)` |
| h3 | `clamp(1.35rem, 2vw, 1.6rem)` |
| h4 | `1.125rem` |
| lead | `1.125rem` |
| body | `1rem` |
| small | `0.875rem` |
| caption | `0.75rem` |

### Espaciado (base 4px)

`1→4px · 2→8 · 3→12 · 4→16 · 5→20 · 6→24 · 8→32 · 10→40 · 12→48 · 16→64 · 20→80 · 24→96 · 32→128`

### Border radius — industrial aesthetic (TODO 0px)

Todos los tokens `--radius-xs/sm/md/lg/xl: 0px`. En código fuente se usa **`rounded-none`** explícitamente (no se apoya en el override de tokens) para autodocumentar.

**Excepciones intencionales (`rounded-full`, documentadas en `tokens.css`):**
- Dots decorativos de bullet (`w-1.5 h-1.5`) en CapabilitiesBlock, ServiceCard, servicios/[slug], empresa.
- Spinner de carga del Lightbox (`w-8 h-8`).
- Success-badge circular de la página gracias (`w-16 h-16`, convención UX).

Todo lo demás (cards, botones, contenedores, inputs, chips, filtros) usa `rounded-none`.

### Sombras

| Token | Valor |
|---|---|
| `--shadow-sm` | `0 1px 2px rgba(15, 36, 51, 0.08)` |
| `--shadow-md` | `0 8px 24px rgba(15, 36, 51, 0.10)` |
| `--shadow-lg` | `0 16px 40px rgba(15, 36, 51, 0.14)` |

### Z-index (contrato de stacking)

| Token | Valor | Uso |
|---|---|---|
| `--z-base` | 0 | Default |
| `--z-raised` | 10 | Badges, dots que sobresalen |
| `--z-dropdown` | 20 | Menús desplegables |
| `--z-sticky` | 50 | Header sticky/fijo |
| `--z-overlay` | 100 | Skip-link, lightbox, overlays modales |
| `--z-toast` | 1000 | Notificaciones (reservado) |

### Motion

| Token | Valor |
|---|---|
| `--motion-fast` | `120ms` |
| `--motion-base` | `180ms` |
| `--motion-slow` | `240ms` |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |

Stagger delays en `motion.css` (reglas nth-child para `[data-reveal-group]`).

**`prefers-reduced-motion`:** kill-switch global en `base.css` + checks en `motion.ts` (reveals, parallax, counters) + Lightbox. Triple cobertura.

## Componentes UI (`src/components/ui/`)

### Button
- **Variantes:** `primary` (sólido), `secondary` (outline), `secondary-light` (outline blanco sobre fotos), `link` (texto + underline).
- **Tamaños:** `md` (min-h 44px), `lg` (min-h 52px).
- **Estados:** hover (primary→dark), `active:scale-[0.98]`, `focus-visible:outline-3`, disabled por variante.
- **Tag:** `<a>` si `href`, sino `<button>`.

### PageHero (cinematic)
- Layout 45% texto + 55% imagen, `min-height: clamp(380px, 50vw, 580px)`.
- Breadcrumbs, badge de categoría opcional, accent line, h1 display, subtitle.
- Parallax suave en la imagen (`data-parallax="0.04"`).
- Scrim lateral izquierdo + fade inferior.
- Modo text-only (sin imagen) para páginas como contacto.

### Section / Container
- `Section`: variantes `default`/`alt`/`strong`, padding `normal`/`tight`/`hero`.
- `Container`: tamaños sm 640 / md 768 / lg 1024 / xl 1200 / 2xl 1320.

### Eyebrow / Badge / ArrowIcon
- `Eyebrow`: caption, uppercase, tracking, variante `light` para dark sections.
- `Badge`: default/accent/muted.
- `ArrowIcon`: 16×16 SVG, `aria-hidden`, `currentColor`.

### CTASection
- Section strong, centrado, h2+subtitle CMS-bound, primary button + secondary-light opcional.

## Componentes de dominio

- **home/Hero**: full-bleed `min-h-[100dvh]`, imagen eager/high-priority, gradiente superior para header, scroll indicator.
- **home/CapabilitiesBlock**: dos layouts (métricas con contadores animados que respetan separador chileno `3.000 m²`, o lista zig-zag).
- **home/ClientsStrip**: marquee doble (izq/der) con edge-fade mask, logos grayscale→color en hover.
- **services/ServiceCard**: iconos SVG inline mapeados por key (`pipe|gate|valve|turbine|rack|crane|infrastructure|tank`), fallback `pipe`, bullets capped a 4.
- **projects/ProjectCard**: destacados con foto 16:9; card-clickable vía pseudo overlay.
- **projects/ProjectTable**: dual desktop (`<table>`) / mobile (lista stacked), chips mono.
- **projects/ProjectFilters**: anchor-based (no JS), `role="radiogroup"`.
- **gallery/GalleryGrid**: grid uniforme 1→3→4 cols, LQIP blur-up, srcset/sizes, primeros 3 eager+high-priority.
- **gallery/Lightbox**: focus trap, teclado (Esc/arrows), swipe táctil, preload vecinos, skeleton.
- **layout/Header**: dual-mode (overlay transparente en home / sticky blanco en internas), dropdown desktop vía `group-hover`+`group-focus-within` con `aria-expanded` sincronizado, mobile con `<details>`/`<summary>`.
- **layout/Footer**: iframe de Google Maps con `filter: invert` para dark-modear, botones a Maps/Waze, 3 columnas de nav.

## Localización (l10n)

- `<html lang="es-CL">`, `og:locale: es_CL`.
- `Intl.DateTimeFormat('es-CL')` y `toLocaleString('es-CL')` en motion.ts (contadores) y cms-overlay.js (fechas).
- Separador de miles chileno (`.`) respetado en `parseMetric` de CapabilitiesBlock.
- 0 strings en inglés hardcodeados en componentes/layouts/pages.
- Teléfonos y direcciones en formato chileno.

## Accesibilidad

- Landmarks semánticos, un H1 por página.
- Skip-to-content (`PageLayout`, `href="#main"`).
- `focus-visible:outline` consistente en Button, Header nav, Footer, ProjectFilters, Gallery, ContactForm, Lightbox.
- Focus trap en Lightbox (inert al resto, tab cycling, restore al cerrar).
- `aria-expanded` en dropdown desktop del Header (sincronizado por JS).
- `aria-live` regions en ContactForm (success polite, error assertive).
- `prefers-reduced-motion` triple-cubierto.
- `alt` obligatorio en items de galería (Zod `min(1).max(500)`).

## Referencias

- [`tokens.css`](../src/styles/tokens.css) — valores canónicos.
- [`tailwind.config.mjs`](../tailwind.config.mjs) — espejo de tokens en Tailwind.
- [`base.css`](../src/styles/base.css) — reset, fonts, utilidades, animaciones.
- [`motion.css`](../src/styles/motion.css) — reveals, parallax, cinematic.
