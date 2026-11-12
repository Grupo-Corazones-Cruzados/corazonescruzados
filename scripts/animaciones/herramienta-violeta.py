"""Violeta — «la luz que nos representa, el color que une corazones».

El logo de la casa en el centro, envuelto en aros de luz violeta que giran, y luces que llegan desde fuera
hasta él: el color que une. Los aros giran media vuelta por vuelta (son simétricos) y cada luz nace y se
apaga en su ciclo. En bucle.
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
    l = logo(centro, 1.35)
    escala(l, "1+0.05*sin(2*pi*2*" + FASE + ")")
    for k, (radio, inclina, color) in enumerate(((1.25, 0.35, gcc.LILA), (1.55, -0.6, gcc.VIOLETA), (1.85, 1.1, gcc.VIOLETA))):
        aro = curva(circulo(radio), emisivo(f"Aro{k}", color, 1.1 if k == 0 else 0.8), 0.012 - k * 0.002, ciclica=True)
        aro.location = centro
        aro.rotation_euler = (inclina, 0, 0)
        conducir(aro, "rotation_euler", f"{0.3 * (k + 1)}+pi*{FASE}*{1 if k % 2 == 0 else -1}", 2)
    luz = emisivo("Luz", gcc.LILA, 1.5)
    for i in range(12):
        a = 2 * math.pi * i / 12
        lejos = centro + Vector((3.4 * math.cos(a), 0.5 * math.sin(a * 3), 1.9 * math.sin(a)))
        ruta = curva(arco(lejos, centro + (lejos - centro).normalized() * 0.55, 0.25, 24), None, 0)
        viajero(ruta, fase(1, i / 12), 0.055, luz)
