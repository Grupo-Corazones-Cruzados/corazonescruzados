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
import PixelBadge from '@/components/ui/PixelBadge';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { SectionBar, PanelEmpty } from '@/components/dashboard/flows/FlowPanelUI';
import { Plug, ShieldAlert, CheckCircle2, RefreshCw, AlertTriangle, Smartphone } from 'lucide-react';

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
  const [sdkListo, setSdkListo] = useState(false);
  const [entendido, setEntendido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [estadoMeta, setEstadoMeta] = useState<any>(null);
  const datosDelAlta = useRef<{ waba_id?: string; phone_number_id?: string }>({});

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
   */
  useEffect(() => {
    const alMensaje = (ev: MessageEvent) => {
      if (!ev.origin.endsWith('facebook.com')) return;
      try {
        const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
        if (d?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (d.event === 'FINISH' || d.event === 'FINISH_ONLY_WABA') {
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

  const lanzar = useCallback(() => {
    if (!window.FB || !configId) return;
    setConfirmar(false);
    datosDelAlta.current = {};

    window.FB.login(
      async (respuesta: any) => {
        const codigo = respuesta?.authResponse?.code;
        if (!codigo) { toast.info('El alta no se completó.'); return; }

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
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      },
    );
  }, [configId, flowId, recargar]);

  const consultarMeta = async () => {
    setOcupado(true);
    try {
      const d = await fetch(`/api/admin/flows/${flowId}/agente/conectar`).then((r) => r.json());
      if (d.error) { toast.error(d.error); return; }
      setEstadoMeta(d.data);
    } finally { setOcupado(false); }
  };

  const conectado = canal.estado === 'conectado';
  const faltaConfig = !appId || !configId;

  return (
    <div>
      <SectionBar title="Conexión con WhatsApp">
        {conectado && (
          <button className={BTN_SECONDARY} onClick={consultarMeta} disabled={ocupado}>
            <RefreshCw className="w-4 h-4" /> Comprobar contra Meta
          </button>
        )}
      </SectionBar>

      {faltaConfig ? (
        <PanelEmpty Icon={AlertTriangle} title="Falta configurar la app de Meta"
          desc="No hay WHATSAPP_APP_ID o WHATSAPP_ES_CONFIG_ID en el servidor. Sin ellos no se puede abrir el alta." />
      ) : conectado ? (
        <Conectado canal={canal} estadoMeta={estadoMeta} />
      ) : (
        <SinConectar
          sdkListo={sdkListo} entendido={entendido} setEntendido={setEntendido}
          ocupado={ocupado} alConectar={() => setConfirmar(true)} canal={canal}
        />
      )}

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

function SinConectar({ sdkListo, entendido, setEntendido, ocupado, alConectar, canal }: {
  sdkListo: boolean; entendido: boolean; setEntendido: (v: boolean) => void;
  ocupado: boolean; alConectar: () => void; canal: any;
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
          <span className="text-[12px] text-red-600" style={mf}>Último intento: {canal.ultimo_error}</span>
        )}
      </div>
    </div>
  );
}

/* ── Ya conectado ───────────────────────────────────────────────────────────── */

function Conectado({ canal, estadoMeta }: { canal: any; estadoMeta: any }) {
  const n = estadoMeta?.numero;
  return (
    <div className="max-w-3xl space-y-4">
      <div className={`rounded-lg border ${TONO.exito.caja} p-4 flex gap-2 items-start`}>
        <CheckCircle2 className={`w-5 h-5 ${TONO.exito.icono} shrink-0 mt-0.5`} />
        <div>
          <p className={`text-[13px] font-semibold ${TONO.exito.texto}`} style={mf}>El número está conectado</p>
          <p className={`text-[12.5px] ${TONO.exito.texto} mt-1`} style={mf}>
            {canal.numero_visible ?? 'Número sin nombre'} · {canal.nombre_verificado ?? 'sin nombre verificado'}
          </p>
        </div>
      </div>

      {!canal.coexistencia_verificada && (
        <div className={`rounded-lg border ${TONO.aviso.caja} p-4 flex gap-2 items-start`}>
          <AlertTriangle className={`w-5 h-5 ${TONO.aviso.icono} shrink-0 mt-0.5`} />
          <div>
            <p className={`text-[13px] font-semibold ${TONO.aviso.texto}`} style={mf}>
              Falta la comprobación que de verdad importa
            </p>
            <p className={`text-[12.5px] ${TONO.aviso.texto} mt-1 leading-relaxed`} style={mf}>
              Pídele al cliente que abra <strong>WhatsApp Web</strong> con ese número. Si entra, la
              coexistencia quedó bien y su equipo no ha perdido nada.
            </p>
            <p className={`text-[12px] ${TONO.aviso.texto} mt-2 leading-relaxed`} style={mf}>
              Que Meta diga <code>CLOUD_API</code> <strong>no</strong> lo demuestra: ese campo
              describe el lado de la API, no si el número sigue en el teléfono.
            </p>
          </div>
        </div>
      )}

      <dl className="grid sm:grid-cols-2 gap-3">
        <Dato titulo="Cuenta de WhatsApp (WABA)"><code className="text-[12px]">{canal.waba_id ?? '—'}</code></Dato>
        <Dato titulo="Identificador del número"><code className="text-[12px]">{canal.phone_number_id ?? '—'}</code></Dato>
        <Dato titulo="Token del cliente">
          {canal.tiene_wa_token ? <PixelBadge variant="success">Guardado y cifrado</PixelBadge> : <PixelBadge variant="error">Falta</PixelBadge>}
        </Dato>
        <Dato titulo="Coexistencia">
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
      {!estadoMeta && (
        <p className="text-[12px] text-digi-muted" style={mf}>
          Pulsa «Comprobar contra Meta» para ver el estado real del número y si nuestra app quedó suscrita.
        </p>
      )}
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-digi-border bg-digi-card px-3 py-2">
      <dt className="text-[11px] uppercase tracking-wide text-digi-muted mb-1" style={mf}>{titulo}</dt>
      <dd className="text-[13px] text-digi-text" style={mf}>{children}</dd>
    </div>
  );
}
