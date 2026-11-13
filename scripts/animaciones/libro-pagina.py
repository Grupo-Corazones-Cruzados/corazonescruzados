"""El libro · Epílogo, «Tu página en blanco»: la última página está por escribir, y la escribe el candidato.

Una página que flota; una luz-pluma la recorre de renglón en renglón y va dejando la escritura en luz. Al
final de la vuelta la escritura se desvanece y la página queda en blanco otra vez. En bucle.
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
    camara(pos=(0, -11.5, 1.2), mira=(0, 0, -0.05))
    hoja = bloque((0, 0.1, 0), (3.4, 0.05, 3.9))
    hoja.rotation_euler = (math.radians(-12), 0, 0)
    renglones = 7
    tinta = emisivo("Tinta", gcc.LILA, 1.3)
    opacidad(tinta, f"1-pow(max(0,({FASE}-0.86)/0.14),1)")
    pluma_pts = []
    for r in range(renglones):
        z = 1.45 - r * 0.42
        largo = 2.6 if r < renglones - 1 else 1.4
        a, b = Vector((-1.35, -0.05 - z * 0.21, z)), Vector((-1.35 + largo, -0.05 - z * 0.21, z))
        linea = curva(recta(a, b, 20), tinta, 0.014)
        t0, t1 = r / renglones * 0.82, (r + 1) / renglones * 0.82
        d = linea.data
        d.bevel_factor_mapping_end = "SPLINE"
        conducir(d, "bevel_factor_end", f"min(1,max(0,({FASE}-{t0})/{t1 - t0})) if {FASE}<0.98 else 0")
        pluma_pts.extend(recta(a, b, 20))
    ruta = curva(pluma_pts, None, 0)
    pluma = gcc.esfera(radio=0.07, mat=emisivo("Pluma", gcc.LILA, 1.8))
    s = pluma.constraints.new("FOLLOW_PATH")
    s.target = ruta
    s.use_fixed_location = True
    conducir(s, "offset_factor", f"min(1,{FASE}/0.82)")
    escala(pluma, f"1-pow(max(0,({FASE}-0.82)/0.12),1)" )
