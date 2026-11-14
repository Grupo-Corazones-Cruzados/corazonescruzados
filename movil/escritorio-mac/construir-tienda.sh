#!/bin/zsh
# GCC WORLD PARA LA MAC APP STORE (2026-11-14). La misma ventana de `App.swift` que `construir.sh`, pero:
#  · compilada con `-D TIENDA` (sin inspector ni depuración) y universal (Apple silicon + Intel);
#  · con el identificador de la app de iPhone (`org.grupocc.gccworld`): una sola compra para iPhone, iPad y Mac;
#  · en sandbox (`tienda.entitlements`), con el perfil de la Mac App Store y firmada con Apple Distribution;
#  · empaquetada en .pkg con el certificado de instalador y subida a App Store Connect.
# Solo GCC World: GCC Miembros nunca va a la tienda.
#   ./construir-tienda.sh <versión> <build>        p. ej. ./construir-tienda.sh 2.0 1
set -euo pipefail
cd "$(dirname "$0")"
VERSION="${1:?versión, p. ej. 2.0}"; BUILD="${2:?número de build, p. ej. 1}"
RAIZ="$(cd ../.. && pwd)"
SALIDA="${TMPDIR:-/tmp}/gcc-mac-tienda"; rm -rf "$SALIDA"; mkdir -p "$SALIDA"
PERFIL="$HOME/.appstoreconnect/perfiles/gccworld-mac.provisionprofile"
FIRMA_APP="F7F141F2F05623FAFE54B0AA94DC9804B2F281CD"   # Apple Distribution (K7PVYYMP32); por huella: el nombre lleva «á» y codesign no lo encuentra
FIRMA_PKG="7F3831D8642375F42B53831C382F0B291AFF5D92"   # 3rd Party Mac Developer Installer (K7PVYYMP32)

for arq in arm64 x86_64; do
  xcrun swiftc -O -D TIENDA -target $arq-apple-macos13 -framework Cocoa -framework WebKit App.swift -o "$SALIDA/GCCWorld-$arq"
done
APP="$SALIDA/GCC World.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
lipo -create "$SALIDA/GCCWorld-arm64" "$SALIDA/GCCWorld-x86_64" -output "$APP/Contents/MacOS/GCC World"
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>GCC World</string>
  <key>CFBundleDisplayName</key><string>GCC World</string>
  <key>CFBundleIdentifier</key><string>org.grupocc.gccworld</string>
  <key>CFBundleExecutable</key><string>GCC World</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$BUILD</string>
  <key>CFBundleSupportedPlatforms</key><array><string>MacOSX</string></array>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.productivity</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSHumanReadableCopyright</key><string>© 2026 Grupo Corazones Cruzados</string>
  <key>NSMicrophoneUsageDescription</key><string>Para dictar con tu voz y grabar audio cuando tú lo pides.</string>
  <key>ITSAppUsesNonExemptEncryption</key><false/>
  <key>GCCApp</key><string>progreso</string>
  <key>GCCNombre</key><string>GCC World</string>
</dict></plist>
PLIST
SET="$SALIDA/AppIcon.iconset"; mkdir -p "$SET"
python3 icono.py "$RAIZ" "#4B2D8E" "$SALIDA/icono-1024.png"
for t in 16 32 128 256 512; do
  sips -z $t $t "$SALIDA/icono-1024.png" --out "$SET/icon_${t}x${t}.png" >/dev/null
  sips -z $((t*2)) $((t*2)) "$SALIDA/icono-1024.png" --out "$SET/icon_${t}x${t}@2x.png" >/dev/null
done
iconutil -c icns "$SET" -o "$APP/Contents/Resources/AppIcon.icns"
cp "$PERFIL" "$APP/Contents/embedded.provisionprofile"
codesign --force --timestamp --options runtime --sign "$FIRMA_APP" --entitlements tienda.entitlements "$APP"
codesign --verify --strict --verbose=2 "$APP"
PKG="$SALIDA/GCCWorld-mac-$VERSION-$BUILD.pkg"
productbuild --component "$APP" /Applications --sign "$FIRMA_PKG" "$PKG"
echo "✔ $PKG"
if [ "${SUBIR:-1}" = 1 ]; then
  CONF="$HOME/.appstoreconnect/config.json"
  KEY_ID=$(python3 -c "import json;print(json.load(open('$CONF'))['keyId'])")
  ISSUER=$(python3 -c "import json;print(json.load(open('$CONF'))['issuerId'])")
  xcrun altool --upload-app -f "$PKG" -t macos --apiKey "$KEY_ID" --apiIssuer "$ISSUER"
fi
