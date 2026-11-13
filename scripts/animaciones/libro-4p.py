"""El libro · Capítulo VI, «El motor»: el Modelo Organizacional 4P, cuatro pisos por cuatro pasos.

Una rejilla de 4 × 4 nodos (filas = pisos, de Global arriba a Colaborador abajo; columnas = pasos, de
Fundamentación a Gestión) unidos por sus líneas. Una onda la recorre en diagonal: cada miembro tiene su
piso y su paso. En bucle.
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
    camara(pos=(0, -11.5, 0.5), mira=(0, 0, 0.05))
    paso_x, paso_z = 1.35, 1.0
    linea = emisivo("Linea", gcc.VIOLETA, 0.7, alfa=0.6)
    for f in range(4):
        z = 1.55 - f * paso_z
        curva(recta((-2.0, 0, z), (2.0, 0, z), 8), linea, 0.007)
    for c in range(4):
        x = -2.0 + c * paso_x * 0.99
        curva(recta((x, 0, 1.55), (x, 0, -1.45), 8), linea, 0.007)
    for f in range(4):
        for c in range(4):
            p = Vector((-2.0 + c * paso_x * 0.99, 0, 1.55 - f * paso_z))
            nodo = gcc.esfera(pos=p, radio=0.13, mat=emisivo("Nodo", (0.10, 0.04, 0.35), 1.0))
            aro = aro_en(p, 0.2, emisivo("Aro", gcc.VIOLETA, 1.1), 0.01)
            centro = (f + c) / 8
            escala(nodo, "1+0.6*" + pico(FASE, centro, 10))
            brillo = gcc.esfera(pos=p, radio=0.09, mat=emisivo("Brillo", gcc.LILA, 1.6))
            escala(brillo, pico(FASE, centro, 10))
            escala(aro, "1+0.4*" + pico(FASE, centro, 10))
    # Marcos de fila y columna: el piso arriba a la izquierda, el paso arriba.
    for f in range(4):
        b = bloque((-2.75, 0, 1.55 - f * paso_z), (0.42, 0.1, 0.28))
    for c in range(4):
        b = bloque((-2.0 + c * paso_x * 0.99, 0, 2.15), (0.5, 0.1, 0.24))
