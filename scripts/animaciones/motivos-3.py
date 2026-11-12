"""«El poder por convicción, y no por decisión» (Motivos 3 de 3).

«Alguien que es capaz de movilizar a personas… mediante su ejemplo»: el logo en el centro y tres anillos
de personas (puntos) que giran a su alrededor, cada una unida a él por un hilo que se enciende por turnos.
Cada anillo gira justo un hueco entre personas por vuelta: empalma solo.
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
    camara()
    centro = Vector((0, 0, 0.05))
    logo(centro, 0.95)
    gente = emisivo("Persona", gcc.LILA, 1.2)
    for k, (radio, cuantos, sentido) in enumerate(((1.0, 6, 1), (1.45, 10, -1), (1.9, 14, 1))):
        anillo = bpy.data.objects.new("Anillo", None)
        bpy.context.collection.objects.link(anillo)
        anillo.location = centro
        conducir(anillo, "rotation_euler", f"{sentido}*2*pi/{cuantos}*{FASE}", 1)
        aro = curva(circulo(radio), emisivo("Aro", gcc.VIOLETA, 0.6, alfa=0.5), 0.005, ciclica=True)
        aro.parent = anillo
        for i in range(cuantos):
            a = 2 * math.pi * i / cuantos
            p = Vector((radio * math.cos(a), 0, radio * math.sin(a)))
            punto = gcc.esfera(pos=p, radio=0.07 - k * 0.012, mat=gente)
            punto.parent = anillo
            hilo = curva(recta(p * 0.32, p * 0.97, 12), emisivo("Hilo", gcc.LILA, 1.0, alfa=0.7), 0.008)
            hilo.parent = anillo
            pulso_en(hilo, fase(1, -i / cuantos - k * 0.33), 0.5)
