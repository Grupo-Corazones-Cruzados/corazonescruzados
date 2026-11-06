"""
LAS ANIMACIONES PROPIAS DE LAS APPS (Fernando, 2026-11-05): «un corazón puede cruzar al mundo».

Un corazón vuela en arco hasta la Tierra y se posa latiendo; luego la Tierra gira. Cada app tiene sus
colores. Salen dos videos por app en `public/apps/`: `<app>-entrada.mp4` (una vez, al arrancar) y
`<app>-bucle.mp4` (se repite sin corte en la cabecera), más `<app>-bucle.jpg` para quien pide menos
movimiento.

    blender -b -P movil/animaciones/generar.py -- progreso aventura centralizado
"""
import math, os, shutil, subprocess, sys, tempfile
import bpy
from mathutils import Vector

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
SALIDA = os.path.join(RAIZ, 'public', 'apps')

# fondo = el de la cabecera en `globals.css`, para que el video no tenga borde.
TEMAS = {
    'progreso': dict(fondo='#4b2d8e', mar='#6d4fd0', tierra='#c9b8ff', brillo='#d9d0f2', corazon='#ff5a7a'),
    'aventura': dict(fondo='#0b0d14', mar='#1c3f8f', tierra='#3fbf7f', brillo='#7fa8ff', corazon='#ff4d6d'),
    'centralizado': dict(fondo='#050304', mar='#3a0a0e', tierra='#dc2626', brillo='#ef4444', corazon='#ffffff'),
}
FPS = 30
ENTRADA = 66    # 2,2 s: vuelo, llegada y primer latido
BUCLE = 120     # 4 s: una vuelta entera de la Tierra y dos latidos, para que cierre sin corte


def rgb(h):
    h = h.lstrip('#')
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(lin(int(h[i:i + 2], 16) / 255) for i in (0, 2, 4)) + (1.0,)


def malla_corazon():
    """Corazón con volumen: la curva clásica en capas, afinada hacia los bordes."""
    n, capas = 64, 12
    vs, cs = [], []
    for j in range(capas + 1):
        v = -1 + 2 * j / capas
        esc = math.sqrt(max(0.0, 1 - v * v))
        for i in range(n):
            t = 2 * math.pi * i / n
            x = 16 * math.sin(t) ** 3
            y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
            vs.append((x / 17 * esc, v * 0.42, (y + 2) / 17 * esc))
    for j in range(capas):
        for i in range(n):
            a = j * n + i
            b = j * n + (i + 1) % n
            cs.append((a, b, b + n, a + n))
    m = bpy.data.meshes.new('corazon')
    m.from_pydata(vs, [], cs)
    m.update()
    for p in m.polygons:
        p.use_smooth = True
    return m


def material(nombre):
    mat = bpy.data.materials.new(nombre)
    mat.use_nodes = True
    return mat, mat.node_tree


def escena(tema):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
    s.render.resolution_x = s.render.resolution_y = 640
    s.render.fps = FPS
    s.render.image_settings.file_format = 'PNG'
    s.view_settings.view_transform = 'Standard'
    w = bpy.data.worlds.new('fondo')
    s.world = w
    w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = rgb(tema['fondo'])
    w.node_tree.nodes['Background'].inputs[1].default_value = 1.0

    cam = bpy.data.cameras.new('c')
    cam.lens = 60
    co = bpy.data.objects.new('c', cam)
    s.collection.objects.link(co)
    co.location = (0, -9, 0)
    co.rotation_euler = (math.pi / 2, 0, 0)
    s.camera = co
    luz = bpy.data.lights.new('l', 'SUN')
    luz.energy = 3.2
    lo = bpy.data.objects.new('l', luz)
    s.collection.objects.link(lo)
    lo.rotation_euler = (math.radians(58), 0, math.radians(-32))

    # La Tierra: continentes con ruido, sin texturas de terceros.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=64, radius=1.55)
    tierra = bpy.context.object
    bpy.ops.object.shade_smooth()
    mat, t = material('tierra')
    bsdf = t.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.65
    coord = t.nodes.new('ShaderNodeTexCoord')
    ruido = t.nodes.new('ShaderNodeTexNoise')
    ruido.inputs['Scale'].default_value = 2.6
    ruido.inputs['Detail'].default_value = 7.0
    rampa = t.nodes.new('ShaderNodeValToRGB')
    rampa.color_ramp.elements[0].position = 0.5
    rampa.color_ramp.elements[0].color = rgb(tema['mar'])
    rampa.color_ramp.elements[1].position = 0.53
    rampa.color_ramp.elements[1].color = rgb(tema['tierra'])
    t.links.new(coord.outputs['Object'], ruido.inputs['Vector'])
    t.links.new(ruido.outputs['Fac'], rampa.inputs['Fac'])
    t.links.new(rampa.outputs['Color'], bsdf.inputs['Base Color'])
    tierra.data.materials.append(mat)

    # La atmósfera: un halo que brilla más en el borde de la esfera.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=48, radius=1.66)
    atm = bpy.context.object
    bpy.ops.object.shade_smooth()
    mat, t = material('atm')
    t.nodes.clear()
    sal = t.nodes.new('ShaderNodeOutputMaterial')
    fres = t.nodes.new('ShaderNodeLayerWeight')
    fres.inputs['Blend'].default_value = 0.72
    em = t.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = rgb(tema['brillo'])
    em.inputs['Strength'].default_value = 1.5
    tr = t.nodes.new('ShaderNodeBsdfTransparent')
    mz = t.nodes.new('ShaderNodeMixShader')
    t.links.new(fres.outputs['Facing'], mz.inputs[0])
    t.links.new(tr.outputs[0], mz.inputs[1])
    t.links.new(em.outputs[0], mz.inputs[2])
    t.links.new(mz.outputs[0], sal.inputs['Surface'])
    if hasattr(mat, 'surface_render_method'):
        mat.surface_render_method = 'BLENDED'
    else:
        mat.blend_method = 'BLEND'
    atm.data.materials.append(mat)

    # El corazón.
    cor = bpy.data.objects.new('corazon', malla_corazon())
    s.collection.objects.link(cor)
    mat, t = material('cor')
    b = t.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = rgb(tema['corazon'])
    b.inputs['Roughness'].default_value = 0.28
    b.inputs['Emission Color'].default_value = rgb(tema['corazon'])
    b.inputs['Emission Strength'].default_value = 0.65
    cor.data.materials.append(mat)
    return s, tierra, cor


def suave(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


LLEGADA = Vector((0.0, -1.7, 1.28))  # posado arriba, un poco hacia la cámara
ESC_POSADO = 0.5


def latido(x):
    """Dos pulsos por ciclo, como un corazón. x en 0..1; empieza y acaba en 0: el bucle cierra."""
    p = lambda c, a: a * math.exp(-((x - c) / 0.05) ** 2)
    return p(0.2, 0.2) + p(0.38, 0.13)


def poner_entrada(tierra, cor, f):
    x = f / (ENTRADA - 1)
    vuelo = suave(min(1.0, x / 0.72))
    ini = Vector((-3.4, -1.0, -1.6))
    ctrl = Vector((-2.5, -3.0, 3.2))
    a = ini.lerp(ctrl, vuelo)
    b = ctrl.lerp(LLEGADA, vuelo)
    cor.location = a.lerp(b, vuelo)
    cor.rotation_euler = (0, (1 - vuelo) * 2 * math.pi, 0)
    golpe = 0.26 * math.exp(-((x - 0.8) / 0.07) ** 2)
    cor.scale = [(0.28 + (ESC_POSADO - 0.28) * vuelo) * (1 + golpe)] * 3
    # Llega girando: acaba justo donde empieza el bucle.
    tierra.rotation_euler = (math.radians(18), 0, -(1 - suave(x)) * math.radians(50))
    entra = suave(x / 0.25)
    tierra.scale = [0.82 + 0.18 * entra] * 3


def poner_bucle(tierra, cor, f):
    x = f / BUCLE
    cor.location = LLEGADA
    cor.rotation_euler = (0, 0, 0)
    pulso = latido((x * 2) % 1.0)
    cor.scale = [ESC_POSADO * (1 + pulso)] * 3
    tierra.scale = (1, 1, 1)
    tierra.rotation_euler = (math.radians(18), 0, x * 2 * math.pi)


def renderizar(s, poner, tierra, cor, n, carpeta, solo=None):
    os.makedirs(carpeta, exist_ok=True)
    cuadros = range(n) if solo is None else solo
    for f in cuadros:
        poner(tierra, cor, f)
        bpy.context.view_layer.update()
        s.render.filepath = os.path.join(carpeta, f'{f:04d}.png')
        bpy.ops.render.render(write_still=True)


def a_mp4(carpeta, destino, tam):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-framerate', str(FPS), '-i', os.path.join(carpeta, '%04d.png'),
                    '-vf', f'scale={tam}:{tam}:flags=lanczos', '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '24',
                    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', destino], check=True)


def main():
    apps = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(TEMAS)
    os.makedirs(SALIDA, exist_ok=True)
    for app in apps:
        s, tierra, cor = escena(TEMAS[app])
        tmp = tempfile.mkdtemp()
        renderizar(s, poner_entrada, tierra, cor, ENTRADA, os.path.join(tmp, 'e'))
        a_mp4(os.path.join(tmp, 'e'), os.path.join(SALIDA, f'{app}-entrada.mp4'), 640)
        renderizar(s, poner_bucle, tierra, cor, BUCLE, os.path.join(tmp, 'b'))
        a_mp4(os.path.join(tmp, 'b'), os.path.join(SALIDA, f'{app}-bucle.mp4'), 360)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', os.path.join(tmp, 'b', '0000.png'), '-vf', 'scale=360:360',
                        '-q:v', '3', os.path.join(SALIDA, f'{app}-bucle.jpg')], check=True)
        shutil.rmtree(tmp)
        print('LISTO', app, flush=True)


main()
