'use client';

/**
 * EL LIBRO DE GCC WORLD — la postulación contada como un cuento (Fernando, 2026-11-12). ES EL FORMULARIO DE
 * POSTULACIÓN («la idea era que este sea el nuevo formulario y no un libro aparte»): lo abren «Postularme»
 * (página Candidatos) y la portada, y también vive en `/libro`.
 *
 * · Un libro cerrado (tapa de cuero morado con el logo) que se ABRE con animación, también en el teléfono.
 * · Cada DOBLE PÁGINA: a la izquierda la lámina (animaciones de Blender en bucle), a la derecha la narración.
 * · Una VOZ en español de España la cuenta (`public/libro/voz/<id>.mp3`, `scripts/libro/narrar.mts`) con
 *   MÚSICA de fondo según el capítulo (`public/libro/musica/<ambiente>.mp3`, si existe). El texto aparece al
 *   ritmo de la voz (las duraciones están en `lib/sitio/libroVoz.json`) y, al terminar, EL LIBRO PASA LA HOJA
 *   SOLO. La barra de arriba (siempre visible, también en el teléfono) pausa, cambia de página o silencia.
 * · Papel crema, tinta oscura y letra de libro; en el teléfono una hoja a la vez que gira desde el lomo.
 * · La última página está en blanco: es el formulario (las mismas piezas de antes: `CandidateForm`,
 *   captcha y `enviarPostulacion`).
 * Contenido en `lib/sitio/libroHistoria.ts`; los textos originales, en `docs/respaldo/`.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Music, Pause, Play, Send, Volume2, VolumeX, X } from 'lucide-react';
import AnimacionPaso from '@/components/landing/AnimacionPaso';
import MiembrosGaleria from '@/components/landing/MiembrosGaleria';
import Captcha from '@/components/landing/Captcha';
import { horaDeReanudacion, useEstadoRegistro } from '@/components/landing/estadoRegistro';
import { CandidateForm, Piramide, enviarPostulacion, type NombresPostulante } from '@/components/landing/OnboardingSlidersModal';
import { CAPITULOS, EPILOGO, NARRACION_INDICE, PAGINAS, type Ilustracion } from '@/lib/sitio/libroHistoria';
import DURACIONES from '@/lib/sitio/libroVoz.json';
import { trozosNegrita } from '@/lib/sitio/modeloGcc';
import { Lora } from 'next/font/google';

/** La letra del libro: una serif de lectura (Fernando: «el libro debe tener su color o diseño»). */
const lora = Lora({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700'], style: ['normal', 'italic'], variable: '--font-libro', display: 'swap' });

/** 0 = guardas e índice · 1..N = las páginas · N+1 = el epílogo (el formulario). */
const TOTAL = PAGINAS.length + 2;
const EPI = PAGINAS.length + 1;
const GIRO_MS = 950;
const GIRO_TEL_MS = 700;
const PAUSA_TRAS_VOZ_MS = 1400;
const VOLUMEN_MUSICA = 0.16;

const idDe = (i: number) => (i === 0 ? 'indice' : i === EPI ? EPILOGO.id : PAGINAS[i - 1].id);
const textoDe = (i: number) =>
  i === 0 ? NARRACION_INDICE : i === EPI ? EPILOGO.parrafos.join(' ') : PAGINAS[i - 1].parrafos.join(' ');
const duracionDe = (i: number) => (DURACIONES as Record<string, number>)[idDe(i)] ?? Math.max(4, textoDe(i).length / 15);
const ambienteDe = (i: number) => CAPITULOS[i === 0 ? 0 : i === EPI ? EPILOGO.capitulo : PAGINAS[i - 1].capitulo].ambiente;

function Negritas({ texto }: { texto: string }) {
  return <>{trozosNegrita(texto).map((x, i) => (x.negrita ? <strong key={i}>{x.t}</strong> : <Fragment key={i}>{x.t}</Fragment>))}</>;
}

/**
 * Cuándo empieza cada párrafo y cuánto tarda: repartido sobre lo que dura la voz, en proporción a su largo
 * (el título va primero). Así el texto aparece mientras se va leyendo.
 */
function ritmo(titulo: string, parrafos: string[], total: number) {
  const largos = [titulo.length, ...parrafos.map((p) => p.length)];
  const suma = largos.reduce((a, b) => a + b, 0) || 1;
  let t = 0.2;
  return largos.map((l) => {
    const dur = Math.max(0.6, (l / suma) * total);
    const r = { retardo: t, dur };
    t += dur;
    return r;
  });
}

/** Las láminas van «impresas» en oscuro sobre el papel: dentro, los colores del tema oscuro. */
function Lamina({ children }: { children: React.ReactNode }) {
  return <div className="corp dark libro-lamina">{children}</div>;
}

function IlustracionLibro({ il }: { il: Ilustracion }) {
  if (il.tipo === 'animacion') return <Lamina><AnimacionPaso src={`/animaciones/${il.id}.webp`} alt={il.alt} /></Lamina>;
  if (il.tipo === 'video') {
    return (
      <Lamina>
        <video
          className="libro-video"
          src={`/animaciones/${il.id}.mp4`}
          poster={`/animaciones/${il.id}.jpg`}
          aria-label={il.alt}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      </Lamina>
    );
  }
  if (il.tipo === 'miembros') return <Lamina><div className="libro-miembros"><MiembrosGaleria /></div></Lamina>;
  if (il.tipo === 'piramide') return <Lamina><div className="libro-piramide"><Piramide activo={il.activo} /></div></Lamina>;
  return (
    <ol className="libro-desglose">
      {il.items.map((x, i) => <li key={x}><span>{String(i + 1).padStart(2, '0')}</span>{x}</li>)}
    </ol>
  );
}

/** El formulario de la última página: el mismo de siempre. */
function PaginaEnBlanco({ onEnviada }: { onEnviada?: (email: string) => void }) {
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
      <div className="libro-fin">
        <p className="libro-fin-titulo"><Send aria-hidden /> Tu postulación está en revisión</p>
        <p className="libro-parrafo">
          Tu propuesta quedó registrada y está <strong>en espera de aprobación</strong> por parte del administrador
          del proyecto. Te avisaremos a <strong>{enviada}</strong> cuando sea aprobada.
        </p>
      </div>
    );
  }
  if (registro?.bloqueado) {
    return (
      <p className="libro-parrafo">
        Para evitar registros en cadena, cada equipo puede crear un registro cada 24 horas. Podrás postularte a
        partir del <strong>{horaDeReanudacion(registro.hasta)}</strong>.
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
        <Captcha onCambio={setCaptcha} reinicio={reinicio} tema="claro" />
        {error && <p role="alert" className="mt-3 text-[13px] leading-relaxed text-red-700">{error}</p>}
      </div>
      <button type="button" onClick={enviar} disabled={!listo} className="onb-boton onb-boton-avanzar libro-enviar">
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
  /** Si viene, el libro es una ventana sobre la página y lleva «×». */
  onClose?: () => void;
  /** La postulación se envió (la portada abre su aviso de «en revisión»). */
  onEnviada?: (email: string) => void;
}) {
  const [fase, setFase] = useState<'cerrado' | 'abriendo' | 'abierto'>('cerrado');
  const [idx, setIdx] = useState(0);
  const [giro, setGiro] = useState<{ de: number; a: number; dir: 1 | -1 } | null>(null);
  const [giroTel, setGiroTel] = useState<{ de: number; dir: 1 | -1 } | null>(null);
  const [alcanzado, setAlcanzado] = useState(0);
  const [telefono, setTelefono] = useState(false);
  const [narrando, setNarrando] = useState(true);
  const [musica, setMusica] = useState(true);
  const relatadas = useRef<Set<number>>(new Set());
  const voz = useRef<HTMLAudioElement | null>(null);
  const fondo = useRef<HTMLAudioElement | null>(null);
  const ambiente = useRef<string | null>(null);
  const avance = useRef<number | null>(null);
  const toque = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899.98px)');
    const ver = () => setTelefono(mq.matches);
    ver();
    mq.addEventListener('change', ver);
    return () => mq.removeEventListener('change', ver);
  }, []);

  // Al cerrar o salir, se callan la voz y la música.
  useEffect(() => {
    const v = voz.current;
    const f = fondo.current;
    return () => {
      v?.pause();
      f?.pause();
      if (avance.current) window.clearTimeout(avance.current);
    };
  }, []);

  const relatar = (i: number) => !relatadas.current.has(i);
  useEffect(() => {
    if (fase === 'abierto' && !giro && !giroTel) relatadas.current.add(idx);
  }, [idx, giro, giroTel, fase]);

  const ir = useCallback(
    (a: number) => {
      if (giro || giroTel || a === idx || a < 0 || a >= TOTAL) return;
      if (avance.current) window.clearTimeout(avance.current);
      const dir: 1 | -1 = a > idx ? 1 : -1;
      setAlcanzado((m) => Math.max(m, a));
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setIdx(a);
        return;
      }
      if (telefono) {
        setGiroTel({ de: idx, dir });
        setIdx(a);
        window.setTimeout(() => setGiroTel(null), GIRO_TEL_MS);
        return;
      }
      setGiro({ de: idx, a, dir });
      window.setTimeout(() => {
        setIdx(a);
        setGiro(null);
      }, GIRO_MS);
    },
    [giro, giroTel, idx, telefono],
  );
  const siguiente = useCallback(() => ir(idx + 1), [ir, idx]);
  const anterior = useCallback(() => ir(idx - 1), [ir, idx]);

  /* ── La voz y la música: cada página se lee al quedar abierta; al terminar, el libro pasa la hoja ── */
  useEffect(() => {
    if (fase !== 'abierto' || giro || giroTel) return;
    const v = voz.current;
    if (avance.current) window.clearTimeout(avance.current);
    // La música del capítulo: si cambia el ambiente, cambia la pista.
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
      if (idx < EPI) avance.current = window.setTimeout(() => ir(idx + 1), PAUSA_TRAS_VOZ_MS);
    };
    v.onended = pasar;
    // Sin voz (no cargó o el navegador la bloqueó), se pasa la hoja con el tiempo que habría durado.
    v.play().catch(() => {
      avance.current = window.setTimeout(pasar, duracionDe(idx) * 1000);
    });
    return () => {
      v.onended = null;
      v.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, fase, giro, giroTel, narrando]);

  useEffect(() => {
    const f = fondo.current;
    if (!f) return;
    if (musica && fase === 'abierto') f.play().catch(() => {});
    else f.pause();
  }, [musica, fase]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (fase !== 'abierto' || (e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [fase, siguiente, anterior, onClose]);

  const abrir = () => {
    // Dentro del toque: así el teléfono deja sonar la voz y la música el resto del libro.
    const v = voz.current;
    const f = fondo.current;
    if (v) {
      v.src = '/libro/voz/indice.mp3';
      v.play().then(() => v.pause()).catch(() => {});
    }
    if (f) {
      ambiente.current = ambienteDe(0);
      f.src = `/libro/musica/${ambienteDe(0)}.mp3`;
      f.volume = VOLUMEN_MUSICA;
      f.play().catch(() => {});
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFase('abierto');
      return;
    }
    setFase('abriendo');
    window.setTimeout(() => setFase('abierto'), telefono ? GIRO_TEL_MS + 450 : GIRO_MS + 150);
  };

  const alternarNarracion = () => {
    if (narrando) {
      setNarrando(false);
      voz.current?.pause();
      if (avance.current) window.clearTimeout(avance.current);
    } else {
      setNarrando(true);
    }
  };

  /* ── Las caras de cada doble página ── */
  const capitulo = (i: number) => CAPITULOS[i === EPI ? EPILOGO.capitulo : PAGINAS[i - 1].capitulo];
  const empiezaCapitulo = (i: number) => i === EPI || i === 1 || PAGINAS[i - 1].capitulo !== PAGINAS[i - 2].capitulo;

  const izquierda = (i: number) => {
    if (i === 0) {
      return (
        <div className="libro-guarda">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-gcc-512.png" alt="" className="libro-guarda-logo" />
          <p className="libro-guarda-titulo">Grupo Corazones Cruzados</p>
          <p className="libro-guarda-lema">Un corazón puede cruzar al mundo</p>
        </div>
      );
    }
    const il = i === EPI ? EPILOGO.ilustracion : PAGINAS[i - 1].izquierda;
    return <div className="libro-ilustracion"><IlustracionLibro il={il} /></div>;
  };

  const derecha = (i: number, cuenta: boolean) => {
    if (i === 0) {
      return (
        <div className="libro-indice">
          <p className="libro-capitulo">Índice</p>
          <ol>
            {CAPITULOS.map((c, k) => {
              const pag = k === EPILOGO.capitulo ? EPI : PAGINAS.findIndex((p) => p.capitulo === k) + 1;
              return (
                <li key={c.numero}>
                  <button type="button" disabled={pag > alcanzado + 1} onClick={() => ir(pag)}>
                    <span className="libro-indice-num">{c.numero}</span>
                    <span className="libro-indice-titulo">{c.titulo}</span>
                    <span className="libro-indice-folio">{pag * 2 + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="libro-pie">
            <button type="button" className="libro-siguiente" onClick={siguiente}>
              Empezar a leer <ArrowRight />
            </button>
          </div>
        </div>
      );
    }
    const c = capitulo(i);
    const titulo = i === EPI ? EPILOGO.titulo : PAGINAS[i - 1].titulo;
    const parrafos = i === EPI ? EPILOGO.parrafos : PAGINAS[i - 1].parrafos;
    const r = ritmo(titulo, parrafos, duracionDe(i));
    const estilo = (k: number) =>
      cuenta ? ({ '--cuento-retardo': `${r[k].retardo}s`, '--cuento-duracion': `${r[k].dur}s` } as React.CSSProperties) : undefined;
    const fin = r[r.length - 1].retardo + r[r.length - 1].dur;
    const alFinal = cuenta ? ({ '--cuento-retardo': `${fin}s` } as React.CSSProperties) : undefined;
    return (
      <div className="libro-texto">
        <header className={cuenta ? 'libro-cuenta' : ''} style={estilo(0)}>
          {empiezaCapitulo(i) && <p className="libro-capitulo">{c.numero} · {c.titulo}</p>}
          <h2 className="libro-titulo">{titulo}</h2>
        </header>
        {parrafos.map((p, k) => (
          <p key={k} className={`libro-parrafo ${cuenta ? 'onb-cuento-texto' : ''}`} style={estilo(k + 1)}>
            <Negritas texto={p} />
          </p>
        ))}
        {i === EPI ? (
          <div className={cuenta ? 'libro-cuenta' : ''} style={alFinal}>
            <PaginaEnBlanco onEnviada={onEnviada} />
          </div>
        ) : (
          <div className={`libro-pie ${cuenta ? 'libro-cuenta' : ''}`} style={alFinal}>
            <button type="button" className="libro-siguiente" onClick={siguiente}>
              Siguiente página <ArrowRight />
            </button>
          </div>
        )}
      </div>
    );
  };

  const pagina = (lado: 'izq' | 'der', i: number, cuenta = false) => (
    <div className={`libro-pagina libro-papel es-${lado}`}>
      <div className="libro-pagina-cuerpo">{lado === 'izq' ? izquierda(i) : derecha(i, cuenta)}</div>
      <div className="libro-folio"><span>{i * 2 + (lado === 'izq' ? 0 : 1) || ''}</span></div>
    </div>
  );

  const hojaTel = (i: number, cuenta: boolean) => (
    <div className="libro-hoja-tel libro-papel">
      {i !== 0 && <p className="libro-folio-tel">{i * 2 + 1}</p>}
      {izquierda(i)}
      {derecha(i, cuenta)}
    </div>
  );

  const tapa = (
    <div className="libro-tapa-cara">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-gcc-512.png" alt="" className="libro-tapa-logo" />
      <p className="libro-tapa-titulo">Grupo Corazones Cruzados</p>
      <p className="libro-tapa-lema">Un corazón puede cruzar al mundo</p>
    </div>
  );

  const derEstatica = giro ? (giro.dir === 1 ? giro.a : giro.de) : idx;
  const izqEstatica = giro ? (giro.dir === 1 ? giro.de : giro.a) : idx;
  const ocupado = !!giro || !!giroTel || fase !== 'abierto';
  const baseTel = giroTel?.dir === -1 ? giroTel.de : idx;

  return (
    <div
      className={`corp dark libro ${lora.variable} ${onClose ? 'es-ventana' : ''} ${narrando ? '' : 'es-pausado'}`}
      data-fase={fase}
      role={onClose ? 'dialog' : undefined}
      aria-modal={onClose ? true : undefined}
      aria-label="El libro del Grupo Corazones Cruzados"
    >
      <audio ref={voz} preload="auto" />
      <audio ref={fondo} loop preload="auto" />

      {/* La barra de mandos: siempre arriba, a la vista también en el teléfono. */}
      <div className="libro-mandos">
        {fase === 'cerrado' ? <span /> : (
          <div className="libro-mandos-grupo">
            <button type="button" onClick={anterior} disabled={idx === 0 || ocupado} aria-label="Página anterior" title="Página anterior"><ArrowLeft /></button>
            <button type="button" onClick={alternarNarracion} aria-label={narrando ? 'Pausar la narración' : 'Seguir la narración'} title={narrando ? 'Pausar' : 'Seguir'}>
              {narrando ? <Pause /> : <Play />}
            </button>
            <button type="button" onClick={() => setMusica((m) => !m)} aria-label={musica ? 'Silenciar la música' : 'Activar la música'} title={musica ? 'Silenciar la música' : 'Música'}>
              {musica ? <Volume2 /> : <VolumeX />}
            </button>
            <button type="button" onClick={siguiente} disabled={idx >= EPI || ocupado} aria-label="Siguiente página" title="Siguiente página"><ArrowRight /></button>
            <span className="libro-mandos-folio">{idx === 0 ? 'Índice' : `${idx} / ${EPI}`}</span>
          </div>
        )}
        {onClose && (
          <button type="button" className="libro-cerrar" onClick={onClose} aria-label="Cerrar" title="Cerrar"><X /></button>
        )}
      </div>

      {fase === 'cerrado' && (
        <div className="libro-portada">
          <div className="libro-cerrado">{tapa}</div>
          <button type="button" className="onb-boton onb-boton-avanzar libro-abrir" onClick={abrir}>
            <BookOpen />
            Abrir el libro
          </button>
          <p className="libro-aviso-sonido"><Music aria-hidden /> Con sonido: una voz te contará la historia.</p>
        </div>
      )}

      {fase !== 'cerrado' && telefono && (
        <div
          className="libro-telefono"
          onTouchStart={(e) => { toque.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (toque.current === null || (e.target as HTMLElement).closest('input, textarea, button')) return;
            const dx = e.changedTouches[0].clientX - toque.current;
            toque.current = null;
            if (dx < -70) siguiente();
            if (dx > 70) anterior();
          }}
        >
          <div key={baseTel} className="libro-tel-base">{hojaTel(baseTel, relatar(baseTel))}</div>
          {giroTel && (
            <div className={`libro-tel-gira ${giroTel.dir === 1 ? 'es-se-va' : 'es-vuelve'}`}>
              {hojaTel(giroTel.dir === 1 ? giroTel.de : idx, false)}
            </div>
          )}
          {/* Al abrir: la tapa gira desde el lomo y deja ver la primera hoja. */}
          {fase === 'abriendo' && <div className="libro-tel-tapa">{tapa}</div>}
          <button type="button" className="libro-cinta" onClick={() => ir(0)} title="Índice" aria-label="Ir al índice" />
        </div>
      )}

      {fase !== 'cerrado' && !telefono && (
        <div className="libro-tapa">
          <div className="libro-tomo">
            <div key={`i${izqEstatica}`} className={fase === 'abriendo' ? 'libro-oculta' : ''}>{pagina('izq', izqEstatica)}</div>
            <div key={`d${derEstatica}`}>{pagina('der', derEstatica, relatar(derEstatica))}</div>
            {fase === 'abriendo' && (
              <div className="libro-hoja es-adelante es-tapa">
                <div className="libro-cara es-frente">{tapa}</div>
                <div className="libro-cara es-dorso">{pagina('izq', 0)}</div>
              </div>
            )}
            {giro && (
              <div className={`libro-hoja ${giro.dir === 1 ? 'es-adelante' : 'es-atras'}`}>
                <div className="libro-cara es-frente">{giro.dir === 1 ? pagina('der', giro.de) : pagina('izq', giro.de)}</div>
                <div className="libro-cara es-dorso">{giro.dir === 1 ? pagina('izq', giro.a) : pagina('der', giro.a)}</div>
              </div>
            )}
            <button type="button" className="libro-cinta" onClick={() => ir(0)} title="Índice" aria-label="Ir al índice" />
          </div>
        </div>
      )}
    </div>
  );
}
