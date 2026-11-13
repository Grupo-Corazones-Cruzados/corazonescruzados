"""PRUEBA DE PERSONAJE DE BLOQUES (Fernando, 2026-11-13: «te acuerdas de… hacer los personajes de las imágenes…
intenta hacer 5 segundos de video y me lo muestras, a ver qué tal animas»).

Estilo propio del cuento (no copia de ningún juego ni canal): todo de bloques, como cartón pintado. EL NIÑO:
sudadera violeta con el corazón de la casa en el pecho, pelo negro de bloques, ojos, cejas y boca de bloque
que cambian de expresión. Va al ritmo de las dos primeras frases de la narración (`public/libro/voz/sueno.mp3`):
  0,0–2,7 s «Había una vez un niño que soñaba»: la cámara se acerca; mira las estrellas por la ventana y parpadea.
  2,7–6,7 s «…al que le encantaba soñar»: apoya la cara en las manos, levanta las cejas y sonríe.

  blender -b -P prueba-nino.py -- --salida <dir> [--solo 3.0] [--ancho 1280 --alto 720] [--muestras 48]
"""
import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Vector

a = argparse.ArgumentParser()
a.add_argument("--salida", required=True)
a.add_argument("--solo", type=float, default=None)
a.add_argument("--ancho", type=int, default=1280)
a.add_argument("--alto", type=int, default=720)
a.add_argument("--muestras", type=int, default=48)
p = a.parse_args(sys.argv[sys.argv.index("--") + 1:])

FPS = 24
DUR = 6.7
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../public/logo-gcc-512.png")

bpy.ops.wm.read_factory_settings(use_empty=True)
E = bpy.context.scene
R = E.render
R.engine = "BLENDER_EEVEE"
R.resolution_x, R.resolution_y, R.resolution_percentage = p.ancho, p.alto, 100
R.fps = FPS
E.frame_start, E.frame_end = 1, round(DUR * FPS)
E.eevee.taa_render_samples = p.muestras
for prop in ("use_raytracing", "use_shadows", "use_gtao"):
    if hasattr(E.eevee, prop):
        setattr(E.eevee, prop, True)
E.view_settings.view_transform = "AgX"
E.view_settings.look = "AgX - Medium High Contrast"
R.image_settings.file_format = "PNG"
R.use_motion_blur = True
R.motion_blur_shutter = 0.35


def f(t):
    return round(t * FPS) + 1


# ── Materiales: cartón pintado mate, con un grano leve ──
def carton(nombre, color, rugoso=0.85, brillo=0.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    t = m.node_tree
    b = t.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rugoso
    ruido = t.nodes.new("ShaderNodeTexNoise")
    ruido.inputs["Scale"].default_value = 180
    relieve = t.nodes.new("ShaderNodeBump")
    relieve.inputs["Strength"].default_value = 0.06
    t.links.new(ruido.outputs["Fac"], relieve.inputs["Height"])
    t.links.new(relieve.outputs["Normal"], b.inputs["Normal"])
    if brillo:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = brillo
    return m


def bloque(nombre, pos, tam, mat, padre=None, bisel=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.active_object
    o.name = nombre
    o.scale = tam
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bisel:
        bv = o.modifiers.new("bisel", "BEVEL")
        bv.width, bv.segments = bisel, 2
    o.data.materials.append(mat)
    if padre:
        o.parent = padre
        o.matrix_parent_inverse = padre.matrix_world.inverted()
    return o


def vacio(nombre, pos, padre=None):
    o = bpy.data.objects.new(nombre, None)
    E.collection.objects.link(o)
    o.location = pos
    if padre:
        o.parent = padre
        o.matrix_parent_inverse = padre.matrix_world.inverted()
    return o


def clave(o, prop, t, valor, interp="BEZIER"):
    setattr(o, prop, valor)
    o.keyframe_insert(prop, frame=f(t))


# Colores del cuento
VIOLETA = (0.20, 0.07, 0.62)
PIEL = (0.62, 0.38, 0.24)
PELO = (0.025, 0.02, 0.03)
GRIS = (0.30, 0.30, 0.34)
BLANCO = (0.9, 0.88, 0.85)
NEGRO = (0.02, 0.02, 0.025)
MADERA = (0.36, 0.2, 0.1)
PARED = (0.16, 0.12, 0.26)
SUELO = (0.22, 0.13, 0.07)

m_pared, m_suelo, m_madera = carton("Pared", PARED), carton("Suelo", SUELO), carton("Madera", MADERA)
m_violeta, m_piel, m_pelo = carton("Sudadera", VIOLETA), carton("Piel", PIEL, 0.7), carton("Pelo", PELO, 0.6)
m_gris, m_blanco, m_negro = carton("Pantalon", GRIS), carton("Blanco", BLANCO, 0.5), carton("Negro", NEGRO, 0.4)
m_mejilla = carton("Mejilla", (0.75, 0.32, 0.35), 0.8)
m_estrella = carton("Estrella", (1.0, 0.92, 0.7), 0.5, brillo=6)
m_llama = carton("Llama", (1.0, 0.62, 0.25), 0.5, brillo=12)
m_cielo = bpy.data.materials.new("Cielo")
m_cielo.use_nodes = True
cb = m_cielo.node_tree.nodes["Principled BSDF"]
cb.inputs["Base Color"].default_value = (0.02, 0.02, 0.07, 1)
cb.inputs["Emission Color"].default_value = (0.05, 0.04, 0.16, 1)
cb.inputs["Emission Strength"].default_value = 1.0

# ── El cuarto de bloques ──
bloque("Suelo", (0, 0, -0.05), (6, 5, 0.1), m_suelo, bisel=0)
# Pared del fondo con una ventana (x de -0.1 a 1.1, z de 0.95 a 1.85)
bloque("ParedIzq", (-1.9, 1.2, 1.5), (3.6, 0.2, 3.0), m_pared, bisel=0)
bloque("ParedDer", (2.6, 1.2, 1.5), (3.0, 0.2, 3.0), m_pared, bisel=0)
bloque("ParedAbajo", (0.5, 1.2, 0.475), (1.2, 0.2, 0.95), m_pared, bisel=0)
bloque("ParedArriba", (0.5, 1.2, 2.425), (1.2, 0.2, 1.15), m_pared, bisel=0)
for n, c, s in (("MarcoA", (0.5, 1.08, 1.87), (1.3, 0.12, 0.08)), ("MarcoB", (0.5, 1.05, 0.93), (1.36, 0.22, 0.08)),
                ("MarcoI", (-0.12, 1.08, 1.4), (0.08, 0.12, 1.0)), ("MarcoD", (1.12, 1.08, 1.4), (0.08, 0.12, 1.0)),
                ("Cruz2", (0.5, 1.1, 1.72), (1.2, 0.06, 0.04))):
    bloque(n, c, s, m_madera)
# El cielo de noche tras la ventana, con estrellas de bloque que titilan
bloque("ParedFondo", (0.5, -1.1, 1.5), (6, 0.2, 3.0), m_pared, bisel=0)
bloque("Repisa", (-0.4, -0.95, 1.5), (0.8, 0.12, 0.04), m_madera)
bloque("CamaBase", (1.6, -0.55, 0.22), (0.9, 1.0, 0.3), carton("Cama", (0.12, 0.1, 0.3)))
bloque("Almohada", (1.6, -0.9, 0.43), (0.5, 0.2, 0.1), m_blanco)
random.seed(5)
estrellas = []
for i in range(26):
    x, z = random.uniform(-0.6, 1.6), random.uniform(0.9, 2.3)
    s = random.uniform(0.018, 0.04)
    e = bloque(f"Estrella{i}", (x, random.uniform(1.3, 1.75), z), (s * 0.6, s * 0.6, s * 0.6), m_estrella, bisel=0)
    e.rotation_euler = (0, math.radians(45), 0)
    estrellas.append(e)
    fase = random.random() * 2 * math.pi
    for k in range(0, 8):
        t = k * DUR / 7
        esc = 0.6 + 0.4 * (0.5 + 0.5 * math.sin(fase + k * 1.7))
        e.scale = (esc, esc, esc)
        e.keyframe_insert("scale", frame=f(t))

# El pupitre y el farol de bloques
bloque("Tapa", (0.35, 0.62, 0.74), (1.1, 0.6, 0.06), m_madera)
for dx in (-0.15, 0.85):
    for dy in (0.38, 0.86):
        bloque("Pata", (dx, dy, 0.355), (0.06, 0.06, 0.71), m_madera)
bloque("Silla", (0.35, 0.05, 0.42), (0.42, 0.4, 0.06), m_madera)
bloque("Respaldo", (0.35, -0.13, 0.7), (0.42, 0.05, 0.5), m_madera)
for dx in (0.17, 0.53):
    for dy in (-0.11, 0.21):
        bloque("PataS", (dx, dy, 0.2), (0.05, 0.05, 0.4), m_madera)
farol = vacio("Farol", (0.82, 0.72, 0.77))
bloque("FarolBase", (0.82, 0.72, 0.79), (0.13, 0.13, 0.03), m_negro, farol)
bloque("FarolLlama", (0.82, 0.72, 0.87), (0.07, 0.07, 0.11), m_llama, farol)
bloque("FarolTecho", (0.82, 0.72, 0.95), (0.14, 0.14, 0.03), m_negro, farol)
for i, (dx, dy) in enumerate(((-0.06, -0.06), (0.06, -0.06), (-0.06, 0.06), (0.06, 0.06))):
    bloque(f"FarolVar{i}", (0.82 + dx, 0.72 + dy, 0.87), (0.012, 0.012, 0.16), m_negro, farol)
bloque("Libro1", (-0.05, 0.75, 0.8), (0.24, 0.17, 0.05), carton("Libro1", (0.55, 0.12, 0.12)))
bloque("Libro2", (-0.04, 0.74, 0.845), (0.22, 0.16, 0.04), carton("Libro2", (0.1, 0.3, 0.5)))

# ── EL NIÑO (sentado en la silla, mirando a la ventana) ──
nino = vacio("Nino", (0.35, 0.1, 0.45))
cadera = vacio("Cadera", (0.35, 0.1, 0.47), nino)
bloque("Muslos", (0.35, 0.22, 0.5), (0.3, 0.32, 0.13), m_gris, cadera)
for dx in (0.27, 0.43):
    bloque("Pierna", (dx, 0.36, 0.28), (0.12, 0.12, 0.38), m_gris, cadera)
    bloque("Zapato", (dx, 0.39, 0.06), (0.13, 0.2, 0.08), m_blanco, cadera)
torso = vacio("Torso", (0.35, 0.1, 0.56), cadera)
bloque("Tronco", (0.35, 0.1, 0.76), (0.34, 0.2, 0.4), m_violeta, torso)
# El corazón de la casa en el pecho
emb = bpy.data.materials.new("Emblema")
emb.use_nodes = True
et = emb.node_tree
eb = et.nodes["Principled BSDF"]
ei = et.nodes.new("ShaderNodeTexImage")
ei.image = bpy.data.images.load(os.path.abspath(LOGO))
et.links.new(ei.outputs["Color"], eb.inputs["Base Color"])
eb.inputs["Roughness"].default_value = 0.6
bpy.ops.mesh.primitive_plane_add(size=0.1, location=(0.42, 0.205, 0.84), rotation=(math.pi / 2, 0, 0))
pecho = bpy.context.active_object
pecho.data.materials.append(emb)
pecho.parent = torso
pecho.matrix_parent_inverse = torso.matrix_world.inverted()


def brazo(lado):
    x = 0.35 + lado * 0.215
    hombro = vacio(f"Hombro{lado}", (x, 0.1, 0.93), torso)
    bloque(f"Brazo{lado}", (x, 0.1, 0.78), (0.1, 0.12, 0.3), m_violeta, hombro)
    bloque(f"Mano{lado}", (x, 0.1, 0.6), (0.09, 0.1, 0.08), m_piel, hombro)
    return hombro


hombro_i, hombro_d = brazo(-1), brazo(1)
cuello = vacio("Cuello", (0.35, 0.1, 0.97), torso)
cabeza = vacio("Cabeza", (0.35, 0.1, 0.97), cuello)
bloque("CabezaB", (0.35, 0.1, 1.16), (0.36, 0.34, 0.36), m_piel, cabeza, bisel=0.02)
# Pelo de bloques despeinado
for i, (dx, dy, dz, sx, sy, sz) in enumerate((
    (0, -0.02, 1.36, 0.4, 0.38, 0.07), (-0.13, 0.0, 1.31, 0.12, 0.36, 0.1), (0.14, 0.0, 1.31, 0.12, 0.36, 0.1),
    (0, -0.17, 1.2, 0.4, 0.06, 0.28), (-0.06, 0.12, 1.33, 0.22, 0.12, 0.08), (0.08, 0.16, 1.32, 0.12, 0.06, 0.07),
)):
    bloque(f"Pelo{i}", (0.35 + dx, 0.1 + dy, dz), (sx, sy, sz), m_pelo, cabeza)
# La cara mira hacia +y (la ventana); la cámara la ve de tres cuartos.
Y_CARA = 0.1 + 0.172
ojos = []
for lado in (-1, 1):
    x = 0.35 + lado * 0.085
    blanco = bloque(f"Ojo{lado}", (x, Y_CARA, 1.17), (0.085, 0.012, 0.085), m_blanco, cabeza, bisel=0.004)
    pupila = bloque(f"Pupila{lado}", (x + 0.012, Y_CARA + 0.008, 1.18), (0.045, 0.01, 0.055), m_negro, cabeza, bisel=0.002)
    brillo = bloque(f"Brillo{lado}", (x + 0.025, Y_CARA + 0.014, 1.195), (0.014, 0.006, 0.014), carton(f"Brillo{lado}", (1, 1, 1), 0.3, brillo=2), cabeza, bisel=0)
    ceja = bloque(f"Ceja{lado}", (x, Y_CARA + 0.004, 1.245), (0.1, 0.016, 0.025), m_pelo, cabeza, bisel=0.003)
    mejilla = bloque(f"Mejilla{lado}", (x + lado * 0.02, Y_CARA - 0.001, 1.1), (0.06, 0.008, 0.025), m_mejilla, cabeza, bisel=0)
    ojos.append((blanco, pupila, brillo, ceja))
boca = bloque("Boca", (0.35, Y_CARA + 0.002, 1.065), (0.1, 0.012, 0.022), m_negro, cabeza, bisel=0.003)
comisuras = [bloque(f"Comisura{l}", (0.35 + l * 0.058, Y_CARA + 0.002, 1.08), (0.02, 0.012, 0.03), m_negro, cabeza, bisel=0.002) for l in (-1, 1)]
for c in comisuras:
    c.scale = (1, 1, 0.01)

# ── LA ANIMACIÓN ──
# Base: sentado, girado hacia la ventana (de tres cuartos a cámara), mirando arriba a las estrellas.
nino.rotation_euler = (0, 0, math.radians(-10))
clave(nino, "rotation_euler", 0, (0, 0, math.radians(-10)))
clave(nino, "rotation_euler", DUR, (0, 0, math.radians(-8)))
# Respira
for k in range(6):
    t = k * DUR / 5
    torso.scale = (1, 1, 1 + (0.012 if k % 2 else 0))
    torso.keyframe_insert("scale", frame=f(t))
# La cabeza: mira arriba a las estrellas, ladea con curiosidad
clave(cuello, "rotation_euler", 0.0, (math.radians(16), 0, math.radians(6)))
clave(cuello, "rotation_euler", 1.4, (math.radians(20), math.radians(-6), math.radians(2)))
clave(cuello, "rotation_euler", 2.6, (math.radians(18), 0, math.radians(4)))
# 2,7 s: apoya la cara en las manos (baja un poco la cabeza, sigue mirando arriba) y la gira hacia nosotros
clave(cuello, "rotation_euler", 3.3, (math.radians(4), math.radians(6), math.radians(-4)))
clave(cuello, "rotation_euler", DUR, (math.radians(6), math.radians(8), math.radians(-6)))
clave(torso, "rotation_euler", 2.6, (0, 0, 0))
clave(torso, "rotation_euler", 3.3, (math.radians(-9), 0, 0))
clave(torso, "rotation_euler", DUR, (math.radians(-10), 0, 0))
for h, lado in ((hombro_i, -1), (hombro_d, 1)):
    clave(h, "rotation_euler", 0.0, (math.radians(35), 0, 0))
    clave(h, "rotation_euler", 2.7, (math.radians(38), 0, 0))
    clave(h, "rotation_euler", 3.3, (math.radians(102), 0, math.radians(lado * 20)))
    clave(h, "rotation_euler", DUR, (math.radians(104), 0, math.radians(lado * 21)))
# Parpadeos: a los 1,2 s y a los 4,4 s
for blanco, pupila, brillo, ceja in ojos:
    for o in (blanco, pupila, brillo):
        for t, sz in ((0, 1), (1.1, 1), (1.18, 0.08), (1.28, 1), (4.3, 1), (4.38, 0.08), (4.48, 1)):
            o.scale = (1, 1, sz)
            o.keyframe_insert("scale", frame=f(t))
    # Las pupilas miran arriba y, al final, hacia la cámara
    z0 = pupila.location.z
    clave(pupila, "location", 0, (pupila.location.x, pupila.location.y, z0 + 0.012))
    clave(pupila, "location", 3.2, (pupila.location.x, pupila.location.y, z0 + 0.012))
    clave(pupila, "location", 3.6, (pupila.location.x - 0.012, pupila.location.y, z0))
    # Cejas: neutras y, con «le encantaba soñar», se levantan contentas
    zc = ceja.location.z
    clave(ceja, "location", 2.8, (ceja.location.x, ceja.location.y, zc))
    clave(ceja, "location", 3.2, (ceja.location.x, ceja.location.y, zc + 0.014))
    clave(ceja, "location", DUR, (ceja.location.x, ceja.location.y, zc + 0.015))
# La boca: de pequeña a sonrisa (la barra se ensancha y las comisuras suben)
clave(boca, "scale", 0, (0.7, 1, 1))
clave(boca, "scale", 2.9, (0.7, 1, 1))
clave(boca, "scale", 3.4, (1.25, 1, 1))
clave(boca, "scale", DUR, (1.3, 1, 1))
for c in comisuras:
    clave(c, "scale", 2.9, (1, 1, 0.01))
    clave(c, "scale", 3.4, (1, 1, 1))
    clave(c, "scale", DUR, (1, 1, 1))

# ── La luz: el farol cálido que parpadea, la luna violeta y un relleno suave ──
ll = bpy.data.lights.new("Farol", "POINT")
ll.color = (1.0, 0.6, 0.28)
ll.shadow_soft_size = 0.05
ol = bpy.data.objects.new("Farol", ll)
E.collection.objects.link(ol)
ol.location = (0.82, 0.72, 0.9)
for k in range(0, 23):
    t = k * DUR / 22
    ll.energy = 55 + 10 * math.sin(k * 2.3) + 5 * math.sin(k * 5.1)
    ll.keyframe_insert("energy", frame=f(t))
luna = bpy.data.lights.new("Luna", "AREA")
luna.size, luna.size_y, luna.shape = 1.2, 0.9, "RECTANGLE"
luna.energy, luna.color = 90, (0.55, 0.5, 1.0)
oln = bpy.data.objects.new("Luna", luna)
E.collection.objects.link(oln)
oln.location = (0.2, 1.9, 2.0)
oln.rotation_euler = (math.radians(70), 0, math.radians(180))
rel = bpy.data.lights.new("Relleno", "AREA")
rel.size, rel.energy, rel.color = 3, 22, (0.6, 0.55, 0.95)
orl = bpy.data.objects.new("Relleno", rel)
E.collection.objects.link(orl)
orl.location = (1.8, 2.4, 2.2)
orl.rotation_euler = (math.radians(60), 0, math.radians(140))
mundo = bpy.data.worlds.new("Mundo")
mundo.use_nodes = True
mundo.node_tree.nodes["Background"].inputs[0].default_value = (0.01, 0.008, 0.025, 1)
E.world = mundo

# ── La cámara: entra despacio hacia el niño (2,7 s) y luego se queda cerca, en su cara ──
cd = bpy.data.cameras.new("Camara")
cd.lens = 35
cd.dof.use_dof = True
cd.dof.aperture_fstop = 2.8
cam = bpy.data.objects.new("Camara", cd)
E.collection.objects.link(cam)
E.camera = cam
foco = vacio("Foco", (0.4, 0.2, 1.05))
cd.dof.focus_object = foco
pista = cam.constraints.new("TRACK_TO")
pista.target = foco
pista.track_axis, pista.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
# Desde fuera, a través de la ventana: el marco encuadra al niño, que mira las estrellas hacia nosotros.
clave(cam, "location", 0.0, (0.75, 2.35, 1.62))
clave(cam, "location", 2.7, (0.58, 1.95, 1.5))
clave(cam, "location", DUR, (0.5, 1.72, 1.42))
clave(foco, "location", 0.0, (0.4, 0.3, 1.1))
clave(foco, "location", 2.7, (0.38, 0.28, 1.12))
clave(foco, "location", DUR, (0.36, 0.28, 1.12))

if p.solo is not None:
    E.frame_set(f(p.solo))
    R.filepath = os.path.join(p.salida, "solo.png")
    bpy.ops.render.render(write_still=True)
else:
    R.filepath = os.path.join(p.salida, "f_")
    bpy.ops.render.render(animation=True)
