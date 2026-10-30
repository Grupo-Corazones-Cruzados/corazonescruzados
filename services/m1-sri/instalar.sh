#!/bin/bash
# Instala o actualiza el trabajador del SRI en el M1 y (re)carga su tarea de launchd. Se corre
# desde la Mac de desarrollo. Con TOKEN_ARCHIVO=<ruta> escribe además ~/.gcc-sri/config.json con
# ese token (lo genera `nuevoTokenTrabajador` en `lib/finance-sri.ts`); sin él, conserva el que hay.
set -euo pipefail
M1="fernandogonzalez@100.73.251.124"
SSH=(ssh -i "$HOME/.ssh/gcc_m1_ed25519" -o BatchMode=yes)
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="${URL:-https://app.grupocc.org}"
"${SSH[@]}" "$M1" 'mkdir -p ~/.gcc-sri && chmod 700 ~/.gcc-sri'
scp -q -i "$HOME/.ssh/gcc_m1_ed25519" "$DIR/trabajador.mjs" "$DIR/package.json" "$DIR/org.grupocc.sri-gastos.plist" "$M1:.gcc-sri/"
if [ -n "${TOKEN_ARCHIVO:-}" ]; then
  printf '{"url":"%s","token":"%s"}\n' "$URL" "$(cat "$TOKEN_ARCHIVO")" | "${SSH[@]}" "$M1" 'umask 077; cat > ~/.gcc-sri/config.json'
fi
# Igual que en los respaldos: ~/Library/LaunchAgents del M1 puede ser de root; si no se puede
# escribir, la tarea se carga desde ~/.gcc-sri y dura hasta el próximo reinicio.
"${SSH[@]}" "$M1" 'export PATH=/opt/homebrew/bin:$PATH; cd ~/.gcc-sri && npm install --silent --no-audit --no-fund >/dev/null && echo "dependencias listas";
  P=~/.gcc-sri/org.grupocc.sri-gastos.plist;
  if [ -w ~/Library/LaunchAgents ]; then cp -f $P ~/Library/LaunchAgents/; P=~/Library/LaunchAgents/org.grupocc.sri-gastos.plist;
  else echo "⚠️ LaunchAgents no es escribible: la tarea NO sobrevivirá a un reinicio"; fi;
  launchctl bootout gui/$(id -u)/org.grupocc.sri-gastos 2>/dev/null || true; sleep 1;
  launchctl bootstrap gui/$(id -u) $P && echo "tarea cargada"'
