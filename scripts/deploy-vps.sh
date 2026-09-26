#!/usr/bin/env bash
#
# Despliega el código en el VPS: trae los commits, instala, compila y reinicia.
#
#   npm run deploy                          (usa el alias «hidromont»)
#   npm run deploy -- otro-alias
#   npm run deploy -- root@170.239.86.178 -p 52607
#   npm run deploy -- --ligero              (salta astro check; ver abajo)
#
# NO toca la base del CMS ni uploads/cms. Esos datos viven en el servidor y los
# edita el operador desde el panel: pisarlos desde aquí borraría su trabajo.
# Para subirlos en la otra dirección está `scripts/sync-datos-vps.sh`.
#
# El código llega por `git pull`, no por rsync, para que lo que corre en
# producción sea siempre un commit publicado al que se pueda volver. Por eso el
# script se niega a desplegar si queda algo sin commitear o sin empujar.
set -euo pipefail

DESTINO="hidromont"   # el alias de ~/.ssh/config; ver docs/DESPLIEGUE-VPS.md
PUERTO=""
RUTA_REMOTA=/srv/hidromont
LIGERO=""
DESTINO_EXPLICITO=""

uso() {
  cat >&2 <<'USO'
Uso: npm run deploy -- [alias-ssh | usuario@host] [-p PUERTO] [-d RUTA] [--ligero]

  -p PUERTO   puerto SSH (innecesario si usas un alias de ~/.ssh/config)
  -d RUTA     directorio de la aplicación (por defecto /srv/hidromont)
  --ligero    compila sin `astro check`. Es el paso más caro (907 MB medidos)
              y en un VPS de 2 GB puede morir por memoria. Úsalo solo si el
              build falla por eso: saltarlo deja pasar errores de tipos.
USO
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--puerto) PUERTO="${2:-}"; shift 2 ;;
    -d|--destino) RUTA_REMOTA="${2:-}"; shift 2 ;;
    --ligero) LIGERO="1"; shift ;;
    -h|--help) uso ;;
    -*) echo "Opción desconocida: $1" >&2; uso ;;
    # Un segundo argumento suelto casi siempre es una opción mal escrita.
    # Aceptarlo en silencio fue lo que convirtió un «-p 52607» en una ruta
    # remota llamada «-p» en el script hermano.
    *) [[ -z "$DESTINO_EXPLICITO" ]] || { echo "Argumento inesperado: $1" >&2; uso; }
       DESTINO="$1"; DESTINO_EXPLICITO="1"; shift ;;
  esac
done

if [[ -n "$PUERTO" ]]; then
  [[ "$PUERTO" =~ ^[0-9]+$ ]] || { echo "Puerto no válido: $PUERTO" >&2; uso; }
  SSH=(ssh -p "$PUERTO")
else
  SSH=(ssh)
fi

cd "$(dirname "$0")/.."

rojo()  { printf '\033[31m%s\033[0m\n' "$1" >&2; }
verde() { printf '\033[32m%s\033[0m\n' "$1"; }
paso()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ── Comprobaciones locales ───────────────────────────────────────────────────
# Todas van ANTES de tocar el servidor: es mucho más barato negarse aquí que a
# mitad de un `npm ci` remoto.

paso "Comprobando el estado local"

RAMA="$(git rev-parse --abbrev-ref HEAD)"

if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then
  rojo "Hay cambios sin commitear."
  git status --short --untracked-files=no >&2
  rojo "Commitea o descarta antes de desplegar: producción debe ser un commit."
  exit 1
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -z "$UPSTREAM" ]]; then
  rojo "La rama «$RAMA» no tiene rama remota asociada."
  rojo "Publícala primero:  git push -u origin $RAMA"
  exit 1
fi

git fetch --quiet origin
PENDIENTES="$(git rev-list --count "$UPSTREAM..HEAD")"
if [[ "$PENDIENTES" != "0" ]]; then
  rojo "Hay $PENDIENTES commit(s) sin publicar en $UPSTREAM."
  git log --oneline "$UPSTREAM..HEAD" >&2
  rojo "El VPS despliega desde GitHub, así que primero:  git push origin $RAMA"
  exit 1
fi

ATRASADOS="$(git rev-list --count "HEAD..$UPSTREAM")"
if [[ "$ATRASADOS" != "0" ]]; then
  rojo "Tu rama va $ATRASADOS commit(s) por detrás de $UPSTREAM."
  rojo 'Haz git pull antes: desplegarías código más viejo del que ya hay publicado.'
  exit 1
fi

COMMIT="$(git rev-parse --short HEAD)"
verde "  rama $RAMA en $COMMIT, sincronizada con $UPSTREAM"

# ── Conexión ─────────────────────────────────────────────────────────────────

paso "Comprobando la conexión con $DESTINO"
"${SSH[@]}" -o ConnectTimeout=10 -o BatchMode=yes "$DESTINO" true || {
  rojo "No se pudo conectar. Revisa la IP, el puerto SSH y que tu clave esté autorizada."
  exit 1
}

# Conectando como root no hay sudo que valga —y en muchas imágenes mínimas ni
# está instalado—, así que se antepone solo cuando hace falta.
USUARIO="$("${SSH[@]}" -G "$DESTINO" 2>/dev/null | awk '$1=="user"{print $2; exit}')"
if [[ "$USUARIO" == "root" ]]; then SUDO=""; else SUDO="sudo "; fi
verde "  conectado como ${USUARIO:-?}"

# El servicio corre como root (User=root en hidromont.service), así que el
# despliegue también: no hay cambio de usuario y los archivos que deja npm ci
# o el build son los mismos que el proceso va a leer. Si algún día se vuelve a
# un usuario sin privilegios, esto tiene que volver a envolverse en
# `sudo -u <usuario> -H`, o el servicio dejará de poder leer lo que instale.
en_servidor() {
  "${SSH[@]}" "$DESTINO" "${SUDO}bash -lc 'cd $RUTA_REMOTA && $1'"
}

paso "Comprobando el estado del servidor"
en_servidor 'git rev-parse --is-inside-work-tree >/dev/null' || {
  rojo "$RUTA_REMOTA no es un clon de git. ¿Primer despliegue? Sigue docs/DESPLIEGUE-VPS.md."
  exit 1
}

# P1-01 (auditoría 2026-09): «Publicar» en el panel escribe en archivos que
# git también versiona (la proyección del contenido). En el servidor manda la
# base SQLite, así que esos cambios no son «cambios sin commitear» sino la copia
# viva del contenido: se respaldan, se descartan antes del pull y se vuelven a
# generar desde la base después. Solo lo que quede FUERA de estas rutas bloquea
# el despliegue.
RUTAS_EXPORT=(src/data/cms-content.json src/data/gallery.json src/content public/gallery/derived)
EXCLUIR_EXPORT=""
# Comillas dobles: en_servidor() envuelve el comando entre comillas simples.
for r in "${RUTAS_EXPORT[@]}"; do EXCLUIR_EXPORT+=" \":(exclude)$r\""; done

SUCIO_REMOTO="$(en_servidor "git status --porcelain --untracked-files=no -- . $EXCLUIR_EXPORT" || true)"
if [[ -n "$SUCIO_REMOTO" ]]; then
  rojo 'El servidor tiene cambios locales sin commitear fuera del contenido del CMS; git pull los pisaría.'
  echo "$SUCIO_REMOTO" >&2
  rojo "Revísalos a mano por SSH antes de volver a desplegar."
  exit 1
fi

EXPORT_SUCIO="$(en_servidor "git status --porcelain --untracked-files=no -- ${RUTAS_EXPORT[*]}" || true)"
if [[ -n "$EXPORT_SUCIO" ]]; then
  verde "  el contenido publicado desde el panel difiere de git ($(wc -l <<<"$EXPORT_SUCIO" | tr -d ' ') archivo(s)): se respalda y se regenera desde la base"
fi

ANTES="$(en_servidor 'git rev-parse --short HEAD')"
verde "  el servidor está en $ANTES"
if [[ "$ANTES" == "$COMMIT" ]]; then
  verde "  ya tiene este commit; se recompila igualmente por si cambió .env o los datos"
fi

# El botón «Exportar y validar» del panel ejecuta lo que diga esta variable, y
# si apunta a un build no atómico un fallo a mitad deja el sitio sin páginas.
# Pasó en producción (commit 0fea84b). Solo se lee esa clave: el .env tiene
# además la contraseña de administración.
COMANDO_PUBLICAR="$(en_servidor "grep -m1 '^CMS_PUBLISH_CHECK_COMMAND=' .env | cut -d= -f2-" 2>/dev/null || true)"
if [[ -n "$COMANDO_PUBLICAR" && "$COMANDO_PUBLICAR" != *"build:log"* ]]; then
  printf '\033[33m  aviso: el panel publica con «%s», que no es atómico.\033[0m\n' "$COMANDO_PUBLICAR"
  printf '\033[33m         Si ese build muere a mitad, el sitio se queda sin páginas.\033[0m\n'
  printf '\033[33m         Cámbialo en %s/.env a:  npm run build:log\033[0m\n' "$RUTA_REMOTA"
fi

# Cuántas veces se ha reiniciado el servicio ANTES de tocar nada. Con
# Restart=always, un proceso que muere y revive cada 5 s también aparece como
# «active»: la única señal honesta es que este contador deje de subir.
REINICIOS_ANTES="$("${SSH[@]}" "$DESTINO" "systemctl show hidromont -p NRestarts --value" 2>/dev/null || echo 0)"

# ── Despliegue ───────────────────────────────────────────────────────────────

paso "Trayendo el código"
en_servidor "git fetch --quiet origin"
# Cambios de contenido que llegan por git: en el servidor los sustituirá lo que
# diga la base. Se avisa para que nadie crea que un arreglo de texto hecho en
# el JSON o en un .md ya está publicado (debe entrar por el CMS o por la semilla).
CONTENIDO_ENTRANTE="$(en_servidor "git diff --name-only HEAD @{upstream} -- ${RUTAS_EXPORT[*]}" || true)"
if [[ -n "$CONTENIDO_ENTRANTE" ]]; then
  printf '\033[33m  aviso: estos commits cambian archivos de contenido; en el servidor manda la base\033[0m\n'
  printf '\033[33m         y se sobrescribirán al regenerar. Claves NUEVAS sí se siembran al arrancar.\033[0m\n'
  sed 's/^/           /' <<<"$CONTENIDO_ENTRANTE"
fi
if [[ -n "$EXPORT_SUCIO" ]]; then
  SELLO="$(date +%Y-%m-%dT%H-%M-%S)"
  en_servidor "mkdir -p cms/data/backups && git diff --name-only -- ${RUTAS_EXPORT[*]} | tar -czf cms/data/backups/export-antes-de-deploy-$SELLO.tar.gz -T - && git checkout -- ${RUTAS_EXPORT[*]}"
  verde "  respaldo: cms/data/backups/export-antes-de-deploy-$SELLO.tar.gz"
fi
en_servidor "git pull --ff-only"

paso "Instalando dependencias"
# `npm ci` instala también las devDependencies: Astro vive ahí y sin ellas ni
# este build ni el botón «Exportar y validar» del panel pueden compilar.
en_servidor "npm ci"

paso "Regenerando el contenido desde la base"
# La base del servidor es la fuente de verdad: lo que el pull haya traído en
# los archivos de contenido se sustituye por lo publicado desde el panel.
en_servidor "npm run --silent cms:export" || {
  rojo "No se pudo regenerar el contenido desde la base; no se compila nada."
  rojo "El sitio sigue sirviendo el build anterior. Revisa el mensaje de arriba."
  exit 1
}

paso "Compilando"
# `build:log` y no `build:servidor`: compila en `dist.nuevo` y solo sustituye
# `dist` si termina bien y hay un index.html dentro. `build:servidor` deja que
# Astro vacíe `dist` antes de generar, así que un build que muera a medias
# —pasó en producción con un tope de hilos— deja el sitio sin páginas.
if [[ -n "$LIGERO" ]]; then
  echo "    (modo ligero: sin astro check)"
  en_servidor "BUILD_LIGERO=1 npm run build:log"
else
  en_servidor "npm run build:log"
fi

paso "Reiniciando el servicio"
"${SSH[@]}" "$DESTINO" "${SUDO}systemctl restart hidromont"

# ── Verificación ─────────────────────────────────────────────────────────────

paso "Verificando"
# tsx transpila el CMS al arrancar: tarda unos 6 s en escuchar, así que un
# curl inmediato da «Connection refused» aunque todo esté bien.
"${SSH[@]}" "$DESTINO" "
  for i in \$(seq 1 20); do
    curl -fsS -o /dev/null http://127.0.0.1:8787/api/cms/health && exit 0
    sleep 1
  done
  exit 1
" || {
  rojo "El servicio no respondió en 20 s. Mira el log:"
  rojo "  ssh $DESTINO 'journalctl -u hidromont -n 40 --no-pager'"
  exit 1
}

REINICIOS_DESPUES="$("${SSH[@]}" "$DESTINO" "systemctl show hidromont -p NRestarts --value")"
if [[ "$REINICIOS_DESPUES" -gt "$((REINICIOS_ANTES + 1))" ]]; then
  rojo "El servicio se está reiniciando en bucle (NRestarts: $REINICIOS_ANTES → $REINICIOS_DESPUES)."
  rojo "  ssh $DESTINO 'journalctl -u hidromont -n 40 --no-pager'"
  exit 1
fi

# El health del CMS responde aunque el sitio estático esté vacío, así que se
# comprueba también que la portada sale de verdad.
ESTADO_HOME="$("${SSH[@]}" "$DESTINO" "curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:8787/" || echo 000)"
[[ "$ESTADO_HOME" == "200" ]] || {
  rojo "La portada devuelve $ESTADO_HOME. El build puede haber dejado dist incompleto."
  exit 1
}

DESPUES="$(en_servidor 'git rev-parse --short HEAD')"
paso "Listo"
verde "  $ANTES → $DESPUES   ·   servicio activo   ·   portada 200"
echo "  La base y los medios no se han tocado."
