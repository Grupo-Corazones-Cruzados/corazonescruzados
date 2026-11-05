#!/bin/zsh
# Instala o actualiza Gumdramon (el Copiloto de reuniones) en esta Mac. Se puede repetir.
#
#   services/copiloto/instalar.sh
#
# El núcleo corre desde una copia en ~/.gcc-copiloto/app: launchd no puede leer ~/Documents con
# enlaces, y así una sesión que deje el código a medias no tumba la herramienta en plena reunión.
set -euo pipefail

ORIGEN="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$ORIGEN/../.." && pwd)"
DATOS="$HOME/.gcc-copiloto"
APP="$DATOS/app"
AGENTES="$HOME/Library/LaunchAgents"
ETIQUETA="org.grupocc.copiloto"
PLIST="$AGENTES/$ETIQUETA.plist"
NODO="$(command -v node)"
UID_ACTUAL="$(id -u)"

command -v whisper-server >/dev/null || { echo "Falta whisper-server: brew install whisper-cpp"; exit 1; }
[[ -f "$HOME/.cache/whisper-cpp/ggml-medium.bin" ]] || { echo "Falta el modelo ggml-medium.bin en ~/.cache/whisper-cpp"; exit 1; }

mkdir -p "$DATOS" "$APP" "$AGENTES"
chmod 700 "$DATOS"

echo "→ Copiando el núcleo"
rsync -a --delete --exclude node_modules --exclude '*.test.mjs' "$ORIGEN/nucleo" "$ORIGEN/package.json" "$ORIGEN/package-lock.json" "$APP/"
grep '^DATABASE_URL=' "$REPO/.env" > "$DATOS/.env"
chmod 600 "$DATOS/.env"
(cd "$APP" && npm ci --no-audit --no-fund --silent)

echo "→ Compilando el widget"
(cd "$ORIGEN/mac" && swift build -c release 2>&1 | tail -1)
BINARIO="$(cd "$ORIGEN/mac" && swift build -c release --show-bin-path)/Copiloto"
PAQUETE="$DATOS/Gumdramon.app"
rm -rf "$PAQUETE"
mkdir -p "$PAQUETE/Contents/MacOS" "$PAQUETE/Contents/Resources"
cp "$BINARIO" "$PAQUETE/Contents/MacOS/Gumdramon"
cp "$ORIGEN/mac/Info.plist" "$PAQUETE/Contents/Info.plist"

# La imagen del personaje no va en el repositorio, que es público: tiene dueños y es solo para uso interno.
IMAGEN="$DATOS/recursos/gumdramon.png"
if [[ -f "$IMAGEN" ]]; then
  echo "→ Generando el icono"
  cp "$IMAGEN" "$PAQUETE/Contents/Resources/gumdramon.png"
  TEMP="$(mktemp -d)"
  python3 "$ORIGEN/mac/icono/generar.py" "$IMAGEN" "$TEMP/1024.png"
  mkdir "$TEMP/AppIcon.iconset"
  for t in 16 32 128 256 512; do
    sips -z $t $t "$TEMP/1024.png" --out "$TEMP/AppIcon.iconset/icon_${t}x${t}.png" >/dev/null
    sips -z $((t * 2)) $((t * 2)) "$TEMP/1024.png" --out "$TEMP/AppIcon.iconset/icon_${t}x${t}@2x.png" >/dev/null
  done
  iconutil -c icns "$TEMP/AppIcon.iconset" -o "$PAQUETE/Contents/Resources/AppIcon.icns"
  rm -rf "$TEMP"
else
  echo "⚠️ Sin $IMAGEN: la app se instala sin icono. Ver README."
fi

# Firmar con una identidad fija: si cambia, macOS olvida los permisos de micrófono y audio. La de
# Fernando, no la de Motordesa, que es de un cliente.
# Por su huella: el nombre lleva una «á» que `security` escribe en otra codificación.
IDENTIDAD="$(security find-identity -v -p codesigning | awk '/Apple Development: lfgonzalezm0/ {print $2; exit}')"
if [[ -n "$IDENTIDAD" ]]; then
  codesign --force --sign "$IDENTIDAD" --options runtime --entitlements "$ORIGEN/mac/Copiloto.entitlements" "$PAQUETE"
else
  echo "⚠️ Sin identidad de Apple: firma local. macOS volverá a pedir los permisos al actualizar."
  codesign --force --sign - --entitlements "$ORIGEN/mac/Copiloto.entitlements" "$PAQUETE"
fi

pkill -x Copiloto 2>/dev/null || true
pkill -x Gumdramon 2>/dev/null || true
rm -rf /Applications/Copiloto.app /Applications/Gumdramon.app
cp -R "$PAQUETE" /Applications/Gumdramon.app
rm -rf "$PAQUETE"
touch /Applications/Gumdramon.app # para que Finder vea el icono nuevo

RUTA="$(dirname "$NODO"):$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
cat > "$PLIST.nuevo" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$ETIQUETA</string>
  <key>ProgramArguments</key><array><string>$NODO</string><string>$APP/nucleo/servicio.mjs</string></array>
  <key>WorkingDirectory</key><string>$APP</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$RUTA</string><key>HOME</key><string>$HOME</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DATOS/servicio.log</string>
  <key>StandardErrorPath</key><string>$DATOS/servicio.log</string>
</dict></plist>
PLIST
chmod 600 "$PLIST.nuevo"

if launchctl print "gui/$UID_ACTUAL/$ETIQUETA" >/dev/null 2>&1 && cmp -s "$PLIST.nuevo" "$PLIST"; then
  rm -f "$PLIST.nuevo"
  launchctl kickstart -k "gui/$UID_ACTUAL/$ETIQUETA"
else
  launchctl bootout "gui/$UID_ACTUAL/$ETIQUETA" 2>/dev/null || true
  mv "$PLIST.nuevo" "$PLIST"
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    launchctl bootstrap "gui/$UID_ACTUAL" "$PLIST" 2>/dev/null && break
  done
fi

echo "✓ Listo. Abre Gumdramon desde Aplicaciones."
