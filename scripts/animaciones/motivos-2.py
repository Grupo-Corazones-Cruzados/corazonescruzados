"""«Una realidad imposible, frente a una disciplina centralizada» (Motivos 2 de 3).

Una escalera de seis peldaños hacia el logo de la casa. Sobre cada peldaño, un bloque oscuro: los problemas.
Una luz sube peldaño a peldaño («paso a paso») y, al pasar, el problema desaparece («hasta limpiar nuestras
calles»); vuelve tarde, antes de que la luz pase otra vez: el trabajo de cada día. En bucle.
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import gcc  # noqa: E402
from comun import *  # noqa: E402,F401,F403


def construir(escena):
    camara(pos=(0, -12.5, 0.9), mira=(0, 0, -0.35))
    n = 6
    peldanos = []
    for i in range(n):
        x = -2.75 + i * 0.95
        z = -2.05 + i * 0.46
        bloque((x, 0, z), (0.95, 1.4, 0.18))
        peldanos.append(Vector((x, 0, z + 0.09)))
    # El problema de cada peldaño: se va cuando pasa la luz y vuelve justo antes de la siguiente vuelta.
    sombra = emisivo("Problema", (0.05, 0.02, 0.10), 1.0)
    borde = emisivo("BordeProblema", (0.35, 0.10, 0.45), 1.0)
    for i, p in enumerate(peldanos):
        b = bloque(p + Vector((0.12, 0, 0.2)), (0.32, 0.32, 0.32), sombra, borde)
        b.rotation_euler = (0, 0, 0.5)
        llegada = (i + 0.5) / n
        escala(b, f"min(1,max(0,(fmod({FASE}-{llegada}+1,1)-0.62)*6))")
    # La luz que sube: salta de peldaño en peldaño.
    camino = []
    for a, b in zip([peldanos[0] + Vector((-0.9, 0, 0))] + peldanos, peldanos + [peldanos[-1] + Vector((0.9, 0, 0.9))]):
        camino.extend(arco(a + Vector((0, -0.4, 0.15)), b + Vector((0, -0.4, 0.15)), 0.45, 16)[:-1])
    ruta = curva(camino, None, 0)
    viajero(ruta, FASE, radio=0.11, mat=emisivo("Luz", gcc.LILA, 1.4))
    estela = curva(camino, emisivo("Estela", gcc.LILA, 0.9), 0.02)
    pulso_en(estela, FASE, 0.12)
    # Arriba, el logo: late cuando la luz llega.
    l = logo((2.45, -0.2, 1.2), 0.95)
    escala(l, "1+0.18*" + pico(FASE, 0.0, 12))
