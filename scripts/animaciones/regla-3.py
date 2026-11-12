"""Regla 3 · Opciones de crecimiento — «la confianza que ofrecemos y el acceso a mayores recursos depende de
la prospección y de los resultados… las opciones de crecimiento llegarán».

Un árbol de líneas: por la raíz entra la energía y sube por el tronco hasta cada rama, y en las puntas se
abren las opciones de crecimiento (brotes que se encienden). En bucle.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import gcc  # noqa: E402
from comun import *  # noqa: E402,F401,F403


RAMAS = []


def rama(base, direccion, largo, nivel, t0):
    punta = base + direccion * largo
    pts = recta(base, punta, 16)
    RAMAS.append((pts, nivel, t0))
    if nivel < 3:
        for giro in (-0.62, 0.58):
            d = Vector((direccion.x * math.cos(giro) - direccion.z * math.sin(giro), 0, direccion.x * math.sin(giro) + direccion.z * math.cos(giro)))
            rama(punta, d.normalized(), largo * 0.72, nivel + 1, t0 + 0.16)
    else:
        RAMAS.append((punta, -1, t0 + 0.16))


def construir(escena):
    camara(pos=(0, -11.8, 0.6), mira=(0, 0, 0.15))
    rama(Vector((0, 0, -1.75)), Vector((0, 0, 1)), 1.45, 0, 0.0)
    tenue = emisivo("Rama", gcc.VIOLETA, 0.7, alfa=0.7)
    brote = emisivo("Brote", gcc.LILA, 1.4)
    for pts, nivel, t0 in RAMAS:
        if nivel < 0:
            b = gcc.esfera(pos=pts, radio=0.1, mat=brote)
            escala(b, "0.45+0.9*" + pico(FASE, t0 + 0.05, 10))
            continue
        grosor = 0.05 * (0.62 ** nivel)
        curva(pts, tenue, grosor)
        energia = curva(pts, emisivo("Energia", gcc.LILA, 1.3), grosor * 1.4)
        pulso_en(energia, f"min(1,max(0,(fmod({FASE}-{t0}+1,1))*6))", 0.5)
    # La raíz: una línea de suelo.
    curva(recta((-1.6, 0, -1.75), (1.6, 0, -1.75)), emisivo("Suelo", gcc.VIOLETA, 0.6, alfa=0.6), 0.008)
