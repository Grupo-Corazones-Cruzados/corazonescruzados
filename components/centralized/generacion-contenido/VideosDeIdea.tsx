'use client';

import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { CloudUpload, FileVideo, Loader2, RotateCw, Send, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import BotonEditar from '@/components/ui/BotonEditar';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_ICONO_FILA, BTN_PRIMARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import Conversacion from '@/components/espacio/Conversacion';
import RenombrarSesion, { type SesionARenombrar } from '@/components/espacio/RenombrarSesion';
import PanelPublicar from './PanelPublicar';
import { subirArchivo } from './subida';
import { BotonDetener, detenible, FilaSesion, IconoEstado, lineaSesion } from '@/components/espacio/RailProyectos';
import { api, EVENTO_TITULO, type Proyecto, type Sesion, type Viva } from '@/components/espacio/api';

const API = '/api/centralized/generacion-contenido';

interface Video { id: number; contenido_id: number; nombre: string; tamano: number; carpeta: string; sesion_id: string | null; created_at: string }
interface Subida { videoId: number; contenidoId: number; nombre: string; progreso: number; etapa: 'subiendo' | 'abriendo' }

/**
 * LA SUBIDA EN CURSO, FUERA DEL COMPONENTE. Hay una sola en toda la app porque cada video es una
 * sesión y se sube de uno en uno; y cambiar de idea o de pestaña no debe cortarla ni esconderla.
 */
let subidaActual: Subida | null = null;
const oyentes = new Set<() => void>();
function fijarSubida(s: Subida | null) { subidaActual = s; oyentes.forEach((o) => o()); }
function useSubida() {
  const [s, set] = useState(subidaActual);
  useEffect(() => { const o = () => set(subidaActual); oyentes.add(o); o(); return () => { oyentes.delete(o); }; }, []);
  return s;
}

const legible = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.round(b / 1e6)} MB`);

/**
 * LOS VIDEOS DE UNA IDEA. Cada uno es su propia sesión de Claude Code: es el mismo chat del Espacio
 * de trabajo, con todas sus funciones, pero la lista solo muestra lo de esta idea.
 */
export default function VideosDeIdea({ contenidoId }: { contenidoId: number }) {
  const enEscritorio = useConsultaMedia(PANTALLA_LG);
  const subida = useSubida();
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [videos, setVideos] = useState<Video[] | null>(null);
  const [sesiones, setSesiones] = useState<Sesion[]>([]);
  const [vivas, setVivas] = useState<Viva[]>([]);
  const [elegido, setElegido] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState('');
  const [borrar, setBorrar] = useState<Video | null>(null);
  const [nombrando, setNombrando] = useState<SesionARenombrar | null>(null);
  const [publicando, setPublicando] = useState<Video | null>(null);
  const [reanudar, setReanudar] = useState<Video | null>(null);
  /* Tras `/clear` el video no tiene sesión hasta el siguiente mensaje, pero ya no está por subir. */
  const [limpios, setLimpios] = useState<Set<number>>(new Set());
  const entrada = useRef<HTMLInputElement>(null);

  const cargarVideos = useCallback(async () => {
    const r = await fetch(`${API}/${contenidoId}/videos`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudieron cargar los videos.');
    setVideos(j.data);
    return j.data as Video[];
  }, [contenidoId]);

  useEffect(() => { api('/edicion').then((j) => setProyecto(j.proyecto)).catch((e) => setError(e.message)); }, []);
  useEffect(() => { cargarVideos().catch((e) => setError(e.message)); }, [cargarVideos, subida?.videoId]);

  useEffect(() => {
    let vivo = true;
    const traer = () => api('/vivas').then((j) => { if (vivo) setVivas(j.vivas); }).catch(() => {});
    traer();
    const t = setInterval(traer, 3000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!proyecto) return;
    let vivo = true;
    const traer = () => api(`/proyectos/${proyecto.id}/sesiones`).then((j) => { if (vivo) setSesiones(j.sesiones); }).catch(() => {});
    traer();
    const t = setInterval(traer, 20000);
    return () => { vivo = false; clearInterval(t); };
  }, [proyecto, version]);

  useEffect(() => {
    const alRenombrar = (e: Event) => {
      const { id, titulo } = (e as CustomEvent).detail;
      setSesiones((l) => l.map((s) => (s.id === id ? { ...s, titulo } : s)));
    };
    window.addEventListener(EVENTO_TITULO, alRenombrar);
    return () => window.removeEventListener(EVENTO_TITULO, alRenombrar);
  }, []);

  /* En escritorio se abre el primero; en el teléfono manda la lista hasta que se toca uno. */
  useEffect(() => {
    if (!enEscritorio || elegido !== null || !videos?.length) return;
    const listo = videos.find((v) => v.sesion_id);
    if (listo) setElegido(listo.id);
  }, [enEscritorio, elegido, videos]);

  useEffect(() => {
    if (!subida) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [subida]);

  async function subir(archivo: File, existente: Video | null) {
    if (subidaActual) { toast.error('Ya hay un video subiéndose. Se suben de uno en uno.'); return; }
    if (!archivo.type.startsWith('video/') && !/\.(mov|mp4|m4v|mkv|avi|webm)$/i.test(archivo.name)) { toast.error('Ese archivo no es un video.'); return; }
    if (existente && existente.tamano !== archivo.size) { toast.error(`Para seguir hace falta el mismo archivo: ${existente.nombre}.`); return; }
    setError('');
    let video = existente;
    try {
      if (!video) {
        const r = await fetch(`${API}/${contenidoId}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: archivo.name, tamano: archivo.size }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No se pudo crear el video.');
        video = j.data as Video;
      }
      const v = video;
      fijarSubida({ videoId: v.id, contenidoId, nombre: v.nombre, progreso: 0, etapa: 'subiendo' });
      setElegido(v.id);
      await subirArchivo(v, archivo, v.nombre, (recibido) => fijarSubida({ videoId: v.id, contenidoId, nombre: v.nombre, progreso: recibido / archivo.size, etapa: 'subiendo' }));
      fijarSubida({ videoId: v.id, contenidoId, nombre: v.nombre, progreso: 1, etapa: 'abriendo' });
      const r = await fetch(`${API}/videos/${v.id}/iniciar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo abrir la sesión del video.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el video.');
    } finally {
      fijarSubida(null);
      setReanudar(null);
      setVersion((x) => x + 1);
    }
  }

  function alElegirArchivos(lista: FileList | null, existente: Video | null) {
    if (!lista?.length) return;
    if (lista.length > 1) { toast.error('Sube un solo video: cada video es una sesión.'); return; }
    subir(lista[0], existente);
  }

  function alSoltar(e: DragEvent) {
    e.preventDefault();
    setArrastrando(false);
    alElegirArchivos(e.dataTransfer.files, null);
  }

  async function vincular(videoId: number, sesion: string | null) {
    setVideos((l) => l?.map((v) => (v.id === videoId ? { ...v, sesion_id: sesion } : v)) ?? l);
    setLimpios((c) => { const n = new Set(c); if (sesion) n.delete(videoId); else n.add(videoId); return n; });
    await fetch(`${API}/videos/${videoId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sesion_id: sesion }) }).catch(() => {});
    setVersion((x) => x + 1);
  }

  async function confirmarBorrado() {
    if (!borrar) return;
    const v = borrar;
    setBorrar(null);
    const r = await fetch(`${API}/videos/${v.id}`, { method: 'DELETE' }).catch(() => null);
    if (!r?.ok) { toast.error((await r?.json().catch(() => ({})))?.error || 'No se pudo eliminar el video.'); return; }
    if (elegido === v.id) setElegido(null);
    await cargarVideos();
  }

  const sesionDe = (v: Video): Sesion => {
    const s = sesiones.find((x) => x.id === v.sesion_id);
    const base: Sesion = s ?? { id: v.sesion_id || '', proyecto: proyecto?.id || '', titulo: v.nombre, actualizada: new Date(v.created_at).getTime(), rama: null, carpeta: null, enTerminal: false, error: null, viva: null };
    return { ...base, rama: null, viva: vivas.find((x) => x.id === v.sesion_id) || base.viva };
  };

  const video = videos?.find((v) => v.id === elegido) || null;
  const ocupada = !!subida;

  const rail = (
    <div className="flex flex-col min-h-0 h-full" onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }} onDragLeave={() => setArrastrando(false)} onDrop={alSoltar}>
      <div className="shrink-0 p-2 border-b border-digi-border">
        <button type="button" disabled={ocupada} onClick={() => { setReanudar(null); entrada.current?.click(); }} className={`${BTN_PRIMARY} w-full`}><Upload className="w-4 h-4" /> Subir video</button>
        <input ref={entrada} type="file" accept="video/*,.mov,.mkv" className="hidden" onChange={(e) => { alElegirArchivos(e.target.files, reanudar); e.target.value = ''; }} />
      </div>
      <div className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-0.5 ${arrastrando ? 'bg-accent-light' : ''}`}>
        {videos === null && !error && <Loader2 className="w-4 h-4 m-2 animate-spin text-digi-muted" />}
        {videos?.length === 0 && !subida && <p className="px-2 py-6 text-center text-[12.5px] text-digi-muted">Sin videos</p>}
        {videos?.map((v) => {
          const subiendo = subida?.videoId === v.id;
          const s = sesionDe(v);
          if (!v.sesion_id && limpios.has(v.id)) {
            return <div key={v.id}><FilaSesion titulo={v.nombre} linea="Conversación nueva" activa={elegido === v.id} alElegir={() => setElegido(v.id)} /></div>;
          }
          if (!v.sesion_id) {
            return (
              <div key={v.id} className="flex items-center gap-0.5 min-w-0">
                <div className="flex-1 min-w-0">
                  <FilaSesion titulo={v.nombre} activa={elegido === v.id} alElegir={() => setElegido(v.id)}
                    icono={<span className="shrink-0 mt-[2px]">{subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : <CloudUpload className="w-3.5 h-3.5 text-amber-400" />}</span>}
                    linea={subiendo ? (subida.etapa === 'abriendo' ? 'Abriendo la sesión' : `${Math.round(subida.progreso * 100)} % de ${legible(v.tamano)}`) : 'Subida incompleta'} />
                </div>
                {!subiendo && <button type="button" disabled={ocupada} onClick={() => { setReanudar(v); entrada.current?.click(); }} aria-label={`Seguir subiendo ${v.nombre}`} title="Seguir subiendo" className={BTN_ICONO_FILA}><RotateCw className="w-3.5 h-3.5" /></button>}
                {!subiendo && <button type="button" onClick={() => setBorrar(v)} aria-label={`Eliminar ${v.nombre}`} title="Eliminar" className={BTN_ICONO_FILA}><Trash2 className="w-3.5 h-3.5" /></button>}
              </div>
            );
          }
          return (
            <div key={v.id} className="flex items-center gap-0.5 min-w-0">
              <div className="flex-1 min-w-0">
                <FilaSesion titulo={s.titulo} linea={lineaSesion(s)} icono={<IconoEstado s={s} />} activa={elegido === v.id} alElegir={() => setElegido(v.id)} />
              </div>
              <button type="button" onClick={() => setPublicando(v)} aria-label={`Publicar ${s.titulo}`} title="Publicar" className={BTN_ICONO_FILA}><Send className="w-3.5 h-3.5" /></button>
              <BotonEditar onClick={() => setNombrando(s)} etiqueta={`Cambiar el nombre de ${s.titulo}`} title="Cambiar nombre" />
              {detenible(s) ? <BotonDetener s={s} /> : <button type="button" onClick={() => setBorrar(v)} aria-label={`Eliminar ${s.titulo}`} title="Eliminar" className={BTN_ICONO_FILA}><Trash2 className="w-3.5 h-3.5" /></button>}
            </div>
          );
        })}
      </div>
    </div>
  );

  let chat;
  if (video && proyecto && (video.sesion_id || limpios.has(video.id))) {
    chat = (
      <Conversacion key={`${video.id}-${video.sesion_id}`} proyecto={proyecto} sesionId={video.sesion_id}
        alVolver={enEscritorio ? undefined : () => setElegido(null)}
        alCrear={(id) => vincular(video.id, id)}
        alNueva={() => vincular(video.id, null)}
        alCambiar={() => setVersion((x) => x + 1)} />
    );
  } else if (video && subida?.videoId === video.id) {
    chat = (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <p className="text-[13.5px] text-digi-text truncate max-w-full" title={video.nombre}>{video.nombre}</p>
        <div className="w-64 max-w-full h-1.5 rounded-full bg-digi-border overflow-hidden"><div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(subida.progreso * 100)}%` }} /></div>
        <p className="text-[12px] text-digi-muted tabular-nums">{subida.etapa === 'abriendo' ? 'Abriendo la sesión' : `${Math.round(subida.progreso * 100)} %`}</p>
      </div>
    );
  } else {
    chat = (
      <div className="h-full flex flex-col items-center justify-center gap-2 text-digi-muted">
        <FileVideo className="w-6 h-6" /><p className="text-[13px]">{video ? 'Vuelve a elegir el archivo para seguir subiéndolo' : 'Elige un video o sube uno nuevo'}</p>
      </div>
    );
  }

  const contenido = enEscritorio ? (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] h-full min-h-0">
      <div className="min-h-0 border-r border-digi-border">{rail}</div>
      <div className="min-h-0 min-w-0">{chat}</div>
    </div>
  ) : (video ? chat : rail);

  return (
    <>
      {error && <p className={`m-2 rounded-lg border p-2.5 text-[13px] ${TONO.error.caja} ${TONO.error.texto}`}>{error}</p>}
      {enEscritorio
        ? <div className="flex-1 min-h-0 h-full">{contenido}</div>
        : <PanelHastaElPie desdeAncho={0} minimo={320} desplazar={false} respiro={0} className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">{contenido}</PanelHastaElPie>}
      <RenombrarSesion sesion={nombrando} alCerrar={() => setNombrando(null)} />
      <PanelPublicar video={publicando} alCerrar={() => setPublicando(null)} />
      <PixelConfirm open={!!borrar} title="Eliminar video"
        message={`Se borra «${borrar?.nombre || ''}» y su carpeta con las capas y la vista previa. El proyecto de CapCut y la conversación se conservan. No se puede deshacer.`}
        confirmLabel="Eliminar" danger onConfirm={confirmarBorrado} onCancel={() => setBorrar(null)} />
    </>
  );
}
