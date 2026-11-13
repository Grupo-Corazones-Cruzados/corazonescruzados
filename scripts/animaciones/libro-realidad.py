"""El libro · Capítulo I, «La realidad»: «la realidad siempre volvía en forma de responsabilidad… soy incapaz
de aceptar este mundo… la promesa de aquel día».

Un mundo gris y apagado que gira lento. Sobre él, una sola luz violeta que late: la promesa. Alrededor, sus
rayos intentan abrirse paso. En bucle (la malla gira un hueco por vuelta).
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
    R = 1.55
    gcc.esfera(radio=R * 0.985, mat=emisivo("Nucleo", (0.012, 0.011, 0.016), 1.0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=24, ring_count=12)
    red = gcc.asignar(bpy.context.active_object, emisivo("Gris", (0.16, 0.15, 0.19), 1.0, alfa=0.55))
    red.modifiers.new("red", "WIREFRAME").thickness = 0.008
    conducir(red, "rotation_euler", "2*pi/24*" + FASE, 2)
    p = Vector((0.45, -1.42, 0.35))
    luz = gcc.esfera(pos=p, radio=0.1, mat=emisivo("Promesa", gcc.LILA, 1.6))
    escala(luz, "1+0.45*" + pico(fase(2), 0.0, 4))
    for k in range(3):
        aro = aro_en(p, 0.18, emisivo(f"Onda{k}", gcc.VIOLETA, 1.2), 0.008, 40)
        f = fase(1, k / 3)
        escala(aro, f"0.6+2.4*{f}")
        opacidad(aro.data.materials[0], f"1-{f}")
