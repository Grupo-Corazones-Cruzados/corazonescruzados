"""Proyecto Centralizado — «un servicio para negocios que necesitan recuperar o mejorar su flujo de trabajo».

Seis paneles (las áreas de un negocio) alrededor de un centro. Por cada línea van y vienen paquetes: el
trabajo entra al centro, se ordena y vuelve. El centro gira un cuarto de vuelta por vuelta. En bucle.
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
    camara(pos=(0, -11.5, 0.8), mira=(0, 0, 0.0))
    centro = Vector((0, 0, 0))
    hub = bloque(centro, (0.9, 0.9, 0.9))
    conducir(hub, "rotation_euler", "pi/2*" + FASE, 2)
    nucleo = gcc.esfera(pos=centro, radio=0.22, mat=emisivo("Nucleo", gcc.LILA, 1.4))
    escala(nucleo, "1+0.25*" + pico(fase(6), 0.0, 6))
    linea = emisivo("Linea", gcc.VIOLETA, 0.6, alfa=0.6)
    paquete = emisivo("Paquete", gcc.LILA, 1.5)
    for i in range(6):
        a = 2 * math.pi * i / 6 + math.pi / 6
        p = Vector((2.75 * math.cos(a), 0.0, 1.55 * math.sin(a)))
        panel = bloque(p, (0.95, 0.1, 0.62))
        for k in range(3):
            raya = curva(recta(p + Vector((-0.25, -0.06, 0.12 - k * 0.12)), p + Vector((0.1 + 0.1 * (k % 2), -0.06, 0.12 - k * 0.12)), 4), emisivo("Raya", gcc.VIOLETA, 0.9), 0.012)
        ida = recta(p, centro, 20)
        curva(ida, linea, 0.008)
        entra = curva(ida, None, 0)
        sale = curva(list(reversed(ida)), None, 0)
        viajero(entra, fase(2, i / 6), 0.07, paquete)
        viajero(sale, fase(2, i / 6 + 0.5), 0.05, emisivo("Vuelta", gcc.VIOLETA, 1.4))
