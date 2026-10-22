#!/bin/bash
# Baja lo que NO va en el repo (pesa ~90 MB): Python para iOS y los paquetes de Python de la app.
# Versiones fijas; yt-dlp se actualiza solo en el teléfono, esta es solo la de fábrica.
# Uso: cd movil/descargador-ios && ./preparar.sh
set -euo pipefail
cd "$(dirname "$0")"

PYTHON_IOS="3.14-b12"   # beeware/Python-Apple-support
YTDLP="2026.10.21"
EJS_WHL="https://files.pythonhosted.org/packages/e3/bd/520769863744b669440a924271a6159ddd82ad5ae26b4ac4d4b69e9f8d44/yt_dlp_ejs-0.8.0-py3-none-any.whl"
CERTIFI_WHL="https://files.pythonhosted.org/packages/c4/51/29046e48f693c54e5b7412216d447a1d8362c9653148d98c02cdf65fa733/certifi-2026.10.19-py3-none-any.whl"

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

if [ ! -d Python.xcframework ]; then
  echo "Python para iOS ${PYTHON_IOS}…"
  curl -fsSL "https://github.com/beeware/Python-Apple-support/releases/download/$PYTHON_IOS/Python-${PYTHON_IOS%%-*}-iOS-support.${PYTHON_IOS#*-}.tar.gz" | tar xz -C "$tmp"
  mv "$tmp/Python.xcframework" .
fi

echo "Paquetes de Python (yt-dlp ${YTDLP}, yt-dlp-ejs, certifi)…"
rm -rf app_packages && mkdir app_packages
curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP/yt-dlp.tar.gz" | tar xz -C "$tmp"
cp -R "$tmp/yt-dlp/yt_dlp" app_packages/
for whl in "$EJS_WHL" "$CERTIFI_WHL"; do curl -fsSL "$whl" -o "$tmp/p.whl"; unzip -qo "$tmp/p.whl" -d app_packages; done
rm -rf app_packages/*.dist-info

# Sin .pyc la app compilaría yt-dlp en cada arranque (no puede escribirlos: el paquete va firmado).
# «unchecked-hash»: no comparan la fecha del .py, que cambia al copiarse al teléfono.
PY=$(command -v python3.14 || true)
if [ -n "$PY" ]; then
  "$PY" -m compileall -q --invalidation-mode unchecked-hash app_packages
else
  echo "Aviso: sin python3.14 no se precompila; la app arrancará más lenta."
fi
echo "Listo."
