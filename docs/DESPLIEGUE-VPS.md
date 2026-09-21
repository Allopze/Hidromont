# Despliegue en VPS (Ubuntu + Caddy)

Guía operativa para poner el sitio y el CMS en un VPS propio. Sustituye a
[DESPLIEGUE-CPANEL.md](DESPLIEGUE-CPANEL.md): sin Passenger, sin FTP y sin el
límite de tiempo del panel que hacía fallar el `npm install` y el «Publicar».

**Arquitectura resultante**

```
internet ──443──> Caddy ──> 127.0.0.1:8787 ──> node server.mjs
                   │                            ├── dist/        sitio estático
                   │                            ├── /api/cms/*   panel + API
   TLS automático ─┘                            ├── uploads/cms  medios
                                                └── cms/data/*.sqlite
```

Un solo proceso sirve todo, igual que en cPanel. La ventaja es que ahora el
ciclo cierra de verdad: «Publicar» en el CMS ejecuta `npm run build:servidor`,
regenera `dist/` y el mismo proceso empieza a servirlo. No se sube nada a mano.

---

## 0. Qué debe tener el VPS

| Recurso | Mínimo      | Por qué                                                                    |
| ------- | ----------- | -------------------------------------------------------------------------- |
| RAM     | 2 GB + swap | `astro check` compila TypeScript sobre ~150 archivos. Con 4 GB va holgado. |
| Disco   | 20 GB       | uploads 2,5 GB + node_modules 410 MB + dist 99 MB + backups                |
| CPU     | 1 vCPU      | Basta; el build tarda más, nada más                                        |
| Node    | **24.x**    | `better-sqlite3@12` publica binario para ABI 137 (Node 24) y 127 (Node 22) |

Con 2 GB conviene crear swap antes de nada, o el primer build muere con
`JavaScript heap out of memory`:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Antes de empezar, apunta los registros **A** de `hidromontchile.cl` y
`www.hidromontchile.cl` a la IP del VPS. Caddy valida el certificado por
HTTP-01 y sin DNS correcto no arranca.

---

## 1. Usuario y directorio de la aplicación

El proceso no debe correr como root: publica un panel de administración a
internet.

```bash
sudo adduser --system --group --home /srv/hidromont --shell /bin/bash hidromont
sudo mkdir -p /srv/hidromont && sudo chown hidromont:hidromont /srv/hidromont
```

## 2. Node 24

El paquete de Ubuntu va varias versiones por detrás; usa NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git rsync
node -v   # debe decir v24.x
```

Comprueba que `better-sqlite3` y `sharp` traen binario y no intentan compilar
(si lo hicieran, harían falta `build-essential` y `python3`).

## 3. Código y dependencias

```bash
sudo -u hidromont -H bash
cd /srv/hidromont
git clone https://github.com/Allopze/Hidromont.git .
npm ci
```

`npm ci` instala también las devDependencies: Astro vive ahí y sin ellas el
botón «Publicar» no puede compilar. El `.npmrc` del repo ya lo fuerza con
`include=dev`.

## 4. El archivo `.env`

Genéralo **en tu máquina**, no a mano en el servidor:

```bash
npm run env:produccion -- --correo tu@correo.cl
```

Escribe `_deploy/.env` con una contraseña de administrador nueva de 24
caracteres, que **no se imprime**: ábrelo y guárdala en tu gestor de
contraseñas. Revisa que estas cinco claves queden así, porque son las que
cambian respecto a cPanel:

```
CMS_HOST=127.0.0.1        # solo Caddy lo alcanza
CMS_PORT=8787
CMS_TRUST_PROXY=1         # Caddy manda X-Forwarded-For; sin esto el límite de
                          # intentos de login vería una sola IP para todos
CMS_COOKIE_SECURE=1       # hay HTTPS real: la cookie va con prefijo __Host-
CMS_PUBLISH_CHECK_COMMAND=npm run build:servidor
```

Súbelo:

```bash
scp _deploy/.env hidromont@IP:/srv/hidromont/.env
ssh hidromont@IP 'chmod 600 /srv/hidromont/.env'
```

## 5. Datos del CMS

La base SQLite y `uploads/cms` están en `.gitignore`, así que el clon llega
vacío. Desde tu máquina:

```bash
./scripts/sync-datos-vps.sh hidromont@IP
```

El script hace la copia con `npm run cms:backup` en vez de un `rsync` directo
del `.sqlite`: la base va en modo WAL y copiar solo ese archivo deja fuera las
últimas escrituras.

Después, **en el servidor**, limpia credenciales heredadas de desarrollo:

```bash
npm run cms:preparar-produccion
```

Si alguna cuenta conserva el hash de la contraseña por defecto, el servidor se
niega a arrancar en producción. Es a propósito: esa contraseña está publicada
en el repositorio.

## 6. Primer build

```bash
cd /srv/hidromont && npm run build:servidor
```

Debe dejar `dist/` con `index.html` y `_assets/`. Si falla por memoria, vuelve
al swap del paso 0.

## 7. El servicio

```bash
sudo cp /srv/hidromont/deploy/hidromont.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hidromont
systemctl status hidromont
curl -I http://127.0.0.1:8787/     # 200
```

## 8. Caddy y HTTPS

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

sudo cp /srv/hidromont/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo journalctl -u caddy -f      # debe emitir el certificado sin errores
```

## 9. Cortafuegos

El puerto 8787 no se abre nunca: el proceso escucha en loopback.

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

Para que `scripts/sync-datos-vps.sh` pueda parar y arrancar el servicio sin
pedir contraseña:

```bash
echo 'hidromont ALL=(root) NOPASSWD: /usr/bin/systemctl stop hidromont, /usr/bin/systemctl start hidromont' \
  | sudo tee /etc/sudoers.d/hidromont-deploy
sudo chmod 440 /etc/sudoers.d/hidromont-deploy
```

## 10. Verificación

```bash
curl -I https://hidromontchile.cl                     # 200 + HSTS
curl -I https://www.hidromontchile.cl                 # 301 al dominio sin www
curl -I https://hidromontchile.cl/uploads/cms/…       # una imagen del CMS: 200
```

Y a mano: abre `https://hidromontchile.cl/?cms=1` —el panel es un overlay
sobre el propio sitio, no una URL aparte—, inicia sesión con el correo y la
contraseña del paso 4, cambia algo y pulsa **Publicar**. Si el cambio aparece
en el sitio, el ciclo completo funciona.

Si el overlay no aparece, el sitio se compiló sin `PUBLIC_ENABLE_CMS=1`: esa
variable se lee en tiempo de build, así que el `.env` tiene que estar en su
sitio **antes** del paso 6. Corrige y recompila.

---

## Operación

**Actualizar el código**

```bash
sudo -u hidromont -H bash -c 'cd /srv/hidromont && git pull && npm ci && npm run build:servidor'
sudo systemctl restart hidromont
```

**Ver qué pasa**

```bash
journalctl -u hidromont -f          # sitio y CMS
journalctl -u caddy -f              # TLS y peticiones
```

**Backups automáticos** (diario a las 3:00, en el servidor):

```bash
sudo -u hidromont crontab -e
# 0 3 * * * cd /srv/hidromont && /usr/bin/npm run cms:backup >> /srv/hidromont/_cron.log 2>&1
```

Quedan en `cms/data/backups/`. Bájalos periódicamente a otra máquina: un
backup que vive solo en el mismo disco que la base no es un backup.

---

## Problemas conocidos

**El servicio no arranca y el log dice «cuenta(s) con la contraseña por
defecto»** — falta el paso 5. Ejecuta `npm run cms:preparar-produccion`.

**«Publicar» falla sin mensaje claro** — casi siempre es memoria durante
`astro check`. Míralo con `journalctl -u hidromont` buscando `heap out of
memory`, y añade swap.

**Caddy no obtiene certificado** — DNS aún no propagado, o el puerto 80
cerrado. Let's Encrypt necesita alcanzar el 80 aunque el sitio final sea 443.

**Las imágenes del CMS dan 404** — `CMS_UPLOAD_DIR` debe apuntar a
`./uploads/cms` (fuera de `public/`) y esa carpeta debe pertenecer al usuario
`hidromont`. Comprueba con `ls -la /srv/hidromont/uploads/cms | head`.

**Lo que queda de cPanel** — `server.mjs` sigue detectando Passenger y
`npm run deploy:ftp` sigue existiendo. No estorban, pero en el VPS no se usan:
el despliegue es `git pull` + `systemctl restart`.
