"""Regla 2 · Comandos — «la gobernanza escucha, decide y analiza correcciones… los comandos se ejecutan».

Arriba el logo (la gobernanza). Bajan los comandos a la rejilla de miembros, columna a columna, y cada
miembro se enciende al recibirlo; por los lados sube la corrección (lo que se analiza y vuelve).
Dos oleadas por vuelta. En bucle.
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
    camara(pos=(0, -11.5, 1.6), mira=(0, 0, 0.0))
    arriba = Vector((0, 0, 1.55))
    logo(arriba, 1.0)
    comando = emisivo("Comando", gcc.LILA, 1.4)
    linea = emisivo("Linea", gcc.VIOLETA, 0.5, alfa=0.5)
    columnas = 5
    for c in range(columnas):
        x = -2.4 + c * 1.2
        destino = Vector((x, 0, -0.55))
        puntos = [arriba + Vector((0, 0, -0.55))] + arco(arriba + Vector((0, 0, -0.55)), destino, 0.0, 24)[1:]
        curva(puntos, linea, 0.006)
        ruta = curva(puntos, None, 0)
        f = fase(2, -c * 0.08)
        viajero(ruta, f, 0.07, comando)
        for fila in range(3):
            m = bloque((x, fila * 0.6, -0.85 - fila * 0.42), (0.55, 0.4, 0.3))
            llegada = f"fmod({f}+1-{fila * 0.06},1)"
            escala(m, "1+0.22*" + pico(llegada, 0.98, 16))
    # La corrección sube por los lados.
    for lado in (-1, 1):
        puntos = arco(Vector((lado * 3.3, 0, -1.2)), arriba + Vector((lado * 0.7, 0, 0)), 0.9, 40)
        curva(puntos, linea, 0.006)
        sube = curva(puntos, emisivo("Correccion", gcc.LILA, 1.0), 0.014)
        pulso_en(sube, fase(1, 0.5 if lado > 0 else 0.0), 0.25)
