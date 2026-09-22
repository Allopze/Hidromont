# Guía del CMS

> Cómo editar contenido del sitio Hidromont Chile usando el CMS visual local.
> Para arquitectura técnica, ver [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Qué es el CMS

El CMS es un **backend Fastify + SQLite** que corre en local o LAN (puerto `8787`) y permite editar el contenido del sitio sin tocar código. Su output son archivos JSON + Markdown que Astro consume en build time. **El CMS nunca se despliega a producción**; es una herramienta de edición offline.

## Arranque

```bash
# Modo desarrollo (Astro dev + CMS concurrentes)
npm run dev:cms

# O por separado
npm run dev     # Astro en :4321 con overlay activo
npm run cms     # Fastify CMS en :8787
```

Al arrancar, el CMS:

1. Ejecuta migraciones idempotentes (no daña una DB existente).
2. Crea el usuario admin si no existe (con la contraseña de `.env`).
3. Sincroniza imágenes nuevas de `public/fotos`, `public/logos-clientes`, `uploads/cms` a la biblioteca de medios.
4. Reap jobs de publicación trabados en `'running'` (crash recovery).
5. Limpia entradas expiradas de rate-limit.

## Edición visual (overlay)

1. Arranca `npm run dev:cms` (requiere `PUBLIC_ENABLE_CMS=1` en `.env`).
2. Abre `http://localhost:4321/?cms=1` (o cualquier página con `?cms=1`).
3. Inicia sesión con las credenciales de `.env` (`CMS_ADMIN_EMAIL` / `CMS_ADMIN_PASSWORD`).
4. Los elementos editables muestran un cursor de cruz al hacer hover. Click → panel lateral con el editor del campo.
5. Guarda (escribe a SQLite al instante). El cambio se ve reflejado en la página.

> **⚠️ Importante:** el overlay **solo se incluye en el build si `PUBLIC_ENABLE_CMS=1`**. El build de producción de Cloudflare debe llevar `PUBLIC_ENABLE_CMS=0` para que `dist/` no contenga el editor. El CI verifica esto con `e2e/build-gate.spec.ts`.

## Tipos de campo editables

Definidos en `cms/controllers/ContentController.ts` y el schema (`GET /api/cms/schema`):

| Tipo       | Uso                                         | Widget                                     |
| ---------- | ------------------------------------------- | ------------------------------------------ |
| `text`     | Títulos, labels, textos cortos              | Input de una línea                         |
| `textarea` | Párrafos, descripciones                     | Textarea multi-línea                       |
| `richtext` | Cuerpo en Markdown de servicios y proyectos | Editor con barra de formato y vista previa |
| `image`    | Imágenes (sube o elige de biblioteca)       | Picker de medios + upload                  |
| `link`     | Enlaces con label + href                    | Dos inputs                                 |
| `number`   | Métricas, años, cantidades                  | Input numérico                             |
| `list`     | Listas de strings (bullets, normas)         | Editor de items dinámico                   |
| `object`   | Estructuras complejas                       | JSON                                       |

### El editor de texto con formato

Los campos `richtext` son el **cuerpo de cada ficha** de servicio y proyecto: el
texto largo que el visitante lee bajo la ficha técnica. Se editan desde
**Colecciones → (un servicio o proyecto) → Contenido**.

La barra aplica negrita, cursiva, títulos, listas, cita, código y enlaces, con
`Ctrl+B`, `Ctrl+I` y `Ctrl+K` como atajos. Pulsar dos veces el mismo botón
quita el formato en vez de acumularlo. «Vista previa» muestra cómo queda sin
cambiar nada de lo escrito.

> **Se guarda en Markdown, no en HTML.** Es deliberado: estos campos van y
> vienen de `src/content/servicios/*.md` y `src/content/proyectos/*.md`, así que
> guardar Markdown hace que el viaje de ida y vuelta sea exacto. Un editor
> WYSIWYG tendría que convertir HTML→Markdown en cada guardado, y ahí es donde
> se degradan las tablas y el HTML embebido de las 48 fichas que ya existen.
>
> La vista previa es orientativa: se parece al sitio pero no lo copia. El
> aspecto final lo da Astro al compilar.

**Hasta sep-2026 estos 48 campos no eran editables desde ninguna parte del
panel**: el formulario de colección filtraba el tipo `richtext` y ningún
componente lo exponía con `data-cms-type`. Existían en la base y se exportaban,
pero solo se podían cambiar editando los `.md` a mano.

### Deshacer un borrado

Al eliminar una foto, un álbum, una categoría o una entrada aparece un aviso
sobre la barra con un botón **Deshacer** durante 12 segundos.

- Fotos, álbumes y categorías vuelven enteros: posición, categoría, álbum,
  destacado, texto alternativo. Por eso ya **no** se pide confirmación antes.
- Las entradas siguen pidiendo confirmación, porque su deshacer no es íntegro:
  el **historial de revisiones no se recupera**.
- Una foto recategorizada durante esos 12 segundos conserva la categoría nueva:
  esa decisión es más reciente y manda. El aviso lo dice.
- Un segundo borrado reemplaza el aviso. Lo anterior no se pierde: el registro
  de actividad conserva el evento.

Lo restaurado vuelve a la base de datos, no a los archivos del sitio: hay que
usar **«Exportar y validar»** para que se refleje. El distintivo de la barra
pasa a «● Sin exportar» para recordarlo.

> **Los medios no son deshacibles.** Borrar un archivo de la biblioteca lo
> elimina del disco. Sigue protegido —exige confirmación explícita y se rechaza
> si la imagen está en uso—, pero es definitivo.

## Flujo de publicación

### 1. Editar

Edita campos en el overlay. Los cambios se guardan en SQLite al instante (PATCH `/api/cms/entries/:id/fields/:key`), pero **no aparecen en el sitio** hasta el export.

### 2. Exportar ("Exportar y validar")

Botón en el panel del overlay. Ejecuta `POST /api/cms/export` que escribe:

- `src/data/cms-content.json` — entradas page/layout/component/settings.
- `src/data/gallery.json` — items + categorías de galería con derivadas de imagen.
- `src/content/servicios/*.md` — entradas servicio (solo si `version > 1`).
- `src/content/proyectos/*.md` — entradas proyecto (solo si `version > 1`).

La escritura es **atómica** (`.tmp` + rename) y crea directorios recursivamente (slugs con subdirectorio como `tanques/316l` funcionan).

> **Nota:** solo se exportan entradas con `status: 'published'`. Los borradores (`draft`) nunca llegan a los archivos del sitio.

### 3. Publicar

Botón que ejecuta `POST /api/cms/publish`: exporta el contenido y luego corre
`CMS_PUBLISH_CHECK_COMMAND` (`npm run build` en producción). Como el mismo
proceso sirve `dist/`, al terminar el cambio **ya está en línea**. El panel
muestra la fecha de compilación de lo que se está sirviendo.

Si el build falla, el job queda en `'failed'` con los logs y el sitio anterior
sigue servido intacto.

Dos avisos que pueden aparecer al publicar, y que antes solo salían por la
consola del servidor mientras el job se cerraba como correcto:

- **«No se publicaron»** — la entrada tiene un valor fuera del vocabulario
  (`categoria`, `tipo`, `icono`). No se escribe su archivo, así que el
  proyecto no aparece en el sitio. El aviso trae un botón para editarla.
- **«En borrador: el sitio muestra el texto por defecto»** — despublicar una
  entrada de página no la oculta: el sitio vuelve al texto escrito en el
  código. Para borrar un texto de verdad, usa «Vaciar este texto».

## Biblioteca de medios

Las imágenes se gestionan en `GET /api/cms/media`. Hay tres orígenes:

| Origen                        | Path                | ¿Se borra del disco al eliminar? |
| ----------------------------- | ------------------- | -------------------------------- |
| Subidas vía CMS               | `/uploads/cms/*`    | Sí                               |
| Catálogo (fotos de proyectos) | `/fotos/*`          | No (solo el registro DB)         |
| Logos de clientes             | `/logos-clientes/*` | No (solo el registro DB)         |

Al arrancar, `syncPublicMedia()` importa imágenes nuevas encontradas en disco. También detecta **media huérfano** (archivos borrados de disco fuera del CMS) y lo reporta con advertencia.

### Borrar media usado en galería

Si un media está referenciado por items de galería, borrarlo **no elimina los items** (FK `ON DELETE SET NULL`). Los items quedan con `media_id = NULL` y:

- Aparecen en el admin (vía `LEFT JOIN`) para que el operador les reasigne un media.
- Se excluyen del export (no rompen la generación de `gallery.json`).
- El endpoint `DELETE /media/:id` devuelve `{ orphanedGalleryItems: N }` indicando cuántos items quedaron huérfanos.

## Galería

CRUD completo de categorías, álbumes e items:

- **Categorías:** nombre, slug, posición (reorderable). Son el filtro transversal de la página de galería.
- **Álbumes:** una obra con sus fotos. Nombre editable, slug fijo, posición (reorderable). El slug no se puede cambiar porque es lo que enlaza las fotos con `/proyectos/<slug>`; para mover fotos entre álbumes se cambia el álbum en cada foto. Un álbum con fotos no se puede borrar: el CMS responde cuántas hay que mover primero.
- **Items:** media, categoría, álbum, alt (obligatorio, validado 1-500 chars), featured, status, posición (reorderable). Las fotos no llevan título ni descripción: la galería las muestra agrupadas por álbum y nada más. El alt no se ve en pantalla — es lo que leen los lectores de pantalla y sobre lo que busca el filtro de la galería.

Galería → **Gestionar álbumes** para renombrar una obra sin tocar código; Galería → **Gestionar imágenes** para asignar cada foto a su álbum.

El export genera derivadas de imagen (640/1024/1600px + LQIP base64) vía sharp.

## Revisiones

Cada modificación de un campo guarda un snapshot en la tabla `revisions`. Desde el panel del overlay, botón "Revisiones" en cualquier elemento → lista versiones → restaurar.

## Backup

```bash
npm run cms:backup    # copia el .sqlite a cms/data/backups/ con timestamp
```

Lista de backups: `GET /api/cms/backup/list`. Restaurar es manual (reemplazar el .sqlite).

## Rotación de contraseña de admin

Si cambias `CMS_ADMIN_PASSWORD` en `.env` tras el primer arranque, el hash almacenado **no se actualiza automáticamente** (el `ensureAdminUser` del arranque preserva ediciones existentes). Ejecuta:

```bash
npm run cms:reset-password
# o con credenciales explícitas:
npm run cms:reset-password -- admin@hidromont.cl NuevaPasswordSegura123
```

Esto re-hashea, actualiza la fila del admin e invalida todas las sesiones activas.

## Configuración

Ver [`.env.example`](../.env.example) para todas las variables. Las críticas:

| Variable             | Default                    | Nota                                                                                                                          |
| -------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `CMS_HOST`           | `127.0.0.1`                | `0.0.0.0` para LAN. Si no es local + `CMS_COOKIE_SECURE=0`, el guard bloquea el arranque salvo `CMS_ALLOW_INSECURE_COOKIE=1`. |
| `CMS_COOKIE_SECURE`  | auto (prod=1)              | `1` exige HTTPS.                                                                                                              |
| `PUBLIC_ENABLE_CMS`  | —                          | `1` para editar (dev/staging). `0` para build público.                                                                        |
| `CMS_ADMIN_PASSWORD` | `Hidromont-Admin-ChangeMe` | Cambiar obligatoriamente si se expone en LAN.                                                                                 |

## Solución de problemas

### "No se puede iniciar el CMS expuesto a la red..."

El guard H2 detectó `CMS_HOST=0.0.0.0` + `CMS_COOKIE_SECURE=0`. Opciones: HTTPS + `CMS_COOKIE_SECURE=1`, o `127.0.0.1` + túnel, o `CMS_ALLOW_INSECURE_COOKIE=1` (solo LAN de confianza).

### Cambios no aparecen en el sitio

Recordar: editar → SQLite, pero el sitio lee `src/data/cms-content.json`. Hay que "Exportar y validar" (y reconstruir si se quiere ver en `dist/`).

### Clave CMS falta (warn en consola de dev)

`[cms] clave faltante/vacía: empresa.hero.title`. El componente usa el fallback, pero falta el valor en el export. Re-exportar desde el CMS.

### Un item de galería no exporta

Si el media asociado fue borrado, el item queda huérfano (`media_id NULL`) y se saltea con advertencia. Reasignar un media en el CMS.

## Referencias

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — detalle de capas, DB, API.
- [`README.md`](../README.md) — comandos y deploy.
