#!/bin/bash
# Copia el respaldo al M1 y (re)carga su tarea de launchd. Se corre desde la Mac de desarrollo.
# Los secretos (clave-ssd, bd-url) ya viven en el M1 y este script no los toca.
set -euo pipefail
M1="fernandogonzalez@100.73.251.124"
SSH=(ssh -i "$HOME/.ssh/gcc_m1_ed25519" -o BatchMode=yes)
DIR="$(cd "$(dirname "$0")" && pwd)"
"${SSH[@]}" "$M1" 'mkdir -p ~/.gcc-respaldos'
scp -q -i "$HOME/.ssh/gcc_m1_ed25519" "$DIR/respaldar.sh" "$DIR/org.grupocc.respaldo-bd.plist" "$M1:.gcc-respaldos/"
# ~/Library/LaunchAgents del M1 es de root (lo dejó un instalador de OneDrive). Si ya es del
# usuario (`sudo chown fernandogonzalez ~/Library/LaunchAgents`, una vez), la tarea va ahí y
# sobrevive a un reinicio; si no, se carga desde ~/.gcc-respaldos y dura hasta el próximo reinicio.
"${SSH[@]}" "$M1" 'chmod 700 ~/.gcc-respaldos/respaldar.sh;
  # Mini-app que envuelve el script: es la que recibe «Acceso total al disco» en Ajustes.
  [ -d "$HOME/Applications/GCC Respaldo.app" ] || osacompile -o "$HOME/Applications/GCC Respaldo.app" -e "do shell script \"/bin/bash $HOME/.gcc-respaldos/respaldar.sh\"";
  P=~/.gcc-respaldos/org.grupocc.respaldo-bd.plist;
  if [ -w ~/Library/LaunchAgents ]; then cp -f $P ~/Library/LaunchAgents/; P=~/Library/LaunchAgents/org.grupocc.respaldo-bd.plist;
  else echo "⚠️ LaunchAgents no es escribible: la tarea NO sobrevivirá a un reinicio"; fi;
  launchctl bootout gui/$(id -u) $P 2>/dev/null; launchctl bootstrap gui/$(id -u) $P && echo "tarea cargada"'
