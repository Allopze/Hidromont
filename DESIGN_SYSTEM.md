# DESIGN_SYSTEM.md

# Sistema de diseño web — Hidromont Chile S.A.

Este documento define una base práctica para diseñar e implementar el sitio web de Hidromont Chile S.A. Su objetivo es mantener coherencia visual, claridad técnica y una experiencia profesional en todos los puntos de contacto digitales.

La identidad propuesta se basa en una marca industrial, técnica y especializada en ingeniería, fabricación y montaje de equipos hidromecánicos. El sistema está pensado para interfaces web institucionales, landings comerciales, páginas de servicios, fichas de proyectos y componentes reutilizables.

---

## 1. Principios de diseño

### 1.1 Precisión técnica

La interfaz debe comunicar orden, claridad y capacidad de ejecución. Cada bloque visual debe tener una función concreta: informar, orientar, destacar una capacidad técnica o facilitar contacto.

### 1.2 Solidez industrial

El diseño debe sentirse robusto, confiable y sobrio. Se recomiendan estructuras limpias, grillas evidentes, buen espaciado y una jerarquía visual firme.

### 1.3 Claridad operativa

El contenido debe ser fácil de escanear. Los usuarios deben entender rápidamente qué hace la empresa, qué servicios ofrece, qué experiencia tiene y cómo contactarla.

### 1.4 Sobriedad visual

Evitar recursos decorativos innecesarios. El diseño debe apoyarse en color, tipografía, fotografía técnica, iconografía consistente y componentes simples. Nada de convertir el sitio en una feria de efectos porque algún humano descubrió los gradientes.

---

## 2. Personalidad visual

La marca debe proyectar:

- Ingeniería aplicada.
- Especialización hidromecánica.
- Experiencia industrial.
- Precisión en fabricación y montaje.
- Confianza técnica.
- Capacidad de ejecución en terreno.
- Orden, seguridad y profesionalismo.

### Palabras clave

`precisión`, `resistencia`, `montaje`, `ingeniería`, `fabricación`, `estructura`, `agua`, `industria`, `mecánica`, `confiabilidad`.

---

## 3. Paleta de color

### 3.1 Colores principales

| Token | Nombre | HEX | RGB | Uso |
|---|---|---:|---:|---|
| `--color-primary` | Azul Hidromont | `#0065A9` | `0, 101, 169` | Marca, botones principales, enlaces, íconos clave |
| `--color-primary-dark` | Azul técnico oscuro | `#004B7D` | `0, 75, 125` | Hover, encabezados, fondos técnicos |
| `--color-primary-light` | Azul claro técnico | `#E6F2FA` | `230, 242, 250` | Fondos suaves, tarjetas destacadas |
| `--color-accent` | Celeste operativo | `#00A6D6` | `0, 166, 214` | Indicadores, acentos, gráficos, estados activos |

### 3.2 Colores neutros

| Token | Nombre | HEX | Uso |
|---|---|---:|---|
| `--color-text` | Gris carbón | `#1F2933` | Texto principal |
| `--color-text-muted` | Gris técnico | `#5B6770` | Texto secundario, bajadas, metadatos |
| `--color-border` | Gris estructural | `#D9E2EC` | Bordes, divisores, inputs |
| `--color-surface` | Superficie | `#FFFFFF` | Tarjetas, bloques, contenedores |
| `--color-background` | Fondo base | `#FFFFFF` | Fondo principal |
| `--color-background-alt` | Fondo alternativo | `#F5F8FA` | Secciones alternas |
| `--color-background-strong` | Fondo técnico profundo | `#0F2433` | Secciones hero o bloques de alto impacto |

### 3.3 Colores semánticos

| Token | Nombre | HEX | Uso |
|---|---|---:|---|
| `--color-success` | Verde estado | `#2E7D32` | Confirmaciones, estados correctos |
| `--color-warning` | Ámbar advertencia | `#B7791F` | Alertas preventivas |
| `--color-error` | Rojo error | `#C62828` | Errores, validaciones críticas |
| `--color-info` | Azul información | `#0065A9` | Mensajes informativos |

### 3.4 Proporción recomendada

- 60% fondos claros y superficies neutras.
- 25% textos, bordes y grises estructurales.
- 10% azul institucional.
- 5% acentos celestes y estados destacados.

El azul debe funcionar como un recurso de autoridad visual, no como pintura lanzada con manguera sobre cada componente.

---

## 4. Tipografía

### 4.1 Familias recomendadas

| Uso | Fuente | Peso sugerido | Motivo |
|---|---|---:|---|
| Títulos | `Roboto Condensed` | 600–700 | Refuerza carácter técnico, compacto e industrial |
| Texto general | `Inter` | 400–500 | Alta legibilidad en interfaces digitales |
| Navegación y botones | `Inter` | 600 | Claridad y lectura rápida |
| Datos técnicos | `Roboto Mono` | 400–500 | Ideal para medidas, códigos, cifras y especificaciones |

### 4.2 Importación sugerida

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Condensed:wght@600;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### 4.3 Escala tipográfica

| Token | Elemento | Desktop | Mobile | Peso | Line-height |
|---|---|---:|---:|---:|---:|
| `--font-size-display` | Hero / display | 64px | 42px | 700 | 1.05 |
| `--font-size-h1` | H1 | 56px | 38px | 700 | 1.1 |
| `--font-size-h2` | H2 | 40px | 32px | 700 | 1.15 |
| `--font-size-h3` | H3 | 28px | 24px | 600 | 1.25 |
| `--font-size-h4` | H4 | 22px | 20px | 600 | 1.3 |
| `--font-size-body-lg` | Texto destacado | 18px | 17px | 400 | 1.6 |
| `--font-size-body` | Texto base | 16px | 16px | 400 | 1.6 |
| `--font-size-small` | Texto menor | 14px | 14px | 400 | 1.5 |
| `--font-size-caption` | Caption / metadata | 12px | 12px | 500 | 1.4 |

### 4.4 Reglas tipográficas

- Usar `Roboto Condensed` para títulos, titulares de servicios y bloques de impacto.
- Usar `Inter` para párrafos, navegación, botones, formularios y UI general.
- Usar `Roboto Mono` solo para datos técnicos, medidas, códigos o cifras.
- Evitar párrafos largos en fuentes condensadas.
- Usar mayúsculas en etiquetas cortas, no en párrafos completos.
- Mantener una longitud de línea ideal entre 60 y 80 caracteres en textos de lectura.

---

## 5. Sistema de espaciado

Usar una escala basada en múltiplos de 4px.

| Token | Valor | Uso |
|---|---:|---|
| `--space-1` | 4px | Separaciones mínimas |
| `--space-2` | 8px | Separación entre icono y texto |
| `--space-3` | 12px | Padding compacto |
| `--space-4` | 16px | Padding base |
| `--space-5` | 20px | Separación media |
| `--space-6` | 24px | Gaps de cards |
| `--space-8` | 32px | Separación entre bloques |
| `--space-10` | 40px | Espaciado interno amplio |
| `--space-12` | 48px | Separación de secciones pequeñas |
| `--space-16` | 64px | Secciones estándar |
| `--space-20` | 80px | Secciones amplias |
| `--space-24` | 96px | Hero o bloques principales |
| `--space-32` | 128px | Separaciones de alto impacto |

### Uso recomendado

- Cards: `24px` a `32px` de padding.
- Secciones: `72px` a `120px` de padding vertical en desktop.
- Mobile: reducir secciones a `48px` a `72px`.
- Gaps de grilla: `24px` a `32px`.

---

## 6. Grilla y layout

### 6.1 Contenedores

| Token | Valor | Uso |
|---|---:|---|
| `--container-sm` | 640px | Contenido breve |
| `--container-md` | 768px | Artículos o textos |
| `--container-lg` | 1024px | Páginas estándar |
| `--container-xl` | 1200px | Landing principal |
| `--container-2xl` | 1320px | Secciones con grilla amplia |

### 6.2 Breakpoints

| Token | Valor |
|---|---:|
| `--breakpoint-sm` | 640px |
| `--breakpoint-md` | 768px |
| `--breakpoint-lg` | 1024px |
| `--breakpoint-xl` | 1280px |
| `--breakpoint-2xl` | 1536px |

### 6.3 Reglas de layout

- Usar grilla de 12 columnas en desktop.
- Usar 6 columnas en tablet.
- Usar 1 o 2 columnas en mobile.
- Mantener márgenes laterales mínimos de `24px` en mobile y `40px` en desktop.
- Priorizar alineación izquierda para contenido técnico.
- Reservar alineación centrada para bloques institucionales breves.

---

## 7. Bordes, radios y sombras

### 7.1 Radios

| Token | Valor | Uso |
|---|---:|---|
| `--radius-xs` | 2px | Líneas técnicas, badges pequeños |
| `--radius-sm` | 4px | Inputs, tags, elementos compactos |
| `--radius-md` | 8px | Botones, tarjetas simples |
| `--radius-lg` | 12px | Cards destacadas, contenedores amplios |
| `--radius-xl` | 16px | Bloques especiales |

La identidad debe tender a radios moderados. Demasiada redondez haría que una empresa industrial parezca app de meditación, y no estamos aquí para eso.

### 7.2 Sombras

| Token | Valor | Uso |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(15, 36, 51, 0.08)` | Cards sutiles |
| `--shadow-md` | `0 8px 24px rgba(15, 36, 51, 0.10)` | Hover o elementos destacados |
| `--shadow-lg` | `0 16px 40px rgba(15, 36, 51, 0.14)` | Modales o bloques principales |

Usar sombras con moderación. La estructura debe venir principalmente de espaciado, bordes y contraste.

---

## 8. Iconografía

### 8.1 Estilo

- Íconos lineales o sólidos de baja complejidad.
- Trazo consistente entre `1.75px` y `2px`.
- Esquinas rectas o levemente redondeadas.
- Uso preferente del azul institucional.
- Tamaños estándar: `20px`, `24px`, `32px`, `48px`.

### 8.2 Temas recomendados

- Ingeniería.
- Fabricación.
- Montaje.
- Equipos hidromecánicos.
- Agua e infraestructura hidráulica.
- Estructuras metálicas.
- Mantenimiento industrial.
- Seguridad operacional.
- Planos, medición, precisión.

### 8.3 Evitar

- Íconos caricaturescos.
- Estilos 3D.
- Gradientes decorativos.
- Mezclar familias de íconos.
- Detalles excesivos que se pierdan en tamaños pequeños.

---

## 9. Fotografía e imagen

### 9.1 Dirección fotográfica

La fotografía debe mostrar capacidades reales y contexto industrial.

Temas sugeridos:

- Equipos hidromecánicos.
- Procesos de fabricación.
- Montaje en terreno.
- Estructuras metálicas.
- Soldadura y mecanizado.
- Obras hidráulicas.
- Detalles de componentes.
- Personal técnico trabajando con equipamiento real.

### 9.2 Tratamiento visual

- Imágenes nítidas y sobrias.
- Contraste moderado.
- Color natural.
- Recortes amplios para mostrar escala.
- Planos detalle para comunicar precisión.
- Evitar filtros excesivos o efectos artificiales.

### 9.3 Overlays

Cuando se use texto sobre imagen:

- Aplicar overlay azul oscuro con opacidad entre `60%` y `75%`.
- Asegurar contraste suficiente para lectura.
- Evitar texto extenso sobre fotografía.
- Usar máximo un H1, una bajada y una llamada a la acción.

---

## 10. Componentes

## 10.1 Botones

### Botón primario

Uso: acciones principales.

```css
.btn-primary {
  background: var(--color-primary);
  color: #ffffff;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: 12px 20px;
  font-family: var(--font-body);
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  min-height: 44px;
}
```

Estados:

| Estado | Estilo |
|---|---|
| Default | Fondo `#0065A9`, texto blanco |
| Hover | Fondo `#004B7D`, borde `#004B7D` |
| Focus | Outline `3px solid rgba(0, 101, 169, 0.28)` |
| Disabled | Fondo `#D9E2EC`, texto `#5B6770` |

### Botón secundario

Uso: acciones alternativas.

```css
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  padding: 12px 20px;
  font-weight: 600;
  min-height: 44px;
}
```

### Botón terciario

Uso: enlaces dentro de cards o secciones.

```css
.btn-link {
  color: var(--color-primary);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 4px;
}
```

---

## 10.2 Header

### Estructura

- Logo a la izquierda.
- Navegación principal a la derecha.
- CTA visible en desktop.
- Menú colapsable en mobile.

### Altura recomendada

| Dispositivo | Altura |
|---|---:|
| Desktop | 80px |
| Tablet | 72px |
| Mobile | 64px |

### Navegación sugerida

- Inicio.
- Servicios.
- Proyectos.
- Capacidades.
- Empresa.
- Contacto.

### Reglas

- Header limpio, con alto contraste.
- No saturar con demasiados ítems.
- Mantener CTA principal: `Solicitar cotización` o `Contactar`.

---

## 10.3 Hero

### Propósito

Presentar rápidamente qué hace Hidromont Chile S.A. y dirigir al usuario hacia contacto o servicios.

### Estructura recomendada

- Eyebrow técnico.
- Título H1 directo.
- Bajada de 1 a 2 líneas.
- CTA principal.
- CTA secundario.
- Imagen industrial o composición técnica.

### Ejemplo de copy

```text
Ingeniería, fabricación y montaje de equipos hidromecánicos

Soluciones técnicas para infraestructura hidráulica e industrial, con foco en precisión, fabricación especializada y ejecución en terreno.
```

---

## 10.4 Cards de servicio

### Uso

Mostrar servicios, capacidades o áreas de especialidad.

### Anatomía

- Ícono.
- Título.
- Descripción breve.
- Lista corta de capacidades o enlace.

### Estilo

```css
.service-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 32px;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.service-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

### Reglas de contenido

- Títulos cortos.
- Descripciones de máximo 2 líneas.
- Evitar listas extensas dentro de la card.
- Usar el enlace para ampliar detalle.

---

## 10.5 Bloques de capacidades

Uso: destacar experiencia, procesos, infraestructura, servicios técnicos o ventajas.

### Formato recomendado

- Título de sección.
- Bajada breve.
- Grilla de 3 o 4 elementos.
- Cada elemento con cifra, texto o ícono.

Ejemplos de elementos:

- Fabricación especializada.
- Montaje en terreno.
- Reparación de equipos.
- Ingeniería aplicada.
- Mantención industrial.
- Soluciones para obras hidráulicas.

---

## 10.6 Proyectos

### Card de proyecto

Anatomía:

- Imagen.
- Categoría.
- Nombre del proyecto.
- Descripción breve.
- Servicio relacionado.
- Año o ubicación si aplica.

### Estilo

- Imagen con proporción `4:3` o `16:9`.
- Borde sutil.
- Título en azul técnico oscuro.
- Metadata en gris técnico.
- Enlace con texto claro: `Ver proyecto`.

---

## 10.7 Formularios

### Campos

```css
.input {
  width: 100%;
  min-height: 44px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  font-family: var(--font-body);
  font-size: 16px;
  color: var(--color-text);
  background: #ffffff;
}

.input:focus {
  border-color: var(--color-primary);
  outline: 3px solid rgba(0, 101, 169, 0.18);
}
```

### Reglas

- Labels visibles, no solo placeholders.
- Mensajes de error claros.
- Campos obligatorios indicados con texto, no solo color.
- Botón de envío con estado loading.
- Confirmación visible después del envío.

### Campos recomendados para contacto

- Nombre.
- Empresa.
- Email.
- Teléfono.
- Servicio requerido.
- Mensaje.
- Archivo adjunto opcional si el sitio lo permite.

---

## 10.8 Badges y etiquetas

Uso: categorías, servicios, estados o sectores.

```css
.badge {
  display: inline-flex;
  align-items: center;
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
```

---

## 10.9 Tablas técnicas

Uso: especificaciones, capacidades, comparativas o datos de proyecto.

### Reglas

- Encabezados claros.
- Filas con suficiente padding.
- Bordes horizontales suaves.
- Evitar tablas muy anchas en mobile.
- Usar scroll horizontal controlado si es necesario.

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.table th {
  text-align: left;
  color: var(--color-primary-dark);
  font-weight: 700;
  background: var(--color-primary-light);
}

.table th,
.table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
}
```

---

## 10.10 Alertas

### Info

```css
.alert-info {
  background: var(--color-primary-light);
  border-left: 4px solid var(--color-primary);
  color: var(--color-text);
  padding: 16px;
  border-radius: var(--radius-md);
}
```

### Error

- Borde o ícono rojo.
- Mensaje específico.
- No depender solo del color.

---

## 11. Secciones sugeridas del sitio

### 11.1 Home

Orden recomendado:

1. Hero institucional.
2. Servicios principales.
3. Capacidades técnicas.
4. Proyectos destacados.
5. Sectores atendidos.
6. Sobre la empresa.
7. CTA de contacto.

### 11.2 Página de servicios

- Hero breve.
- Grilla de servicios.
- Detalle por servicio.
- Procesos o metodología.
- CTA de cotización.

### 11.3 Página de proyectos

- Filtros por tipo de servicio o sector.
- Cards de proyecto.
- Ficha individual con descripción, alcance, imágenes y resultados.

### 11.4 Página empresa

- Historia.
- Especialización.
- Capacidades.
- Equipo o infraestructura si aplica.
- Certificaciones o estándares si existen.

### 11.5 Contacto

- Formulario.
- Datos de contacto.
- Ubicación.
- Horarios.
- CTA claro.

---

## 12. UX writing

### 12.1 Tono

El texto debe ser:

- Técnico.
- Claro.
- Directo.
- Confiable.
- Orientado a soluciones.

### 12.2 Reglas de escritura

- Usar frases cortas.
- Evitar promesas vagas.
- Priorizar verbos de acción.
- Explicar capacidades con términos concretos.
- Respaldar afirmaciones con datos cuando existan.

### 12.3 Microcopy recomendado

Botones:

- `Solicitar cotización`
- `Ver servicios`
- `Conocer proyectos`
- `Contactar equipo técnico`
- `Enviar consulta`

Mensajes:

- `Tu mensaje fue enviado correctamente. Te contactaremos a la brevedad.`
- `Revisa los campos marcados antes de enviar.`
- `Adjunta archivos técnicos si necesitas compartir planos, fichas o antecedentes.`

---

## 13. Accesibilidad

### 13.1 Contraste

- Texto normal: relación mínima `4.5:1`.
- Texto grande: relación mínima `3:1`.
- Botones y elementos interactivos: contraste claro entre fondo, texto y borde.

### 13.2 Interacción

- Todos los elementos interactivos deben ser accesibles por teclado.
- Usar estados `hover`, `focus`, `active` y `disabled`.
- Área mínima táctil: `44px x 44px`.
- No depender únicamente del color para comunicar errores o estados.

### 13.3 Contenido

- Imágenes con `alt` descriptivo.
- Formularios con `label` visible.
- Jerarquía de encabezados correcta.
- Enlaces con texto descriptivo.
- Evitar textos como `clic aquí`, ese fósil debería estar en un museo.

---

## 14. Animación y movimiento

### 14.1 Duraciones

| Token | Valor | Uso |
|---|---:|---|
| `--motion-fast` | 120ms | Hover simple |
| `--motion-base` | 180ms | Transiciones UI |
| `--motion-slow` | 240ms | Cards o despliegues |

### 14.2 Easing

| Token | Valor |
|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `--ease-emphasized` | `cubic-bezier(0.2, 0, 0, 1)` |

### 14.3 Reglas

- Usar animaciones sutiles.
- Evitar rebotes o efectos lúdicos.
- Respetar `prefers-reduced-motion`.
- Animar opacidad, posición y sombra con moderación.

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 15. Tokens CSS base

```css
:root {
  /* Colors */
  --color-primary: #0065A9;
  --color-primary-dark: #004B7D;
  --color-primary-light: #E6F2FA;
  --color-accent: #00A6D6;

  --color-text: #1F2933;
  --color-text-muted: #5B6770;
  --color-border: #D9E2EC;
  --color-surface: #FFFFFF;
  --color-background: #FFFFFF;
  --color-background-alt: #F5F8FA;
  --color-background-strong: #0F2433;

  --color-success: #2E7D32;
  --color-warning: #B7791F;
  --color-error: #C62828;
  --color-info: #0065A9;

  /* Fonts */
  --font-heading: "Roboto Condensed", Arial, sans-serif;
  --font-body: "Inter", Arial, sans-serif;
  --font-mono: "Roboto Mono", monospace;

  /* Font sizes */
  --font-size-display: clamp(2.625rem, 5vw, 4rem);
  --font-size-h1: clamp(2.375rem, 4vw, 3.5rem);
  --font-size-h2: clamp(2rem, 3vw, 2.5rem);
  --font-size-h3: clamp(1.5rem, 2vw, 1.75rem);
  --font-size-h4: 1.375rem;
  --font-size-body-lg: 1.125rem;
  --font-size-body: 1rem;
  --font-size-small: 0.875rem;
  --font-size-caption: 0.75rem;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;

  /* Radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(15, 36, 51, 0.08);
  --shadow-md: 0 8px 24px rgba(15, 36, 51, 0.10);
  --shadow-lg: 0 16px 40px rgba(15, 36, 51, 0.14);

  /* Layout */
  --container-sm: 640px;
  --container-md: 768px;
  --container-lg: 1024px;
  --container-xl: 1200px;
  --container-2xl: 1320px;

  /* Motion */
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
}
```

---

## 16. Base CSS recomendada

```css
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: var(--font-body);
  font-size: var(--font-size-body);
  line-height: 1.6;
  color: var(--color-text);
  background: var(--color-background);
  text-rendering: optimizeLegibility;
}

img,
picture,
video,
canvas,
svg {
  display: block;
  max-width: 100%;
}

a {
  color: var(--color-primary);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

a:hover {
  color: var(--color-primary-dark);
}

h1,
h2,
h3,
h4 {
  margin: 0 0 var(--space-4);
  font-family: var(--font-heading);
  color: var(--color-primary-dark);
  line-height: 1.15;
  letter-spacing: -0.01em;
}

p {
  margin: 0 0 var(--space-4);
}

.container {
  width: min(100% - 48px, var(--container-xl));
  margin-inline: auto;
}

.section {
  padding-block: var(--space-20);
}

.section-alt {
  background: var(--color-background-alt);
}

.eyebrow {
  display: inline-block;
  margin-bottom: var(--space-3);
  color: var(--color-primary);
  font-size: var(--font-size-caption);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
```

---

## 17. Tailwind config sugerido

```js
/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0065A9',
          dark: '#004B7D',
          light: '#E6F2FA',
        },
        accent: '#00A6D6',
        text: {
          DEFAULT: '#1F2933',
          muted: '#5B6770',
        },
        border: '#D9E2EC',
        surface: '#FFFFFF',
        background: {
          DEFAULT: '#FFFFFF',
          alt: '#F5F8FA',
          strong: '#0F2433',
        },
        success: '#2E7D32',
        warning: '#B7791F',
        error: '#C62828',
      },
      fontFamily: {
        heading: ['Roboto Condensed', 'Arial', 'sans-serif'],
        body: ['Inter', 'Arial', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace'],
      },
      borderRadius: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(15, 36, 51, 0.08)',
        md: '0 8px 24px rgba(15, 36, 51, 0.10)',
        lg: '0 16px 40px rgba(15, 36, 51, 0.14)',
      },
      maxWidth: {
        container: '1200px',
        wide: '1320px',
      },
    },
  },
};
```

---

## 18. Do / Don't

### Do

- Usar el azul institucional como eje visual.
- Mantener layouts limpios y estructurados.
- Usar fotografía real industrial cuando sea posible.
- Crear jerarquías claras con títulos condensados y texto legible.
- Mantener CTAs visibles y directos.
- Reutilizar componentes para consistencia.

### Don't

- Sobrecargar la interfaz con efectos decorativos.
- Usar demasiadas variantes de azul.
- Escribir bloques extensos en mayúsculas.
- Mezclar estilos de íconos.
- Usar fotografías genéricas que no parezcan del rubro.
- Reducir el contraste por estética.
- Hacer botones sin estados de interacción.

---

## 19. Checklist de implementación

Antes de publicar una página, revisar:

- [ ] El H1 comunica claramente el propósito de la página.
- [ ] La paleta usa los tokens definidos.
- [ ] Los botones tienen estados hover, focus, active y disabled.
- [ ] Los formularios tienen labels visibles.
- [ ] Las imágenes tienen texto alternativo.
- [ ] El contenido se lee bien en mobile.
- [ ] Las cards mantienen padding y altura consistentes.
- [ ] El contraste cumple criterios básicos de accesibilidad.
- [ ] Los enlaces son descriptivos.
- [ ] El CTA principal aparece sin competir con demasiados elementos.
- [ ] No hay estilos improvisados fuera del sistema.
- [ ] La página mantiene una estética técnica, sobria y confiable.

---

## 20. Recomendación final

Este sistema debe servir como base inicial para construir un sitio web institucional coherente, escalable y fácil de mantener. La dirección visual recomendada es clara: diseño técnico, estructura fuerte, color institucional bien dosificado, tipografía legible y componentes funcionales.

La marca gana más cuando transmite precisión y experiencia que cuando intenta parecer moderna a fuerza de adornos. La industria ya tiene suficientes máquinas ruidosas; el sitio no necesita ser otra.
