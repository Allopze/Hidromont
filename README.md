# Hidromont Chile S.A. — Sitio Web y CMS

Este repositorio contiene el código fuente del sitio web corporativo de **Hidromont Chile S.A.** (desarrollado con Astro y Tailwind CSS) junto con su **CMS Visual Local** (desarrollado con Fastify y SQLite).

El sitio web está diseñado con un registro visual industrial y de alta precisión para transmitir la trayectoria (desde 1983) y credibilidad técnica de la empresa en el diseño, fabricación e instalación de equipos hidromecánicos (tuberías de presión, compuertas, válvulas, turbinas, etc.).

---

## 🛠️ Stack Tecnológico

El proyecto está dividido en dos partes integradas pero desacopladas para mantener el sitio público extremadamente rápido y estático:

1. **Sitio Web (Frontend)**:
   - **Astro 4**: Generador de sitios estáticos (`output: 'static'`).
   - **Tailwind CSS 3**: Framework de utilidades CSS integrado con variables y tokens de diseño.
   - **Fuentes auto-hospedadas**: Inter (cuerpo de texto), Roboto Condensed (encabezados) y Roboto Mono (datos/métricas).
2. **CMS Local (Backend + Edición Visual)**:
   - **Fastify 5**: API Server en Node.js que corre en el puerto `8787` (por defecto).
   - **Better-SQLite3**: Persistencia local ultrarrápida mediante base de datos SQLite.
   - **CMS Overlay**: Script JS inyectado visualmente en el frontend (`src/scripts/cms-overlay.js`) **únicamente cuando `PUBLIC_ENABLE_CMS=1`** (o en `import.meta.env.DEV`). El build de producción **debe** llevar `PUBLIC_ENABLE_CMS=0` para que el `dist/` no incluya código administrativo; el CI (`e2e/build-gate.spec.ts`) verifica que `dist/` no contenga marcadores del CMS.

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

| Documento | Qué cubre |
|---|---|
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | Arquitectura: dominios, capas, base de datos, flujo de datos, testing. |
| [`docs/CMS-GUIDE.md`](./docs/CMS-GUIDE.md) | Edición de contenido: overlay, export, medios, galería, backup, reset de password. |
| [`docs/DESIGN-SYSTEM.md`](./docs/DESIGN-SYSTEM.md) | Tokens, componentes, l10n, accesibilidad. |
| [`docs/SECURITY.md`](./docs/SECURITY.md) | Modelo de amenazas, CSP, endurecimiento en LAN, auditoría. |
| [`docs/AUDITORIA_LOGICA_UIUX.md`](./docs/AUDITORIA_LOGICA_UIUX.md) | Auditoría técnica + registro de remediación (nota 9/10). |
| [`docs/README.md`](./docs/README.md) | Índice completo de la documentación. |

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
- `PUBLIC_WEB3FORMS_KEY`: Clave pública de Web3Forms necesaria para el funcionamiento del formulario de contacto.
- `CMS_ADMIN_EMAIL`: Correo del administrador para el CMS (por defecto `admin@hidromont.local`).
- `CMS_ADMIN_PASSWORD`: Contraseña del administrador. Cambiarla es obligatorio si el CMS escuchará fuera del equipo local.
- `CMS_HOST`: Host del CMS. Por defecto debe ser `127.0.0.1`; usa `0.0.0.0` solo si necesitas acceso desde la LAN.

> [!WARNING]
> Si el CMS será accesible en tu red local (LAN), cambia `CMS_ADMIN_PASSWORD` y agrega en `CMS_ALLOWED_ORIGINS` el origen exacto del sitio de edición. El servidor falla al iniciar si se expone a la red con la contraseña por defecto.

---

## 💻 Comandos Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia **únicamente** el servidor de desarrollo de Astro en `http://localhost:4321`. |
| `npm run cms` | Inicia **únicamente** el servidor Fastify del CMS en `http://localhost:8787`. |
| `npm run dev:cms` | **Recomendado para editar:** Inicia Astro y el CMS juntos concurrentemente. |
| `npm run cms:import` | Importa el contenido estático actual de los archivos a la base de datos SQLite. |
| `npm run cms:export` | Exporta la base de datos SQLite a archivos JSON (`cms-content.json`) y colecciones Markdown. |
| `npm run cms:backup` | Genera una copia de seguridad fechada de la base de datos SQLite en `cms/data/backups/`. |
| `npm run build` | Valida el código (`astro check`) y compila el sitio estático optimizado en la carpeta `/dist`. |
| `npm run preview` | Previsualiza localmente el sitio web compilado en producción. |
| `npm run test` | Ejecuta las pruebas unitarias y de integración del backend del CMS con Vitest. |
| `npm run test:e2e` | Ejecuta las pruebas integrales de Playwright para validar flujos críticos. |

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
1. Abre tu navegador y dirígete a: **`http://localhost:4321?cms=1`**
2. Se almacenará un flag en el almacenamiento local de tu navegador y aparecerá una barra flotante en la esquina inferior izquierda con la etiqueta **Hidromont CMS**.
3. Se desplegará el panel lateral derecho con el formulario de inicio de sesión.

### Paso 3: Iniciar sesión
Utiliza las credenciales configuradas en tu `.env`:
- **Email**: `admin@hidromont.local`
- **Contraseña**: `Hidromont-Admin-ChangeMe`

### Paso 4: Edición en pantalla
1. Mueve el cursor por la pantalla. Todo elemento editable (títulos, descripciones, números, enlaces, imágenes) se resaltará con un **borde azul** al pasar por encima.
2. **Haz clic** sobre el elemento que deseas modificar.
3. El panel derecho cambiará para mostrar el editor correspondiente al tipo de campo:
   - **Texto / Textarea**: Entrada directa de texto.
   - **Listas**: Permite agregar, reordenar y eliminar elementos de listas (por ejemplo, especificaciones de maquinaria o metodologías).
   - **Enlaces**: Campos independientes para el texto del enlace y la URL.
   - **Imágenes**: Permite subir un archivo nuevo, seleccionar una imagen existente de la biblioteca de medios local, definir el texto alternativo (`alt`) y ajustar el punto focal de recorte.
4. Presiona el botón **Guardar** en el panel para guardar temporalmente tus cambios en la base de datos SQLite local.

### Paso 5: Sincronizar y Exportar los cambios
Los cambios guardados en la base de datos no se reflejan automáticamente en los archivos fuente del proyecto hasta que se exportan.
1. En la barra inferior del CMS, haz clic en **Exportar y validar** (o ejecuta `npm run cms:export` en la terminal).
2. Esto escribirá los datos en `src/data/cms-content.json` y actualizará las colecciones Markdown de Astro.
3. El CMS ejecutará una validación automática (`npm run check`) para asegurar que los archivos exportados no rompen la integridad tipográfica o estructural del sitio.
4. Una vez validado correctamente, el estado en la barra cambiará a `✓ Exportado · falta desplegar`.

---

## 🌍 Publicación en Producción

El sitio público de Hidromont es **completamente estático** para garantizar máxima seguridad y velocidad de carga. El CMS corre únicamente de forma local o en la red local de la empresa (LAN).

Para publicar los cambios en el servidor web de producción (`hidromont.cl`):

1. **Guardar y Exportar**: Asegúrate de haber realizado el paso "Exportar y validar" en el CMS para que los archivos del código fuente estén al día.
2. **Hacer Build**: Compila el sitio estático optimizado ejecutando:
   ```bash
   npm run build
   ```
3. **Desplegar**: Sube el contenido de la carpeta `/dist` generada a Cloudflare Pages, que usa `public/_redirects` y `public/_headers` para fallback 404, cache y cabeceras de seguridad. Si se usa otro hosting, replica esas cabeceras en su configuración equivalente antes de publicar.

### ⚙️ Variables de entorno en el build de producción (Cloudflare Pages)

El build de Cloudflare Pages **debe** configurar estas variables para evitar filtrar el CMS al público (H1) y asegurar las cookies (H2):

| Variable | Valor en producción | Razón |
|---|---|---|
| `PUBLIC_ENABLE_CMS` | **`0`** | Evita que el build incluya el overlay del CMS (66 KB JS inline + atributos `data-cms-entry`). El CI verifica con `e2e/build-gate.spec.ts` que `dist/` no contenga marcadores del CMS. |
| `NODE_ENV` | `production` | Activa los defaults de producción (cookie segura por defecto). |
| `PUBLIC_CONTACT_EMAIL` | `contacto@hidromont.cl` | Correo destinatario del formulario. El fallback en código ya es este valor. |
| `PUBLIC_CMS_API_BASE` | (vacío o la URL LAN del CMS) | El frontend público no necesita contactar al CMS. |

> **Importante**: si en algún momento necesitas regenerar el build CON el overlay (p. ej. para editar contenido en un entorno staging), usa `PUBLIC_ENABLE_CMS=1` sólo en ese build y **nunca** lo despliegues a `hidromont.cl`. El build de producción del dominio público siempre debe llevar `0`.

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
- **Cabeceras del sitio público**: `public/_headers` define `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y una CSP estricta para Cloudflare Pages. La CSP incluye el hash SHA-256 del script estático `.js classList` (M5); `'unsafe-inline'` se mantiene porque Astro genera JSON-LD que varía por página.
