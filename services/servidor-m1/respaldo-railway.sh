#!/bin/bash
# RESPALDO DE LA BASE DEL M1 HACIA RAILWAY — corre en el M1 cada noche y en el traspaso.
#
# Railway es la segunda opción (Fernando, 2026-11-06/07): no hay copia continua. Cada noche se lleva una
# copia completa y, si el M1 cae, el traspaso llama a este mismo guion para una última actualización
# antes de encender Railway. La base de Railway queda idéntica a la del M1 en ese momento.
#
# ⚠️ SEGURO: no hace nada si no existe ~/gcc/es-primario. Hasta la mudanza, producción vive en Railway
# y restaurar encima la borraría. Ese archivo se crea al terminar la mudanza, no antes.
#
#   respaldo-railway.sh                       → respaldo normal (exige es-primario)
#   respaldo-railway.sh --prueba <bd local>   → restaura en una base del propio M1, para probar
set -uo pipefail
G="$HOME/gcc"; B="$HOME/Applications/Postgres.app/Contents/Versions/16/bin"
ESTADO="$G/respaldo-railway.json"; LOG="$G/logs/respaldo-railway.log"
mkdir -p "$G/logs"; exec >>"$LOG" 2>&1
fin() { printf '{"fecha":"%s","resultado":"%s","detalle":"%s","segundos":%s}\n' "$(date '+%FT%T%z')" "$1" "$2" "$(( $(date +%s)-INI ))" > "$ESTADO"; echo "$(date '+%F %T') $1 $2"; exit 0; }
INI=$(date +%s)

export PGPASSWORD; PGPASSWORD=$(cat "$G/.pgclave")
ORIGEN=(-h 127.0.0.1 -p 5433 -U gcc -d railway)
if [ "${1:-}" = "--prueba" ]; then
  DESTINO="host=127.0.0.1 port=5433 user=gcc dbname=${2:?falta la base de prueba} password=$PGPASSWORD"
else
  [ -f "$G/es-primario" ] || fin omitido "el M1 aún no es el servidor principal"
  [ -f "$G/env/railway-destino" ] || fin fallo "falta ~/gcc/env/railway-destino"
  DESTINO=$(cat "$G/env/railway-destino")   # cadena de conexión pública del Postgres de Railway
fi

D=$(mktemp /tmp/gcc-respaldo.XXXXXX)
trap 'rm -f "$D"' EXIT
# La base del M1 sigue viva mientras se copia (entran mensajes de WhatsApp): se cuenta antes y después, y la copia
# vale si cada cifra queda entre las dos. Comparar solo con el «después» daba un fallo falso (2026-11-12).
cuenta() { "$B/psql" "$@" -Atc "SELECT (SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema'))||'|'||(SELECT count(*) FROM gcc_world.users)||'|'||(SELECT count(*) FROM gcc_world.tickets)||'|'||(SELECT count(*) FROM automatizaciones.mensajes)"; }
a0=$(cuenta "${ORIGEN[@]}")
"$B/pg_dump" "${ORIGEN[@]}" -Fc -Z 6 -f "$D" || fin fallo "pg_dump del M1"
# --clean recrea todo: la base de Railway queda igual que la del M1, sin restos de la anterior.
"$B/pg_restore" -d "$DESTINO" --clean --if-exists --no-owner --no-privileges -j 2 "$D" 2>"$D.err"
# «already exists»: un índice que la app crea sola al arrancar (CREATE … IF NOT EXISTS) y que --clean no borra. Inofensivo.
errores=$(grep -i "error" "$D.err" 2>/dev/null | grep -vc "already exists" || true); tail -5 "$D.err"; rm -f "$D.err"

# Comprobación: cada cifra del destino entre la del M1 antes de copiar y la de después.
a1=$(cuenta "${ORIGEN[@]}"); b=$(cuenta "$DESTINO")
[ -n "$a0" ] && [ -n "$a1" ] && [ -n "$b" ] || fin fallo "no se pudo contar"
IFS='|' read -r -a A0 <<<"$a0"; IFS='|' read -r -a A1 <<<"$a1"; IFS='|' read -r -a BB <<<"$b"
for i in 0 1 2 3; do
  lo=${A0[$i]}; hi=${A1[$i]}; [ "$lo" -gt "$hi" ] && { t=$lo; lo=$hi; hi=$t; }
  [ "${BB[$i]}" -ge "$lo" ] && [ "${BB[$i]}" -le "$hi" ] || fin fallo "no coincide: M1 $a0 → $a1 · destino $b · errores $errores"
done
[ "$errores" = 0 ] || fin fallo "pg_restore con $errores errores · destino $b"
fin ok "tablas|usuarios|tickets|mensajes = $b (M1 $a0 → $a1) · $(du -h "$D" | cut -f1)"
