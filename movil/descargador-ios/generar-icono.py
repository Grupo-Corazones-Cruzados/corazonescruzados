#!/usr/bin/env python3
"""El icono del iPhone, el mismo dibujo que el de Android (ic_fondo + ic_frente: flecha y barra
blancas sobre el morado de GCC), en 1024 px y sin transparencia (iOS la rechaza)."""
from pathlib import Path
from PIL import Image, ImageDraw

S = 1024 / 108  # el lienzo de Android mide 108
X = 30          # ic_frente va desplazado (30, 30)
img = Image.new("RGB", (1024, 1024), "#4B2D8E")
d = ImageDraw.Draw(img)
flecha = [(21, 4), (27, 4), (27, 24.2), (34.6, 16.6), (38.8, 20.8), (24, 35.6), (9.2, 20.8), (13.4, 16.6), (21, 24.2)]
d.polygon([((x + X) * S, (y + X) * S) for x, y in flecha], fill="white")
d.rounded_rectangle([(4 + X) * S, (38 + X) * S, (44 + X) * S, (44 + X) * S], radius=2 * S, fill="white")
img.save(Path(__file__).parent / "Descargador/Assets.xcassets/AppIcon.appiconset/icono.png")
