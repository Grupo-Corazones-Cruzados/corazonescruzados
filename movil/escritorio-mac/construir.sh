#!/bin/zsh
# Compila GCC World y GCC Miembros para la Mac y las deja en /Applications.
#   movil/escritorio-mac/construir.sh            (las dos)
# Firma local (ad hoc): sirven en ESTA Mac. Para repartirlas hace falta Developer ID y notarizar.
set -e
cd "$(dirname "$0")"
RAIZ="$(cd ../.. && pwd)"
SALIDA="$PWD/build"; rm -rf "$SALIDA"; mkdir -p "$SALIDA"
VERSION=1.0
xcrun swiftc -O -target arm64-apple-macos13 -framework Cocoa -framework WebKit App.swift -o "$SALIDA/GCCEscritorio"

construir() {  # $1 nombre visible, $2 gcc_app, $3 id, $4 color del icono
  local APP="$SALIDA/$1.app"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cp "$SALIDA/GCCEscritorio" "$APP/Contents/MacOS/GCCEscritorio"
  cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>$1</string>
  <key>CFBundleDisplayName</key><string>$1</string>
  <key>CFBundleIdentifier</key><string>$3</string>
  <key>CFBundleExecutable</key><string>GCCEscritorio</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSMicrophoneUsageDescription</key><string>Para Gumdramon y para dictar en el Espacio de trabajo.</string>
  <key>GCCApp</key><string>$2</string>
  <key>GCCNombre</key><string>$1</string>
</dict></plist>
PLIST
  # Icono: el mismo trazo de `movil/generar-iconos.py`, sobre el color de la app.
  local SET="$SALIDA/AppIcon.iconset"; rm -rf "$SET"; mkdir -p "$SET"
  python3 icono.py "$RAIZ" "$4" "$SALIDA/icono-1024.png"
  for t in 16 32 128 256 512; do
    sips -z $t $t "$SALIDA/icono-1024.png" --out "$SET/icon_${t}x${t}.png" >/dev/null
    sips -z $((t*2)) $((t*2)) "$SALIDA/icono-1024.png" --out "$SET/icon_${t}x${t}@2x.png" >/dev/null
  done
  iconutil -c icns "$SET" -o "$APP/Contents/Resources/AppIcon.icns"
  codesign --force --sign - "$APP"
  rm -rf "/Applications/$1.app"; cp -R "$APP" "/Applications/$1.app"
  echo "Instalada /Applications/$1.app"
}

construir "GCC World" progreso org.grupocc.world.mac "#4B2D8E"
construir "GCC Miembros" centralizado org.grupocc.miembros.mac "#DC2626"
