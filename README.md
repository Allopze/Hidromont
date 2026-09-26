# Hidromont Chile S.A. — Sitio Web y CMS

Este repositorio contiene el código fuente del sitio web corporativo de **Hidromont Chile S.A.** (desarrollado con Astro y Tailwind CSS) junto con su CMS visual (Fastify y SQLite), que puede ejecutarse en local/LAN o integrado al servidor Node de producción.

El sitio web está diseñado con un registro visual industrial y de alta precisión para transmitir la trayectoria (desde 1983) y credibilidad técnica de la empresa en el diseño, fabricación e instalación de equipos hidromecánicos (tuberías de presión, compuertas, válvulas, turbinas, etc.).

---

## 🛠️ Stack Tecnológico

El proyecto está dividido en dos partes integradas pero desacopladas para mantener el sitio público extremadamente rápido y estático:

1. **Sitio Web (Frontend)**:
   - **Astro 7**: Generador de sitios estáticos (`output: 'static'`). Las
     colecciones usan el Content Layer (`src/content.config.ts`), así que el
     frontmatter de proyectos y servicios se valida contra Zod al compilar.
   - **Tailwind CSS 3**: Framework de utilidades CSS integrado con variables y tokens de diseño.
   - **Fuentes auto-hospedadas**: Inter (cuerpo de texto), Roboto Condensed (encabezados) y Roboto Mono (datos/métricas).
2. **CMS (Backend + Edición Visual)**:
   - **Fastify 5**: API Server en Node.js que corre en el puerto `8787` (por defecto).
   - **Better-SQLite3**: Persistencia local ultrarrápida mediante base de datos SQLite.
   - **CMS Overlay**: Interfaz visual incluida con `PUBLIC_ENABLE_CMS=1` (o en `import.meta.env.DEV`). En producción se activa solo desde `editor.*`; `?cms=1` se admite únicamente en desarrollo. Con `PUBLIC_ENABLE_CMS=1`, `npm run build:log` compila dos perfiles: `dist/` sin editor para `hidromontchile.cl` y `dist-editor/` con editor para `editor.*` (ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)).

---

## 📁 Estructura del Proyecto

```text
├── cms/                     # Servidor backend del CMS
│   ├── config/              # Configuración unificada (unifiedConfig.ts)
│   ├── data/                # Base de datos SQLite (hidromont-cms.sqlite) y backups
│   ├── db/                  # Esquemas y migraciones de base de datos
│   ├── routes/              # Endpoints API (auth, entries, media, publish, etc.)
│   ├── services/            # Lógica de negocio (import, export, auth, media, audit)
│   ├── test/                # Suite de pruebas unitarias y de API del CMS
│   └── server.ts            # Punto de entrada del servidor Fastify
├── e2e/                     # Pruebas integrales de flujo (Playwright)
├── assets/originales/       # Material local de trabajo, ignorado por Git
├── docs/                    # Guías, auditorías y referencias técnicas
├── src/                     # Código fuente de la web Astro
│   ├── assets/              # Imágenes fuentes y assets de diseño
│   ├── components/          # Componentes Astro (Layouts, UI, formularios, etc.)
│   │   └── cms/             # Componente inyector del Overlay (CmsOverlay.astro)
│   ├── content/             # Colecciones de contenido Markdown/JSON (Servicios, Proyectos, Clientes)
│   ├── data/                # Estructuras de datos dinámicas y exportaciones del CMS
│   ├── layouts/             # Plantillas base (BaseLayout.astro)
│   ├── pages/               # Páginas públicas y dinámicas del sitio
│   ├── scripts/             # Scripts del cliente (incluyendo cms-overlay.js)
│   └── styles/              # Hojas de estilos globales y de movimiento/tokens
├── public/                  # Archivos estáticos y subidas de imágenes del CMS (uploads/cms)
└── package.json             # Dependencias y scripts de NPM
```

---

## 📚 Documentación

La documentación técnica completa está en [`docs/`](./docs/):

| Documento                                                          | Qué cubre                                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                   | Arquitectura: dominios, capas, base de datos, flujo de datos, testing.             |
| [`docs/CMS-GUIDE.md`](./docs/CMS-GUIDE.md)                         | Edición de contenido: overlay, export, medios, galería, backup, reset de password. |
| [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md)                 | Tokens, componentes, l10n, accesibilidad.                                          |
| [`docs/SECURITY.md`](./docs/SECURITY.md)                           | Modelo de amenazas, CSP, endurecimiento en LAN, auditoría.                         |
| [`docs/AUDITORIA_LOGICA_UIUX.md`](./docs/AUDITORIA_LOGICA_UIUX.md) | Auditoría técnica + registro de remediación (nota 9/10).                           |
| [`docs/README.md`](./docs/README.md)                               | Índice completo de la documentación.                                               |

**Punto de partida según tu rol:**

- ¿Primera vez? → este README + [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
- ¿Editar contenido? → [`docs/CMS-GUIDE.md`](./docs/CMS-GUIDE.md).
- ¿Cambiar estilos? → [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md).
- ¿Seguridad? → [`docs/SECURITY.md`](./docs/SECURITY.md).

---

## 🚀 Instalación y Configuración

### 1. Requisitos previos

- Node.js (v18 o superior)
- NPM

### 2. Clonar e Instalar dependencias

```bash
# Instalar dependencias
npm install
```

### 3. Variables de Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:

```bash
cp .env.example .env
```

Y configura las variables necesarias:

- `PUBLIC_CONTACT_EMAIL`: Correo de destino al que FormSubmit.co envía las consultas del formulario de contacto.
- `FORMSUBMIT_CC_1` a `FORMSUBMIT_CC_4`: Correos adicionales en copia (opcionales).
- `CMS_ADMIN_EMAIL`: Correo del administrador para el CMS (por defecto `admin@hidromont.local`).
- `CMS_ADMIN_PASSWORD`: Contraseña del administrador. Cambiarla es obligatorio si el CMS escuchará fuera del equipo local.
- `CMS_HOST`: Host del CMS. Por defecto debe ser `127.0.0.1`; usa `0.0.0.0` solo si necesitas acceso desde la LAN.

> [!WARNING]
> Si el CMS será accesible en tu red local (LAN), cambia `CMS_ADMIN_PASSWORD` y agrega en `CMS_ALLOWED_ORIGINS` el origen exacto del sitio de edición. El servidor falla al iniciar si se expone a la red con la contraseña por defecto.

---

## 💻 Comandos Disponibles

| Comando              | Descripción                                                                                    |
| :------------------- | :--------------------------------------------------------------------------------------------- |
| `npm run dev`        | Inicia **únicamente** el servidor de desarrollo de Astro en `http://localhost:4321`.           |
| `npm run cms`        | Inicia **únicamente** el servidor Fastify del CMS en `http://localhost:8787`.                  |
| `npm run dev:cms`    | **Recomendado para editar:** Inicia Astro y el CMS juntos concurrentemente.                    |
| `npm run cms:import` | Añade a la base las entradas y campos de la semilla que falten. Nunca modifica lo ya editado.  |
| `npm run cms:export` | Exporta la base de datos SQLite a archivos JSON (`cms-content.json`) y colecciones Markdown.   |
| `npm run cms:backup` | Genera una copia de seguridad fechada de la base de datos SQLite en `cms/data/backups/`.       |
| `npm run build`      | Valida el código (`astro check`) y compila el sitio estático optimizado en la carpeta `/dist`. |
| `npm run preview`    | Previsualiza localmente el sitio web compilado en producción.                                  |
| `npm run test`       | Ejecuta las pruebas unitarias y de integración del backend del CMS con Vitest.                 |
| `npm run test:e2e`   | Ejecuta las pruebas integrales de Playwright para validar flujos críticos.                     |

---

## 📝 Guía de Uso del CMS Visual Inline

El CMS de Hidromont permite editar textos, listas e imágenes directamente sobre el diseño real de la página en tiempo real.

### Paso 1: Iniciar el entorno de edición

Para habilitar el editor visual, ejecuta el comando de desarrollo concurrente:

```bash
npm run dev:cms
```

Esto levantará el sitio web en `http://localhost:4321` y el backend en `http://localhost:8787`.

### Paso 2: Activar el Overlay del CMS

1. Abre tu navegador y dirígete a: **`http://localhost:4321/?cms=1`**
2. Se almacenará un flag en el almacenamiento local de tu navegador y aparecerá una barra flotante en la esquina inferior izquierda con la etiqueta **Hidromont CMS**.
3. Se desplegará el panel lateral derecho con el formulario de inicio de sesión.

### Paso 3: Iniciar sesión

Utiliza el usuario y la contraseña entregados por la persona que administra el CMS. La configuración técnica está en `.env` (`CMS_ADMIN_EMAIL` y `CMS_ADMIN_PASSWORD`).

### Paso 4: Edición en pantalla

1. Mueve el cursor por la pantalla. Todo elemento editable (títulos, descripciones, números, enlaces, imágenes) se resaltará con un **borde azul** al pasar por encima.
2. **Haz clic** sobre el elemento que deseas modificar.
3. El panel derecho cambiará para mostrar el editor correspondiente al tipo de campo:
   - **Texto / Textarea**: Entrada directa de texto.
   - **Listas**: Permite agregar, reordenar y eliminar elementos de listas (por ejemplo, especificaciones de maquinaria o metodologías).
   - **Enlaces**: Campos independientes para el texto del enlace y la URL.
   - **Imágenes**: Permite subir un archivo nuevo, seleccionar una imagen existente de la biblioteca de medios local, definir el texto alternativo (`alt`) y ajustar el punto focal de recorte.
4. Presiona **Guardar** para registrar los cambios en la base SQLite de esta instalación. El CMS actualiza la vista previa de esta página; los visitantes todavía no ven el cambio.

### Paso 5: Preparar y publicar los cambios

**Exportar** prepara los archivos fuente, pero no compila ni publica el sitio.

1. En el editor, usa **Exportar** o ejecuta `npm run cms:export`. Esto escribe los datos en `src/data/cms-content.json` y actualiza las colecciones Markdown de Astro.
2. En la barra del CMS, haz clic en **Publicar cambios**. La acción exporta y compila el sitio con el comando configurado en `CMS_PUBLISH_CHECK_COMMAND`.
3. Si estás en local, esto solo compila esa instalación y aún debes desplegar el resultado para actualizar producción. En `hidromontchile.cl`, el mismo proceso sirve el `dist/` regenerado y el sitio queda actualizado al terminar.

---

## 🌍 Publicación en Producción

El sitio se compila estático y se sirve, junto con la API del CMS, desde un
único proceso Node (`npm start` → `server.mjs` → `cms/server.ts`) en un VPS,
detrás de Caddy.

Con esa topología el ciclo de publicación cierra solo: **«Publicar» exporta el
contenido, ejecuta `npm run build:log` y los `dist/` y `dist-editor/`
regenerados son los que el proceso sirve**, así que el cambio queda en línea al terminar. No hay paso
manual de subida.

**Guía paso a paso: [docs/DESPLIEGUE-VPS.md](docs/DESPLIEGUE-VPS.md)** — preparar el servidor, desplegar con `npm run deploy`, qué directorios deben sobrevivir a un redespliegue y qué hacer cuando algo falla. (El despliegue antiguo en cPanel queda en [docs/historico/](docs/historico/DESPLIEGUE-CPANEL.md).)

### Antes del primer despliegue

```bash
node scripts/check-deploy-env.mjs   # o: npm run check:deploy-env
```

Se ejecuta **en el servidor** y comprueba versión de Node, carga de los
módulos nativos (`better-sqlite3`, `sharp`), permisos de escritura, espacio y
el perfil de `.env`. Copia `.env.production.example` como `.env` y complétalo:
lleva comentado el porqué de cada valor.

Dos cosas que deben sobrevivir a un redespliegue y no pueden vivir en el árbol
que se sincroniza con git: `cms/data/` (la base) y `uploads/cms/` (los
originales de las imágenes, ~2 GB).

### Cabeceras y redirecciones

`public/_headers` y `public/_redirects` son convenciones de Cloudflare Pages
que Node no aplica por sí solo, así que el propio servidor hace el equivalente:

- Las cabeceras de seguridad (CSP, `Permissions-Policy`, `X-Frame-Options`,
  HSTS) las pone `cms/security/headers.ts`.
- Las redirecciones las lee `cms/staticSite.ts` del propio `_redirects`, así
  que la lista sigue siendo una sola mientras convivan los dos destinos.

Los hashes de la CSP **no se mantienen a mano**: los calcula
`scripts/sync-csp-headers.ts` como último paso de `npm run build`, y el
servidor los recalcula del build que sirve. Se hizo así porque los que había
escritos no correspondían a ningún script real y dejaban bloqueados —en
silencio— los dos scripts inline del sitio.

### Variables del build de producción

| Variable                    | Valor                    | Razón                                                                                                                               |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `PUBLIC_ENABLE_CMS`         | **`1`**                  | Incluye la interfaz del CMS en el build integrado. En producción solo se activa en `editor.*`; `?cms=1` se reserva para desarrollo. |
| `NODE_ENV`                  | `production`             | Activa los defaults de producción (cookie segura).                                                                                  |
| `PUBLIC_CONTACT_EMAIL`      | `hidromont@hidromont.cl` | Destinatario del formulario. El fallback del código es el mismo buzón.                                                              |
| `PUBLIC_CMS_API_BASE`       | (vacío)                  | El overlay habla con el mismo origen que sirve la página.                                                                           |
| `CMS_PUBLISH_CHECK_COMMAND` | `npm run build`          | Es lo que hace que publicar actualice el sitio servido. `npm run check` solo valida.                                                |
| `CMS_PUBLISH_TIMEOUT_MS`    | medido en el servidor    | Un build completo tarda bastante más en hosting compartido que en local.                                                            |

> Si en algún momento se vuelve a un hosting puramente estático, compila con
> `PUBLIC_ENABLE_CMS=0`: `e2e/build-gate.spec.ts` detecta el perfil del build y
> exige, en ese caso, que el overlay no aparezca por ningún lado.

### 🔐 Configuración del CMS en producción (si se expone en LAN)

Si el CMS se sirve en la LAN de la oficina (no sólo en `127.0.0.1`):

- `CMS_HOST=0.0.0.0` + `CMS_COOKIE_SECURE=1` + HTTPS (recomendado), **o**
- `CMS_HOST=127.0.0.1` + túnel SSH (sin exponer el puerto), **o**
- `CMS_HOST=0.0.0.0` + `CMS_COOKIE_SECURE=0` + `CMS_ALLOW_INSECURE_COOKIE=1` (sólo LAN de confianza; el CMS emite una advertencia al arrancar).

El guard de arranque (`cms/server.ts`) **bloquea** la combinación host expuesto + cookie insegura sin el escape hatch, para prevenir secuestro de sesión en redes no confiables (H2).

### 🔄 Rotación de contraseña de admin

Si cambias `CMS_ADMIN_PASSWORD` en `.env` tras el primer arranque, el hash almacenado **no** se actualiza automáticamente (el `ensureAdminUser` del arranque es idempotente y preserva ediciones). Ejecuta:

```bash
npm run cms:reset-password
# o con credenciales explícitas:
npm run cms:reset-password -- admin@hidromont.cl NuevaPasswordSegura123
```

Esto re-hashea la contraseña, actualiza la fila del admin e invalida todas las sesiones activas (A1-007).

---

## 🔒 Auditoría y Seguridad

El CMS cuenta con características de seguridad robustas para evitar problemas de operación en red local:

- **Historial de revisiones (Rollback)**: Cada vez que modificas una entrada, se guarda una versión en SQLite. Desde el panel del overlay, puedes presionar el botón "Revisiones" de cualquier elemento y restaurar versiones anteriores en cualquier momento.
- **Registro de auditoría**: El sistema registra automáticamente en la base de datos (`audit_events`) acciones críticas como inicios de sesión, cierres de sesión, modificaciones de campos, subidas de archivos y exportaciones.
- **Validación de archivos subidos**: Restringe la subida únicamente a formatos seguros (`.jpg`, `.jpeg`, `.png`, `.webp`) y verifica la correspondencia entre la extensión y el tipo MIME real del archivo para prevenir ataques de inyección de código.
- **Límite de intentos de acceso**: Bloqueo temporal persistente de IP después de 10 intentos fallidos de inicio de sesión.
- **Copias de seguridad**: Realiza copias de seguridad de la base de datos con regularidad ejecutando `npm run cms:backup`.
- **Cabeceras del sitio público**: las pone `cms/security/headers.ts` (CSP con los hashes de los scripts inline del build servido, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS). Detalle en [docs/SECURITY.md](docs/SECURITY.md).
