'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Download, FileText, Loader2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { dentroDeUnaApp } from '@/lib/sitio/appDeTelefono';
import { useAparicion } from '@/lib/hooks/useAparicion';
import { BTN_PRIMARY } from '@/components/ui/Button';

type Archivo = { url: string; nombre: string; tipo: string; blob: Blob | null; error?: string };

/** Lo que abre una ventana pero NO es un archivo: se deja pasar tal cual (OAuth, entrar a un producto…). */
const NAVEGACION = /\/(conectar|entrar|auth|oauth|callback|login|logout)(\/|$|\?)/;

/**
 * ¿Es un archivo que la página quiere abrir? Un enlace con `download`, un `blob:`/`data:`, o una ruta
 * `/api/…` de este mismo sitio (un PDF, un comprobante, un adjunto, un reporte): ninguna de esas es
 * una pantalla del panel.
 */
function comoArchivo(href: string | URL | null | undefined, conDescarga = false): string | null {
  if (!href) return null;
  let u: URL;
  try { u = new URL(String(href), location.href); } catch { return null; }
  if (u.protocol === 'blob:' || u.protocol === 'data:') return conDescarga ? u.href : null;
  if (u.origin !== location.origin) return null;
  if (conDescarga) return u.href;
  return u.pathname.startsWith('/api/') && !NAVEGACION.test(u.pathname) ? u.href : null;
}

const EVENTO = 'gcc:abrir-archivo';

/**
 * Abre un archivo en el visor desde cualquier parte: una dirección (`/api/…`) o un `Blob` hecho en el
 * navegador (un CSV, un PDF generado aquí). Con un `Blob` el nombre es obligatorio: no hay cabecera.
 */
export function abrirArchivo(origen: string | Blob, nombre?: string) {
  const url = typeof origen === 'string' ? new URL(origen, location.href).href : URL.createObjectURL(origen);
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { url, nombre } }));
}

function nombreDe(r: Response, url: string, sugerido?: string | null): string {
  if (sugerido) return sugerido;
  const cd = r.headers.get('content-disposition') ?? '';
  const utf = cd.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (utf) { try { return decodeURIComponent(utf[1].trim().replace(/^"|"$/g, '')); } catch { /* sigue */ } }
  const simple = cd.match(/filename="?([^";]+)"?/i);
  if (simple) return simple[1];
  try {
    const partes = new URL(url).pathname.split('/').filter(Boolean);
    const ultima = partes.at(-1) ?? 'archivo';
    // `/api/invoices/12/pdf` → «invoices-12.pdf»
    if (/^(pdf|proof|comprobante)$/.test(ultima)) return `${partes.slice(1, -1).join('-') || 'archivo'}.pdf`;
    return ultima;
  } catch { return 'archivo'; }
}

/**
 * LOS ARCHIVOS SE ABREN EN UN VISOR CON SALIDA (Fernando, 2026-11-09: «al abrir un PDF me lo abre desde
 * la app y luego ya no me deja salir; tampoco funciona el botón de descargar»). Dentro de una app no hay
 * pestañas ni barra del navegador: un `window.open` o un enlace a `/api/…/pdf` cargaba el PDF ENCIMA del
 * panel (Mac, Android) sin forma de volver, y descargar no hacía nada visible.
 *
 * Se interceptan `window.open` y los clics en enlaces que son archivos (`comoArchivo`) y se abren aquí, con
 * «‹» para volver (también el gesto/botón atrás del teléfono y Escape) y «Descargar» siempre a la vista.
 *
 * ⭐ ES EL ESTÁNDAR DE LA PLATAFORMA (Fernando, 2026-11-09: «la forma en como presentas los archivos está
 * muy bien para otras partes de la plataforma»): en las apps Y en la web, en todo lo que vive bajo `.corp`
 * (el panel). Un archivo se abre con `window.open('/api/…')`, un enlace, o `abrirArchivo()` (para un
 * `Blob` hecho en el navegador). Nunca un visor propio ni una pestaña nueva. Las páginas públicas sin
 * `.corp` siguen como siempre.
 * Los PDF se pintan con pdf.js: las WebView del iPhone y de Android no muestran un PDF por sí solas.
 *
 * Descargar, según dónde: en la Mac la app guarda en Descargas y lo enseña en el Finder (`WKDownload`);
 * en el iPhone abre la hoja de compartir («Guardar en Archivos»); en Android, la descarga del sistema
 * (`MainActivity`, aviso en la barra). Lo que no tiene vista previa enseña su nombre y el botón.
 */
export default function VisorArchivos() {
  const [archivo, setArchivo] = useState<Archivo | null>(null);
  const [destino, setDestino] = useState<Element | null>(null);
  // El teléfono no deja pellizcar dentro de la app (Capacitor apaga el zoom): el PDF se agranda con un botón.
  const [zoom, setZoom] = useState(1);
  const { montado, visible } = useAparicion(!!archivo);
  const ultimo = useRef<Archivo | null>(null);
  if (archivo) ultimo.current = archivo;
  const mostrado = archivo ?? ultimo.current;
  const conHistoria = useRef(false);
  const pasando = useRef(false);

  /** Guarda el archivo como corresponde en cada app. Sin `await` antes de compartir: Safari exige el toque. */
  const descargar = useCallback((a: Archivo) => {
    const w = window as any;
    const plataforma = w.Capacitor?.getPlatform?.();
    // La hoja de compartir solo en la app del iPhone (o la web anclada al inicio): allí no hay descargas.
    // En la web del ordenador Chrome también sabe compartir, pero ahí se espera una descarga normal.
    const iphoneSinDescargas = plataforma === 'ios' || (dentroDeUnaApp() && /iPhone|iPad/.test(navigator.userAgent) && !w.webkit?.messageHandlers?.gccEscritorio);
    if (a.blob && iphoneSinDescargas) {
      const file = new File([a.blob], a.nombre, { type: a.tipo || 'application/octet-stream' });
      if (navigator.canShare?.({ files: [file] })) {
        navigator.share({ files: [file], title: a.nombre }).catch((e) => {
          if (e?.name !== 'AbortError') toast.error('No se pudo guardar el archivo.');
        });
        return;
      }
    }
    // Android baja la dirección real con su descargador (el de un `blob:` no existe allí).
    const href = plataforma === 'android' && !a.url.startsWith('blob:') && !a.url.startsWith('data:')
      ? a.url : a.blob ? URL.createObjectURL(a.blob) : a.url;
    const enlace = document.createElement('a');
    enlace.href = href; enlace.download = a.nombre; enlace.rel = 'noopener';
    document.body.appendChild(enlace);
    pasando.current = true;
    try { enlace.click(); } finally { pasando.current = false; enlace.remove(); }
    if (href.startsWith('blob:')) setTimeout(() => URL.revokeObjectURL(href), 60_000);
    toast.success(w.webkit?.messageHandlers?.gccEscritorio ? `Guardado en Descargas: ${a.nombre}`
      : plataforma === 'android' ? `Descargando ${a.nombre}…` : `Descargado: ${a.nombre}`);
  }, []);

  const abrir = useCallback(async (url: string, sugerido?: string | null) => {
    setDestino(document.querySelector('.corp') ?? document.body);
    setArchivo({ url, nombre: sugerido || 'Abriendo…', tipo: '', blob: null });
    setZoom(1);
    if (!conHistoria.current) { history.pushState(history.state, ''); conHistoria.current = true; }
    try {
      const r = await fetch(url, { credentials: 'include' });
      const tipo = (r.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!r.ok) {
        const j = tipo.includes('json') ? await r.json().catch(() => null) : null;
        setArchivo((a) => a && a.url === url ? { ...a, nombre: 'No se pudo abrir', error: j?.error || `El archivo no está disponible (${r.status}).` } : a);
        return;
      }
      // Una página, no un archivo: se abre como siempre.
      if (tipo === 'text/html') { cerrarSinHistoria(); location.href = url; return; }
      const blob = await r.blob();
      const nuevo: Archivo = { url, nombre: nombreDe(r, url, sugerido), tipo: tipo || blob.type, blob };
      setArchivo((a) => a && a.url === url ? nuevo : a);
    } catch {
      setArchivo((a) => a && a.url === url ? { ...a, nombre: 'No se pudo abrir', error: 'Revisa la conexión e inténtalo de nuevo.' } : a);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cerrarSinHistoria = () => { conHistoria.current = false; setArchivo(null); };
  const cerrar = useCallback(() => {
    if (conHistoria.current) { conHistoria.current = false; history.back(); }
    setArchivo(null);
  }, []);

  // `window.open` y los enlaces que son archivos vienen aquí: en las apps siempre; en la web, dentro del
  // panel (`.corp`), porque fuera de él el visor no tendría su tema.
  useEffect(() => {
    const aplica = () => dentroDeUnaApp() || !!document.querySelector('.corp');
    const original = window.open;
    window.open = function (url?: string | URL, objetivo?: string, rasgos?: string) {
      const u = aplica() ? comoArchivo(url) : null;
      if (u) { void abrir(u); return null; }
      return original.call(window, url, objetivo, rasgos);
    } as typeof window.open;
    const alPulsar = (e: MouseEvent) => {
      if (pasando.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const u = aplica() ? comoArchivo(a.href, a.hasAttribute('download')) : null;
      if (!u) return;
      e.preventDefault();
      void abrir(u, a.getAttribute('download') || null);
    };
    // Atrás del teléfono (Android) o del navegador: cierra el visor, no la página de debajo.
    const alVolver = () => { if (conHistoria.current) { conHistoria.current = false; setArchivo(null); } };
    const alPedir = (e: Event) => { const d = (e as CustomEvent<{ url: string; nombre?: string }>).detail; if (d?.url) void abrir(d.url, d.nombre ?? null); };
    document.addEventListener('click', alPulsar);
    window.addEventListener('popstate', alVolver);
    window.addEventListener(EVENTO, alPedir);
    return () => {
      window.removeEventListener(EVENTO, alPedir);
      window.open = original;
      document.removeEventListener('click', alPulsar);
      window.removeEventListener('popstate', alVolver);
    };
  }, [abrir]);

  // El envoltorio `.corp` del panel se REEMPLAZA al terminar de cargar (`carga-panel`): un visor que se
  // quedara en el viejo desaparecería de la pantalla. Mientras está abierto, se muda al nuevo.
  useEffect(() => {
    if (!montado) return;
    const t = window.setInterval(() => {
      setDestino((d) => (d && d.isConnected ? d : document.querySelector('.corp') ?? document.body));
    }, 300);
    return () => window.clearInterval(t);
  }, [montado]);

  useEffect(() => {
    if (!archivo) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [archivo, cerrar]);

  if (!montado || !mostrado || !destino) return null;
  const listo = !!mostrado.blob;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={mostrado.nombre}
      className={`fixed inset-0 z-[200] flex flex-col bg-digi-darker transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
      <header className="shrink-0 pt-[env(safe-area-inset-top)] bg-digi-card border-b border-digi-border">
        <div className="h-14 flex items-center gap-2 px-2 sm:px-3">
          <button type="button" onClick={cerrar} aria-label="Volver"
            className="h-11 min-w-11 px-2 inline-flex items-center gap-1 rounded text-digi-text hover:text-accent">
            <ChevronLeft className="w-5 h-5" /><span className="text-sm font-medium hidden sm:inline">Volver</span>
          </button>
          <p className="flex-1 min-w-0 truncate text-sm font-semibold text-digi-text" title={mostrado.nombre}>{mostrado.nombre}</p>
          {listo && mostrado.tipo === 'application/pdf' && (
            <button type="button" onClick={() => setZoom((z) => (z >= 2 ? 1 : z + 0.5))} aria-label={`Ampliar (ahora ${zoom}×)`}
              title="Ampliar" className="h-11 min-w-11 px-2 inline-flex items-center justify-center gap-1 rounded text-digi-text hover:text-accent">
              <ZoomIn className="w-5 h-5" />{zoom > 1 && <span className="text-xs font-semibold tabular-nums">{String(zoom).replace('.', ',')}×</span>}
            </button>
          )}
          <button type="button" disabled={!listo} onClick={() => descargar(mostrado)} className={BTN_PRIMARY}>
            <Download className="w-4 h-4" /> Descargar
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto pb-[env(safe-area-inset-bottom)]">
        {mostrado.error ? (
          <div className="h-full grid place-items-center p-6 text-center">
            <div>
              <FileText className="w-10 h-10 mx-auto text-digi-muted mb-3" />
              <p className="text-sm text-digi-text">{mostrado.error}</p>
            </div>
          </div>
        ) : !listo ? (
          <div className="h-full grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-digi-muted" /></div>
        ) : mostrado.tipo === 'application/pdf' ? (
          <PaginasPdf blob={mostrado.blob!} zoom={zoom} />
        ) : mostrado.tipo.startsWith('image/') ? (
          <ImagenOVideo blob={mostrado.blob!} video={false} nombre={mostrado.nombre} />
        ) : /^(video|audio)\//.test(mostrado.tipo) ? (
          <ImagenOVideo blob={mostrado.blob!} video nombre={mostrado.nombre} />
        ) : (
          // Sin vista previa (hoja de cálculo, ZIP, APK…): su nombre y el botón; descargar necesita el toque.
          <div className="h-full grid place-items-center p-6 text-center">
            <div>
              <FileText className="w-10 h-10 mx-auto text-digi-muted mb-3" />
              <p className="text-sm font-medium text-digi-text break-all mb-4">{mostrado.nombre}</p>
              <button type="button" onClick={() => descargar(mostrado)} className={BTN_PRIMARY}>
                <Download className="w-4 h-4" /> Descargar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    destino,
  );
}

function ImagenOVideo({ blob, video, nombre }: { blob: Blob; video: boolean; nombre: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const u = URL.createObjectURL(blob); setSrc(u); return () => URL.revokeObjectURL(u); }, [blob]);
  if (!src) return null;
  return (
    <div className="min-h-full grid place-items-center p-3">
      {video
        ? <video src={src} controls playsInline className="max-w-full max-h-[80vh]" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={src} alt={nombre} className="max-w-full h-auto" />}
    </div>
  );
}

/** Todas las páginas del PDF, una debajo de otra, al ancho de la pantalla (máx. 900 px) por el zoom. */
function PaginasPdf({ blob, zoom }: { blob: Blob; zoom: number }) {
  const caja = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelado = false;
    const contenedor = caja.current;
    if (!contenedor) return;
    (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      const ancho = Math.min(contenedor.clientWidth - 24, 900) * zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      for (let i = 1; i <= doc.numPages && !cancelado; i++) {
        const pagina = await doc.getPage(i);
        const base = pagina.getViewport({ scale: 1 });
        const vista = pagina.getViewport({ scale: (ancho / base.width) * dpr });
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.floor(vista.width); lienzo.height = Math.floor(vista.height);
        lienzo.style.width = `${ancho}px`; lienzo.style.height = `${Math.floor(vista.height / dpr)}px`;
        lienzo.className = 'block mx-auto bg-white shadow-md rounded-sm';
        if (cancelado) break;
        contenedor.appendChild(lienzo);
        await pagina.render({ canvas: lienzo, canvasContext: lienzo.getContext('2d')!, viewport: vista }).promise;
      }
      if (cancelado) void doc.destroy();
    })().catch(() => { if (!cancelado) setError('No se pudo mostrar el PDF. Descárgalo para verlo.'); });
    return () => { cancelado = true; contenedor.replaceChildren(); };
  }, [blob, zoom]);

  return (
    <>
      {error && <p className="text-sm text-digi-muted text-center p-6">{error}</p>}
      <div ref={caja} className="py-3 px-3 space-y-3 w-max min-w-full" />
    </>
  );
}
