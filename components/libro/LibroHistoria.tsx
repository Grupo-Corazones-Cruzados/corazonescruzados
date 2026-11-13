'use client';

/**
 * EL CUENTO DEL GRUPO CORAZONES CRUZADOS — la postulación contada como un cuento animado (Fernando, 2026-11-12).
 * ES EL FORMULARIO DE POSTULACIÓN: lo abren «Postularme» (página Candidatos) y la portada; también vive en `/libro`.
 *
 * Versión 3 (Fernando: «lo que tenemos parece un audiolibro… quitemos las animaciones de un libro y de cambio
 * de página, y mejor solo dejemos el video animado y que ese sea el punto central de la pantalla»):
 * · LA ESCENA en el centro de la pantalla (escenas 3D reales en video, o las animaciones de Blender), que cambia
 *   con un fundido a negro; al empezar un capítulo, su rótulo sobre la escena.
 * · LA VOZ en español de España la cuenta (`public/libro/voz/<id>.mp3`) y debajo va LA FRASE que se está
 *   diciendo, como subtítulo, sincronizada con el tiempo de la voz. Al terminar, pasa sola a la siguiente escena.
 * · Música por capítulo (`public/libro/musica/<ambiente>.mp3`, si existe). Mandos arriba; progreso abajo.
 * · Al final, sobre la última escena, el formulario (las mismas piezas: `CandidateForm`, captcha, `enviarPostulacion`).
 * Contenido en `lib/sitio/libroHistoria.ts`; los textos originales, en `docs/respaldo/`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Music, Pause, Play, Send, Volume2, VolumeX, X } from 'lucide-react';
import { Lora } from 'next/font/google';
import AnimacionPaso from '@/components/landing/AnimacionPaso';
import MiembrosGaleria from '@/components/landing/MiembrosGaleria';
import Captcha from '@/components/landing/Captcha';
import { horaDeReanudacion, useEstadoRegistro } from '@/components/landing/estadoRegistro';
import { CandidateForm, Piramide, enviarPostulacion, type NombresPostulante } from '@/components/landing/OnboardingSlidersModal';
import { CAPITULOS, EPILOGO, NARRACION_INDICE, PAGINAS, type Ilustracion } from '@/lib/sitio/libroHistoria';
import DURACIONES from '@/lib/sitio/libroVoz.json';

/** La letra del cuento: una serif de lectura para los subtítulos y los rótulos. */
const lora = Lora({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-libro', display: 'swap' });

/** 0 = la apertura (título) · 1..N = las escenas · N+1 = el final (el formulario). */
const TOTAL = PAGINAS.length + 2;
const FIN = PAGINAS.length + 1;
const PAUSA_TRAS_VOZ_MS = 1200;
const VOLUMEN_MUSICA = 0.16;

const idDe = (i: number) => (i === 0 ? 'indice' : i === FIN ? EPILOGO.id : PAGINAS[i - 1].id);
const limpio = (t: string) => t.replace(/\*\*/g, '');
/** Lo que dice la voz en cada escena: el título y los párrafos (como en `scripts/libro/narrar.mts`). */
const narracionDe = (i: number) =>
  i === 0 ? NARRACION_INDICE
    : i === FIN ? [EPILOGO.titulo + '.', ...EPILOGO.parrafos].map(limpio).join(' ')
      : [PAGINAS[i - 1].titulo + '.', ...PAGINAS[i - 1].parrafos].map(limpio).join(' ');
const duracionDe = (i: number) => (DURACIONES as Record<string, number>)[idDe(i)] ?? Math.max(4, narracionDe(i).length / 15);
const capituloDe = (i: number) => (i === 0 ? null : CAPITULOS[i === FIN ? EPILOGO.capitulo : PAGINAS[i - 1].capitulo]);
const ambienteDe = (i: number) => (capituloDe(i) ?? CAPITULOS[0]).ambiente;
const empiezaCapitulo = (i: number) => i === FIN || i === 1 || (i > 1 && i <= PAGINAS.length && PAGINAS[i - 1].capitulo !== PAGINAS[i - 2].capitulo);

/** Las frases de la narración, con la fracción del texto en la que empieza cada una. */
function frasesDe(texto: string) {
  const frases = texto.split(/(?<=[.!?…:;])\s+/).filter((f) => f.trim());
  const total = frases.reduce((a, f) => a + f.length, 0) || 1;
  let acum = 0;
  return frases.map((f) => {
    const inicio = acum / total;
    acum += f.length;
    return { texto: f, inicio };
  });
}

/** Lo que se ve en el centro de la pantalla en cada escena. */
function Escena({ il }: { il: Ilustracion }) {
  if (il.tipo === 'video') {
    return (
      <video
        className="cuento-video"
        src={`/animaciones/${il.id}.mp4`}
        poster={`/animaciones/${il.id}.jpg`}
        aria-label={il.alt}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      />
    );
  }
  if (il.tipo === 'animacion') return <div className="cuento-anim"><AnimacionPaso src={`/animaciones/${il.id}.webp`} alt={il.alt} /></div>;
  if (il.tipo === 'miembros') return <div className="cuento-pieza"><MiembrosGaleria /></div>;
  if (il.tipo === 'piramide') return <div className="cuento-pieza cuento-piramide"><Piramide activo={il.activo} /></div>;
  return (
    <ol className="cuento-pieza cuento-desglose">
      {il.items.map((x, i) => <li key={x}><span>{String(i + 1).padStart(2, '0')}</span>{x}</li>)}
    </ol>
  );
}

/** El formulario del final: el mismo de siempre. */
function Formulario({ onEnviada }: { onEnviada?: (email: string) => void }) {
  const [nombres, setNombres] = useState<NombresPostulante>({ primerNombre: '', segundoNombre: '', primerApellido: '', segundoApellido: '' });
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState('');
  const [marketing, setMarketing] = useState(false);
  const [terminos, setTerminos] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [reinicio, setReinicio] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState<string | null>(null);
  const registro = useEstadoRegistro();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const nombresOk = Object.values(nombres).every((v) => v.trim().length >= 2);
  const listo = nombresOk && emailOk && reason.trim().length >= 10 && terminos && !!captcha && !enviando;

  const enviar = async () => {
    if (!listo || !captcha) return;
    setEnviando(true);
    setError(null);
    const e = await enviarPostulacion({
      primerNombre: nombres.primerNombre.trim(), segundoNombre: nombres.segundoNombre.trim(),
      primerApellido: nombres.primerApellido.trim(), segundoApellido: nombres.segundoApellido.trim(),
      email: email.trim(), reason: reason.trim(), marketing, altcha: captcha,
    });
    setEnviando(false);
    if (e) {
      setError(e);
      setReinicio((n) => n + 1);
      return;
    }
    setEnviada(email.trim());
    onEnviada?.(email.trim());
  };

  if (enviada) {
    return (
      <div className="cuento-enviada">
        <p className="cuento-enviada-titulo"><Send aria-hidden /> Tu postulación está en revisión</p>
        <p>
          Tu propuesta quedó registrada y está <strong>en espera de aprobación</strong> por parte del administrador del
          proyecto. Te avisaremos a <strong>{enviada}</strong> cuando sea aprobada.
        </p>
      </div>
    );
  }
  if (registro?.bloqueado) {
    return (
      <p className="cuento-enviada">
        Para evitar registros en cadena, cada equipo puede crear un registro cada 24 horas. Podrás postularte a partir
        del <strong>{horaDeReanudacion(registro.hasta)}</strong>.
      </p>
    );
  }
  return (
    <div>
      <CandidateForm
        nombres={nombres}
        setNombres={setNombres}
        email={email}
        setEmail={setEmail}
        emailOk={emailOk}
        reason={reason}
        setReason={setReason}
        termsAccepted={terminos}
        onToggleTerms={() => setTerminos((v) => !v)}
        marketing={marketing}
        onToggleMarketing={() => setMarketing((v) => !v)}
        enfocar={false}
      />
      <div className="mt-5">
        <Captcha onCambio={setCaptcha} reinicio={reinicio} tema="oscuro" />
        {error && <p role="alert" className="mt-3 text-[13px] leading-relaxed text-red-300">{error}</p>}
      </div>
      <button type="button" onClick={enviar} disabled={!listo} className="onb-boton onb-boton-avanzar cuento-enviar">
        <Send />
        Comenzar mi aventura
      </button>
    </div>
  );
}

export default function LibroHistoria({
  onClose,
  onEnviada,
}: {
  /** Si viene, el cuento es una ventana sobre la página y lleva «×». */
  onClose?: () => void;
  /** La postulación se envió (la portada abre su aviso de «en revisión»). */
  onEnviada?: (email: string) => void;
}) {
  const [empezado, setEmpezado] = useState(false);
  const [idx, setIdx] = useState(0);
  const [narrando, setNarrando] = useState(true);
  const [musica, setMusica] = useState(true);
  const [frase, setFrase] = useState(0);
  const voz = useRef<HTMLAudioElement | null>(null);
  const fondo = useRef<HTMLAudioElement | null>(null);
  const ambiente = useRef<string | null>(null);
  const avance = useRef<number | null>(null);
  const toque = useRef<number | null>(null);

  const frases = useMemo(() => frasesDe(narracionDe(idx)), [idx]);

  useEffect(() => {
    const v = voz.current;
    const f = fondo.current;
    return () => {
      v?.pause();
      f?.pause();
      if (avance.current) window.clearTimeout(avance.current);
    };
  }, []);

  const ir = useCallback((a: number) => {
    if (a < 0 || a >= TOTAL) return;
    if (avance.current) window.clearTimeout(avance.current);
    setFrase(0);
    setIdx(a);
  }, []);
  const siguiente = useCallback(() => ir(idx + 1), [ir, idx]);
  const anterior = useCallback(() => ir(idx - 1), [ir, idx]);

  /* ── La voz: cada escena se cuenta; la frase sigue al tiempo de la voz; al terminar, la siguiente escena ── */
  useEffect(() => {
    if (!empezado) return;
    const v = voz.current;
    if (avance.current) window.clearTimeout(avance.current);
    const amb = ambienteDe(idx);
    const f = fondo.current;
    if (f && ambiente.current !== amb) {
      ambiente.current = amb;
      f.src = `/libro/musica/${amb}.mp3`;
      f.volume = VOLUMEN_MUSICA;
      if (musica) f.play().catch(() => {});
    }
    if (!v || !narrando) return;
    v.src = `/libro/voz/${idDe(idx)}.mp3`;
    const pasar = () => {
      if (idx < FIN) avance.current = window.setTimeout(() => ir(idx + 1), PAUSA_TRAS_VOZ_MS);
    };
    v.onended = pasar;
    v.ontimeupdate = () => {
      const d = v.duration || duracionDe(idx);
      const x = v.currentTime / d;
      let k = 0;
      while (k + 1 < frases.length && frases[k + 1].inicio <= x) k++;
      setFrase(k);
    };
    v.play().catch(() => {
      avance.current = window.setTimeout(pasar, duracionDe(idx) * 1000);
    });
    return () => {
      v.onended = null;
      v.ontimeupdate = null;
      v.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, empezado, narrando]);

  useEffect(() => {
    const f = fondo.current;
    if (!f) return;
    if (musica && empezado) f.play().catch(() => {});
    else f.pause();
  }, [musica, empezado]);

  const alternarNarracion = useCallback(() => {
    setNarrando((n) => {
      if (n) {
        voz.current?.pause();
        if (avance.current) window.clearTimeout(avance.current);
      }
      return !n;
    });
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!empezado || (e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === ' ') { e.preventDefault(); alternarNarracion(); }
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [empezado, siguiente, anterior, alternarNarracion, onClose]);

  const empezar = () => {
    // Dentro del toque: así el teléfono deja sonar la voz y la música toda la historia.
    const v = voz.current;
    const f = fondo.current;
    if (v) {
      v.src = '/libro/voz/indice.mp3';
      v.play().catch(() => {});
    }
    if (f) {
      ambiente.current = ambienteDe(0);
      f.src = `/libro/musica/${ambienteDe(0)}.mp3`;
      f.volume = VOLUMEN_MUSICA;
      f.play().catch(() => {});
    }
    setEmpezado(true);
  };

  const capitulo = capituloDe(idx);
  const il: Ilustracion | null = idx === 0 ? null : idx === FIN ? EPILOGO.ilustracion : PAGINAS[idx - 1].izquierda;

  return (
    <div
      className={`corp dark cuento ${lora.variable} ${onClose ? 'es-ventana' : ''} ${idx === FIN ? 'es-final' : ''}`}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? true : undefined}
      aria-label="El cuento del Grupo Corazones Cruzados"
    >
      <audio ref={voz} preload="auto" />
      <audio ref={fondo} loop preload="auto" />

      {/* Los mandos: arriba, siempre a la vista. */}
      <div className="cuento-mandos">
        {empezado ? (
          <div className="cuento-mandos-grupo">
            <button type="button" onClick={anterior} disabled={idx === 0} aria-label="Escena anterior" title="Escena anterior"><ArrowLeft /></button>
            <button type="button" onClick={alternarNarracion} aria-label={narrando ? 'Pausar' : 'Seguir'} title={narrando ? 'Pausar' : 'Seguir'}>
              {narrando ? <Pause /> : <Play />}
            </button>
            <button type="button" onClick={() => setMusica((m) => !m)} aria-label={musica ? 'Silenciar la música' : 'Activar la música'} title={musica ? 'Silenciar la música' : 'Música'}>
              {musica ? <Volume2 /> : <VolumeX />}
            </button>
            <button type="button" onClick={siguiente} disabled={idx >= FIN} aria-label="Escena siguiente" title="Escena siguiente"><ArrowRight /></button>
            {capitulo && <span className="cuento-mandos-cap">{capitulo.numero}</span>}
          </div>
        ) : <span />}
        {onClose && <button type="button" className="cuento-cerrar" onClick={onClose} aria-label="Cerrar" title="Cerrar"><X /></button>}
      </div>

      {!empezado ? (
        <div className="cuento-portada">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gcc-512.png" alt="" className="cuento-portada-logo" />
          <h1 className="cuento-portada-titulo">Grupo Corazones Cruzados</h1>
          <p className="cuento-portada-lema">Un corazón puede cruzar al mundo</p>
          <button type="button" className="onb-boton onb-boton-avanzar cuento-empezar" onClick={empezar}>
            <Play />
            Comenzar la historia
          </button>
          <p className="cuento-aviso-sonido"><Music aria-hidden /> Con sonido: una voz te contará la historia.</p>
        </div>
      ) : (
        <>
          <div
            className="cuento-escenario"
            onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (toque.current === null) return;
              const dx = e.changedTouches[0].clientX - toque.current;
              toque.current = null;
              if (dx < -70) siguiente();
              if (dx > 70) anterior();
            }}
          >
            <div key={idx} className="cuento-escena">
              {il ? <Escena il={il} /> : (
                <div className="cuento-apertura">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo-gcc-512.png" alt="" />
                  <p>Un corazón puede cruzar al mundo</p>
                </div>
              )}
              {empiezaCapitulo(idx) && capitulo && (
                <div className="cuento-rotulo">
                  <span>{capitulo.numero}</span>
                  <strong>{capitulo.titulo}</strong>
                </div>
              )}
            </div>
          </div>

          {idx === FIN ? (
            <div className="cuento-final">
              <p className="cuento-frase es-final">{limpio(EPILOGO.parrafos.join(' '))}</p>
              <Formulario onEnviada={onEnviada} />
            </div>
          ) : (
            <p key={`${idx}-${frase}`} className="cuento-frase" aria-live="polite">{frases[frase]?.texto}</p>
          )}

          {/* El progreso de la historia. */}
          <div className="cuento-progreso" aria-hidden>
            <span style={{ width: `${(idx / FIN) * 100}%` }} />
          </div>
        </>
      )}
    </div>
  );
}
