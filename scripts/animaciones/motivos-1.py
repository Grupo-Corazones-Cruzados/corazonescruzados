"""«Un corazón puede cruzar el mundo» (formulario de postulación ▸ Motivos 1 de 3, Fernando, 2026-11-12).

Lo que cuenta el texto, en orden: sociedades separadas (puntos sueltos sobre el mundo) → un corazón (el logo
de la casa, los dos corazones cruzados) cruza el mundo dejando su estela → la alianza que ya existe (todos
los puntos quedan unidos). Fondo transparente; se pinta sobre la tarjeta oscura del formulario.

EN BUCLE (Fernando, 2026-11-12): el logo recorre un circuito cerrado entre los puntos y su estela se recoge
detrás de él; la red del mundo gira justo un hueco de su malla. El último cuadro empalma con el primero.
Todo va levantado sobre la superficie para que el logo no se entierre en la esfera (se veía cortado).
Se renderiza con `node scripts/animaciones/renderizar.mjs motivos-1`.
"""
import math
import os

import bpy
from mathutils import Vector

import gcc

R = 1.55
LOGO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../public/logo-gcc-512.png")


def emisivo(nombre, color, fuerza=1.0, alfa=1.0):
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    n = m.node_tree.nodes
    n.clear()
    sal = n.new("ShaderNodeOutputMaterial")
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = fuerza
    if alfa < 1:
        tr = n.new("ShaderNodeBsdfTransparent")
        mez = n.new("ShaderNodeMixShader")
        mez.inputs["Fac"].default_value = alfa
        m.node_tree.links.new(tr.outputs[0], mez.inputs[1])
        m.node_tree.links.new(em.outputs[0], mez.inputs[2])
        m.node_tree.links.new(mez.outputs[0], sal.inputs["Surface"])
        m.surface_render_method = "BLENDED"
    else:
        m.node_tree.links.new(em.outputs[0], sal.inputs["Surface"])
    return m


def material_logo():
    """El logo tal cual: el trazo oscuro del PNG se vuelve luz lila; lo demás, transparente."""
    m = bpy.data.materials.new("Logo")
    m.use_nodes = True
    t = m.node_tree
    n = t.nodes
    n.clear()
    sal = n.new("ShaderNodeOutputMaterial")
    img = n.new("ShaderNodeTexImage")
    img.image = bpy.data.images.load(os.path.abspath(LOGO))
    inv = n.new("ShaderNodeInvert")
    gris = n.new("ShaderNodeRGBToBW")
    # Solo el trazo: el blanco del círculo del logo no debe dejar un disco gris.
    corte = n.new("ShaderNodeMapRange")
    corte.inputs["From Min"].default_value = 0.35
    corte.inputs["From Max"].default_value = 0.75
    por = n.new("ShaderNodeMath")
    por.operation = "MULTIPLY"
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*gcc.LILA, 1)
    em.inputs["Strength"].default_value = 1.0
    tr = n.new("ShaderNodeBsdfTransparent")
    mez = n.new("ShaderNodeMixShader")
    t.links.new(img.outputs["Color"], gris.inputs[0])
    t.links.new(gris.outputs[0], inv.inputs["Color"])
    t.links.new(inv.outputs["Color"], corte.inputs["Value"])
    t.links.new(corte.outputs["Result"], por.inputs[0])
    # El borde del círculo del logo (alfa a medias) dejaba un anillo: solo cuenta lo opaco.
    borde = n.new("ShaderNodeMapRange")
    borde.inputs["From Min"].default_value = 0.92
    borde.inputs["From Max"].default_value = 1.0
    t.links.new(img.outputs["Alpha"], borde.inputs["Value"])
    t.links.new(borde.outputs["Result"], por.inputs[1])
    t.links.new(por.outputs[0], mez.inputs["Fac"])
    t.links.new(tr.outputs[0], mez.inputs[1])
    t.links.new(em.outputs[0], mez.inputs[2])
    t.links.new(mez.outputs[0], sal.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    return m


DURACION = 8.0
SEGMENTOS = 28                     # meridianos de la red: girar 360/28 grados deja la malla igual
LEVANTE = 0.24                     # el circuito va por encima de la superficie


def en_esfera(lat, lon, r=R):
    la, lo = math.radians(lat), math.radians(lon)
    return Vector((r * math.cos(la) * math.sin(lo), -r * math.cos(la) * math.cos(lo), r * math.sin(la)))


def tramo(a, b, alto, puntos=40):
    """Puntos de un arco sobre la esfera de `a` a `b`, a `LEVANTE` de la superficie y `alto` más en el medio."""
    va, vb = a.normalized(), b.normalized()
    angulo = va.angle(vb)
    salida = []
    for i in range(puntos):
        f = i / (puntos - 1)
        v = (va * math.sin((1 - f) * angulo) + vb * math.sin(f * angulo)) / math.sin(angulo)
        salida.append(v.normalized() * (R + LEVANTE + alto * math.sin(math.pi * f)))
    return salida


def curva(puntos, mat, grosor):
    d = bpy.data.curves.new("Curva", "CURVE")
    d.dimensions = "3D"
    d.bevel_depth = grosor
    d.bevel_resolution = 3
    d.use_fill_caps = True
    s = d.splines.new("POLY")
    s.points.add(len(puntos) - 1)
    for i, p in enumerate(puntos):
        s.points[i].co = (*p, 1)
    d.materials.append(mat)
    o = bpy.data.objects.new("Curva", d)
    bpy.context.collection.objects.link(o)
    return o


def lineal(obj_o_dato):
    ad = obj_o_dato.animation_data
    for c in gcc.iter_curvas(ad) if ad else []:
        for k in c.keyframe_points:
            k.interpolation = "LINEAR"


def construir(escena):
    fin = gcc.seg(DURACION)
    escena.frame_end = fin - 1          # el cuadro `fin` sería igual al primero: se deja fuera
    camara = gcc.camara(pos=(0, -11.5, 0.6), mira=(0, 0, 0.15), lente=50)

    # El mundo: núcleo oscuro y su red, que gira un hueco de malla por vuelta.
    gcc.esfera(radio=R * 0.985, mat=emisivo("Nucleo", (0.018, 0.010, 0.050), 1.0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=SEGMENTOS, ring_count=14)
    red = gcc.asignar(bpy.context.active_object, emisivo("Red", gcc.VIOLETA, 0.9, alfa=0.45))
    red.modifiers.new("red", "WIREFRAME").thickness = 0.008
    red.rotation_euler = (0, 0, 0)
    red.keyframe_insert("rotation_euler", frame=1)
    red.rotation_euler = (0, 0, math.radians(360 / SEGMENTOS))
    red.keyframe_insert("rotation_euler", frame=fin)
    lineal(red)

    # Las sociedades: puntos sobre la cara que mira a la cámara.
    luz = emisivo("Punto", gcc.LILA, 1.0)
    lugares = [(30, -48), (-12, -34), (36, 2), (-30, 4), (10, 30), (-8, 50), (32, 44)]
    sitios = [en_esfera(la, lo) for la, lo in lugares]
    for p in sitios:
        gcc.esfera(pos=p.normalized() * (R + 0.02), radio=0.055, mat=luz)
        # Un hilo une cada punto con el circuito que pasa por encima.
        curva([p.normalized() * (R + 0.02), p.normalized() * (R + LEVANTE)], emisivo("Hilo", gcc.VIOLETA, 0.8), 0.006)

    # La alianza: la red de uniones, fija y tenue.
    union = emisivo("Union", gcc.VIOLETA, 0.9)
    for a, b in [(0, 1), (1, 3), (3, 4), (4, 6), (6, 5), (2, 4), (1, 2), (2, 0), (5, 4)]:
        curva(tramo(sitios[a], sitios[b], 0.12), union, 0.006)

    # El circuito del corazón, cerrado, recorrido DOS veces en la misma curva: el logo va por la segunda
    # vuelta y la estela (un tramo que lo sigue) cabe siempre dentro de la curva, también al empalmar.
    orden = [0, 2, 6, 5, 4, 3, 1, 0]
    vuelta = []
    for a, b in zip(orden, orden[1:]):
        vuelta.extend(tramo(sitios[a], sitios[b], 0.32)[:-1])
    doble = vuelta + vuelta + [vuelta[0]]
    estela = curva(doble, emisivo("Estela", gcc.LILA, 0.95), 0.016)
    largo_estela = 0.09                # de la curva doble (≈18 % de una vuelta)
    d = estela.data
    d.bevel_factor_mapping_start = d.bevel_factor_mapping_end = "SPLINE"
    d.path_duration = 1000
    for cuadro, f in ((1, 0.5), (fin, 1.0)):
        d.bevel_factor_end = f
        d.bevel_factor_start = f - largo_estela
        d.eval_time = f * 1000
        for prop in ("bevel_factor_end", "bevel_factor_start", "eval_time"):
            d.keyframe_insert(prop, frame=cuadro)
    lineal(d)

    bpy.ops.mesh.primitive_plane_add(size=0.62)
    logo = bpy.context.active_object
    gcc.asignar(logo, material_logo())
    seguir = logo.constraints.new("FOLLOW_PATH")
    seguir.target = estela
    mirar = logo.constraints.new("TRACK_TO")
    mirar.target = camara
    mirar.track_axis, mirar.up_axis = "TRACK_Z", "UP_Y"
