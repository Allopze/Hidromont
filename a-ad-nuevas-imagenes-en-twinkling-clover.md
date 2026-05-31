# Plan — Ubicar las 7 nuevas fotografías en la web de Hidromont

## Context

El usuario añadió 7 fotografías profesionales en la raíz del repo. Son tomas de alto valor del trabajo central de Hidromont (tuberías forzadas, bifurcaciones en T, taller con grúa pórtico de 20t, montajes subterráneos en caverna). Hoy varios heros usan `.jpg` pequeños y genéricos, y secciones potentes (la franja "Instalaciones" del home) no tienen fotografía. El objetivo es **ubicar cada imagen individualmente donde más destaque**, reemplazando fotos actuales cuando la nueva sea claramente superior y rellenando los espacios sin imagen. Sin construir un componente de galería (decisión del usuario). Esto refuerza la presencia corporativa (no ventas) con imágenes reales de capacidad técnica.

Convenciones existentes que se respetan:
- Las fotos de contenido viven en `public/fotos/curadas/` y se referencian por string `/fotos/curadas/*.webp` en `<img>` o vía la prop `imageSrc` de `PageHero`.
- La conversión PNG→WebP se hace con `scripts/generate-images.mjs` (sharp, `quality: 82, effort: 6`), añadiendo rutas al array `PNG_TO_CONVERT`.
- Los mapas de imágenes de servicios/proyectos son slug→ruta hardcodeados (no usan el campo `heroImage` del schema). El mapa de proyectos está **duplicado** en `ProjectCard.astro` y `proyectos/[slug].astro` y debe mantenerse sincronizado.

## Paso 1 — Mover y optimizar los assets

1. Mover los 7 PNG de la raíz a `public/fotos/curadas/` con nombres kebab-case descriptivos:

| Origen (raíz) | Destino en `public/fotos/curadas/` |
|---|---|
| `taller.png` | `taller-nave.png` |
| `tubo_taller.png` | `fabricacion-tuberias-taller.png` |
| `tuberia_galeria.png` | `tuberia-forzada-tunel.png` |
| `tubo_en_T.png` | `valvula-tuberia-tunel.png` |
| `tubo_T_taller.png` | `bifurcacion-t-taller.png` |
| `toberia_taller2.png` | `bifurcacion-primer-taller.png` |
| `tubo_vertical.png` | `montaje-vertical-caverna.png` |

2. En `scripts/generate-images.mjs`, añadir esas 7 rutas (relativas a `public/`, p.ej. `'fotos/curadas/taller-nave.png'`) al array `PNG_TO_CONVERT` (~línea 78).
3. Ejecutar `node scripts/generate-images.mjs` → genera los `.webp` (quality 82). En el sitio se referencian **siempre los `.webp`**. Los `.png` quedan como fuente en `curadas/` (mismo patrón que `empresa-taller.png` + `.webp`).

## Paso 2 — Ubicación de cada imagen

Cada foto se coloca una sola vez, donde su contenido y formato calzan mejor:

| Imagen `.webp` | Ubicación | Acción | Archivo / referencia |
|---|---|---|---|
| `taller-nave` (1536×1024) | Hero de **Empresa** | Reemplaza `empresa-taller.webp` (toma de taller más legible: grúa 20t + soldador) | `src/pages/empresa.astro:41-44` (props `imageSrc/imageAlt/imageWidth/imageHeight`) |
| `fabricacion-tuberias-taller` (1834×858, pano) | Home, franja **"Instalaciones"** | **Añade** imagen (hoy solo `CapabilitiesBlock`, sin foto) | `src/pages/index.astro:102-112` |
| `tuberia-forzada-tunel` (1849×851, pano) | Hero servicio **Tuberías forzadas** | Reemplaza `tuberias-forzadas.jpg` | `src/pages/servicios/[slug].astro:12` |
| `valvula-tuberia-tunel` (1448×1086) | Hero servicio **Válvulas** | Reemplaza `valvulas.jpg` (muestra válvula sobre tubería) | `src/pages/servicios/[slug].astro:14` |
| `bifurcacion-t-taller` (1536×1024) | Hero de **listado de Proyectos** | Reemplaza `proyecto-tunel-blindaje.jpg` (bifurcación en T, impacto en landing) | `src/pages/proyectos/index.astro:56` |
| `bifurcacion-primer-taller` (1425×1104) | Proyecto **embalse-chacrillas** (card + detalle) | Reemplaza `proyecto-bifurcacion-taller.jpg` | `ProjectCard.astro:31` **y** `proyectos/[slug].astro` (ambos mapas) |
| `montaje-vertical-caverna` (1086×1448, **vertical**) | Hero de detalle del proyecto subterráneo destacado (p.ej. **ch-los-condores**) | Reemplaza `proyecto-tunel-blindaje.jpg` en ese proyecto | `proyectos/[slug].astro` + `ProjectCard.astro:25` (ambos mapas) |

### Detalle de la franja "Instalaciones" (home)
`CapabilitiesBlock` no renderiza imágenes. Envolver el bloque en un layout de 2 columnas (o añadir una imagen enmarcada a ancho completo arriba/abajo del bloque) dentro de la `<Section variant="strong">`, reutilizando el estilo de marco de imagen de `PageHero.astro:90-116` (borde redondeado, `loading="lazy"`). La foto es panorámica (2.14:1), ideal como banda.

### Nota sobre la imagen vertical
`montaje-vertical-caverna` es la única en formato retrato. En el **hero de detalle** (`PageHero`) se ve perfecta pasando `imageWidth={1086} imageHeight={1448}`. En la **tarjeta** (`ProjectCard`, `aspect-ratio: 16/9`, `object-cover`) se recorta al centro pero sigue leyéndose el tubo vertical — aceptable. Confirmar que el contenido de `ch-los-condores` (montaje subterráneo) calza; si se prefiere, alternativa = usarla como acento vertical en el cuerpo de `empresa.astro` y dejar la tarjeta de proyecto con su imagen actual.

## Paso 3 — Sincronizar mapas y alt text

- Actualizar **ambos** mapas de proyectos (`ProjectCard.astro:24-32` y `proyectos/[slug].astro:11-19`) en los slugs afectados — deben quedar idénticos.
- Ajustar `width`/`height` y `alt` descriptivo (en español) en cada entrada modificada de `servicios/[slug].astro` para que coincidan con las dimensiones reales de las nuevas fotos.

## Verificación

1. `node scripts/generate-images.mjs` → confirmar que se crean los 7 `.webp` con reducción de peso (log `−XX%`).
2. `npm run dev` (dev server en :4321) y revisar visualmente:
   - `/empresa` → hero con `taller-nave`.
   - `/` → franja "Instalaciones" con la panorámica de fabricación.
   - `/servicios/tuberias-forzadas` y `/servicios/valvulas` → nuevos heros.
   - `/proyectos` → hero con bifurcación en T.
   - `/proyectos/embalse-chacrillas` y `/proyectos/ch-los-condores` → fotos nuevas en card (en el listado) y en el hero de detalle.
3. `npm run build` → build limpio, sin rutas de imagen rotas (404 en `/fotos/curadas/*`).
4. Verificar que ninguna foto antigua reemplazada quede referenciada en otro lugar (grep de los `.jpg` retirados) antes de considerarlos huérfanos.
