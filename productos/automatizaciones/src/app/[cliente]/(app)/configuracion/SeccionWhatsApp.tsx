'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle, BookUser, Bot, CheckCircle2, FlaskConical, Plug, RefreshCw, ShieldAlert, Smartphone, CircleDashed,
  PhoneCall, Plus, Cloud,
} from 'lucide-react';
import { Boton, Campo, Confirmar, EstadoVacio, Entrada, Insignia, PanelLateral, Tabla, Ventanita } from '@/componentes/ui';
import { AccionesTarjeta, MenuFila, type AccionMenu } from '@/componentes/Navegacion';
import { cn } from '@/lib/utils';
import { esFalloDeIA } from '@/lib/fallos';
import { fechaHora, fechaLarga } from '@/lib/formato';
import {
  comprobarWhatsApp, conectarNumeroPrueba, conectarWhatsApp, marcarCoexistencia, pedirAgenda, reintentarLlamadas,
  type EstadoMeta, type Metodo,
} from '@/acciones/whatsapp';

/** Lo que la pantalla sabe de UN número. Nunca un secreto: solo si existe. */
export type ConexionVista = {
  id: number;
  metodo: Metodo;
  llamadas: 'NO' | 'ACTIVAS' | 'ERROR';
  llamadasError: string | null;
  estado: string;
  numero: string | null;
  nombreVerificado: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
  tieneToken: boolean;
  coexistencia: boolean;
  conectadoEn: string | null;
  agendaPedidaEn: string | null;
  ultimoError: string | null;
  ultimoErrorEn: string | null;
};

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

const PLAZO_AGENDA_MS = 24 * 60 * 60 * 1000;
// Zona fija: el servidor pinta en UTC y el navegador en la suya; con zona distinta, React
// rechaza la hidratación (#418). Todos los inquilinos actuales son de Ecuador.
const ZONA = 'America/Guayaquil';
const fecha = (iso: string) => fechaHora(iso, ZONA);
const dia = (iso: string) => fechaLarga(iso, ZONA);

const ESTADO: Record<string, { texto: string; tono: 'exito' | 'aviso' | 'error' | 'neutro' }> = {
  conectado: { texto: 'Conectado', tono: 'exito' },
  conectando: { texto: 'Conectando', tono: 'aviso' },
  error: { texto: 'Con error', tono: 'error' },
  sin_conectar: { texto: 'Sin conectar', tono: 'neutro' },
};

const METODO: Record<Metodo, { nombre: string; icono: typeof Smartphone }> = {
  COEXISTENCIA: { nombre: 'Coexistencia', icono: Smartphone },
  CLOUD_API: { nombre: 'Cloud API', icono: Cloud },
};

/**
 * CONFIGURACIÓN ▸ WHATSAPP — los NÚMEROS del inquilino (Fernando, 2026-11-07; varios números y
 * dos métodos desde 2026-11-10).
 *
 * El alta es por Embedded Signup v5. Hay DOS métodos y se elige antes de abrir Meta:
 *  · COEXISTENCIA: el número sigue en la app WhatsApp Business; Meta la activa sola al escribir
 *    un número de la app y sigue con un QR. Meta no admite llamadas en coexistencia.
 *  · CLOUD API: el número queda solo en la API (verificación por SMS o llamada). Se pide a Meta
 *    con `features: [{ name: 'whatsapp_business_app_onboarding', enabled: false }]`; el servidor
 *    lo registra con PIN y activa las LLAMADAS ENTRANTES. Las salientes quedan pendientes.
 * Lo que de verdad quedó lo mide el servidor (`is_on_biz_app`), no lo que se pidió.
 *
 * Las cicatrices del alta siguen igual:
 *  1. El callback de `FB.login` NO puede ser `async`: el SDK lo rechaza y no abre nada.
 *  2. El `postMessage` de Meta es una pista (en v5 la cuenta va en `messaging_account_ids`); el
 *     servidor deduce la cuenta del token si no llega.
 *  3. En v4/v5 no hay botón de «conectar cuenta existente»: la primera pantalla es «Agrega tu número».
 */
export default function SeccionWhatsApp({
  slug,
  numeros,
  falloAlta,
  appId,
  configId,
  esCortesia,
}: {
  slug: string;
  numeros: ConexionVista[];
  /** El último fallo de un alta que no llegó a terminar (un canal sin número). */
  falloAlta: { texto: string; en: string | null } | null;
  appId: string | null;
  configId: string | null;
  esCortesia: boolean;
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [sdkListo, setSdkListo] = useState(false);
  /** El alta que se está preparando: método elegido y, si es volver a conectar, de qué número. */
  const [alta, setAlta] = useState<{ metodo: Metodo; canalId: number | null } | null>(null);
  const [detalle, setDetalle] = useState<number | null>(null);
  const [agendaDe, setAgendaDe] = useState<number | null>(null);
  const [prueba, setPrueba] = useState(false);
  const [estadoMeta, setEstadoMeta] = useState<{ canalId: number; estado: EstadoMeta } | null>(null);
  const datosDelAlta = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const pedidoAlta = useRef<{ metodo: Metodo; canalId: number | null }>({ metodo: 'COEXISTENCIA', canalId: null });
  const hablo = useRef(false);

  const faltaConfig = !appId || !configId;
  const abierto = numeros.find((n) => n.id === detalle) ?? null;

  // El SDK de Meta solo se carga si se puede abrir el alta.
  useEffect(() => {
    if (!appId || !configId) return;
    if (window.FB) { setSdkListo(true); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, xfbml: false, version: 'v27.0' });
      setSdkListo(true);
    };
    if (document.getElementById('sdk-meta')) return;
    const s = document.createElement('script');
    s.id = 'sdk-meta';
    s.src = 'https://connect.facebook.net/es_LA/sdk.js';
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    document.body.appendChild(s);
  }, [appId, configId]);

  // Los identificadores que Meta manda por `postMessage` antes que el código.
  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      if (!ev.origin.endsWith('facebook.com')) return;
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== 'WA_EMBEDDED_SIGNUP') return;
        hablo.current = true;
        if (typeof d.event === 'string' && d.event.startsWith('FINISH'))
          datosDelAlta.current = {
            wabaId: d.data?.messaging_account_ids?.[0] ?? d.data?.waba_id,
            phoneNumberId: d.data?.phone_number_id,
          };
        // Meta dice en qué pantalla se quedó y, si falló, con qué código. Se enseña tal cual.
        if (d.event === 'CANCEL') {
          const paso = d.data?.current_step ? ` (pantalla: ${d.data.current_step})` : '';
          const fallo = d.data?.error_message
            ? ` Meta: ${d.data.error_message}${d.data?.error_code ? ` [${d.data.error_code}]` : ''}`
            : '';
          console.info('[alta WhatsApp] CANCEL', d.data);
          toast.info(`Se cerró la ventana de Meta sin terminar${paso}.${fallo}`, { duration: 20000 });
        }
      } catch { /* mensajes de Meta que no son del alta */ }
    };
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
  }, []);

  const tras = useCallback((r: { ok: true; mensaje?: string; aviso?: string } | { ok: false; error: string }) => {
    if (!r.ok) toast.error(r.error, { duration: 12000 });
    else {
      toast.success(r.mensaje ?? 'Hecho.');
      if (r.aviso) toast.info(r.aviso, { duration: 12000 });
    }
    setEstadoMeta(null);
    router.refresh();
  }, [router]);

  /** Separado del callback de `FB.login`, que no admite funciones `async`. */
  const cerrarAlta = useCallback((respuesta: any) => {
    const codigo = respuesta?.authResponse?.code;
    if (!codigo) {
      toast.info('La conexión no se completó. Si cerraste la ventana sin terminar, vuelve a intentarlo.');
      return;
    }
    const { metodo, canalId } = pedidoAlta.current;
    arranca(async () => tras(await conectarWhatsApp(slug, { codigo, ...datosDelAlta.current, metodo, canalId })));
  }, [slug, tras]);

  const abrirMeta = useCallback(() => {
    if (!alta) return;
    pedidoAlta.current = alta;
    setAlta(null);
    if (!window.FB) {
      toast.error('El conector de Meta no ha cargado. Recarga la página; si sigue igual, revisa si un bloqueador frena connect.facebook.net.');
      return;
    }
    datosDelAlta.current = {};
    hablo.current = false;
    try {
      window.FB.login(
        (respuesta: any) => { cerrarAlta(respuesta); },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          /**
           * EMBEDDED SIGNUP v5. Meta retiró v2 y v3 el 2026-10-15; `version` va DENTRO de `extras`.
           * En v5 la coexistencia viene activada por defecto; para CLOUD API se apaga con
           * `features` (Meta: «applies even if you also pass featureType»).
           */
          extras: alta.metodo === 'CLOUD_API'
            ? { version: 'v5', features: [{ name: 'whatsapp_business_app_onboarding', enabled: false }] }
            : { version: 'v5' },
        },
      );
    } catch (e) {
      toast.error(`El conector de Meta rechazó la llamada: ${e instanceof Error ? e.message : e}`);
      return;
    }
    // Sin abrir una ventana propia (gastaría el único permiso de emergentes del clic).
    window.setTimeout(() => {
      if (hablo.current || !document.hasFocus()) return;
      toast.error('La ventana de Meta no llegó a abrirse. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.', { duration: 15000 });
    }, 3000);
  }, [alta, configId, cerrarAlta]);

  const comprobar = (canalId: number) =>
    arranca(async () => {
      const r = await comprobarWhatsApp(slug, canalId);
      if (!r.ok) { toast.error(r.error); return; }
      setEstadoMeta({ canalId, estado: r.estado });
      if (r.estado.fallos.length) toast.error(r.estado.fallos.join(' · '), { duration: 12000 });
    });

  if (faltaConfig) {
    return (
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <EstadoVacio
          icono={AlertTriangle}
          titulo="La conexión con WhatsApp no está disponible"
          detalle={esCortesia
            ? 'Faltan WHATSAPP_APP_ID o WHATSAPP_ES_CONFIG_ID en el servicio de Railway.'
            : 'Escríbenos a soporte y lo revisamos contigo.'}
        />
      </div>
    );
  }

  /** Las acciones de un número: las mismas en su «⋯» y en su panel. */
  const accionesDe = (n: ConexionVista): AccionMenu[] => {
    const conectado = n.estado === 'conectado' && !!n.phoneNumberId;
    const plazo = !!n.conectadoEn && Date.now() - new Date(n.conectadoEn).getTime() < PLAZO_AGENDA_MS;
    return [
      { etiqueta: 'Comprobar con Meta', icono: RefreshCw, deshabilitado: enCurso || !n.phoneNumberId, alPulsar: () => { setDetalle(n.id); comprobar(n.id); } },
      ...(n.metodo === 'CLOUD_API' && n.llamadas !== 'ACTIVAS' && conectado
        ? [{ etiqueta: 'Activar llamadas', icono: PhoneCall, deshabilitado: enCurso,
            alPulsar: () => arranca(async () => tras(await reintentarLlamadas(slug, n.id))) }]
        : []),
      ...(n.metodo === 'COEXISTENCIA' && conectado
        ? [n.coexistencia
            ? { etiqueta: 'Marcar coexistencia pendiente', icono: CircleDashed, deshabilitado: enCurso,
                alPulsar: () => arranca(async () => tras(await marcarCoexistencia(slug, n.id, false))) }
            : { etiqueta: 'Marcar coexistencia comprobada', icono: CheckCircle2, deshabilitado: enCurso,
                titulo: 'Márcala cuando el equipo entre a WhatsApp Web con este número',
                alPulsar: () => arranca(async () => tras(await marcarCoexistencia(slug, n.id, true))) }]
        : []),
      ...(n.metodo === 'COEXISTENCIA' && conectado && !n.agendaPedidaEn && plazo
        ? [{ etiqueta: 'Pedir la agenda', icono: BookUser, deshabilitado: enCurso, alPulsar: () => setAgendaDe(n.id) }]
        : []),
      { etiqueta: 'Volver a conectar', icono: Plug, deshabilitado: enCurso || !sdkListo, alPulsar: () => setAlta({ metodo: n.metodo, canalId: n.id }) },
      // El agente (clave de OpenAI, encendido, lo que sabe) vive en el Estudio: aquí solo la conexión.
      { etiqueta: 'Ajustes del agente', icono: Bot, href: `/${slug}/estudio?numero=${n.id}` },
    ];
  };

  const botonConectar = (
    <Boton icono={numeros.length ? Plus : Plug} onClick={() => setAlta({ metodo: 'COEXISTENCIA', canalId: null })} disabled={enCurso || !sdkListo}>
      {enCurso ? 'Conectando…' : !sdkListo ? 'Cargando Meta…' : numeros.length ? 'Conectar número' : 'Conectar con WhatsApp'}
    </Boton>
  );

  return (
    <>
      {numeros.length ? (
        <div className="flex flex-1 flex-col">
          {/* Sin título: la sección ya se llama «WhatsApp». La principal arriba a la derecha, como en Usuarios. */}
          <div className="flex justify-end gap-2 px-4 py-3">
            {esCortesia && (
              <Boton variante="secundario" icono={FlaskConical} onClick={() => setPrueba(true)} disabled={enCurso}>Número de prueba</Boton>
            )}
            {botonConectar}
          </div>
          {falloAlta && <div className="px-4"><UltimoFallo texto={falloAlta.texto} en={falloAlta.en} /></div>}
          <Tabla
            filas={numeros}
            claveFila={(n) => n.id}
            alPulsarFila={(n) => setDetalle(n.id)}
            filaActiva={(n) => n.id === detalle}
            recuento={`${numeros.length} ${numeros.length === 1 ? 'número' : 'números'}`}
            columnas={[
              { clave: 'numero', titulo: 'Número', ancho: '30%', render: (n) => (
                <div className="min-w-0">
                  <p className="truncate font-medium text-texto">{n.numero ?? '—'}</p>
                  {n.nombreVerificado && <p className="truncate text-[11.5px] text-tenue">{n.nombreVerificado}</p>}
                </div>
              ) },
              { clave: 'metodo', titulo: 'Método', ancho: '20%', render: (n) => (
                <Insignia tono="neutro" icono={METODO[n.metodo].icono}>{METODO[n.metodo].nombre}</Insignia>
              ) },
              { clave: 'llamadas', titulo: 'Llamadas', ancho: '20%', render: (n) => <EstadoLlamadas n={n} /> },
              { clave: 'estado', titulo: 'Estado', ancho: '18%', render: (n) => {
                const e = ESTADO[n.estado] ?? ESTADO.sin_conectar;
                return <Insignia tono={e.tono}>{e.texto}</Insignia>;
              } },
              { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (n) => (
                <div className="flex justify-end"><MenuFila acciones={accionesDe(n)} /></div>
              ) },
            ]}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          <EstadoVacio icono={Plug} titulo="Todavía no hay un número conectado" accion={botonConectar} />
          {falloAlta && <UltimoFallo texto={falloAlta.texto} en={falloAlta.en} />}
          {esCortesia && (
            <div className="mt-auto flex justify-end pt-5">
              <Boton variante="secundario" icono={FlaskConical} onClick={() => setPrueba(true)} disabled={enCurso}>Número de prueba</Boton>
            </div>
          )}
        </div>
      )}

      {/* ── Un número: sus datos y lo que se le puede hacer ── */}
      <PanelLateral
        abierto={abierto !== null}
        alCerrar={() => setDetalle(null)}
        titulo={abierto?.numero ?? 'Número'}
        descripcion={abierto?.nombreVerificado ?? undefined}
      >
        {abierto && <DetalleNumero n={abierto} acciones={accionesDe(abierto)} estadoMeta={estadoMeta?.canalId === abierto.id ? estadoMeta.estado : null} />}
      </PanelLateral>

      {/* ── Conectar un número: primero el método ── */}
      <PanelLateral
        abierto={alta !== null}
        alCerrar={() => setAlta(null)}
        titulo={alta?.canalId ? 'Volver a conectar' : 'Conectar un número'}
        pie={
          <div className="flex w-full justify-end gap-2">
            <Boton variante="secundario" onClick={() => setAlta(null)}>Cancelar</Boton>
            <Boton icono={Plug} onClick={abrirMeta} disabled={!sdkListo}>Abrir Meta</Boton>
          </div>
        }
      >
        {alta && <ElegirMetodo metodo={alta.metodo} alCambiar={(metodo) => setAlta({ ...alta, metodo })} />}
      </PanelLateral>

      <Confirmar
        abierto={agendaDe !== null}
        titulo="Pedir la agenda de contactos"
        mensaje="Se pide a Meta la agenda del teléfono para que en Conversaciones cada contacto salga con el nombre que le tienes guardado. Meta lo permite una sola vez y dentro de las 24 horas siguientes a la conexión; llega por partes durante las próximas horas."
        textoAceptar="Pedirla ahora"
        peligro={false}
        ocupado={enCurso}
        alAceptar={() => arranca(async () => { const id = agendaDe!; setAgendaDe(null); tras(await pedirAgenda(slug, id)); })}
        alCerrar={() => setAgendaDe(null)}
      />

      {esCortesia && (
        <NumeroDePrueba
          abierto={prueba}
          ocupado={enCurso}
          alCerrar={() => setPrueba(false)}
          alConectar={(phoneNumberId, wabaId) =>
            arranca(async () => {
              const r = await conectarNumeroPrueba(slug, { phoneNumberId, wabaId });
              if (r.ok) setPrueba(false);
              tras(r);
            })}
        />
      )}
    </>
  );
}

function EstadoLlamadas({ n }: { n: ConexionVista }) {
  if (n.metodo !== 'CLOUD_API') return <span className="text-tenue">—</span>;
  if (n.llamadas === 'ACTIVAS') return <Insignia tono="exito" icono={PhoneCall}>Recibe llamadas</Insignia>;
  if (n.llamadas === 'ERROR') return <span title={n.llamadasError ?? undefined}><Insignia tono="error">No activadas</Insignia></span>;
  return <span className="text-tenue">Sin activar</span>;
}

/** Los dos métodos, como dos opciones con sus requisitos debajo. */
function ElegirMetodo({ metodo, alCambiar }: { metodo: Metodo; alCambiar: (m: Metodo) => void }) {
  const opcion = (m: Metodo, linea: string) => {
    const Icono = METODO[m].icono;
    const activo = metodo === m;
    return (
      <button
        type="button"
        onClick={() => alCambiar(m)}
        aria-pressed={activo}
        className={cn(
          'foco-visible flex w-full items-start gap-3 rounded border px-3 py-3 text-left transition-colors',
          activo ? 'border-acento bg-acento-suave' : 'border-borde hover:bg-realce',
        )}
      >
        <Icono className={cn('mt-0.5 h-5 w-5 shrink-0', activo ? 'text-acento' : 'text-tenue')} />
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-texto">{METODO[m].nombre}</span>
          <span className="block text-[12.5px] leading-relaxed text-tenue">{linea}</span>
        </span>
      </button>
    );
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {opcion('COEXISTENCIA', 'El número sigue en la app WhatsApp Business del teléfono. Sin llamadas.')}
        {opcion('CLOUD_API', 'El número queda solo aquí: los chats y las llamadas entrantes se atienden desde esta aplicación.')}
      </div>

      {metodo === 'COEXISTENCIA' ? (
        <>
          <Aviso>
            En la ventana de Meta escribe tu número en <strong>«Ingresar un nuevo número de teléfono»</strong>.
            Meta te pedirá <strong>escanear un código QR desde la app</strong>: ese es el camino correcto. Si te pide un
            código por SMS o llamada, <strong>cierra la ventana</strong>: ese camino saca el número del teléfono.
          </Aviso>
          <ul className="space-y-2 text-[13px] text-texto">
            <Requisito>El número está en la aplicación <strong>WhatsApp Business</strong>, versión 2.24.17 o superior.</Requisito>
            <Requisito>Tienes el teléfono a mano para escanear el código QR.</Requisito>
            <Requisito>El número no está conectado a otro proveedor (en la app: Ajustes ▸ Cuenta ▸ Plataforma empresarial).</Requisito>
            <Requisito>Entras con la cuenta de Facebook que administra el portafolio comercial de tu negocio.</Requisito>
          </ul>
        </>
      ) : (
        <>
          <Aviso>
            El número <strong>no puede estar en WhatsApp ni en WhatsApp Business</strong>. Si lo está, Meta lo conecta
            con coexistencia y no recibirá llamadas. Para usar uno de la app, bórralo antes de la app.
          </Aviso>
          <ul className="space-y-2 text-[13px] text-texto">
            <Requisito>Puedes recibir un código por SMS o llamada en ese número para verificarlo.</Requisito>
            <Requisito>Para las llamadas, Meta pide que tu cuenta de WhatsApp tenga un límite de 2.000 mensajes al día o más y un método de pago.</Requisito>
            <Requisito>Entras con la cuenta de Facebook que administra el portafolio comercial de tu negocio.</Requisito>
          </ul>
        </>
      )}
    </div>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded border border-borde bg-error-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-error">
      <ShieldAlert className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Los datos de un número, en su panel. */
function DetalleNumero({ n, acciones, estadoMeta }: { n: ConexionVista; acciones: AccionMenu[]; estadoMeta: EstadoMeta | null }) {
  const plazoAgendaAbierto = !!n.conectadoEn && Date.now() - new Date(n.conectadoEn).getTime() < PLAZO_AGENDA_MS;
  const e = ESTADO[n.estado] ?? ESTADO.sin_conectar;
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><AccionesTarjeta acciones={acciones} /></div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Dato titulo="Estado"><Insignia tono={e.tono}>{e.texto}</Insignia></Dato>
        <Dato titulo="Método"><Insignia tono="neutro" icono={METODO[n.metodo].icono}>{METODO[n.metodo].nombre}</Insignia></Dato>
        {n.metodo === 'CLOUD_API' ? (
          <Dato titulo="Llamadas entrantes"><EstadoLlamadas n={n} /></Dato>
        ) : (
          <Dato titulo="Coexistencia">
            <Insignia tono={n.coexistencia ? 'exito' : 'aviso'}>{n.coexistencia ? 'Comprobada' : 'Sin comprobar'}</Insignia>
          </Dato>
        )}
        <Dato titulo="Cuenta de WhatsApp"><code className="text-[12px]">{n.wabaId ?? '—'}</code></Dato>
        <Dato titulo="Identificador del número"><code className="text-[12px]">{n.phoneNumberId ?? '—'}</code></Dato>
        {n.metodo === 'COEXISTENCIA' && (
          <Dato titulo="Agenda de contactos">
            {n.agendaPedidaEn
              ? `Pedida el ${fecha(n.agendaPedidaEn)}`
              : plazoAgendaAbierto ? <Insignia tono="aviso">Sin pedir · hasta {fecha(new Date(new Date(n.conectadoEn!).getTime() + PLAZO_AGENDA_MS).toISOString())}</Insignia>
              : <span className="text-tenue">Plazo cerrado</span>}
          </Dato>
        )}
        {estadoMeta && (
          <>
            <Dato titulo="Token">
              {!estadoMeta.token ? '—'
                : !estadoMeta.token.valido ? <Insignia tono="error">Vencido o revocado</Insignia>
                : !estadoMeta.token.venceEn ? <Insignia tono="exito">No vence</Insignia>
                : <Insignia tono={new Date(estadoMeta.token.venceEn).getTime() - Date.now() < 15 * 86400000 ? 'aviso' : 'exito'}>
                    Vence el {dia(estadoMeta.token.venceEn)}
                  </Insignia>}
            </Dato>
            <Dato titulo="Recepción de mensajes">
              {estadoMeta.suscrita === null ? '—'
                : estadoMeta.suscrita ? <Insignia tono="exito">Activa</Insignia>
                : <Insignia tono="error">No llegan mensajes</Insignia>}
            </Dato>
            <Dato titulo="Estado en Meta">
              {estadoMeta.numero ? `${estadoMeta.numero.status ?? '—'} · calidad ${estadoMeta.numero.quality_rating ?? '—'}` : '—'}
            </Dato>
          </>
        )}
      </dl>
      {n.metodo === 'CLOUD_API' && n.llamadas === 'ERROR' && n.llamadasError && (
        <UltimoFallo texto={`Llamadas: ${n.llamadasError}`} en={null} />
      )}
      {/* Solo los fallos de la CONEXIÓN; los del agente (la clave de OpenAI) los enseña el Estudio. */}
      {n.ultimoError && !esFalloDeIA(n.ultimoError) && <UltimoFallo texto={n.ultimoError} en={n.ultimoErrorEn} />}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded border border-borde bg-realce px-3 py-2">
      <dt className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-tenue">{titulo}</dt>
      <dd className="min-w-0 truncate text-[13px] text-texto">{children}</dd>
    </div>
  );
}

function Requisito({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-tenue" />
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function UltimoFallo({ texto, en }: { texto: string; en: string | null }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] leading-relaxed text-error">
      <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
      <span><strong>Último fallo{en ? ` (${fecha(en)})` : ''}</strong>: {texto}</span>
    </p>
  );
}

/** Los dos identificadores del número de prueba, de «WhatsApp → Configuración de la API». */
function NumeroDePrueba({ abierto, ocupado, alCerrar, alConectar }: {
  abierto: boolean; ocupado: boolean; alCerrar: () => void; alConectar: (phoneNumberId: string, wabaId: string) => void;
}) {
  const [numero, setNumero] = useState('');
  const [cuenta, setCuenta] = useState('');
  const listo = /^\d{6,}$/.test(numero) && /^\d{6,}$/.test(cuenta);
  return (
    <Ventanita
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Número de prueba de Meta"
      pie={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={ocupado}>Cancelar</Boton>
          <Boton icono={Plug} onClick={() => alConectar(numero, cuenta)} disabled={!listo || ocupado}>
            {ocupado ? 'Conectando…' : 'Conectar'}
          </Boton>
        </>
      }
    >
      <div className="space-y-3">
        <Campo etiqueta="Identificador del número">
          <Entrada value={numero} inputMode="numeric" placeholder="1300197646501797"
            onChange={(e) => setNumero(e.target.value.replace(/\s/g, ''))} />
        </Campo>
        <Campo etiqueta="Identificador de la cuenta de WhatsApp">
          <Entrada value={cuenta} inputMode="numeric" placeholder="1226288837237571"
            onChange={(e) => setCuenta(e.target.value.replace(/\s/g, ''))} />
        </Campo>
      </div>
    </Ventanita>
  );
}
