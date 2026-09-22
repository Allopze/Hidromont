#!/usr/bin/env bash
#
# Pone el VPS a servir el sitio de verdad: instala Caddy, abre el cortafuegos
# y apunta el DNS de Cloudflare a la máquina.
#
#   npm run publicar
#
# Es de un solo uso. El despliegue del día a día es `npm run deploy`; esto es
# el paso 8-9 de docs/DESPLIEGUE-VPS.md, que nunca llegó a ejecutarse: hasta
# ahora el VPS tenía la aplicación corriendo en 127.0.0.1:8787 y nada
# escuchando en 80/443, así que quien servía hidromontchile.cl era el cPanel
# antiguo.
#
# ── Sobre el orden ───────────────────────────────────────────────────────────
#
# El DNS va ANTES de arrancar Caddy, y sin proxy de Cloudflare. El Caddyfile
# valida por HTTP-01: Let's Encrypt tiene que alcanzar el puerto 80 de ESTA
# máquina para emitir el certificado. Con la nube naranja puesta, la petición
# muere en Cloudflare y Caddy se queda sin certificado.
#
# Una vez emitido, se puede volver a activar el proxy: eso se hace a mano y el
# script lo recuerda al final.
#
# ── Cloudflare ───────────────────────────────────────────────────────────────
#
# Necesita un token de API con permiso «Zone:DNS:Edit» sobre la zona, en la
# variable CLOUDFLARE_API_TOKEN. Se crea en:
#   Cloudflare → Mi perfil → Tokens de API → Crear token → Editar zona DNS
#
# Sin token el script hace todo lo demás y te dice exactamente qué tocar a
# mano, en vez de fallar a medias.
set -euo pipefail

DESTINO="hidromont"
DOMINIO="hidromontchile.cl"
PUERTO_SSH_REAL=""   # se detecta del propio ~/.ssh/config

rojo()  { printf '\033[31m%s\033[0m\n' "$1" >&2; }
amar()  { printf '\033[33m%s\033[0m\n' "$1"; }
verde() { printf '\033[32m%s\033[0m\n' "$1"; }
paso()  { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

cd "$(dirname "$0")/.."

# ── 0. Comprobaciones ────────────────────────────────────────────────────────

paso "Comprobando el terreno"

ssh -n -o ConnectTimeout=10 -o BatchMode=yes "$DESTINO" true || {
  rojo "No se pudo conectar por SSH a $DESTINO."
  exit 1
}

IP="$(ssh -n "$DESTINO" 'curl -s -m 10 https://api.ipify.org')"
[[ "$IP" =~ ^[0-9.]+$ ]] || { rojo "No se pudo averiguar la IP pública del VPS."; exit 1; }
verde "  VPS en $IP"

# El puerto real de SSH, para no cerrárselo con ufw. Es el accidente que deja
# a alguien fuera de su propio servidor.
PUERTO_SSH_REAL="$(ssh -G "$DESTINO" | awk '$1=="port"{print $2; exit}')"
[[ "$PUERTO_SSH_REAL" =~ ^[0-9]+$ ]] || PUERTO_SSH_REAL=22
verde "  SSH en el puerto $PUERTO_SSH_REAL"

ssh -n "$DESTINO" 'curl -fsS -o /dev/null -m 10 http://127.0.0.1:8787/' || {
  rojo "La aplicación no responde en 127.0.0.1:8787. Arréglalo antes de publicar."
  exit 1
}
verde "  la aplicación responde en local"

# ── 1. DNS ───────────────────────────────────────────────────────────────────

paso "Apuntando el DNS a $IP"

resuelve() { dig +short @1.1.1.1 "$1" A | head -1; }

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  # Se comprueba el DNS en vez de fiarse de un Enter: si ya apunta al VPS no
  # hay nada que preguntar, y si no apunta, pulsar Enter no lo arregla.
  if [[ "$(resuelve "$DOMINIO")" != "$IP" ]]; then
    amar "  Sin CLOUDFLARE_API_TOKEN: este paso hay que hacerlo a mano."
    amar ""
    amar "  En Cloudflare → $DOMINIO → DNS, deja estos dos registros así:"
    amar "     A   $DOMINIO       $IP    Proxy: DESACTIVADO (nube gris)"
    amar "     A   www.$DOMINIO   $IP    Proxy: DESACTIVADO (nube gris)"
    amar ""
    amar "  La nube TIENE que estar gris ahora: Caddy pide el certificado por"
    amar "  HTTP-01 y con el proxy puesto la validación no llega a la máquina."
    amar ""
    # Desde la terminal y no desde la entrada estándar, que puede venir de
    # una tubería o habérsela comido otro comando.
    read -r -p "  Cuando esté hecho, pulsa Enter para seguir (Ctrl+C para abortar): " _ </dev/tty
    [[ "$(resuelve "$DOMINIO")" == "$IP" ]] || {
      rojo "  $DOMINIO resuelve a $(resuelve "$DOMINIO"), no a $IP."
      rojo "  Revisa el registro A y que la nube esté gris. Con TTL bajo tarda un minuto."
      exit 1
    }
  fi
  verde "  $DOMINIO → $IP"
  if [[ "$(resuelve "www.$DOMINIO")" != "$IP" ]]; then
    amar "  www.$DOMINIO resuelve a $(resuelve "www.$DOMINIO"), no a $IP."
    amar "  El dominio principal funcionará igual; www no tendrá certificado hasta"
    amar "  que lo corrijas (nube gris, $IP). Caddy lo reintenta solo."
  else
    verde "  www.$DOMINIO → $IP"
  fi
else
  cf() {
    curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
         -H "Content-Type: application/json" "$@"
  }
  ZONA="$(cf "https://api.cloudflare.com/client/v4/zones?name=$DOMINIO" \
    | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["result"][0]["id"] if r.get("result") else "")')"
  [[ -n "$ZONA" ]] || { rojo "  No se encontró la zona $DOMINIO. ¿El token tiene permiso sobre ella?"; exit 1; }

  for NOMBRE in "$DOMINIO" "www.$DOMINIO"; do
    REG="$(cf "https://api.cloudflare.com/client/v4/zones/$ZONA/dns_records?type=A&name=$NOMBRE" \
      | python3 -c 'import sys,json; r=json.load(sys.stdin); print(r["result"][0]["id"] if r.get("result") else "")')"
    CUERPO="{\"type\":\"A\",\"name\":\"$NOMBRE\",\"content\":\"$IP\",\"ttl\":60,\"proxied\":false}"
    if [[ -n "$REG" ]]; then
      cf -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONA/dns_records/$REG" --data "$CUERPO" >/dev/null
      verde "  $NOMBRE → $IP (actualizado, sin proxy)"
    else
      cf -X POST "https://api.cloudflare.com/client/v4/zones/$ZONA/dns_records" --data "$CUERPO" >/dev/null
      verde "  $NOMBRE → $IP (creado, sin proxy)"
    fi
  done

  paso "Esperando a que el DNS propague"
  # TTL de 60 s; se comprueba contra los resolutores de Cloudflare, que son los
  # primeros en verlo. Si no propaga, Caddy fallaría al pedir el certificado.
  for i in $(seq 1 30); do
    ACTUAL="$(dig +short @1.1.1.1 "$DOMINIO" A | head -1)"
    [[ "$ACTUAL" == "$IP" ]] && { verde "  resuelve a $IP"; break; }
    printf '\r  intento %s/30 — resuelve a %s' "$i" "${ACTUAL:-nada}"
    sleep 5
  done
  echo
  [[ "$(dig +short @1.1.1.1 "$DOMINIO" A | head -1)" == "$IP" ]] || {
    rojo "  El DNS sigue sin apuntar a $IP. Caddy no podría obtener el certificado."
    exit 1
  }
fi

# ── 2. Cortafuegos ───────────────────────────────────────────────────────────

paso "Cortafuegos"
ssh -n "$DESTINO" "
  set -e
  if ! command -v ufw >/dev/null; then
    echo '  ufw no está instalado y no hay cortafuegos activo: no hay nada que abrir.'
    exit 0
  fi
  # El puerto de SSH SIEMPRE primero. Habilitar ufw sin esa regla es la forma
  # clásica de quedarse fuera del propio servidor.
  ufw allow ${PUERTO_SSH_REAL}/tcp >/dev/null
  ufw allow 80,443/tcp >/dev/null
  if ! ufw status | grep -q '^Status: active'; then
    echo '  ufw estaba inactivo; se deja como estaba y solo se registran las reglas.'
  fi
  ufw status | head -8
"

# ── 3. Caddy ─────────────────────────────────────────────────────────────────

paso "Instalando Caddy"
ssh -n "$DESTINO" '
  set -e
  if command -v caddy >/dev/null; then
    echo "  ya estaba instalado: $(caddy version)"
  else
    apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl >/dev/null
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy
    echo "  instalado: $(caddy version)"
  fi
  mkdir -p /var/log/caddy
'

paso "Instalando el Caddyfile"
scp -q deploy/Caddyfile "$DESTINO:/tmp/Caddyfile"
ssh -n "$DESTINO" '
  set -e
  install -D -m 644 /tmp/Caddyfile /etc/caddy/Caddyfile
  rm -f /tmp/Caddyfile
  caddy validate --config /etc/caddy/Caddyfile 2>&1 | tail -2
  # validate corre como root y crea el archivo de log con dueño root; el
  # servicio corre como caddy y sin esto muere al arrancar con «permission
  # denied» en /var/log/caddy. Pasó en la primera instalación.
  chown -R caddy:caddy /var/log/caddy
'

paso "Arrancando Caddy y pidiendo el certificado"
ssh -n "$DESTINO" '
  set -e
  systemctl enable caddy >/dev/null 2>&1 || true
  systemctl restart caddy
  # Let'"'"'s Encrypt tarda unos segundos; se espera a que 443 responda.
  # Con el nombre del dominio (SNI) y no con la IP pelada: Caddy solo tiene
  # certificado para hidromontchile.cl y a una petición a 127.0.0.1 no le
  # responde el handshake, así que la espera fallaría aunque todo fuera bien.
  for i in $(seq 1 60); do
    curl -fsS -o /dev/null --max-time 5 -k \
      --resolve '"$DOMINIO"':443:127.0.0.1 https://'"$DOMINIO"'/ && exit 0
    sleep 2
  done
  exit 1
' || {
  rojo "Caddy no llegó a servir en 443. Mira el log:"
  rojo "  ssh $DESTINO 'journalctl -u caddy -n 40 --no-pager'"
  exit 1
}
verde "  Caddy escuchando"

# ── 4. Verificación de verdad ────────────────────────────────────────────────

paso "Verificando desde fuera"

# Lo importante no es que responda 200, sino QUIÉN responde. Durante meses el
# dominio devolvía 200 servido por el cPanel antiguo mientras el VPS no recibía
# una sola petición: mirar solo el código de estado no lo habría detectado.
SERVIDOR="$(curl -sI -m 20 "https://$DOMINIO/" | awk 'tolower($1)=="server:"{print $2}' | tr -d '\r')"
ESTADO="$(curl -s -o /dev/null -m 20 -w '%{http_code}' "https://$DOMINIO/")"
TITULO="$(curl -s -m 20 "https://$DOMINIO/" | grep -o '<title>[^<]*</title>' | head -1)"

echo "  estado:   $ESTADO"
echo "  servidor: ${SERVIDOR:-(no declara)}"
echo "  título:   ${TITULO:-(ninguno)}"

if [[ "$SERVIDOR" == *"LiteSpeed"* ]]; then
  rojo ""
  rojo "  Sigue respondiendo LiteSpeed: el DNS todavía apunta al cPanel antiguo."
  rojo "  Revisa los registros A en Cloudflare."
  exit 1
fi

[[ "$ESTADO" == "200" ]] || { rojo "  El sitio devuelve $ESTADO."; exit 1; }
grep -q "Hidromont" <<<"$TITULO" || amar "  El título no menciona Hidromont; revísalo."

paso "Listo"
verde "  $DOMINIO servido por el VPS ($IP), con certificado propio."
echo
amar "Queda una cosa, a mano y cuando quieras:"
amar "  En Cloudflare puedes volver a activar el proxy (nube naranja) en los dos"
amar "  registros A. El certificado ya está emitido y Caddy lo renueva solo."
amar "  Hazlo solo después de comprobar que el sitio se ve bien así."
