#!/bin/bash
# Respaldo diario de la BD de GCC (Postgres de Railway, proyecto Servidor-GCC) al SSD del M1.
#
# Corre en el MacBook Air M1 (`fernandos-macbook-air`, Tailscale) por launchd a las 03:00
# (`org.grupocc.respaldo-bd.plist`). Si el Mac duerme a esa hora, launchd lo lanza al despertar.
#
# Qué hace, en orden:
#   1. Desbloquea el SSD cifrado si hace falta (clave en ~/.gcc-respaldos/clave-ssd, en el disco
#      interno con FileVault).
#   2. `pg_dump -Fc` de producción con el usuario `gcc_respaldo` (SOLO LECTURA: pg_read_all_data y
#      default_transaction_read_only). La URL vive en ~/.gcc-respaldos/bd-url, nunca en el repo.
#   3. RESTAURA la copia en un Postgres local (solo socket, sin red) y comprueba que entraron todas
#      las tablas. Una copia que no se ha restaurado no es una copia.
#   4. Retención: 30 diarios + el del día 1 de cada mes durante 12 meses.
#   5. Deja estado.json y registro.log; si falla, aviso en pantalla del M1.
#
# Instalar / actualizar desde la Mac de desarrollo: services/m1-respaldos/instalar.sh
set -uo pipefail

CFG="$HOME/.gcc-respaldos"
VOL="/Volumes/GCC-Respaldos"
VOL_UUID="F104FA7C-519C-486F-9ED3-A968DA439E99"
BIN="$HOME/Applications/Postgres.app/Contents/Versions/16/bin"
DIARIOS="$VOL/gcc/diarios"
MENSUALES="$VOL/gcc/mensuales"
PGDATA_V="$VOL/pg16-verificacion"
SOCK="$CFG/socket"
LOG="$CFG/registro.log"
HOY=$(date +%Y-%m-%d)
INICIO=$(date +%s)

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"; }
estado() { # $1 = ok|error, $2 = detalle
  printf '{"fecha":"%s","resultado":"%s","detalle":"%s","segundos":%s}\n' \
    "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$1" "$2" "$(( $(date +%s) - INICIO ))" > "$CFG/estado.json"
}
fallo() {
  log "ERROR: $1"; estado error "$1"
  osascript -e "display notification \"$1\" with title \"Respaldo GCC FALLÓ\" sound name \"Basso\"" 2>/dev/null
  "$BIN/pg_ctl" -D "$PGDATA_V" -m fast stop >/dev/null 2>&1
  exit 1
}

# No dormir mientras dure el respaldo.
caffeinate -i -w $$ &

log "— inicio —"

# 1. SSD
if [ ! -d "$VOL" ]; then
  diskutil apfs unlockVolume "$VOL_UUID" -passphrase "$(cat "$CFG/clave-ssd")" >/dev/null 2>&1 \
    || diskutil mount "$VOL_UUID" >/dev/null 2>&1
  sleep 3
  [ -d "$VOL" ] || fallo "el SSD GCC-Respaldos no está conectado o no se pudo desbloquear"
fi
mkdir -p "$DIARIOS" "$MENSUALES" "$SOCK"

# 2. Copia (a .tmp, y solo se renombra si sale entera)
DEST="$DIARIOS/gcc-$HOY.dump"
"$BIN/pg_dump" "$(cat "$CFG/bd-url")" -Fc -Z 6 -f "$DEST.tmp" 2>>"$LOG" \
  || { rm -f "$DEST.tmp"; fallo "pg_dump falló (¿internet, Railway o la clave de gcc_respaldo?)"; }
mv -f "$DEST.tmp" "$DEST"
TAM=$(du -h "$DEST" | cut -f1)
ESPERADAS=$("$BIN/pg_restore" -l "$DEST" | grep -c "TABLE DATA")
log "copia hecha: $DEST ($TAM, $ESPERADAS tablas con datos)"

# 3. Restauración de prueba
"$BIN/pg_ctl" -D "$PGDATA_V" -o "-k $SOCK -c listen_addresses=''" -l "$CFG/postgres-verificacion.log" -w start >/dev/null \
  || fallo "no arrancó el Postgres local de verificación"
"$BIN/dropdb" -h "$SOCK" -U postgres --if-exists verificacion 2>>"$LOG"
"$BIN/createdb" -h "$SOCK" -U postgres verificacion 2>>"$LOG" || fallo "no se pudo crear la BD de verificación"
"$BIN/pg_restore" -h "$SOCK" -U postgres -d verificacion --no-owner --no-privileges --exit-on-error "$DEST" 2>>"$LOG" \
  || fallo "la copia de $HOY NO se puede restaurar (ver registro.log)"
RESTAURADAS=$("$BIN/psql" -h "$SOCK" -U postgres -d verificacion -Atc \
  "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname not in ('pg_catalog','information_schema') and not c.relispartition")
PROYECTOS=$("$BIN/psql" -h "$SOCK" -U postgres -d verificacion -Atc "select count(*) from gcc_world.projects")
"$BIN/pg_ctl" -D "$PGDATA_V" -m fast stop >/dev/null
[ "$RESTAURADAS" -ge "$ESPERADAS" ] || fallo "restauradas $RESTAURADAS tablas de $ESPERADAS"
log "restauración OK: $RESTAURADAS tablas, $PROYECTOS proyectos"

# 4. Retención
[ "$(date +%d)" = "01" ] && cp -f "$DEST" "$MENSUALES/gcc-$(date +%Y-%m).dump"
find "$DIARIOS" -name 'gcc-*.dump' -mtime +30 -delete
ls -1t "$MENSUALES"/gcc-*.dump 2>/dev/null | tail -n +13 | while read -r f; do rm -f "$f"; done

estado ok "$TAM, $RESTAURADAS tablas, $PROYECTOS proyectos"
log "— fin OK en $(( $(date +%s) - INICIO )) s —"
