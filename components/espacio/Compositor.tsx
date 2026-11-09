'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { ArrowUp, Loader2, Mic, Paperclip, Square, X } from 'lucide-react';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_ICONO_PRIMARIO, BTN_ICONO_SECUNDARIO } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { api, BASE, cabeceras, claveBorrador, EVENTO_BORRADOR, MODOS } from './api';

export interface Imagen { tipo: string; datos: string; url: string }
interface Adjunto { clave: string; nombre: string; ruta: string | null }
const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_IMAGEN = 10 * 1024 * 1024;
const MAX_ADJUNTO = 100 * 1024 * 1024;

const CLASE_SELECT = 'h-9 sm:h-7 min-w-0 rounded-md border border-digi-border bg-digi-card text-[12px] text-digi-text pl-2 pr-7 outline-none focus:border-digi-muted';

type Listas = { comandos: { name: string; description?: string }[]; modelos: { value: string; displayName?: string }[] };

function useListas(sesionId: string | null) {
  const [listas, setListas] = useState<Listas>({ comandos: [], modelos: [] });
  useEffect(() => {
    api(`/listas${sesionId ? `?sesion=${sesionId}` : ''}`).then(setListas).catch(() => {});
  }, [sesionId]);
  return listas;
}

/** Modelo y permisos. En escritorio van junto al cuadro; en el teléfono, detrás del «⋯». */
export function SelectoresSesion({ sesionId, modelo, modo, columna = false, alCambiarModelo, alCambiarModo }: {
  sesionId: string | null;
  modelo: string;
  modo: string;
  columna?: boolean;
  alCambiarModelo: (m: string) => void;
  alCambiarModo: (m: string) => void;
}) {
  const { modelos } = useListas(sesionId);
  const lista = modelos.length ? modelos : [{ value: 'default', displayName: 'Por defecto' }];
  const clase = columna ? `${CLASE_SELECT} w-full !h-11` : `${CLASE_SELECT} max-w-40`;
  const envoltura = columna ? 'space-y-3' : 'contents';
  const rotulo = (texto: string, control: React.ReactNode) => (columna
    ? <label className="block"><span className="block text-[12px] font-medium text-digi-muted mb-1">{texto}</span>{control}</label>
    : control);
  return (
    <div className={envoltura}>
      {rotulo('Modelo', (
        <select aria-label="Modelo" title="Modelo" value={modelo} onChange={(e) => alCambiarModelo(e.target.value)} className={clase}>
          {lista.map((m) => <option key={m.value} value={m.value}>{m.displayName || m.value}</option>)}
        </select>
      ))}
      {rotulo('Permisos', (
        <select aria-label="Permisos" title="Permisos" value={modo} onChange={(e) => alCambiarModo(e.target.value)} className={clase}>
          {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.texto}</option>)}
        </select>
      ))}
    </div>
  );
}

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
    if (!navigator.mediaDevices?.getUserMedia) { setError('El micrófono no está disponible aquí: hace falta entrar por HTTPS y que la app tenga permiso de micrófono.'); return; }
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

/** Guarda lo que se escribe mientras se escribe. Cada sesión monta su propio compositor. */
function useBorrador(clave: string, texto: string, setTexto: (f: (t: string) => string) => void) {
  const cargado = useRef(false);
  const ultimo = useRef('');
  const pendiente = useRef<string | null>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const escribir = useCallback((t: string) => {
    pendiente.current = null;
    ultimo.current = t;
    api('/borradores', { cuerpo: { clave, texto: t } }).then(() => window.dispatchEvent(new Event(EVENTO_BORRADOR))).catch(() => {});
  }, [clave]);

  useEffect(() => {
    let vivo = true;
    api('/borradores').then((j) => {
      if (!vivo) return;
      const guardado: string = j.borradores[clave] || '';
      ultimo.current = guardado;
      if (guardado) setTexto((act) => act || guardado);
    }).catch(() => {}).finally(() => { cargado.current = true; });
    return () => {
      vivo = false;
      clearTimeout(reloj.current);
      if (pendiente.current !== null) escribir(pendiente.current);
    };
  }, [clave, escribir, setTexto]);

  useEffect(() => {
    if (!cargado.current || texto === ultimo.current) return;
    pendiente.current = texto;
    clearTimeout(reloj.current);
    reloj.current = setTimeout(() => escribir(texto), 400);
  }, [texto, escribir]);

  return {
    /** Al enviar: lo enviado ya no es un borrador, y no debe volver si la sesión cambia en el camino. */
    vaciar: () => { clearTimeout(reloj.current); escribir(''); },
    restaurar: escribir,
  };
}

export default function Compositor({
  proyectoId, trabajando, detenible, deshabilitado, sesionId, modelo, modo, enEscritorio, alCambiarModelo, alCambiarModo, alEnviar, alDetener, alLimpiar,
}: {
  proyectoId: string;
  trabajando: boolean;
  detenible: boolean;
  deshabilitado?: boolean;
  sesionId: string | null;
  modelo: string;
  modo: string;
  enEscritorio: boolean;
  alCambiarModelo: (m: string) => void;
  alCambiarModo: (m: string) => void;
  alEnviar: (texto: string, imagenes: Imagen[], adjuntos: string[]) => Promise<boolean>;
  alDetener: () => void;
  alLimpiar: () => void;
}) {
  const [texto, setTexto] = useState('');
  const [imagenes, setImagenes] = useState<Imagen[]>([]);
  const [adjuntos, setAdjuntos] = useState<Adjunto[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [encima, setEncima] = useState(false);
  const { comandos } = useListas(sesionId);
  const [indice, setIndice] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [cerrado, setCerrado] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const archivo = useRef<HTMLInputElement>(null);

  const borrador = useBorrador(claveBorrador(proyectoId, sesionId), texto, setTexto);
  useEffect(() => { if (enEscritorio) area.current?.focus(); }, [enEscritorio]);

  const dictado = useDictado((t) => {
    setTexto((act) => (act.trim() ? `${act.trimEnd()} ${t}` : t));
    setCerrado(true);
    area.current?.focus();
  });

  /* La palabra que se está escribiendo, si empieza con «/»: en cualquier punto del texto, porque
     Fernando encadena skills («/memoria /aprendizaje …»). Una ruta como /Users/x no cuenta. */
  const palabra = useMemo(() => {
    const m = texto.slice(0, cursor).match(/(?:^|\s)\/([^\s/]*)$/);
    return m ? { inicio: cursor - m[1].length - 1, busca: m[1].toLowerCase() } : null;
  }, [texto, cursor]);
  const sugerencias = useMemo(() => {
    if (!palabra || cerrado) return [];
    return comandos.filter((c) => c.name.toLowerCase().includes(palabra.busca)).slice(0, 8);
  }, [palabra, cerrado, comandos]);
  useEffect(() => { setIndice(0); setCerrado(false); }, [palabra?.inicio, palabra?.busca]);

  function completar(nombre: string) {
    if (!palabra) return;
    const nuevo = `${texto.slice(0, palabra.inicio)}/${nombre} ${texto.slice(cursor)}`;
    const posicion = palabra.inicio + nombre.length + 2;
    setTexto(nuevo);
    setCursor(posicion);
    requestAnimationFrame(() => { area.current?.focus(); area.current?.setSelectionRange(posicion, posicion); });
  }

  async function subir(f: File) {
    if (f.size > MAX_ADJUNTO) { setErrorArchivo(`${f.name} pasa de 100 MB.`); return; }
    const clave = crypto.randomUUID();
    setAdjuntos((l) => [...l, { clave, nombre: f.name, ruta: null }]);
    try {
      const r = await fetch(`${BASE}/proyectos/${proyectoId}/adjuntos?nombre=${encodeURIComponent(f.name)}`, { method: 'POST', headers: cabeceras({ 'Content-Type': 'application/octet-stream' }), body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo subir.');
      setAdjuntos((l) => l.map((a) => (a.clave === clave ? { ...a, ruta: j.ruta } : a)));
    } catch (e) {
      setAdjuntos((l) => l.filter((a) => a.clave !== clave));
      setErrorArchivo(`${f.name}: ${e instanceof Error ? e.message : 'no se pudo subir.'}`);
    }
  }

  /** Una imagen pequeña va en el mensaje, y Claude la ve directo. Lo demás se guarda y lo lee con Read. */
  async function agregar(lista: File[]) {
    setErrorArchivo('');
    for (const f of lista) {
      if (TIPOS_IMAGEN.includes(f.type) && f.size <= MAX_IMAGEN) {
        const url = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(f); });
        setImagenes((l) => [...l, { tipo: f.type, datos: url.split(',')[1], url }]);
      } else subir(f);
    }
  }

  function pegar(e: ClipboardEvent) {
    const f = [...e.clipboardData.files];
    if (f.length) { e.preventDefault(); agregar(f); }
  }

  function soltar(e: DragEvent) {
    e.preventDefault();
    setEncima(false);
    agregar([...e.dataTransfer.files]);
  }

  const subiendo = adjuntos.some((a) => !a.ruta);
  const hayAlgo = !!(texto.trim() || imagenes.length || adjuntos.length);

  async function enviar() {
    const t = texto.trim();
    if (!hayAlgo || enviando || subiendo) return;
    if (t === '/clear' || t === '/new' || t === '/reset') { setTexto(''); alLimpiar(); return; }
    if (t === '/plan') { setTexto(''); alCambiarModo('plan'); return; }
    setEnviando(true);
    borrador.vaciar();
    const ok = await alEnviar(t, imagenes, adjuntos.map((a) => a.ruta as string));
    setEnviando(false);
    if (ok) { setTexto(''); setImagenes([]); setAdjuntos([]); } else if (t) borrador.restaurar(t);
  }

  /* Esc para, como en la terminal, con el cursor en el cuadro o sin foco en ningún control. */
  useEffect(() => {
    if (!detenible) return;
    const alPulsar = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape' && document.activeElement === document.body) alDetener(); };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [detenible, alDetener]);

  function tecla(e: KeyboardEvent) {
    if (sugerencias.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setIndice((i) => (i + 1) % sugerencias.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIndice((i) => (i - 1 + sugerencias.length) % sugerencias.length); return; }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); completar(sugerencias[indice].name); return; }
      if (e.key === 'Escape') { e.preventDefault(); setCerrado(true); return; }
    }
    if (e.key === 'Escape' && detenible) { e.preventDefault(); alDetener(); return; }
    // En el teléfono, Intro es salto de línea: se envía con el botón.
    if (e.key === 'Enter' && !e.shiftKey && enEscritorio && !e.nativeEvent.isComposing) { e.preventDefault(); enviar(); }
  }

  const minutos = `${Math.floor(dictado.segundos / 60)}:${String(dictado.segundos % 60).padStart(2, '0')}`;
  const error = dictado.error || errorArchivo;
  const grabando = dictado.estado === 'grabando';

  const campo = (
    <AutoGrowTextarea ref={area} value={texto} onChange={(e) => { setTexto(e.target.value); setCursor(e.target.selectionStart); }} onSelect={(e) => setCursor(e.currentTarget.selectionStart)} onKeyDown={tecla} onPaste={pegar} disabled={deshabilitado}
      minRows={1} maxHeight={enEscritorio ? 220 : 120} placeholder="Escribe o dicta"
      className={`sin-marco ${enEscritorio ? 'w-full' : 'flex-1 min-w-0 self-center'} resize-none px-1 py-1 text-[16px] lg:text-[13.5px] text-digi-text placeholder:text-digi-muted outline-none`} />
  );
  const icono = enEscritorio ? '' : '!border-0 !w-9 !h-9 !min-w-9 !min-h-9 shrink-0';
  const adjuntar = (
    <button type="button" onClick={() => archivo.current?.click()} aria-label="Adjuntar archivo" title="Adjuntar archivo" className={`${BTN_ICONO_SECUNDARIO} ${icono}`}><Paperclip className="w-4 h-4" /></button>
  );
  const microfono = (
    <button type="button" onClick={dictado.alternar} disabled={dictado.estado === 'transcribiendo'}
      aria-label={grabando ? 'Terminar el dictado' : 'Dictar'} title={grabando ? 'Terminar el dictado' : 'Dictar'} aria-pressed={grabando}
      className={`${BTN_ICONO_SECUNDARIO} ${icono} ${grabando ? '!border-red-400 !text-red-400' : ''}`}>
      {dictado.estado === 'transcribiendo' ? <Loader2 className="w-4 h-4 animate-spin" /> : grabando ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-4 h-4" />}
    </button>
  );
  /* Parar va aparte de enviar: lo escrito se queda en el cuadro para mandar la corrección. */
  const detener = detenible && (
    <button type="button" onClick={alDetener} aria-label="Detener" title={enEscritorio ? 'Detener (Esc)' : 'Detener'} className={`${BTN_ICONO_SECUNDARIO} ${icono} !border-red-400 !text-red-400`}><Square className="w-3.5 h-3.5 fill-current" /></button>
  );
  const principal = detenible && !hayAlgo ? null
    : <button type="button" onClick={enviar} disabled={enviando || subiendo || deshabilitado || !hayAlgo} aria-label="Enviar" title="Enviar" className={`${BTN_ICONO_PRIMARIO} ${enEscritorio ? '' : '!w-9 !h-9 !min-w-9 !min-h-9 shrink-0'}`}>
        {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
      </button>;
  const contador = grabando && <span className="text-[12px] tabular-nums text-red-400 shrink-0">{minutos}</span>;

  return (
    <div onDragOver={(e) => { e.preventDefault(); setEncima(true); }} onDragLeave={() => setEncima(false)} onDrop={soltar}
      className={`relative shrink-0 border-t bg-digi-card p-1.5 lg:p-2.5 space-y-1.5 lg:space-y-2 ${encima ? 'border-accent' : 'border-digi-border'}`}>
      <input ref={archivo} type="file" multiple hidden onChange={(e) => { agregar([...(e.target.files || [])]); e.target.value = ''; }} />
      {sugerencias.length > 0 && (
        <ul role="listbox" className="absolute left-2.5 right-2.5 bottom-full mb-1 z-10 rounded-lg border border-digi-border bg-digi-card shadow-lg overflow-hidden">
          {sugerencias.map((c, i) => (
            <li key={c.name} role="option" aria-selected={i === indice}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); completar(c.name); }}
                className={`w-full flex items-baseline gap-2 px-3 py-2 min-h-11 sm:min-h-0 text-left ${i === indice ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`}>
                <span className="text-[12.5px] font-mono font-medium text-digi-text shrink-0">/{c.name}</span>
                <span className="text-[12px] text-digi-muted truncate min-w-0">{c.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {(imagenes.length > 0 || adjuntos.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0 max-h-28 overflow-y-auto px-1 pt-1.5">
          {imagenes.map((im, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.url} alt="Adjunto" className="w-11 h-11 object-cover rounded-md border border-digi-border" />
              <button type="button" aria-label="Quitar imagen" title="Quitar imagen" onClick={() => setImagenes((l) => l.filter((_, x) => x !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-digi-text"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {adjuntos.map((a) => (
            <span key={a.clave} className="inline-flex items-center gap-1.5 min-w-0 max-w-full text-[12px] text-digi-text">
              {a.ruta ? <Paperclip className="w-3.5 h-3.5 shrink-0 text-digi-muted" /> : <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-digi-muted" />}
              <span className="truncate min-w-0 max-w-52" title={a.nombre}>{a.nombre}</span>
              <button type="button" aria-label={`Quitar ${a.nombre}`} title="Quitar" onClick={() => setAdjuntos((l) => l.filter((x) => x.clave !== a.clave))} className="destino-tactil shrink-0 text-digi-muted hover:text-digi-text"><X className="w-3.5 h-3.5" /></button>
            </span>
          ))}
        </div>
      )}
      {error && <p className={`px-1 text-[12px] ${TONO.error.texto}`}>{error}</p>}
      {enEscritorio ? (
        <>
          {campo}
          <div className="flex items-center gap-1.5">
            {adjuntar}
            <SelectoresSesion sesionId={sesionId} modelo={modelo} modo={modo} alCambiarModelo={alCambiarModelo} alCambiarModo={alCambiarModo} />
            <span className="flex-1" />
            {contador}{microfono}{detener}{principal}
          </div>
        </>
      ) : (
        <div className="flex items-end gap-0.5">{adjuntar}{campo}{contador && <span className="self-center">{contador}</span>}{microfono}{detener}{principal}</div>
      )}
    </div>
  );
}
