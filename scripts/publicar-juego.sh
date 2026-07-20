#!/usr/bin/env bash
#
# Publica los cambios del juego (Godot) a producción con UN solo comando.
#
#   npm run juego:publicar                 → mensaje de commit automático
#   npm run juego:publicar "mi mensaje"    → mensaje propio
#
# Hace, en orden y sin que tengas que recordar los pasos:
#   1. Reimporta el proyecto de Godot (por si añadiste assets).
#   2. Exporta el manifiesto de objetos y lo SINCRONIZA a Postgres. Sin esto,
#      los objetos nuevos no se pueden recoger (el servidor no sabría que existen).
#   3. Exporta el juego a web (public/game/), que es lo que sirve Railway.
#   4. git add + commit + push, resolviendo la sincronización con el remoto para
#      que el push no falle por estar detrás.
#
# Al terminar, Railway despliega solo (auto-deploy en push a main).

set -euo pipefail

# Raíz del repo (este script vive en scripts/).
cd "$(dirname "$0")/.."

# --- localizar Godot ---------------------------------------------------------
GODOT="${GODOT:-}"
if [ -z "$GODOT" ]; then
  if command -v godot >/dev/null 2>&1; then
    GODOT="godot"
  elif [ -x "/Applications/Godot.app/Contents/MacOS/Godot" ]; then
    GODOT="/Applications/Godot.app/Contents/MacOS/Godot"
  else
    echo "✖ No encuentro Godot. Instálalo o exporta la variable GODOT con su ruta." >&2
    exit 1
  fi
fi

MSG="${1:-juego: actualiza mundos y export ($(date '+%Y-%m-%d %H:%M'))}"

echo "▸ 1/5  Reimportando el proyecto de Godot…"
"$GODOT" --headless --path godot --import >/dev/null 2>&1 || true

echo "▸ 2/5  Exportando el manifiesto de objetos…"
"$GODOT" --headless --path godot --script res://tools/export_manifest.gd 2>&1 |
  grep -E "✔|ERROR" || true

echo "▸ 3/5  Sincronizando objetos con la base de datos…"
node scripts/sync-item-manifest.mjs 2>&1 | grep -vE "dotenv|tip:" || true

echo "▸ 4/5  Exportando el juego a web…"
if ! "$GODOT" --headless --path godot --export-release "Web" 2>&1 | grep -iE "SCRIPT ERROR|Export failed"; then
  : # sin errores de export
fi
if [ ! -f public/game/index.pck ]; then
  echo "✖ El export no generó public/game/index.pck. Revisa el proyecto en Godot." >&2
  exit 1
fi

echo "▸ 5/5  Subiendo a la app…"
git add -A

# Nada que publicar: salir limpio en vez de crear un commit vacío.
if git diff --cached --quiet; then
  echo "✔ No hay cambios nuevos que publicar. Todo está al día."
  exit 0
fi

git commit -q -m "$MSG"

# Traer lo que haya en el remoto ANTES de empujar, para que el push no falle por
# estar detrás. --autostash por si quedó algo suelto; el commit ya limpió el árbol.
if ! git pull --rebase --autostash origin main; then
  echo "" >&2
  echo "✖ Hubo un conflicto al sincronizar con el remoto." >&2
  echo "  Tus cambios están commiteados en local (no se perdieron)." >&2
  echo "  Resuelve el conflicto y ejecuta:  git rebase --continue && git push" >&2
  exit 1
fi

git push origin main

echo ""
echo "✔ Publicado. Railway está desplegando; en unos minutos estará en producción."
echo "  Commit: $MSG"
