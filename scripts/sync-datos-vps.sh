#!/usr/bin/env bash
#
# Sube al VPS los datos que NO están en git: la base SQLite del CMS y la
# biblioteca de medios (uploads/cms, ~2,5 GB).
#
#   ./scripts/sync-datos-vps.sh root@170.239.86.178 -p 52607
#   ./scripts/sync-datos-vps.sh hidromont@mi-vps -p 52607 -d /srv/hidromont
#
# Se puede repetir cuantas veces haga falta: rsync solo manda lo que cambió.
#
# Por qué no un rsync directo del .sqlite: better-sqlite3 corre en modo WAL,
# así que las últimas escrituras viven en hidromont-cms.sqlite-wal y copiar
# solo el .sqlite deja una base atrasada o rota. `npm run cms:backup` usa la
# API de copia en caliente de SQLite, que produce un archivo coherente.
set -euo pipefail

DESTINO=""
PUERTO=22
RUTA_REMOTA=/srv/hidromont

uso() {
  cat >&2 <<'USO'
Uso: sync-datos-vps.sh usuario@host [-p PUERTO] [-d RUTA_REMOTA]

  -p PUERTO   puerto SSH (por defecto 22)
  -d RUTA     directorio de la aplicación en el servidor (por defecto /srv/hidromont)
USO
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--puerto) PUERTO="${2:-}"; shift 2 ;;
    -d|--destino) RUTA_REMOTA="${2:-}"; shift 2 ;;
    -h|--help) uso ;;
    -*) echo "Opción desconocida: $1" >&2; uso ;;
    # El primer argumento suelto es usuario@host; un segundo suelto casi
    # siempre es una opción mal escrita, y aceptarlo en silencio fue
    # exactamente lo que convirtió un «-p 52607» en una ruta remota llamada
    # «-p».
    *) [[ -z "$DESTINO" ]] || { echo "Argumento inesperado: $1" >&2; uso; }
       DESTINO="$1"; shift ;;
  esac
done

[[ -n "$DESTINO" ]] || uso
[[ "$DESTINO" == *@* ]] || { echo "El destino debe ser usuario@host (recibido: $DESTINO)" >&2; uso; }
[[ "$PUERTO" =~ ^[0-9]+$ ]] || { echo "Puerto no válido: $PUERTO" >&2; uso; }

SSH=(ssh -p "$PUERTO")
RSYNC_SHELL="ssh -p $PUERTO"

# Conectando como root no hay sudo que valga —y en muchas imágenes mínimas ni
# está instalado—, así que se antepone solo cuando hace falta.
if [[ "${DESTINO%%@*}" == "root" ]]; then SUDO=""; else SUDO="sudo "; fi

cd "$(dirname "$0")/.."

echo "==> Comprobando la conexión con $DESTINO (puerto $PUERTO)"
# Falla aquí, con un mensaje claro, en vez de a mitad de una subida de 2,5 GB.
"${SSH[@]}" -o ConnectTimeout=10 -o BatchMode=yes "$DESTINO" true || {
  echo "No se pudo conectar. Revisa la IP, el puerto SSH y que tu clave esté autorizada." >&2
  exit 1
}

echo "==> Creando copia coherente de la base"
npm run --silent cms:backup >/dev/null
BACKUP="$(ls -t cms/data/backups/hidromont-cms-*.sqlite | head -1)"
echo "    $BACKUP"

echo "==> Deteniendo el servicio en el servidor"
# La primera vez el servicio todavía no existe: eso no es un error.
"${SSH[@]}" "$DESTINO" "${SUDO}systemctl stop hidromont" 2>/dev/null \
  || echo "    (el servicio no estaba activo; normal en el primer despliegue)"

echo "==> Subiendo la base"
"${SSH[@]}" "$DESTINO" "mkdir -p '$RUTA_REMOTA/cms/data' '$RUTA_REMOTA/uploads/cms' && rm -f '$RUTA_REMOTA/cms/data/hidromont-cms.sqlite-wal' '$RUTA_REMOTA/cms/data/hidromont-cms.sqlite-shm'"
rsync -avz -e "$RSYNC_SHELL" --progress "$BACKUP" "$DESTINO:$RUTA_REMOTA/cms/data/hidromont-cms.sqlite"

echo "==> Subiendo uploads/cms (puede tardar en la primera vez)"
# Sin --delete: borrar en el servidor medios que aquí ya no están es una
# decisión que debe tomarse a mano, no de rebote en cada sincronización.
rsync -avz -e "$RSYNC_SHELL" --partial --progress uploads/cms/ "$DESTINO:$RUTA_REMOTA/uploads/cms/"

echo "==> Arrancando el servicio"
"${SSH[@]}" "$DESTINO" "${SUDO}systemctl start hidromont && sleep 2 && systemctl is-active hidromont" \
  || echo "    (aún no hay servicio instalado: continúa con el paso 7 de docs/DESPLIEGUE-VPS.md)"

echo "Listo."
