"""El icono de 1024 de una app de escritorio: el trazo de `movil/generar-iconos.py` en blanco sobre el
color de la app, en un cuadrado redondeado con margen, como los iconos de macOS.
Uso: python3 icono.py <raíz del repo> <#color> <salida.png>"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

raiz, color, salida = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
fuente = (raiz / "movil/generar-iconos.py").read_text(encoding="utf8").split("\n# iPhone\n")[0]
fuente = fuente.replace("Path(__file__).resolve().parent.parent", "Path(sys.argv[1])")
g = {"__file__": str(raiz / "movil/generar-iconos.py")}
exec("import sys\n" + fuente, g)

L, M = 1024, 100  # lienzo y margen de los iconos de macOS
rgb = tuple(int(color[i:i + 2], 16) for i in (1, 3, 5))
lienzo = Image.new("RGBA", (L, L), (0, 0, 0, 0))
mascara = Image.new("L", (L * 2, L * 2), 0)
ImageDraw.Draw(mascara).rounded_rectangle((M * 2, M * 2, (L - M) * 2, (L - M) * 2), radius=185 * 2, fill=255)
lienzo.paste(rgb + (255,), mask=mascara.resize((L, L), Image.LANCZOS))
lado = L - 2 * M
trazo = g["marca"](lado, 0.62)
capa = Image.new("RGBA", (lado, lado), (255, 255, 255, 255))
lienzo.paste(capa, (M, M), mask=trazo)
lienzo.save(salida)
