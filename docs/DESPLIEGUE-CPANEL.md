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

| Dato                       | Por qué importa                                                                     | Mínimo              |
| -------------------------- | ----------------------------------------------------------------------------------- | ------------------- |
| Versión de Node disponible | `better-sqlite3` y `sharp` son módulos nativos: necesitan binarios para esa versión | **20 o superior**   |
| Acceso SSH                 | Sin él no se puede instalar dependencias ni compilar en el servidor                 | Recomendado         |
| Cuota de disco             | El despliegue completo pesa ~3 GB, casi todo imágenes originales                    | **5 GB** holgado    |
| Memoria del proceso        | `astro check` compila TypeScript sobre 150 archivos                                 | **1 GB** o más      |
| Tiempo de CPU por proceso  | Compilar tarda; si el plan corta procesos largos, «Publicar» fallará                | sin límite estricto |
| HTTPS con certificado      | La cookie de sesión del CMS exige HTTPS                                             | obligatorio         |

Reparto del espacio, medido en este repositorio:

```
uploads/cms      2.2 GB   originales de las fotos (los sirve el CMS)
node_modules     410 MB   solo si se compila en el servidor
dist             236 MB   lo que se sirve
public           184 MB   solo si se compila en el servidor
cms/data          12 MB   base de datos y respaldos
                 ───────
                 ~3.0 GB
```

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

## 2. Subir el código

Tres opciones, de mejor a peor:

1. **Git en el servidor** (recomendado): `git clone` y luego `git pull` para
   cada actualización.
2. **Git deploy de cPanel**: añadir un `.cpanel.yml` al repositorio con las
   tareas de despliegue. No está creado todavía; si eliges esta vía, dilo y lo
   añado.
3. **FTP / gestor de archivos**: funciona, pero hay que subir también
   `node_modules` o instalar por SSH, y no se puede automatizar.

**Nunca subas `dist/` a mano.** Lo genera el servidor al compilar.

---

## 3. Directorios que deben sobrevivir a un redespliegue

Estos dos **no** pueden vivir dentro del árbol que se sincroniza con git,
porque un `git pull --force` o un redespliegue los borraría:

- `cms/data/` — la base de datos SQLite y los respaldos.
- `uploads/cms/` — los originales de las imágenes subidas por el CMS (~2,2 GB).

Lo más simple es dejarlos fuera y enlazarlos:

```bash
mkdir -p ~/hidromont-datos/cms-data ~/hidromont-datos/uploads-cms
ln -s ~/hidromont-datos/cms-data   ~/hidromont/cms/data
ln -s ~/hidromont-datos/uploads-cms ~/hidromont/uploads/cms
```

O apuntarlos por configuración: `CMS_DATABASE_PATH` y `CMS_UPLOAD_DIR` aceptan
rutas absolutas.

**`CMS_UPLOAD_DIR` nunca debe caer dentro de `public/`.** Astro copia `public/`
entero a `dist/` en cada compilación, así que los 2,2 GB se duplicarían en cada
build. El servidor aborta al arrancar si detecta esa configuración.

### Migrar los datos actuales

```bash
# desde tu máquina, con el CMS local detenido
scp cms/data/hidromont-cms.sqlite USUARIO@SERVIDOR:~/hidromont-datos/cms-data/
rsync -avz --progress uploads/cms/ USUARIO@SERVIDOR:~/hidromont-datos/uploads-cms/
```

`rsync` es preferible a `scp` para los 2,2 GB: se puede reanudar si se corta.

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
