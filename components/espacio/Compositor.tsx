'use client';

import { useEffect, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { ArrowUp, ImagePlus, Loader2, Mic, Square, X } from 'lucide-react';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { useConsultaMedia, PANTALLA_LG } from '@/lib/hooks/useConsultaMedia';
import { BTN_ICONO_PRIMARIO, BTN_ICONO_SECUNDARIO } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { api, cabeceras, MODOS } from './api';

export interface Imagen { tipo: string; datos: string; url: string }
const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

const CLASE_SELECT = 'h-9 sm:h-7 min-w-0 rounded-md border border-digi-border bg-digi-card text-[12px] text-digi-text pl-2 pr-7 outline-none focus:border-digi-muted';

function useDictado(alTexto: (t: string) => void) {
  const [estado, setEstado] = useState<'quieto' | 'grabando' | 'transcribiendo'>('quieto');
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState('');
  const grabador = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (estado !== 'grabando') return;
    setSegundos(0);
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [estado]);

  useEffect(() => () => { grabador.current?.stream.getTracks().forEach((p) => p.stop()); }, []);

  async function empezar() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) { setError('El micrófono necesita entrar por HTTPS.'); return; }
    let flujo: MediaStream;
    try { flujo = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setError('No hay permiso para usar el micrófono.'); return; }
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(flujo, tipo ? { mimeType: tipo } : undefined);
    const trozos: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) trozos.push(e.data); };
    rec.onstop = async () => {
      flujo.getTracks().forEach((p) => p.stop());
      setEstado('transcribiendo');
      const mime = rec.mimeType || tipo || 'audio/webm';
      const form = new FormData();
      form.append('audio', new Blob(trozos, { type: mime }));
      form.append('mimeType', mime);
      try {
        const r = await fetch('/api/espacio-trabajo/dictar', { method: 'POST', body: form, headers: cabeceras() });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'No se pudo transcribir.');
        if (j.texto) alTexto(j.texto); else setError('No se oyó nada.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo transcribir.');
      } finally {
        setEstado('quieto');
      }
    };
    grabador.current = rec;
    rec.start();
    setEstado('grabando');
  }

  return { estado, segundos, error, alternar: () => (estado === 'grabando' ? grabador.current?.stop() : estado === 'quieto' ? empezar() : undefined) };
}

export default function Compositor({
  trabajando, deshabilitado, sesionId, modelo, modo, alCambiarModelo, alCambiarModo, alEnviar, alDetener, alLimpiar,
}: {
  trabajando: boolean;
  deshabilitado?: boolean;
  sesionId: string | null;
  modelo: string;
  modo: string;
  alCambiarModelo: (m: string) => void;
  alCambiarModo: (m: string) => void;
  alEnviar: (texto: string, imagenes: Imagen[]) => Promise<boolean>;
  alDetener: () => void;
  alLimpiar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorImg, setErrorImg] = useState('');
  const [listas, setListas] = useState<{ comandos: { name: string; description?: string }[]; modelos: { value: string; displayName?: string }[] }>({ comandos: [], modelos: [] });
  const [indice, setIndice] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const enEscritorio = useConsultaMedia(PANTALLA_LG);

  const dictado = useDictado((t) => {
    setTexto((act) => (act.trim() ? `${act.trimEnd()} ${t}` : t));
    area.current?.focus();
  });

  useEffect(() => {
    api(`/listas${sesionId ? `?sesion=${sesionId}` : ''}`).then(setListas).catch(() => {});
  }, [sesionId]);

  const buscando = /^\/[^\s]*$/.test(texto) ? texto.slice(1).toLowerCase() : null;
  const sugerencias = useMemo(() => {
    if (buscando === null) return [];
    return listas.comandos.filter((c) => c.name.toLowerCase().includes(buscando)).slice(0, 8);
  }, [buscando, listas.comandos]);
  useEffect(() => setIndice(0), [buscando]);

  async function leerImagen(f: File) {
    setErrorImg('');
    if (!TIPOS_IMAGEN.includes(f.type)) { setErrorImg('Solo PNG, JPG, GIF o WebP.'); return; }
    if (f.size > 10 * 1024 * 1024) { setErrorImg('La imagen pasa de 10 MB.'); return; }
    const url = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f); });
    setImagenes((l) => [...l, { tipo: f.type, datos: url.split(',')[1], url }]);
  }

  function pegar(e: ClipboardEvent) {
    const f = [...e.clipboardData.files].filter((x) => x.type.startsWith('image/'));
    if (f.length) { e.preventDefault(); f.forEach(leerImagen); }
  }

  async function enviar() {
    const t = texto.trim();
    if ((!t && !imagenes.length) || enviando) return;
    if (t === '/clear' || t === '/new' || t === '/reset') { setTexto(''); alLimpiar(); return; }
    setEnviando(true);
    const ok = await alEnviar(t, imagenes);
    setEnviando(false);
    if (ok) { setTexto(''); setImagenes([]); }
  }

  function tecla(e: KeyboardEvent) {
    if (sugerencias.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => (i + 1) % sugerencias.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => (i - 1 + sugerencias.length) % sugerencias.length); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); setTexto(`/${sugerencias[indice].name} `); return; }
    }
    // En el teléfono, Intro es salto de línea: se envía con el botón.
    if (e.key === 'Enter' && !e.shiftKey && enEscritorio && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); }
  }

  const modelos = listas.modelos.length ? listas.modelos : [{ value: 'default', displayName: 'Por defecto' }];
  const minutos = `${Math.floor(dictado.segundos / 60)}:${String(dictado.segundos % 60).padStart(2, '0')}`;
  const error = dictado.error || errorImg;

  return (
    <div className="relative shrink-0 border-t border-digi-border bg-digi-card p-2.5 space-y-2">
      {sugerencias.length > 0 && (
        <ul role="listbox" className="absolute left-2.5 right-2.5 bottom-full mb-1 z-10 rounded-lg border border-digi-border bg-digi-card shadow-lg overflow-hidden">
          {sugerencias.map((c, i) => (
            <li key={c.name} role="option" aria-selected={i === indice}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); setTexto(`/${c.name} `); area.current?.focus(); }}
                className={`w-full flex items-baseline gap-2 px-3 py-2 min-h-11 sm:min-h-0 text-left ${i === indice ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`}>
                <span className="text-[12.5px] font-mono font-medium text-digi-text shrink-0">/{c.name}</span>
                <span className="text-[12px] text-digi-muted truncate min-w-0">{c.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {imagenes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagenes.map((im, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="Adjunto" className="w-14 h-14 object-cover rounded-md border border-digi-border" />
              <button type="button" aria-label="Quitar imagen" title="Quitar imagen" onClick={() => setImagenes((l) => l.filter((_, x) => x !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-digi-text"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}
      {error && <p className={`text-[12px] ${TONO.error.texto}`}>{error}</p>}
      <AutoGrowTextarea ref={area} value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla} onPaste={pegar} disabled={deshabilitado}
        minRows={1} maxHeight={220} placeholder="Escribe o dicta"
        className="sin-marco w-full resize-none px-1 py-1 text-[16px] sm:text-[13.5px] text-digi-text placeholder:text-digi-muted outline-none" />
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
        <input ref={archivo} type="file" accept={TIPOS_IMAGEN.join(',')} multiple hidden onChange={(e) => { [...(e.target.files || [])].forEach(leerImagen); e.target.value = ''; }} />
        <div className="order-first sm:order-none w-full sm:w-auto grid grid-cols-2 sm:flex gap-1.5 min-w-0">
          <select aria-label="Modelo" title="Modelo" value={modelo} onChange={(e) => alCambiarModelo(e.target.value)} className={`${CLASE_SELECT} sm:max-w-40`}>
            {modelos.map((m) => <option key={m.value} value={m.value}>{m.displayName || m.value}</option>)}
          </select>
          <select aria-label="Permisos" title="Permisos" value={modo} onChange={(e) => alCambiarModo(e.target.value)} className={`${CLASE_SELECT} sm:max-w-40`}>
            {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
          </select>
        </div>
        <button type="button" onClick={() => archivo.current?.click()} aria-label="Adjuntar imagen" title="Adjuntar imagen" className={`${BTN_ICONO_SECUNDARIO} sm:order-first`}><ImagePlus className="w-4 h-4" /></button>
        <span className="flex-1" />
        {dictado.estado === 'grabando' && <span className="text-[12px] tabular-nums text-red-400">{minutos}</span>}
        <button type="button" onClick={dictado.alternar} disabled={dictado.estado === 'transcribiendo'}
          aria-label={dictado.estado === 'grabando' ? 'Terminar el dictado' : 'Dictar'} title={dictado.estado === 'grabando' ? 'Terminar el dictado' : 'Dictar'}
          aria-pressed={dictado.estado === 'grabando'}
          className={`${BTN_ICONO_SECUNDARIO} ${dictado.estado === 'grabando' ? '!border-red-400 !text-red-400' : ''}`}>
          {dictado.estado === 'transcribiendo' ? <Loader2 className="w-4 h-4 animate-spin" /> : dictado.estado === 'grabando' ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-4 h-4" />}
        </button>
        {trabajando && !texto.trim() && !imagenes.length
          ? <button type="button" onClick={alDetener} aria-label="Detener" title="Detener" className={BTN_ICONO_SECUNDARIO}><Square className="w-3.5 h-3.5" /></button>
          : <button type="button" onClick={enviar} disabled={enviando || deshabilitado || (!texto.trim() && !imagenes.length)} aria-label="Enviar" title="Enviar" className={BTN_ICONO_PRIMARIO}>
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
            </button>}
      </div>
    </div>
  );
}
