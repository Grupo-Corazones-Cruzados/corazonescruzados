#!/usr/bin/env python3
"""
LOS ICONOS DE LA APP, DE UNA SOLA FUENTE (Fernando, 2026-10-07: «que el logo de la app tanto
en la pantalla de inicio como el de notificaciones sea el correcto»).

Fuente: `public/LogoApp.png` (1080 px). Trae el logo —trazo negro sobre círculo blanco— y,
FUERA del círculo, la marca de agua «miro» de la herramienta con que se dibujó. Aquí se saca
SOLO el trazo (píxeles oscuros y opacos DENTRO del círculo) y con él se compone todo:

  · iPhone: icono de 1024 (fondo blanco, sin transparencia: iOS la rechaza).
  · Android: icono adaptativo (trazo sobre transparente + fondo blanco), los clásicos
    redondo/cuadrado, la silueta blanca de la barra de notificaciones y el logo grande.
  · Web/PWA: `public/icono-192.png` e `icono-512.png` (los del manifiesto).
  · Actividad en Vivo: la silueta para el cuadrado morado.

Volver a ejecutarlo tras cambiar el logo:  python3 movil/generar-iconos.py
"""
from pathlib import Path
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "public/LogoApp.png"
AND = RAIZ / "movil/android/app/src/main/res"
IOS = RAIZ / "movil/ios/App"

src = Image.open(FUENTE).convert("RGBA")
W, H = src.size
px = src.load()

# 1) El círculo: lo opaco y claro. Su caja da centro y radio.
cx0, cy0, cx1, cy1 = W, H, 0, 0
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a > 200 and (r + g + b) / 3 > 200:
            cx0, cy0, cx1, cy1 = min(cx0, x), min(cy0, y), max(cx1, x), max(cy1, y)
cx, cy = (cx0 + cx1) / 2, (cy0 + cy1) / 2
radio = min(cx1 - cx0, cy1 - cy0) / 2 - 2

# 2) El trazo: oscuro, opaco y dentro del círculo (la marca de agua queda fuera).
trazo = Image.new("L", (W, H), 0)
tp = trazo.load()
for y in range(H):
    for x in range(W):
        r, g, b, a = px[x, y]
        if a > 128 and (x - cx) ** 2 + (y - cy) ** 2 <= radio ** 2:
            lum = (r + g + b) / 3
            if lum < 200:
                tp[x, y] = int(max(0, min(255, (200 - lum) * 255 / 170)))
trazo = trazo.crop(trazo.getbbox())

def marca(lado: int, fraccion: float) -> Image.Image:
    """El trazo como máscara, centrado en un cuadrado de `lado`, ocupando `fraccion`."""
    w, h = trazo.size
    escala = lado * fraccion / max(w, h)
    m = trazo.resize((max(1, round(w * escala)), max(1, round(h * escala))), Image.LANCZOS)
    lienzo = Image.new("L", (lado, lado), 0)
    lienzo.paste(m, ((lado - m.width) // 2, (lado - m.height) // 2))
    return lienzo

def sobre_blanco(lado: int, fraccion: float) -> Image.Image:
    img = Image.new("RGB", (lado, lado), (255, 255, 255))
    img.paste((20, 20, 20), mask=marca(lado, fraccion))
    return img

def circulo_blanco(lado: int, fraccion: float) -> Image.Image:
    img = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    disco = Image.new("L", (lado * 4, lado * 4), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(disco).ellipse((0, 0, lado * 4 - 1, lado * 4 - 1), fill=255)
    img.paste((255, 255, 255, 255), mask=disco.resize((lado, lado), Image.LANCZOS))
    img.paste((20, 20, 20, 255), mask=marca(lado, fraccion))
    return img

def silueta(lado: int, fraccion: float = 0.9) -> Image.Image:
    img = Image.new("RGBA", (lado, lado), (255, 255, 255, 0))
    img.putalpha(marca(lado, fraccion))
    return img

# iPhone
sobre_blanco(1024, 0.62).save(IOS / "App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
silueta(180).save(IOS / "RelojWidget/Assets.xcassets/LogoGCC.imageset/logo-gcc.png")

# Android
for d, lado in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    sobre_blanco(lado, 0.62).save(AND / f"mipmap-{d}/ic_launcher.png")
    circulo_blanco(lado, 0.58).save(AND / f"mipmap-{d}/ic_launcher_round.png")
for d, lado in {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}.items():
    fg = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    fg.paste((20, 20, 20, 255), mask=marca(lado, 0.42))  # zona segura: 66 % central
    fg.save(AND / f"mipmap-{d}/ic_launcher_foreground.png")
for d, lado in {"mdpi": 24, "hdpi": 36, "xhdpi": 48, "xxhdpi": 72, "xxxhdpi": 96}.items():
    silueta(lado).save(AND / f"drawable-{d}/ic_gcc.png")
sobre_blanco(256, 0.62).save(AND / "drawable-nodpi/ic_gcc_grande.png")

# Pantalla de arranque de Android: blanco con el logo al 30 % del lado corto.
for f in AND.glob("drawable*/splash.png"):
    w, h = Image.open(f).size
    lado = min(w, h)
    lienzo = Image.new("RGB", (w, h), (255, 255, 255))
    lienzo.paste((20, 20, 20), (0, 0, w, h), mask=Image.new("L", (w, h), 0))
    m = marca(lado, 0.30)
    lienzo.paste((20, 20, 20), ((w - lado) // 2, (h - lado) // 2), mask=m)
    lienzo.save(f)

# Web / PWA
sobre_blanco(512, 0.62).save(RAIZ / "public/icono-512.png")
sobre_blanco(192, 0.62).save(RAIZ / "public/icono-192.png")
print("iconos generados; círculo", (cx, cy, radio), "trazo", trazo.size)
