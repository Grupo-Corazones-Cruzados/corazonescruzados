"""«La promesa»: «aquel día hizo una promesa… y salió a buscar la manera de cumplirla». El cuarto al amanecer:
la luz dorada entra por la ventana; sobre la mesa, una brújula y una libreta; en el suelo, las botas: listo
para el viaje. Bucle de 8 s."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_real as c  # noqa: E402

c.preparar()
F = c.FASE
c.cielo("aarfontein_sunrise", rot_x=6, rot_z=250, fuerza_camara=1.1, fuerza_luz=0.4, tinte=(1.0, 0.9, 0.8))
c.cuarto()
_, mesa = c.colocar("SchoolDesk_01", 0.0, 0.7, 0.0)
mn, mx = c.caja_de(mesa)
TAPA = mx.z
c.colocar("book_encyclopedia_set_01", -0.24, 0.84, TAPA, solo=("book01", "book04", "book07", "book09"), juntar=True)
c.colocar("binder_notebook", -0.02, 0.62, TAPA, rot=math.radians(-12))
brujula, _ = c.colocar("seadogs_compass", 0.2, 0.6, TAPA, rot=math.radians(25))
c.colocar("Lantern_01", 0.28, 0.8, TAPA, rot=math.radians(20))
c.colocar("rubber_boots", 0.42, 0.25, 0.0, rot=math.radians(-30))
c.colocar("potted_plant_02", 0.85, 0.9, 0.0, rot=math.radians(40), escala=1.25)
# El sol que entra, cálido, y su reflejo sobre la mesa.
c.luz_ventana((1.0, 0.72, 0.45), 120)
c.luz("Sol", "SUN", (0, 3, 3), (math.radians(-62), 0, math.radians(185)), (1.0, 0.78, 0.55), 2.2)
c.luz("Relleno", "AREA", (-1.6, -2.2, 1.9), (math.radians(60), 0, math.radians(-35)), (1.0, 0.85, 0.75), 10, 3)
c.motas(22, ((-0.4, 0.5), (0.4, 1.0), (TAPA + 0.05, TAPA + 0.7)), color=(1.0, 0.85, 0.6), fuerza=3.0, semilla=7)
c.camara((0.12, 0.62, TAPA + 0.05),
         f"-0.05+0.12*sin(2*pi*{F})", f"-0.55+0.08*(0.5-0.5*cos(2*pi*{F}))", f"{TAPA + 0.3}+0.02*sin(2*pi*{F})", lente=36, fstop=3.5)
c.renderizar()
