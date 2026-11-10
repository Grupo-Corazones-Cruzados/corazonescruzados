'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mic, MicOff, Phone, PhoneOff, MessageSquare } from 'lucide-react';
import { conBase } from '@/lib/base';
import { cn } from '@/lib/utils';
import { colgarLlamada, contestarLlamada, rechazarLlamada } from '@/acciones/llamadas';

type Sonando = { id: number; sdp: string | null; conversacionId: number | null; nombre: string; numero: string; numeroNegocio: string | null };
type EnCurso = { id: number; nombre: string; numero: string; conversacionId: number | null; desde: number | null };

const TERMINADAS = new Set(['TERMINADA', 'PERDIDA', 'RECHAZADA', 'FALLIDA']);

/**
 * EL AVISO DE LLAMADAS ENTRANTES DE WHATSAPP (Fernando, 2026-11-10: «la llamada va a estar
 * habilitada solo para recibir llamadas»). Montado en el armazón del panel solo en negocios con
 * algún número Cloud API que recibe llamadas.
 *
 * Pregunta cada 2,5 s qué suena (`/api/llamadas`). Al contestar, ESTE navegador lleva el audio
 * con WebRTC directo con Meta: micrófono → oferta de Meta → respuesta → el servidor la manda
 * (`pre_accept` + `accept`). Meta es ICE-lite y no exige STUN/TURN, pero detrás de un router el
 * navegador necesita su dirección pública: se pide a un STUN público.
 *
 * Sonido: un timbre hecho con WebAudio (sin archivo). Los navegadores solo dejan sonar si ya
 * hubo un clic en la página; si no, se ve la tarjeta igual.
 */
export function AvisoLlamadas({ slug }: { slug: string }) {
  const [sonando, setSonando] = useState<Sonando[]>([]);
  const [enCurso, setEnCurso] = useState<EnCurso | null>(null);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [silencio, setSilencio] = useState(false);
  const [ahora, setAhora] = useState(() => Date.now());
  const pc = useRef<RTCPeerConnection | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const activa = useRef<number | null>(null);

  const limpiar = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    mic.current?.getTracks().forEach((t) => t.stop());
    mic.current = null;
    if (audio.current) audio.current.srcObject = null;
    activa.current = null;
    setEnCurso(null);
    setSilencio(false);
  }, []);

  // Preguntar qué suena y si la llamada en curso sigue viva.
  useEffect(() => {
    let vivo = true;
    const preguntar = async () => {
      try {
        const id = activa.current;
        const r = await fetch(conBase(`/api/llamadas${id ? `?activa=${id}` : ''}`), { cache: 'no-store' });
        if (!r.ok || !vivo) return;
        const d = (await r.json()) as { sonando: Sonando[]; activa: { id: number; estado: string } | null };
        setSonando(d.sonando);
        if (id && d.activa && d.activa.id === id && TERMINADAS.has(d.activa.estado)) {
          toast.info('La llamada terminó.');
          limpiar();
        }
      } catch { /* sin red: se vuelve a intentar */ }
    };
    void preguntar();
    const t = window.setInterval(preguntar, 2500);
    return () => { vivo = false; window.clearInterval(t); };
  }, [limpiar]);

  // El reloj de la llamada en curso.
  useEffect(() => {
    if (!enCurso?.desde) return;
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [enCurso?.desde]);

  // El timbre mientras suena algo y no se está en otra llamada.
  const suena = sonando.length > 0 && !enCurso;
  useEffect(() => {
    if (!suena) return;
    let ctx: AudioContext | null = null;
    try { ctx = new AudioContext(); } catch { return; }
    const tono = () => {
      if (!ctx || ctx.state === 'closed') return;
      void ctx.resume().catch(() => {});
      for (const [i, f] of [[0, 880], [0.25, 660]] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ctx.currentTime + i);
        g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + i + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i + 0.22);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + i);
        o.stop(ctx.currentTime + i + 0.25);
      }
    };
    tono();
    const t = window.setInterval(tono, 2000);
    return () => { window.clearInterval(t); void ctx?.close(); };
  }, [suena]);

  // Al cerrar la pestaña con una llamada en curso, se cuelga.
  useEffect(() => {
    const alSalir = () => { if (activa.current) void colgarLlamada(slug, activa.current); };
    window.addEventListener('pagehide', alSalir);
    return () => window.removeEventListener('pagehide', alSalir);
  }, [slug]);

  async function contestar(l: Sonando) {
    if (!l.sdp) { toast.error('La llamada llegó sin datos de audio.'); return; }
    setOcupado(l.id);
    try {
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic.current = flujo;
      const conexion = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.current = conexion;
      flujo.getTracks().forEach((t) => conexion.addTrack(t, flujo));
      conexion.ontrack = (e) => {
        if (audio.current) { audio.current.srcObject = e.streams[0]; void audio.current.play().catch(() => {}); }
      };
      conexion.onconnectionstatechange = () => {
        if (conexion.connectionState === 'failed' && activa.current) {
          toast.error('Se perdió el audio de la llamada.');
          void colgarLlamada(slug, activa.current);
          limpiar();
        }
      };
      await conexion.setRemoteDescription({ type: 'offer', sdp: l.sdp });
      await conexion.setLocalDescription(await conexion.createAnswer());
      // Meta no recibe candidatos sueltos: la respuesta sale con los que haya en 2,5 s.
      await new Promise<void>((listo) => {
        if (conexion.iceGatheringState === 'complete') return listo();
        const t = window.setTimeout(listo, 2500);
        conexion.onicegatheringstatechange = () => {
          if (conexion.iceGatheringState === 'complete') { window.clearTimeout(t); listo(); }
        };
      });
      const r = await contestarLlamada(slug, l.id, conexion.localDescription?.sdp ?? '');
      if (!r.ok) { toast.error(r.error, { duration: 10000 }); limpiar(); return; }
      activa.current = l.id;
      setEnCurso({ id: l.id, nombre: l.nombre, numero: l.numero, conversacionId: l.conversacionId, desde: Date.now() });
      setSonando((x) => x.filter((y) => y.id !== l.id));
    } catch (e) {
      const permiso = e instanceof DOMException && e.name === 'NotAllowedError';
      toast.error(permiso ? 'El navegador no dio permiso al micrófono: sin él no se puede contestar.' : `No se pudo contestar: ${e instanceof Error ? e.message : e}`, { duration: 10000 });
      limpiar();
    } finally {
      setOcupado(null);
    }
  }

  async function rechazar(l: Sonando) {
    setOcupado(l.id);
    const r = await rechazarLlamada(slug, l.id);
    setOcupado(null);
    if (!r.ok) toast.error(r.error);
    setSonando((x) => x.filter((y) => y.id !== l.id));
  }

  async function colgar() {
    const id = activa.current;
    limpiar();
    if (id) await colgarLlamada(slug, id);
  }

  function silenciar() {
    const s = !silencio;
    mic.current?.getAudioTracks().forEach((t) => { t.enabled = !s; });
    setSilencio(s);
  }

  const reloj = enCurso?.desde ? Math.max(0, Math.floor((ahora - enCurso.desde) / 1000)) : 0;
  const visibles = enCurso ? [] : sonando;

  return (
    <>
      {/* El audio del contacto. Siempre montado: el navegador lo deja sonar tras el clic de «Contestar». */}
      <audio ref={audio} autoPlay className="hidden" />
      {(visibles.length > 0 || enCurso) && (
        <div className="pointer-events-none fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-50 flex w-[min(340px,calc(100vw-1.5rem))] flex-col gap-2 lg:bottom-4 lg:right-4">
          {visibles.map((l) => (
            <div key={l.id} role="alertdialog" aria-label={`Llamada de ${l.nombre}`}
              className="superficie-flotante pointer-events-auto flex items-center gap-3 rounded-lg border border-borde bg-tarjeta p-3 shadow-2xl">
              <Inicial nombre={l.nombre} sonando />
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-tenue">Llamada de WhatsApp{l.numeroNegocio ? ` · a ${l.numeroNegocio}` : ''}</p>
                <p className="truncate text-[14px] font-semibold text-texto">{l.nombre}</p>
                {l.nombre !== l.numero && <p className="truncate text-[12px] text-tenue">+{l.numero}</p>}
              </div>
              <BotonRedondo titulo="Rechazar" peligro onClick={() => rechazar(l)} disabled={ocupado !== null}><PhoneOff className="h-5 w-5" /></BotonRedondo>
              <BotonRedondo titulo="Contestar" onClick={() => contestar(l)} disabled={ocupado !== null}><Phone className="h-5 w-5" /></BotonRedondo>
            </div>
          ))}
          {enCurso && (
            <div role="status" aria-label={`En llamada con ${enCurso.nombre}`}
              className="superficie-flotante pointer-events-auto flex items-center gap-3 rounded-lg border border-borde bg-tarjeta p-3 shadow-2xl">
              <Inicial nombre={enCurso.nombre} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-texto">{enCurso.nombre}</p>
                <p className="text-[12px] tabular-nums text-acento">{Math.floor(reloj / 60)}:{String(reloj % 60).padStart(2, '0')}</p>
              </div>
              {enCurso.conversacionId && (
                <Link href={`/${slug}/conversaciones?c=${enCurso.conversacionId}`} title="Abrir el chat" aria-label="Abrir el chat"
                  className="foco-visible flex h-10 w-10 items-center justify-center rounded-full border border-borde text-texto hover:bg-realce">
                  <MessageSquare className="h-4.5 w-4.5" />
                </Link>
              )}
              <BotonRedondo titulo={silencio ? 'Activar micrófono' : 'Silenciar'} neutro activo={silencio} onClick={silenciar}>
                {silencio ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </BotonRedondo>
              <BotonRedondo titulo="Colgar" peligro onClick={colgar}><PhoneOff className="h-5 w-5" /></BotonRedondo>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Inicial({ nombre, sonando = false }: { nombre: string; sonando?: boolean }) {
  return (
    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-acento-suave text-[16px] font-semibold text-acento', sonando && 'animate-pulse')}>
      {(nombre.replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '#').toUpperCase()}
    </span>
  );
}

function BotonRedondo({ titulo, onClick, disabled, peligro, neutro, activo, children }: {
  titulo: string; onClick: () => void; disabled?: boolean; peligro?: boolean; neutro?: boolean; activo?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} disabled={disabled}
      className={cn(
        'foco-visible flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[filter,background-color] disabled:opacity-50',
        peligro ? 'bg-error text-acento-contraste hover:brightness-90'
          : neutro ? cn('border border-borde text-texto hover:bg-realce', activo && 'bg-realce')
          : 'bg-acento text-acento-contraste hover:brightness-90',
      )}>
      {children}
    </button>
  );
}
