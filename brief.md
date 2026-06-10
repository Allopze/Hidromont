# Hidromont Chile S.A. — Design Brief

## Register
**Brand** — corporate website. The interface is the experience. Every page earns trust through industrial precision, not decoration.

## Users & Context
- **Primary**: Engineers, project managers, procurement officers at dam operators, hydroelectric plant owners, government infrastructure agencies, and EPC contractors.
- **State**: Evaluating a specialized industrial contractor. They need proof of technical capability, past project experience, and production capacity.
- **Language**: Spanish (Chile), with technical Spanish terminology for hydro-mechanical equipment.

## Product Purpose
Hidromont Chile S.A. designs, fabricates, and installs hydro-mechanical equipment (penstocks, gates, valves, turbines, trash racks) for dams and hydroelectric plants. The website communicates technical credibility, production capacity, project track record, and the company's 40+ year history. The site also serves as a CMS-driven editable surface so non-technical staff can update content.

## Voice
- **Industrial precision** — concrete, specific, factual. Numbers and specs matter.
- **Technical authority** — the writing assumes the reader knows what a penstock or a turbine is.
- **Serious and grounded** — no marketing fluff, no exaggerated claims, no startup energy.
- **Confident but not loud** — the company has been doing this since 1983; they don't need to shout.
- **Physical descriptors**: steel, concrete, water, heavy, precise, grounded, durable.

## Anti-References
- ❌ Generic SaaS landing pages (centered hero, gradient blobs, emoji, startup tone)
- ❌ Tech startup aesthetic (purple/blue gradients, rounded everything, animated illustrations)
- ❌ Overly decorative motion (bounce, elastic, parallax-heavy)
- ❌ Marketing superlatives and buzzwords
- ❌ Lightweight, playful, or consumer-facing tone
- ❌ Dark-mode-only terminal aesthetic — this is industrial, not developer-tool

## Composition Defaults
Each screen picks one dominant work pattern:

- **Decide** — Home page. The hero makes the case, capabilities and projects provide proof, the CTA asks for contact.
- **Learn** — Service pages, Empresa, Calidad. Article flow with progressive sections.
- **Explore** — Projects index. Searchable, filterable, browsable portfolio.
- **Configure** — Contact form. Grouped fields with clear commit action.
- **Compare** — Project tables, equipment lists. Tables and matrices.

Avoid: centered hero with no lateral tension, card grids that could belong to any industry, pill-style filter controls as the default, wrappers that add no structure.

## Visual Foundation

### Color
- Primary: `#0065A9` (industrial blue, not SaaS blue-violet)
- Primary dark: `#004B7D`
- Accent: `#00A6D6` (used sparingly for highlights, data callouts, eyebrow labels on dark)
- Surface strong: `#0F2433` (deep navy — the dramatic section background)
- Neutrals: white `#FFFFFF`, alt `#F5F8FA`, muted text `#5B6770`
- Commitment level: **Statement** — one saturated blue owns a significant portion of the surface. The accent stays rare.
- Dark sections alternate with light to create rhythm and visual weight.

### Type
- Headings: Roboto Condensed (bold, condensed industrial feel, tight letter-spacing)
- Body: Inter (clean, readable, modern)
- Data/metrics: Roboto Mono (numbers read as precise, technical, measured)
- Scale: Fluid clamp from display (4rem) down to caption (0.75rem)
- Measure: Body text constrained to readable widths via max-w-prose or container sizes

### Spacing & Layout
- Base grid: 4px
- Sections alternate: default (white) → alt (light gray) → strong (dark navy)
- Dark sections create gravity and anchor the page rhythm
- Hero: full viewport height, photograph with directional gradient overlay, left-aligned text
- Cards: used for discrete, self-contained units (services, projects, metrics). Not decorative.

### Motion
- Scroll-triggered reveals with stagger cascade (0.48–0.52s, cubic-bezier out)
- Progressive enhancement: `.js` class gates all animations; content is visible without JS
- Prefers-reduced-motion respected globally
- No bounce, no elastic, no decorative parallax on content
- Motion serves hierarchy, not spectacle

### Photography
- Real industrial photography (workshop floors, machinery, penstock fabrication, dam sites)
- Not stock photography, not illustrations, not 3D renders
- Images carry the burden of proof — they show the company actually doing the work

## Accessibility
- All focus states visible and consistent (3px outline, offset, color-contrast)
- Touch targets ≥ 44px
- Labels always visible (no placeholder-only inputs)
- Spanish-language content with correct `lang="es-CL"` and semantic HTML
- Reduced motion: instant visibility, no animation

## Component Conventions
- Buttons: three variants (primary filled, secondary outlined, secondary-light for dark backgrounds), two sizes (md, lg)
- Section: three background variants (default, alt, strong) with consistent padding rhythm
- Eye brow: uppercase, wide tracking, primary color (accent on dark), small label above headings
- Page hero: internal-page variant with optional image, breadcrumbs, consistent with home hero
- Editable text/image: CMS overlay wraps all content fields for non-technical editing

## Technology
- Astro 4 with Tailwind CSS 3
- Design tokens in `src/styles/tokens.css` (CSS custom properties)
- Tailwind config mirrors tokens for utility-class usage
- Fonts self-hosted as woff2 (Inter VF, Roboto Condensed, Roboto Mono)
- Motion in `src/styles/motion.css` with progressive enhancement
- CMS overlay (`CmsOverlay.astro`) for in-context content editing
