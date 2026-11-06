'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Send, Loader2, AlertTriangle, X } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import Segmentado from '@/components/ui/Segmentado';
import { cabeceras, guardarToken } from '@/components/espacio/api';
import { abrirMicrofono } from './microfono';

const API = '/api/copiloto/nucleo';
const TONO_VOZ = 1.55;

type Consulta = { id: number; pregunta: string; respuesta: string; buscando: boolean; detalle?: string; terminada: boolean };
type Linea = { quien: string; texto: string };

function hablar(texto: string) {
  if (!('speechSynthesis' in window)) return;
  const limpio = texto.replace(/[*_`#>]/g, '').replace(/\$\s*([0-9.,]+)/g, '$1 dólares').replace(/([0-9.,]+)\s*\$/g, '$1 dólares').replace(/\/mes/g, ' al mes').trim();
  window.speechSynthesis.cancel();
  if (!limpio) return;
  const u = new SpeechSynthesisUtterance(limpio);
  const voces = window.speechSynthesis.getVoices();
  u.voice = voces.find((v) => v.lang === 'es-MX' && /paulina/i.test(v.name)) || voces.find((v) => v.lang.startsWith('es-MX')) || voces.find((v) => v.lang.startsWith('es')) || null;
  u.lang = u.voice?.lang || 'es-MX';
  u.pitch = TONO_VOZ;
  window.speechSynthesis.speak(u);
}

/** La misma cuenta atrás de la Mac: baja mientras callas y vuelve a empezar si hablas. */
function CuentaAtras({ restante, total }: { restante: number | null; total: number }) {
  const r = 12;
  const largo = 2 * Math.PI * r;
  const parte = Math.min(1, (restante ?? total) / total);
  return (
    <span className="relative w-8 h-8 shrink-0 inline-flex items-center justify-center" role="timer" aria-label={restante == null ? 'Escuchando' : `Envío en ${Math.ceil(restante)} segundos`}>
      <svg viewBox="0 0 32 32" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-digi-border" />
        <circle cx="16" cy="16" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-accent transition-[stroke-dashoffset] duration-100" strokeDasharray={largo} strokeDashoffset={largo * (1 - parte)} />
      </svg>
      <span className="text-[12px] font-semibold tabular-nums text-digi-text">{Math.ceil(restante ?? total)}</span>
    </span>
  );
}

/**
 * GUMDRAMON EN EL TELÉFONO (Fernando, 2026-11-05: «tal cual lo hacen las apps de administración»). Va por
 * Tailscale a la Mac, que transcribe y consulta. Aquí solo se escucha, se pinta y se lee en voz alta.
 *
 * Un solo micrófono: todo lo que oye es de Fernando para el núcleo, así que aquí se pregunta con «GUMDRAMON».
 */
export default function PanelGumdramon() {
  const [activo, setActivo] = useState(false);
  const [dispositivo, setDispositivo] = useState('mac');
  const [conectado, setConectado] = useState(false);
  const [capturando, setCapturando] = useState(false);
  const [consultas, setConsultas] = useState<Consulta[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [dictado, setDictado] = useState<{ texto: string; restante: number | null; total: number } | null>(null);
  const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState('');
  const [nivel, setNivel] = useState(0);
  const [vista, setVista] = useState<'respuestas' | 'transcripcion'>('respuestas');
  const [texto, setTexto] = useState('');
  const [voz, setVoz] = useState(false);
  const vozRef = useRef(false);
  const mic = useRef<Awaited<ReturnType<typeof abrirMicrofono>> | null>(null);
  const pantalla = useRef<any>(null);
  const finLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const v = localStorage.getItem('gumdramon_voz') === '1';
    setVoz(v); vozRef.current = v;
  }, []);

  const llamar = useCallback(async (ruta: string, cuerpo?: unknown) => {
    const r = await fetch(`${API}/${ruta}`, { method: 'POST', headers: cabeceras({ 'Content-Type': 'application/json' }), body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { guardarToken(null); window.dispatchEvent(new Event('espacio-sin-sesion')); }
    if (!r.ok) throw new Error(j.error || `La Mac respondió ${r.status}`);
    return j;
  }, []);

  const apagarCaptura = useCallback(() => {
    mic.current?.cerrar();
    mic.current = null;
    setCapturando(false);
    setNivel(0);
    pantalla.current?.release?.().catch?.(() => {});
    pantalla.current = null;
  }, []);

  const mantenerPantalla = useCallback(async () => {
    try { pantalla.current = await (navigator as any).wakeLock?.request('screen'); } catch { /* sin eso, se apagará según el ajuste del teléfono */ }
  }, []);

  const evento = useCallback((nombre: string, d: any) => {
    switch (nombre) {
      case 'estado':
        setActivo(!!d.activo);
        setDispositivo(d.dispositivo || 'mac');
        if (!d.activo || d.dispositivo !== 'telefono') apagarCaptura();
        break;
      case 'transcripcion': setLineas((l) => [...l.slice(-300), { quien: d.quien, texto: d.texto }]); break;
      case 'escuchando':
        setDictado(d.activo ? { texto: d.texto || '', restante: d.restante ?? null, total: d.total ?? 4 } : null);
        break;
      case 'consulta':
        setDictado(null);
        setConsultas((c) => [...c, { id: d.id, pregunta: d.pregunta, respuesta: '', buscando: false, terminada: false }]);
        break;
      case 'buscando': setConsultas((c) => c.map((x) => (x.id === d.id ? { ...x, buscando: true, respuesta: '', detalle: d.detalle } : x))); break;
      case 'parcial': setConsultas((c) => c.map((x) => (x.id === d.id ? { ...x, buscando: false, respuesta: d.texto } : x))); break;
      case 'respuesta':
        setConsultas((c) => c.map((x) => (x.id === d.id ? { ...x, buscando: false, terminada: true, respuesta: d.texto } : x)));
        if (vozRef.current) hablar(d.texto);
        break;
      case 'descartada': setConsultas((c) => c.filter((x) => x.id !== d.id)); break;
      case 'terminada':
        apagarCaptura();
        setNota(d.conTranscripcion ? 'Sesión terminada. Creando el recordatorio…' : 'Sesión terminada, sin nada que guardar.');
        break;
      case 'recordatorio': setNota(`Recordatorio creado: ${d.titulo || ''}`); break;
      case 'error':
        if (d.id != null) setConsultas((c) => c.filter((x) => x.id !== d.id));
        setAviso(/limit/i.test(d.mensaje || '') ? 'Se alcanzó el límite de Claude: no habrá respuestas hasta que se libere.' : d.mensaje || 'Error');
        break;
    }
  }, [apagarCaptura]);

  // Los eventos van por `fetch`: EventSource no deja mandar la cabecera de la sesión.
  useEffect(() => {
    const corte = new AbortController();
    (async () => {
      while (!corte.signal.aborted) {
        try {
          const r = await fetch(`${API}/eventos`, { headers: cabeceras(), signal: corte.signal });
          if (r.status === 401) { guardarToken(null); window.dispatchEvent(new Event('espacio-sin-sesion')); return; }
          if (!r.ok || !r.body) throw new Error();
          setConectado(true);
          const lector = r.body.getReader();
          const dec = new TextDecoder();
          let resto = '';
          for (;;) {
            const { value, done } = await lector.read();
            if (done) break;
            resto += dec.decode(value, { stream: true });
            let i;
            while ((i = resto.indexOf('\n\n')) >= 0) {
              const b = resto.slice(0, i);
              resto = resto.slice(i + 2);
              const nombre = b.match(/^event: (.*)$/m)?.[1];
              const dato = b.match(/^data: (.*)$/m)?.[1];
              if (nombre && dato) evento(nombre, JSON.parse(dato));
            }
          }
        } catch { /* se reintenta abajo */ }
        if (corte.signal.aborted) return;
        setConectado(false);
        await new Promise((res) => setTimeout(res, 2000));
      }
    })();
    return () => corte.abort();
  }, [evento]);

  // Al volver de otra app o de la pantalla bloqueada, el audio queda pausado: se reanuda.
  useEffect(() => {
    const volver = () => {
      if (document.visibilityState !== 'visible' || !mic.current) return;
      mic.current.reanudar();
      mantenerPantalla();
    };
    document.addEventListener('visibilitychange', volver);
    return () => document.removeEventListener('visibilitychange', volver);
  }, [mantenerPantalla]);

  useEffect(() => () => apagarCaptura(), [apagarCaptura]);

  useEffect(() => { finLista.current?.scrollIntoView?.({ block: 'end' }); }, [consultas, dictado, lineas.length, vista]);

  const alternar = async () => {
    setAviso(''); setNota('');
    try {
      if (capturando) {
        apagarCaptura();
        await llamar('desactivar');
        return;
      }
      // Dentro del toque: Safari solo abre el micrófono y el audio a partir de un gesto.
      mic.current = await abrirMicrofono(setNivel);
      setCapturando(true);
      mantenerPantalla();
      await llamar('activar?dispositivo=telefono');
    } catch (e: any) {
      apagarCaptura();
      setAviso(e?.name === 'NotAllowedError' ? 'Falta el permiso del micrófono.' : e?.message || 'No se pudo activar.');
    }
  };

  const alternarVoz = () => {
    const v = !voz;
    setVoz(v); vozRef.current = v;
    localStorage.setItem('gumdramon_voz', v ? '1' : '0');
    // Safari solo deja hablar después de un toque: este deja la voz lista para las respuestas.
    if (v) hablar('Voz activada'); else window.speechSynthesis?.cancel();
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setTexto('');
    try { await llamar('consulta', { texto: t }); } catch (e: any) { setAviso(e.message); }
  };

  const terminar = async () => {
    apagarCaptura();
    setNota('Guardando la transcripción…');
    try { await llamar('terminar'); } catch (e: any) { setAviso(e.message); }
  };

  const enOtro = activo && dispositivo !== 'telefono';

  return (
    <div className="h-full flex flex-col bg-digi-dark text-digi-text" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="shrink-0 flex items-center gap-2.5 px-4 h-14 border-b border-digi-border bg-digi-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/copiloto/icono" alt="" className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className="min-w-0 flex-1">
          <h1 className="titulo-progreso text-[15px] leading-tight">{dictado ? 'Te escucho…' : 'Gumdramon'}</h1>
          <p className="text-[11.5px] text-digi-muted truncate">
            {!conectado ? 'Sin conexión con la Mac' : capturando ? 'Escuchando desde este teléfono' : enOtro ? 'Escuchando desde la Mac' : 'Desactivado'}
          </p>
        </div>
        {capturando && (
          <span className="w-12 h-1 rounded-full bg-digi-border overflow-hidden" aria-hidden>
            <span className="block h-full bg-accent" style={{ width: `${Math.min(100, nivel * 800)}%` }} />
          </span>
        )}
        <button type="button" onClick={alternarVoz} aria-label={voz ? 'Apagar la voz' : 'Activar la voz'} aria-pressed={voz}
          className="w-10 h-10 rounded-lg inline-flex items-center justify-center text-digi-muted hover:text-digi-text">
          {voz ? <Volume2 className="w-5 h-5 text-accent" /> : <VolumeX className="w-5 h-5" />}
        </button>
      </header>

      {aviso && (
        <div className="shrink-0 flex items-start gap-2 px-4 py-2 border-b border-digi-border text-[12.5px]">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
          <span className="flex-1 min-w-0">{aviso}</span>
          <button type="button" onClick={() => setAviso('')} aria-label="Cerrar aviso" className="text-digi-muted"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="shrink-0 px-4 pt-3">
        <Segmentado<'respuestas' | 'transcripcion'> etiqueta="Vista" className="w-full" valor={vista} onChange={setVista}
          opciones={[{ valor: 'respuestas', texto: 'Respuestas' }, { valor: 'transcripcion', texto: 'Transcripción' }]} />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
        {vista === 'respuestas' ? (
          <>
            {!consultas.length && !dictado && (
              <p className="text-center text-[13px] text-digi-muted pt-10">{capturando ? 'Di «GUMDRAMON» y tu pregunta.' : 'Actívalo para empezar.'}</p>
            )}
            {consultas.map((c) => (
              <article key={c.id} className="bg-digi-card border border-digi-border rounded-xl p-3.5">
                <p className="text-[12px] text-digi-muted whitespace-pre-wrap">{c.pregunta}</p>
                {c.respuesta ? (
                  <p className="mt-1.5 text-[15.5px] font-medium leading-snug whitespace-pre-wrap">{c.respuesta}</p>
                ) : !c.terminada && (
                  <div className="mt-2 flex items-center gap-2 text-[12.5px] text-digi-muted">
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none shrink-0" />
                    <span className="flex-1 min-w-0 truncate">{c.buscando ? c.detalle || 'Investigando…' : 'Pensando…'}</span>
                    <button type="button" onClick={() => llamar('detener').catch(() => {})} className={`${BTN_SECONDARY} !py-1 !px-2.5 !min-h-0 text-[12px]`}>Detener</button>
                  </div>
                )}
              </article>
            ))}
            {dictado && (
              <article className="border border-accent rounded-xl p-3.5">
                <div className="flex items-center gap-2.5">
                  <CuentaAtras restante={dictado.restante} total={dictado.total} />
                  <span className="text-[12px] text-digi-muted">{dictado.restante == null ? 'Te escucho' : 'Envío al llegar a 0. Si sigues hablando, vuelve a empezar.'}</span>
                </div>
                {dictado.texto && <p className="mt-2 text-[14.5px] leading-snug">{dictado.texto}</p>}
              </article>
            )}
          </>
        ) : (
          lineas.length
            ? lineas.map((l, i) => <p key={i} className="text-[13px] leading-snug"><strong className={`font-semibold ${l.quien === 'Cliente' ? 'text-accent' : 'text-digi-muted'}`}>{l.quien}:</strong> {l.texto}</p>)
            : <p className="text-center text-[13px] text-digi-muted pt-10">Todavía no hay transcripción.</p>
        )}
        <div ref={finLista} />
      </main>

      <footer className="shrink-0 border-t border-digi-border bg-digi-card p-3 space-y-2">
        {nota && <p className="text-[12px] text-digi-muted">{nota}</p>}
        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex gap-2">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} disabled={!activo} placeholder={activo ? 'Pregúntale algo…' : 'Actívalo para preguntar'} aria-label="Pregunta escrita"
            className="field-control flex-1 min-w-0 px-3 py-2.5 bg-digi-darker border border-digi-border text-[16px] text-digi-text placeholder:text-digi-muted/60 focus:outline-none" />
          <button type="submit" disabled={!activo || !texto.trim()} aria-label="Enviar" className={`${BTN_SECONDARY} !px-3`}><Send className="w-4 h-4" /></button>
        </form>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={terminar} disabled={!activo && !lineas.length} className={BTN_SECONDARY}>Terminar</button>
          <button type="button" onClick={alternar} disabled={!conectado} className={BTN_PRIMARY}>{capturando ? 'Desactivar' : enOtro ? 'Usar este teléfono' : 'Activar'}</button>
        </div>
      </footer>
    </div>
  );
}
