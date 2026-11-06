#!/bin/zsh
# Compila Gumdramon para iPhone y lo instala por cable o Wi-Fi: services/copiloto/ios/instalar.sh [UDID]
# La imagen del personaje no va en el repositorio, que es público: sale de ~/.gcc-copiloto/recursos.
# Con el equipo personal gratuito, la app caduca a los 7 días y hay que repetir esto.
set -euo pipefail
cd "$(dirname "$0")"
UDID="${1:-00008150-000450203446401C}"
IMG="$HOME/.gcc-copiloto/recursos/gumdramon.png"
A=Gumdramon/Assets.xcassets
rm -rf "$A"; mkdir -p "$A/AppIcon.appiconset" "$A/Personaje.imageset"
print '{"info":{"version":1,"author":"gcc"}}' > "$A/Contents.json"
print '{"images":[{"idiom":"universal","platform":"ios","size":"1024x1024","filename":"icono.png"}],"info":{"version":1,"author":"gcc"}}' > "$A/AppIcon.appiconset/Contents.json"
print '{"images":[{"idiom":"universal","filename":"gumdramon.png"}],"info":{"version":1,"author":"gcc"}}' > "$A/Personaje.imageset/Contents.json"
cp "$IMG" "$A/Personaje.imageset/gumdramon.png"
# El icono de iOS no admite transparencia ni esquinas propias: las pone el sistema.
python3 - "$IMG" "$A/AppIcon.appiconset/icono.png" <<'PY'
import sys
from PIL import Image
L = 1024
lienzo = Image.new('RGBA', (L, L), (246, 243, 251, 255))
p = Image.open(sys.argv[1]).convert('RGBA')
f = 860 / max(p.size)
p = p.resize((round(p.width * f), round(p.height * f)), Image.LANCZOS)
lienzo.alpha_composite(p, ((L - p.width) // 2, (L - p.height) // 2))
lienzo.convert('RGB').save(sys.argv[2])
PY
xcodebuild -project Gumdramon.xcodeproj -scheme Gumdramon -configuration Release -destination "id=$UDID" -derivedDataPath build -allowProvisioningUpdates -quiet build
xcrun devicectl device install app --device "$UDID" build/Build/Products/Release-iphoneos/Gumdramon.app
echo "✓ Instalada"
