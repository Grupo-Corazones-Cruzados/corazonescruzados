"""Regla #1 · ¿Quiénes somos? — «los valores que deberás trabajar para representar nuestra organización».

Los nueve valores como nueve puntos alrededor del logo, unidos a él. Uno a uno se encienden y su rayo
lleva la luz al centro: representar a la organización es sostenerlos todos. En bucle.
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
    l = logo(centro, 1.1)
    escala(l, "1+0.06*sin(2*pi*9*" + FASE + ")")
    curva(circulo(1.7, centro=centro), emisivo("Aro", gcc.VIOLETA, 0.7, alfa=0.55), 0.006, ciclica=True)
    for i in range(9):
        a = math.pi / 2 - 2 * math.pi * i / 9
        p = centro + Vector((1.7 * math.cos(a), 0, 1.7 * math.sin(a)))
        valor = gcc.esfera(pos=p, radio=0.12, mat=emisivo("Valor", gcc.LILA, 1.3))
        escala(valor, "1+0.7*" + pico(FASE, i / 9, 14))
        halo = aro_en(p, 0.22, emisivo("Halo", gcc.VIOLETA, 1.0, alfa=0.8), 0.006)
        escala(halo, "0.6+1.2*" + pico(FASE, i / 9, 14))
        curva(recta(p, centro + (p - centro) * 0.36, 12), emisivo("Rayo", gcc.VIOLETA, 0.6, alfa=0.5), 0.006)
        rayo = curva(recta(p, centro + (p - centro) * 0.36, 12), emisivo("RayoLuz", gcc.LILA, 1.2), 0.012)
        pulso_en(rayo, f"min(1,max(0,(fmod({FASE}-{i / 9}+1,1))*5))", 0.45)
