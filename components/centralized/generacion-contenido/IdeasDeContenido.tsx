'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronLeft, CloudUpload, ExternalLink, FileVideo, Film, Loader2, Pencil, Plus, RefreshCw, Send, Share2, Trash2, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BTN_ICONO_FILA, BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { EditField, EditPanel, EDIT_INPUT } from '@/components/ui/EditDialog';
import { FilaMarcable } from '@/components/ui/ListaMarcable';
import MenuMas from '@/components/ui/MenuMas';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { TONO } from '@/components/ui/tonos';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';
import Conversacion from '@/components/espacio/Conversacion';
import { FilaSesion } from '@/components/espacio/RailProyectos';
import { api, EVENTO_TITULO, type Proyecto } from '@/components/espacio/api';
import { subirArchivo } from './subida';

const API = '/api/centralized/generacion-contenido';
const TIPOS = [{ valor: 'todos', texto: 'Todos los tipos' }, { valor: 'proyecto', texto: 'Proyectos' }, { valor: 'ticket', texto: 'Tickets' }, { valor: 'producto', texto: 'Productos' }];
const PRIVACIDAD = [{ valor: 'private', texto: 'Privado' }, { valor: 'unlisted', texto: 'No listado' }, { valor: 'public', texto: 'Público' }];

interface Idea {
  id: number; titulo: string | null; tema: string; talento: string | null; created_at: string;
  video_id: number | null; carpeta: string | null; sesion_id: string | null; video_nombre: string | null; video_tamano: number | null;
}
interface Ref { tipo: 'proyecto' | 'ticket' | 'producto'; ref_id: number; titulo: string; cliente_id?: number | null; cliente?: string | null }
interface Pieza { ruta: string; tipo: 'video' | 'miniatura' | 'carrusel' | 'infografia'; nombre: string; tamano: number }
interface Piezas {
  video: { id: number; sesion_id: string | null; carpeta: string } | null;
  titulo: string | null; publicado_en: string | null;
  piezas: Pieza[];
  drive: { carpeta: { url: string } | null; archivos: Record<string, { url: string }>; subido_en: string | null } | null;
  pendientes: number;
  sugerido: { titulo: string; descripcion: string } | null;
  publicaciones: { id: number; red: string; pieza: string; estado: string; progreso: number; url: string | null; error: string | null }[];
  puerta: { lista: boolean; sinConectar: string[]; sinPublicador: string[] } | null;
}
interface Subida { ideaId: number; progreso: number; etapa: 'subiendo' | 'abriendo' }

const nombreIdea = (i: { titulo: string | null; tema?: string; talento: string | null }) => i.titulo || i.tema || `Idea de ${i.talento || 'contenido'}`;
const legible = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);
const ETIQUETA_PIEZA: Record<Pieza['tipo'], string> = { video: 'Video editado', miniatura: 'Miniatura vertical', carrusel: 'Carrusel', infografia: 'Infografía de LinkedIn' };
const DESTINO: Record<Pieza['tipo'], string> = { video: 'Reels · TikTok · Shorts · Facebook', miniatura: 'Portada del video', carrusel: 'Instagram · LinkedIn', infografia: 'LinkedIn' };

/**
 * GENERACIÓN DE CONTENIDO (rediseño de Fernando, 2026-11-10). Cada idea es UNA sesión de Claude Code:
 *  · izquierda, las ideas (como la pestaña de videos de antes);
 *  · centro, solo el chat de su sesión;
 *  · derecha, lo que entregó el agente, con sus enlaces de Drive, «Subir»/«Actualizar» y «Publicar».
 * La idea nace del talento, las referencias (trabajos terminados) y el video ya editado en CapCut; el nombre
 * lo pone el agente la primera vez.
 */
export default function IdeasDeContenido({ enMarco = false }: { enMarco?: boolean }) {
  const enEscritorio = useConsultaMedia(PANTALLA_LG);
  const alto = useAltoHastaElPie<HTMLDivElement>({ desdeAncho: 1024 });
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [talentos, setTalentos] = useState<string[]>([]);
  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [elegida, setElegida] = useState<number | null>(null);
  const [vistaMovil, setVistaMovil] = useState<'chat' | 'piezas'>('chat');
  const [error, setError] = useState('');
  const [subida, setSubida] = useState<Subida | null>(null);
  const [formulario, setFormulario] = useState<'nueva' | 'editar' | null>(null);
  const [borrar, setBorrar] = useState<Idea | null>(null);
  const [version, setVersion] = useState(0);

  const cargar = useCallback(async () => {
    const r = await fetch(API);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'No se pudieron cargar las ideas.');
    setIdeas(j.data); setTalentos(j.talentos || []);
    return j.data as Idea[];
  }, []);
  useEffect(() => { cargar().catch((e) => setError(e.message)); }, [cargar, version]);
  useEffect(() => { api('/edicion').then((j) => setProyecto(j.proyecto)).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!enEscritorio || elegida !== null || !ideas?.length) return;
    setElegida(ideas[0].id);
  }, [enEscritorio, elegida, ideas]);
  /* El nombre que pone el agente llega por la sesión: la lista lo refleja sin recargar. */
  useEffect(() => {
    const t = setInterval(() => setVersion((x) => x + 1), 30000);
    const alTitulo = () => setVersion((x) => x + 1);
    window.addEventListener(EVENTO_TITULO, alTitulo);
    return () => { clearInterval(t); window.removeEventListener(EVENTO_TITULO, alTitulo); };
  }, []);
  useEffect(() => {
    if (!subida) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [subida]);

  const idea = ideas?.find((i) => i.id === elegida) || null;

  /** Crear: la idea, su video, la subida por partes y la sesión. Se sigue desde lo ya subido si se corta. */
  async function crear(d: { talento: string; referencias: Ref[]; archivo: File }) {
    let ideaId: number | null = null;
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ talento: d.talento, referencias: d.referencias }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo crear la idea.');
      ideaId = j.data.id as number;
      setFormulario(null);
      await cargar(); setElegida(ideaId);
      await subirVideo(ideaId, d.archivo, null);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo crear la idea.'); }
  }

  async function subirVideo(ideaId: number, archivo: File, existente: { id: number; carpeta: string } | null) {
    if (subida) { toast.error('Ya hay un video subiéndose.'); return; }
    let video = existente;
    try {
      if (!video) {
        const r = await fetch(`${API}/${ideaId}/videos`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nombre: archivo.name, tamano: archivo.size }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No se pudo preparar el video.');
        video = j.data;
      }
      const v = video!;
      setSubida({ ideaId, progreso: 0, etapa: 'subiendo' });
      await subirArchivo(v, archivo, archivo.name, (recibido) => setSubida({ ideaId, progreso: recibido / archivo.size, etapa: 'subiendo' }));
      setSubida({ ideaId, progreso: 1, etapa: 'abriendo' });
      const r = await fetch(`${API}/videos/${v.id}/iniciar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo abrir la sesión.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo subir el video.');
    } finally { setSubida(null); setVersion((x) => x + 1); }
  }

  async function guardarEdicion(d: { titulo: string; referencias: Ref[] }) {
    if (!idea) return;
    const cuerpo: Record<string, unknown> = { referencias: d.referencias };
    if (d.titulo.trim() && d.titulo.trim() !== (idea.titulo || '')) cuerpo.titulo = d.titulo.trim();
    const r = await fetch(`${API}/${idea.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo guardar.'); return; }
    setFormulario(null); setVersion((x) => x + 1);
  }

  async function confirmarBorrado() {
    const i = borrar;
    setBorrar(null);
    if (!i) return;
    const r = await fetch(`${API}/${i.id}`, { method: 'DELETE' });
    if (!r.ok) { toast.error((await r.json().catch(() => ({}))).error || 'No se pudo eliminar.'); return; }
    if (elegida === i.id) setElegida(null);
    setVersion((x) => x + 1);
  }

  const rail = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="shrink-0 p-2 border-b border-digi-border">
        <button type="button" disabled={!!subida} onClick={() => setFormulario('nueva')} className={`${BTN_PRIMARY} w-full`}><Plus className="w-4 h-4" /> Nueva idea</button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
        {ideas === null && !error && <Loader2 className="w-4 h-4 m-2 animate-spin text-digi-muted" />}
        {ideas?.length === 0 && <p className="px-2 py-6 text-center text-[12.5px] text-digi-muted">Sin ideas</p>}
        {ideas?.map((i) => {
          const sub = subida?.ideaId === i.id ? subida : null;
          const linea = sub ? (sub.etapa === 'abriendo' ? 'Abriendo la sesión' : `${Math.round(sub.progreso * 100)} %${i.video_tamano ? ` de ${legible(i.video_tamano)}` : ''}`)
            : !i.sesion_id ? 'Falta el video' : `${i.talento || ''} · ${new Date(i.created_at).toLocaleDateString('es-ES')}`;
          return (
            <FilaSesion key={i.id} titulo={nombreIdea(i)} linea={linea} activa={elegida === i.id}
              icono={<span className="shrink-0 mt-[2px]">{sub ? <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" /> : !i.sesion_id ? <CloudUpload className="w-3.5 h-3.5 text-amber-400" /> : <FileVideo className="w-3.5 h-3.5 text-digi-muted" />}</span>}
              alElegir={() => { setElegida(i.id); setVistaMovil('chat'); }} />
          );
        })}
      </div>
    </div>
  );

  const menuIdea = idea && (
    <MenuMas items={[
      { label: 'Editar idea', icon: Pencil, onClick: () => setFormulario('editar') },
      { label: 'Compartir', icon: Share2, onClick: () => compartir(idea.id) },
      { label: 'Eliminar idea', icon: Trash2, danger: true, onClick: () => setBorrar(idea) },
    ]} />
  );

  let chat;
  if (idea && proyecto && idea.sesion_id) {
    chat = (
      <Conversacion key={`${idea.id}-${idea.sesion_id}`} proyecto={proyecto} sesionId={idea.sesion_id}
        alVolver={enEscritorio ? undefined : () => setElegida(null)}
        alCrear={() => {}} alNueva={() => {}} alCambiar={() => setVersion((x) => x + 1)} />
    );
  } else if (idea && subida?.ideaId === idea.id) {
    chat = (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
        <div className="w-64 max-w-full h-1.5 rounded-full bg-digi-border overflow-hidden"><div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(subida.progreso * 100)}%` }} /></div>
        <p className="text-[12px] text-digi-muted tabular-nums">{subida.etapa === 'abriendo' ? 'Abriendo la sesión' : `${Math.round(subida.progreso * 100)} %`}</p>
      </div>
    );
  } else if (idea) {
    chat = <ReanudarVideo idea={idea} ocupada={!!subida} alElegir={(f) => subirVideo(idea.id, f, idea.video_id && idea.carpeta ? { id: idea.video_id, carpeta: idea.carpeta } : null)} />;
  } else {
    chat = <div className="h-full flex flex-col items-center justify-center gap-2 text-digi-muted"><FileVideo className="w-6 h-6" /><p className="text-[13px]">Elige una idea o crea una nueva</p></div>;
  }

  const panel = idea ? <PanelPiezas key={idea.id} ideaId={idea.id} menu={menuIdea} version={version} /> : null;

  const contenido = enEscritorio ? (
    <div className="grid grid-cols-[260px_minmax(0,1fr)_340px] h-full min-h-0 bg-digi-card border border-digi-border rounded-xl overflow-hidden">
      <div className="min-h-0 border-r border-digi-border">{rail}</div>
      <div className="min-h-0 min-w-0">{chat}</div>
      <div className="min-h-0 border-l border-digi-border">{panel || <div className="h-full" />}</div>
    </div>
  ) : idea ? (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 p-2 border-b border-digi-border flex items-center gap-1">
        <button type="button" onClick={() => setElegida(null)} aria-label="Volver a las ideas" className="destino-tactil w-9 h-11 shrink-0 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text"><ChevronLeft className="w-5 h-5" /></button>
        <select value={vistaMovil} onChange={(e) => setVistaMovil(e.target.value as 'chat' | 'piezas')} className={`${EDIT_INPUT} h-11 text-[16px]`}>
          <option value="chat">Chat</option>
          <option value="piezas">Entregables</option>
        </select>
      </div>
      <div className="flex-1 min-h-0">{vistaMovil === 'chat' ? chat : panel}</div>
    </div>
  ) : rail;

  return (
    <>
      {error && <p className={`mb-2 rounded-lg border p-2.5 text-[13px] ${TONO.error.caja} ${TONO.error.texto}`}>{error}</p>}
      {enEscritorio
        ? <div ref={alto.ref} style={alto.style} className={enMarco ? 'h-full' : ''}>{contenido}</div>
        : <PanelHastaElPie desdeAncho={0} minimo={320} desplazar={false} respiro={0} className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">{contenido}</PanelHastaElPie>}
      <FormularioIdea modo={formulario} idea={formulario === 'editar' ? idea : null} talentos={talentos}
        alCerrar={() => setFormulario(null)} alCrear={crear} alGuardar={guardarEdicion} />
      <PixelConfirm open={!!borrar} title="Eliminar idea" danger confirmLabel="Eliminar"
        message={`Se borran «${borrar ? nombreIdea(borrar) : ''}» y su carpeta en la Mac. Lo subido a Drive y la conversación se conservan. No se puede deshacer.`}
        onConfirm={confirmarBorrado} onCancel={() => setBorrar(null)} />
    </>
  );
}

/** «Compartir»: el enlace de la carpeta de Drive (solo lo abren cuentas @grupocc.org). */
async function compartir(ideaId: number) {
  const r = await fetch(`${API}/${ideaId}/piezas`);
  const j = await r.json().catch(() => ({}));
  const url = j?.drive?.carpeta?.url;
  if (!url) { toast.error('Primero sube las piezas a Drive.'); return; }
  try { await navigator.clipboard.writeText(url); toast.success('Enlace de Drive copiado. Solo lo abren cuentas @grupocc.org.'); } catch { window.open(url, '_blank', 'noopener'); }
}

/** Una idea cuyo video no terminó de subir: se elige el mismo archivo y sigue donde quedó. */
function ReanudarVideo({ idea, ocupada, alElegir }: { idea: Idea; ocupada: boolean; alElegir: (f: File) => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <CloudUpload className="w-6 h-6 text-amber-400" />
      <p className="text-[13px] text-digi-muted">{idea.video_nombre ? `Falta terminar de subir ${idea.video_nombre}` : 'Esta idea no tiene video'}</p>
      <button type="button" disabled={ocupada} onClick={() => entrada.current?.click()} className={BTN_SECONDARY}><Upload className="w-4 h-4" /> Elegir el video</button>
      <input ref={entrada} type="file" accept="video/*,.mov,.mkv" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; if (idea.video_tamano && f.size !== idea.video_tamano) { toast.error(`Hace falta el mismo archivo: ${idea.video_nombre}.`); return; } alElegir(f); }} />
    </div>
  );
}

/* ── El panel derecho: piezas, Drive y publicar ────────────────────────────────────────────────── */
function PanelPiezas({ ideaId, menu, version }: { ideaId: number; menu: React.ReactNode; version: number }) {
  const [d, setD] = useState<Piezas | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [publicar, setPublicar] = useState(false);
  const [viendo, setViendo] = useState<Pieza | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch(`${API}/${ideaId}/piezas`);
    if (r.ok) setD(await r.json());
  }, [ideaId]);
  useEffect(() => { cargar(); }, [cargar, version]);
  const enCurso = d?.publicaciones.some((p) => p.estado === 'pendiente' || p.estado === 'subiendo');
  useEffect(() => {
    const t = setInterval(cargar, enCurso ? 3000 : 15000);
    return () => clearInterval(t);
  }, [cargar, enCurso]);

  async function subir() {
    setSubiendo(true);
    try {
      const r = await fetch(`${API}/${ideaId}/drive`, { method: 'POST' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo subir.');
      toast.success('Piezas en Drive.');
      await cargar();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo subir.'); } finally { setSubiendo(false); }
  }

  const archivo = (p: Pieza) => `${API}/${ideaId}/piezas/archivo?ruta=${encodeURIComponent(p.ruta)}`;
  const grupos = (['video', 'miniatura', 'carrusel', 'infografia'] as const).map((t) => ({ tipo: t, piezas: d?.piezas.filter((p) => p.tipo === t) || [] }));
  const enDrive = !!d?.drive?.subido_en;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="shrink-0 flex items-center gap-2 pl-3 pr-1.5 min-h-11 lg:min-h-12 border-b border-digi-border">
        <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-digi-text truncate">Entregables</span>
        {enDrive && d?.drive?.carpeta && <a href={d.drive.carpeta.url} target="_blank" rel="noreferrer" title="Carpeta en Drive" aria-label="Carpeta en Drive" className={BTN_ICONO_FILA}><ExternalLink className="w-4 h-4" /></a>}
        {menu}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
        {!d && <Loader2 className="w-4 h-4 animate-spin text-digi-muted" />}
        {d && !d.piezas.length && <p className="text-[12.5px] text-digi-muted py-6 text-center">El agente aún no ha entregado las piezas.</p>}
        {d?.publicado_en && <p className="text-[12.5px] text-green-500 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Publicado el {new Date(d.publicado_en).toLocaleDateString('es-ES')}</p>}
        {grupos.filter((g) => g.piezas.length).map((g) => (
          <section key={g.tipo}>
            <div className="flex items-baseline gap-2">
              <h3 className="text-[12.5px] font-semibold text-digi-text">{ETIQUETA_PIEZA[g.tipo]}</h3>
              <span className="text-[11.5px] text-digi-muted truncate">{DESTINO[g.tipo]}</span>
            </div>
            <div className={`mt-1.5 grid gap-1.5 ${g.tipo === 'carrusel' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {g.piezas.map((p) => {
                const link = d?.drive?.archivos[p.ruta]?.url;
                return (
                  <div key={p.ruta} className="relative group rounded-md overflow-hidden border border-digi-border bg-black/20">
                    <button type="button" onClick={() => setViendo(p)} className="block w-full" aria-label={`Ver ${p.nombre}`}>
                      {p.tipo === 'video'
                        ? <span className="aspect-[9/16] flex flex-col items-center justify-center gap-1 text-digi-muted"><Film className="w-5 h-5" /><span className="text-[11px] tabular-nums">{legible(p.tamano)}</span></span>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={`${archivo(p)}&v=${version}`} alt={p.nombre} loading="lazy" className={`w-full object-cover ${p.tipo === 'miniatura' ? 'aspect-[9/16]' : 'aspect-[4/5]'}`} />}
                    </button>
                    {link && <a href={link} target="_blank" rel="noreferrer" title="Abrir en Drive" aria-label={`Abrir ${p.nombre} en Drive`} className="absolute top-1 right-1 w-7 h-7 rounded bg-black/60 text-white flex items-center justify-center"><ExternalLink className="w-3.5 h-3.5" /></a>}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {!!d?.publicaciones.length && (
          <section>
            <h3 className="text-[12.5px] font-semibold text-digi-text">Publicaciones</h3>
            <ul className="mt-1.5 space-y-1.5">
              {d.publicaciones.map((p) => (
                <li key={p.id} className="flex items-start gap-2 text-[12.5px] min-w-0">
                  {p.estado === 'publicada' ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-500" /> : p.estado === 'error' ? <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" /> : <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin text-accent" />}
                  <span className="flex-1 min-w-0"><span className="block text-digi-text capitalize">{p.red} · {p.pieza}{p.estado === 'subiendo' ? ` · ${Math.round(p.progreso * 100)} %` : ''}</span>{p.error && <span className="block text-red-400">{p.error}</span>}</span>
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer" aria-label="Abrir" className="shrink-0 text-digi-muted hover:text-digi-text"><ExternalLink className="w-3.5 h-3.5" /></a>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {d && d.piezas.length > 0 && !d.publicado_en && (
        <div className="shrink-0 flex items-center justify-end gap-2 p-2 border-t border-digi-border max-lg:pb-[calc(0.5rem+var(--seguro-abajo))]">
          <button type="button" onClick={subir} disabled={subiendo || (enDrive && !d.pendientes)} className={BTN_SECONDARY}>
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}{enDrive ? 'Actualizar' : 'Subir'}
          </button>
          <button type="button" onClick={() => setPublicar(true)} disabled={!!enCurso} className={BTN_PRIMARY}><Send className="w-4 h-4" /> Publicar</button>
        </div>
      )}
      <VisorPieza pieza={viendo} url={viendo ? archivo(viendo) : ''} alCerrar={() => setViendo(null)} />
      <FormularioPublicar abierto={publicar} ideaId={ideaId} datos={d} alCerrar={() => setPublicar(false)} alPublicar={cargar} />
    </div>
  );
}

function VisorPieza({ pieza, url, alCerrar }: { pieza: Pieza | null; url: string; alCerrar: () => void }) {
  return (
    <EditPanel open={!!pieza} onClose={alCerrar} title={pieza ? ETIQUETA_PIEZA[pieza.tipo] : ''} onSave={alCerrar} saveLabel="Cerrar" canSave>
      {pieza && (pieza.tipo === 'video'
        ? <video src={url} controls playsInline className="w-full max-h-[75vh] rounded-md bg-black" />
        // eslint-disable-next-line @next/next/no-img-element
        : <img src={url} alt={pieza.nombre} className="w-full rounded-md" />)}
    </EditPanel>
  );
}

/* ── Publicar: un solo formulario para todas las redes del talento ─────────────────────────────── */
function FormularioPublicar({ abierto, ideaId, datos, alCerrar, alPublicar }: { abierto: boolean; ideaId: number; datos: Piezas | null; alCerrar: () => void; alPublicar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [privacidad, setPrivacidad] = useState('public');
  const [programada, setProgramada] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setTitulo(datos?.sugerido?.titulo || datos?.titulo || ''); setDescripcion(datos?.sugerido?.descripcion || ''); setPrivacidad('public'); setProgramada('');
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const puerta = datos?.puerta;
  const bloqueo = !puerta ? 'Cargando…'
    : puerta.sinConectar.length ? `Faltan por conectar en Configuración ▸ Conexiones: ${puerta.sinConectar.join(', ')}.`
    : puerta.sinPublicador.length ? `Publicar en ${puerta.sinPublicador.join(', ')} aún no está disponible.` : '';

  async function enviar() {
    setConfirmar(false); setEnviando(true);
    try {
      const r = await fetch(`${API}/${ideaId}/publicar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, descripcion, privacidad: programada ? 'private' : privacidad, programada: programada ? new Date(programada).toISOString() : null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo publicar.');
      toast.success('Publicación en marcha.');
      alCerrar(); alPublicar();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'No se pudo publicar.'); } finally { setEnviando(false); }
  }

  return (
    <>
      <EditPanel open={abierto} onClose={alCerrar} title="Publicar" saving={enviando} canSave={!bloqueo && !!titulo.trim()}
        saveLabel={programada ? 'Programar' : 'Publicar'} onSave={() => setConfirmar(true)}>
        {bloqueo && <p className="text-[13px] text-amber-500">{bloqueo}</p>}
        <EditField label="Título"><input value={titulo} maxLength={100} onChange={(e) => setTitulo(e.target.value)} className={EDIT_INPUT} /></EditField>
        <EditField label="Descripción"><textarea value={descripcion} rows={7} onChange={(e) => setDescripcion(e.target.value)} className={EDIT_INPUT} /></EditField>
        <EditField label="Visibilidad">
          <select value={programada ? 'private' : privacidad} disabled={!!programada} onChange={(e) => setPrivacidad(e.target.value)} className={EDIT_INPUT}>
            {PRIVACIDAD.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
          </select>
        </EditField>
        <EditField label="Programar"><input type="datetime-local" value={programada} onChange={(e) => setProgramada(e.target.value)} className={EDIT_INPUT} /></EditField>
      </EditPanel>
      <PixelConfirm open={confirmar} title={programada ? 'Programar publicación' : 'Publicar'}
        message={`«${titulo}» saldrá en todas las redes del talento${programada ? ` el ${new Date(programada).toLocaleString('es-ES')}` : ''}. Al terminar se borra el proyecto de la Mac; lo de Drive se queda.`}
        confirmLabel={programada ? 'Programar' : 'Publicar'} onConfirm={enviar} onCancel={() => setConfirmar(false)} />
    </>
  );
}

/* ── Nueva idea / Editar idea ──────────────────────────────────────────────────────────────────── */
function FormularioIdea({ modo, idea, talentos, alCerrar, alCrear, alGuardar }: {
  modo: 'nueva' | 'editar' | null; idea: Idea | null; talentos: string[];
  alCerrar: () => void; alCrear: (d: { talento: string; referencias: Ref[]; archivo: File }) => void; alGuardar: (d: { titulo: string; referencias: Ref[] }) => void;
}) {
  const [talento, setTalento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [elegidas, setElegidas] = useState<Ref[]>([]);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resultados, setResultados] = useState<Ref[] | null>(null);
  const [tipo, setTipo] = useState('todos');
  const [cliente, setCliente] = useState('');
  const [q, setQ] = useState('');
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!modo) return;
    setArchivo(null); setTipo('todos'); setCliente(''); setQ('');
    if (modo === 'editar' && idea) {
      setTalento(idea.talento || ''); setTitulo(idea.titulo || '');
      fetch(`${API}/${idea.id}`).then((r) => r.json()).then((j) => setElegidas((j.data?.referencias || []).map((r: any) => ({ tipo: r.tipo, ref_id: Number(r.ref_id), titulo: r.titulo })))).catch(() => setElegidas([]));
    } else {
      setTalento(talentos.length === 1 ? talentos[0] : ''); setTitulo(''); setElegidas([]);
    }
  }, [modo, idea, talentos]);

  useEffect(() => {
    if (!modo || !talento) { setResultados(null); return; }
    let vivo = true;
    setResultados(null);
    fetch(`${API}/referencias?talento=${encodeURIComponent(talento)}`).then((r) => r.json()).then((j) => { if (vivo) setResultados(j.data || []); }).catch(() => { if (vivo) setResultados([]); });
    return () => { vivo = false; };
  }, [modo, talento]);

  const clientes = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of resultados || []) if (r.cliente_id && r.cliente) m.set(r.cliente_id, r.cliente);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [resultados]);
  const filtrados = (resultados || []).filter((r) => (tipo === 'todos' || r.tipo === tipo)
    && (!cliente || String(r.cliente_id) === cliente) && (!q.trim() || r.titulo.toLowerCase().includes(q.trim().toLowerCase())));
  const marcada = (r: Ref) => elegidas.some((e) => e.tipo === r.tipo && e.ref_id === r.ref_id);
  const alternar = (r: Ref) => setElegidas((l) => (marcada(r) ? l.filter((e) => !(e.tipo === r.tipo && e.ref_id === r.ref_id)) : [...l, { tipo: r.tipo, ref_id: r.ref_id, titulo: r.titulo }]));
  const listo = modo === 'nueva' ? !!talento && !!archivo : true;
  const TIPO_TEXTO: Record<string, string> = { proyecto: 'Proyecto', ticket: 'Ticket', producto: 'Producto' };

  return (
    <EditPanel open={!!modo} onClose={alCerrar} title={modo === 'editar' ? 'Editar idea' : 'Nueva idea'} canSave={listo}
      saveLabel={modo === 'editar' ? 'Guardar' : 'Crear y subir'}
      onSave={() => { if (modo === 'nueva' && archivo) alCrear({ talento, referencias: elegidas, archivo }); else if (modo === 'editar') alGuardar({ titulo, referencias: elegidas }); }}>
      {modo === 'editar' && (
        <EditField label="Nombre"><input value={titulo} maxLength={200} onChange={(e) => setTitulo(e.target.value)} className={EDIT_INPUT} placeholder="Lo pone el agente" /></EditField>
      )}
      <EditField label="Talento">
        {modo === 'editar'
          ? <input value={talento} disabled className={EDIT_INPUT} />
          : talentos.length
            ? <select value={talento} onChange={(e) => { setTalento(e.target.value); setElegidas([]); }} className={EDIT_INPUT}>
                <option value="">Elegir talento</option>
                {talentos.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            : <p className="text-[13px] text-amber-500">Esta cuenta no tiene talentos en su CV.</p>}
      </EditField>
      <EditField label={`Referencias${elegidas.length ? ` · ${elegidas.length}` : ''}`}>
        {!talento ? <p className="text-[13px] text-digi-muted">Elige primero el talento.</p> : (
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={EDIT_INPUT}>{TIPOS.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}</select>
              <select value={cliente} onChange={(e) => setCliente(e.target.value)} className={EDIT_INPUT}>
                <option value="">Todos los clientes</option>
                {clientes.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
            </div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className={EDIT_INPUT} />
            <div className="max-h-[42vh] overflow-y-auto rounded-md border border-digi-border p-1">
              {resultados === null ? <Loader2 className="w-4 h-4 m-2 animate-spin text-digi-muted" />
                : !filtrados.length ? <p className="p-3 text-[13px] text-digi-muted">Sin trabajos terminados con esos filtros.</p>
                : filtrados.map((r) => (
                  <FilaMarcable key={`${r.tipo}-${r.ref_id}`} marcada={marcada(r)} etiqueta={r.titulo}
                    nota={[TIPO_TEXTO[r.tipo], r.cliente].filter(Boolean).join(' · ')} onClick={() => alternar(r)} />
                ))}
            </div>
          </div>
        )}
      </EditField>
      {modo === 'nueva' && (
        <EditField label="Video base">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => entrada.current?.click()} className={BTN_SECONDARY}><Upload className="w-4 h-4" /> {archivo ? 'Cambiar' : 'Elegir video'}</button>
            <span className="text-[13px] text-digi-muted truncate">{archivo ? `${archivo.name} · ${legible(archivo.size)}` : 'Ya editado en CapCut'}</span>
            <input ref={entrada} type="file" accept="video/*,.mov,.mkv" className="hidden" onChange={(e) => { setArchivo(e.target.files?.[0] || null); e.target.value = ''; }} />
          </div>
        </EditField>
      )}
    </EditPanel>
  );
}

