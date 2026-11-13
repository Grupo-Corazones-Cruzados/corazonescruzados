"""DEMOSTRACIÓN con modelos reales (Fernando, 2026-11-12: «las esferas y líneas… está feo… el Blender MCP aunque
tarde más es mucho mejor, me gustaría ver un resultado que puedas demostrar»).

«Había una vez un niño que soñaba»: el rincón del niño de noche. Mesa de madera con libros, un farol encendido
que parpadea, un reloj y una planta; detrás, una ventana con el cielo estrellado (HDRI real de Poly Haven) y
un cuadro con el logo de la casa. Modelos, texturas y cielo de Poly Haven (CC0, uso comercial libre),
descargados en ~/Library/Caches/gcc-polyhaven. EN BUCLE de 8 s: la cámara se acerca y se aleja con una
curva seno, el farol parpadea y las motas de polvo flotan con funciones periódicas de la fase.

  blender -b -P libro-sueno-real.py -- --salida <dir> [--solo 2.0] [--ancho 1920 --alto 1080] [--muestras 64]
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
a.add_argument("--fps", type=int, default=24)
p = a.parse_args(sys.argv[sys.argv.index("--") + 1:])

CACHE = os.path.expanduser("~/Library/Caches/gcc-polyhaven")
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../public/logo-gcc-512.png")
DURACION = 8.0
CIELO_X = float(os.environ.get("CIELO_X", "35"))
CIELO_Z = float(os.environ.get("CIELO_Z", "200"))
LIBROS_ROT = float(os.environ.get("LIBROS_ROT", "0"))
CUADROS = round(DURACION * p.fps)
FASE = f"fmod((frame-1)/{CUADROS},1)"

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
r = esc.render
r.engine = "BLENDER_EEVEE"
r.resolution_x, r.resolution_y, r.resolution_percentage = p.ancho, p.alto, 100
r.fps = p.fps
esc.frame_start, esc.frame_end = 1, CUADROS
esc.eevee.taa_render_samples = p.muestras
for prop, valor in (("use_raytracing", True), ("use_shadows", True), ("use_gtao", True), ("use_bloom", True)):
    if hasattr(esc.eevee, prop):
        setattr(esc.eevee, prop, valor)
if hasattr(esc.eevee, "ray_tracing_options"):
    esc.eevee.ray_tracing_options.resolution_scale = "1"
esc.view_settings.view_transform = "AgX"
esc.view_settings.look = "AgX - Medium High Contrast"
r.image_settings.file_format = "PNG"
r.film_transparent = False


def conducir(dueno, prop, expr, indice=-1):
    f = dueno.driver_add(prop, indice) if indice >= 0 else dueno.driver_add(prop)
    for fc in (f if isinstance(f, list) else [f]):
        fc.driver.type = "SCRIPTED"
        fc.driver.expression = expr


def util(nombre_obj, solo):
    """Los .blend traen piezas que no son el objeto: la esfera de vista previa («stash») y los controles del rig («wdg_»)."""
    if "stash" in nombre_obj.lower() or nombre_obj.startswith("wdg_"):
        return False
    return not solo or any(nombre_obj.endswith(x) for x in solo)


def anexar(nombre, solo=None):
    """Trae los objetos útiles del .blend de Poly Haven y los cuelga de un vacío para moverlos juntos."""
    ruta = os.path.join(CACHE, "models", nombre, f"{nombre}_1k.blend")
    with bpy.data.libraries.load(ruta, link=False) as (desde, hacia):
        hacia.objects = [n for n in desde.objects if util(n, solo)]
    raiz = bpy.data.objects.new(nombre, None)
    esc.collection.objects.link(raiz)
    objs = [o for o in hacia.objects if o is not None]
    for o in objs:
        esc.collection.objects.link(o)
        if o.parent is None:
            o.parent = raiz
    bpy.context.view_layer.update()
    return raiz, objs


def caja_de(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    mn = Vector((min(v.x for v in pts), min(v.y for v in pts), min(v.z for v in pts)))
    mx = Vector((max(v.x for v in pts), max(v.y for v in pts), max(v.z for v in pts)))
    return mn, mx


def colocar(nombre, x, y, z_suelo, rot=0.0, escala=1.0, solo=None, juntar=False):
    raiz, objs = anexar(nombre, solo)
    if juntar:
        # Del juego de libros solo vienen algunos: se ponen uno junto a otro, sin los huecos de los que faltan.
        libros = sorted([o for o in objs if o.type == "MESH"], key=lambda o: o.location.x)
        x0 = libros[0].location.x
        for o in libros:
            ancho = o.dimensions.x
            o.location.x = x0 + ancho / 2
            x0 += ancho + 0.002
    raiz.scale = (escala, escala, escala)
    raiz.rotation_euler = (0, 0, rot)
    bpy.context.view_layer.update()
    mn, mx = caja_de(objs)
    centro = (mn + mx) / 2
    raiz.location = (x - centro.x, y - centro.y, z_suelo - mn.z)
    bpy.context.view_layer.update()
    return raiz, objs


def material_textura(nombre, carpeta, escala=1.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    t = m.node_tree
    bsdf = t.nodes["Principled BSDF"]
    coord = t.nodes.new("ShaderNodeTexCoord")
    mapeo = t.nodes.new("ShaderNodeMapping")
    mapeo.inputs["Scale"].default_value = (escala, escala, escala)
    t.links.new(coord.outputs["Object"], mapeo.inputs["Vector"])

    def imagen(archivo, color=True):
        n = t.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(CACHE, "textures", carpeta, archivo))
        if not color:
            n.image.colorspace_settings.name = "Non-Color"
        n.projection = "BOX"
        n.projection_blend = 0.2
        t.links.new(mapeo.outputs["Vector"], n.inputs["Vector"])
        return n

    t.links.new(imagen("Diffuse.jpg").outputs["Color"], bsdf.inputs["Base Color"])
    t.links.new(imagen("Rough.jpg", False).outputs["Color"], bsdf.inputs["Roughness"])
    nor = t.nodes.new("ShaderNodeNormalMap")
    t.links.new(imagen("nor_gl.jpg", False).outputs["Color"], nor.inputs["Color"])
    t.links.new(nor.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def caja(nombre, centro, medidas, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centro)
    o = bpy.context.active_object
    o.name = nombre
    o.scale = medidas
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(mat)
    return o


# ── El cielo: estrellas reales por la ventana; dentro, apenas ilumina ──
mundo = bpy.data.worlds.new("Noche")
mundo.use_nodes = True
t = mundo.node_tree
t.nodes.clear()
sal = t.nodes.new("ShaderNodeOutputWorld")
hdr = t.nodes.new("ShaderNodeTexEnvironment")
hdr.image = bpy.data.images.load(os.path.join(CACHE, "hdris", "dikhololo_night.hdr"))
coordm = t.nodes.new("ShaderNodeTexCoord")
mapm = t.nodes.new("ShaderNodeMapping")
mapm.inputs["Rotation"].default_value = (math.radians(CIELO_X), 0, math.radians(CIELO_Z))
t.links.new(coordm.outputs["Generated"], mapm.inputs["Vector"])
t.links.new(mapm.outputs["Vector"], hdr.inputs["Vector"])
fondo_cam = t.nodes.new("ShaderNodeBackground")
fondo_cam.inputs["Strength"].default_value = 1.1
fondo_luz = t.nodes.new("ShaderNodeBackground")
fondo_luz.inputs["Strength"].default_value = 0.25
# El cielo por la ventana, más oscuro y hacia el violeta de la casa.
tinte = t.nodes.new("ShaderNodeMix")
tinte.data_type = "RGBA"
tinte.blend_type = "MULTIPLY"
tinte.inputs["Factor"].default_value = 1.0
tinte.inputs[7].default_value = (0.42, 0.36, 0.78, 1)
t.links.new(hdr.outputs["Color"], tinte.inputs[6])
t.links.new(tinte.outputs[2], fondo_cam.inputs["Color"])
t.links.new(hdr.outputs["Color"], fondo_luz.inputs["Color"])
camino = t.nodes.new("ShaderNodeLightPath")
mezcla = t.nodes.new("ShaderNodeMixShader")
t.links.new(camino.outputs["Is Camera Ray"], mezcla.inputs["Fac"])
t.links.new(fondo_luz.outputs[0], mezcla.inputs[1])
t.links.new(fondo_cam.outputs[0], mezcla.inputs[2])
t.links.new(mezcla.outputs[0], sal.inputs["Surface"])
esc.world = mundo

# ── La habitación: pared de yeso con su ventana y suelo de madera ──
yeso = material_textura("Yeso", "plastered_wall_04", 0.6)
madera = material_textura("Madera", "dark_wooden_planks", 0.8)
Y_PARED = 1.2
ventana = (-0.15, 1.05, 1.15, 1.0)  # x centro, z centro, ancho, alto (m)
vx, vz, vw, vh = ventana
for nombre, cx, cz, w, h in (
    ("ParedIzq", (vx - vw / 2 - 2.5 / 2), 1.5, 2.5, 3.0),
    ("ParedDer", (vx + vw / 2 + 2.5 / 2), 1.5, 2.5, 3.0),
    ("ParedAbajo", vx, (vz - vh / 2) / 2, vw, vz - vh / 2),
    ("ParedArriba", vx, (vz + vh / 2 + 3.0) / 2, vw, 3.0 - (vz + vh / 2)),
):
    caja(nombre, (cx, Y_PARED, cz), (w, 0.15, h), yeso)
caja("Suelo", (0, 0, -0.025), (6, 4, 0.05), madera)
# El marco y el parteluz de la ventana.
for nombre, c, m in (
    ("MarcoArriba", (vx, Y_PARED - 0.04, vz + vh / 2), (vw + 0.1, 0.12, 0.06)),
    ("MarcoAbajo", (vx, Y_PARED - 0.07, vz - vh / 2), (vw + 0.16, 0.2, 0.06)),
    ("MarcoIzq", (vx - vw / 2, Y_PARED - 0.04, vz), (0.06, 0.12, vh)),
    ("MarcoDer", (vx + vw / 2, Y_PARED - 0.04, vz), (0.06, 0.12, vh)),
    ("Parteluz", (vx, Y_PARED - 0.03, vz), (0.035, 0.08, vh)),
    ("Travesano", (vx, Y_PARED - 0.03, vz + 0.08), (vw, 0.08, 0.035)),
):
    caja(nombre, c, m, madera)

# El cuadro con el logo de la casa, en la pared.
lienzo = bpy.data.materials.new("Logo")
lienzo.use_nodes = True
lt = lienzo.node_tree
lb = lt.nodes["Principled BSDF"]
li = lt.nodes.new("ShaderNodeTexImage")
li.image = bpy.data.images.load(os.path.abspath(LOGO))
lt.links.new(li.outputs["Color"], lb.inputs["Base Color"])
lb.inputs["Roughness"].default_value = 0.6
lb.inputs["Coat Weight"].default_value = 0.3
caja("MarcoCuadro", (0.78, Y_PARED - 0.085, 1.22), (0.3, 0.03, 0.3), madera)
bpy.ops.mesh.primitive_plane_add(size=0.24, location=(0.78, Y_PARED - 0.102, 1.22), rotation=(math.pi / 2, 0, 0))
cuadro = bpy.context.active_object
cuadro.data.materials.append(lienzo)

# ── Los muebles y objetos (Poly Haven) ──
_, mesa = colocar("SchoolDesk_01", 0.0, 0.7, 0.0)
mn, mx = caja_de(mesa)
TAPA = mx.z
LIBROS = ("book01", "book04", "book07", "book09", "book13", "book17")
colocar("book_encyclopedia_set_01", -0.2, 0.82, TAPA, rot=math.radians(LIBROS_ROT), solo=LIBROS, juntar=True)
farol, _ = colocar("Lantern_01", 0.13, 0.72, TAPA, rot=math.radians(20))
colocar("alarm_clock_01", 0.27, 0.58, TAPA, rot=math.radians(-28))
colocar("potted_plant_02", 0.78, 0.85, 0.0, rot=math.radians(40), escala=1.25)

# ── Las luces: el farol cálido que parpadea y la luna violeta por la ventana ──
fl = bpy.data.lights.new("Llama", "POINT")
fl.color = (1.0, 0.62, 0.3)
fl.shadow_soft_size = 0.03
llama = bpy.data.objects.new("Llama", fl)
esc.collection.objects.link(llama)
bpy.context.view_layer.update()
mnf, mxf = caja_de([o for o in esc.objects if o.parent == farol])
llama.location = ((mnf.x + mxf.x) / 2, (mnf.y + mxf.y) / 2, mnf.z + (mxf.z - mnf.z) * 0.45)
conducir(fl, "energy", f"38 + 5*sin(2*pi*7*{FASE}) + 3*sin(2*pi*13*{FASE}+1.3) + 2*sin(2*pi*29*{FASE}+0.4)")

luna = bpy.data.lights.new("Luna", "AREA")
luna.shape = "RECTANGLE"
luna.size, luna.size_y = vw, vh
luna.energy = 45
luna.color = (0.62, 0.55, 1.0)
ol = bpy.data.objects.new("Luna", luna)
esc.collection.objects.link(ol)
ol.location = (vx, Y_PARED + 0.25, vz)
ol.rotation_euler = (math.radians(90), 0, math.radians(180))

relleno = bpy.data.lights.new("Relleno", "AREA")
relleno.size = 3
relleno.energy = 18
relleno.color = (0.55, 0.5, 0.9)
orr = bpy.data.objects.new("Relleno", relleno)
esc.collection.objects.link(orr)
orr.location = (-1.6, -2.2, 1.9)
orr.rotation_euler = (math.radians(60), 0, math.radians(-35))

# ── Motas de polvo en la luz del farol ──
random.seed(3)
mota = bpy.data.materials.new("Mota")
mota.use_nodes = True
mt = mota.node_tree
mt.nodes.clear()
me = mt.nodes.new("ShaderNodeEmission")
me.inputs["Color"].default_value = (1.0, 0.8, 0.55, 1)
me.inputs["Strength"].default_value = 2.5
mt.links.new(me.outputs[0], mt.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
for i in range(16):
    base = Vector((random.uniform(-0.35, 0.45), random.uniform(0.45, 0.95), TAPA + random.uniform(0.08, 0.6)))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0012, 0.0025), location=base, segments=8, ring_count=6)
    o = bpy.context.active_object
    o.data.materials.append(mota)
    k = random.choice((1, 2))
    d = random.random()
    conducir(o, "location", f"{base.x}+0.04*sin(2*pi*({k}*{FASE}+{d}))", 0)
    conducir(o, "location", f"{base.z}+0.05*sin(2*pi*({FASE}+{d}))", 2)

# ── La cámara: a la altura de un niño; se acerca y se aleja despacio (seno: empalma) ──
cd = bpy.data.cameras.new("Camara")
cd.lens = 32
cd.dof.use_dof = True
cd.dof.aperture_fstop = 4.0
cam = bpy.data.objects.new("Camara", cd)
esc.collection.objects.link(cam)
esc.camera = cam
foco = bpy.data.objects.new("Foco", None)
esc.collection.objects.link(foco)
foco.location = (0.0, 0.72, TAPA + 0.14)
cd.dof.focus_object = foco
pista = cam.constraints.new("TRACK_TO")
pista.target = foco
pista.track_axis, pista.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
conducir(cam, "location", f"0.18-0.14*sin(2*pi*{FASE})", 0)
conducir(cam, "location", f"-0.75+0.18*(0.5-0.5*cos(2*pi*{FASE}))", 1)
conducir(cam, "location", f"{TAPA + 0.32}+0.03*sin(2*pi*{FASE})", 2)

if p.solo is not None:
    esc.frame_set(round(p.solo * p.fps) + 1)
    r.filepath = os.path.join(p.salida, "solo.png")
    bpy.ops.render.render(write_still=True)
else:
    r.filepath = os.path.join(p.salida, "f_")
    bpy.ops.render.render(animation=True)
