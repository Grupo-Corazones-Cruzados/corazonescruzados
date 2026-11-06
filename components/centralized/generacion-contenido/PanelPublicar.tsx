'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, Upload, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { EditField, EditPanel, EDIT_INPUT } from '@/components/ui/EditDialog';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { api } from '@/components/espacio/api';
import { subirArchivo } from './subida';

const API = '/api/centralized/generacion-contenido';
const PRIVACIDAD = [
  { valor: 'private', texto: 'Privado' },
  { valor: 'unlisted', texto: 'No listado' },
  { valor: 'public', texto: 'Público' },
];
const legible = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1).replace('.', ',')} GB` : `${Math.round(b / 1e6)} MB`);

interface Datos {
  cuentas: { id: number; red: string; nombre: string; estado: string }[];
  publicaciones: { id: number; titulo: string; estado: string; progreso: number; url: string | null; error: string | null; cuenta: string; privacidad: string; programada: string | null }[];
  final: { nombre: string; tamano: number } | null;
  sugerido: { titulo: string; descripcion: string; etiquetas: string[] };
}

/**
 * PUBLICAR UN VIDEO. Lo que se publica es lo que Fernando exportó de CapCut, no la vista previa. Nada
 * sale a una red sin pulsar aquí, y si va a verlo el público se confirma antes.
 */
export default function PanelPublicar({ video, alCerrar }: { video: { id: number; carpeta: string } | null; alCerrar: () => void }) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [cuenta, setCuenta] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [privacidad, setPrivacidad] = useState('private');
  const [programada, setProgramada] = useState('');
  const [subida, setSubida] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const inicial = useRef(false);

  const cargar = useCallback(async () => {
    if (!video) return;
    try {
      const r = await fetch(`${API}/videos/${video.id}/publicar`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo cargar.');
      setDatos(j);
      setError('');
      if (!inicial.current) {
        inicial.current = true;
        setTitulo(j.sugerido.titulo);
        setDescripcion(j.sugerido.descripcion);
        const activas = j.cuentas.filter((c: any) => c.estado === 'activa');
        if (activas.length === 1) setCuenta(String(activas[0].id));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar.'); }
  }, [video]);

  useEffect(() => {
    inicial.current = false;
    setDatos(null); setCuenta(''); setPrivacidad('private'); setProgramada(''); setError('');
    if (video) cargar();
  }, [video, cargar]);

  /* Una subida en curso se sigue aquí. Sin ninguna, no hay nada que consultar. */
  const subiendo = datos?.publicaciones.some((p) => p.estado === 'subiendo');
  useEffect(() => {
    if (!subiendo) return;
    const t = setInterval(cargar, 3000);
    return () => clearInterval(t);
  }, [subiendo, cargar]);

  useEffect(() => {
    const oir = (e: MessageEvent) => { if (e.origin === window.location.origin && e.data === 'red-conectada') cargar(); };
    window.addEventListener('message', oir);
    return () => window.removeEventListener('message', oir);
  }, [cargar]);

  async function subirFinal(archivo: File | undefined) {
    if (!archivo || !video) return;
    setSubida(0); setError('');
    try {
      await subirArchivo(video, archivo, archivo.name, (recibido) => setSubida(recibido / archivo.size), 'final');
      await api(`/videos/${encodeURIComponent(video.carpeta)}/final`, { cuerpo: { nombre: archivo.name, tamano: archivo.size } });
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo subir.'); } finally { setSubida(null); }
  }

  async function publicar() {
    if (!video) return;
    setConfirmar(false); setEnviando(true); setError('');
    try {
      const r = await fetch(`${API}/videos/${video.id}/publicar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuenta_id: Number(cuenta), titulo, descripcion, privacidad, etiquetas: datos?.sugerido.etiquetas || [], programada: programada ? new Date(programada).toISOString() : null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo publicar.');
      toast.success('Subida iniciada.');
      await cargar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo publicar.'); } finally { setEnviando(false); }
  }

  const activas = datos?.cuentas.filter((c) => c.estado === 'activa') || [];
  const canal = activas.find((c) => String(c.id) === cuenta);
  const listo = !!datos?.final && !!canal && !!titulo.trim() && subida === null;
  const enLaMac = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const conectar = () => window.open(`${API}/redes/youtube/conectar`, 'conectar-youtube', 'width=560,height=720');

  return (
    <>
      <EditPanel open={!!video} onClose={alCerrar} title="Publicar" saving={enviando} canSave={listo}
        saveLabel={programada ? 'Programar' : 'Publicar'}
        onSave={() => { if (privacidad === 'public' || programada) setConfirmar(true); else publicar(); }}>
        {!datos && !error && <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-digi-muted" /></div>}
        {error && <p className="text-[13px] text-red-400">{error}</p>}
        {datos && (
          <>
            <EditField label="Versión final">
              <div className="flex items-center gap-3 min-w-0">
                <button type="button" disabled={subida !== null} onClick={() => entrada.current?.click()} className={BTN_SECONDARY}>
                  {subida !== null ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {datos.final ? 'Reemplazar' : 'Subir'}
                </button>
                <span className="text-[13px] text-digi-muted truncate tabular-nums">
                  {subida !== null ? `${Math.round(subida * 100)} %` : datos.final ? legible(datos.final.tamano) : 'Lo que exportaste de CapCut'}
                </span>
                <input ref={entrada} type="file" accept="video/*,.mov,.mkv" className="hidden" onChange={(e) => { subirFinal(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
            </EditField>

            <EditField label="Canal de YouTube">
              {activas.length > 0 && (
                <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className={EDIT_INPUT}>
                  <option value="">Elegir canal</option>
                  {activas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              )}
              {datos.cuentas.filter((c) => c.estado !== 'activa').map((c) => <p key={c.id} className="mt-1.5 text-[13px] text-amber-400">{c.nombre}: hay que volver a conectarlo</p>)}
              {enLaMac
                ? <button type="button" onClick={conectar} className={`${BTN_SECONDARY} mt-2`}>Conectar canal</button>
                : activas.length === 0 && <p className="text-[13px] text-digi-muted">Conéctalo desde el navegador de la Mac</p>}
            </EditField>

            <EditField label="Título">
              <input value={titulo} maxLength={100} onChange={(e) => setTitulo(e.target.value)} className={EDIT_INPUT} />
            </EditField>
            <EditField label="Descripción">
              <textarea value={descripcion} rows={6} onChange={(e) => setDescripcion(e.target.value)} className={EDIT_INPUT} />
            </EditField>
            <EditField label="Visibilidad">
              <select value={programada ? 'public' : privacidad} disabled={!!programada} onChange={(e) => setPrivacidad(e.target.value)} className={EDIT_INPUT}>
                {PRIVACIDAD.map((p) => <option key={p.valor} value={p.valor}>{p.texto}</option>)}
              </select>
            </EditField>
            <EditField label="Programar">
              <input type="datetime-local" value={programada} onChange={(e) => setProgramada(e.target.value)} className={EDIT_INPUT} />
            </EditField>

            {datos.publicaciones.length > 0 && (
              <EditField label="Publicaciones">
                <ul className="space-y-1.5">
                  {datos.publicaciones.map((p) => (
                    <li key={p.id} className="flex items-start gap-2 text-[13px] min-w-0">
                      {p.estado === 'subiendo' ? <RefreshCw className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin text-accent" /> : p.estado === 'publicada' ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-400" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-digi-text truncate">{p.cuenta} · {p.programada ? `Programado: ${new Date(p.programada).toLocaleString('es-ES')}` : PRIVACIDAD.find((x) => x.valor === p.privacidad)?.texto}</span>
                        {p.estado === 'subiendo' && <span className="block text-digi-muted tabular-nums">{Math.round(p.progreso * 100)} %</span>}
                        {p.error && <span className="block text-red-400">{p.error}</span>}
                      </span>
                      {p.url && <a href={p.url} target="_blank" rel="noreferrer" aria-label="Abrir en YouTube" title="Abrir en YouTube" className="shrink-0 text-digi-muted hover:text-digi-text"><ExternalLink className="w-3.5 h-3.5" /></a>}
                    </li>
                  ))}
                </ul>
              </EditField>
            )}
          </>
        )}
      </EditPanel>
      <PixelConfirm open={confirmar} title={programada ? 'Programar publicación' : 'Publicar en YouTube'}
        message={programada ? `«${titulo}» se hará público en ${canal?.nombre || 'el canal'} el ${new Date(programada).toLocaleString('es-ES')}.` : `«${titulo}» quedará visible para todo el mundo en ${canal?.nombre || 'el canal'}.`}
        confirmLabel={programada ? 'Programar' : 'Publicar'} onConfirm={publicar} onCancel={() => setConfirmar(false)} />
    </>
  );
}
