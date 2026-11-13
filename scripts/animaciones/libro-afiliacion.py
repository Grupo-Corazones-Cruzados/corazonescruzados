"""El libro · Capítulo X, «La afiliación»: postularse, recibir el acceso, asistir a las reuniones, elevar la
prospección y convertirse en miembro.

Un camino de cinco paradas que sube de izquierda a derecha; un caminante (una luz) lo recorre y cada parada
se enciende al llegar. La última es el logo: ya es miembro. En bucle.
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
    camara(pos=(0, -11.5, 0.5), mira=(0, 0, 0.0))
    paradas = [Vector((-3.0 + i * 1.5, 0, -1.35 + i * 0.6)) for i in range(5)]
    pts = []
    for a, b in zip(paradas, paradas[1:]):
        pts.extend(arco(a, b, 0.35, 20)[:-1])
    pts.append(paradas[-1])
    curva(pts, emisivo("Camino", gcc.VIOLETA, 0.7, alfa=0.6), 0.008)
    estela = curva(pts, emisivo("Estela", gcc.LILA, 1.0), 0.016)
    pulso_en(estela, FASE, 0.15)
    ruta = curva(pts, None, 0)
    viajero(ruta, FASE, 0.1, emisivo("Caminante", gcc.LILA, 1.6))
    for i, p in enumerate(paradas[:-1]):
        n = gcc.esfera(pos=p, radio=0.17, mat=emisivo("Parada", (0.10, 0.04, 0.35), 1.0))
        aro = aro_en(p, 0.24, emisivo("Aro", gcc.VIOLETA, 1.1), 0.012)
        escala(aro, "1+0.5*" + pico(FASE, i / 4 * 0.97, 12))
        escala(n, "1+0.3*" + pico(FASE, i / 4 * 0.97, 12))
    l = logo(paradas[-1] + Vector((0, 0, 0.1)), 0.95)
    escala(l, "1+0.18*" + pico(FASE, 0.99, 12))
