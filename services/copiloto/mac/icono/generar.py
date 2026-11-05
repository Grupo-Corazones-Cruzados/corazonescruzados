#!/usr/bin/env python3
"""Compone el icono de la app: el personaje sobre una placa clara con las esquinas de macOS."""
import sys
from PIL import Image, ImageDraw

origen, destino = sys.argv[1], sys.argv[2]
L = 1024
PLACA = 824
M = (L - PLACA) // 2
RADIO = 186

escala = 4
mascara = Image.new('L', (L * escala, L * escala), 0)
ImageDraw.Draw(mascara).rounded_rectangle((M * escala, M * escala, (M + PLACA) * escala, (M + PLACA) * escala), RADIO * escala, fill=255)
mascara = mascara.resize((L, L), Image.LANCZOS)
lienzo = Image.new('RGBA', (L, L), (0, 0, 0, 0))
lienzo.paste(Image.new('RGBA', (L, L), (246, 243, 251, 255)), (0, 0), mascara)

p = Image.open(origen).convert('RGBA')
lado = PLACA - 90
f = lado / max(p.size)
p = p.resize((round(p.width * f), round(p.height * f)), Image.LANCZOS)
lienzo.alpha_composite(p, ((L - p.width) // 2, (L - p.height) // 2))
lienzo.save(destino)
