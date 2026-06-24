# Auditoría Visual de la Página Web

> **Alcance y método de esta auditoría.** El análisis se realizó sobre el código fuente real del proyecto (Astro + Tailwind): tokens de diseño (`src/styles/tokens.css`, `base.css`), layouts, componentes reutilizables, páginas (`index`, `empresa`, `servicios`, `clientes`, `contacto`, `proyectos`, `galeria`, `404`), assets gráficos (`public/`, `src/assets/`) y colecciones de contenido (37 proyectos, 8 servicios, ~16 clientes con logos). **No se ejecutó un render en navegador real** con captura por breakpoint; las observaciones responsive se derivan del análisis de clases y media queries, no de una inspección pixel a pixel en dispositivos. Donde esa distinción importa, se indica explícitamente.

---

## 1. Resumen ejecutivo

La web de Hidromont Chile **no es una plantilla genérica ni una maqueta inacabada**: es un sitio corporativo construido con un sistema de diseño propio, coherente y con criterio industrial deliberado (esquinas rectas, tipografía condensada para titulares, paleta azul técnica, contenido real y abundante). Transmite una empresa seria, técnica y del rubro hidromecánico/hidroeléctrico. La calidad de ingeniería frontend es alta: tipografía fluida con `clamp()`, fuentes auto-alojadas con `font-display` controlado, imágenes optimizadas vía el componente `<Image>` de Astro, estados `focus-visible` definidos, soporte de `prefers-reduced-motion`, validación accesible en el formulario y atención a detalles como evitar el zoom de iOS en inputs (16px en móvil).

**Nivel de calidad visual actual:** Alto / casi listo para producción.

**Principales fortalezas:**
- Sistema de diseño consistente en color, tipografía y espaciado (tokens centralizados).
- Hero potente, jerarquía clara, CTAs bien ubicados (primario sólido + secundario fantasma).
- Contenido real y específico del rubro (capacidades, maquinaria, m², proyectos reales), lo que genera confianza y diferencia de una landing genérica.
- Accesibilidad por encima del promedio de un sitio corporativo (labels, aria, focus, reduced-motion).
- Navegación clara con header overlay→sólido en home y sticky en páginas internas.

**Principales debilidades:**
- **Incoherencia de radios de esquina**: los tokens declaran radio 0 (estética industrial recta) y botones/inputs/nav usan `rounded-none`, pero las *cards*, el mapa del footer, los badges y la galería usan `rounded-lg`/`rounded-md`/`rounded-full`. Conviven esquinas rectas y redondeadas sin una regla clara. Es la inconsistencia visual más evidente del sistema.
- **La página de Contacto rompe el patrón**: es la única página interna sin `PageHero` (sin banda oscura, sin título visible —el `h1` es `sr-only`— ni breadcrumb). Se siente de otra plantilla respecto al resto.
- **Contrastes débiles puntuales**: etiquetas `text-white/40` en el footer (rótulos "Teléfono"/"Correo") y algunos `text-white/60` quedan por debajo del mínimo recomendado sobre fondo oscuro.
- **Footer sin identidad de marca** en la mayoría de páginas: con el mapa visible no se muestra nombre ni descripción de la empresa; la marca solo aparece en el copyright inferior.
- **Sección Clientes con eyebrow huérfano**: por decisión expresa se eliminó el H2, dejando un `Eyebrow` "Nuestros Clientes" seguido de un contenedor vacío con `mb-16`, generando un hueco superior sin anclaje de título.

**Riesgos visuales antes de producción:** ninguno bloqueante. Los puntos anteriores son pulidos de consistencia y accesibilidad, no fallos estructurales.

**Conclusión general:** Sitio sólido, profesional y coherente, listo para producción una vez resueltas observaciones menores de consistencia (radios) y accesibilidad (contrastes del footer) y, deseablemente, alineada la página de Contacto al patrón visual del resto.

---

## 2. Nota final

**Nota final:** 8/10

Justificación: diseño visual y profesionalismo altos, consistencia mayoritariamente buena pero con la fricción real de radios mixtos y de la página de Contacto fuera de patrón, responsive bien planteado a nivel de código (no verificado en navegador), CTAs correctos y confianza de marca alta gracias al contenido real. Pierde puntos por inconsistencias de sistema corregibles y contrastes puntuales, no por carencias de fondo.

---

## 3. ¿Está lista para producción?

**Estado:** Lista con observaciones menores

Justificación: La web cumple los estándares visuales y de UX para una empresa real y no presenta defectos bloqueantes (no hay secciones rotas, contenido placeholder visible, ni navegación confusa). Antes de publicar conviene resolver tres cosas concretas: (1) decidir y unificar la regla de radios de esquina, (2) elevar los contrastes `text-white/40`–`/60` del footer, y (3) dar a Contacto un encabezado visible coherente con el resto del sitio. Son ajustes acotados, no rediseños.

---

## 4. Problemas críticos

> En esta web no existen problemas de severidad *Crítica* en el sentido de "impide publicar". Se listan los de mayor impacto visual/UX, con su severidad real.

### P-1. Radios de esquina inconsistentes entre componentes
- **Ubicación:** `tokens.css` (`--radius-*: 0px`) vs. `ServiceCard.astro`, `ProjectCard.astro`, `Footer.astro` (mapa `rounded-lg`, chips `rounded-full`), `empresa.astro` (cards `rounded-lg`), `galeria` (`rounded-lg`), frente a `Button.astro`, `.form-input`, nav y CTAs que usan `rounded-none`.
- **Descripción:** El sistema declara una estética industrial de esquinas rectas (radio 0), pero numerosas tarjetas y contenedores usan la escala de redondeado de Tailwind, ajena a los tokens. El resultado: botones e inputs con esquinas a 90° conviven con cards de esquinas redondeadas en la misma vista (p. ej. en Servicios y Empresa).
- **Por qué afecta:** Es el indicador más claro de "sistema no del todo domado". Rompe la sensación de diseño unificado y delata dos criterios distintos.
- **Severidad:** Alta (consistencia).
- **Recomendación:** Tomar una decisión única. Si la estética es industrial/recta, cambiar cards, mapa y galería a `rounded-none` (o a `--radius-sm` pequeño y uniforme, p. ej. 2–4px) aplicado de forma global. Evitar `rounded-full` salvo en elementos genuinamente "pill" (badge "Cómo llegar").

### P-2. Página de Contacto sin encabezado visual coherente
- **Ubicación:** `src/pages/contacto.astro`.
- **Descripción:** Es la única página interna que no usa `PageHero`. El `h1` está `sr-only`, no hay banda oscura ni breadcrumb; el usuario entra directo a un split formulario/mapa. El primer texto visible es un H2 "Envíe su consulta".
- **Por qué afecta:** Rompe la consistencia de navegación y jerarquía respecto a Empresa, Servicios, Clientes y Galería, que sí abren con hero oscuro + breadcrumb. Da una sensación de página "de otro lote".
- **Severidad:** Media.
- **Recomendación:** Añadir un encabezado visible (puede ser un `PageHero` compacto solo-texto con breadcrumb "Inicio › Contacto" y título "Contacto"), manteniendo el split debajo. Alternativamente, un título H1 visible dentro de la columna del formulario.

### P-3. Contraste insuficiente en rótulos del footer
- **Ubicación:** `Footer.astro` — rótulos "Teléfono"/"Correo" con `text-white/40`; varios textos `text-white/60`–`/70` sobre `--color-background-strong` (#0F2433).
- **Descripción:** `white/40` sobre fondo oscuro queda muy por debajo de 4.5:1; incluso para texto pequeño es difícil de leer.
- **Por qué afecta:** Accesibilidad (WCAG AA) y legibilidad real de datos de contacto importantes.
- **Severidad:** Media.
- **Recomendación:** Subir los rótulos a `text-white/70` como mínimo (idealmente `/80`) y los enlaces de contacto a `text-white/80`. Mantener `/60` solo para texto decorativo no esencial.

---

## 5. Problemas por sección

### Hero (home)
**Estado visual:** Bueno
**Problemas detectados:**
- `min-h-[100dvh]` con header `fixed` transparente (altura `h-24` ≈ 96px): en pantallas móviles cortas y con el `font-size-display` máximo, el título podría quedar visualmente próximo al logo del header. No verificado en navegador.
- El indicador de scroll y el CTA conviven en una composición vertical alta; en móviles muy pequeños (360×640) el bloque texto+CTAs podría sentirse apretado contra el centro.
**Recomendaciones:**
- Verificar en 360px y 390px que el título no colisione con el header; si ocurre, reducir el `min-h` a `min-h-[90dvh]` o añadir `padding-top` equivalente a la altura del header en móvil.
- El resto (eyebrow → título → subtítulo → CTAs alineados a la izquierda, foto con `object-position: center 35%`, `text-on-photo` para legibilidad sin overlay sólido) está bien resuelto y es de buen nivel.

### Servicios (home y `/servicios`)
**Estado visual:** Bueno
**Problemas detectados:**
- Cards con `rounded-lg` (ver P-1) frente a botones `rounded-none`.
- En la grilla de 3 columnas, las cards usan `flex flex-col` con `mt-auto` en el enlace, así que la altura sí se iguala correctamente — bien resuelto.
**Recomendaciones:** Unificar radios. Mantener el patrón de altura igualada que ya está correcto.

### Capacidades / Instalaciones (home)
**Estado visual:** Bueno
**Problemas detectados:**
- En `CapabilitiesBlock` con métricas, los divisores usan `border-l` entre columnas y `border-t` al apilar; en el borde entre breakpoints (sm 2 col) la última fila impar deja una celda sin compañera, lo cual es aceptable visualmente pero conviene revisar el balance con 5 columnas (números de instalaciones) en `lg`.
**Recomendaciones:** Verificar la grilla de 5 columnas en `lg` (1024–1280px): con textos de longitud desigual puede haber descuadres de línea base entre celdas.

### Empresa
**Estado visual:** Bueno
**Problemas detectados:**
- Cards de métricas e instalaciones en `rounded-lg` (P-1).
- Las dos listas largas (maquinaria 10 ítems / medios de obra 8 ítems) en dos columnas son densas; aceptable para una audiencia técnica.
**Recomendaciones:** Unificar radios. Contenido y jerarquía correctos.

### Proyectos / ProjectCard
**Estado visual:** Bueno
**Problemas detectados:**
- Card con `rounded-lg` y foto `aspect-ratio: 16/9`; los proyectos "destacado" sin foto muestran una banda `bg-primary-light` con badge — coherente, pero genera dos alturas/encabezados de card distintos en la misma grilla (con foto vs. con banda). Puede dar una grilla algo heterogénea.
**Recomendaciones:** Si conviven destacados con y sin foto en la misma vista, considerar una imagen de respaldo o un encabezado gráfico uniforme para igualar la "cara" de las cards.

### Clientes
**Estado visual:** Mejorable
**Problemas detectados:**
- Eyebrow "Nuestros Clientes" seguido de un `<div class="mb-16">` vacío (el H2 fue eliminado por petición expresa, según comentario en el código). Queda un eyebrow huérfano y un espacio superior sin título que lo justifique.
- Logos con `grayscale + opacity 0.6` que se colorean en hover: efecto correcto y profesional. Mezcla de formatos (SVG/PNG/WEBP) en `logos-clientes/` puede dar nitidez desigual entre logos.
**Recomendaciones:** Reducir el `mb-16` del bloque vacío o devolver un título corto y neutro (respetando la decisión del cliente, podría usarse solo el eyebrow sin el espacio sobrante). Auditar que todos los logos rasterizados tengan resolución suficiente (idealmente 2×) para no verse borrosos.

### Contacto
**Estado visual:** Mejorable
**Problemas detectados:** Ver P-2 (sin hero/título visible, fuera del patrón). El formulario en sí es excelente: validación accesible en vivo, mensajes por campo, honeypot anti-spam, estado de carga, éxito/error con `aria-live`.
**Recomendaciones:** Añadir encabezado visible coherente con el resto.

### Footer
**Estado visual:** Mejorable
**Problemas detectados:** Contrastes débiles (P-3); ausencia de bloque de marca (nombre/descripcion) cuando el mapa está visible —solo aparece en modo `hideMap`—. El mapa con filtro `invert/hue-rotate` para tematizarlo en oscuro es un buen detalle.
**Recomendaciones:** Mostrar siempre nombre de empresa + breve descripción junto al mapa; subir contrastes de rótulos.

### Galería
**Estado visual:** Bueno (con dependencia de contenido)
**Problemas detectados:** Lee imágenes de `public/uploads/cms`; si está vacío muestra "Próximamente se añadirán imágenes". En producción, una galería vacía resta profesionalismo.
**Recomendaciones:** Garantizar que la galería tenga imágenes curadas antes de publicar, o no enlazarla en la navegación hasta que tenga contenido.

### 404
**Estado visual:** Bueno
**Problemas detectados:** Ninguno relevante. Coherente con el sistema, con CTAs de retorno.

---

## 6. Auditoría de navegación

- **Logo:** a la izquierda, tamaño adecuado (`h-20`), con inversión a blanco sobre el hero oscuro y vuelta a color al hacer scroll. Buen detalle.
- **Orden de enlaces:** claro; con dropdown para ítems con hijos (hover + `group-focus-within`, accesible por teclado).
- **CTA del navbar:** usa el componente `Button` (fondo sólido primario), **bien diferenciado** de los enlaces de texto — correcto, no comete el error típico de un CTA que parece enlace.
- **Sticky/overlay:** en home, header `fixed` transparente que transiciona a blanco sólido tras 80px (con `requestAnimationFrame`, eficiente). En páginas internas, `sticky` blanco con blur. Comportamiento profesional.
- **Menú móvil:** hamburguesa→X, panel blanco, `details/summary` para submenús, CTA full-width al final, `aria-expanded`/`aria-controls` correctos. Buen estándar.
- **Footer como navegación:** columnas Servicios / Empresa / Contacto bien organizadas.

**Veredicto:** navegación propia de una web profesional, no de plantilla. Única mejora: contraste de enlaces del footer.

---

## 7. Auditoría de botones y CTAs

| CTA | Ubicación | Estado | Problema | Recomendación |
|---|---|---|---|---|
| "Conocer nuestros servicios" | Hero home (primario) | Correcto | — | Mantener. Bien ubicado tras el subtítulo. |
| "Ver proyectos" | Hero home (secundario fantasma) | Correcto | Borde blanco sobre foto; legible gracias a `btn-on-photo` (drop-shadow) | Mantener. |
| CTA navbar (Contacto) | Header | Correcto | — | Diferenciación correcta (sólido vs. links). |
| "Ver servicio" | ServiceCard | Correcto | Variante `link` con flecha; jerarquía secundaria adecuada dentro de la card | Mantener. |
| "Ver todos los proyectos" | Home, sección proyectos | Correcto | Variante `secondary` (borde) coherente | Mantener. |
| "Ver detalle" | ProjectCard | Correcto | Usa pseudo-elemento para card clickable completa | Mantener. |
| "Enviar consulta" | Formulario contacto | Correcto | Estado loading/disabled bien manejado | Mantener. |
| CTAs finales (`CTASection`) | Cierre de home/empresa/servicios/clientes | Correcto | Primario + secundario claro sobre fondo oscuro | Mantener. Buen cierre con llamado a la acción tras cada página. |
| "Ver todos los clientes" | ClientsStrip (home) | Mejorable | Es un enlace de texto pequeño con flecha; correcto pero de bajo peso | Aceptable; si se busca más conversión, subir a botón `secondary`. |

**Observación general:** la jerarquía primario→secundario→link es consistente y bien aplicada en todo el sitio. No hay exceso de CTAs compitiendo. El sistema de variantes (`primary` / `secondary` / `secondary-light` / `link`) con `active:scale-[0.98]` y `focus-visible` es de buen nivel.

---

## 8. Auditoría responsive

> Derivada del análisis de clases Tailwind y media queries (no de render en dispositivo).

| Breakpoint | Estado | Problemas detectados | Recomendaciones |
|---|---|---|---|
| 360px (móvil pequeño) | Probable bueno, verificar | Hero `100dvh` + header fijo 96px + display grande → posible estrechez/cercanía con el header | Verificar en navegador; reducir `min-h` o añadir padding-top en móvil si colisiona. |
| 390px (móvil estándar) | Bueno | Grids colapsan a 1 columna; inputs a 16px (evita zoom iOS); CTAs `flex-wrap` | Verificar marquee de clientes: con pocos logos puede verse vacío. |
| 768px (tablet) | Bueno | Grids a 2 col; `PageHero` apila texto/imagen (`flex-col lg:flex-row`) | Revisar la grilla de 5 columnas de instalaciones en el salto sm→lg. |
| 1366px (laptop) | Bueno | Contenedores `max-w` 1200/1320px centrados; `PageHero` 45/55 split | OK. |
| ≥1440px (desktop) | Bueno | Contenido limitado por contenedor; hero full-bleed | En pantallas muy anchas, el marquee de clientes (logos duplicados ×2) puede quedar disperso; considerar triplicar el set. |

**Fortalezas responsive:** uso sistemático de `grid-cols-1 sm:… lg:…`, tipografía fluida con `clamp()`, imágenes con `widths`/`sizes`, áreas táctiles de botones `min-h-[44px]/[52px]` (cumple objetivo táctil), `overflow-hidden` en heros para evitar scroll horizontal. No se detectaron en código fuentes evidentes de overflow horizontal.

---

## 9. Auditoría de consistencia visual

- **Colores:** centralizados en tokens; paleta azul técnica (#0065A9 primario, #00A6D6 acento, #0F2433 oscuro) coherente y apropiada al rubro. Uso intencional (acento solo en eyebrows sobre oscuro, marcadores, líneas divisorias). **Bien.**
- **Tipografías:** Roboto Condensed (titulares), Inter (cuerpo), Roboto Mono (métricas/datos). Combinación coherente, industrial y legible. Auto-alojadas con subsetting de `unicode-range`. **Muy bien.**
- **Espaciado:** escala base-4 en tokens; secciones con `py-16 md:py-20`. Consistente.
- **Sombras:** escala `sm/md/lg` con tinte azulado uniforme. Consistente.
- **Bordes/divisores:** `--color-border` (#D9E2EC) y `.section-divider` con degradado primario→acento. Buen detalle de marca.
- **Cards/botones:** botones muy consistentes; **cards inconsistentes en radio** (ver P-1).
- **Íconos:** set SVG propio para servicios (pipe, gate, valve, turbine, etc.) con el mismo `stroke-width: 1.5`, mismo viewBox y estilo de línea → **estilo de íconos coherente**, hecho a medida (no librería genérica). Muy positivo para la marca.
- **Animaciones:** sistema unificado de motion (tokens `--motion-*`, `--ease-standard`), reveal por scroll, marquee, shimmer, ken-burns, card-lift, todos con respeto a `prefers-reduced-motion`. **Excelente.**
- **Tratamiento de imágenes:** logos de clientes en grayscale→color en hover, consistente entre home y página de clientes.

**Principal inconsistencia del sistema:** radios de esquina (P-1). El resto es notablemente coherente.

---

## 10. Auditoría de imágenes y recursos gráficos

- **Hero home (`hero-home.png`):** es un PNG para una foto. Pesa más que un JPG/WEBP equivalente, aunque el componente `<Image>` de Astro genera variantes WEBP responsivas, lo que **mitiga** el problema en producción. **Recomendación:** mantener; opcionalmente partir de un origen JPG/WEBP para acelerar el build.
- **Fotos curadas (`public/fotos/curadas/`):** mezcla de `.jpg` y `.webp`; las `.webp` (taller, tubería, válvula, bifurcación) son de buen tamaño/calidad. Las `.jpg` antiguas (compuertas 19KB, turbinas 34KB) son pequeñas y podrían verse blandas si se usan a gran tamaño. **Recomendación:** verificar resolución de las JPG cuando se muestren a ancho completo (heros de detalle de servicio).
- **Logos de clientes:** mezcla SVG/PNG/WEBP. Los SVG escalan perfecto; los PNG raster deben tener densidad suficiente. **Recomendación:** preferir SVG donde exista; auditar nitidez de PNG en pantallas retina.
- **Galería:** depende de `uploads/cms`; **no publicar vacía** (ver sección 5).
- **Íconos SVG:** a medida, coherentes, escalables. **Mantener.**
- **Mapa (footer y contacto):** iframe de Google Maps; en footer con filtro de tematización oscura (buen detalle), en contacto sin filtro (coherente con fondo claro).

**Veredicto:** los assets representan bien a la empresa (taller, tuberías, túneles, montajes reales). No hay imágenes genéricas de stock evidentes, lo que **refuerza autenticidad**. Acción principal: verificar resolución de las JPG pequeñas y nutrir la galería.

---

## 11. Auditoría de accesibilidad visual básica

- **Contraste texto/fondo:** mayormente correcto. **Problemas:** `text-white/40` (footer), algún `text-white/60`; `--color-text-muted` (#5B6770 ≈ 4.7:1) está justo en el límite para texto pequeño. **Acción:** elevar opacidades del footer; usar `text-muted` solo en tamaños ≥14px.
- **Tamaños de fuente:** cuerpo 16px, mínimos en captions 12px (`--font-size-caption`) — aceptable para metadatos.
- **Focus visible:** **bien implementado** (`focus-visible:outline-[3px]` en botones, inputs con outline azul). Por encima del promedio.
- **Botones/links distinguibles:** sí; links con subrayado y offset; botones con relleno/borde.
- **Área clickeable:** `min-h-[44px]` en botones e inputs — cumple objetivo táctil.
- **Texto sobre imágenes:** el hero apoya la legibilidad con `text-shadow` multicapa (`text-on-photo`) en lugar de un overlay sólido oscuro. Funciona, pero depende de la zona de la foto; **verificar** que el subtítulo (`text-white/90`) se lea sobre las áreas claras de la imagen.
- **Dependencia del color:** errores de formulario usan color + texto + `aria-invalid` (no solo color). **Correcto.**
- **Reduced motion:** respetado globalmente. **Excelente.**

**Riesgos evidentes:** contrastes del footer (P-3) y legibilidad del subtítulo del hero sobre zonas claras de la foto.

---

## 12. Recomendaciones priorizadas

### Prioridad alta (antes de producción)
1. **Unificar radios de esquina** (P-1): decidir estética recta o levemente redondeada y aplicarla a cards, mapa, badges y galería de forma uniforme.
2. **Subir contrastes del footer** (P-3): rótulos a `text-white/70+`, enlaces a `text-white/80`.
3. **Dar encabezado visible y coherente a Contacto** (P-2): hero/título + breadcrumb como el resto de páginas internas.
4. **No publicar la Galería vacía**: nutrirla o desenlazarla temporalmente.
5. **Verificar el hero en móvil (360/390px)**: que el título no colisione con el header fijo y el subtítulo sea legible sobre la foto.

### Prioridad media
6. **Resolver el eyebrow huérfano de Clientes** (espacio `mb-16` sin título).
7. **Mostrar marca en el footer** también con el mapa visible (nombre + descripción breve).
8. **Auditar resolución** de JPG pequeñas y de logos PNG en pantallas retina.
9. **Homogeneizar las cards de Proyectos destacados** (con foto vs. con banda) para una grilla más uniforme.

### Prioridad baja (pulido)
10. Considerar triplicar el set de logos del marquee para pantallas muy anchas.
11. Revisar el balance de la grilla de instalaciones de 5 columnas en `lg`.
12. Opcional: subir el "Ver todos los clientes" de link a botón `secondary` si se busca más conversión.
13. Optimizar el origen del hero a JPG/WEBP para acelerar el build (no afecta al usuario final).

---

## 13. Checklist final de producción visual

- [x] Sistema de diseño centralizado (tokens de color, tipografía, espaciado)
- [x] Tipografías auto-alojadas con `font-display` controlado
- [x] Hero con jerarquía clara y CTAs bien ubicados
- [x] Navegación clara (desktop + móvil) con CTA diferenciado
- [x] Estados `focus-visible` definidos
- [x] Soporte de `prefers-reduced-motion`
- [x] Formulario de contacto accesible (labels, aria, validación, honeypot, estados)
- [x] Imágenes optimizadas (Astro `<Image>`, lazy, dimensiones)
- [x] Íconos a medida y coherentes
- [x] Contenido real y específico del rubro (no placeholder)
- [x] Áreas táctiles ≥44px
- [ ] Radios de esquina unificados entre cards y controles
- [ ] Contrastes del footer a nivel AA
- [ ] Página de Contacto con encabezado visible coherente
- [ ] Galería con contenido (o desenlazada)
- [ ] Verificación de hero y legibilidad en móvil 360/390px (navegador real)
- [ ] Eyebrow huérfano de Clientes resuelto
- [ ] Marca visible en footer con mapa presente

---

## 14. Conclusión final

La página web de Hidromont Chile es un **sitio corporativo profesional, coherente y técnicamente bien construido**, claramente por encima del nivel de una plantilla o de un desarrollo a medio terminar. Comunica con claridad qué hace la empresa, respalda esa propuesta con contenido real (capacidades, instalaciones, maquinaria, proyectos y clientes verificables) y aplica un sistema de diseño industrial consistente en color, tipografía, motion e iconografía propia. La calidad de implementación frontend —accesibilidad, rendimiento de imágenes y fuentes, estados interactivos— está por encima del promedio del sector.

No está perfecta: la mezcla de radios de esquina, la página de Contacto fuera de patrón, los contrastes débiles del footer y un par de detalles (eyebrow huérfano, galería dependiente de contenido) impiden darle la máxima nota. Pero **ninguno de esos puntos es bloqueante ni estructural**: son ajustes de consistencia y accesibilidad acotados.

**Veredicto:** lista para producción con observaciones menores. Resueltas las cuatro o cinco recomendaciones de prioridad alta —especialmente unificar radios, subir contrastes del footer y dar título visible a Contacto— el sitio queda en condiciones de transmitir plenamente la seriedad y solidez técnica que corresponde a una empresa con más de 40 años de trayectoria en ingeniería hidromecánica.
