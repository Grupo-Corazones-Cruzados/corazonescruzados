"""«Un corazón puede cruzar el mundo» (formulario de postulación ▸ Motivos 1 de 3, Fernando, 2026-11-12).

Lo que cuenta el texto, en orden: sociedades separadas (puntos sueltos sobre el mundo) → un corazón (el logo
de la casa, los dos corazones cruzados) cruza el mundo dejando su estela → la alianza que ya existe (todos
los puntos quedan unidos). Fondo transparente; se pinta sobre la tarjeta oscura del formulario.
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


def en_esfera(lat, lon, r=R):
    la, lo = math.radians(lat), math.radians(lon)
    return Vector((r * math.cos(la) * math.sin(lo), -r * math.cos(la) * math.cos(lo), r * math.sin(la)))


def arco(a, b, alto, mat, grosor=0.012, puntos=48):
    """Un arco sobre la esfera de `a` a `b`, levantado `alto` en el medio, como curva con grosor."""
    d = bpy.data.curves.new("Arco", "CURVE")
    d.dimensions = "3D"
    d.bevel_depth = grosor
    d.bevel_resolution = 3
    d.use_fill_caps = True
    s = d.splines.new("POLY")
    s.points.add(puntos - 1)
    va, vb = a.normalized(), b.normalized()
    angulo = va.angle(vb)
    for i in range(puntos):
        f = i / (puntos - 1)
        v = (va * math.sin((1 - f) * angulo) + vb * math.sin(f * angulo)) / math.sin(angulo)
        p = v.normalized() * (R + alto * math.sin(math.pi * f))
        s.points[i].co = (*p, 1)
    d.materials.append(mat)
    o = bpy.data.objects.new("Arco", d)
    bpy.context.collection.objects.link(o)
    return o


def crecer(curva, t0, t1):
    curva.data.bevel_factor_end = 0
    curva.data.keyframe_insert("bevel_factor_end", frame=gcc.seg(t0))
    curva.data.bevel_factor_end = 1
    curva.data.keyframe_insert("bevel_factor_end", frame=gcc.seg(t1))


def construir(escena):
    camara = gcc.camara(pos=(0, -11.5, 0.6), mira=(0, 0, 0.2), lente=50)

    raiz = bpy.data.objects.new("Mundo", None)
    bpy.context.collection.objects.link(raiz)

    # El mundo: un núcleo oscuro y su red de paralelos y meridianos.
    nucleo = gcc.esfera(radio=R * 0.985, mat=emisivo("Nucleo", (0.018, 0.010, 0.050), 1.0))
    bpy.ops.mesh.primitive_uv_sphere_add(radius=R, segments=28, ring_count=14)
    red = gcc.asignar(bpy.context.active_object, emisivo("Red", gcc.VIOLETA, 0.9, alfa=0.45))
    bpy.ops.object.select_all(action="DESELECT")
    w = red.modifiers.new("red", "WIREFRAME")
    w.thickness = 0.008
    for o in (nucleo, red):
        o.parent = raiz

    # Las sociedades separadas: puntos sueltos que aparecen uno a uno.
    luz = emisivo("Punto", gcc.LILA, 1.0)
    lugares = [(28, -62), (-8, -38), (40, -8), (-30, 6), (14, 30), (-4, 64), (34, 52)]
    puntos = []
    for i, (la, lo) in enumerate(lugares):
        p = gcc.esfera(pos=en_esfera(la, lo, R + 0.02), radio=0.055, mat=luz)
        p.parent = raiz
        gcc.entrar(p, t=0.55 + i * 0.12, dur=0.4)
        puntos.append(en_esfera(la, lo))

    # El corazón cruza el mundo: el logo recorre el arco largo y deja su estela.
    estela = emisivo("Estela", gcc.LILA, 0.95)
    cruce = arco(puntos[0], puntos[4], 0.75, estela, grosor=0.016)
    cruce.parent = raiz
    cruce.data.path_duration = 100
    crecer(cruce, 1.5, 3.3)
    cruce.data.eval_time = 0
    cruce.data.keyframe_insert("eval_time", frame=gcc.seg(1.5))
    cruce.data.eval_time = 100
    cruce.data.keyframe_insert("eval_time", frame=gcc.seg(3.3))

    bpy.ops.mesh.primitive_plane_add(size=0.8)
    logo = bpy.context.active_object
    gcc.asignar(logo, material_logo())
    seguir = logo.constraints.new("FOLLOW_PATH")
    seguir.target = cruce
    seguir.use_fixed_location = False
    mirar = logo.constraints.new("TRACK_TO")
    mirar.target = camara
    mirar.track_axis, mirar.up_axis = "TRACK_Z", "UP_Y"
    gcc.entrar(logo, t=1.15, dur=0.45)

    # La alianza que ya existe: los demás puntos quedan unidos.
    union = emisivo("Union", gcc.VIOLETA, 1.2)
    pares = [(0, 1), (1, 3), (3, 4), (4, 6), (6, 5), (2, 4), (1, 2), (2, 0)]
    for k, (a, b) in enumerate(pares):
        c = arco(puntos[a], puntos[b], 0.28, union, grosor=0.008)
        c.parent = raiz
        t = 3.2 + k * 0.16
        crecer(c, t, t + 0.55)

    # El mundo entra con rebote y gira despacio todo el tiempo.
    gcc.entrar(raiz, t=0.0, dur=0.6, desde=0.6)
    raiz.rotation_euler = (0, 0, math.radians(-10))
    raiz.keyframe_insert("rotation_euler", frame=gcc.seg(0))
    raiz.rotation_euler = (0, 0, math.radians(14))
    raiz.keyframe_insert("rotation_euler", frame=gcc.seg(6))
    for curva in gcc.iter_curvas(raiz.animation_data):
        if curva.data_path == "rotation_euler":
            for k in curva.keyframe_points:
                k.interpolation = "LINEAR"
