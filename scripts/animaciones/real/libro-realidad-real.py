"""«La realidad»: «cada mañana la realidad volvía, y siempre volvía en forma de responsabilidad. Afuera el mundo
era gris…». El mismo cuarto del niño, de mañana: por la ventana una ciudad bajo un cielo nublado, el farol
apagado y el despertador que suena y tiembla. Luz fría y gris. Bucle de 8 s."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import comun_real as c  # noqa: E402

c.preparar()
F = c.FASE
c.cielo("alte_veste_station", rot_x=4, rot_z=120, fuerza_camara=1.0, fuerza_luz=0.35, tinte=(0.78, 0.8, 0.86))
c.cuarto()
_, mesa = c.colocar("SchoolDesk_01", 0.0, 0.7, 0.0)
mn, mx = c.caja_de(mesa)
TAPA = mx.z
c.colocar("book_encyclopedia_set_01", -0.2, 0.82, TAPA, solo=("book01", "book04", "book07", "book09", "book13", "book17"), juntar=True)
c.colocar("Lantern_01", 0.13, 0.72, TAPA, rot=math.radians(20))
reloj, _ = c.colocar("alarm_clock_01", 0.33, 0.56, TAPA, rot=math.radians(-18))
# El despertador suena: tiembla en ráfagas (seis por vuelta).
c.conducir(reloj, "rotation_euler", f"{math.radians(-18)}+0.06*sin(2*pi*90*{F})*pow(max(0,sin(2*pi*6*{F})),2)", 2)
c.conducir(reloj, "location", f"{reloj.location.x}+0.004*sin(2*pi*130*{F})*pow(max(0,sin(2*pi*6*{F})),2)", 0)
c.colocar("potted_plant_02", 0.78, 0.85, 0.0, rot=math.radians(40), escala=1.25)
c.luz_ventana((0.82, 0.86, 0.95), 70)
c.luz("Relleno", "AREA", (-1.6, -2.2, 1.9), (math.radians(60), 0, math.radians(-35)), (0.8, 0.82, 0.9), 14, 3)
c.motas(10, ((-0.35, 0.45), (0.45, 0.95), (TAPA + 0.08, TAPA + 0.6)), color=(0.85, 0.88, 0.95), fuerza=1.2)
c.camara((0.12, 0.62, TAPA + 0.1),
         f"0.1+0.08*sin(2*pi*{F})", f"-0.62+0.06*(0.5-0.5*cos(2*pi*{F}))", f"{TAPA + 0.26}+0.02*sin(2*pi*{F})", lente=38, fstop=3.2)
c.renderizar()
