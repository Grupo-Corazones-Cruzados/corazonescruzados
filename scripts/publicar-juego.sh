#!/usr/bin/env bash
#
# Publica los cambios del juego (Godot) a producción con UN solo comando.
#
#   npm run juego:publicar                 → mensaje de commit automático
#   npm run juego:publicar "mi mensaje"    → mensaje propio
#
# Hace, en orden y sin que tengas que recordar los pasos:
#   1. Reimporta el proyecto de Godot (por si añadiste assets).
#   2. Exporta el juego a web (public/game/), que es lo que sirve Railway.
#   3. git add + commit + push, resolviendo la sincronización con el remoto para
#      que el push no falle por estar detrás.
#
# Al terminar, Railway despliega solo (auto-deploy en push a main).
#
# NOTA: la economía (objetos recogibles, fichas) está PENDIENTE y no vive en la
# carpeta de Godot. Cuando se retome, este comando volverá a incluir el paso de
# sincronizar los objetos con la base de datos.

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

echo "▸ 1/3  Reimportando el proyecto de Godot…"
"$GODOT" --headless --path godot --import >/dev/null 2>&1 || true

echo "▸ 2/3  Exportando el juego a web…"
"$GODOT" --headless --path godot --export-release "Web" 2>&1 | grep -iE "SCRIPT ERROR|Export failed" || true
if [ ! -f public/game/index.pck ]; then
  echo "✖ El export no generó public/game/index.pck. Revisa el proyecto en Godot." >&2
  exit 1
fi

echo "▸ 3/3  Subiendo a la app…"
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
