"""El libro · Capítulo I, «El sueño»: «¡Cuando era pequeño me encantaba soñar!».

Un cielo de noche: estrellas que titilan cada una a su ritmo y, en medio, el logo de la casa encendiéndose
despacio como una constelación. En bucle (cada estrella titila un número entero de veces por vuelta).
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import gcc  # noqa: E402
from comun import *  # noqa: E402,F401,F403


def construir(escena):
    camara()
    random.seed(11)
    estrella = emisivo("Estrella", gcc.LILA, 1.3)
    for i in range(70):
        x, z = random.uniform(-3.9, 3.9), random.uniform(-2.1, 2.1)
        if abs(x) < 1.0 and abs(z) < 1.0:
            continue
        e = gcc.esfera(pos=(x, random.uniform(0, 2), z), radio=random.uniform(0.012, 0.035), mat=estrella)
        veces = random.choice((1, 2, 3))
        escala(e, f"0.35+0.9*{pico(fase(veces, random.random()), 0.0, 6)}")
    # Unas pocas estrellas fugaces cruzan el cielo.
    for k in range(2):
        a = Vector((-4.2 + k * 1.5, 1.5, 1.9 - k * 0.7))
        b = a + Vector((3.2, 0, -1.3))
        fugaz = curva(recta(a, b, 16), emisivo("Fugaz", gcc.LILA, 1.4), 0.008)
        pulso_en(fugaz, f"min(1,max(0,({fase(1, k * 0.5)})*4-0.2))", 0.35)
    l = logo((0, 0, 0.05), 1.3)
    escala(l, "1+0.04*sin(2*pi*" + FASE + ")")
    aro = aro_en((0, 0, 0.05), 0.95, emisivo("Halo", gcc.VIOLETA, 0.8, alfa=0.6), 0.006, 64)
    escala(aro, "1+0.08*sin(2*pi*" + FASE + ")")
