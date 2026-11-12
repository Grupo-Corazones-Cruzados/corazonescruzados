#!/bin/zsh
# LAS DOS APPS DE iPHONE DESDE UN SOLO PROYECTO (2026-11-12, cuenta de Apple de Fernando, equipo K7PVYYMP32).
#
#   ./compilar.sh world <versión> <build>          → archiva GCC World y la sube a App Store Connect (TestFlight)
#   ./compilar.sh miembros <UDID>                  → compila GCC Miembros y la instala por USB en ese iPhone
#
# · GCC World (org.grupocc.gccworld) es la ÚNICA que va a la tienda. No lleva Control Psicosocial: ni su código
#   (`#if MIEMBROS`) ni ubicación/voz/segundo plano en el Info.plist (`#ifdef MIEMBROS`, INFOPLIST_PREPROCESS).
#   El contrato de Apple (3.3.3(F)(i)) prohíbe apps con ubicación pensadas para emergencias.
# · GCC Miembros (org.grupocc.miembros) se instala en persona en los teléfonos registrados (Ad Hoc / desarrollo),
#   nunca en la tienda.
# · Firma automática con la clave de App Store Connect de ~/.appstoreconnect (fuera del repositorio).
# · Antes de compilar, los archivos ignorados de Capacitor (capacitor.config.json, config.xml, public) deben estar
#   en App/App; no se corre `npx cap sync ios` sin revisar (sube Package.swift a .v18 y rompe la compilación).
set -euo pipefail
cd "$(dirname "$0")/App"

CONF="$HOME/.appstoreconnect/config.json"
KEY_ID=$(python3 -c "import json;print(json.load(open('$CONF'))['keyId'])")
ISSUER=$(python3 -c "import json;print(json.load(open('$CONF'))['issuerId'])")
KEY_PATH=$(python3 -c "import json;print(json.load(open('$CONF'))['keyPath'])")
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY_PATH" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER")
SALIDA="${TMPDIR:-/tmp}/gcc-ios"
mkdir -p "$SALIDA"

case "${1:-}" in
  world)
    VERSION="${2:?versión, p. ej. 2.0}"; BUILD="${3:?número de build, p. ej. 1}"
    ARCHIVO="$SALIDA/GCCWorld-$VERSION-$BUILD.xcarchive"
    xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination "generic/platform=iOS" \
      -archivePath "$ARCHIVO" "${AUTH[@]}" \
      GCC_APP=progreso GCC_BUNDLE_ID=org.grupocc.gccworld MARKETING_VERSION="$VERSION" CURRENT_PROJECT_VERSION="$BUILD" \
      archive
    cat > "$SALIDA/export.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>K7PVYYMP32</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
EOF
    xcodebuild -exportArchive -archivePath "$ARCHIVO" -exportOptionsPlist "$SALIDA/export.plist" \
      -exportPath "$SALIDA/export-$VERSION-$BUILD" "${AUTH[@]}"
    echo "✔ GCC World $VERSION ($BUILD) subida a App Store Connect"
    ;;
  miembros)
    UDID="${2:?UDID del iPhone (xcrun devicectl list devices)}"
    xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination "id=$UDID" \
      -derivedDataPath "$SALIDA/dd-miembros" "${AUTH[@]}" \
      GCC_APP=centralizado GCC_BUNDLE_ID=org.grupocc.miembros \
      SWIFT_ACTIVE_COMPILATION_CONDITIONS=MIEMBROS INFOPLIST_PREPROCESSOR_DEFINITIONS=MIEMBROS \
      GCC_DISPLAY_NAME="GCC Miembros" build
    APP="$SALIDA/dd-miembros/Build/Products/Release-iphoneos/App.app"
    /usr/libexec/PlistBuddy -c "Print :CFBundleDisplayName" "$APP/Info.plist"
    xcrun devicectl device install app --device "$UDID" "$APP"
    echo "✔ GCC Miembros instalada en $UDID"
    ;;
  *)
    echo "Uso: $0 world <versión> <build> | miembros <UDID>"; exit 1;;
esac
