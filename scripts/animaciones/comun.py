"""Piezas comunes de las animaciones del formulario de postulación (2026-11-12).

TODAS VAN EN BUCLE de 8 s (240 cuadros a 30 fps): lo que se mueve se escribe como función de la FASE
(0 → 1 a lo largo de la vuelta) con drivers de expresión simple, que Blender evalúa sin Python. Así el
cuadro 241 sería igual al 1 y el WebP empalma solo. Fondo transparente; colores de `gcc.py` (marca).
"""
import math
import os

import bpy
from mathutils import Vector

import gcc

CUADROS = 240
FASE = "fmod((frame-1)/240,1)"
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../public/logo-gcc-512.png")
OSCURO = (0.018, 0.010, 0.050)


def fase(veces=1, desfase=0.0):
    """La fase de la vuelta: `veces` ciclos por vuelta (entero, para que empalme) y un desfase."""
    return f"fmod((frame-1)/240*{veces}+{desfase}+1,1)"


def camara(pos=(0, -11.5, 0.6), mira=(0, 0, 0.1), lente=50):
    return gcc.camara(pos=pos, mira=mira, lente=lente)


def emisivo(nombre, color, fuerza=1.0, alfa=1.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    t = m.node_tree
    n = t.nodes
    n.clear()
    sal = n.new("ShaderNodeOutputMaterial")
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = fuerza
    tr = n.new("ShaderNodeBsdfTransparent")
    mez = n.new("ShaderNodeMixShader")
    mez.name = "Mezcla"
    mez.inputs[0].default_value = alfa
    t.links.new(tr.outputs[0], mez.inputs[1])
    t.links.new(em.outputs[0], mez.inputs[2])
    t.links.new(mez.outputs[0], sal.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    return m


def opacidad(mat, expr):
    """La opacidad del material sigue la expresión (0 transparente, 1 opaco)."""
    conducir(mat.node_tree.nodes["Mezcla"].inputs[0], "default_value", expr)


def material_logo(fuerza=1.0):
    """El logo de la casa tal cual: el trazo oscuro del PNG se vuelve luz lila; lo demás, transparente."""
    m = bpy.data.materials.new("Logo")
    m.use_nodes = True
    t = m.node_tree
    n = t.nodes
    n.clear()
    sal = n.new("ShaderNodeOutputMaterial")
    img = n.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.abspath(LOGO), check_existing=True)
    gris = n.new("ShaderNodeRGBToBW")
    inv = n.new("ShaderNodeInvert")
    corte = n.new("ShaderNodeMapRange")
    corte.inputs["From Min"].default_value, corte.inputs["From Max"].default_value = 0.35, 0.75
    borde = n.new("ShaderNodeMapRange")
    borde.inputs["From Min"].default_value, borde.inputs["From Max"].default_value = 0.92, 1.0
    por = n.new("ShaderNodeMath")
    por.operation = "MULTIPLY"
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*gcc.LILA, 1)
    em.inputs["Strength"].default_value = fuerza
    tr = n.new("ShaderNodeBsdfTransparent")
    mez = n.new("ShaderNodeMixShader")
    t.links.new(img.outputs["Color"], gris.inputs[0])
    t.links.new(gris.outputs[0], inv.inputs["Color"])
    t.links.new(inv.outputs["Color"], corte.inputs["Value"])
    t.links.new(img.outputs["Alpha"], borde.inputs["Value"])
    t.links.new(corte.outputs["Result"], por.inputs[0])
    t.links.new(borde.outputs["Result"], por.inputs[1])
    t.links.new(por.outputs[0], mez.inputs[0])
    t.links.new(tr.outputs[0], mez.inputs[1])
    t.links.new(em.outputs[0], mez.inputs[2])
    t.links.new(mez.outputs[0], sal.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    return m


def logo(pos=(0, 0, 0), tam=1.0, camara_obj=None):
    """El logo, de frente a la cámara."""
    bpy.ops.mesh.primitive_plane_add(size=tam, location=pos, rotation=(math.pi / 2, 0, 0))
    o = bpy.context.active_object
    gcc.asignar(o, material_logo())
    if camara_obj:
        c = o.constraints.new("TRACK_TO")
        c.target = camara_obj
        c.track_axis, c.up_axis = "TRACK_Z", "UP_Y"
    return o


def conducir(dueno, prop, expr, indice=-1):
    """Un driver de expresión simple (sin Python): `frame`, sin, cos, pow, fmod, min, max…"""
    f = dueno.driver_add(prop, indice) if indice >= 0 else dueno.driver_add(prop)
    for fc in (f if isinstance(f, list) else [f]):
        fc.driver.type = "SCRIPTED"
        fc.driver.expression = expr
    return f


def escala(obj, expr):
    """Escala uniforme según la expresión (multiplica la escala de origen)."""
    base = obj.scale[0]
    for i in range(3):
        conducir(obj, "scale", f"{base}*({expr})", i)


def pico(expr_fase, centro=0.0, agudeza=10):
    """0 → 1 → 0 cuando la fase pasa por `centro` (periódico, sin saltos)."""
    return f"pow(max(0,cos(2*pi*({expr_fase}-{centro}))),{agudeza})"


def curva(puntos, mat, grosor=0.01, ciclica=False):
    d = bpy.data.curves.new("Curva", "CURVE")
    d.dimensions = "3D"
    d.bevel_depth = grosor
    d.bevel_resolution = 3
    d.use_fill_caps = not ciclica
    s = d.splines.new("POLY")
    s.points.add(len(puntos) - 1)
    for i, p in enumerate(puntos):
        s.points[i].co = (*p, 1)
    s.use_cyclic_u = ciclica
    if mat:
        d.materials.append(mat)
    o = bpy.data.objects.new("Curva", d)
    bpy.context.collection.objects.link(o)
    return o


def recta(a, b, n=24):
    a, b = Vector(a), Vector(b)
    return [a.lerp(b, i / (n - 1)) for i in range(n)]


def arco(a, b, alto, n=32):
    """De `a` a `b` subiendo `alto` en el medio (en Z)."""
    a, b = Vector(a), Vector(b)
    return [a.lerp(b, f) + Vector((0, 0, alto * math.sin(math.pi * f))) for f in (i / (n - 1) for i in range(n))]


def aro_en(pos, radio, mat, grosor=0.01, n=32, plano="XZ"):
    """Un aro centrado en su propio origen y llevado a `pos`: así crece en su sitio al escalarlo."""
    o = curva(circulo(radio, n, (0, 0, 0), plano), mat, grosor, ciclica=True)
    o.location = pos
    return o


def circulo(radio, n=64, centro=(0, 0, 0), plano="XZ"):
    c = Vector(centro)
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n
        x, y = radio * math.cos(a), radio * math.sin(a)
        pts.append(c + (Vector((x, 0, y)) if plano == "XZ" else Vector((x, y, 0))))
    return pts


def pulso_en(curva_obj, expr_fase, largo=0.22):
    """Un tramo de luz que recorre la curva: entra por el principio y sale por el final en cada ciclo."""
    d = curva_obj.data
    d.bevel_factor_mapping_start = d.bevel_factor_mapping_end = "SPLINE"
    conducir(d, "bevel_factor_end", f"({expr_fase})*{1 + largo}")
    conducir(d, "bevel_factor_start", f"({expr_fase})*{1 + largo}-{largo}")


def viajero(curva_obj, expr_fase, radio=0.06, mat=None, apagar_extremos=True):
    """Una esfera que recorre la curva con la fase; en curvas abiertas nace y muere en los extremos."""
    e = gcc.esfera(radio=radio, mat=mat)
    s = e.constraints.new("FOLLOW_PATH")
    s.target = curva_obj
    s.use_fixed_location = True
    conducir(s, "offset_factor", expr_fase)
    if apagar_extremos:
        escala(e, f"sin(pi*({expr_fase}))")
    return e


def bloque(pos, escala_xyz, cuerpo=None, borde=None):
    """Una caja oscura con sus aristas en luz violeta."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.active_object
    o.scale = escala_xyz
    gcc.asignar(o, cuerpo or emisivo("Cuerpo", OSCURO, 1.0))
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    a = bpy.context.active_object
    a.scale = escala_xyz
    a.modifiers.new("aristas", "WIREFRAME").thickness = 0.02
    gcc.asignar(a, borde or emisivo("Arista", gcc.VIOLETA, 1.0))
    a.parent = o
    a.location = (0, 0, 0)
    a.scale = (1, 1, 1)
    return o
