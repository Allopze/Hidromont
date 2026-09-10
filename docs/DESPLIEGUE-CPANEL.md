# Despliegue en cPanel con Node.js

Guía operativa para poner el sitio y el CMS a correr en un cPanel con Node.js.
Ambos van en **un solo proceso**: `npm start` levanta `server.mjs`, que sirve
el sitio estático de `dist/` y la API del CMS en el mismo puerto.

La consecuencia buena es que el ciclo de publicación cierra solo: «Publicar»
en el CMS compila `dist/` y, como es el mismo `dist/` que el proceso sirve, el
cambio queda en línea al terminar. No hay que subir nada a mano.

La consecuencia a asumir es que el CMS queda accesible desde internet. Los
pasos de abajo incluyen lo necesario para que eso sea seguro.

---

## 0. Antes de empezar: qué preguntar al proveedor

| Dato                       | Por qué importa                                                      | Mínimo              |
| -------------------------- | -------------------------------------------------------------------- | ------------------- |
| Versión de Node disponible | `better-sqlite3` solo publica binario para algunas ABI; ver abajo    | **22 o 24**         |
| Acceso SSH                 | Sin él no se puede instalar dependencias ni compilar en el servidor  | Recomendado         |
| Cuota de disco             | El despliegue completo pesa ~1,1 GB compilando en el servidor        | **3 GB** holgado    |
| Memoria del proceso        | `astro check` compila TypeScript sobre 150 archivos                  | **1 GB** o más      |
| Tiempo de CPU por proceso  | Compilar tarda; si el plan corta procesos largos, «Publicar» fallará | sin límite estricto |
| HTTPS con certificado      | La cookie de sesión del CMS exige HTTPS                              | obligatorio         |

### Qué versión de Node elegir

El selector de Node de cPanel de este plan ofrece 6.17.1, 8.17.0, 9.11.2,
10.24.1, 11.15.0, 12.22.12, 14.21.3, 16.20.2, 18.20.8, 19.9.0, 20.20.2,
22.22.3 y 24.15.0. Solo las tres últimas cumplen el proyecto, y de esas hay
que descartar una:

| Versión        | better-sqlite3                   | Veredicto                    |
| -------------- | -------------------------------- | ---------------------------- |
| **24.15.0**    | binario para ABI 137             | **elegir esta**              |
| 22.22.3        | binario para ABI 127             | alternativa válida           |
| 20.20.2        | **sin binario** para ABI 115     | compila con node-gyp: evitar |
| 19.9.0 o menos | fuera del `engines` del proyecto | no arranca                   |

`better-sqlite3@12.10.0` publica binarios de Linux x64 solo para las ABI 127,
137, 141 y 147 —comprobado en los assets de su release—, así que en Node 20
el `npm ci` cae a `node-gyp rebuild` y necesita python3, make y g++, que en
hosting compartido no suele haber. Su propio `engines` dice «20.x», pero el
binario no está.

`sharp` no entra en esta cuenta: usa N-API 9, con lo que el mismo binario
sirve para 18, 20, 22 y 24.

**Elige 24.15.0**: es la misma ABI 137 con la que se verificó todo en local
(Node 24.18.0), así que los 246 tests unitarios, los 63 e2e y la compilación
se ejecutaron contra la misma interfaz binaria.

---

Reparto del espacio en el servidor, ya compilado:

```
node_modules     410 MB   el build necesita las devDependencies (Astro está ahí)
uploads/cms      321 MB   biblioteca de medios del CMS (WebP ≤1600 px)
dist             109 MB   lo que se sirve
public            85 MB   fuente del build
código + .git    129 MB   con clon superficial; ver sección 2
cms/data           3 MB   base de datos
                 ───────
                 ~1,06 GB
```

Antes de optimizar las imágenes eran ~3,0 GB: los originales de cámara pesaban
2,2 GB y el sitio nunca sirve más de 1.600 px de ancho. Ver
`npm run cms:optimize-uploads`, `npm run cms:optimize-fotos` y
`npm run cms:move-library-photos`.

---

## 1. Crear la aplicación Node en cPanel

En **Setup Node.js App**:

- **Node.js version**: la más alta disponible que sea ≥ 20.
- **Application mode**: `Production`.
- **Application root**: la carpeta donde vivirá el repositorio, por ejemplo
  `hidromont`. Conviene que **no** sea `public_html`.
- **Application URL**: el dominio o subdominio.
- **Application startup file**: `server.mjs`.

cPanel crea un entorno virtual de Node y muestra un comando `source
/home/USUARIO/nodevenv/...` — cópialo: hay que ejecutarlo antes de cualquier
`npm` por SSH, o `npm` usará el Node del sistema y compilará los módulos
nativos para la versión equivocada.

---

## 2. Qué subir y qué no

Son **tres transferencias**, porque dos de las tres cosas no están en git a
propósito:

| Qué                             | Cuánto | Cómo llega al servidor                    |
| ------------------------------- | ------ | ----------------------------------------- |
| Código y `public/`              | 129 MB | `git clone --depth 1` (ver abajo)         |
| `cms/data/hidromont-cms.sqlite` | 2,5 MB | `scp`, una sola vez                       |
| `uploads/cms/`                  | 321 MB | `rsync`, una sola vez                     |
| `.env`                          | —      | **se escribe en el servidor**, no se sube |

Lo que **no** hay que subir nunca:

| Qué                    | Cuánto | Por qué no                                              |
| ---------------------- | ------ | ------------------------------------------------------- |
| `dist/`                | 109 MB | lo genera el servidor al compilar                       |
| `node_modules/`        | 410 MB | lo instala `npm ci` con los binarios de su Node         |
| `uploads/_originales/` | 2,2 GB | originales de cámara previos al WebP; archívalos aparte |
| `_retirados/`          | 80 MB  | fotos que ninguna página usa                            |
| `cms/data/backups/`    | 20 MB  | respaldos locales; el servidor hace los suyos           |
| `cms/data/lqip-cache/` | 840 KB | caché; se regenera en la primera exportación            |
| `.env`                 | —      | tiene la contraseña del CMS: se escribe allí            |

### El clon tiene que ser superficial

**Un `git clone` normal descarga 6,2 GB.** El historial arrastra los
originales de cámara y los `dist/` de antes de que se ignoraran, y eso no se
arregla clonando otra vez. Con la copia superficial son 245 MB:

```bash
git clone --depth 1 https://github.com/Allopze/Hidromont.git hidromont
```

Para actualizar después, `git pull --depth 1` o, más simple,
`git fetch --depth 1 origin main && git reset --hard origin/main`.

Si el plan no tiene git, la alternativa es `rsync` excluyendo lo generado:

```bash
rsync -avz --progress \
  --exclude node_modules --exclude dist --exclude .git \
  --exclude uploads --exclude cms/data \
  ./ USUARIO@SERVIDOR:~/hidromont/
```

### Git deploy de cPanel

Añadir un `.cpanel.yml` al repositorio con las tareas de despliegue. No está
creado todavía; si eliges esta vía, dilo y lo añado.

---

## 3. Directorios que deben sobrevivir a un redespliegue

Estos dos **no** pueden vivir dentro del árbol que se sincroniza con git,
porque un `git pull --force` o un redespliegue los borraría:

- `cms/data/` — la base de datos SQLite y los respaldos.
- `uploads/cms/` — la biblioteca de medios del CMS (321 MB).

Lo más simple es dejarlos fuera y enlazarlos:

```bash
mkdir -p ~/hidromont-datos/cms-data ~/hidromont-datos/uploads-cms
ln -s ~/hidromont-datos/cms-data   ~/hidromont/cms/data
ln -s ~/hidromont-datos/uploads-cms ~/hidromont/uploads/cms
```

O apuntarlos por configuración: `CMS_DATABASE_PATH` y `CMS_UPLOAD_DIR` aceptan
rutas absolutas.

**`CMS_UPLOAD_DIR` nunca debe caer dentro de `public/`.** Astro copia `public/`
entero a `dist/` en cada compilación, así que los 321 MB se duplicarían en cada
build. El servidor aborta al arrancar si detecta esa configuración.

### Migrar los datos actuales

```bash
# desde tu máquina, con el CMS local detenido
scp cms/data/hidromont-cms.sqlite USUARIO@SERVIDOR:~/hidromont-datos/cms-data/
rsync -avz --progress uploads/cms/ USUARIO@SERVIDOR:~/hidromont-datos/uploads-cms/
```

`rsync` es preferible a `scp` para los 321 MB: se puede reanudar si se corta.

---

## 4. Configuración

```bash
cd ~/hidromont
cp .env.production.example .env
nano .env
```

Cada valor lleva comentado su porqué. Los que **hay que completar**:

| Variable              | Valor                                            |
| --------------------- | ------------------------------------------------ |
| `CMS_ADMIN_EMAIL`     | el correo con el que entrarás al CMS             |
| `CMS_ADMIN_PASSWORD`  | contraseña larga y única (mínimo 16 caracteres)  |
| `CMS_ALLOWED_ORIGINS` | `https://hidromont.cl,https://www.hidromont.cl`  |
| `CMS_HOST`            | normalmente `127.0.0.1`: Passenger hace de proxy |

Los que **no debes cambiar** sin entender la consecuencia:

- `CMS_COOKIE_SECURE=1` — sin esto la sesión de administrador viaja en claro.
- `CMS_ALLOW_INSECURE_COOKIE` vacío — es un escape hatch para LAN.
- `CMS_UPLOAD_DIR` fuera de `public/`.
- `CMS_PUBLISH_CHECK_COMMAND=npm run build` — con `npm run check` el botón
  «Publicar» validaría pero no actualizaría el sitio.
- `PUBLIC_ENABLE_CMS=1` — la barra del CMS _es_ el overlay; con `0` no hay
  interfaz de administración en el servidor.

El correo del formulario ya viene configurado: destinatario
`hidromont@hidromont.cl`, con copia a `clopezd@hidromont.cl` y
`jicoterillo@hidromont.cl`.

---

## 5. Instalar, verificar y compilar

```bash
source /home/USUARIO/nodevenv/hidromont/20/bin/activate   # el comando que dio cPanel
cd ~/hidromont

npm ci                      # instala y compila los módulos nativos
npm run check:deploy-env    # verificación del entorno
```

**No uses `npm ci --omit=dev`.** Astro y `@astrojs/*` están en
`devDependencies`, así que sin ellas no hay build posible. Las 11
`dependencies` son solo lo que el proceso necesita en marcha.

`check:deploy-env` comprueba versión de Node, que `better-sqlite3` y `sharp`
carguen, permisos de escritura, espacio y el perfil de `.env`. **Debe terminar
con 0 fallos** antes de seguir. Si algún módulo nativo no carga:

```bash
npm rebuild better-sqlite3 sharp
```

Después, mide cuánto tarda una compilación:

```bash
time npm run build
```

Ajusta `CMS_PUBLISH_TIMEOUT_MS` a unas **tres veces** lo medido (en
milisegundos). En local tarda unos 7 segundos con los derivados de imagen ya
generados; en hosting compartido y en frío será bastante más.

---

## 6. Arrancar

Desde el panel de cPanel, **Restart App**. O por SSH:

```bash
npm start
```

Comprobaciones:

```bash
curl -I https://hidromont.cl/                    # 200 + cabeceras de seguridad
curl -I https://hidromont.cl/proyectos/ch-dorias # 301 a /proyectos/ch-doiras
curl -s https://hidromont.cl/api/cms/health      # {"ok":true,...}
```

En la respuesta de la primera deben aparecer `content-security-policy`,
`permissions-policy`, `x-frame-options: SAMEORIGIN` y
`strict-transport-security`.

---

## 7. Primer uso del CMS

1. Abre `https://hidromont.cl/?cms=1`.
2. Entra con `CMS_ADMIN_EMAIL` y `CMS_ADMIN_PASSWORD`.
3. Los cinco botones de la barra deben aparecer **sin recargar**.
4. Cambia un texto, guarda, pulsa **Publicar** y espera. Al terminar, recarga
   la página pública: el cambio debe estar.

Si la contraseña del `.env` no coincide con la de la base (por ejemplo porque
migraste una base que ya tenía usuario):

```bash
npm run cms:reset-password
```

---

## 8. Rutina de actualización

Cuando haya cambios de código:

```bash
source /home/USUARIO/nodevenv/.../activate
cd ~/hidromont
git pull
npm ci            # solo si cambió package-lock.json
npm run build
# Restart App desde cPanel
```

Los cambios de **contenido** no pasan por aquí: se hacen en el CMS y se
publican desde el propio panel.

---

## 9. Respaldos

La base es un único archivo. Un cron diario basta:

```bash
0 3 * * * cd ~/hidromont && npm run cms:backup
```

Deja copias con fecha en `cms/data/backups/`. Conviene además bajarlas fuera
del servidor de vez en cuando: es donde vive todo el contenido editado.

No subas al servidor los respaldos que tengas en local: son ~2 MB cada uno y
no aportan nada allí. Conviene también podar los antiguos cada cierto tiempo.

---

## 10. Si algo falla

| Síntoma                                                                             | Causa habitual                                      | Qué hacer                                                        |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------- |
| La app no arranca y el log dice `ERROR: CMS_UPLOAD_DIR apunta dentro de public/`    | Ruta de subidas mal configurada                     | Ponerla fuera de `public/`                                       |
| `ERROR: No se puede iniciar el CMS expuesto a la red con la contraseña por defecto` | Falta `CMS_ADMIN_PASSWORD`                          | Definirla en `.env`                                              |
| `ERROR: El CMS está expuesto a la red con CMS_COOKIE_SECURE=0`                      | Falta HTTPS o la variable                           | Poner `CMS_COOKIE_SECURE=1` y servir por HTTPS                   |
| `Cannot find module ... better-sqlite3`                                             | Módulo compilado para otra versión de Node          | `npm rebuild better-sqlite3 sharp` con el entorno activado       |
| «Publicar» falla por tiempo                                                         | El build tarda más que el timeout                   | Subir `CMS_PUBLISH_TIMEOUT_MS`                                   |
| Las imágenes de la biblioteca salen rotas                                           | `CMS_UPLOAD_DIR` no apunta donde están los archivos | Comprobar la ruta; el arranque avisa cuántos faltan              |
| El sitio carga pero sin animaciones                                                 | La CSP bloquea los scripts inline                   | No debería ocurrir: los hashes se calculan solos. Revisar el log |
| El formulario dice «Ocurrió un error»                                               | La CSP bloquea la llamada a formsubmit.co           | Comprobar que la CSP incluya `connect-src` con formsubmit.co     |

Los logs de la aplicación están en el panel de cPanel y en `stderr` del
proceso. Los avisos del CMS empiezan por `[CMS]`.
