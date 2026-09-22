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

**Esta instalación corre como root**, por decisión del operador (sep-2026).

```bash
sudo mkdir -p /srv/hidromont
```

Lo que eso implica, para que quede dicho: el servicio publica un panel de
administración a internet, así que un fallo explotable en el CMS deja de
comprometer una cuenta sin privilegios y pasa a comprometer la máquina.

Lo que lo acota es el endurecimiento de `deploy/hidromont.service`, y por eso
ahí **no es opcional**: `ProtectSystem=full` deja `/usr`, `/boot` y `/etc` en
solo lectura, `ReadWritePaths=/srv/hidromont` limita la escritura al directorio
de la aplicación, y `PrivateTmp` y `ProtectHome` cierran `/tmp` y `/root`. Sin
esas líneas, «root» significa literalmente cualquier cosa.

<details>
<summary>Volver a un usuario sin privilegios</summary>

Sigue siendo la opción recomendable. Para volver:

```bash
sudo adduser --system --group --home /srv/hidromont --shell /bin/bash hidromont
sudo chown -R hidromont:hidromont /srv/hidromont
sudo sed -i 's/^User=root/User=hidromont/; s/^Group=root/Group=hidromont/' \
  /etc/systemd/system/hidromont.service
sudo systemctl daemon-reload && sudo systemctl restart hidromont
```

Y en `scripts/deploy-vps.sh`, `en_servidor()` tiene que volver a envolver sus
comandos en `sudo -u hidromont -H`: si no, `npm ci` y el build dejarán archivos
de root que el servicio no podrá leer. Es el fallo `ENOENT`/`EACCES` de
«Problemas conocidos».

</details>

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
cd /srv/hidromont
git clone https://github.com/Allopze/Hidromont.git .
# git se niega a operar en un repositorio de otro dueño; con todo en root no
# hace falta, pero si algún día no coinciden:
#   git config --global --add safe.directory /srv/hidromont
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
./scripts/sync-datos-vps.sh hidromont@IP -p PUERTO_SSH
```

`-p` solo hace falta si SSH no está en el 22 (muchos VPS lo mueven). Hay
también `-d` para cambiar el directorio remoto, que por defecto es
`/srv/hidromont`. La primera vez, cuando el servicio aún no existe, el script
avisa y sigue: es lo esperado.

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

Si hiciste los pasos anteriores conectado como `root` —lo normal—, todo
`/srv/hidromont` pertenece a root y el servicio, que corre como `hidromont`,
no puede leer ni el `.env` ni la base. Corrígelo antes de arrancar:

```bash
sudo chown -R root:root /srv/hidromont
sudo chmod 600 /srv/hidromont/.env
```

```bash
sudo cp /srv/hidromont/deploy/hidromont.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hidromont

# tsx transpila el CMS al arrancar: tarda unos 6 s en escuchar. Un curl
# inmediato da «Connection refused» aunque todo esté bien.
sleep 10
systemctl is-active hidromont          # active
systemctl show hidromont -p NRestarts --value   # debe quedarse quieto
curl -I http://127.0.0.1:8787/         # 200
```

`active` no basta como prueba: con `Restart=always`, un proceso que muere y
revive cada 5 s también aparece como `active`. Si `NRestarts` sigue subiendo,
mira el log:

```bash
journalctl -u hidromont -n 40 --no-pager
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
sudo ufw allow 80,443/tcp
sudo ufw allow 22/tcp          # o el puerto real de tu SSH, p. ej. 52607/tcp
sudo ufw enable
```

Abre el puerto de SSH **antes** del `enable` y compruébalo desde otra terminal
ya conectada. Si tu SSH no está en el 22 y habilitas ufw con la regla
`OpenSSH`, te quedas fuera del servidor.

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

Desde tu máquina, con todo commiteado y empujado:

```bash
npm run deploy
```

Usa el alias `hidromont` de `~/.ssh/config`. Trae los commits, instala,
compila y reinicia, y verifica que el servicio quedó en pie de verdad.

Antes de tocar el servidor comprueba en local que no queda nada sin commitear
ni sin publicar, y que tu rama no va por detrás del remoto. El motivo es que lo
que corre en producción tiene que ser siempre un commit al que se pueda volver:
si el despliegue sale mal, `git log` del servidor dice exactamente qué hay.

| Argumento                             | Para qué                                             |
| ------------------------------------- | ---------------------------------------------------- |
| `npm run deploy -- otro-alias`        | otro destino                                         |
| `npm run deploy -- root@IP -p PUERTO` | sin alias en `~/.ssh/config`                         |
| `npm run deploy -- -d /otra/ruta`     | otro directorio (por defecto `/srv/hidromont`)       |
| `npm run deploy -- --ligero`          | compila sin `astro check`, el paso más caro (907 MB) |

**No toca la base del CMS ni `uploads/cms`.** Esos datos viven en el servidor y
los edita el operador desde el panel; pisarlos desde tu máquina borraría su
trabajo. Para subirlos en la otra dirección está `scripts/sync-datos-vps.sh`.

Compila con `npm run build:log`, que genera en `dist.nuevo` y sustituye `dist`
solo si termina bien. `build:servidor` y `build` dejan que Astro vacíe `dist`
antes de generar, así que un build que muera a mitad deja el sitio sin páginas.

> **Revisa `CMS_PUBLISH_CHECK_COMMAND` en el `.env` del servidor.** Es lo que
> ejecuta el botón «Exportar y validar» del panel, y durante un tiempo apuntó a
> `npm run build:servidor`, que no es atómico. Un build que muriera a mitad —y
> pasó: ver el commit `0fea84b`— tiraba el sitio, disparado por un editor
> pulsando «Publicar». Debe decir `npm run build:log`. `npm run deploy` avisa si
> no es así, pero no lo cambia solo.

Si prefieres hacerlo a mano, el equivalente es:

```bash
cd /srv/hidromont && git pull && npm ci && npm run build:log
systemctl restart hidromont
```

**Ver qué pasa**

```bash
journalctl -u hidromont -f          # sitio y CMS
journalctl -u caddy -f              # TLS y peticiones
```

**Backups automáticos** (diario a las 3:00, en el servidor):

```bash
sudo crontab -e
# 0 3 * * * cd /srv/hidromont && /usr/bin/npm run cms:backup >> /srv/hidromont/_cron.log 2>&1
```

Quedan en `cms/data/backups/`. Bájalos periódicamente a otra máquina: un
backup que vive solo en el mismo disco que la base no es un backup.

---

## Problemas conocidos

**`Error: ENOENT ... open '/srv/hidromont/.env'` con el archivo ahí delante** —
es un mensaje engañoso: `process.loadEnvFile()` de Node reporta como `ENOENT`
cualquier fallo al abrir, incluido `EACCES`. El archivo existe, pero el usuario
del servicio no puede leerlo.

Con el servicio corriendo como root esto no debería ocurrir. Si aparece, es que
algo cambió el dueño del directorio:

```bash
ls -l /srv/hidromont/.env        # debe ser del mismo usuario que el User= del servicio
sudo chown -R root:root /srv/hidromont
sudo chmod 600 /srv/hidromont/.env
```

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
