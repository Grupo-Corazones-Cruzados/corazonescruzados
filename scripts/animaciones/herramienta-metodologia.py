"""Metodología Condiciológica — «una metodología científica de seis pasos».

Los seis pasos como seis nodos en hexágono unidos en ciclo; un pulso los recorre en orden y cada nodo se
enciende al pasar. En el centro, una molécula que gira: la investigación. En bucle.
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
    nodos = []
    for i in range(6):
        a = math.pi / 2 - 2 * math.pi * i / 6
        nodos.append(centro + Vector((1.85 * math.cos(a), 0, 1.85 * math.sin(a))))
    pts = []
    for a, b in zip(nodos, nodos[1:] + nodos[:1]):
        pts.extend(recta(a, b, 16)[:-1])
    curva(pts, emisivo("Ciclo", gcc.VIOLETA, 0.7, alfa=0.6), 0.008, ciclica=True)
    ruta = curva(pts, None, 0, ciclica=True)
    viajero(ruta, FASE, 0.1, emisivo("Pulso", gcc.LILA, 1.5), apagar_extremos=False)
    for i, p in enumerate(nodos):
        n = gcc.esfera(pos=p, radio=0.2, mat=emisivo("Nodo", (0.10, 0.04, 0.35), 1.0))
        aro = aro_en(p, 0.26, emisivo("AroNodo", gcc.VIOLETA, 1.0), 0.012)
        escala(n, "1+0.35*" + pico(FASE, i / 6, 12))
        escala(aro, "1+0.5*" + pico(FASE, i / 6, 12))
    # La molécula: tres átomos que giran (un tercio de vuelta por vuelta: empalma).
    eje = bpy.data.objects.new("Molecula", None)
    bpy.context.collection.objects.link(eje)
    eje.location = centro
    conducir(eje, "rotation_euler", "2*pi/3*" + FASE, 1)
    conducir(eje, "rotation_euler", "0.4", 0)
    nucleo = gcc.esfera(pos=centro, radio=0.22, mat=emisivo("Nucleo", gcc.LILA, 1.1))
    for k in range(3):
        a = 2 * math.pi * k / 3
        p = Vector((0.7 * math.cos(a), 0, 0.7 * math.sin(a)))
        at = gcc.esfera(pos=p, radio=0.12, mat=emisivo("Atomo", gcc.VIOLETA, 1.2))
        at.parent = eje
        enlace = curva(recta((0, 0, 0), p, 8), emisivo("Enlace", gcc.VIOLETA, 0.8), 0.02)
        enlace.parent = eje
