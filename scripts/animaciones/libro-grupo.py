"""El libro · Capítulo V, «El Grupo Corazones Cruzados»: «estamos aquí para luchar por un sueño».

Personas (puntos) que llegan desde lejos y se unen al anillo que rodea al logo; el anillo, unido de mano
en mano, gira despacio un hueco por vuelta. En bucle.
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
    centro = Vector((0, 0, 0.05))
    logo(centro, 1.0)
    n = 16
    anillo = bpy.data.objects.new("Anillo", None)
    bpy.context.collection.objects.link(anillo)
    anillo.location = centro
    conducir(anillo, "rotation_euler", f"2*pi/{n}*" + FASE, 1)
    gente = emisivo("Persona", gcc.LILA, 1.3)
    mano = emisivo("Mano", gcc.VIOLETA, 1.0)
    puntos = []
    for i in range(n):
        a = 2 * math.pi * i / n
        puntos.append(Vector((1.55 * math.cos(a), 0, 1.55 * math.sin(a))))
    for i, p in enumerate(puntos):
        e = gcc.esfera(pos=p, radio=0.075, mat=gente)
        e.parent = anillo
        q = puntos[(i + 1) % n]
        medio = (p + q) / 2 * 1.08
        c = curva([p, medio, q], mano, 0.008)
        c.parent = anillo
        r = curva(recta(p * 0.92, p * 0.45, 8), emisivo("Hilo", gcc.VIOLETA, 0.5, alfa=0.45), 0.005)
        r.parent = anillo
    # Los que llegan.
    llega = emisivo("Llega", gcc.LILA, 1.5)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.2
        lejos = centro + Vector((3.8 * math.cos(a), 0, 2.2 * math.sin(a)))
        cerca = centro + Vector((1.7 * math.cos(a), 0, 1.7 * math.sin(a)))
        ruta = curva(arco(lejos, cerca, 0.3, 24), None, 0)
        viajero(ruta, fase(1, k / 8), 0.06, llega)
        estela = curva(arco(lejos, cerca, 0.3, 24), emisivo("Estela", gcc.LILA, 0.9), 0.006)
        pulso_en(estela, fase(1, k / 8), 0.2)
