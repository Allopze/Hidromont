#!/usr/bin/env bash
#
# Sube al VPS los datos que NO están en git: la base SQLite del CMS y la
# biblioteca de medios (uploads/cms, ~2,5 GB).
#
#   ./scripts/sync-datos-vps.sh hidromont-vps          (alias de ~/.ssh/config)
#   ./scripts/sync-datos-vps.sh root@170.239.86.178 -p 52607
#
# Se puede repetir cuantas veces haga falta: rsync solo manda lo que cambió.
#
# CUIDADO: la base del servidor es la fuente de verdad del contenido (la edita
# el cliente desde el panel). Subir la local la SUSTITUYE. Por eso el script
# (P1-06, auditoría 2026-09) compara fechas, pide confirmación escribiendo
# SOBRESCRIBIR y guarda antes una copia de la base remota en
# cms/data/backups/ del servidor. `--forzar` salta solo la confirmación.
#
# Por qué no un rsync directo del .sqlite: better-sqlite3 corre en modo WAL,
# así que las últimas escrituras viven en hidromont-cms.sqlite-wal y copiar
# solo el .sqlite deja una base atrasada o rota. `npm run cms:backup` usa la
# API de copia en caliente de SQLite, que produce un archivo coherente.
set -euo pipefail

DESTINO=""
FORZAR=""
PUERTO=""
RUTA_REMOTA=/srv/hidromont

uso() {
  cat >&2 <<'USO'
Uso: sync-datos-vps.sh (alias-ssh | usuario@host) [-p PUERTO] [-d RUTA_REMOTA]

  -p PUERTO   puerto SSH (innecesario si usas un alias de ~/.ssh/config)
  -d RUTA     directorio de la aplicación en el servidor (por defecto /srv/hidromont)
  --forzar    no pedir confirmación (la copia de la base remota se hace igual)
USO
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--puerto) PUERTO="${2:-}"; shift 2 ;;
    -d|--destino) RUTA_REMOTA="${2:-}"; shift 2 ;;
    --forzar) FORZAR="1"; shift ;;
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

# Con un alias de ~/.ssh/config, el puerto y el usuario ya están ahí: pasar
# -p por encima solo sirve para contradecirlos.
if [[ -n "$PUERTO" ]]; then
  [[ "$PUERTO" =~ ^[0-9]+$ ]] || { echo "Puerto no válido: $PUERTO" >&2; uso; }
  SSH=(ssh -p "$PUERTO")
  RSYNC_SHELL="ssh -p $PUERTO"
else
  SSH=(ssh)
  RSYNC_SHELL="ssh"
fi

# Conectando como root no hay sudo que valga —y en muchas imágenes mínimas ni
# está instalado—, así que se antepone solo cuando hace falta. `ssh -G` resuelve
# el usuario efectivo, venga del alias o del usuario@host.
USUARIO="$("${SSH[@]}" -G "$DESTINO" 2>/dev/null | awk '$1=="user"{print $2; exit}')"
if [[ "$USUARIO" == "root" ]]; then SUDO=""; else SUDO="sudo "; fi

cd "$(dirname "$0")/.."

echo "==> Comprobando la conexión con $DESTINO (usuario ${USUARIO:-?})"
# Falla aquí, con un mensaje claro, en vez de a mitad de una subida de 2,5 GB.
"${SSH[@]}" -o ConnectTimeout=10 -o BatchMode=yes "$DESTINO" true || {
  echo "No se pudo conectar. Revisa la IP, el puerto SSH y que tu clave esté autorizada." >&2
  exit 1
}

echo "==> Creando copia coherente de la base"
npm run --silent cms:backup >/dev/null
BACKUP="$(ls -t cms/data/backups/hidromont-cms-*.sqlite | head -1)"
echo "    $BACKUP"

# Última modificación de contenido de una base (max de updated_at). Se lee con
# better-sqlite3 porque el servidor no tiene por qué tener el CLI de sqlite3.
ULTIMA_EDICION_JS="const D=require('better-sqlite3');const db=new D(process.argv[1],{readonly:true,fileMustExist:true});const r=db.prepare(\"SELECT MAX(t) m FROM (SELECT MAX(updated_at) t FROM content_fields UNION ALL SELECT MAX(updated_at) FROM gallery_items UNION ALL SELECT MAX(updated_at) FROM media_assets)\").get();console.log(r.m||'')"
LOCAL_ULTIMA="$(node -e "$ULTIMA_EDICION_JS" "$BACKUP" 2>/dev/null || true)"
REMOTA_ULTIMA="$("${SSH[@]}" "$DESTINO" "cd '$RUTA_REMOTA' 2>/dev/null && test -f cms/data/hidromont-cms.sqlite && node -e \"\$(cat)\" cms/data/hidromont-cms.sqlite" <<<"$ULTIMA_EDICION_JS" 2>/dev/null || true)"

if [[ -n "$REMOTA_ULTIMA" ]]; then
  echo "==> El servidor ya tiene una base"
  echo "    última edición en el servidor: $REMOTA_ULTIMA"
  echo "    última edición en esta copia:  ${LOCAL_ULTIMA:-?}"
  if [[ -n "$LOCAL_ULTIMA" && "$REMOTA_ULTIMA" > "$LOCAL_ULTIMA" ]]; then
    printf '\033[33m    El servidor tiene cambios MÁS NUEVOS que esta copia: se perderían.\033[0m\n'
  fi
  if [[ -z "$FORZAR" ]]; then
    read -r -p "    Escribe SOBRESCRIBIR para sustituir la base del servidor: " RESPUESTA
    [[ "$RESPUESTA" == "SOBRESCRIBIR" ]] || { echo "Cancelado: no se ha tocado nada." >&2; exit 1; }
  fi
fi

echo "==> Deteniendo el servicio en el servidor"
# La primera vez el servicio todavía no existe: eso no es un error.
"${SSH[@]}" "$DESTINO" "${SUDO}systemctl stop hidromont" 2>/dev/null \
  || echo "    (el servicio no estaba activo; normal en el primer despliegue)"

if [[ -n "$REMOTA_ULTIMA" ]]; then
  echo "==> Guardando una copia de la base del servidor"
  # Con el servicio parado, copiar la base con su -wal y -shm da una copia
  # coherente sin depender de nada instalado en el servidor.
  SELLO="$(date +%Y-%m-%dT%H-%M-%S)"
  "${SSH[@]}" "$DESTINO" "cd '$RUTA_REMOTA/cms/data' && mkdir -p backups && for f in hidromont-cms.sqlite hidromont-cms.sqlite-wal hidromont-cms.sqlite-shm; do [ -f \"\$f\" ] && cp -p \"\$f\" \"backups/antes-de-sync-$SELLO-\$f\"; done; ls backups/antes-de-sync-$SELLO-*"
fi

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
