# Hidromont Chile — Design Review

**Register**: Brand (corporate website)  
**Date**: 2026-06-09  
**Scope**: Full site — home, empresa, calidad, servicios (index + detail), proyectos (index + detail), clientes, contacto, 404, gracias

---

## Overall Score: 32/50

**Verdict**: Capable but incomplete. The visual direction is coherent and the brief's anti-references are mostly honored. The first impression works. But the interface breaks where it matters most: loading, empty, and touch interaction states are missing. It reads as a well-composed static brochure, not as a complete interactive surface.

---

## Heuristic Scores

| # | Lens | Score | Key Finding |
|---|------|-------|-------------|
| 1 | First Impression | 7/10 | Strong hero with real photography and directional overlay. Industrial blue palette is differentiated. But the PageHero treatment is identical across all 7 internal pages, creating mechanical sameness. |
| 2 | Hierarchy | 7/10 | Eyebrow → H2 → subtitle pattern is clear and consistent. Section-level rhythm (default/alt/strong) is well-paced. Dense content pages (empresa, service detail) lose typographic distinction between subsections. |
| 3 | Color Voice | 7/10 | `#0065A9` industrial blue is purposeful, accent `#00A6D6` is genuinely used sparingly. Dark sections (`#0F2433`) create gravity. State-based color variation is minimal — cards have only border + shadow transition, no color response. |
| 4 | Type Voice | 6/10 | Font choices are domain-appropriate: Roboto Condensed (industrial), Inter (body), Roboto Mono (metrics). But execution is uniform: same line-height for all contexts, tight letter-spacing on condensed headings pushes legibility, no measure guard on wide containers. |
| 5 | Interaction Feel | 5/10 | Focus rings, hover states, and disabled buttons are covered. But there are no loading states anywhere, empty states are conditional blocks that vanish, touch devices can't operate dropdown nav, and keyboard navigation is incomplete. |

---

## First Impression

The home hero makes the category visible immediately: full-viewport industrial photograph of a workshop floor, directional gradient overlay (navy at 88% → transparent), left-aligned headline in Roboto Condensed Bold. The visitor knows within 2 seconds this is an industrial contractor, not a SaaS company. That's the brief working.

The dark navy sections (`#0F2433`) alternate with white and light gray, creating a downward rhythm that reads as deliberate section punctuation rather than random color switching. The accent blue `#00A6D6` appears only on eyebrow labels in dark sections and metric values — it stays rare enough to carry meaning.

**What holds this back from 8–9**: The internal PageHero template is mechanically identical across 7 pages — same subtle grid background, same left-aligned text, same right-aligned image panel (when present). The pattern is good once, but repeated unchanged it signals "website template" rather than authored pages. The brief says "earns trust through industrial precision, not decoration," but precision means variation where the content demands it — not uniformity where content differs.

---

## Hierarchy

The section-level rhythm is the strongest structural choice: every page uses the same Section component with three backgrounds (`default` → white, `alt` → light gray, `strong` → dark navy). This creates a predictable, scannable framework. An engineer evaluating the company can scroll any page and immediately know where sections begin and end.

The eyebrow label pattern (`Eyebrow` component: uppercase, tracking 0.08em, primary or accent color) consistently marks section introductions. H2 headings follow, then body-lg subtitles. This 3-tier pattern (hook → bridge → detail) is executed on every section.

**Problems**:

- **Flat internal hierarchy on dense pages.** `empresa.astro` has two side-by-side columns (historia text + metrics cards), then instalaciones cards, then two more side-by-side sections (maquinaria + medios de obra). The transition from one content block to the next relies entirely on section borders. There's no typographic differentiation between "this is primary narrative" and "this is supporting specification."
- **Card grid sameness.** Service cards and project cards both use 3-column grids, both have border + rounded corners + hover shadow + hover lift. They serve different purposes (service selection vs. proof display) but the visual treatment doesn't signal that difference. Project cards have images and badges, service cards have icons and bullets — the distinction is in the data, not the compositional framing.
- **CTA sections create mechanical predictability.** After the previous tokenize pass extracted the CTA pattern into a component, it's now consistent. But appearing at the bottom of 7 pages with identical structure creates a "footer template" feeling. The brief calls for Decide composition on the home page — the CTA there should feel like the climax, not the 7th identical instance.

---

## Color Voice

The palette succeeds at the brief's core demand: it's not SaaS blue-violet. `#0065A9` is an industrial blue — slightly desaturated, closer to steel than to tech. `#0F2433` is a deep navy that reads as heavy and serious. The alternation between light and dark sections creates genuine visual rhythm.

**What works**:
- Accent `#00A6D6` is genuinely rare. It appears on dark-section eyebrow labels and metric value numbers. It never competes with primary.
- The hero overlay gradient (left-heavy navy → transparent) directs the eye to the left-aligned text while still showing the photograph. This is a legitimate layout decision, not a decorative filter.
- The technical grid motif on PageHero (48px grid at 3% opacity) is subtle enough to provide texture without calling attention to itself.

**Problems**:

- **State color is missing.** The Button component handles hover (primary → primary-dark) and disabled (greyed out). But card hover changes only border-color and shadow — there's no color transition. On service cards, the icon stays primary throughout. A subtle accent reveal or primary-light background on hover would make the interaction feel responsive rather than just mechanical.
- **The form error state uses `#C62828` (border-error) which gets applied via JS.** The red is a standard error red — it works for validation but doesn't tie to the palette. A slightly warmer, brand-tinted error (e.g., one step toward the industrial blue's warmth) would feel more authored.
- **No dark-mode or preference response.** The site is light/dark hybrid (some sections dark, some light) by design, which is valid. But there's no `prefers-color-scheme` handling for system-level dark mode — the site ignores the user's OS preference entirely.

---

## Type Voice

The font pairing is one of the strongest decisions: Roboto Condensed Bold for headings (condensed, industrial, efficient), Inter for body (clean, modern, readable), Roboto Mono for data/metrics (numbers read as precise). This is a three-font system where each font has a clear role. The brief's "industrial precision" voice is legible in the type choices.

**What works**:
- Fluid clamp sizes (display: 2.625rem–4rem, h1: 2.375rem–3.5rem) prevent text from feeling static. The site reads at the right size on every viewport.
- The prose plugin in tailwind.config.mjs is carefully configured: table headers get primary-light backgrounds, links get primary with underline offset, headings get the heading font. This means MDX content renders with the same typographic voice as the rest of the site.
- Eyebrow labels at `font-size-caption` (0.75rem) with 0.08em tracking and uppercase create genuine micro-hierarchy.

**Problems**:

- **Line-height is uniform.** Body text uses `line-height: 1.6` globally, regardless of context. On `body-lg` (1.125rem) this creates ~1.8rem line boxes — airy and comfortable for reading paragraphs. But the brief's voice is "dense, grounded, durable." The type should feel slightly tighter, more concentrated. Short-form text (subtitle, card descriptions) doesn't need the same breathing room as long-form prose.
- **Letter-spacing on condensed headings is too tight.** Roboto Condensed is already a narrow typeface. Adding `-0.01em` on all headings and `-0.02em` on the hero display pushes it into territory where character distinction degrades, especially on Spanish text with accented characters (ó, í, á, é, ú). At the hero's 4rem size, `-0.02em` is negligible, but at h3 size (~1.75rem), `-0.01em` actively reduces legibility.
- **No measure constraint on wide text.** The Container component goes up to `max-w-wide` (1320px), and body text in those containers can span 90+ characters. The prose plugin constrains `.prose` content, but non-prose text blocks (EditableText paragraphs, service descriptions) have no max-width. The brief specifies 60–76ch for body measure, which is not enforced.
- **Light-on-dark text gets no compensation.** The `section--strong` blocks use `color: #ffffff` for headings and `color: rgba(255,255,255,0.7)` for body. Light text on `#0F2433` reads optically thinner and brighter. It should get slightly more line-height and a trace of letter-spacing — currently it uses the same values as light-background text.

---

## Interaction Feel

This is where the interface is weakest. The basics are present — focus rings, hover states, a skip-to-content link, `aria-*` attributes on interactive elements — but the complete interaction story isn't told.

**What works**:
- Button component is thorough: three variants (primary, secondary, secondary-light, link), two sizes, disabled state with `cursor-not-allowed`, focus-visible outline with offset. This is genuinely good component work.
- Scroll-reveal animations use `data-reveal` and `data-reveal-group` attributes, gated behind `html.js` for progressive enhancement. No-JS visitors get all content immediately. `prefers-reduced-motion` kills all animations globally. These are the right decisions.
- The mobile menu toggle swaps icons (hamburger → close), sets `aria-expanded`, and uses `hidden` to toggle visibility. This is accessible for screen readers.
- The contact form uses `aria-describedby` to link error messages to inputs, `aria-invalid` to mark fields, and validation on blur (not on every keystroke).

**Problems**:

- **P0: Dropdown navigation fails on touch and keyboard.** The header's "Servicios" dropdown uses CSS `group-hover` to show/hide. On touch devices, `group-hover` fires on first tap but there's no way to dismiss the dropdown or navigate to the parent link. On keyboard, there's no `aria-haspopup`, no `aria-expanded`, no arrow key handling, and the submenu links are not reachable via Tab because they're inside an `opacity-0 invisible` container. A procurement manager on an iPad or a keyboard-only user cannot access 6 service pages from the nav.

- **P0: No loading state on the contact form.** Clicking "Enviar consulta" gives no visual feedback — the button doesn't disable, there's no spinner, no text change. If Web3Forms takes 3–5 seconds, the user clicks again (duplicate submission). If it fails silently, there's no retry UI. The form relies on Web3Forms' redirect to `/contacto/gracias` for success feedback, which is server-side and invisible to the user until the redirect completes. The in-between state (submitting) is completely unhandled.

- **P1: Empty states disappear, they don't communicate.** On the home page, `{proyectosDestacados.length > 0 && (...)}` means the entire section vanishes when there are no destacados. On the clientes page, `{sectores.map(...)}` renders nothing if the collection is empty. The brief says empty states should "teach the space: say what belongs here, why it matters, and what action fills it." None of the empty state blocks in the codebase contain user-facing messages.

- **P1: No error recovery on the contact form beyond client-side validation.** If Web3Forms returns an error (network failure, rate limit, invalid key), the form has no `fetch`-based submission with error handling — it relies on the native form POST + redirect. If the redirect fails or the endpoint is down, the user is stranded with no feedback.

- **P2: Card hover lift (`hover:-translate-y-0.5`) conflicts with the industrial voice.** A 2px upward translation on hover reads as "playful card" — a SaaS/consumer pattern. The brief calls for "heavy, grounded, durable." Cards should respond to hover with a color or border shift that anchors them, not a lift that makes them feel lightweight.

- **P2: The hamburger menu toggle button on mobile has a fixed `aria-label`.** It always reads "Abrir menú de navegación" even when the menu is open and the close icon is showing. The label should toggle between open/close states.

---

## Cognitive Load / Risk Signals

| Level | Signal |
|-------|--------|
| **PASS** | Color palette is differentiated — not SaaS blue-violet, not generic |
| **PASS** | Real industrial photography carries proof, not stock |
| **PASS** | Progressive enhancement on motion (content visible without JS) |
| **PASS** | Design tokens are single-source-of-truth (tokens.css + tailwind mirror) |
| **WATCH** | Dropdown nav is CSS-only, not operable on touch or keyboard |
| **WATCH** | Contact form has no submit-in-progress state — risk of duplicate submissions |
| **WATCH** | Seven pages end with mechanically identical CTA sections |
| **WATCH** | Light-on-dark text uses no compensation (line-height, letter-spacing, weight) |
| **FAIL** | No empty states teach the space when dynamic content is absent |
| **FAIL** | No loading states exist anywhere in the interface |

---

## What's Working

1. **Photography as evidence.** The hero image is a real workshop photo. The service and project images are actual fabrication shots (penstocks, gates, turbines in production). This directly answers the engineer's question: "Do they actually build this stuff?" No illustration or stock photo could carry the same weight.

2. **Alternating section rhythm.** The default/alt/strong sequence creates a visual drumbeat that makes long pages scannable. Each dark section acts as a punctuation mark — it signals "this is a new chapter." The rhythm is consistent across all pages.

3. **CMS integration is invisible to the visitor.** EditableText and EditableImage components wrap every content field, and the CmsOverlay only appears for authenticated CMS users. The design system works unchanged whether content comes from markdown or the CMS database.

4. **Button component is thoroughly specified.** Four variants, two sizes, disabled state, focus-visible outline, touch targets ≥ 44px, hover transition. This is the standard every component should meet.

5. **Fluid typography prevents breakpoint brittleness.** Clamp values mean headings scale naturally across viewports without media query intervention. The site reads well at 375px and 1440px using the same CSS.

---

## Priority Issues

### P0 — Dropdown navigation inaccessible on touch and keyboard

**Evidence**: `Header.astro` lines 97–108 use CSS `group-hover` for dropdown visibility. No `aria-haspopup`, no `aria-expanded`, no keyboard event handlers, no touch-friendly toggle. The submenu links are inside `opacity-0 invisible group-hover:opacity-100 group-hover:visible` — unreachable via Tab navigation.

**Fix**: Add a `<button>` with `aria-expanded` and `aria-haspopup="true"` that toggles the dropdown on click/tap. Keep hover as a secondary trigger. Add keyboard handling (Escape to close, arrow keys to navigate). Add `focus-within` so the dropdown stays open when tabbing through submenu links.  
**Mode**: `/design interaction`

### P0 — No loading/submitting state on contact form

**Evidence**: `ContactForm.astro` lines 157–168 render a submit button with no `data-loading` state, no spinner, no disable-on-submit logic. The form uses native POST to Web3Forms with redirect — the user sees nothing between click and redirect.

**Fix**: On submit, disable the button, swap text to "Enviando...", show an inline spinner. Use `fetch` + `FormData` instead of native POST to handle errors with client-side feedback before redirecting.  
**Mode**: `/design interaction`

### P1 — Empty states disappear instead of communicating

**Evidence**: Home page line 111 uses `{proyectosDestacados.length > 0 && (...)}` — no else branch with empty state message. The clients page `sectores.map` renders nothing if collections are empty. No empty state component or pattern exists.

**Fix**: Add an `EmptyState` component with a message explaining what belongs in the space and how it gets filled. Use it in all conditional rendering blocks.  
**Mode**: `/design surface`

### P1 — Dense content pages have flat typographic hierarchy

**Evidence**: `empresa.astro` has 4 major content sections (historia, instalaciones, maquinaria, medios de obra) within `<Section variant="default">`. All use the same H2 size, same body size, same line-height. The visual distinction between sections relies entirely on grid gaps and dividers — not on typographic hierarchy.

**Fix**: Introduce a `--font-size-lead` token for introductory paragraphs. Increase the scale gap between H2 and H3. Add a subtle top-border or background treatment to subsection headings within dense pages.  
**Mode**: `/design typeset`

### P2 — Card hover lift conflicts with industrial voice

**Evidence**: `ServiceCard.astro` line 28: `hover:-translate-y-0.5`. `ProjectCard.astro` line 27: `hover:-translate-y-0.5`. The upward lift on hover is a consumer/SaaS pattern. Heavy industrial equipment doesn't float up — it's anchored.

**Fix**: Remove the translate-y lift. Replace with a color-based hover response: border changes from `border-border` to `border-primary`, background shifts to `bg-primary-light`, and shadow deepens slightly. The card stays grounded; the response is chromatic, not kinetic.  
**Mode**: `/design refine`

### P2 — Light-on-dark text lacks compensation

**Evidence**: `base.css` applies the same `line-height: 1.6` to all body text regardless of background. Dark section headings use `color: #ffffff` with same `letter-spacing: -0.01em`. White text on `#0F2433` appears optically thinner and brighter than the same text on white.

**Fix**: For `.section--strong` text: increase line-height by 0.05–0.1, add `letter-spacing: 0` (remove the negative tracking), and use `font-weight: 400` instead of inherited body weight for body copy.  
**Mode**: `/design typeset`

---

## Next Mode Recommendations

| Priority | Mode | Target |
|----------|------|--------|
| **Immediate** | `/design interaction` | Header dropdown + contact form loading state |
| **High** | `/design surface` | Empty states across all conditional rendering blocks |
| **High** | `/design typeset` | Dense page typography + light-on-dark compensation |
| **Medium** | `/design refine` | Card hover behavior + CTA section variation |
| **Later** | `/design relayout` | PageHero variation across internal pages |
| **Later** | `/design responsive` | Viewport gauntlet test (320–2560px) |

---

Generated with CommandCode — 2026-06-09
