# Plan de implementación — Galería (`/galeria`)

> **Fecha:** 2026-08-04
> **Alcance:** `src/pages/galeria/index.astro`, `src/components/gallery/*`, `src/data/gallery.{ts,json}`, la capa de galería del CMS (`cms/{controllers,services,repositories}/Gallery*`, `cms/services/exportService.ts`, `src/scripts/cms-overlay.js`) y los assets bajo `public/fotos/proyectos/` + `public/gallery/derived/`.
> **Base:** auditoría del 2026-08-04 (25 hallazgos). Evidencia recogida con inspección de datos, consultas a `cms/data/hidromont-cms.sqlite` y renderizado en vivo con Playwright (1440×1000, 1440×800, 390×844, lightbox abierto).
> **Estado inicial:** 168 fotos · 22 álbumes · 8 categorías en el sitio; 23 fotos · 0 álbumes · 5 categorías en el CMS.
>
> **Progreso:** ver §11 — Registro de ejecución, al final del documento.

---

## 1. Cómo leer este plan

Cinco fases, pensadas para ejecutarse **en orden**. La dependencia real es solo una pero es dura: la **Fase 0** decide cuál de las dos fuentes de datos gana. Mientras eso no esté resuelto, cualquier trabajo sobre metadatos (Fase 1) o sobre el CMS (Fase 4) se puede perder al primer `Exportar`.

Las fases 2, 3 y 5 son independientes entre sí y de la 0/1: si hace falta mostrar avance visible antes de terminar el rescate de datos, se pueden adelantar.

| Fase  | Qué resuelve                          | Bloquea a | Esfuerzo                |
| ----- | ------------------------------------- | --------- | ----------------------- |
| **0** | Resincronizar CMS ↔ `gallery.json`    | 1, 4      | ~1 día                  |
| **1** | Calidad de fotos y metadatos          | —         | ~1,5 días (+ redacción) |
| **2** | Arquitectura de información y filtros | —         | ~1 día                  |
| **3** | Lightbox: accesibilidad y layout      | —         | ~0,5 día                |
| **4** | Personalización desde el CMS          | —         | ~1,5 días               |
| **5** | Peso, limpieza y deuda menor          | —         | ~0,5 día                |

Cada tarea lleva un ID (`GAL-n`) para trazar commits. Las que necesitan una decisión de negocio están marcadas **⚠️ requiere decisión** y se listan juntas en §8.

---

## 2. Fase 0 — Rescate de datos (bloqueante)

El problema: `src/data/gallery.json` (168 fotos, 22 álbumes, 8 categorías) es lo que ve el visitante, pero se regenera desde SQLite (23 fotos, 0 `project_slug`, 5 categorías con otros nombres) en cuanto alguien toca `Exportar y validar` en el overlay o corre `npm run cms:export`. Ambos caminos terminan en [`exportService.ts:229`](../cms/services/exportService.ts#L229) → `POST /api/cms/export` → `exportContentWithGallery()`, y `POST /api/cms/publish` → `publishContent()`.

Las 118 fotos de proyectos entraron por [`scripts/process-top-photos.mjs`](../scripts/process-top-photos.mjs), que escribe `gallery.json` directo sin pasar por la base.

**Dirección elegida:** `gallery.json` es la fuente de verdad _actual_; se importa a SQLite y desde ahí la DB pasa a ser la fuente de verdad permanente. Lo contrario (que el script siga escribiendo el JSON) deja el CMS inservible para siempre.

### GAL-1 · Congelar el export mientras dure la migración

Para que nadie destruya el contenido en el intervalo entre hoy y el fin de la Fase 0.

- Añadir una guarda en `exportGallery()`: si el número de items publicados en la DB es menor que el número de items del `gallery.json` existente en disco, abortar con un error explicativo en vez de sobrescribir.
- Hacerla saltable con una variable de entorno (`CMS_ALLOW_GALLERY_SHRINK=1`) para el momento en que la reducción sí sea intencional (borrar fotos de verdad).

**Aceptación:** con la DB en su estado actual, `npm run cms:export` falla con un mensaje claro y `gallery.json` queda intacto (168 items).
**Archivos:** `cms/services/exportService.ts`.
**Nota:** esta guarda es permanente, no temporal — protege contra el mismo accidente en el futuro.

### GAL-2 · Registrar en `media_assets` las fotos que faltan

106 de las 118 fotos bajo `/fotos/proyectos/` no tienen fila en `media_assets`, así que el CMS no puede ni listarlas ni asignarles punto focal.

- Script `cms/scripts/sync-media-from-public.ts` (o extender el sync inverso existente): recorre `public/fotos/proyectos/**`, y por cada archivo no registrado inserta un `media_asset` con `path`, `name`, `mime`, `width`/`height` reales leídos con `sharp`, `size`, `checksum` y `focal_x`/`focal_y` en 0.5.
- Idempotente: si ya existe una fila con ese `path` y mismo `checksum`, no hace nada.

**Aceptación:** `select count(*) from media_assets where path like '/fotos/proyectos/%'` pasa de 59 a ≥ 118, y las dimensiones registradas coinciden con las reales del archivo.

### GAL-3 · Resolver el origen de las fotos derivadas

50 fotos de `gallery.json` apuntan a `/gallery/derived/<hash>-<w>.webp` en vez de a un archivo fuente. Rastreo hecho sobre 5.802 archivos de `public/fotos`, `public/uploads` y `assets/originales/top/`:

| Situación                                              | Cantidad | Tratamiento                                                                                             |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| El `id` del item existe en la DB → `media_id` conocido | 10       | Reutilizar el `media_asset` existente                                                                   |
| Sin fuente recuperable, pero con variante 1600w        | 39       | Promover `<hash>-1600.webp` a fuente: copiar a `public/fotos/galeria/` y registrarlo como `media_asset` |
| Sin fuente y con máximo 1024w o 640w                   | 11       | Igual que arriba con la mayor variante disponible; **marcar para reemplazo** por el original si aparece |

Los hashes de `process-top-photos.mjs` (md5 de la **ruta**) y los de `ImageService` (md5 de los **bytes**) son incompatibles, por eso no hay un mapeo genérico posible. La promoción de la variante mayor es la salida limpia: pierde resolución respecto al original perdido, pero deja el pipeline coherente y reversible si el original reaparece.

**Aceptación:** los 50 items derivados tienen un `media_id` válido que apunta a un archivo existente en disco.
**⚠️ requiere decisión:** confirmar si los originales de esas 40 fotos existen en algún respaldo (carpetas `assets/originales/Pangal/`, `assets/originales/Canal Chacayes/`, `assets/originales/Dron Rio Colorado/`, `assets/originales/GASCO/` del working tree, o fuera del repo). Si aparecen, se saltan las filas 2 y 3 de la tabla.

### GAL-4 · Importar categorías y álbumes a la DB

- Categorías: crear en `gallery_categories` las 8 de `gallery.json` (`compuertas`, `infraestructuras`, `limpiarrejas`, `otros-montajes`, `tanques-especiales`, `tuberias-forzadas`, `turbinas`, `valvulas`), respetando `position`. Las 5 viejas (`taller`, `montaje`, `tuberias`, `equipos`, `otros`) quedan sin items → borrarlas tras verificar que ningún item las referencia.
- Nueva tabla `gallery_albums` (o `gallery_projects`): `slug` (PK), `name`, `position`, `created_at`, `updated_at`. Semilla con los 22 pares de `PROJECT_NAME_MAP` ([`gallery.ts:47-70`](../src/data/gallery.ts#L47-L70)). Esto es lo que después habilita GAL-19.
- Migración idempotente en `cms/db/schema.ts`, siguiendo el patrón de las migraciones existentes.

**Aceptación:** `gallery_categories` tiene 8 filas con los slugs correctos; `gallery_albums` tiene 22.

### GAL-5 · Importar los 168 items

Script `cms/scripts/import-gallery-json.ts`:

1. Lee `src/data/gallery.json`.
2. Por cada item: resuelve `media_id` (GAL-2/GAL-3), `category_id` por slug, y escribe `project_slug`, `title`, `alt`, `caption`, `position`, `featured`, `status='published'`.
3. Conserva el `id` del JSON cuando existe, para no romper referencias.
4. Corre dentro de una transacción y, antes de empezar, hace backup con `npm run cms:backup`.
5. Los 4 items que están en la DB pero no en el JSON (contenido viejo) se marcan `status='draft'` en vez de borrarse.

**Aceptación — la prueba de fuego de toda la fase:**

```bash
npm run cms:backup
cp src/data/gallery.json /tmp/gallery-antes.json
npx tsx cms/scripts/import-gallery-json.ts
CMS_ALLOW_GALLERY_SHRINK=1 npm run cms:export
node -e "
  const a=require('/tmp/gallery-antes.json'), b=require('./src/data/gallery.json');
  const k=i=>[i.id,i.title,i.alt,i.caption,i.categorySlug,i.projectSlug,i.featured,i.position].join('|');
  const A=new Set(a.items.map(k)), B=new Set(b.items.map(k));
  console.log('items antes/después:', a.items.length, b.items.length);
  console.log('solo antes:', [...A].filter(x=>!B.has(x)).length);
  console.log('solo después:', [...B].filter(x=>!A.has(x)).length);
"
```

Debe reportar `168 168`, `solo antes: 0`, `solo después: 0`. Los campos `src`/`srcset`/`lqip`/`width`/`height` **sí** van a cambiar, y para bien: los regenera `ImageService` (ver GAL-7/GAL-8).

### GAL-6 · Retirar el script paralelo

`scripts/process-top-photos.mjs` escribe `gallery.json` directamente. Una vez importado todo, ese camino es un arma cargada.

- Quitar de él la escritura a `src/data/gallery.json` (la Fase 1 de optimización a `public/fotos/curadas/` puede quedarse, es inofensiva).
- Documentar en su cabecera que la galería se administra por CMS.
- Añadir un test unitario que falle si algún archivo bajo `scripts/` vuelve a escribir `src/data/gallery.json`.

**Aceptación:** `grep -rl "src/data/gallery.json" scripts/` no devuelve nada que escriba.

---

## 3. Fase 1 — Calidad de fotos y metadatos

### GAL-7 · Regenerar derivados responsive para las 122 fotos que no los tienen

122 de 168 fotos sirven **una sola resolución**: un archivo de 1600px que se muestra en tarjetas de 382px. La causa es que `gallery.json` fue escrito a mano en vez de pasar por `ImageService.generateDerivatives()`, que sí genera 640/1024/1600 + LQIP.

Con la Fase 0 hecha, esto es automático: el export regenera todo. Solo hay que verificar que corre y que los derivados quedan escritos.

**Aceptación:** ningún item de `gallery.json` tiene un `srcset` de un solo candidato (salvo originales genuinamente menores a 640px, que hay que listar y reemplazar).

```bash
node -e "const g=require('./src/data/gallery.json');
  const s=g.items.filter(i=>i.srcset.split(',').length===1);
  console.log('single-candidate:', s.length); s.forEach(i=>console.log(' ', i.width+'px', i.src));"
```

### GAL-8 · Corregir dimensiones y LQIP

Efecto secundario del mismo export, pero conviene verificarlo aparte porque hoy está mal en dos formas distintas:

- 106 de 118 items declaran dimensiones falsas (`1200x900` fijo).
- 22 declaran un **aspect ratio equivocado**, lo que causa CLS en la grilla y letterboxing en el lightbox. Ejemplos: `ch-queltehues/20160323_144441.webp` declara 4:3 y es 16:9; `taller-hidromont/hero.webp` declara 4:3 y es 2.33:1; `ch-los-condores/20140331_182205.webp` declara horizontal y es vertical.
- 94 no tienen LQIP, así que el div de blur-up queda con `background-image:url('')`.

**Aceptación:** para todo item, las dimensiones declaradas coinciden con las reales del archivo en `src` (±0), y `lqip` empieza por `data:image/webp;base64,`.

### GAL-9 · Normalizar los nombres de archivo con espacios

17 archivos tienen espacios y paréntesis en el nombre (`Tratamiento de Superficies Tubería Lican ().webp`, `cayupe dos 184.webp`, `Bifurcación    C. H. Trueno ().webp`, `Fresadora puente.webp`, …). Además de romper el `srcset`, ensucian las URLs con `%20` y `%CC%81`.

- Renombrar a kebab-case sin acentos: `tratamiento-superficies-tuberia-lican-1.webp`.
- Actualizar `media_assets.path` en la misma transacción.
- Verificar que no queden referencias en `src/content/proyectos/*.md`.

**Aceptación:** `find public/fotos -name "* *"` no devuelve nada; el sitio construye y ninguna imagen 404ea.

### GAL-10 · Reescribir títulos, `alt` y descripciones

**El hallazgo de contenido más grave: 94 de 168 fotos (56%) tienen metadatos de relleno.**

```
title: "C.H. Pangal — Foto 1"          alt: "20171222 162848"
title: "C.H. Los Hierros — Foto 1"     alt: "Dsc00150"
title: "C.H. Trueno — Foto 1"          alt: "BifurcacióN    C. H. Trueno ()"
title: "C.H. Lican — Foto 1"           alt: "Tratamiento De Superficies TuberíA Lican ()"
```

Ninguna tiene descripción, así que en el lightbox se ve la foto, el rótulo "C.H. PANGAL — FOTO 1" y nada más. Un lector de pantalla anuncia "Dsc cero cero uno cinco cero". Es además desperdicio puro de SEO: 94 imágenes de obra real sin una palabra indexable.

Trabajo en dos partes:

1. **Técnico (rápido).** Arreglar la función de capitalización que produce `TuberíA` y `BifurcacióN` (rompe al hacer title-case sobre caracteres acentuados), y dejar de derivar `alt` del nombre de archivo. Un `alt` vacío es preferible a `Dsc00150`: el vacío se ignora, el basura se lee en voz alta.
2. **Editorial (el grueso).** Redactar 94 descripciones. Se pueden proponer borradores a partir del proyecto, la categoría y lo que se ve en cada foto, pero **necesitan revisión de alguien de Hidromont** que sepa qué pieza es cada una — poner "montaje de tubería forzada" sobre lo que en realidad es un blindaje de túnel es peor que no poner nada.

Criterio por foto: `title` describe la pieza o maniobra (no "Foto 3"); `alt` describe lo que se ve para quien no la puede ver; `caption` aporta el dato técnico o de contexto que un cliente potencial valoraría.

**Aceptación:** 0 items con `title` que matchee `/— Foto \d+$/`; 0 items con `alt` que matchee `/^[A-Za-z]{0,4}[\d _-]+$/`; ≥ 90 % con `caption`.
**⚠️ requiere decisión:** quién redacta y quién valida técnicamente.

### GAL-11 · Reemplazar las portadas de baja resolución

Algunas portadas de álbum son más chicas que el espacio donde se muestran y se ven escaladas: `curadas/compuertas.jpg` mide 225×319 y se dibuja a 475×300. Revisar las 22 portadas y sustituir las que no lleguen a 1024px de ancho por otra foto del mismo álbum.

**Aceptación:** ninguna portada tiene ancho natural menor al ancho renderizado en desktop (475px @1x, 950 @2x).

---

## 4. Fase 2 — Arquitectura de información y filtros

### GAL-12 · Separar servicios de proyectos ⚠️ requiere decisión

Hoy la grilla mezcla dos cosas que no son comparables. Las primeras seis tarjetas no son proyectos:

| Tarjeta                             | Fotos |
| ----------------------------------- | ----- |
| Compuertas                          | 1     |
| Limpiarrejas                        | 1     |
| Turbinas Hidráulicas                | 1     |
| Montajes y Fabricaciones Especiales | 1     |
| Válvulas Hidráulicas                | 3     |
| Tuberías Forzadas y Blindajes       | 12    |

Abrir un "álbum" de una foto es un callejón sin salida, y las seis duplican el filtro de categorías que ya está justo arriba. Conviven con 16 álbumes de proyecto real de 4 a 15 fotos.

Tres salidas posibles:

- **(a) Redistribuir.** Mover esas 19 fotos al álbum del proyecto al que pertenecen y eliminar los `servicio-*`. La grilla queda con 16 álbumes homogéneos. Es la opción más limpia, pero exige saber de qué obra salió cada foto.
- **(b) Absorber.** Las fotos de servicio migran a las páginas de servicio (`/servicios/[slug]`, que ya tienen galería propia vía `service-galleries.ts`) y salen de `/galeria`.
- **(c) Umbral mínimo.** Ocultar de la grilla todo álbum con menos de N fotos (N=3 ó 4). Es una tirita: los `servicio-*` de 12 y 3 fotos siguen ahí.

Recomiendo **(a)**, con **(b)** para lo que no se pueda atribuir a un proyecto.

**Aceptación:** todos los álbumes visibles representan un proyecto u obra; ninguno tiene menos de 3 fotos.

### GAL-13 · Que el contador del filtro diga la verdad

El desplegable dice "Tuberías Forzadas y Blindajes (101)" pero cuenta **fotos** mientras filtra **álbumes**: al elegirlo aparecen 8 tarjetas. Y como el álbum hereda la categoría de su portada ([`ProjectAlbumCard.astro:27`](../src/components/gallery/ProjectAlbumCard.astro#L27)), **24 fotos categorizadas como tuberías forzadas viven en álbumes rotulados con otra categoría** (`ch-queltehues`, `ch-los-hierros`, `ch-peuchen`) y no aparecen jamás bajo ese filtro.

- En `getProjectAlbums()` ([`gallery.ts:105`](../src/data/gallery.ts#L105)), calcular el **conjunto** de categorías presentes en el álbum, no la de la portada.
- Emitirlo como `data-categories="cat-a cat-b"` y hacer que el filtro matchee por pertenencia.
- Cambiar el contador del desplegable a número de álbumes: `Tuberías Forzadas y Blindajes (11)`.

**Aceptación:** para cada categoría, el número del desplegable coincide exactamente con las tarjetas visibles al seleccionarla; y ninguna foto queda inalcanzable desde el filtro de su propia categoría.

```bash
# verificación: fotos huérfanas de su propio filtro
node -e "const g=require('./src/data/gallery.json');
  const m={}; g.items.forEach(i=>{(m[i.projectSlug]=m[i.projectSlug]||new Set()).add(i.categorySlug)});
  let bad=0; g.items.forEach(i=>{ if(!m[i.projectSlug].has(i.categorySlug)) bad++; });
  console.log('inalcanzables:', bad);"
```

### GAL-14 · Ampliar el alcance de la búsqueda

Hoy solo mira `data-project-name` ([`galeria/index.astro:256`](../src/pages/galeria/index.astro#L256)). Buscar "compuerta" no encuentra C.H. San Pedro, que son 12 fotos de compuertas.

- Añadir a la tarjeta un `data-search` con nombre de álbum + nombre de categoría + títulos y descripciones de sus fotos, normalizado sin diacríticos (la función `normalizeForSearch` ya existe).
- Mantener el filtro de categoría y la búsqueda combinándose con AND, como ahora.
- Cuidado con el peso: `data-search` de 22 tarjetas con todos los títulos añade pocos KB, es aceptable.

**Aceptación:** buscar "compuerta" devuelve C.H. San Pedro, C.H. Canal Chacayes y el álbum de compuertas; buscar "coihaique" sin tilde sigue encontrando Coyhaique.

### GAL-15 · Mostrar la categoría en la tarjeta

La tarjeta solo muestra el contador de fotos, así que al aplicar un filtro el usuario no entiende por qué desapareció lo que estaba mirando. Añadir un badge de categoría (o de categorías, tras GAL-13) junto al contador, con el estilo mono en mayúsculas que ya usa el resto de la página.

**Aceptación:** cada tarjeta muestra su categoría; la relación entre filtro y tarjetas visibles es evidente sin abrir nada.

### GAL-16 · Estado del lightbox en la URL

El visor no toca la URL. No se puede compartir una foto ni un álbum, y en móvil el botón Atrás sale de la página en vez de cerrar el visor — que es el gesto que el 100 % de los usuarios de Android va a intentar.

- Al abrir un álbum: `history.pushState` a `?album=<slug>&foto=<n>`.
- Al navegar entre fotos: `replaceState` (no ensuciar el historial con 15 entradas).
- Al cerrar: `history.back()` si la entrada es nuestra.
- `popstate` cierra el visor o cambia de foto según corresponda.
- Al cargar la página con esos parámetros, abrir el visor en la foto indicada.

Ojo con la interacción con el deep-link por hash de categoría que ya existe (`/galeria#tuberias`, [`galeria/index.astro:238`](../src/pages/galeria/index.astro#L238)): usar query params para el visor y dejar el hash para el filtro evita el choque.

**Aceptación:** compartir la URL abre la misma foto; Atrás cierra el visor y deja la grilla con el filtro que estaba activo.

---

## 5. Fase 3 — Lightbox: accesibilidad y layout

### GAL-17 · Arreglar el focus trap y el layout del panel

Dos bugs concretos, ambos en [`Lightbox.astro`](../src/components/gallery/Lightbox.astro):

**El CTA "Ver Proyecto Relacionado" es inalcanzable por teclado.** El trap usa `querySelectorAll('button, [tabindex]')` ([línea 536](../src/components/gallery/Lightbox.astro#L536)), que no matchea el `<a>`. Al llegar al botón "siguiente" — el último de esa lista — el Tab salta de vuelta al primero y el enlace nunca recibe foco.
→ Cambiar el selector a uno completo (`a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])`) y **filtrar los ocultos**, porque el enlace lleva `hidden` cuando el álbum no tiene página de proyecto y un trap que enfoca elementos invisibles es igual de roto.

**El panel de metadatos queda pegado al borde inferior.** Medido: `metaBottom === innerHeight` tanto en 1440×800 como en 390×844. Con descripciones largas el texto toca el borde y el CTA se corta.
→ El stage usa `max-h-[72vh] md:max-h-[78vh]` fijo sin descontar la barra superior ni el panel. Pasar el contenedor a `flex` con la imagen en `min-h-0 flex-1` y el panel en `shrink-0`, de modo que la imagen ceda el alto que el texto necesite en vez de empujarlo fuera. Añadir `padding-bottom` con `env(safe-area-inset-bottom)` para iPhone.

**Aceptación:** con teclado se llega al CTA y el ciclo de Tab lo incluye; el panel completo es visible en 1440×800, 1366×768 y 390×844 con la descripción más larga del catálogo.

### GAL-18 · Anunciar los cambios de foto

El contador "3 / 13" y el título cambian en silencio para lectores de pantalla. Añadir una región `aria-live="polite"` que anuncie `"Foto 3 de 13: <título>"` al navegar — el mismo patrón que ya se usa para los resultados del filtro en la grilla ([`galeria/index.astro:186`](../src/pages/galeria/index.astro#L186)).

**Aceptación:** navegar con flechas anuncia posición y título.

---

## 6. Fase 4 — Personalización desde el CMS

Esta fase depende de la Fase 0. Cierra la brecha entre "lo que la galería muestra" y "lo que un editor puede cambiar sin tocar código".

### GAL-19 · Álbumes editables

Hoy los nombres de los 22 álbumes están hardcodeados en `PROJECT_NAME_MAP` ([`gallery.ts:47-70`](../src/data/gallery.ts#L47-L70)). Renombrar uno exige tocar código y rebuild.

Con la tabla `gallery_albums` de GAL-4:

- CRUD en el overlay bajo `Galería → Gestionar álbumes` (crear, renombrar, reordenar, borrar si está vacío), siguiendo el patrón ya existente de categorías ([`cms-overlay.js:1171`](../src/scripts/cms-overlay.js#L1171)).
- Endpoints `/api/cms/gallery/albums` (GET/POST/PATCH/DELETE + `/reorder`), con auditoría, igual que las categorías.
- Exportar los álbumes en `gallery.json` y hacer que `getProjectAlbums()` lea de ahí en vez del mapa hardcodeado.

**Aceptación:** renombrar un álbum desde el overlay y exportar cambia el título en la tarjeta, sin tocar `.ts`.

### GAL-20 · Campo de álbum en el formulario de foto

`project_slug` existe en el esquema, el validador ([`cms.schema.ts:116`](../cms/validators/cms.schema.ts#L116)), el servicio, el repositorio y el export — **pero el formulario del overlay no lo tiene** ([`cms-overlay.js:1291`](../src/scripts/cms-overlay.js#L1291)). Una foto agregada desde el CMS cae en un bucket `general` cuyo nombre sale del título de la primera foto que caiga ahí.

Añadir un `<select name="projectSlug">` poblado desde `/api/cms/gallery/albums`, con opción "Sin álbum".

**Aceptación:** agregar una foto desde el overlay, asignarle un álbum, exportar, y verla dentro de ese álbum en `/galeria`.

### GAL-21 · Ordenar fotos y álbumes

El endpoint `/api/cms/gallery/items/reorder` existe ([`cmsRoutes.ts:503`](../cms/routes/cmsRoutes.ts#L503)) pero el overlay nunca lo llama. Ni el orden de las fotos dentro del álbum ni el de los álbumes en la grilla son editables.

- Drag & drop (o botones ↑/↓, más simple y más robusto en el panel angosto del overlay) en la grilla de miniaturas, agrupada por álbum.
- Reordenamiento de álbumes en la vista de GAL-19.

**Aceptación:** reordenar en el overlay, exportar, y ver el nuevo orden reflejado en la grilla y dentro del visor.

### GAL-22 · Portada de álbum exclusiva

`featured` no es exclusivo por álbum: 11 álbumes tienen 2 fotos marcadas y 5 tienen 0. La portada la resuelve `items.find(featured) || items[0]`, así que marcar una foto como destacada muchas veces no cambia nada visible — el editor pierde la confianza en el control.

- Al marcar una foto como destacada, desmarcar las demás del mismo álbum (en el servicio, dentro de la misma transacción).
- En el formulario, renombrar la etiqueta de "Destacada" a "Portada del álbum", que es lo que realmente hace.
- Migración de datos: dejar una sola destacada por álbum (la de menor `position`) y marcar una en los 5 que no tienen.

**Aceptación:** `select project_slug, count(*) from gallery_items where featured=1 group by 1 having count(*) <> 1` no devuelve filas.

### GAL-23 · Textos de la página editables

Están hardcodeados en la página: `"Próximamente se añadirán proyectos a esta galería."` ([línea 81](../src/pages/galeria/index.astro#L81)), `"No se encontraron proyectos coincidentes con tu búsqueda."` ([línea 191](../src/pages/galeria/index.astro#L191)) y el placeholder `"Buscar proyecto..."`. Moverlos a campos de `page.galeria` vía `getCmsText()`, como el resto de la página.

Aparte: **`page.galeria.eyebrow` es un campo huérfano.** El CMS lo ofrece con valor "Nuestro trabajo", pero `PageHero` ya no lo renderiza — el propio archivo lo dice ([`PageHero.astro:12`](../src/components/ui/PageHero.astro#L12)). Un editor lo cambia y no pasa nada. Decidir: eliminarlo del contenido por defecto, o volver a renderizarlo. Afecta a todas las páginas con `PageHero`, no solo a la galería.

**Aceptación:** los tres textos se editan desde el overlay; no quedan campos ofrecidos por el CMS que la página ignore.

### GAL-24 · Corregir la incoherencia Chacayes / Queltehues ⚠️ requiere decisión

El álbum `ch-queltehues` se muestra como **"C.H. Canal Chacayes"** ([`gallery.ts:58`](../src/data/gallery.ts#L58)), sus fotos están en `public/fotos/proyectos/ch-queltehues/`, y el CTA del visor lleva a `/proyectos/ch-queltehues`, cuyo `nombre` es **"C.H. Queltehues"**. El usuario hace clic en Chacayes y aterriza en Queltehues.

Hay que confirmar con Hidromont qué son esas 13 fotos: obra del Canal Chacayes, de la C.H. Queltehues, o trabajo de Chacayes ejecutado dentro del contrato de Queltehues. Según la respuesta se renombra el álbum, se separa en dos, o se corrige el enlace.

---

## 7. Fase 5 — Peso y limpieza

### GAL-25 · Bajar el peso de la primera carga

Medido en `/galeria`: **5,2 MB de imágenes** solo para las 22 portadas, y 71 KB de HTML comprimido de los cuales 20 KB son el payload JSON del visor.

- La mayor parte se resuelve con GAL-7 (derivados responsive): las portadas pasarán a servir 640w en vez de 1600w.
- El JSON del visor ([`galeria/index.astro:196`](../src/pages/galeria/index.astro#L196)) embebe los 168 items con sus LQIP en base64 (17 KB solo de LQIP) aunque el visitante no abra ningún álbum. Opciones: quitar el `lqip` del payload del visor (el visor no lo usa, solo la tarjeta), y/o cargar el JSON como fetch diferido al primer clic.
- Objetivo: < 1,5 MB de imágenes y < 40 KB de HTML gzipeado en la carga inicial.

**Aceptación:** medición reproducible con el mismo script de Playwright usado en la auditoría.

### GAL-26 · Eliminar assets sin usar

44 fotos (21 MB) se despliegan sin que nada las referencie: `ch-chacayes` (16), `ch-pangal-helicoptero` (12), `ch-pangal-terreno` (16). Verificado por búsqueda en todo `src/`.

Antes de borrar, revisarlas: `ch-pangal-helicoptero` y `ch-pangal-terreno` suenan a material aéreo de obra, que suele ser lo más vistoso que tiene una empresa de montaje. Puede que la decisión correcta sea **incorporarlas** a los álbumes de Pangal en vez de borrarlas.

**⚠️ requiere decisión:** incorporar o eliminar.
**Aceptación:** `public/fotos/proyectos/` no contiene carpetas sin referenciar.

### GAL-27 · Deuda menor

- **Animación de entrada muerta.** `ProjectAlbumCard` calcula `--reveal-delay` ([líneas 18-21](../src/components/gallery/ProjectAlbumCard.astro#L18-L21)) pero la tarjeta no lleva el atributo `data-reveal` que activa la regla en `motion.css`. Las tarjetas aparecen de golpe mientras la barra de filtros sí anima. Añadir `data-reveal` o quitar el cálculo.
- **`z-index` empatado.** El `<header>` y `#lightbox` están ambos en `z-50`; el visor gana solo por orden en el DOM. Subir el visor a la escala `overlay` (100) que ya existe en `tailwind.config.mjs`.
- **`will-change: opacity` permanente** en `#lightbox` ([línea 590](../src/components/gallery/Lightbox.astro#L590)) mantiene una capa de composición viva durante toda la vida de la página. Aplicarlo solo durante la transición.
- **Sin botón de limpiar búsqueda.** Añadir una "×" en el campo cuando tiene texto.
- **Teclas Home/End** en el desplegable de categorías (las flechas ya funcionan).

---

## 8. Decisiones pendientes

Ninguna de estas la puede tomar el equipo técnico solo. Van ordenadas por lo que bloquean.

| #   | Decisión                                                                               | Bloquea | Por defecto si no hay respuesta                             |
| --- | -------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| 1   | ¿Existen respaldos de los originales de las 40 fotos derivadas huérfanas?              | GAL-3   | Promover la variante mayor disponible                       |
| 2   | ¿Quién redacta y valida técnicamente las 94 descripciones?                             | GAL-10  | Borradores propuestos, publicación en espera de validación  |
| 3   | ¿Qué hacer con los 6 álbumes `servicio-*`? (redistribuir / mover a servicios / umbral) | GAL-12  | Redistribuir a proyectos, y a `/servicios` lo no atribuible |
| 4   | ¿Qué son las 13 fotos de `ch-queltehues`: Chacayes, Queltehues o ambas?                | GAL-24  | Mantener como está y solo corregir el enlace                |
| 5   | ¿Incorporar o eliminar las 44 fotos aéreas/de terreno sin usar?                        | GAL-26  | Incorporar a los álbumes de Pangal                          |
| 6   | ¿`eyebrow` se elimina del CMS o se vuelve a renderizar?                                | GAL-23  | Eliminar del contenido por defecto                          |

---

## 9. Trazabilidad hallazgo → tarea

| Hallazgo de la auditoría                                       | Tarea                                  |
| -------------------------------------------------------------- | -------------------------------------- |
| CMS y `gallery.json` desincronizados; publicar borra 145 fotos | GAL-1 … GAL-6                          |
| 94 fotos con metadatos de relleno                              | GAL-10                                 |
| 122 fotos sin derivados responsive                             | GAL-7                                  |
| 17 archivos con espacios → `srcset` inválido                   | GAL-9                                  |
| 106 dimensiones falsas / 22 con aspect ratio erróneo           | GAL-8                                  |
| 94 fotos sin LQIP                                              | GAL-8                                  |
| 5,2 MB en la primera carga                                     | GAL-25                                 |
| Portadas de baja resolución                                    | GAL-11                                 |
| 44 fotos sin usar (21 MB)                                      | GAL-26                                 |
| Taxonomía mezcla servicios y proyectos                         | GAL-12                                 |
| Contador del filtro miente; 24 fotos inalcanzables             | GAL-13                                 |
| Búsqueda solo por nombre de álbum                              | GAL-14                                 |
| Tarjeta no muestra categoría                                   | GAL-15                                 |
| Lightbox sin estado en la URL                                  | GAL-16                                 |
| Panel de metadatos pegado al borde                             | GAL-17                                 |
| CTA inalcanzable por teclado                                   | GAL-17                                 |
| Solo 2 de 22 álbumes enlazan a proyecto                        | Informativo (`tipo: banco` por diseño) |
| Incoherencia Chacayes / Queltehues                             | GAL-24                                 |
| Sin `aria-live` en el visor                                    | GAL-18                                 |
| `--reveal-delay` muerto                                        | GAL-27                                 |
| No se puede asignar álbum desde el CMS                         | GAL-20                                 |
| Nombres de álbum hardcodeados                                  | GAL-19                                 |
| Sin UI de ordenamiento                                         | GAL-21                                 |
| "Destacada" no exclusiva por álbum                             | GAL-22                                 |
| Campo `eyebrow` huérfano                                       | GAL-23                                 |
| Textos de estado no editables                                  | GAL-23                                 |

---

## 10. Verificación al cierre

Además de los criterios por tarea:

```bash
npm run lint
npm run build          # astro check + build
npm test
npm run test:e2e       # incluye el build-gate anti-overlay
```

Y una pasada manual sobre `/galeria`:

- [ ] Filtrar por cada una de las 8 categorías: el contador coincide con las tarjetas visibles.
- [ ] Buscar "compuerta", "coihaique", "tanque": resultados esperados, sin diacríticos.
- [ ] Abrir 3 álbumes, navegar con flechas hasta el final y volver.
- [ ] Recorrer el visor solo con teclado, incluido el CTA de proyecto.
- [ ] Botón Atrás de Android cierra el visor.
- [ ] Compartir la URL de una foto y abrirla en otro navegador.
- [ ] Editar el nombre de un álbum, el título de una foto y el orden desde el overlay; exportar; verificar los tres cambios en el sitio.
- [ ] Repetir el export dos veces seguidas: `gallery.json` no cambia entre la primera y la segunda (export idempotente).

---

## 11. Registro de ejecución

> Se actualiza a medida que se implementa. Fecha de inicio: 2026-08-04.

### ✅ Fase 0 — Rescate de datos (completa)

**GAL-1 · Guarda anti-borrado.** `assertNoSilentGalleryShrink()` en [`exportService.ts`](../cms/services/exportService.ts): aborta el export si la base tiene menos fotos publicadas que el `gallery.json` en disco, con mensaje que indica cómo proceder. Saltable con `CMS_ALLOW_GALLERY_SHRINK=1`. Verificado en vivo: el export falló señalando las 145 fotos en riesgo y dejó el archivo intacto. Cubierto por 4 tests en [`galleryExportGuard.test.ts`](../cms/test/galleryExportGuard.test.ts).

**GAL-9 · Nombres de archivo.** Nuevo [`scripts/normalize-photo-filenames.mjs`](../scripts/normalize-photo-filenames.mjs). Se acotó el alcance respecto al plan: solo se tocan nombres con espacios o caracteres que obligan a percent-encoding. Los puntos se conservan (`foto-15.25.45.jpeg` es una URL válida y renombrarla era ruido: el primer barrido proponía 175 archivos en vez de 17). Se añadió reserva de destinos porque cuatro archivos de `ch-lican` y dos de `ch-trueno` normalizaban al mismo nombre y se habrían pisado. Resultado: 17 renombrados, 0 archivos con espacios, 0 `src` rotos.

**GAL-2 · Media faltante.** No hizo falta escribir la lógica: `MediaService.syncPublicMedia()` ya la tenía, pero solo corría al arrancar el servidor del CMS, así que nunca se había ejecutado desde que llegaron las fotos. Se le dio punto de entrada propio ([`cms/scripts/sync-media.ts`](../cms/scripts/sync-media.ts), `npm run cms:sync-media`). Resultado: 107 archivos registrados; las 118 fotos bajo `/fotos/` pasaron de 12 a 118 con `media_asset`.

**GAL-3 · Origen de las derivadas.** Resuelto dentro del script de importación, con el reparto previsto: 10 por `media_id` existente y 40 promoviendo la mayor variante disponible a `public/fotos/galeria/`. Los originales siguen sin aparecer (decisión #1 pendiente); si aparecen, basta reasignar el media en el CMS.

**GAL-4 · Esquema.** Tabla `gallery_albums` (slug PK, name, position) en [`schema.ts`](../cms/db/schema.ts), dentro del `CREATE TABLE IF NOT EXISTS` idempotente. Categorías: las 8 del sitio creadas; de las 5 del vocabulario viejo se borraron 4 (`montaje`, `tuberias`, `equipos`, `otros`, todas con 0 usos) y se conservó `taller`, referenciada por los 4 items que pasaron a borrador. La página ya filtra categorías con conteo 0, así que no aparece en el desplegable.

**GAL-5 · Importación.** [`cms/scripts/import-gallery-json.ts`](../cms/scripts/import-gallery-json.ts) (`npm run cms:import-gallery`, con `--dry`). Un detalle no previsto: los `id` de categoría del JSON venían de un export viejo y chocaban con filas existentes de otro slug; se acuña un id nuevo cuando pasa, tomando el slug como identidad estable.

**Prueba de fuego del plan — superada:**

```text
items antes/después: 168 168
solo antes: 0
solo después: 0
```

**GAL-6 · Escritura paralela retirada.** Se eliminó de [`process-top-photos.mjs`](../scripts/process-top-photos.mjs) la fase que escribía `gallery.json` (junto con `processForGallery()`, `GALLERY_PROJECTS` y las constantes que quedaban muertas), y se documentó en su cabecera cuál es el camino correcto. El test de regresión de GAL-6 detectó que el propio normalizador de GAL-9 también escribía el archivo; en vez de exceptuarlo se le quitó esa escritura, que con la base como fuente de verdad ya era redundante.

**Efecto colateral: GAL-7 y GAL-8 quedaron resueltos por el export**, como anticipaba el plan.

| Métrica                            | Antes | Después                               |
| ---------------------------------- | ----- | ------------------------------------- |
| Fotos sin variantes responsive     | 122   | 13 (originales genuinamente < 640 px) |
| Dimensiones declaradas incorrectas | 106   | 0                                     |
| Aspect ratio incorrecto            | 22    | 0                                     |
| Fotos sin LQIP                     | 94    | 0                                     |
| `src` con espacios o `%20`         | 17    | 0                                     |
