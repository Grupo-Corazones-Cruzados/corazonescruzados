'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import PixelStars from '@/components/landing/PixelStars';
import CabeceraSitio from '@/components/sitio/CabeceraSitio';
import PieSitio from '@/components/sitio/PieSitio';
import FondosPortada from '@/components/landing/FondosPortada';
import PanelesMundo from '@/components/landing/PanelesMundo';
import RolesMundo from '@/components/landing/RolesMundo';
import InicioApp from '@/components/landing/InicioApp';
import { sonarUnion, sonarVolver } from '@/lib/sitio/sonidoSeleccion';
import type { AccionesAcceso } from '@/components/landing/opcionesAcceso';
import { IconoCorazon, IconoMundo } from '@/components/landing/IconosTitular';
import { useCorteAnimado, type ModoPortada } from '@/lib/sitio/portadaPartida';
import { appInstalada, type AppDeTelefono } from '@/lib/sitio/appDeTelefono';
import PointerCursor from '@/components/landing/PointerCursor';
import AccountRecoveryModal from '@/components/landing/AccountRecoveryModal';
import OnboardingSlidersModal, { enviarPostulacion } from '@/components/landing/OnboardingSlidersModal';
import EntryChoiceModal from '@/components/landing/EntryChoiceModal';
import { ACCESO_PLATAFORMA, destinoTrasAccesoValido } from '@/lib/sitio/acceso';
import ProposalPendingModal from '@/components/landing/ProposalPendingModal';
import CandidateAccountModal from '@/components/landing/CandidateAccountModal';
import ClientSignupModal from '@/components/landing/ClientSignupModal';
import ClientLoginModal from '@/components/landing/ClientLoginModal';
import MemberLoginModal from '@/components/landing/MemberLoginModal';

/**
 * LA PORTADA. Desde el 2026-11-08 el videojuego se reinició desde cero (Fernando: «elimina del
 * proyecto todo lo que hicimos hasta ahora de videojuego»): aquí ya no hay intro del juego, ni
 * creador de personaje, ni entrada a `/juego`. Todo acceso lleva a la Plataforma; el mundo
 * Aventura se sigue eligiendo, pero dice «Próximamente» (`RolesMundo`).
 */
export default function LandingPage() {
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const raizPortadaRef = useRef<HTMLDivElement | null>(null);
  // ¿Pantalla táctil sin puntero fino? Ahí la portada va en modo ligero (2026-10-26).
  const [esTactil, setEsTactil] = useState(false);
  const [reducirMovimiento, setReducirMovimiento] = useState(false);
  useEffect(() => { setReducirMovimiento(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)');
    const leer = () => setEsTactil(mq.matches);
    leer();
    mq.addEventListener('change', leer);
    return () => mq.removeEventListener('change', leer);
  }, []);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [entryChoiceOpen, setEntryChoiceOpen] = useState(false);
  const [proposalPending, setProposalPending] = useState<
    { email?: string | null; emailVerified?: boolean; approved?: boolean } | null
  >(null);
  // Candidato aprobado que va a crear su cuenta (contraseña + datos). null = cerrado.
  const [candidateAccount, setCandidateAccount] = useState<{ email?: string | null } | null>(null);
  // Cliente con cuenta creada pero correo sin verificar (no puede ingresar).
  const [clientPending, setClientPending] = useState<{ email?: string | null } | null>(null);
  const [clientSignupOpen, setClientSignupOpen] = useState(false);
  const [clientLoginOpen, setClientLoginOpen] = useState(false);
  const [memberLoginOpen, setMemberLoginOpen] = useState(false);
  // El mundo elegido con un CLIC en «Aventura» o «Progreso» (2026-10-26): llena la portada y
  // descubre el titular y el pensamiento. `null` = aún no se ha elegido (pantalla partida).
  const [mundoElegido, setMundoElegido] = useState<'aventura' | 'progreso' | null>(null);
  /**
   * LAS APPS NO ELIGEN MUNDO (Fernando, 2026-11-05): GCC Progreso, GCC Aventura y GCC Centralizado
   * ya son uno, así que abren directamente las opciones de acceso. Elegir solo pasa en GCC World.
   */
  const [appTelefono, setAppTelefono] = useState<AppDeTelefono | null>(null);
  useEffect(() => {
    const app = appInstalada();
    if (!app) return;
    setAppTelefono(app);
    setMundoElegido(app === 'progreso' ? 'progreso' : 'aventura');
  }, []);

  /**
   * ── ENTRAR DIRECTO A UNA PUERTA: `/?acceso=cliente` ─────────────────────────
   * Es lo que hacen `/auth/cliente`, `/auth/miembro` y `/auth/candidato`, que no son
   * páginas sino redirecciones hacia aquí.
   *
   * ── POR QUÉ NO SON PÁGINAS PROPIAS ─────────────────────────────────────────
   * Lo fueron durante un rato, con un formulario escrito aparte que imitaba a estos
   * diálogos. Fernando lo vio en el acto (2026-08-03): se parecía, pero no era. Un enlace
   * directo tiene que llevar **al mismo diálogo** que se abre desde el botón «Plataforma»,
   * no a una copia — si no, hay dos formularios de acceso que mantener y uno se queda
   * atrás. Aquí no se duplica nada: se abre el que ya existe.
   *
   * `?redirect=` se conserva para que el guardián del panel pueda mandar aquí a quien
   * intente entrar sin sesión y devolverlo a donde iba.
   */
  const [destinoTrasAcceso, setDestinoTrasAcceso] = useState<string | null>(null);
  /** Correo que llega en el enlace (`?correo=`) para rellenar el usuario. Ver `/auth/[tipo]`. */
  const [correoSugerido, setCorreoSugerido] = useState<string>('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const acceso = q.get('acceso');
    // `?redirect=` se guarda aunque no venga `?acceso=`: el guardián del panel manda aquí
    // sin elegir puerta, y quien elija una debe acabar donde iba.
    // Solo se acepta un destino DE DENTRO de la plataforma (`destinoTrasAccesoValido`). Un
    // `?redirect=` a una página del sitio devolvía al visitante a la web pública justo
    // después de identificarse — el fallo del 2026-08-23.
    const destino = destinoTrasAccesoValido(q.get('redirect'));
    if (destino) setDestinoTrasAcceso(destino);
    const correo = q.get('correo');
    if (correo && correo.includes('@')) setCorreoSugerido(correo.trim());
    if (!acceso) return;
    if (acceso === 'cliente') setClientLoginOpen(true);
    else if (acceso === 'miembro') setMemberLoginOpen(true);
    else if (acceso === 'candidato') setRecoveryOpen(true);
    // `plataforma` no es una puerta con nombre: es el MENÚ de ingreso, el que se abría con
    // el botón «Plataforma» del héroe antes de subirlo a la barra de navegación
    // (2026-08-17). Aquí llega quien lo pulsa desde `/soluciones`, `/legal` o cualquier
    // otra página, vía `/auth`. El diálogo es el mismo: no hay una segunda copia.
    // En una app ese menú sobra: `appTelefono` ya muestra las opciones, con su tema.
    // Desde el 2026-11-08 la web entra como el teléfono: la pantalla de acceso de la app (`InicioApp`).
    else if (acceso === ACCESO_PLATAFORMA) { if (!appInstalada()) setMundoElegido('progreso'); }
    // El enlace del correo de APROBACIÓN (`/api/candidate/continuar`): abre la creación de la
    // cuenta del candidato. Sustituye a la tarjeta «Aprobada», que dependía de reconocer su equipo
    // (Fernando, 2026-10-29).
    else if (acceso === 'candidato-aprobado') {
      const correoAprobado = q.get('correo');
      setCandidateAccount({ email: correoAprobado && correoAprobado.includes('@') ? correoAprobado.trim() : null });
    }
    // Se limpia la URL: dejar `?acceso=` haría que el diálogo reapareciera al volver atrás.
    const limpia = new URL(window.location.href);
    limpia.searchParams.delete('acceso');
    limpia.searchParams.delete('correo');
    window.history.replaceState({}, '', limpia.pathname + limpia.search + limpia.hash);
  }, []);
  const corazonAudioRef = useRef<HTMLAudioElement | null>(null);

  // ── EL LATIDO DE FONDO (Fernando, 2026-10-29) ─────────────────────────────────────────
  // «deja esta música de fondo en bucle y que deje de reproducirse mientras exista un
  // formulario abierto». Suena en bucle en la portada y CALLA (con un fundido) mientras haya
  // abierto cualquier formulario o ventana de acceso: candidato, postulación, inicio de sesión
  // de cliente o miembro, alta de cliente, el menú de ingreso o los avisos de estado. También
  // calla con la pestaña oculta. El navegador no deja sonar
  // nada antes del primer gesto del visitante: se intenta al cargar y, si lo bloquea, arranca
  // con el primer toque, clic o tecla.
  const formularioAbierto =
    recoveryOpen || entryChoiceOpen || onboardingOpen || clientSignupOpen || clientLoginOpen ||
    memberLoginOpen || !!proposalPending || !!candidateAccount || !!clientPending;
  const latidoDebeSonar = !formularioAbierto && !appTelefono;
  const latidoDebeSonarRef = useRef(latidoDebeSonar);
  latidoDebeSonarRef.current = latidoDebeSonar;
  const latidoFundidoRef = useRef(0);
  const fundirLatido = useCallback((sonar: boolean) => {
    const audio = corazonAudioRef.current;
    if (!audio) return;
    const VOLUMEN = 0.45;
    cancelAnimationFrame(latidoFundidoRef.current);
    if (sonar && document.hidden) return;
    if (sonar && audio.paused) {
      audio.volume = 0;
      audio.play().catch(() => undefined);
    }
    const desde = audio.volume;
    const hasta = sonar ? VOLUMEN : 0;
    const inicio = performance.now();
    const DURACION = sonar ? 900 : 450;
    const paso = (t: number) => {
      const k = Math.min(1, (t - inicio) / DURACION);
      audio.volume = Math.max(0, Math.min(1, desde + (hasta - desde) * k));
      if (k < 1) latidoFundidoRef.current = requestAnimationFrame(paso);
      else if (!sonar) audio.pause();
    };
    latidoFundidoRef.current = requestAnimationFrame(paso);
  }, []);
  useEffect(() => {
    fundirLatido(latidoDebeSonar);
  }, [latidoDebeSonar, fundirLatido]);
  useEffect(() => {
    // Arranque tras el primer gesto (si al cargar el navegador lo bloqueó) y pausa con la
    // pestaña oculta.
    const alGesto = () => {
      const audio = corazonAudioRef.current;
      if (audio && audio.paused && latidoDebeSonarRef.current) fundirLatido(true);
    };
    const alVisibilidad = () => fundirLatido(!document.hidden && latidoDebeSonarRef.current);
    window.addEventListener('pointerdown', alGesto, true);
    window.addEventListener('keydown', alGesto, true);
    document.addEventListener('visibilitychange', alVisibilidad);
    return () => {
      window.removeEventListener('pointerdown', alGesto, true);
      window.removeEventListener('keydown', alGesto, true);
      document.removeEventListener('visibilitychange', alVisibilidad);
      cancelAnimationFrame(latidoFundidoRef.current);
      corazonAudioRef.current?.pause();
    };
  }, [fundirLatido]);

  // El cielo de estrellas vive en un «mundo» 5 veces mayor que la ventana y centrado en ella (lo que
  // queda de la cámara de la intro del juego, retirada el 2026-11-08): así la densidad de estrellas
  // visible es la de siempre.
  useEffect(() => {
    const WORLD_SCALE = 5;
    const medir = () => {
      const section = heroSectionRef.current;
      const world = worldRef.current;
      if (!section || !world) return;
      const viewW = section.offsetWidth;
      const viewH = section.offsetHeight;
      const worldW = viewW * WORLD_SCALE;
      const worldH = viewH * WORLD_SCALE;
      world.style.width = `${worldW}px`;
      world.style.height = `${worldH}px`;
      world.style.left = `${-(worldW - viewW) / 2}px`;
      world.style.top = `${-(worldH - viewH) / 2}px`;
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, []);

  // Mientras se elige candidato/cliente o se llena un formulario (modales),
  // usar el cursor normal del sistema. El puntero pixel solo se muestra
  // jugando.
  const nativeCursor =
    entryChoiceOpen ||
    clientSignupOpen ||
    clientLoginOpen ||
    memberLoginOpen ||
    onboardingOpen ||
    recoveryOpen ||
    !!proposalPending ||
    !!clientPending ||
    // En las apps (teléfono y escritorio) la portada es un inicio de sesión: siempre el puntero del
    // sistema, nunca el pixel (Fernando, 2026-11-08).
    !!appTelefono;

  /**
   * QUÉ LADO DE LA PORTADA SE VE (Fernando, 2026-10-26) — ver `lib/sitio/portadaPartida.ts`.
   * ⛔ YA NO con el puntero: el mundo se elige con un CLIC (`mundoElegido`). Si se abre el
   * acceso por la URL (`?acceso=`), se ve el lado de Progreso, que es adonde lleva.
   */
  const accesoAbierto = entryChoiceOpen || clientLoginOpen || memberLoginOpen || clientSignupOpen || recoveryOpen;
  const modoPortada: ModoPortada = mundoElegido ?? (accesoAbierto ? 'progreso' : 'partido');
  useCorteAnimado(raizPortadaRef, modoPortada);
  /**
   * «EL CHOQUE» (Fernando, 2026-10-26): cuando el mundo elegido termina de llenar la pantalla,
   * el corazón cruza hasta la Tierra y se unen en el centro (ver `.grafico-*` en globals.css).
   * Al volver se SEPARAN (`.titular-separa`). Las distancias se MIDEN (`--dx-corazon`,
   * `--dx-mundo`).
   */
  const titularRef = useRef<HTMLDivElement | null>(null);
  const [choque, setChoque] = useState(false);
  const [separa, setSepara] = useState(false);
  const choqueRef = useRef(false);
  useEffect(() => {
    if (!mundoElegido) {
      // Volver: si estaban unidas, se separan (y la clase se quita al terminar).
      if (choqueRef.current) {
        choqueRef.current = false;
        setChoque(false);
        setSepara(true);
        const id = window.setTimeout(() => setSepara(false), 750);
        return () => window.clearTimeout(id);
      }
      return;
    }
    setSepara(false);
    const id = window.setTimeout(() => {
      const t = titularRef.current;
      if (!t) return;
      // «El cruce del corazón» (2026-10-28): el corazón salta hasta el CENTRO y la Tierra
      // avanza a su encuentro. Se mide lo que recorre cada uno hasta el centro del titular.
      const corazon = t.querySelector('.grafico-corazon')?.getBoundingClientRect();
      const mundo = t.querySelector('.grafico-mundo')?.getBoundingClientRect();
      if (!corazon || !mundo) return;
      const caja = t.getBoundingClientRect();
      const centro = caja.left + caja.width / 2;
      t.style.setProperty('--dx-corazon', `${centro - (corazon.left + corazon.width / 2)}px`);
      t.style.setProperty('--dx-mundo', `${(mundo.left + mundo.width / 2) - centro}px`);
      choqueRef.current = true;
      setChoque(true);
      // El sonido de la unión, en el instante en que el corazón toca la Tierra: el 62 % de
      // `corazonCruza` (1,9 s) → 1,18 s; con «reducir movimiento» ya están unidos, suena al momento.
      cancelarUnion = sonarUnion(reducirMovimiento ? 0 : 1.18);
    }, 650);
    let cancelarUnion: () => void = () => undefined;
    return () => {
      window.clearTimeout(id);
      cancelarUnion();
    };
  }, [mundoElegido]);

  // Escape también vuelve a la pantalla de inicio, si no hay un diálogo abierto encima.
  useEffect(() => {
    if (!mundoElegido) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !appTelefono && !document.querySelector('[role="dialog"]')) {
        sonarVolver();
        setMundoElegido(null);
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [mundoElegido, appTelefono]);
  const elegirMundo = (m: 'aventura' | 'progreso') => setMundoElegido(m);
  /**
   * EN LA WEB, ELEGIR MUNDO ABRE LA PANTALLA DE ACCESO DE LA APP DE ESE MUNDO (Fernando, 2026-11-08: «el
   * registro debe ser igual que la versión móvil»). La elección Progreso/Aventura se queda como está; en
   * vez de los roles, sube la misma hoja de entrar y crear cuenta que ve el teléfono.
   */
  const appWeb: AppDeTelefono | null = !appTelefono && mundoElegido ? mundoElegido : null;

  /**
   * LO QUE HACE CADA OPCIÓN DE ACCESO — una sola vez (2026-10-26). La usan el diálogo
   * «¿Cómo quieres ingresar?» (`EntryChoiceModal`) y las tarjetas de roles que aparecen tras
   * elegir un mundo (`RolesMundo`). Cerrar el diálogo cuando no está abierto no hace nada.
   */
  const accionesAcceso: AccionesAcceso = {
    onCandidate: () => {
      setEntryChoiceOpen(false);
      try {
        window.localStorage.setItem('gcc_account_type', 'candidate');
      } catch {
        /* ignore */
      }
      // Candidato nuevo (sin postulación previa): conoce el proyecto y se postula.
      setOnboardingOpen(true);
    },
    onProposalPending: (info) => {
      setEntryChoiceOpen(false);
      setProposalPending({ email: info.email, emailVerified: info.emailVerified });
    },
    onProposalApproved: (info) => {
      setEntryChoiceOpen(false);
      // Candidato aprobado: muestra el aviso verde con botón "Continuar".
      setProposalPending({ email: info.email, emailVerified: true, approved: true });
    },
    onClientPending: (info) => {
      setEntryChoiceOpen(false);
      setClientPending({ email: info.email });
    },
    onCandidateLogin: () => {
      setEntryChoiceOpen(false);
      // Candidato existente: inicia sesión (credenciales + código) y entra.
      setRecoveryOpen(true);
    },
    onClient: () => {
      setEntryChoiceOpen(false);
      // Cliente: primero inicia sesión; desde ahí puede crear cuenta.
      setClientLoginOpen(true);
    },
    onMember: () => {
      setEntryChoiceOpen(false);
      // Miembro/admin: inicia sesión y entra al panel.
      setMemberLoginOpen(true);
    },
  };

  return (
    <div
      className={`landing-page${nativeCursor ? ' auth-screen' : ''}`}
      ref={raizPortadaRef}
      data-modo={modoPortada}
      data-app={appTelefono ?? undefined}
      // Solo el valor del primer pintado: luego lo anima `useCorteAnimado`, cuadro a cuadro.
      style={{ ['--corte' as string]: '50vw' }}
    >
      {/* En una app, la portada partida no llega a verse: se esconde hasta que `appTelefono` entra. */}
      <script dangerouslySetInnerHTML={{ __html: "var a=document.cookie.match(/(?:^|;\\s*)gcc_app=(\\w+)/);if(a)document.documentElement.dataset.gccApp=a[1]" }} />
      {/* La misma cabecera que el resto del sitio, en modo FLOTANTE: la portada es una
          experiencia a pantalla completa y una barra sólida encima le corta la escena. */}
      <CabeceraSitio />
      {/* Sin ratón (teléfono, tableta) no hay puntero que dibujar: su bucle por cuadro solo
          restaba rendimiento. */}
      {!nativeCursor && !esTactil && <PointerCursor />}
      <audio ref={corazonAudioRef} src="/sounds/music/corazon-portada.mp3" loop preload="auto" />
      {/* ====== HERO ====== */}
      <section
        ref={heroSectionRef}
        // El héroe mide EXACTAMENTE lo visible (la ventana menos el pie): la portada no se desliza
        // (Fernando, 2026-10-26). En el teléfono, las tarjetas van una bajo otra y en uno pequeño no
        // caben: ahí puede crecer (si no, se cortarían).
        // `pt-24` en el teléfono: allí el contenido puede no caber y empieza arriba del todo;
        // con `pt-16` (lo que mide la cabecera) la insignia quedaba pegada a ella.
        // `items-stretch`: el bloque ocupa todo el alto, con la cabeza FIJA arriba (no centrada).
        className="relative flex items-stretch justify-center text-center px-6 pt-[calc(4.75rem+var(--seguro-arriba))] md:pt-[calc(4rem+var(--seguro-arriba))] pb-3 md:pb-8 overflow-hidden min-h-[calc(100dvh-var(--alto-pie))] md:h-[calc(100dvh-var(--alto-pie))]"
      >
        {/* El cielo de estrellas: un «mundo» 5 veces la ventana, centrado (ver el efecto `medir`). */}
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div ref={worldRef} style={{ position: 'absolute', pointerEvents: 'none' }}>
            <PixelStars count={250} />
          </div>
        </div>

        <FondosPortada modo={modoPortada} ligero={esTactil} sinFrontera={!!appTelefono} />

        {/* Las cuatro esquinas del visor. */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-accent/30" />
        <div className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-accent/30" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-accent/30" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-accent/30" />

        {/* ══ EL BLOQUE CENTRAL (Fernando, 2026-10-26) ═════════════════════════════════════
            · La insignia y el titular «Un ❤ puede | cruzar al 🌍» están SIEMPRE y NO se mueven
              (Fernando: «se mantengan en la misma posición… y al seleccionar una opción no
              desaparezcan»). Van FIJOS bajo la cabecera (`.portada-cabeza`), no centrados: si se
              centraran, cambiar lo de debajo los desplazaría.
            · Debajo, la ZONA (`.portada-zona`), que ocupa el resto del alto: antes de elegir, las
              dos tarjetas de mundo y el pensamiento; tras elegir con un CLIC, «Volver» y los
              ROLES, justo debajo del titular.
            · Al elegir, la mitad del titular que cubre el mundo elegido cambia de color para
              leerse en él (`[data-modo]` en globals.css); el resto no se toca.
            ⚠️ Las tarjetas de mundo NO abren el acceso: lo hacen los roles. Probadas y
            descartadas el mismo día: ver `MEMORIA.md` § «LA PORTADA: DOS MUNDOS». */}
        <div
          className="portada-bloque relative z-10 w-full"
>
          {/* «Corazón» y «mundo» van como IMÁGENES pixel-art (`IconosTitular.tsx`); el texto
              completo sigue aquí para lectores de pantalla y buscadores. */}
          <h1 className="sr-only">Un Corazón puede cruzar al mundo</h1>

          <div className="portada-cabeza">
            <p className="cristal-portada inicio-insignia aparecer" style={{ ['--retraso' as string]: '100ms' }}>
              Proyecto de Desarrollo Humano
            </p>
            <div
              ref={titularRef}
              className={`cruce-rejilla inicio-titular aparecer ${choque ? 'titular-choque' : ''} ${separa ? 'titular-separa' : ''}`}
              aria-hidden="true"
              style={{ ['--retraso' as string]: '220ms' }}
            >
              {/* «EL CRUCE DEL CORAZÓN» (Fernando, 2026-10-28: «quitarle el texto y hacer una animación
                  que represente eso»). Sin palabras: el corazón a un lado, la Tierra al otro y una
                  línea de luz entre ellos. Al elegir mundo, el corazón salta en arco dejando una
                  estela, la Tierra le sale al encuentro y se unen en el centro; queda latiendo
                  sobre ella. El `h1` en `sr-only` conserva la frase. */}
              <p className="cruce-izquierda inicio-titular-izquierda">
                <span className="grafico-corazon">
                  <span className="grafico-estela" />
                  <IconoCorazon />
                </span>
              </p>
              <p className="cruce-derecha inicio-titular-derecha">
                <span className="grafico-mundo"><IconoMundo /></span>
              </p>
              {/* Los efectos del choque, en el centro exacto (la raya). */}
              {choque && (
                <span className="choque-efectos">
                  {Array.from({ length: 12 }, (_, i) => (
                    <span key={i} className="choque-polvo choque-corazoncito" style={{ ['--a' as string]: `${(i / 12) * 360 + (i % 2) * 14}deg`, ['--d' as string]: `${0.9 + (i % 3) * 0.35}em` }} />
                  ))}
                </span>
              )}
            </div>
            {/* Sin pensamientos en la portada desde el 2026-11-08 (Fernando): solo salen en la pantalla
                de inicio de sesión, encima del formulario (`InicioApp`). */}
            {/* EL ESLOGAN (Fernando, 2026-10-28): aparece debajo de los iconos cuando el corazón
                termina de unirse a la Tierra, palabra a palabra. Su hueco está SIEMPRE reservado
                (invisible antes de elegir), así no mueve nada al aparecer. */}
            <p className={`eslogan-portada ${choque ? 'es-visible' : ''}`} aria-hidden="true">
              {['Un', 'corazón', 'puede', 'cruzar', 'al', 'mundo'].map((p, i) => (
                <span key={p} className={i >= 3 ? 'eslogan-acento' : ''} style={{ ['--i' as string]: i }}>
                  {p}
                </span>
              ))}
              <span className="eslogan-linea" />
            </p>
          </div>

          <div className="portada-zona">
            {!mundoElegido ? (
              <div key="inicio" className="inicio-portada">
                <div className="inicio-tarjetas aparecer" style={{ ['--retraso' as string]: '360ms' }}>
                  <PanelesMundo onElegir={elegirMundo} />
                </div>
                {/* El pensamiento ya no va aquí: flota en el cielo (`FeaturedThought nube`, en la cabeza,
                    2026-10-30). Pero su HUECO se queda, del mismo alto, en todos los tamaños: Aventura y
                    Progreso quedan donde estaban (Fernando: «antes estaban perfectamente posicionados»).
                    En el teléfono el pensamiento aparece aquí; desde 640 px, en el cielo. */}
                {/* El hueco del pensamiento se queda, vacío: sin él, Aventura y Progreso se moverían. */}
                <div className="inicio-pensamiento hueco-pensamiento" aria-hidden />
              </div>
            ) : appWeb ? null : (
              <div key="mundo" className={`mundo-elegido mundo-${mundoElegido}`}>
                {/* Entran cuando TERMINA el eslogan (Fernando, 2026-10-28): cruce 0,65 s + 1,9 s y las
                    palabras del eslogan, ≈ 3,4 s. Con «reducir movimiento», enseguida. */}
                <RolesMundo
                  tema={mundoElegido}
                  acciones={accionesAcceso}
                  retrasoBase={reducirMovimiento || appTelefono ? 0 : 3400}
                  onVolver={appTelefono ? undefined : () => setMundoElegido(null)}
                  soloMiembro={appTelefono === 'centralizado'}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {(appTelefono || appWeb) && (
        <InicioApp
          app={appTelefono ?? appWeb!}
          onVolver={appTelefono ? undefined : () => setMundoElegido(null)}
          acciones={accionesAcceso}
          onPostular={() => setOnboardingOpen(true)}
          onCrearCuenta={() => setClientSignupOpen(true)}
        />
      )}

      {recoveryOpen && (
        <AccountRecoveryModal
          onClose={() => setRecoveryOpen(false)}
          onSuccess={() => {
            // Candidato con sesión iniciada: va al panel.
            setRecoveryOpen(false);
            setOnboardingOpen(false);
            window.location.href = destinoTrasAcceso ?? '/dashboard';
          }}
        />
      )}

      {entryChoiceOpen && (
        <EntryChoiceModal
          onClose={() => setEntryChoiceOpen(false)}
          {...accionesAcceso}
        />
      )}

      {onboardingOpen && (
        <OnboardingSlidersModal
          tema="progreso"
          onClose={() => setOnboardingOpen(false)}
          onComplete={async (postulacion) => {
            // Registra la propuesta (`enviarPostulacion`, la misma que usa la página Candidatos).
            const error = await enviarPostulacion(postulacion);
            if (error) return error;
            setOnboardingOpen(false);
            setProposalPending({ email: postulacion.email, emailVerified: false });
            return null;
          }}
        />
      )}

      {proposalPending && (
        <ProposalPendingModal
          email={proposalPending.email}
          emailVerified={proposalPending.emailVerified}
          approved={proposalPending.approved}
          onContinue={() => {
            const email = proposalPending.email;
            setProposalPending(null);
            setCandidateAccount({ email });
          }}
          onClose={() => setProposalPending(null)}
        />
      )}

      {candidateAccount && (
        <CandidateAccountModal
          email={candidateAccount.email}
          onClose={() => setCandidateAccount(null)}
          onDone={() => {
            // Cuenta creada (sesión de candidato activa): al panel.
            setCandidateAccount(null);
            window.location.href = '/dashboard';
          }}
        />
      )}

      {clientPending && (
        <ProposalPendingModal
          mode="client"
          email={clientPending.email}
          emailVerified={false}
          onClose={() => setClientPending(null)}
        />
      )}

      {clientSignupOpen && (
        <ClientSignupModal
          onClose={() => setClientSignupOpen(false)}
          onLogin={() => {
            setClientSignupOpen(false);
            setClientLoginOpen(true);
          }}
        />
      )}

      {clientLoginOpen && (
        <ClientLoginModal
          correoInicial={correoSugerido}
          onClose={() => setClientLoginOpen(false)}
          onSignup={() => {
            setClientLoginOpen(false);
            setClientSignupOpen(true);
          }}
          onLoggedIn={() => {
            setClientLoginOpen(false);
            if (destinoTrasAcceso) { window.location.href = destinoTrasAcceso; return; }
            // El cliente va a Accesos, en la app y en la web (la web es GCC Miembros desde el 2026-11-08).
            window.location.href = '/dashboard/accesos';
          }}
        />
      )}

      {memberLoginOpen && (
        <MemberLoginModal
          onClose={() => setMemberLoginOpen(false)}
          onLoggedIn={() => {
            setMemberLoginOpen(false);
            window.location.href = destinoTrasAcceso ?? '/dashboard';
          }}
        />
      )}

      {/* El MISMO pie que el resto del sitio (decisión de Fernando, 2026-08-02). */}
      <PieSitio />
    </div>
  );
}
