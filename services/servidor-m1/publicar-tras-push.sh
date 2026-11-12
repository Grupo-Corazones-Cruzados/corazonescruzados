#!/bin/bash
# PUBLICAR EN EL M1 DESPUÉS DE CADA PUSH A main (2026-11-11).
#
# Desde la mudanza, producción vive en el M1: un push a main ya no llega solo a producción, y en tres días
# el M1 se quedó 100 commits atrás. Esto devuelve el comportamiento de antes («push = despliegue»): el hook
# `pre-push` del repo lo lanza en segundo plano y no frena el push.
#
#   services/servidor-m1/publicar-tras-push.sh instalar   → pone el hook en .git/hooks/pre-push
#   (lo llama el hook; no hace falta lanzarlo a mano)
#
# Un solo vigilante a la vez (y publicar.sh tiene su propio candado, también para las publicaciones a mano). Si entran pushes mientras publica, al terminar vuelve a mirar
# origin/main y publica otra vez: el último commit siempre acaba en el M1. Registro: ~/Library/Logs/gcc-publicar.log
set -o pipefail
R=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
LOG="$HOME/Library/Logs/gcc-publicar.log"
CANDADO=/tmp/gcc-tras-push.candado   # el de la publicación en sí lo pone publicar.sh

if [ "$1" = instalar ]; then
  H="$R/.git/hooks/pre-push"
  cat > "$H" <<EOF
#!/bin/bash
# Publica en el M1 tras el push (services/servidor-m1/publicar-tras-push.sh). Solo para main.
while read -r _ _ ref _; do
  [ "\$ref" = refs/heads/main ] && { nohup "$R/services/servidor-m1/publicar-tras-push.sh" >/dev/null 2>&1 & break; }
done
exit 0
EOF
  chmod +x "$H"; echo "hook instalado en $H"; exit 0
fi

sleep 25   # que el push termine antes de leer origin/main
mkdir "$CANDADO" 2>/dev/null || { echo "$(date '+%F %T') ya hay una publicación en curso; la recogerá al terminar" >> "$LOG"; exit 0; }
trap 'rmdir "$CANDADO"' EXIT
. "$HOME/.gcc-servidor.env"
for vuelta in 1 2 3 4 5; do
  git -C "$R" fetch -q origin main
  QUIERO=$(git -C "$R" rev-parse origin/main)
  HAY=$(ssh -i "$M1_CLAVE" -o BatchMode=yes -o ConnectTimeout=20 "$M1_HOST" 'cat ~/gcc/publicado 2>/dev/null' || true)
  [ "$QUIERO" = "$HAY" ] && { echo "$(date '+%F %T') al día (${QUIERO:0:8})" >> "$LOG"; break; }
  echo "$(date '+%F %T') publicando ${QUIERO:0:8} (había ${HAY:0:8})" >> "$LOG"
  "$R/services/servidor-m1/publicar.sh" >> "$LOG" 2>&1 || { echo "$(date '+%F %T') ✖ falló; queda la versión anterior" >> "$LOG"; break; }
done
