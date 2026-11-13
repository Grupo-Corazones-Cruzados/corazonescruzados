"""Piezas comunes de las ESCENAS REALES del cuento (2026-11-12): modelos, texturas y cielos de Poly Haven (CC0)
en Blender con EEVEE y trazado de rayos. Cada escena se escribe en su archivo y usa estas funciones.
Todo lo que se mueve es función de la FASE (0→1 en la vuelta) con drivers: el video empalma en bucle.
Recursos en ~/Library/Caches/gcc-polyhaven (los descarga `polyhaven.py`)."""
import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Vector

CACHE = os.path.expanduser("~/Library/Caches/gcc-polyhaven")
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../public/logo-gcc-512.png")
P = None
FASE = ""


def preparar(duracion=8.0):
    """Lee los argumentos, deja la escena vacía y configura el render. Devuelve los argumentos."""
    global P, FASE
    a = argparse.ArgumentParser()
    a.add_argument("--salida", required=True)
    a.add_argument("--solo", type=float, default=None)
    a.add_argument("--ancho", type=int, default=1280)
    a.add_argument("--alto", type=int, default=720)
    a.add_argument("--muestras", type=int, default=48)
    a.add_argument("--fps", type=int, default=24)
    P = a.parse_args(sys.argv[sys.argv.index("--") + 1:])
    cuadros = round(duracion * P.fps)
    FASE = f"fmod((frame-1)/{cuadros},1)"
    bpy.ops.wm.read_factory_settings(use_empty=True)
    e = bpy.context.scene
    r = e.render
    r.engine = "BLENDER_EEVEE"
    r.resolution_x, r.resolution_y, r.resolution_percentage = P.ancho, P.alto, 100
    r.fps = P.fps
    e.frame_start, e.frame_end = 1, cuadros
    e.eevee.taa_render_samples = P.muestras
    for prop in ("use_raytracing", "use_shadows", "use_gtao"):
        if hasattr(e.eevee, prop):
            setattr(e.eevee, prop, True)
    e.view_settings.view_transform = "AgX"
    e.view_settings.look = "AgX - Medium High Contrast"
    r.image_settings.file_format = "PNG"
    return P


def renderizar():
    e = bpy.context.scene
    if P.solo is not None:
        e.frame_set(round(P.solo * P.fps) + 1)
        e.render.filepath = os.path.join(P.salida, "solo.png")
        bpy.ops.render.render(write_still=True)
    else:
        e.render.filepath = os.path.join(P.salida, "f_")
        bpy.ops.render.render(animation=True)


def conducir(dueno, prop, expr, indice=-1):
    f = dueno.driver_add(prop, indice) if indice >= 0 else dueno.driver_add(prop)
    for fc in (f if isinstance(f, list) else [f]):
        fc.driver.type = "SCRIPTED"
        fc.driver.expression = expr


def util(nombre_obj, solo):
    """Los .blend traen la esfera de vista previa («stash») y los controles del rig («wdg_»): fuera."""
    if "stash" in nombre_obj.lower() or nombre_obj.startswith("wdg_"):
        return False
    return not solo or any(nombre_obj.endswith(x) for x in solo)


def anexar(nombre, solo=None):
    ruta = os.path.join(CACHE, "models", nombre, f"{nombre}_1k.blend")
    with bpy.data.libraries.load(ruta, link=False) as (desde, hacia):
        hacia.objects = [n for n in desde.objects if util(n, solo)]
    e = bpy.context.scene
    raiz = bpy.data.objects.new(nombre, None)
    e.collection.objects.link(raiz)
    objs = [o for o in hacia.objects if o is not None]
    for o in objs:
        e.collection.objects.link(o)
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
    """Pone un modelo de Poly Haven con su base en `z_suelo` y su centro en (x, y)."""
    raiz, objs = anexar(nombre, solo)
    if juntar:
        piezas = sorted([o for o in objs if o.type == "MESH"], key=lambda o: o.location.x)
        x0 = piezas[0].location.x
        for o in piezas:
            o.location.x = x0 + o.dimensions.x / 2
            x0 += o.dimensions.x + 0.002
    raiz.scale = (escala, escala, escala)
    raiz.rotation_euler = (0, 0, rot)
    bpy.context.view_layer.update()
    mn, mx = caja_de(objs)
    c = (mn + mx) / 2
    raiz.location = (x - c.x, y - c.y, z_suelo - mn.z)
    bpy.context.view_layer.update()
    return raiz, objs


def material_textura(nombre, carpeta, escala=1.0):
    m = bpy.data.materials.new(nombre)
    t = m.node_tree if m.node_tree else None
    m.use_nodes = True
    t = m.node_tree
    bsdf = t.nodes["Principled BSDF"]
    coord = t.nodes.new("ShaderNodeTexCoord")
    mapeo = t.nodes.new("ShaderNodeMapping")
    mapeo.inputs["Scale"].default_value = (escala, escala, escala)
    t.links.new(coord.outputs["Object"], mapeo.inputs["Vector"])

    def imagen(archivo, color=True):
        n = t.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(os.path.join(CACHE, "textures", carpeta, archivo), check_existing=True)
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


def cielo(hdr, rot_x=0.0, rot_z=0.0, fuerza_camara=1.1, fuerza_luz=0.25, tinte=(1, 1, 1)):
    """El HDRI: lo que ve la cámara (por la ventana) y lo que ilumina, por separado, y teñido."""
    mundo = bpy.data.worlds.new("Cielo")
    mundo.use_nodes = True
    t = mundo.node_tree
    t.nodes.clear()
    sal = t.nodes.new("ShaderNodeOutputWorld")
    h = t.nodes.new("ShaderNodeTexEnvironment")
    h.image = bpy.data.images.load(os.path.join(CACHE, "hdris", f"{hdr}.hdr"))
    co = t.nodes.new("ShaderNodeTexCoord")
    ma = t.nodes.new("ShaderNodeMapping")
    ma.inputs["Rotation"].default_value = (math.radians(rot_x), 0, math.radians(rot_z))
    t.links.new(co.outputs["Generated"], ma.inputs["Vector"])
    t.links.new(ma.outputs["Vector"], h.inputs["Vector"])
    ti = t.nodes.new("ShaderNodeMix")
    ti.data_type = "RGBA"
    ti.blend_type = "MULTIPLY"
    ti.inputs["Factor"].default_value = 1.0
    ti.inputs[7].default_value = (*tinte, 1)
    t.links.new(h.outputs["Color"], ti.inputs[6])
    bc = t.nodes.new("ShaderNodeBackground")
    bc.inputs["Strength"].default_value = fuerza_camara
    bl = t.nodes.new("ShaderNodeBackground")
    bl.inputs["Strength"].default_value = fuerza_luz
    t.links.new(ti.outputs[2], bc.inputs["Color"])
    t.links.new(h.outputs["Color"], bl.inputs["Color"])
    lp = t.nodes.new("ShaderNodeLightPath")
    mx = t.nodes.new("ShaderNodeMixShader")
    t.links.new(lp.outputs["Is Camera Ray"], mx.inputs["Fac"])
    t.links.new(bl.outputs[0], mx.inputs[1])
    t.links.new(bc.outputs[0], mx.inputs[2])
    t.links.new(mx.outputs[0], sal.inputs["Surface"])
    bpy.context.scene.world = mundo


Y_PARED = 1.2
VENTANA = (-0.15, 1.05, 1.15, 1.0)  # x centro, z centro, ancho, alto


def cuarto(con_logo=True):
    """El cuarto del niño: pared de yeso con su ventana de madera, suelo de tablas y el cuadro del logo."""
    yeso = material_textura("Yeso", "plastered_wall_04", 0.6)
    madera = material_textura("Madera", "dark_wooden_planks", 0.8)
    vx, vz, vw, vh = VENTANA
    for nombre, cx, cz, w, h in (
        ("ParedIzq", vx - vw / 2 - 1.25, 1.5, 2.5, 3.0),
        ("ParedDer", vx + vw / 2 + 1.25, 1.5, 2.5, 3.0),
        ("ParedAbajo", vx, (vz - vh / 2) / 2, vw, vz - vh / 2),
        ("ParedArriba", vx, (vz + vh / 2 + 3.0) / 2, vw, 3.0 - (vz + vh / 2)),
    ):
        caja(nombre, (cx, Y_PARED, cz), (w, 0.15, h), yeso)
    caja("Suelo", (0, 0, -0.025), (6, 4, 0.05), madera)
    for nombre, c, m in (
        ("MarcoArriba", (vx, Y_PARED - 0.04, vz + vh / 2), (vw + 0.1, 0.12, 0.06)),
        ("MarcoAbajo", (vx, Y_PARED - 0.07, vz - vh / 2), (vw + 0.16, 0.2, 0.06)),
        ("MarcoIzq", (vx - vw / 2, Y_PARED - 0.04, vz), (0.06, 0.12, vh)),
        ("MarcoDer", (vx + vw / 2, Y_PARED - 0.04, vz), (0.06, 0.12, vh)),
        ("Parteluz", (vx, Y_PARED - 0.03, vz), (0.035, 0.08, vh)),
        ("Travesano", (vx, Y_PARED - 0.03, vz + 0.08), (vw, 0.08, 0.035)),
    ):
        caja(nombre, c, m, madera)
    if con_logo:
        lienzo = bpy.data.materials.new("Logo")
        lienzo.use_nodes = True
        lt = lienzo.node_tree
        lb = lt.nodes["Principled BSDF"]
        li = lt.nodes.new("ShaderNodeTexImage")
        li.image = bpy.data.images.load(os.path.abspath(LOGO))
        lt.links.new(li.outputs["Color"], lb.inputs["Base Color"])
        lb.inputs["Roughness"].default_value = 0.6
        caja("MarcoCuadro", (0.78, Y_PARED - 0.085, 1.22), (0.3, 0.03, 0.3), madera)
        bpy.ops.mesh.primitive_plane_add(size=0.24, location=(0.78, Y_PARED - 0.102, 1.22), rotation=(math.pi / 2, 0, 0))
        bpy.context.active_object.data.materials.append(lienzo)
    return madera


def luz(nombre, tipo, pos, rot, color, energia, tam=1.0, tam_y=None):
    d = bpy.data.lights.new(nombre, tipo)
    d.color = color
    d.energy = energia
    if tipo == "AREA":
        d.shape = "RECTANGLE"
        d.size = tam
        d.size_y = tam_y or tam
    o = bpy.data.objects.new(nombre, d)
    bpy.context.scene.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = rot
    return o


def luz_ventana(color, energia):
    vx, vz, vw, vh = VENTANA
    return luz("Ventana", "AREA", (vx, Y_PARED + 0.25, vz), (math.radians(90), 0, math.radians(180)), color, energia, vw, vh)


def motas(n, zona, color=(1.0, 0.8, 0.55), fuerza=2.5, semilla=3):
    random.seed(semilla)
    m = bpy.data.materials.new("Mota")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    em = t.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = fuerza
    t.links.new(em.outputs[0], t.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    (x0, x1), (y0, y1), (z0, z1) = zona
    for _ in range(n):
        b = Vector((random.uniform(x0, x1), random.uniform(y0, y1), random.uniform(z0, z1)))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.0012, 0.0025), location=b, segments=8, ring_count=6)
        o = bpy.context.active_object
        o.data.materials.append(m)
        k, d = random.choice((1, 2)), random.random()
        conducir(o, "location", f"{b.x}+0.04*sin(2*pi*({k}*{FASE}+{d}))", 0)
        conducir(o, "location", f"{b.z}+0.05*sin(2*pi*({FASE}+{d}))", 2)


def camara(foco, x, y, z, lente=32, fstop=4.0):
    """Cámara que apunta a `foco`; x, y, z son expresiones (usar FASE para moverla en bucle)."""
    cd = bpy.data.cameras.new("Camara")
    cd.lens = lente
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = fstop
    cam = bpy.data.objects.new("Camara", cd)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    f = bpy.data.objects.new("Foco", None)
    bpy.context.scene.collection.objects.link(f)
    f.location = foco
    cd.dof.focus_object = f
    c = cam.constraints.new("TRACK_TO")
    c.target = f
    c.track_axis, c.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    for i, e in enumerate((x, y, z)):
        conducir(cam, "location", e, i)
    return cam
