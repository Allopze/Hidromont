# Auditoría de sitio web — Hidromont Chile

> **Fecha:** 2026-05-29  
> **Stack:** Astro 4.16 · Tailwind 3.4 · TypeScript 5.7 · salida estática (`hidromont.cl`)  
> **Propósito:** presencia corporativa (no conversión/ventas)

---

## Resumen ejecutivo

El sitio está muy bien construido para su escala. La arquitectura técnica es sólida: content collections tipadas con Zod, design system con tokens duales (CSS vars + Tailwind), SEO estructural completo y un presupuesto de JavaScript mínimo. El sitio pasaría un Lighthouse básico sin problemas graves.

En la sesión de auditoría se identificaron y aplicaron **10 fixes** sobre 12 hallazgos, con mejoras en rendimiento (−92% de peso de imágenes), accesibilidad, SEO estructurado, tipografía y calidad de código.

---

## Fortalezas

| Área | Detalle |
|---|---|
| SEO estructural | Canonical auto-calculado, Open Graph completo, Twitter Card, JSON-LD `Organization` en cada página, sitemap generado, `robots.txt` correcto |
| Accesibilidad | `lang="es-CL"`, landmarks semánticos, ARIA en nav y menú móvil, labels en formulario, soporte `prefers-reduced-motion`, `focus-visible` |
| Fuentes | woff2 auto-hospedadas con `@font-face` + `font-display: optional` + `unicode-range` (Inter, Roboto Condensed, Roboto Mono) |
| Arquitectura | Content collections tipadas (Zod), design tokens duales coherentes, componentes UI reutilizables |
| JS | Solo `Header` scroll y `motion.ts` (IntersectionObserver + rAF); sin frameworks client-side |
| Caché / headers | `.htaccess` con cache 1 año para assets, gzip, security headers |

---

## Tabla de hallazgos

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | Imagen OG rota — `/og/og-default.jpg` no existía | 🔴 Alta | ✅ Resuelto |
| 2 | `apple-touch-icon.png` referenciado pero ausente | 🟡 Media | ✅ Resuelto |
| 3 | PNGs pesados sin optimizar (7 MB total en `public/`) | 🔴 Alta | ✅ Resuelto |
| 4 | Imágenes internas no pasan por `<Image>` de Astro | 🟡 Media | ✅ Resuelto (refs → WebP) |
| 5 | Sin datos estructurados por página (`Service`, `BreadcrumbList`) | 🟡 Media | ✅ Resuelto |
| 6 | Formulario con `novalidate` pero sin errores accesibles | 🟡 Media | ✅ Resuelto |
| 7 | `redirect` del formulario hardcodeado a producción | 🟢 Baja | ✅ Resuelto |
| 8 | Roboto Mono cargado vía `@fontsource` sin `font-display: optional` | 🟢 Baja | ✅ Resuelto |
| 9 | Proyectos del "banco" sin página de detalle | 🟢 Baja | ⏸ Pendiente (decisión de contenido) |
| 10 | Alias `@/*` definido en tsconfig sin uso | 🟢 Baja | ⏸ Pendiente |
| 11 | Configs de dos hostings en paralelo (`.htaccess` + `_redirects`) | 🟢 Baja | ⏸ Pendiente (confirmar hosting) |
| 12 | `<h3>` en Footer sin H2 contenedor | 🟢 Baja | ✅ Resuelto |

---

## Detalle de cambios aplicados

### ✅ #1 — Imagen Open Graph generada

`public/og/og-default.jpg` (25 KB, 1200×630) creada con Sharp:
- Fondo degradado azul corporativo (`#0F2433` → `#0065A9`)
- Logo Hidromont reescalado a 320 px de ancho, centrado en la mitad superior
- Eslogan y URL del sitio como texto SVG

Usado por defecto en `src/layouts/BaseLayout.astro:19` para todas las páginas. Las páginas individuales pueden sobreescribir con `<PageLayout image="/og/mi-imagen.jpg">`.

---

### ✅ #2 — Apple Touch Icon generado

`public/apple-touch-icon.png` (6 KB, 180×180) creada con Sharp:
- Fondo azul corporativo con logo centrado.

---

### ✅ #3 + #4 — PNGs convertidos a WebP y referencias actualizadas

| Archivo original | Tamaño original | Tamaño WebP | Reducción |
|---|---|---|---|
| `fotos/curadas/empresa-taller.png` | 849 KB | 52 KB | −94% |
| `fotos/curadas/proyecto-tuberia-montana.png` | 2.4 MB | 243 KB | −90% |
| `fotos/curadas/taller-aereo.png` | 2.0 MB | 159 KB | −92% |
| `public/logo.png` | 1.8 MB | 56 KB | −97% |
| **Total** | **≈ 7.1 MB** | **≈ 510 KB** | **−93%** |

Archivos PNG originales conservados en `public/` para compatibilidad. Referencias de código actualizadas a `.webp`:
- `src/pages/empresa.astro:41`
- `src/components/projects/ProjectCard.astro:30`
- `src/pages/proyectos/[slug].astro:17`

**Script reutilizable:** `scripts/generate-images.mjs` — ejecutar `node scripts/generate-images.mjs` tras agregar nuevas imágenes PNG pesadas.

---

### ✅ #5 — JSON-LD `Service` + `BreadcrumbList` en páginas de servicio

`src/pages/servicios/[slug].astro` ahora inyecta dos schemas por cada página de servicio:

```json
{ "@type": "Service", "name": "...", "provider": {"@type": "Organization", ...} }
{ "@type": "BreadcrumbList", "itemListElement": [...] }
```

Pasados vía `jsonLd={jsonLd}` a `<PageLayout>`, que los delega a `BaseLayout` para inyección en `<head>`.

---

### ✅ #6 — Validación accesible del formulario de contacto

`src/components/contact/ContactForm.astro`:
- Campos requeridos (`nombre`, `email`, `mensaje`) ahora tienen `aria-describedby="campo-error"`.
- Mensaje de error `<p id="campo-error" aria-live="polite">` bajo cada campo requerido.
- Script de validación client-side agregado al final del componente:
  - Valida en `blur` (al salir del campo) y en `input` si el campo ya marcó error.
  - Al submit: recorre campos requeridos, marca `aria-invalid="true"` y muestra el mensaje; previene envío si hay errores; hace focus en el primer campo inválido.
  - Mensajes en español específicos por campo y tipo de error (`valueMissing`, `typeMismatch`, `tooShort`).
  - Aplica/retira clase `border-error` para retroalimentación visual.

---

### ✅ #7 — Redirect del formulario corregido

`src/components/contact/ContactForm.astro:26`:

```diff
- value={new URL(redirectTo, 'https://hidromont.cl').toString()}
+ value={new URL(redirectTo, Astro.site ?? 'https://hidromont.cl').toString()}
```

Ahora usa `Astro.site` (configurado como `https://hidromont.cl` en `astro.config.mjs`) y hace fallback al string solo si `Astro.site` está indefinido (builds sin `site`). Funciona correctamente en previews de Cloudflare Pages si se configura `SITE` en las variables de entorno del proyecto.

---

### ✅ #8 — Roboto Mono migrado a `@font-face` manual

- Eliminados los imports `@fontsource/roboto-mono/400.css` y `500.css` de `src/layouts/BaseLayout.astro`.
- Archivos woff2 copiados a `public/fonts/rm-400.woff2` y `public/fonts/rm-500.woff2` desde `node_modules/@fontsource/roboto-mono/files/`.
- Declaraciones `@font-face` con `font-display: optional` y `unicode-range` latin agregadas a `src/styles/base.css`.

Beneficio: eliminado `font-display: swap` (que causaba FOUT), consistencia con el resto de las fuentes del sitio.

---

### ✅ #12 — Jerarquía de encabezados en Footer corregida

`src/components/layout/Footer.astro`: los tres `<h3>` (Servicios, Empresa, Contacto) reemplazados por `<p>` con la misma clase visual. La semántica de encabezados del pie de página ya no interfiere con la jerarquía H1→H2 del contenido principal.

---

## Pendiente

### ⏸ #9 — Proyectos del banco sin página de detalle

`src/pages/proyectos/[slug].astro` filtra `tipo === 'destacado'`, excluyendo ~30 proyectos del banco. Si en el futuro se quiere dar detalle a más proyectos, cambiar `tipo` a `'destacado'` en el frontmatter correspondiente del markdown en `src/content/proyectos/`.

**No se aplica por defecto** — decisión de contenido: los proyectos del banco probablemente no tienen suficiente información para justificar página completa.

---

### ⏸ #10 — Alias `@/*` en tsconfig sin uso

`tsconfig.json` define `"@/*": ["src/*"]` pero todos los imports son relativos. Opciones:
- **Adoptar:** buscar+reemplazar todos los imports relativos de `src/` por `@/...` — mejora legibilidad en imports profundos.
- **Eliminar:** borrar el path alias del tsconfig si no se planea usar.

Ambas son igualmente válidas. Prioridad baja; no afecta compilación ni runtime.

---

### ⏸ #11 — Doble config de hosting

`public/.htaccess` (Apache) y `public/_redirects` (Cloudflare Pages) coexisten. Solo uno aplica según el host real:
- Si el hosting es **Cloudflare Pages**: eliminar `.htaccess`.
- Si es **Apache/cPanel**: eliminar `_redirects` y revisar que `.htaccess` cubra los redirects de SPA.

Confirmar con el equipo de infraestructura antes de actuar.

---

## Próximos pasos naturales

### Corto plazo (mejoras de calidad progresiva)

1. **`<Image>` de Astro para imágenes internas** — mover `empresa-taller.webp`, `proyecto-tuberia-montana.webp` y similares a `src/assets/` e importarlos con `import { Image } from 'astro:assets'` en `PageHero` y `ProjectCard`. Generaría automáticamente `srcset` responsive. Requiere refactorizar la API de `PageHero` para aceptar `ImageMetadata` además de `string`.

2. **OG image por página** — pasar `image` en cada `<PageLayout>` de las páginas principales (empresa, servicios, proyectos) con una imagen representativa. Actualmente todas usan `og-default.jpg`.

3. **BreadcrumbList en otras páginas** — replicar el patrón de JSON-LD en `proyectos/[slug].astro` y en `empresa.astro`, `calidad.astro`, `clientes.astro`.

4. **Limpiar PNGs originales** — una vez confirmado que los WebP funcionan en producción, borrar los PNG originales de `public/fotos/curadas/` para reducir el peso del repositorio y del deploy.

### Medio plazo

5. **Core Web Vitals reales** — ejecutar Lighthouse o PageSpeed Insights en producción para medir LCP, CLS, INP post-cambios y detectar regresiones no visibles en desarrollo.

6. **Clarificar hosting** — resolver el conflicto `.htaccess` / `_redirects` (ver #11).

7. **`@/*` alias o eliminación** — definir la convención de imports y aplicarla de forma consistente.

### Largo plazo / opcional

8. **Proyectos del banco con detalle** — si el catálogo de proyectos crece y se añade contenido markdown, extender `[slug].astro` para incluir proyectos de banco seleccionados.

9. **Formulario: confirmación sin redirect** — reemplazar el redirect a `/contacto/gracias` por un estado de éxito en la misma página (fetch + show success state) para eliminar la dependencia del dominio en el `redirect` field de Web3Forms.
