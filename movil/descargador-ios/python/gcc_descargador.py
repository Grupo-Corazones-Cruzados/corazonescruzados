"""Motor del Descargador GCC en iPhone: yt-dlp dentro de la app.

iOS no deja lanzar procesos, y yt-dlp lanza dos: FFmpeg para unir video y audio, y un motor de
JavaScript para los retos de YouTube. Aquí no hace falta ninguno:

- Los retos los resuelve el JavaScriptCore del propio iPhone. Swift nos da dos punteros a
  funciones de C (uno para avisar a la pantalla, otro para ejecutar JavaScript) y los llamamos
  con ctypes; el proveedor `JavaScriptCoreJCP` se cuelga del sistema de proveedores de yt-dlp.
- Video y audio se bajan por separado y Swift los une con AVFoundation, sin recodificar. Antes
  se corrige la cabecera de los MP4 fragmentados de YouTube (ver `_arreglar_fragmentado`).

Todo lo que pasa se cuenta a Swift como eventos JSON por `_avisar`.
"""

import ctypes
import glob
import json
import os
import struct
import sys
import threading

_avisar_c = None
_js_c = None
_libc = None
_cancelado = threading.Event()
_dir_motor = None
_dir_cache = None
_zip_cargado = None

# Hasta `h` de alto, prefiriendo H.264 (avc1) + AAC en MP4: lo abre Fotos y lo une AVFoundation.
# A diferencia de Android no hay respaldo a WebM/VP9: AVFoundation no lo lee.
def _hasta(h):
    return (f'bv*[height<={h}][vcodec^=avc1]+ba[ext=m4a]/bv*[height<={h}][ext=mp4]+ba[ext=m4a]'
            f'/b[height<={h}][ext=mp4]')

CALIDADES = {
    'mejor': 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]',
    '1080': _hasta(1080),
    '720': _hasta(720),
    '480': _hasta(480),
    'audio': 'ba[ext=m4a]',
}


def _avisar(**evento):
    _avisar_c(json.dumps(evento, ensure_ascii=False).encode('utf-8'))


def _correr_js(codigo):
    ptr = _js_c(codigo.encode('utf-8'))
    try:
        return ctypes.string_at(ptr).decode('utf-8')
    finally:
        _libc.free(ptr)


def configurar(avisar_ptr, js_ptr, dir_motor, dir_cache):
    """Una vez al arrancar. `dir_motor` guarda el yt-dlp actualizado; `dir_cache` la caché de yt-dlp."""
    global _avisar_c, _js_c, _libc, _dir_motor, _dir_cache
    _avisar_c = ctypes.CFUNCTYPE(None, ctypes.c_char_p)(avisar_ptr)
    _js_c = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_char_p)(js_ptr)
    _libc = ctypes.CDLL(None)
    _libc.free.argtypes = [ctypes.c_void_p]
    _dir_motor, _dir_cache = dir_motor, dir_cache
    _avisar(tipo='version', version=_cargar_motor())


def _cargar_motor():
    """Importa yt-dlp: el más nuevo de `dir_motor` si lo hay, si no el que viene en la app.

    Cada versión va en su propio zip (`yt-dlp-<versión>.zip`): zipimport guarda en caché el
    índice de cada ruta, así que reemplazar el archivo con el mismo nombre leería el viejo.
    """
    global _zip_cargado
    zips = sorted(glob.glob(os.path.join(_dir_motor, 'yt-dlp-*.zip')))
    nuevo = zips[-1] if zips else None
    if _zip_cargado and _zip_cargado in sys.path:
        sys.path.remove(_zip_cargado)
    for nombre in [m for m in sys.modules if m == 'yt_dlp' or m.startswith('yt_dlp.')]:
        del sys.modules[nombre]
    if nuevo:
        sys.path.insert(0, nuevo)
    _zip_cargado = nuevo
    _registrar_proveedor()
    from yt_dlp.version import __version__
    return __version__


def recargar():
    """Tras bajar un yt-dlp nuevo: lo carga sin cerrar la app y avisa la versión."""
    _avisar(tipo='motor', version=_cargar_motor())


def _registrar_proveedor():
    from yt_dlp.extractor.youtube.jsc._builtin.ejs import EJSBaseJCP
    from yt_dlp.extractor.youtube.jsc.provider import register_preference, register_provider
    from yt_dlp.extractor.youtube.pot._provider import BuiltinIEContentProvider

    @register_provider
    class JavaScriptCoreJCP(EJSBaseJCP, BuiltinIEContentProvider):
        PROVIDER_NAME = 'javascriptcore'
        JS_RUNTIME_NAME = 'javascriptcore'

        # No es un runtime que yt-dlp sepa buscar en el sistema: está siempre, dentro de la app.
        def is_available(self, /):
            return self._available

        def _run_js_runtime(self, stdin, /):
            return _correr_js(stdin)

    @register_preference(JavaScriptCoreJCP)
    def _preferencia(provider, requests):
        return 1000


def _opciones(**extra):
    return {
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'noplaylist': True,
        'cachedir': _dir_cache,
        # Si yt-dlp se actualiza y pide otra versión de los scripts de los retos, los baja él.
        'remote_components': {'ejs:github'},
        'js_runtimes': {},
        **extra,
    }


def _cajas(f, ini, fin):
    """Las cajas MP4 entre `ini` y `fin`: (tipo, inicio del contenido, fin de la caja)."""
    o = ini
    while o + 8 <= fin:
        f.seek(o)
        tam, tipo = struct.unpack('>I4s', f.read(8))
        cab = 8
        if tam == 1:
            tam, cab = struct.unpack('>Q', f.read(8))[0], 16
        elif tam == 0:
            tam = fin - o
        if tam < cab:
            return
        yield tipo.decode('latin-1'), o + cab, o + tam
        o += tam


def _arreglar_fragmentado(ruta):
    """YouTube sirve MP4 fragmentados (DASH) que traen la duración total en la cabecera además de
    en los fragmentos, y AVFoundation las SUMA: un video de 10 min se leía como de 20 y al unirlo
    quedaba la segunda mitad congelada y sin sonido. FFmpeg lo corrige al unir; aquí se ponen a
    cero esas duraciones (mvhd, tkhd, mdhd), que es lo que pide la norma cuando hay fragmentos.
    Solo se toca un archivo fragmentado (con `mvex`); uno normal se deja como está.
    """
    with open(ruta, 'r+b') as f:
        fin = os.fstat(f.fileno()).st_size
        moov = next(((i, e) for t, i, e in _cajas(f, 0, fin) if t == 'moov'), None)
        if not moov:
            return
        hijos = list(_cajas(f, *moov))
        if not any(t == 'mvex' for t, _, _ in hijos):
            return
        cajas = [(t, i) for t, i, _ in hijos if t == 'mvhd']
        for t, i, e in hijos:
            if t != 'trak':
                continue
            for t2, i2, e2 in _cajas(f, i, e):
                if t2 == 'tkhd':
                    cajas.append((t2, i2))
                elif t2 == 'mdia':
                    cajas += [(t3, i3) for t3, i3, _ in _cajas(f, i2, e2) if t3 == 'mdhd']
        for tipo, i in cajas:
            f.seek(i)
            v1 = f.read(1) == b'\x01'
            # versión+flags, creación y modificación; luego track_ID+reservado (tkhd) o timescale.
            pos = i + 4 + (16 if v1 else 8) + (8 if tipo == 'tkhd' else 4)
            f.seek(pos)
            f.write(b'\0' * (8 if v1 else 4))


def buscar(url):
    """Título, autor, duración y miniatura, para la tarjeta antes de descargar."""
    import yt_dlp
    try:
        with yt_dlp.YoutubeDL(_opciones()) as ydl:
            info = ydl.extract_info(url, download=False, process=False)
        _avisar(tipo='info', titulo=info.get('title') or url, autor=info.get('uploader') or info.get('channel'),
                duracion=info.get('duration'), miniatura=info.get('thumbnail'))
    except Exception as e:
        _avisar(tipo='error', mensaje=str(e))


def cancelar():
    _cancelado.set()


def descargar(url, calidad, carpeta):
    """Baja a `carpeta` el video y el audio por separado (o uno solo) y avisa las rutas."""
    import yt_dlp
    from yt_dlp.utils import DownloadCancelled

    _cancelado.clear()
    fase = {'n': 1, 'de': 1}

    def progreso(d):
        if _cancelado.is_set():
            raise DownloadCancelled()
        if d.get('status') != 'downloading':
            return
        total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
        pct = 100.0 * d.get('downloaded_bytes', 0) / total if total else 0.0
        _avisar(tipo='progreso', fase=fase['n'], fases=fase['de'], porcentaje=pct, eta=d.get('eta'))

    try:
        opciones = _opciones(format=CALIDADES[calidad], progress_hooks=[progreso])
        with yt_dlp.YoutubeDL(opciones) as ydl:
            info = ydl.extract_info(url, download=False)
            partes = info.get('requested_formats') or [info]
            fase['de'] = len(partes)
            rutas = {}
            for i, f in enumerate(partes, 1):
                fase['n'] = i
                es_audio = f.get('vcodec') == 'none'
                nombre = os.path.join(carpeta, f"{'audio' if es_audio else 'video'}.{f['ext']}")
                parte = dict(info)
                parte.pop('requested_formats', None)
                parte.update(f)
                ok, _ = ydl.dl(nombre, parte)
                if not ok:
                    raise yt_dlp.utils.DownloadError('La descarga no terminó')
                _arreglar_fragmentado(nombre)
                rutas['audio' if es_audio else 'video'] = nombre
        _avisar(tipo='listo', titulo=info.get('title') or url, video=rutas.get('video'), audio=rutas.get('audio'))
    except DownloadCancelled:
        _avisar(tipo='cancelado')
    except Exception as e:
        if _cancelado.is_set():
            _avisar(tipo='cancelado')
        else:
            _avisar(tipo='error', mensaje=str(e))
