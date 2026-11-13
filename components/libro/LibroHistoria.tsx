'use client';

/**
 * EL LIBRO DE GCC WORLD — la postulación contada como un cuento (propuesta, Fernando 2026-11-12).
 *
 * Un libro cerrado con el logo en la tapa; al abrirlo, cada DOBLE PÁGINA es un paso: a la izquierda la
 * ilustración (las animaciones de Blender en bucle), a la derecha el texto, que se va «contando» párrafo a
 * párrafo. Se avanza con «Siguiente página» al pie de la hoja (Fernando, 2026-11-12: «no sería necesario el
 * botón de estoy de acuerdo sino un botón de siguiente página»), que pasa la hoja con un giro 3D de verdad
 * (el texto sigue siendo texto). Papel crema, tinta oscura y letra de libro; las ilustraciones son láminas
 * oscuras impresas en la página («el libro debe tener su color o diseño»). La última página está en blanco: es el
 * formulario de postulación. Las piezas del formulario (`CandidateForm`, `Piramide`, el captcha y el envío)
 * son las mismas de la ventana de «Postularme», no copias.
 *
 * Teléfono (< 900 px): una sola página a la vez, la lámina arriba y el texto debajo; la hoja se pasa girando
 * desde el lomo, con el botón o deslizando el dedo.
 * El contenido vive en `lib/sitio/libroHistoria.ts`.
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, Send } from 'lucide-react';
import AnimacionPaso from '@/components/landing/AnimacionPaso';
import MiembrosGaleria from '@/components/landing/MiembrosGaleria';
import Captcha from '@/components/landing/Captcha';
import { horaDeReanudacion, useEstadoRegistro } from '@/components/landing/estadoRegistro';
import { CandidateForm, Piramide, enviarPostulacion, type NombresPostulante } from '@/components/landing/OnboardingSlidersModal';
import { CAPITULOS, EPILOGO, PAGINAS, PASOS_CONDICIOLOGIA, type Bloque, type Ilustracion } from '@/lib/sitio/libroHistoria';
import { trozosNegrita } from '@/lib/sitio/modeloGcc';

/** 0 = guardas e índice · 1..N = las páginas · N+1 = el epílogo (el formulario). */
const TOTAL = PAGINAS.length + 2;
const EPI = PAGINAS.length + 1;
const GIRO_MS = 950;
const GIRO_TEL_MS = 700;

type Giro = { de: number; a: number; dir: 1 | -1 };

function Negritas({ texto }: { texto: string }) {
  return <>{trozosNegrita(texto).map((x, i) => (x.negrita ? <strong key={i}>{x.t}</strong> : <Fragment key={i}>{x.t}</Fragment>))}</>;
}

/** Retardo y duración del «relato» de cada pieza: los párrafos largos tardan más en contarse. */
function tiempos(bloques: Bloque[], inicio: number) {
  let t = inicio;
  return bloques.map((b) => {
    const largo = b.tipo === 'texto' ? b.texto.length : 160;
    const dur = Math.min(2.2, Math.max(0.8, largo / 230));
    const r = { retardo: t, dur };
    t += dur * 0.7;
    return r;
  });
}

function BloqueLibro({ b, retardo, dur, relatar }: { b: Bloque; retardo: number; dur: number; relatar: boolean }) {
  const estilo = relatar ? ({ '--cuento-retardo': `${retardo}s`, '--cuento-duracion': `${dur}s` } as React.CSSProperties) : undefined;
  const clase = relatar ? 'libro-cuenta' : '';
  if (b.tipo === 'texto') return <p className={`libro-parrafo ${relatar ? 'onb-cuento-texto' : ''}`} style={estilo}><Negritas texto={b.texto} /></p>;
  if (b.tipo === 'aviso') {
    return (
      <div role="note" className={`aviso-gcc ${clase}`} data-tono="peligro" style={estilo}>
        <p className="aviso-gcc-titulo"><AlertTriangle aria-hidden />{b.titulo}</p>
        <p className="aviso-gcc-texto"><Negritas texto={b.texto} /></p>
      </div>
    );
  }
  if (b.tipo === 'pasosMetodologia') {
    return (
      <ol className={`libro-pasos ${clase}`} style={estilo}>
        {PASOS_CONDICIOLOGIA.map((p, i) => <li key={p}><span>{String(i + 1).padStart(2, '0')}</span>{p}</li>)}
      </ol>
    );
  }
  if (b.tipo === 'numerada') {
    return (
      <ol className={`libro-numerada ${clase}`} style={estilo}>
        {b.items.map((x, i) => <li key={i}><span>{i + 1}</span><p><Negritas texto={x} /></p></li>)}
      </ol>
    );
  }
  return (
    <dl className={`libro-lista ${clase}`} style={estilo}>
      {b.items.map((x) => (
        <div key={x.titulo}>
          <dt>{x.titulo}</dt>
          <dd><Negritas texto={x.texto} /></dd>
        </div>
      ))}
    </dl>
  );
}

/** Las láminas van «impresas» en oscuro sobre el papel: dentro, los colores del tema oscuro. */
function Lamina({ children }: { children: React.ReactNode }) {
  return <div className="corp dark libro-lamina">{children}</div>;
}

function IlustracionLibro({ il }: { il: Ilustracion }) {
  if (il.tipo === 'animacion') return <Lamina><AnimacionPaso src={`/animaciones/${il.id}.webp`} alt={il.alt} /></Lamina>;
  if (il.tipo === 'miembros') return <Lamina><div className="libro-miembros"><MiembrosGaleria /></div></Lamina>;
  if (il.tipo === 'piramide') return <Lamina><div className="libro-piramide"><Piramide activo={il.activo} /></div></Lamina>;
  return (
    <ol className="libro-desglose">
      {il.items.map((x, i) => <li key={x}><span>{String(i + 1).padStart(2, '0')}</span>{x}</li>)}
    </ol>
  );
}

/** El formulario de la última página: el mismo de «Postularme». */
function PaginaEnBlanco({ relatar }: { relatar: boolean }) {
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
    } else setEnviada(email.trim());
  };

  const estilo = relatar ? ({ '--cuento-retardo': '0.2s', '--cuento-duracion': '1.6s' } as React.CSSProperties) : undefined;
  return (
    <>
      <p className={`libro-parrafo ${relatar ? 'onb-cuento-texto' : ''}`} style={estilo}>{EPILOGO.puente}</p>
      {enviada ? (
        <div className="libro-fin">
          <p className="libro-fin-titulo"><Send aria-hidden /> Tu postulación está en revisión</p>
          <p className="libro-parrafo">
            Tu propuesta quedó registrada y está <strong>en espera de aprobación</strong> por parte del administrador
            del proyecto. Te avisaremos a <strong>{enviada}</strong> cuando sea aprobada.
          </p>
        </div>
      ) : registro?.bloqueado ? (
        <p className="libro-parrafo">
          Para evitar registros en cadena, cada equipo puede crear un registro cada 24 horas. Podrás postularte a
          partir del <strong>{horaDeReanudacion(registro.hasta)}</strong>.
        </p>
      ) : (
        <div className={relatar ? 'libro-cuenta' : ''} style={relatar ? ({ '--cuento-retardo': '1.2s' } as React.CSSProperties) : undefined}>
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
            {error && <p role="alert" className="mt-3 text-[13px] leading-relaxed text-red-300">{error}</p>}
          </div>
          <button type="button" onClick={enviar} disabled={!listo} className="onb-boton onb-boton-avanzar libro-enviar">
            <Send />
            Comenzar mi aventura
          </button>
        </div>
      )}
    </>
  );
}

/** `fuente`: la clase de la letra de libro (next/font en la página). */
export default function LibroHistoria({ fuente = '' }: { fuente?: string }) {
  const [fase, setFase] = useState<'cerrado' | 'abriendo' | 'abierto'>('cerrado');
  const [idx, setIdx] = useState(0);
  const [giro, setGiro] = useState<Giro | null>(null);
  const [alcanzado, setAlcanzado] = useState(0);
  const [telefono, setTelefono] = useState(false);
  const relatadas = useRef<Set<number>>(new Set());

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899.98px)');
    const ver = () => setTelefono(mq.matches);
    ver();
    mq.addEventListener('change', ver);
    return () => mq.removeEventListener('change', ver);
  }, []);

  /** Una página se «cuenta» solo la primera vez que se ve; al volver ya está escrita. */
  const relatar = (i: number) => !relatadas.current.has(i);
  useEffect(() => {
    if (fase === 'abierto' && !giro) relatadas.current.add(idx);
  }, [idx, giro, fase]);

  const puedeIr = (i: number) => i <= alcanzado + 1;
  const [giroTel, setGiroTel] = useState<{ de: number; dir: 1 | -1 } | null>(null);

  const ir = useCallback(
    (a: number) => {
      if (giro || a === idx || a < 0 || a >= TOTAL) return;
      const dir: 1 | -1 = a > idx ? 1 : -1;
      setAlcanzado((m) => Math.max(m, a));
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setIdx(a);
        return;
      }
      if (telefono) {
        // La hoja de encima gira desde el lomo: hacia delante se va la actual; hacia atrás vuelve la anterior.
        setGiroTel({ de: idx, dir });
        setIdx(a);
        window.setTimeout(() => setGiroTel(null), GIRO_TEL_MS);
        document.querySelector('.libro-hoja-tel')?.scrollTo(0, 0);
        return;
      }
      setGiro({ de: idx, a, dir });
      window.setTimeout(() => {
        setIdx(a);
        setGiro(null);
      }, GIRO_MS);
    },
    [giro, idx, telefono],
  );

  const siguiente = () => ir(idx + 1);
  const anterior = () => ir(idx - 1);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (fase !== 'abierto' || (e.target as HTMLElement)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') siguiente();
      if (e.key === 'ArrowLeft') anterior();
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const abrir = () => {
    if (telefono || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFase('abierto');
      return;
    }
    setFase('abriendo');
    window.setTimeout(() => setFase('abierto'), GIRO_MS + 150);
  };

  /* ── Las dos caras de cada doble página ── */
  const titulo = (i: number) => (i === EPI ? EPILOGO.titulo : PAGINAS[i - 1].titulo);
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
              const pagina = k === EPILOGO.capitulo ? EPI : PAGINAS.findIndex((p) => p.capitulo === k) + 1;
              const abierta = puedeIr(pagina);
              return (
                <li key={c.numero}>
                  <button type="button" disabled={!abierta} onClick={() => ir(pagina)}>
                    <span className="libro-indice-num">{c.numero}</span>
                    <span className="libro-indice-titulo">{c.titulo}</span>
                    <span className="libro-indice-folio">{pagina * 2 + 1}</span>
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
    const bloques = i === EPI ? [] : PAGINAS[i - 1].bloques;
    const tt = tiempos(bloques, cuenta ? 0.55 : 0);
    const estiloTitulo = cuenta ? ({ '--cuento-retardo': '0.15s' } as React.CSSProperties) : undefined;
    // El paso de hoja llega cuando termina el relato de la página.
    const ultimo = tt[tt.length - 1];
    const finRelato = ultimo ? ultimo.retardo + ultimo.dur * 0.85 : 0.6;
    return (
      <div className="libro-texto">
        <header className={cuenta ? 'libro-cuenta' : ''} style={estiloTitulo}>
          {empiezaCapitulo(i) && <p className="libro-capitulo">{c.numero} · {c.titulo}</p>}
          <h2 className="libro-titulo">{titulo(i)}</h2>
        </header>
        {i === EPI ? (
          <PaginaEnBlanco relatar={cuenta} />
        ) : (
          bloques.map((b, k) => <BloqueLibro key={k} b={b} retardo={tt[k].retardo} dur={tt[k].dur} relatar={cuenta} />)
        )}
        {i !== EPI && (
          <div className={`libro-pie ${cuenta ? 'libro-cuenta' : ''}`} style={cuenta ? ({ '--cuento-retardo': `${finRelato}s` } as React.CSSProperties) : undefined}>
            {telefono && (
              <button type="button" className="libro-atras" onClick={anterior}>
                <ArrowLeft /> Página anterior
              </button>
            )}
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
      <div className="libro-folio">
        {lado === 'izq' && i > 0 && (
          <button type="button" className="libro-atras" onClick={anterior}>
            <ArrowLeft /> Página anterior
          </button>
        )}
        <span>{i * 2 + (lado === 'izq' ? 0 : 1) || ''}</span>
      </div>
    </div>
  );

  const hojaTel = (i: number) => (
    <div className="libro-hoja-tel libro-papel">
      {i !== 0 && <p className="libro-folio-tel">{i * 2 + 1}</p>}
      {izquierda(i)}
      {derecha(i, relatar(i))}
    </div>
  );

  const toque = useRef<number | null>(null);

  /* ── Tapa (cerrado) ── */
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

  return (
    <div className={`corp dark libro ${fuente}`} data-fase={fase}>
      {fase === 'cerrado' && (
        <div className="libro-portada">
          <div className="libro-cerrado">{tapa}</div>
          <button type="button" className="onb-boton onb-boton-avanzar libro-abrir" onClick={abrir}>
            <BookOpen />
            Abrir el libro
          </button>
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
          {/* Hacia atrás, la de abajo sigue siendo la actual hasta que la anterior termina de volver. */}
          <div key={giroTel?.dir === -1 ? giroTel.de : idx} className="libro-tel-base">{hojaTel(giroTel?.dir === -1 ? giroTel.de : idx)}</div>
          {giroTel && (
            <div className={`libro-tel-gira ${giroTel.dir === 1 ? 'es-se-va' : 'es-vuelve'}`}>
              {hojaTel(giroTel.dir === 1 ? giroTel.de : idx)}
            </div>
          )}
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
