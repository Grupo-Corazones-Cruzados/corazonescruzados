#!/bin/bash
# Renderiza una escena real a public/animaciones/<id>.mp4 (+ .jpg de póster): bucle de 8 s, 1280×720, 24 fps.
#   scripts/animaciones/real/renderizar.sh libro-realidad-real
set -euo pipefail
cd "$(dirname "$0")/../../.."
ID="$1"
TMP=$(mktemp -d)
blender -b --factory-startup -P "scripts/animaciones/real/$ID.py" -- --salida "$TMP" --ancho 1280 --alto 720 --muestras 48 > "$TMP/log.txt" 2>&1 || { grep -iE "error|traceback|line [0-9]+," "$TMP/log.txt" | tail -12; exit 1; }
ffmpeg -y -v error -framerate 24 -i "$TMP/f_%04d.png" -c:v libx264 -pix_fmt yuv420p -crf 22 -preset slow -movflags +faststart "public/animaciones/$ID.mp4"
ffmpeg -y -v error -i "$TMP/f_0049.png" -q:v 3 "public/animaciones/$ID.jpg"
rm -rf "$TMP"
echo "$ID $(du -h public/animaciones/$ID.mp4 | cut -f1)"
