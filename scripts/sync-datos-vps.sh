#!/usr/bin/env bash
#
# Sube al VPS los datos que NO están en git: la base SQLite del CMS y la
# biblioteca de medios (uploads/cms, ~2,5 GB).
#
#   ./scripts/sync-datos-vps.sh hidromont@203.0.113.10
#
# Se puede repetir cuantas veces haga falta: rsync solo manda lo que cambió.
#
# Por qué no un rsync directo del .sqlite: better-sqlite3 corre en modo WAL,
# así que las últimas escrituras viven en hidromont-cms.sqlite-wal y copiar
# solo el .sqlite deja una base atrasada o rota. `npm run cms:backup` usa la
# API de copia en caliente de SQLite, que produce un archivo coherente.
set -euo pipefail

DESTINO="${1:-}"
if [[ -z "$DESTINO" ]]; then
  echo "Uso: $0 usuario@host [ruta-remota]" >&2
  exit 1
fi
RUTA_REMOTA="${2:-/srv/hidromont}"

cd "$(dirname "$0")/.."

echo "==> Creando copia coherente de la base"
npm run --silent cms:backup >/dev/null
BACKUP="$(ls -t cms/data/backups/hidromont-cms-*.sqlite | head -1)"
echo "    $BACKUP"

echo "==> Deteniendo el servicio en el servidor"
# Si el CMS escribe mientras llega la base nueva, el archivo entrante queda
# mezclado con un WAL viejo. Parar es más barato que diagnosticar eso.
ssh "$DESTINO" "sudo systemctl stop hidromont" || echo "    (el servicio no estaba activo)"

echo "==> Subiendo la base"
ssh "$DESTINO" "mkdir -p $RUTA_REMOTA/cms/data && rm -f $RUTA_REMOTA/cms/data/hidromont-cms.sqlite-wal $RUTA_REMOTA/cms/data/hidromont-cms.sqlite-shm"
rsync -avz --progress "$BACKUP" "$DESTINO:$RUTA_REMOTA/cms/data/hidromont-cms.sqlite"

echo "==> Subiendo uploads/cms (puede tardar en la primera vez)"
# Sin --delete: borrar en el servidor medios que aquí ya no están es una
# decisión que debe tomarse a mano, no de rebote en cada sincronización.
rsync -avz --partial --progress uploads/cms/ "$DESTINO:$RUTA_REMOTA/uploads/cms/"

echo "==> Arrancando el servicio"
ssh "$DESTINO" "sudo systemctl start hidromont && sleep 2 && systemctl is-active hidromont"

echo "Listo."
