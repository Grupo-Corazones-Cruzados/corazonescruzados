"""El libro · Capítulo IX, «El camino»: la prospección y sus cuatro aspectos, del de mayor importancia (talento)
al de menor (red de apoyo).

Una pirámide invertida de cuatro niveles (arriba el más estrecho, como en el formulario): una luz sube desde
la base hasta la cima y cada nivel se enciende al pasar. En la cima, el logo. En bucle.
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
    camara(pos=(0, -11.5, 0.4), mira=(0, 0, -0.1))
    anchos = [1.7, 2.3, 2.9, 3.5]
    niveles = []
    for i, an in enumerate(anchos):
        z = 0.75 - i * 0.62
        b = bloque((0, 0, z), (an, 0.5, 0.42))
        niveles.append(z)
        llegada = 1 - (i + 1) / 5
        brillo = curva(recta((-an / 2 + 0.08, -0.27, z), (an / 2 - 0.08, -0.27, z), 12), emisivo("Brillo", gcc.LILA, 1.5), 0.02)
        escala(brillo, "0.2+0.8*" + pico(FASE, llegada, 8))
        escala(b, "1+0.06*" + pico(FASE, llegada, 8))
    ruta = curva(recta((0, -0.35, -1.5), (0, -0.35, 1.3), 30), None, 0)
    viajero(ruta, FASE, 0.1, emisivo("Luz", gcc.LILA, 1.6))
    l = logo((0, -0.2, 1.62), 0.75)
    escala(l, "1+0.15*" + pico(FASE, 0.97, 10))
