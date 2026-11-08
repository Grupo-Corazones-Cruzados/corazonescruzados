'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle, BookUser, Bot, CheckCircle2, FlaskConical, Plug, RefreshCw, ShieldAlert, Smartphone, CircleDashed,
} from 'lucide-react';
import { Boton, Campo, Confirmar, EstadoVacio, Entrada, Insignia, Tarjeta, Ventanita } from '@/componentes/ui';
import { AccionesTarjeta, type AccionMenu } from '@/componentes/Navegacion';
import { esFalloDeIA } from '@/lib/fallos';
import { fechaHora, fechaLarga } from '@/lib/formato';
import {
  comprobarWhatsApp, conectarNumeroPrueba, conectarWhatsApp, marcarCoexistencia, pedirAgenda, type EstadoMeta,
} from '@/acciones/whatsapp';

/** Lo que la pantalla sabe del canal. Nunca un secreto: solo si existe. */
export type ConexionVista = {
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

/**
 * CONFIGURACIÓN ▸ WHATSAPP (Fernando, 2026-11-07).
 *
 * El alta del número por Embedded Signup con COEXISTENCIA, portada de la plataforma
 * (`AgenteConexion.tsx`, retirado con el módulo). Las tres cicatrices que trae:
 *
 *  1. La coexistencia hay que PEDIRLA. Sin ella Meta abre el flujo estándar, cuyo único
 *     camino para un número que ya usa WhatsApp Business es el que se lo quita del
 *     teléfono (Peter Tours, 2026-08-03). Desde 2026-11-07 se pide con Embedded Signup v5
 *     (`extras.version = 'v5'`), donde viene activada por defecto.
 *  2. El callback de `FB.login` NO puede ser `async`: el SDK lo rechaza y no abre nada.
 *  3. El `postMessage` de Meta es una pista: en coexistencia el evento es
 *     `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING` (en v5 la cuenta va en `messaging_account_ids`). El servidor deduce
 *     la cuenta del token si no llega.
 */
export default function SeccionWhatsApp({
  slug,
  conexion,
  appId,
  configId,
  esCortesia,
}: {
  slug: string;
  conexion: ConexionVista | null;
  appId: string | null;
  configId: string | null;
  esCortesia: boolean;
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [sdkListo, setSdkListo] = useState(false);
  const [confirmarAlta, setConfirmarAlta] = useState(false);
  const [confirmarAgenda, setConfirmarAgenda] = useState(false);
  const [prueba, setPrueba] = useState(false);
  const [estadoMeta, setEstadoMeta] = useState<EstadoMeta | null>(null);
  const datosDelAlta = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const hablo = useRef(false);

  const conectado = conexion?.estado === 'conectado' && !!conexion.phoneNumberId;
  const faltaConfig = !appId || !configId;

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
        // v5: la cuenta llega en `messaging_account_ids` (sustituye a `waba_id`).
        if (typeof d.event === 'string' && d.event.startsWith('FINISH'))
          datosDelAlta.current = {
            wabaId: d.data?.messaging_account_ids?.[0] ?? d.data?.waba_id,
            phoneNumberId: d.data?.phone_number_id,
          };
        // Meta dice en qué pantalla se quedó y, si falló, con qué código (p. ej. 3441045:
        // número no elegible; 3441049: conectado a otro proveedor). Se enseña tal cual:
        // es lo único que permite diagnosticar un alta sin adivinar.
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
    arranca(async () => tras(await conectarWhatsApp(slug, { codigo, ...datosDelAlta.current })));
  }, [slug, tras]);

  const abrirMeta = useCallback(() => {
    setConfirmarAlta(false);
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
           * ⚠️ EMBEDDED SIGNUP v5 (2026-11-07). Meta retiró v2 y v3 el 2026-10-15: un launch
           * con `sessionInfoVersion: '3'` + `featureType` se atiende como v4 y, con nuestra
           * configuración, abrió la lista estándar «Agrega tu número… / Ingresar un nuevo
           * número» en vez de la coexistencia. En v5 la coexistencia viene activada por
           * defecto; `version` va DENTRO de `extras`.
           */
          //
          // ⚠️ EN v4/v5 NO HAY BOTÓN DE «CONECTAR CUENTA EXISTENTE» (Meta, default-flow:
          // «Phone Number First»). La primera pantalla es «Agrega tu número»; la coexistencia
          // entra SOLA al escribir un número que está en la app WhatsApp Business, y sigue con
          // un código QR que se escanea desde la app. Ver el aviso de la pantalla.
          extras: { version: 'v5' },
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
  }, [configId, cerrarAlta]);

  const comprobar = () =>
    arranca(async () => {
      const r = await comprobarWhatsApp(slug);
      if (!r.ok) { toast.error(r.error); return; }
      setEstadoMeta(r.estado);
      if (r.estado.fallos.length) toast.error(r.estado.fallos.join(' · '), { duration: 12000 });
    });

  if (faltaConfig) {
    return (
      <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
        <EstadoVacio
          icono={AlertTriangle}
          titulo="La conexión con WhatsApp no está disponible"
          detalle={esCortesia
            ? 'Faltan WHATSAPP_APP_ID o WHATSAPP_ES_CONFIG_ID en el servicio de Railway.'
            : 'Escríbenos a soporte y lo revisamos contigo.'}
        />
      </Tarjeta>
    );
  }

  const plazoAgendaAbierto =
    !!conexion?.conectadoEn && Date.now() - new Date(conexion.conectadoEn).getTime() < PLAZO_AGENDA_MS;
  const puedePedirAgenda = conectado && !conexion?.agendaPedidaEn && plazoAgendaAbierto;

  const acciones: AccionMenu[] = conectado ? [
    { etiqueta: 'Comprobar con Meta', icono: RefreshCw, alPulsar: comprobar, deshabilitado: enCurso },
    conexion!.coexistencia
      ? { etiqueta: 'Marcar coexistencia pendiente', icono: CircleDashed, deshabilitado: enCurso,
          alPulsar: () => arranca(async () => tras(await marcarCoexistencia(slug, false))) }
      : { etiqueta: 'Marcar coexistencia comprobada', icono: CheckCircle2, deshabilitado: enCurso,
          titulo: 'Márcala cuando el equipo entre a WhatsApp Web con este número',
          alPulsar: () => arranca(async () => tras(await marcarCoexistencia(slug, true))) },
    ...(puedePedirAgenda ? [{ etiqueta: 'Pedir la agenda', icono: BookUser, deshabilitado: enCurso, alPulsar: () => setConfirmarAgenda(true) }] : []),
    { etiqueta: 'Volver a conectar', icono: Plug, deshabilitado: enCurso || !sdkListo, alPulsar: () => setConfirmarAlta(true) },
    // El agente (clave de OpenAI, encendido, lo que sabe) vive en el Estudio: aquí solo la conexión.
    { etiqueta: 'Ajustes del agente', icono: Bot, href: `/${slug}/estudio` },
  ] : [];

  const estado = ESTADO[conexion?.estado ?? 'sin_conectar'] ?? ESTADO.sin_conectar;

  return (
    <>
      <Tarjeta className="flex h-full flex-col p-4 sm:p-5">
        {conectado ? (
          <>
            <div className="mb-4 flex items-center justify-end gap-3 lg:justify-between">
              <h2 className="hidden text-[14px] font-semibold text-texto lg:block">Tu número de WhatsApp</h2>
              <AccionesTarjeta acciones={acciones} />
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Dato titulo="Número">
                <span className="font-semibold">{conexion!.numero ?? '—'}</span>
                {conexion!.nombreVerificado && <span className="block truncate text-[11.5px] text-tenue">{conexion!.nombreVerificado}</span>}
              </Dato>
              <Dato titulo="Estado"><Insignia tono={estado.tono}>{estado.texto}</Insignia></Dato>
              <Dato titulo="Coexistencia">
                <Insignia tono={conexion!.coexistencia ? 'exito' : 'aviso'}>
                  {conexion!.coexistencia ? 'Comprobada' : 'Sin comprobar'}
                </Insignia>
              </Dato>
              <Dato titulo="Cuenta de WhatsApp"><code className="text-[12px]">{conexion!.wabaId ?? '—'}</code></Dato>
              <Dato titulo="Identificador del número"><code className="text-[12px]">{conexion!.phoneNumberId ?? '—'}</code></Dato>
              <Dato titulo="Agenda de contactos">
                {conexion!.agendaPedidaEn
                  ? `Pedida el ${fecha(conexion!.agendaPedidaEn)}`
                  : plazoAgendaAbierto ? <Insignia tono="aviso">Sin pedir · hasta {fecha(new Date(new Date(conexion!.conectadoEn!).getTime() + PLAZO_AGENDA_MS).toISOString())}</Insignia>
                  : <span className="text-tenue">Plazo cerrado</span>}
              </Dato>

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

            {/* Solo los fallos de la CONEXIÓN; los del agente (la clave de OpenAI) los enseña el Estudio. */}
            {conexion!.ultimoError && !esFalloDeIA(conexion!.ultimoError) && <UltimoFallo texto={conexion!.ultimoError} en={conexion!.ultimoErrorEn} />}
          </>
        ) : (
          <>
            <h2 className="mb-4 hidden text-[14px] font-semibold text-texto lg:block">Conectar tu número de WhatsApp</h2>

            <div className="mb-4 flex items-start gap-2.5 rounded border border-borde bg-error-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-error">
              <ShieldAlert className="mt-px h-4 w-4 shrink-0" />
              <span>
                En la ventana de Meta escribe tu número en <strong>«Ingresar un nuevo número de teléfono»</strong>.
                Si está en WhatsApp Business, Meta te pedirá <strong>escanear un código QR desde la app</strong>:
                ese es el camino correcto. Si en vez del QR te pide un código por SMS o llamada,
                <strong>cierra la ventana</strong>: ese camino saca el número del teléfono y tu equipo pierde WhatsApp Web.
              </span>
            </div>

            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-tenue">Antes de empezar</p>
            <ul className="space-y-2 text-[13px] text-texto">
              <Requisito>El número está en la aplicación <strong>WhatsApp Business</strong> (no en la normal), versión 2.24.17 o superior.</Requisito>
              <Requisito>Tienes el teléfono a mano: hay que escanear un código QR desde la aplicación.</Requisito>
              <Requisito>El número no está conectado a otro proveedor (en la app: Ajustes ▸ Cuenta ▸ Plataforma empresarial).</Requisito>
              <Requisito>Entras con la cuenta de Facebook que administra el portafolio comercial de tu negocio.</Requisito>
            </ul>

            {conexion?.estado === 'error' && conexion.ultimoError && (
              <UltimoFallo texto={conexion.ultimoError} en={conexion.ultimoErrorEn} />
            )}

            <div className="mt-auto flex flex-wrap justify-end gap-2 pt-5">
              {esCortesia && (
                <Boton variante="secundario" tamano="lg" icono={FlaskConical} onClick={() => setPrueba(true)} disabled={enCurso}>
                  Número de prueba
                </Boton>
              )}
              <Boton tamano="lg" icono={Plug} onClick={() => setConfirmarAlta(true)} disabled={enCurso || !sdkListo}>
                {enCurso ? 'Conectando…' : sdkListo ? 'Conectar con WhatsApp' : 'Cargando Meta…'}
              </Boton>
            </div>
          </>
        )}
      </Tarjeta>

      <Confirmar
        abierto={confirmarAlta}
        titulo="Antes de abrir Meta"
        mensaje="Escribe tu número en «Ingresar un nuevo número de teléfono». Lo correcto es que Meta te pida escanear un código QR desde la app WhatsApp Business. Si te pide un código por SMS o llamada, cierra la ventana: ese camino saca el número del teléfono y tu equipo pierde WhatsApp Web."
        textoAceptar="Entendido, abrir Meta"
        peligro={false}
        alAceptar={abrirMeta}
        alCerrar={() => setConfirmarAlta(false)}
      />

      <Confirmar
        abierto={confirmarAgenda}
        titulo="Pedir la agenda de contactos"
        mensaje="Se pide a Meta la agenda del teléfono para que en Conversaciones cada contacto salga con el nombre que le tienes guardado. Meta lo permite una sola vez y dentro de las 24 horas siguientes a la conexión; llega por partes durante las próximas horas."
        textoAceptar="Pedirla ahora"
        peligro={false}
        ocupado={enCurso}
        alAceptar={() => arranca(async () => { setConfirmarAgenda(false); tras(await pedirAgenda(slug)); })}
        alCerrar={() => setConfirmarAgenda(false)}
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
