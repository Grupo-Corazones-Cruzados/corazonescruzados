#!/bin/zsh
# Compila la app «Entorno» y la instala en el iPhone: movil/espacio-ios/instalar.sh [UDID]
# Con el equipo personal gratuito caduca a los 7 días: repetir esto.
set -euo pipefail
cd "$(dirname "$0")"
UDID="${1:-00008150-000450203446401C}"
xcodebuild -project Espacio.xcodeproj -scheme Espacio -configuration Release -destination "id=$UDID" -derivedDataPath build -allowProvisioningUpdates -quiet build
xcrun devicectl device install app --device "$UDID" build/Build/Products/Release-iphoneos/Entorno.app
echo "✓ Instalada"
