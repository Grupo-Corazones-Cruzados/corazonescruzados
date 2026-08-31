'use client';

/**
 * ALTA DEL NÚMERO DEL CLIENTE — Embedded Signup con coexistencia.
 *
 * Es la pantalla que convierte esto en producto: el alta de un cliente deja de ser un
 * proyecto y pasa a ser una pantalla.
 *
 * ⚠️ LLEVA EL ÚNICO PASO SIN VUELTA ATRÁS DE TODO EL SISTEMA. Dentro del diálogo de Meta
 * hay que elegir **«conectar una cuenta existente»**. Si se elige «dar de alta un número
 * nuevo», el número SALE DEL TELÉFONO y el equipo del cliente **pierde WhatsApp Web en el
 * acto**, sin aviso y sin forma de deshacerlo.
 *
 * Nosotros no controlamos lo que hay dentro del diálogo de Meta, así que lo que sí
 * podemos hacer es que nadie llegue ahí sin saberlo: se explica antes, se exige marcar
 * una casilla, y se repite en el momento de abrirlo.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/AuthProvider';
import { AccionesDelPanel } from '@/components/dashboard/flows/estudio/RanuraAcciones';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import BotonAyuda from '@/components/ui/BotonAyuda';
import { PanelEmpty } from '@/components/dashboard/flows/FlowPanelUI';
import { Plug, ShieldAlert, CheckCircle2, RefreshCw, AlertTriangle, Smartphone, FlaskConical } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

interface Props {
  flowId: number;
  canal: any;
  appId: string | null;
  configId: string | null;
  recargar: () => void;
}

export default function AgenteConexion({ flowId, canal, appId, configId, recargar }: Props) {
  const { user } = useAuth();

  /**
   * ⇒ ESTA PANTALLA ES DE GCC, AUNQUE EL NÚMERO SEA DEL CLIENTE.
   *
   * El cliente entra aquí porque la conexión vive dentro de su Estudio, y le sirve para
   * VER el estado de su número. Lo que no puede es tocarlo, y aquí todo lo que se toca es
   * irreversible:
   *
   *  · **El alta.** Dentro del diálogo de Meta hay una opción que le saca el número del
   *    teléfono y **deja a su propio equipo sin WhatsApp Web en el acto**. No es una
   *    decisión que deba poder tomar solo, sin nosotros al lado.
   *  · **Traer la agenda del cliente.** Un único intento por alta y 24 horas para usarlo.
   *    Un clic por curiosidad lo quema para siempre.
   *  · **El número de prueba de Meta**, que no tiene ningún sentido en su cuenta.
   *
   * Así que a un cliente se le enseña el estado y nada más. No es desconfianza: es que
   * ninguno de estos botones se puede deshacer, y quien responde de ellos somos nosotros.
   */
  const puedeAdministrar = user?.role === 'admin' || user?.role === 'member';

  const [sdkListo, setSdkListo] = useState(false);
  const [entendido, setEntendido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [estadoMeta, setEstadoMeta] = useState<any>(null);
  const datosDelAlta = useRef<{ waba_id?: string; phone_number_id?: string }>({});
  /** ¿La ventana de Meta llegó a dar señales de vida? Lo marca su `postMessage`. */
  const abierto = useRef(false);

  /* ── SDK de Meta ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!appId) return;
    if (window.FB) { setSdkListo(true); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId, cookie: true, xfbml: false, version: 'v21.0' });
      setSdkListo(true);
    };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/es_LA/sdk.js';
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    document.body.appendChild(s);
  }, [appId]);

  /**
   * Meta manda por `postMessage` los identificadores del alta. Llegan ANTES que el
   * código, así que se guardan aquí y se usan al cerrar.
   *
   * ⚠️ ESTO PERDIÓ UN ALTA ENTERA (Diego Castillo, 2026-08-28). Solo se hacía caso a los
   * eventos `FINISH` y `FINISH_ONLY_WABA`, que son los del flujo ESTÁNDAR. El nuestro es
   * el de **coexistencia** (`featureType: 'whatsapp_business_app_onboarding'`), y ahí Meta
   * emite **`FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`** — cuyo `data` trae SOLO `waba_id`,
   * nunca `phone_number_id`. Así que no se guardaba nada, el servidor rechazaba el alta
   * por falta de cuenta, y el código de Meta —que caduca en segundos— se perdía con ella.
   * El cliente ya tenía a GCC entre sus proveedores de tecnología y nuestra app decía que
   * no se había conectado nada.
   *
   * Por eso ahora se aceptan los tres nombres, y —lo importante— el servidor **ya no
   * depende de esto**: deduce la cuenta del propio token del cliente. Esto es una pista
   * que ahorra una llamada, no un requisito. Ver `wabasDelToken()` en `lib/agente/meta.ts`.
   */
  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      if (!ev.origin.endsWith('facebook.com')) return;
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== 'WA_EMBEDDED_SIGNUP') return;
        abierto.current = true;   // la ventana existe y habla: no está bloqueada
        console.info('[agente] Evento del alta de Meta', d.event, d.data);
        if (d.event?.startsWith('FINISH')) {
          datosDelAlta.current = { waba_id: d.data?.waba_id, phone_number_id: d.data?.phone_number_id };
        }
        if (d.event === 'CANCEL') {
          toast.info('El cliente cerró el alta sin terminarla.');
        }
      } catch { /* mensajes de Meta que no son del alta */ }
    };
    window.addEventListener('message', alMensaje);
    return () => window.removeEventListener('message', alMensaje);
  }, []);

  /** El trabajo de después del alta. Separado porque `FB.login` NO acepta un callback async. */
  const cerrarAlta = useCallback(async (respuesta: any) => {
    // Se registra SIEMPRE: cuando el alta falla dentro de la ventana de Meta, esto es lo
    // único que dice por qué.
    console.info('[agente] Respuesta del alta de Meta', respuesta);
    const codigo = respuesta?.authResponse?.code;
    if (!codigo) {
      const motivo = respuesta?.status ? ` (estado: ${respuesta.status})` : '';
      toast.info(`El alta no se completó${motivo}. Si cerraste la ventana sin terminar, vuelve a intentarlo.`);
      return;
    }

    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente/conectar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, ...datosDelAlta.current }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'No se pudo cerrar el alta'); return; }
      if (!d.suscrita) toast.error('El alta terminó pero la cuenta no quedó suscrita: no llegarán mensajes.');
      else toast.success('Número conectado. Falta comprobar WhatsApp Web con el cliente.');
      recargar();
    } finally { setOcupado(false); }
  }, [flowId, recargar]);

  const lanzar = useCallback(() => {
    // ⚠️ ESTE BOTÓN FALLABA EN SILENCIO. El `return` de aquí no decía nada: si el SDK no
    // había cargado o faltaba el identificador, se pulsaba «abrir el alta» y no pasaba
    // absolutamente nada — ni ventana, ni error, ni pista. Un botón que no hace nada y no
    // se queja es peor que uno que falla, porque no hay por dónde empezar a mirar.
    if (!window.FB) {
      toast.error('El conector de Meta no ha cargado. Recarga la página; si sigue igual, revisa si un bloqueador está frenando connect.facebook.net.');
      return;
    }
    if (!configId) {
      toast.error('Falta WHATSAPP_ES_CONFIG_ID en el servidor: sin él no se puede abrir el alta.');
      return;
    }
    setConfirmar(false);
    datosDelAlta.current = {};

    // ⚠️ AQUÍ HUBO UNA SONDA Y HACÍA MÁS DAÑO QUE BIEN. Para detectar el bloqueo de
    // emergentes se abría una ventana propia de 1×1 y se cerraba en el acto. Dos problemas,
    // los dos reales y vistos por Fernando:
    //   1. Se VE. El navegador impone un tamaño mínimo, así que aparecía una ventanita que
    //      se cerraba sola — justo el síntoma que se intentaba diagnosticar.
    //   2. La mayoría de navegadores permiten UNA sola emergente por gesto del usuario. La
    //      sonda se gastaba esa única, así que la de Meta quedaba bloqueada POR NOSOTROS.
    // La detección va después, sin consumir el permiso.
    console.info('[agente] Abriendo el alta de Meta', { configId, appId });
    abierto.current = false;

    // ⚠️ EL CALLBACK NO PUEDE SER `async`. AQUÍ ESTABA EL FALLO QUE TENÍA MUERTO EL BOTÓN.
    // El SDK de Meta valida el tipo del argumento y aborta con
    //     «Expression is of type asyncfunction, not function»
    // — una excepción SUYA, lanzada antes de abrir nada. Por eso no salía ninguna ventana
    // y no había ni un error nuestro: el fallo ocurría dentro del SDK.
    // Así que la función que se le pasa es normal y el trabajo asíncrono va aparte.
    try {
      window.FB.login(
        (respuesta: any) => { void cerrarAlta(respuesta); },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {},
            /**
             * ⚠️ ESTE CAMPO ES LO QUE PIDE LA COEXISTENCIA, Y ESTUVO VACÍO.
             *
             * Con `featureType: ''` Meta abre el flujo ESTÁNDAR, que solo sabe dar de alta
             * números nuevos o migrar uno existente. Le pasó a Peters Tours el 2026-08-03:
             * el desplegable solo ofrecía «Agregar un nuevo número de WhatsApp» y Meta
             * respondía «este número ya está registrado con una cuenta de WhatsApp; para
             * continuar, migra o desconéctalo». Es decir: el único camino que ofrecía era
             * el irreversible, el que le quita el WhatsApp al cliente.
             *
             * No era un fallo de Meta ni de la configuración del portafolio: **nunca le
             * habíamos pedido el flujo de coexistencia**.
             *
             * Documentación de Meta: «Add a featureType property set to
             * whatsapp_business_app_onboarding to the extras object in the launch method».
             * Y avisa de que **`coexistence` ya NO es un valor válido** — hay que usar este.
             */
            featureType: 'whatsapp_business_app_onboarding',
            sessionInfoVersion: '3',
          },
        },
      );
    } catch (err: any) {
      // El SDK lanza SÍNCRONAMENTE cuando no le gusta un argumento, y esa excepción se
      // perdía en la consola sin llegar a la pantalla. Que no vuelva a pasar.
      console.error('[agente] El SDK de Meta rechazó la llamada', err);
      toast.error(`El conector de Meta rechazó la llamada: ${err?.message ?? err}`);
      return;
    }

    // Detección SIN consumir el permiso de emergentes: si a los 3 segundos la ventana no
    // ha hablado y esta página nunca perdió el foco, es que no llegó a abrirse. No se
    // puede afirmar la causa —bloqueador, dominio del SDK sin autorizar, app no publicada—
    // así que se dice qué mirar, en orden, en vez de adivinar.
    window.setTimeout(() => {
      if (abierto.current || !document.hasFocus()) return;
      toast.error(
        'La ventana de Meta no llegó a abrirse. Revisa, por este orden: ventanas emergentes ' +
        'permitidas para este sitio · app.grupocc.org en «Dominios permitidos para el SDK de ' +
        'JavaScript» · la app de Meta publicada. La consola tiene el detalle.',
        { duration: 15000 },
      );
      console.warn('[agente] La ventana del alta no dio señales en 3 s. Comprueba en el panel de Meta: ' +
        'Inicio de sesión con Facebook → Configuración → Dominios permitidos para el SDK de JavaScript.');
    }, 3000);
  }, [configId, appId, cerrarAlta]);

  const consultarMeta = async () => {
    setOcupado(true);
    try {
      const d = await fetch(`/api/admin/flows/${flowId}/agente/conectar`).then((r) => r.json());
      if (d.error) { toast.error(d.error); return; }
      setEstadoMeta(d.data);
    } finally { setOcupado(false); }
  };

  /**
   * Alta del número de PRUEBA de Meta. No abre ninguna ventana: manda los dos
   * identificadores que Meta enseña en su panel y el servidor pone el token del usuario
   * del sistema. Ver el bloque `modo === 'prueba'` de la ruta `conectar`.
   */
  const conectarPrueba = useCallback(async (phone_number_id: string, waba_id: string) => {
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente/conectar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'prueba', phone_number_id, waba_id }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'No se pudo conectar el número de prueba'); return; }
      if (!d.suscrita) toast.error('Quedó guardado pero la cuenta no se suscribió: no llegarán mensajes.');
      else toast.success('Número de prueba conectado. Escríbele desde un destinatario verificado.');
      recargar();
    } finally { setOcupado(false); }
  }, [flowId, recargar]);

  /**
   * Trae del WhatsApp del cliente lo que ya tenía: su agenda y sus conversaciones previas.
   *
   * ⛔ UN SOLO INTENTO Y DENTRO DE 24 H DESDE EL ALTA. Por eso pasa por confirmación y por
   * eso el botón desaparece en cuanto se usa: no es un botón de «actualizar», es una
   * puerta que se cierra. Ver la ruta `.../agente/sincronizar`.
   */
  const [confirmarSync, setConfirmarSync] = useState<'contactos' | 'historial' | null>(null);

  const sincronizar = useCallback(async (tipo: 'contactos' | 'historial') => {
    setConfirmarSync(null);
    setOcupado(true);
    try {
      const res = await fetch(`/api/admin/flows/${flowId}/agente/sincronizar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.error ?? 'No se pudo pedir la sincronización', { duration: 12000 }); return; }
      toast.success(d.aviso, { duration: 15000 });
      recargar();
    } finally { setOcupado(false); }
  }, [flowId, recargar]);

  const conectado = canal.estado === 'conectado';
  const faltaConfig = !appId || !configId;

  return (
    <div>
      {/* Sin título propio: el panel del Estudio ya se llama «Conexión con WhatsApp» en su
          cabecera, y repetirlo dos centímetros más abajo era gastar una fila en decir lo
          mismo. El botón sube a esa cabecera — donde está el nombre, están sus acciones. */}
      {conectado && (
        <AccionesDelPanel>
          <button className={BTN_SECONDARY} onClick={consultarMeta} disabled={ocupado}>
            <RefreshCw className="w-4 h-4" /> Comprobar contra Meta
          </button>
        </AccionesDelPanel>
      )}

      {faltaConfig ? (
        <PanelEmpty Icon={AlertTriangle} title="Falta configurar la app de Meta"
          desc="No hay WHATSAPP_APP_ID o WHATSAPP_ES_CONFIG_ID en el servidor. Sin ellos no se puede abrir el alta." />
      ) : conectado ? (
        <>
          <Conectado canal={canal} estadoMeta={estadoMeta} />
          {puedeAdministrar && (
            <TraerDelCliente canal={canal} ocupado={ocupado} alPedir={setConfirmarSync} />
          )}
        </>
      ) : puedeAdministrar ? (
        <SinConectar
          sdkListo={sdkListo} entendido={entendido} setEntendido={setEntendido}
          ocupado={ocupado} alConectar={() => setConfirmar(true)} canal={canal}
          alConectarPrueba={conectarPrueba}
        />
      ) : (
        // El alta la hacemos nosotros CON el cliente delante: dentro del diálogo de Meta
        // hay un camino que le quita WhatsApp Web a su equipo y no se puede deshacer.
        <PanelEmpty
          Icon={Smartphone}
          title="Tu número todavía no está conectado"
          desc="La conexión con WhatsApp la hace el equipo de GCC contigo, porque durante el proceso hay que elegir bien una opción que no se puede deshacer. Escríbenos y lo hacemos juntos."
        />
      )}

      <PixelConfirm
        open={confirmarSync !== null}
        title={confirmarSync === 'historial' ? 'Traer las conversaciones anteriores' : 'Traer la agenda del cliente'}
        message={
          (confirmarSync === 'historial'
            ? 'Se le pedirá a Meta hasta 180 días de conversaciones anteriores al alta. '
            : 'Se le pedirá a Meta la agenda de contactos del cliente, para que en la bandeja se vean con el nombre que él les tiene puesto. ') +
          'Meta solo lo permite UNA VEZ y dentro de las 24 horas siguientes al alta: si se gasta ahora, ' +
          'no se puede repetir sin desconectar al cliente y volver a hacer todo el alta con él delante. ' +
          'Los datos no llegan al momento, sino por webhook durante las próximas horas. ¿Lo pedimos?'
        }
        confirmLabel="Sí, pedirlo ahora"
        onConfirm={() => confirmarSync && sincronizar(confirmarSync)}
        onCancel={() => setConfirmarSync(null)}
      />

      <PixelConfirm
        open={confirmar}
        title="Antes de abrir el alta"
        message={
          'En la ventana de Meta hay que elegir «conectar una cuenta existente». ' +
          'Si se elige «dar de alta un número nuevo», el número sale del teléfono y el equipo del ' +
          'cliente pierde WhatsApp Web en el acto, sin forma de deshacerlo. ¿Continuamos?'
        }
        confirmLabel="Entendido, abrir el alta"
        onConfirm={lanzar}
        onCancel={() => setConfirmar(false)}
      />
    </div>
  );
}

/* ── Antes de conectar ──────────────────────────────────────────────────────── */

function SinConectar({ sdkListo, entendido, setEntendido, ocupado, alConectar, canal, alConectarPrueba }: {
  sdkListo: boolean; entendido: boolean; setEntendido: (v: boolean) => void;
  ocupado: boolean; alConectar: () => void; canal: any;
  alConectarPrueba: (phoneNumberId: string, wabaId: string) => void;
}) {
  return (
    <div className="max-w-3xl space-y-4">
      <div className={`rounded-lg border ${TONO.error.caja} p-4`}>
        <div className="flex gap-2 items-start">
          <ShieldAlert className={`w-5 h-5 ${TONO.error.icono} shrink-0 mt-0.5`} />
          <div>
            <p className={`text-[13px] font-semibold ${TONO.error.texto}`} style={mf}>
              Hay un paso sin vuelta atrás, y está dentro de la ventana de Meta
            </p>
            <p className={`text-[12.5px] ${TONO.error.texto} mt-1 leading-relaxed`} style={mf}>
              Meta preguntará si quieres <strong>conectar una cuenta existente</strong> o
              <strong> dar de alta un número nuevo</strong>. Hay que elegir la primera.
            </p>
            <p className={`text-[12.5px] ${TONO.error.texto} mt-2 leading-relaxed`} style={mf}>
              Si se elige la segunda, <strong>el número sale del teléfono</strong> y el equipo del
              cliente <strong>pierde WhatsApp Web en el acto</strong>. No hay forma de deshacerlo
              desde aquí ni desde el panel de Meta.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-digi-border bg-digi-card p-4">
        <p className="text-[12.5px] font-semibold text-digi-text mb-2" style={mf}>
          Comprueba esto con el cliente antes de abrir la ventana
        </p>
        <ul className="space-y-1.5 text-[12.5px] text-digi-text" style={mf}>
          <li className="flex gap-2"><Smartphone className="w-4 h-4 shrink-0 text-digi-muted mt-[1px]" />
            El número está en la aplicación <strong>WhatsApp Business</strong>, no en la normal, en versión 2.24.17 o superior.</li>
          <li className="flex gap-2"><Smartphone className="w-4 h-4 shrink-0 text-digi-muted mt-[1px]" />
            Tiene el teléfono a mano: hay que confirmar la conexión desde la aplicación.</li>
          <li className="flex gap-2"><Smartphone className="w-4 h-4 shrink-0 text-digi-muted mt-[1px]" />
            Va a iniciar sesión con la cuenta que administra <strong>su</strong> portafolio comercial, no el nuestro.</li>
        </ul>
      </div>

      <label className="flex gap-2 items-start cursor-pointer text-[12.5px] text-digi-text" style={mf}>
        <input type="checkbox" checked={entendido} onChange={(e) => setEntendido(e.target.checked)} className="mt-0.5" />
        <span>
          He leído el aviso y sé que dentro de la ventana de Meta hay que elegir
          <strong> «conectar una cuenta existente»</strong>.
        </span>
      </label>

      <div className="flex items-center gap-3">
        <button className={BTN_PRIMARY} disabled={!entendido || !sdkListo || ocupado} onClick={alConectar}>
          <Plug className="w-4 h-4" /> {ocupado ? 'Cerrando el alta…' : 'Conectar el número del cliente'}
        </button>
        {!sdkListo && <span className="text-[12px] text-digi-muted" style={mf}>Cargando el conector de Meta…</span>}
        {canal.estado === 'error' && canal.ultimo_error && (
          <span className={`text-[12px] ${TONO.error.icono}`} style={mf}>Último intento: {canal.ultimo_error}</span>
        )}
      </div>

      <NumeroDePrueba ocupado={ocupado} alConectar={alConectarPrueba} />
    </div>
  );
}

/* ── El número de prueba de Meta ────────────────────────────────────────────── */

/**
 * El camino de al lado, para ensayar sin tocar a nadie.
 *
 * El alta de arriba necesita un cliente delante: su portafolio, su teléfono a mano y una
 * decisión irreversible dentro de la ventana de Meta. Eso no se puede ensayar. **Y el
 * portafolio dueño de la app no puede darse de alta a sí mismo**: sale en gris.
 *
 * El número de prueba sí: es de la app, ya existe, y solo hace falta copiar sus dos
 * identificadores de «WhatsApp → Configuración de la API». Con él se recorre la cadena
 * entera —webhook, cola, trabajador, agente, respuesta— antes de que exista un cliente.
 *
 * Va plegado a propósito: no es el camino normal, es la excepción.
 */
function NumeroDePrueba({ ocupado, alConectar }: {
  ocupado: boolean; alConectar: (phoneNumberId: string, wabaId: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const listo = /^\d{6,}$/.test(phoneNumberId.trim()) && /^\d{6,}$/.test(wabaId.trim());

  if (!abierto) {
    return (
      <button
        type="button" onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 text-[12px] text-digi-muted hover:text-accent transition-colors"
        style={mf}
      >
        <FlaskConical className="w-3.5 h-3.5" /> Conectar el número de prueba de Meta
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-digi-border bg-digi-card p-4 space-y-3">
      <div className="flex gap-2 items-start">
        <FlaskConical className="w-4 h-4 shrink-0 text-digi-muted mt-0.5" />
        <div>
          <p className="text-[12.5px] font-semibold text-digi-text" style={mf}>Número de prueba de Meta</p>
          <p className="text-[12px] text-digi-muted mt-1 leading-relaxed" style={mf}>
            Sirve para ensayar el agente de punta a punta. Solo habla con los destinatarios
            que estén verificados en el panel de Meta y caduca a los 90 días:
            <strong> no sirve para atender clientes</strong>. Los dos identificadores están en
            la app de Meta, en <em>WhatsApp → Configuración de la API</em>.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <CampoId
          label="Identificador del número" valor={phoneNumberId} alCambiar={setPhoneNumberId}
          ejemplo="1300197646501797"
        />
        <CampoId
          label="Identificador de la cuenta de WhatsApp" valor={wabaId} alCambiar={setWabaId}
          ejemplo="1226288837237571"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          className={BTN_SECONDARY} disabled={!listo || ocupado}
          onClick={() => alConectar(phoneNumberId.trim(), wabaId.trim())}
        >
          <Plug className="w-4 h-4" /> {ocupado ? 'Conectando…' : 'Conectar el número de prueba'}
        </button>
        <button
          type="button" onClick={() => setAbierto(false)}
          className="text-[12px] text-digi-muted hover:text-digi-text transition-colors" style={mf}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function CampoId({ label, valor, alCambiar, ejemplo }: {
  label: string; valor: string; alCambiar: (v: string) => void; ejemplo: string;
}) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-digi-text mb-1" style={mf}>{label}</label>
      <input
        value={valor}
        // Meta los enseña con espacios al copiar; se limpia aquí y no en la validación.
        onChange={(e) => alCambiar(e.target.value.replace(/\s/g, ''))}
        placeholder={ejemplo} inputMode="numeric"
        className="field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px]
                   text-digi-text placeholder:text-digi-muted/45 focus:border-accent focus:outline-none transition-colors"
        style={mf}
      />
    </div>
  );
}

/* ── Ya conectado ───────────────────────────────────────────────────────────── */

function Conectado({ canal, estadoMeta }: { canal: any; estadoMeta: any }) {
  const n = estadoMeta?.numero;
  return (
    <div className="max-w-3xl space-y-4">
      {/* El número deja de anunciarse en una caja verde y pasa a ser el PRIMER CAMPO, que
          es lo que en realidad es: el dato que se viene a consultar. Que esté conectado ya
          lo dice el propio panel —solo se llega aquí estándolo— y la cabecera del Estudio,
          que lleva el número escrito arriba del todo. */}
      <dl className="grid sm:grid-cols-2 gap-3">
        <Dato titulo="Número conectado">
          <span className="text-[13px] font-semibold text-digi-text" style={mf}>
            {canal.numero_visible ?? '—'}
          </span>
          {canal.nombre_verificado && (
            <span className="block text-[11.5px] text-digi-muted mt-0.5" style={mf}>{canal.nombre_verificado}</span>
          )}
        </Dato>
        <Dato titulo="Cuenta de WhatsApp (WABA)"><code className="text-[12px]">{canal.waba_id ?? '—'}</code></Dato>
        <Dato titulo="Identificador del número"><code className="text-[12px]">{canal.phone_number_id ?? '—'}</code></Dato>
        <Dato titulo="Token del cliente">
          {canal.tiene_wa_token ? <PixelBadge variant="success">Guardado y cifrado</PixelBadge> : <PixelBadge variant="error">Falta</PixelBadge>}
        </Dato>
        {/* La advertencia de la coexistencia vivía aquí arriba en una caja ámbar del
            tamaño de media pantalla, y la quitó Fernando (2026-08-03): es una instrucción
            para el día del alta, no algo que haya que releer cada vez que se abre la
            pantalla. Su contenido no se pierde — pasa detrás del botón de ayuda, que es
            la regla del proyecto para los avisos, y cuelga del dato al que se refiere.
            El estado sigue a la vista en la insignia. */}
        <Dato
          titulo="Coexistencia"
          ayuda={
            <>
              <p className="mb-2">Pídele al cliente que abra <strong>WhatsApp Web</strong> con ese número. Si entra, la coexistencia quedó bien y su equipo no ha perdido nada.</p>
              <p>Que Meta diga <code>CLOUD_API</code> <strong>no</strong> lo demuestra: ese campo describe el lado de la API, no si el número sigue en el teléfono.</p>
            </>
          }
        >
          {canal.coexistencia_verificada
            ? <PixelBadge variant="success">Comprobada con el cliente</PixelBadge>
            : <PixelBadge variant="warning">Sin comprobar</PixelBadge>}
        </Dato>
        {estadoMeta && (
          <>
            <Dato titulo="Estado en Meta">{n?.status ?? '—'} · {n?.platform_type ?? '—'}</Dato>
            <Dato titulo="Calidad del número">{n?.quality_rating ?? '—'}</Dato>
            <Dato titulo="Verificación en dos pasos">
              {n?.is_pin_enabled ? <PixelBadge variant="success">Activada</PixelBadge> : <PixelBadge variant="default">Sin activar</PixelBadge>}
            </Dato>
            <Dato titulo="Nuestra app suscrita">
              {estadoMeta.suscrita
                ? <PixelBadge variant="success">Sí</PixelBadge>
                : <PixelBadge variant="error">No — no llegará ningún mensaje</PixelBadge>}
            </Dato>
          </>
        )}
      </dl>
    </div>
  );
}

function Dato({ titulo, ayuda, children }: {
  titulo: string;
  /** Lo que hay que saber sobre este dato, detrás del botón de ayuda. Opcional. */
  ayuda?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-digi-border bg-digi-card px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-digi-muted mb-1 flex items-center gap-1" style={mf}>
        {titulo}
        {ayuda && <BotonAyuda titulo={titulo} lado="derecha">{ayuda}</BotonAyuda>}
      </dt>
      <dd className="text-[13px] text-digi-text" style={mf}>{children}</dd>
    </div>
  );
}


/* ── Traer lo que el cliente ya tenía en su WhatsApp ─────────────────────────────
 *
 * Existe por dos peticiones de Diego Castillo (2026-08-28): que el agente vea lo que
 * escribe su equipo, y que los clientes salgan con el nombre que Peter Tours les tiene
 * guardado y no con el alias que cada uno se puso en WhatsApp («~», «Tn», «💕💕💕»).
 *
 * Lo primero llega solo, por el webhook `smb_message_echoes`, en cuanto la app está
 * suscrita. Lo segundo —y el historial— hay que PEDIRLO, y ahí está la trampa: Meta da
 * **24 horas desde el alta y un solo intento** por cada uno.
 */
function TraerDelCliente({ canal, ocupado, alPedir }: {
  canal: any; ocupado: boolean; alPedir: (t: 'contactos' | 'historial') => void;
}) {
  /* Solo la agenda. El historial de 180 días se dejó de importar el 2026-08-30: en la
     bandeja interesan los mensajes nuevos, y traer los viejos llenaba la lista de
     conversaciones muertas. La ruta sigue admitiéndolo por si algún día hace falta. */
  const filas = [
    {
      tipo: 'contactos' as const,
      titulo: 'La agenda de contactos',
      desc: 'Los nombres con los que el cliente tiene guardados a los suyos. Sin esto, en la bandeja salen con el alias que cada uno se puso en WhatsApp.',
      hecho: canal.contactos_sincronizados_en,
    },
  ];

  return (
    <div className="max-w-3xl mt-6">
      {/* El cartel de las 24 horas se quitó de aquí: era una advertencia permanente sobre
          una decisión que se toma una sola vez, y en un panel que se abre a diario acaba
          siendo papel de pared. Sigue estando donde importa —en el diálogo de confirmación,
          justo antes de pulsar—, que es el único momento en que se puede hacer algo con
          ella. Y una vez pedido, la fila lo dice: «Pedido el …». */}
      <div className="space-y-2">
        {filas.map((f) => (
          <div key={f.tipo} className="rounded-lg border border-digi-border bg-digi-card p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-digi-text" style={mf}>{f.titulo}</p>
              <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{f.desc}</p>
            </div>
            {f.hecho ? (
              <span className="shrink-0 text-[12px] text-digi-muted flex items-center gap-1" style={mf}>
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                Pedido el {new Date(f.hecho).toLocaleString('es-EC')}
              </span>
            ) : (
              <button className={`${BTN_SECONDARY} shrink-0`} disabled={ocupado} onClick={() => alPedir(f.tipo)}>
                Pedirlo a Meta
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
