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
3. Sincroniza imágenes nuevas de `public/fotos`, `public/logos-clientes`, `public/uploads/cms` a la biblioteca de medios.
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

| Tipo | Uso | Widget |
|---|---|---|
| `text` | Títulos, labels, textos cortos | Input de una línea |
| `textarea` | Párrafos, descripciones | Textarea multi-línea |
| `richtext` | Contenido con formato | Textarea (sin editor WYSIWYG aún) |
| `image` | Imágenes (sube o elige de biblioteca) | Picker de medios + upload |
| `link` | Enlaces con label + href | Dos inputs |
| `number` | Métricas, años, cantidades | Input numérico |
| `list` | Listas de strings (bullets, normas) | Editor de items dinámico |
| `object` | Estructuras complejas | JSON |

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

### 3. Publicar ("Publicar")
Botón que ejecuta `POST /api/cms/publish` = export + `npm run build`. El build valida que el contenido compile correctamente (schemas Zod de content collections). Si falla, el job queda `'failed'` con los logs.

### 4. Desplegar
Subir `dist/` a Cloudflare Pages. **El CMS no deploya**; el operador lo hace manualmente (o vía CI si se configura).

## Biblioteca de medios

Las imágenes se gestionan en `GET /api/cms/media`. Hay tres orígenes:

| Origen | Path | ¿Se borra del disco al eliminar? |
|---|---|---|
| Subidas vía CMS | `/uploads/cms/*` | Sí |
| Catálogo (fotos de proyectos) | `/fotos/*` | No (solo el registro DB) |
| Logos de clientes | `/logos-clientes/*` | No (solo el registro DB) |

Al arrancar, `syncPublicMedia()` importa imágenes nuevas encontradas en disco. También detecta **media huérfano** (archivos borrados de disco fuera del CMS) y lo reporta con advertencia.

### Borrar media usado en galería

Si un media está referenciado por items de galería, borrarlo **no elimina los items** (FK `ON DELETE SET NULL`). Los items quedan con `media_id = NULL` y:
- Aparecen en el admin (vía `LEFT JOIN`) para que el operador les reasigne un media.
- Se excluyen del export (no rompen la generación de `gallery.json`).
- El endpoint `DELETE /media/:id` devuelve `{ orphanedGalleryItems: N }` indicando cuántos items quedaron huérfanos.

## Galería

CRUD completo de categorías e items:

- **Categorías:** nombre, slug, posición (reorderable).
- **Items:** media, categoría, título, alt (obligatorio, validado 1-500 chars), caption, featured, status, posición (reorderable).

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

| Variable | Default | Nota |
|---|---|---|
| `CMS_HOST` | `127.0.0.1` | `0.0.0.0` para LAN. Si no es local + `CMS_COOKIE_SECURE=0`, el guard bloquea el arranque salvo `CMS_ALLOW_INSECURE_COOKIE=1`. |
| `CMS_COOKIE_SECURE` | auto (prod=1) | `1` exige HTTPS. |
| `PUBLIC_ENABLE_CMS` | — | `1` para editar (dev/staging). `0` para build público. |
| `CMS_ADMIN_PASSWORD` | `Hidromont-Admin-ChangeMe` | Cambiar obligatoriamente si se expone en LAN. |

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
