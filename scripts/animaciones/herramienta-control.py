"""Sistema de Control Psicosocial — «una arquitectura tecnológica contra la inseguridad física, basada en las
señales de todos».

Una ciudad de bloques bajo una cúpula de red. Desde varias casas salen señales (ondas que se abren) y
suben a la cúpula, que las recoge. Cada onda nace y se apaga dentro de su ciclo. En bucle.
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
    camara(pos=(0, -12.5, 5.6), mira=(0, 0, -0.55))
    import random
    random.seed(7)
    for ix in range(-3, 4):
        for iy in range(-2, 3):
            if abs(ix) + abs(iy) > 4:
                continue
            alto = 0.2 + random.random() * 0.7
            bloque((ix * 0.62, iy * 0.62, -1.2 + alto / 2), (0.42, 0.42, alto))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=2.75, segments=24, ring_count=12, location=(0, 0, -1.25))
    cupula = gcc.asignar(bpy.context.active_object, emisivo("Cupula", gcc.VIOLETA, 0.8, alfa=0.35))
    cupula.modifiers.new("red", "WIREFRAME").thickness = 0.008
    corte = cupula.modifiers.new("mitad", "BOOLEAN")
    bpy.ops.mesh.primitive_cube_add(size=6, location=(0, 0, -4.25))
    caja = bpy.context.active_object
    caja.hide_render = True
    corte.object = caja
    corte.operation = "DIFFERENCE"
    for k, (x, y) in enumerate(((-1.24, -0.62), (0.62, 0.62), (1.24, -0.62), (-0.62, 1.24))):
        f = fase(2, k * 0.25)
        mat = emisivo(f"Senal{k}", gcc.LILA, 1.4)
        opacidad(mat, f"1-{f}")
        onda = curva(circulo(1.0, 48, (0, 0, 0), plano="XY"), mat, 0.012, ciclica=True)
        onda.location = (x, y, -0.4)
        escala(onda, f"0.05+1.1*{f}")
        sube = curva(arco(Vector((x, y, -0.4)), Vector((x * 0.4, y * 0.4, 1.45)), 0.3, 24), emisivo("Sube", gcc.LILA, 1.1), 0.012)
        pulso_en(sube, f, 0.3)
