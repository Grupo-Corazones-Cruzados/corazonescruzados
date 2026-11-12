#!/bin/bash
# MUDANZA DE RAILWAY AL M1 (y vuelta, si hace falta) — se ejecuta en la Mac de desarrollo, paso a paso.
#
#   mudanza.sh estado              → zona, DNS de app/www, Worker y túnel
#   mudanza.sh preparar            → SSL estricto, HTTPS siempre, TLS 1.2, app/www con proxy (aún a Railway)
#                                     y el Worker gcc-entrada delante. Reversible; no cambia el destino.
#   mudanza.sh mantenimiento on|off → pantalla de mantenimiento para todos (503 + Retry-After: Meta reintenta)
#   mudanza.sh copiar              → base de producción (Railway, solo lectura) → M1, sin limpiar: es la real
#   mudanza.sh activar-m1          → el M1 pasa a entornos reales y enciende cotizador y cron
#   mudanza.sh dns m1|railway      → app y www al túnel del M1 o de vuelta a Railway
#   mudanza.sh railway-reserva     → para el cron y el worker de Railway (tras el cambio)
#
# Orden de la noche del cambio: estado → preparar → mantenimiento on → copiar → activar-m1 → dns m1
# → (comprobar) → mantenimiento off → railway-reserva. Volver atrás: mantenimiento on → dns railway →
# mantenimiento off (y volver a desplegar en Railway el cron y el worker).
#
# Necesita: ~/.cloudflare-token (DNS, Zone Settings, WAF, Tunnel, Workers), ~/.gcc-tunel-id, ~/.gcc-servidor.env.
set -eo pipefail
CF=$(cat ~/.cloudflare-token); A=5af7aad35e29fd8cdb67c13dfd22273e; Z=2544db4bac21f12dc8f3904e20519a10
TID=$(cat ~/.gcc-tunel-id); . ~/.gcc-servidor.env
RAILWAY_APP=cndr3q54.up.railway.app; RAILWAY_WWW=o8b57xou.up.railway.app
api() { curl -s -X "$1" "https://api.cloudflare.com/client/v4$2" -H "Authorization: Bearer $CF" -H 'Content-Type: application/json' ${3:+-d "$3"}; }
ok() { python3 -c "import json,sys; d=json.load(sys.stdin); print('  ✔' if d.get('success') else '  ✖ '+str(d.get('errors')))"; }
m1() { ssh -i "$M1_CLAVE" -o BatchMode=yes -o ServerAliveInterval=30 "$M1_HOST" "$@"; }
registro() { api GET "/zones/$Z/dns_records?type=CNAME&name=$1" | python3 -c "import json,sys; print(json.load(sys.stdin)['result'][0]['id'])"; }
cname() { api PATCH "/zones/$Z/dns_records/$(registro "$1")" "{\"content\":\"$2\",\"proxied\":$3,\"ttl\":1}" | ok; }

case "$1" in
estado)
  api GET "/zones/$Z" | python3 -c "import json,sys; z=json.load(sys.stdin)['result']; print('zona:', z['status'])"
  for h in app www; do api GET "/zones/$Z/dns_records?name=$h.grupocc.org" | python3 -c "import json,sys; r=json.load(sys.stdin)['result'][0]; print(f\"{r['name']}: {r['content']} proxy={r['proxied']}\")"; done
  api GET "/zones/$Z/workers/routes" | python3 -c "import json,sys; print('rutas del Worker:', [r['pattern'] for r in json.load(sys.stdin)['result']])"
  api GET "/accounts/$A/workers/scripts/gcc-entrada/settings" | python3 -c "import json,sys; print('Worker:', {b['name']:b.get('text') for b in json.load(sys.stdin)['result']['bindings']})"
  api GET "/accounts/$A/cfd_tunnel/$TID" | python3 -c "import json,sys; t=json.load(sys.stdin)['result']; print('túnel:', t['status'], len(t.get('connections') or []), 'conexiones')" ;;
preparar)
  echo "▶ SSL estricto, HTTPS siempre, TLS mínimo 1.2"
  api PATCH "/zones/$Z/settings/ssl" '{"value":"strict"}' | ok
  api PATCH "/zones/$Z/settings/always_use_https" '{"value":"on"}' | ok
  api PATCH "/zones/$Z/settings/min_tls_version" '{"value":"1.2"}' | ok
  echo "▶ app y www con proxy (siguen yendo a Railway)"
  cname app.grupocc.org $RAILWAY_APP true; cname www.grupocc.org $RAILWAY_WWW true
  echo "▶ el Worker gcc-entrada delante de app y www"
  for h in app www; do api POST "/zones/$Z/workers/routes" "{\"pattern\":\"$h.grupocc.org/*\",\"script\":\"gcc-entrada\"}" | ok; done ;;
mantenimiento)
  v=$([ "$2" = on ] && echo 1 || echo 0)
  echo "▶ MANTENIMIENTO=$v"
  api PATCH "/accounts/$A/workers/scripts/gcc-entrada/settings" "{\"bindings\":[{\"type\":\"plain_text\",\"name\":\"MANTENIMIENTO\",\"text\":\"$v\"},{\"type\":\"plain_text\",\"name\":\"DESTINO\",\"text\":\"m1\"}]}" | ok ;;
copiar)
  echo "▶ producción → M1 (base real, sin limpiar)"
  m1 'bash -s' <<'REMOTO'
set -eo pipefail
B=~/Applications/Postgres.app/Contents/Versions/16/bin
set -a; . ~/gcc/env/app; set +a; LBASE="${DATABASE_URL%%\?*}"; LBASE="${LBASE%/railway}"
case "$LBASE" in *127.0.0.1:5433*) ;; *) echo "✖ base local inesperada"; exit 1;; esac
export PGPASSFILE=~/.gcc-respaldos/pgpass; F=/tmp/gcc-mudanza.dump; ini=$(date +%s)
$B/pg_dump "$(cat ~/.gcc-respaldos/bd-url)" -Fc -Z 6 -f $F
$B/psql "$LBASE/postgres" -qc "drop database if exists railway_nueva" -qc "create database railway_nueva"
$B/pg_restore --no-owner --no-privileges -d "$LBASE/railway_nueva" $F 2>/tmp/gcc-mudanza.err || true
grep -c error /tmp/gcc-mudanza.err | sed 's/^/  errores de pg_restore: /' || true
$B/psql "$LBASE/postgres" -v ON_ERROR_STOP=1 -q <<'SQL'
ALTER DATABASE railway WITH ALLOW_CONNECTIONS false;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'railway' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS railway_copia;
ALTER DATABASE railway RENAME TO railway_copia;
ALTER DATABASE railway_copia WITH ALLOW_CONNECTIONS true;
ALTER DATABASE railway_nueva RENAME TO railway;
SQL
echo "  $(du -h $F | cut -f1), $(( $(date +%s)-ini )) s; usuarios: $($B/psql "$LBASE/railway" -Atc 'select count(*) from gcc_world.users')"
rm -f $F
REMOTO
  ;;
activar-m1)
  echo "▶ entornos reales y servicios nuevos en el M1"
  m1 'bash -s' <<'REMOTO'
set -e; cd ~/gcc; U=$(id -u)
[ -d env-copia ] || { mv env env-copia; mv env-real env; }
for s in cotizador cron; do launchctl bootstrap gui/$U ~/Library/LaunchAgents/org.grupocc.espejo.$s.plist 2>/dev/null || true; done
for s in app reservas pedidos catering planificaciones automatizaciones worker cotizador; do launchctl kickstart -k gui/$U/org.grupocc.espejo.$s; done
sleep 20
printf "  app %s · reservas %s · automatizaciones %s · cotizador %s\n" \
  $(curl -s -o /dev/null -m 15 -w %{http_code} -H 'Host: app.grupocc.org' http://127.0.0.1:3100/) \
  $(curl -s -o /dev/null -m 15 -w %{http_code} http://127.0.0.1:3100/p/reservas/grupo/acceso) \
  $(curl -s -o /dev/null -m 15 -w %{http_code} http://127.0.0.1:3100/p/automatizaciones/grupo/acceso) \
  $(curl -s -o /dev/null -m 15 -w %{http_code} http://127.0.0.1:3106/health)
touch ~/gcc/es-primario
# El respaldo nocturno al SSD pasa a copiar la base del M1 (antes leía la de Railway con gcc_respaldo).
R=~/.gcc-respaldos; [ -f $R/bd-url.railway ] || cp $R/bd-url $R/bd-url.railway
set -a; . ~/gcc/env/app; set +a; U2="${DATABASE_URL%%\?*}"; CRED="${U2#postgresql://}"; CRED="${CRED%%@*}"
echo "postgresql://${CRED%%:*}@127.0.0.1:5433/railway" > $R/bd-url
grep -q '^127.0.0.1:5433:railway:' $R/pgpass || echo "127.0.0.1:5433:railway:${CRED%%:*}:${CRED#*:}" >> $R/pgpass
chmod 600 $R/pgpass; echo "  respaldo nocturno → base del M1"
REMOTO
  ;;
railway-reserva)
  # Tras el cambio: Railway queda de reserva. El cron y el worker de allí se paran (si no, el cron de Railway
  # llamaría a app.grupocc.org —ya el M1— y cada tarea correría dos veces). La app y los productos duermen solos
  # sin tráfico; la base de Railway sigue viva: recibe el respaldo nocturno del M1 (respaldo-railway.sh).
  T=$(python3 -c "import json,os;print(json.load(open(os.path.expanduser('~/.railway/config.json')))['user']['token'])")
  for S in 90aaf5dc-5530-4a95-a8a8-c1d8a51cff3f 6e95860f-84b3-4869-90a8-40c1ab04fb4c; do
    D=$(curl -s https://backboard.railway.com/graphql/v2 -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d "{\"query\":\"{ deployments(first:3, input:{serviceId:\\\"$S\\\", status:{in:[SUCCESS,SLEEPING]}}) { edges { node { id status } } } }\"}" | python3 -c "import json,sys; print(next((e['node']['id'] for e in json.load(sys.stdin)['data']['deployments']['edges'] if e['node']['status'] in ('SUCCESS','SLEEPING')),''))")
    [ -n "$D" ] && curl -s https://backboard.railway.com/graphql/v2 -H "Authorization: Bearer $T" -H 'Content-Type: application/json' -d "{\"query\":\"mutation { deploymentRemove(id:\\\"$D\\\") }\"}" | python3 -c "import json,sys; print('  parado' if json.load(sys.stdin).get('data') else '  ✖ no se pudo parar')"
  done ;;
dns)
  if [ "$2" = m1 ]; then
    echo "▶ app y www → túnel del M1"; cname app.grupocc.org "$TID.cfargotunnel.com" true; cname www.grupocc.org "$TID.cfargotunnel.com" true
  else
    echo "▶ app y www → Railway"; cname app.grupocc.org $RAILWAY_APP true; cname www.grupocc.org $RAILWAY_WWW true
    m1 'rm -f ~/gcc/es-primario'
  fi ;;
*) sed -n 2,20p "$0"; exit 1 ;;
esac
