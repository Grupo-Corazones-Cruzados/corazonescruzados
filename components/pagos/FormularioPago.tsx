'use client';

/**
 * EL FORMULARIO DE PAGO — definición ÚNICA para los canales 2 y 3.
 *
 * Lo usan la página pública del enlace (`/pagar/<token>`, cliente sin cuenta) y —cuando se
 * monte— el proyecto del cliente con sesión. La diferencia entre los dos es UN parámetro:
 * `link` o `projectId` + `stageId`. Todo lo demás —importes, validación, tokenización,
 * mensajes— es lo mismo, y tiene que serlo: dos formularios de pago se separan al primer
 * arreglo, y el que se queda atrás es el que cobra mal.
 *
 * ⚠️ LOS DATOS DE LA TARJETA NO PASAN POR NUESTRO SERVIDOR. El navegador se los da
 * directamente a la pasarela, que devuelve un token de un solo uso; lo único que viaja a
 * `/api/pagos/cobrar` es ese token. Es lo que mantiene a GCC en el nivel más bajo de
 * exigencia PCI, y por eso el `<form>` de la tarjeta no tiene `name` en sus campos ni se
 * envía a ningún sitio nuestro.
 */

import { useEffect, useRef, useState } from 'react';
import { CreditCard, Landmark, Lock, Loader2, AlertCircle, CheckCircle2, Clock, Copy, Check, Upload } from 'lucide-react';
import { fmt2 } from '@/lib/format';

declare global {
  interface Window {
    Kushki?: any;
    /** Constructor de la Cajita de Pagos de PayPhone, que llega por su CDN. */
    PPaymentButtonBox?: any;
  }
}

export type DatosPago = {
  proyecto: { id: number; tipo?: 'project' | 'ticket' | 'subscription' | 'product'; titulo: string; descripcion: string | null; estado: string | null; cliente: string | null; etapas: any[] };
  etapa: { id: number; nombre: string };
  importes: { neto: number; recargo: number; total: number };
  pasarela: { proveedor: string; metodos: string[]; cobraEnCliente?: boolean; clavePublica: string | null; entorno: string | null };
  facturacion: any;
  correoDestino: string | null;
  canal: string;
  yaPagada: { invoiceId: number | null } | null;
  /** Lo que cuesta por cada método: la transferencia no lleva recargo. */
  importesPorMetodo?: Record<string, { recargo: number; total: number }>;
  cuentas?: CuentaBancaria[];
  detalle?: { etiqueta: string; valor: string }[];
};

export type CuentaBancaria = {
  id: string; banco: string; tipo: string; numero: string;
  titular: string; identificacion: string; correo: string; swift?: string;
};

/**
 * Tipos de identificación del comprador (tabla 6 del SRI).
 *
 * ⚠️ El **08, «Identificación del exterior»**, es para los clientes de fuera de Ecuador. Sin
 * él, un cliente extranjero no puede ni elegir su tipo ni pagar — y es justo el que usa la
 * tarjeta internacional que motivó elegir PayPhone.
 */
const TIPOS_ID = [
  { valor: '05', etiqueta: 'Cédula' },
  { valor: '04', etiqueta: 'RUC' },
  { valor: '06', etiqueta: 'Pasaporte' },
  { valor: '08', etiqueta: 'Identificación del exterior' },
  { valor: '07', etiqueta: 'Consumidor final' },
];

const CAMPO = 'w-full rounded-lg border border-[var(--linea-fuerte)] bg-[var(--tarjeta)] px-3 py-2.5 text-[15px] text-[var(--texto)] outline-none focus:border-[var(--violeta-vivo)] focus:ring-2 focus:ring-[var(--violeta)]/20 transition';
const ETIQUETA = 'block text-[13px] font-medium text-[var(--texto)] mb-1.5';

/**
 * Carga los dos recursos de la Cajita de PayPhone (CSS + módulo JS) una sola vez.
 *
 * ⚠️ El JS es un `type="module"`, así que su `onload` no garantiza que
 * `window.PPaymentButtonBox` exista todavía: los módulos se evalúan después. Por eso se
 * espera al constructor con un sondeo corto en vez de fiarse del evento — sin esto, el
 * primer intento de pintar la caja falla en frío y funciona al recargar, que es la clase de
 * fallo que solo aparece en producción.
 */
function useCajitaPayphone(activa: boolean) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!activa) return;
    if (!document.getElementById('pp-box-css')) {
      const l = document.createElement('link');
      l.id = 'pp-box-css';
      l.rel = 'stylesheet';
      l.href = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.css';
      document.head.appendChild(l);
    }
    if (!document.getElementById('pp-box-js')) {
      const s = document.createElement('script');
      s.id = 'pp-box-js';
      s.type = 'module';
      s.src = 'https://cdn.payphonetodoesposible.com/box/v2.0/payphone-payment-box.js';
      document.head.appendChild(s);
    }
    let vivo = true;
    let intentos = 0;
    const mirar = () => {
      if (!vivo) return;
      if (window.PPaymentButtonBox) { setListo(true); return; }
      if (++intentos > 100) return;   // ~10 s y se rinde: el aviso lo da la pantalla
      setTimeout(mirar, 100);
    };
    mirar();
    return () => { vivo = false; };
  }, [activa]);
  return listo;
}

/** Carga la librería de la pasarela una sola vez. */
function useKushki(clavePublica: string | null, entorno: string) {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!clavePublica) return;
    if (window.Kushki) { setListo(true); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.kushkipagos.com/kushki.min.js';
    s.async = true;
    s.onload = () => setListo(true);
    // Si la librería no carga, el botón se queda deshabilitado con su aviso — mucho mejor
    // que un botón que parece funcionar y revienta al pulsarlo.
    s.onerror = () => setListo(false);
    document.head.appendChild(s);
  }, [clavePublica, entorno]);
  return listo;
}

export default function FormularioPago({
  datos, link, sourceType, sourceId, stageId, periodo, onPagado,
}: {
  datos: DatosPago;
  /** Canal 3: el token del enlace. Sin él manda la sesión (canal 2). */
  link?: string;
  sourceType?: 'project' | 'ticket' | 'subscription' | 'product';
  sourceId?: string;
  stageId?: number;
  /** El mes que se paga, en suscripciones (`AAAA-MM`). */
  periodo?: string;
  onPagado?: (invoiceId: number | null) => void;
}) {
  const { importes, pasarela } = datos;
  const esSimulado = pasarela.proveedor === 'simulado';
  // PayPhone cobra en el navegador con su propia Cajita; Kushki cobra en el servidor con un
  // token. La pantalla no pregunta «¿eres PayPhone?»: lo declara el proveedor.
  const cobraEnCliente = Boolean(pasarela.cobraEnCliente);
  const kushkiListo = useKushki(esSimulado || cobraEnCliente ? null : pasarela.clavePublica, pasarela.entorno || '');
  const cajitaLista = useCajitaPayphone(cobraEnCliente);
  const [paramsCajita, setParamsCajita] = useState<Record<string, unknown> | null>(null);

  // La transferencia SIEMPRE está disponible: no la ofrece la pasarela, la ofrece GCC.
  const [metodo, setMetodo] = useState<'card' | 'transfer'>(
    pasarela.metodos.includes('card') ? 'card' : 'transfer',
  );
  const puedeTarjeta = pasarela.metodos.includes('card');

  // Lo que cuesta con el método elegido. Con transferencia, el neto pelado.
  const importeActual = datos.importesPorMetodo?.[metodo] || { recargo: importes.recargo, total: importes.total };

  // ── Transferencia ────────────────────────────────────────────────────────
  const [cuentaAbierta, setCuentaAbierta] = useState<string | null>(datos.cuentas?.[0]?.id || null);
  const [transferIntent, setTransferIntent] = useState<number | null>(null);
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [referencia, setReferencia] = useState('');
  const [bancoUsado, setBancoUsado] = useState('');
  const [enEspera, setEnEspera] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const copiar = (texto: string, cual: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(cual);
    setTimeout(() => setCopiado(null), 1600);
  };

  const [f, setF] = useState({
    id_type: datos.facturacion?.id_type || '05',
    ruc: datos.facturacion?.ruc || '',
    name: datos.facturacion?.name || '',
    email: datos.facturacion?.email || datos.correoDestino || '',
    phone: datos.facturacion?.phone || '',
    address: datos.facturacion?.address || '',
  });

  const [tarjeta, setTarjeta] = useState({ nombre: '', numero: '', mes: '', anio: '', cvc: '' });
  const [tokenPrueba, setTokenPrueba] = useState('prueba-ok');
  const [meses, setMeses] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState<{ invoiceId: number | null; aviso: string | null } | null>(null);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  /**
   * Pinta la Cajita cuando ya hay intento creado y la librería cargó.
   *
   * ⚠️ Se renderiza UNA sola vez (`pintadaRef`). La Cajita lleva dentro el importe y el
   * identificador del cobro; volver a pintarla sobre el mismo contenedor deja dos cajas
   * vivas apuntando al mismo intento, y la segunda es la que se lleva el clic.
   */
  const pintadaRef = useRef(false);
  useEffect(() => {
    if (!paramsCajita || !cajitaLista || pintadaRef.current) return;
    try {
      new window.PPaymentButtonBox(paramsCajita).render('pp-button');
      pintadaRef.current = true;
    } catch (e: any) {
      setError(`No se pudo abrir la pasarela: ${e?.message || e}`);
    }
  }, [paramsCajita, cajitaLista]);

  /** Pide el token a la pasarela. Devuelve null y deja el error puesto si no se pudo. */
  async function pedirToken(): Promise<string | null> {
    if (esSimulado) return tokenPrueba;
    if (!window.Kushki || !pasarela.clavePublica) {
      setError('La pasarela de pago no está disponible en este momento.');
      return null;
    }
    const kushki = new window.Kushki({
      merchantId: pasarela.clavePublica,
      inTestEnvironment: pasarela.entorno !== 'production',
    });
    const monto = {
      subtotalIva: 0,
      subtotalIva0: Number(importes.total.toFixed(2)),
      iva: 0,
      ice: 0,
    };
    return new Promise<string | null>((resolve) => {
      const cb = (res: any) => {
        if (res?.token) return resolve(res.token);
        setError(res?.message || 'No se pudo validar el medio de pago.');
        resolve(null);
      };
      if (metodo === 'transfer') {
        kushki.requestTransferToken({
          callbackUrl: window.location.href,
          userType: f.id_type === '04' ? '1' : '0',
          documentType: f.id_type === '04' ? 'RUC' : 'CI',
          documentNumber: f.ruc,
          paymentDescription: `${datos.proyecto.titulo} — ${datos.etapa.nombre}`.slice(0, 60),
          email: f.email,
          currency: 'USD',
          amount: monto,
        }, cb);
      } else {
        kushki.requestToken({
          amount: monto,
          currency: 'USD',
          card: {
            name: tarjeta.nombre,
            number: tarjeta.numero.replace(/\s+/g, ''),
            cvc: tarjeta.cvc,
            expiryMonth: tarjeta.mes,
            expiryYear: tarjeta.anio,
          },
        }, cb);
      }
    });
  }

  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      // Con la Cajita no hay token que pedir: se crea el intento y ella cobra después.
      const token = cobraEnCliente ? '' : await pedirToken();
      if (!cobraEnCliente && !token) { setEnviando(false); return; }

      const res = await fetch('/api/pagos/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          link,
          tipo: sourceType,
          project_id: sourceType === 'project' ? sourceId : undefined,
          ticket_id: sourceType === 'ticket' ? sourceId : undefined,
          sub_id: sourceType === 'subscription' ? sourceId : undefined,
          producto_id: sourceType === 'product' ? sourceId : undefined,
          periodo: sourceType === 'subscription' ? periodo : undefined,
          stage_id: stageId,
          token, metodo, facturacion: f,
          meses: metodo === 'card' && meses > 1 ? meses : undefined,
        }),
      });
      const d = await res.json();

      if (!res.ok) { setError(d.error || 'No se pudo completar el pago.'); setEnviando(false); return; }

      if (d.estado === 'rechazado') { setError(d.error); setEnviando(false); return; }

      if (d.estado === 'transferencia') {
        // No se ha cobrado nada: ahora el cliente va a su banco y vuelve con el comprobante.
        setTransferIntent(d.intentId);
        setEnviando(false);
        return;
      }

      if (d.estado === 'cajita') {
        // A partir de aquí manda PayPhone: pinta su formulario y, al pagar, devuelve al
        // cliente a `/pagos/respuesta`, que es quien confirma el cobro.
        setParamsCajita(d.parametros);
        setEnviando(false);
        return;
      }

      if (d.estado === 'redirigir') {
        // La transferencia se autoriza en el portal del banco. A partir de aquí el pago lo
        // confirma el webhook, no esta pantalla.
        window.location.href = d.url;
        return;
      }

      setHecho({ invoiceId: d.invoiceId ?? null, aviso: d.aviso ?? null });
      onPagado?.(d.invoiceId ?? null);
    } catch (err: any) {
      setError(err.message || 'No se pudo completar el pago.');
    } finally {
      setEnviando(false);
    }
  }

  /** Sube el comprobante y deja el cobro esperando que una persona lo confirme. */
  async function subirComprobante(e: React.FormEvent) {
    e.preventDefault();
    if (!transferIntent || !comprobante) return;
    setError('');
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('intent_id', String(transferIntent));
      fd.append('archivo', comprobante);
      fd.append('referencia', referencia);
      fd.append('banco', bancoUsado || cuentaAbierta || '');
      if (link) fd.append('link', link);

      const res = await fetch('/api/pagos/comprobante', { method: 'POST', body: fd });
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'No se pudo subir el comprobante.'); return; }
      setEnEspera(true);
    } catch (err: any) {
      setError(err.message || 'No se pudo subir el comprobante.');
    } finally {
      setEnviando(false);
    }
  }

  // ── El comprobante ya está arriba: solo falta que lo confirmen ────────────
  if (enEspera) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-50/60 p-6 text-center">
        <Clock className="w-8 h-8 mx-auto text-amber-600" />
        <h2 className="mt-3 text-[19px] font-semibold text-[var(--texto)]">Comprobante recibido</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--suave)]">
          Tu pago queda <strong>en espera de verificación</strong>. En cuanto confirmemos la
          transferencia en nuestro banco se emite tu factura electrónica y te llega al correo.
        </p>
        <p className="mt-3 text-[13px] text-[var(--tenue)]">
          No hace falta que pagues otra vez ni que vuelvas a subir el comprobante.
        </p>
      </div>
    );
  }

  // ── Ya pagada ────────────────────────────────────────────────────────────
  if (datos.yaPagada || hecho) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-6 text-center">
        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600" />
        <h2 className="mt-3 text-[19px] font-semibold text-[var(--texto)]">
          {hecho ? '¡Pago recibido!' : 'Esta etapa ya está pagada'}
        </h2>
        <p className="mt-2 text-[15px] text-[var(--suave)]">
          {hecho?.aviso
            ? hecho.aviso
            : 'La factura electrónica se envía al correo que registraste. Si no la ves, revisa el correo no deseado.'}
        </p>
      </div>
    );
  }

  // Con la Cajita basta con poder crear el intento: la librería puede seguir cargando
  // mientras el cliente rellena la facturación, y esperar a que termine solo alarga la
  // pantalla sin ganar nada.
  const puedePagar = !enviando && (esSimulado || cobraEnCliente || kushkiListo);

  return (
    <form onSubmit={pagar} className="space-y-7">
      {/* ── Método ── (se esconde si la pasarela solo ofrece uno: elegir entre una sola
           opción no es elegir, es ruido) */}
      <fieldset className={transferIntent ? 'hidden' : ''}>
        <legend className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--violeta-txt)] mb-3">
          Cómo quieres pagar
        </legend>
        {/* ⚠️ CADA MÉTODO ENSEÑA SU PRECIO, y no es un adorno: la transferencia no lleva
            recargo porque ahí no cobra ninguna pasarela. Ver los dos importes juntos hace
            que el método más barato —para el cliente y para GCC— se elija solo. */}
        <div className="grid gap-3 sm:grid-cols-2">
          {puedeTarjeta && (
            <button type="button" onClick={() => setMetodo('card')}
              className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
                metodo === 'card'
                  ? 'border-[var(--violeta-vivo)] bg-[var(--violeta)]/8'
                  : 'border-[var(--linea-fuerte)] hover:border-[var(--violeta-vivo)]/50'}`}>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[14px] font-medium text-[var(--texto)]">
                  <CreditCard className="w-[18px] h-[18px]" /> Tarjeta
                </span>
                <span className="mt-1 block text-[12.5px] text-[var(--tenue)]">Al instante · crédito o débito</span>
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--texto)]">
                ${fmt2(datos.importesPorMetodo?.card?.total ?? importes.total)}
              </span>
            </button>
          )}
          <button type="button" onClick={() => setMetodo('transfer')}
            className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-left transition ${
              metodo === 'transfer'
                ? 'border-[var(--violeta-vivo)] bg-[var(--violeta)]/8'
                : 'border-[var(--linea-fuerte)] hover:border-[var(--violeta-vivo)]/50'}`}>
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-[14px] font-medium text-[var(--texto)]">
                <Landmark className="w-[18px] h-[18px]" /> Transferencia
              </span>
              <span className="mt-1 block text-[12.5px] text-[var(--tenue)]">Sin recargo · se verifica a mano</span>
            </span>
            <span className="shrink-0 text-[15px] font-semibold tabular-nums text-emerald-700">
              ${fmt2(datos.importesPorMetodo?.transfer?.total ?? importes.neto)}
            </span>
          </button>
        </div>
      </fieldset>

      {/* ── Transferencia: las cuentas y el comprobante ── */}
      {metodo === 'transfer' && transferIntent && (
        <fieldset className="space-y-4">
          <legend className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--violeta-txt)] mb-3">
            Transfiere y sube tu comprobante
          </legend>

          <div className="rounded-lg border border-[var(--linea-fuerte)] overflow-hidden">
            {(datos.cuentas || []).map((c) => (
              <div key={c.id} className="border-b border-[var(--linea)] last:border-b-0">
                <button type="button" onClick={() => setCuentaAbierta(cuentaAbierta === c.id ? null : c.id)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-[var(--violeta)]/5 transition-colors">
                  <span className="flex items-center gap-2.5">
                    <Landmark className="w-4 h-4 text-[var(--violeta-txt)]" />
                    <span className="text-[15px] font-medium text-[var(--texto)]">{c.banco}</span>
                  </span>
                  <span className="text-[13px] text-[var(--tenue)]">{cuentaAbierta === c.id ? 'Ocultar' : 'Ver datos'}</span>
                </button>
                {cuentaAbierta === c.id && (
                  <dl className="px-4 pb-4 space-y-2">
                    {[
                      ['Tipo de cuenta', c.tipo, false],
                      ['Número de cuenta', c.numero, true],
                      ['Titular', c.titular, true],
                      ['Cédula', c.identificacion, true],
                      ['Correo', c.correo, true],
                      ...(c.swift ? [['Código SWIFT', c.swift, true] as const] : []),
                    ].map(([et, val, copiable]) => (
                      <div key={String(et)} className="flex items-center justify-between gap-3">
                        <dt className="text-[13px] text-[var(--tenue)] shrink-0">{et}</dt>
                        <dd className="flex items-center gap-2 min-w-0">
                          <span className="text-[14px] text-[var(--texto)] truncate">{val}</span>
                          {/* Copiar importa de verdad: un número de cuenta tecleado a mano es
                              una transferencia que se va a otra parte. */}
                          {copiable && (
                            <button type="button" onClick={() => copiar(String(val), `${c.id}-${et}`)}
                              className="shrink-0 text-[var(--violeta-txt)] hover:opacity-70" title="Copiar">
                              {copiado === `${c.id}-${et}`
                                ? <Check className="w-3.5 h-3.5 text-emerald-600" />
                                : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </div>

          <p className="text-[13.5px] leading-relaxed text-[var(--suave)]">
            Transfiere <strong className="text-[var(--texto)]">${fmt2(importeActual.total)}</strong> a
            cualquiera de las dos cuentas y sube aquí tu comprobante. Tu pago quedará en espera hasta
            que lo verifiquemos.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={ETIQUETA} htmlFor="tr-banco">¿A qué banco transferiste?</label>
              <select id="tr-banco" className={CAMPO} value={bancoUsado || cuentaAbierta || ''}
                onChange={e => setBancoUsado(e.target.value)}>
                {(datos.cuentas || []).map(c => <option key={c.id} value={c.id}>{c.banco}</option>)}
              </select>
            </div>
            <div>
              <label className={ETIQUETA} htmlFor="tr-ref">Número de comprobante</label>
              <input id="tr-ref" className={CAMPO} value={referencia} onChange={e => setReferencia(e.target.value)}
                placeholder="Opcional, pero ayuda" />
            </div>
          </div>

          <div>
            <label className={ETIQUETA} htmlFor="tr-file">Comprobante</label>
            <input id="tr-file" type="file" accept="image/*,application/pdf"
              onChange={e => setComprobante(e.target.files?.[0] || null)}
              className="w-full text-[14px] text-[var(--suave)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--violeta)] file:px-4 file:py-2 file:text-[14px] file:font-semibold file:text-white hover:file:opacity-90" />
            <p className="mt-2 text-[13px] text-[var(--tenue)]">Foto o PDF, hasta 8 MB.</p>
          </div>

          {error && (
            <p className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-50/70 px-3 py-2.5 text-[13.5px] text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <button type="button" onClick={subirComprobante} disabled={!comprobante || enviando}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--violeta)] px-5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            {enviando
              ? <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Enviando…</>
              : <><Upload className="w-[18px] h-[18px]" /> Enviar comprobante</>}
          </button>
        </fieldset>
      )}

      {/* ── Facturación ── (se esconde una vez que el cliente está subiendo el
           comprobante: sus datos ya quedaron guardados con el cobro) */}
      <fieldset className={metodo === 'transfer' && transferIntent ? 'hidden' : ''}>
        <legend className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--violeta-txt)] mb-3">
          Datos para tu factura
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ETIQUETA} htmlFor="tipo-id">Tipo de identificación</label>
            <select id="tipo-id" className={CAMPO} value={f.id_type} onChange={e => {
              const v = e.target.value;
              // Consumidor final tiene identificación y nombre fijos por norma del SRI:
              // se rellenan solos en vez de pedirlos.
              if (v === '07') setF(p => ({ ...p, id_type: v, ruc: '9999999999999', name: p.name || 'CONSUMIDOR FINAL' }));
              else set('id_type', v);
            }}>
              {TIPOS_ID.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="ruc">Identificación</label>
            <input id="ruc" className={CAMPO} value={f.ruc} onChange={e => set('ruc', e.target.value)}
              inputMode="numeric" autoComplete="off" required readOnly={f.id_type === '07'} />
          </div>
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="razon">Nombre o razón social</label>
            <input id="razon" className={CAMPO} value={f.name} onChange={e => set('name', e.target.value)} required />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="correo">Correo</label>
            <input id="correo" type="email" className={CAMPO} value={f.email}
              onChange={e => set('email', e.target.value)} required />
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="tel">Teléfono</label>
            <input id="tel" className={CAMPO} value={f.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className={ETIQUETA} htmlFor="dir">Dirección</label>
            <input id="dir" className={CAMPO} value={f.address} onChange={e => set('address', e.target.value)} />
          </div>
        </div>
        <p className="mt-2.5 text-[13px] text-[var(--tenue)]">
          La factura electrónica se emite con estos datos y te llega al correo en cuanto el pago se confirme.
        </p>
      </fieldset>

      {/* ── Tarjeta ── */}
      {metodo === 'card' && !esSimulado && !cobraEnCliente && (
        <fieldset>
          <legend className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--violeta-txt)] mb-3">
            Tu tarjeta
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={ETIQUETA} htmlFor="tj-nombre">Nombre en la tarjeta</label>
              <input id="tj-nombre" className={CAMPO} autoComplete="cc-name"
                value={tarjeta.nombre} onChange={e => setTarjeta(p => ({ ...p, nombre: e.target.value }))} required />
            </div>
            <div className="sm:col-span-2">
              <label className={ETIQUETA} htmlFor="tj-num">Número</label>
              <input id="tj-num" className={CAMPO} inputMode="numeric" autoComplete="cc-number"
                value={tarjeta.numero} onChange={e => setTarjeta(p => ({ ...p, numero: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={ETIQUETA} htmlFor="tj-mes">Mes</label>
                <input id="tj-mes" className={CAMPO} placeholder="MM" maxLength={2} inputMode="numeric"
                  autoComplete="cc-exp-month"
                  value={tarjeta.mes} onChange={e => setTarjeta(p => ({ ...p, mes: e.target.value }))} required />
              </div>
              <div>
                <label className={ETIQUETA} htmlFor="tj-anio">Año</label>
                <input id="tj-anio" className={CAMPO} placeholder="AA" maxLength={2} inputMode="numeric"
                  autoComplete="cc-exp-year"
                  value={tarjeta.anio} onChange={e => setTarjeta(p => ({ ...p, anio: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className={ETIQUETA} htmlFor="tj-cvc">Código de seguridad</label>
              <input id="tj-cvc" className={CAMPO} maxLength={4} inputMode="numeric" autoComplete="cc-csc"
                value={tarjeta.cvc} onChange={e => setTarjeta(p => ({ ...p, cvc: e.target.value }))} required />
            </div>
            <div className="sm:col-span-2">
              <label className={ETIQUETA} htmlFor="tj-meses">Diferir el pago</label>
              <select id="tj-meses" className={CAMPO} value={meses} onChange={e => setMeses(Number(e.target.value))}>
                <option value={0}>Pago corriente (sin diferir)</option>
                {[3, 6, 9, 12].map(m => <option key={m} value={m}>{m} meses</option>)}
              </select>
              {/* Al comercio le llega el importe completo igualmente: las cuotas las
                  administra el banco del cliente. Decirlo evita la pregunta. */}
              <p className="mt-2 text-[13px] text-[var(--tenue)]">
                Si difieres, tu banco te reparte las cuotas. Los intereses dependen de tu tarjeta.
              </p>
            </div>
          </div>
        </fieldset>
      )}

      {/* ── Modo de pruebas ── */}
      {esSimulado && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50/60 p-4">
          <p className="text-[13px] font-semibold text-amber-900">Pasarela en modo de PRUEBAS</p>
          <p className="mt-1 text-[13px] text-amber-900/80">
            No se cobra dinero real. Escribe <code className="font-mono">rechazar</code> para
            probar el camino del cobro rechazado.
          </p>
          <input className={`${CAMPO} mt-3`} value={tokenPrueba} onChange={e => setTokenPrueba(e.target.value)} />
        </div>
      )}

      {/* ── Total y acción ── */}
      <div className={`rounded-xl border border-[var(--linea-fuerte)] bg-[var(--tarjeta)] p-5 ${
        metodo === 'transfer' && transferIntent ? 'hidden' : ''}`}>
        <dl className="space-y-2 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--suave)]">{datos.etapa.nombre}</dt>
            <dd className="tabular-nums text-[var(--texto)]">${fmt2(importes.neto)}</dd>
          </div>
          {importeActual.recargo > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tenue)]">Gastos de procesamiento de pago en línea</dt>
              <dd className="tabular-nums text-[var(--tenue)]">${fmt2(importeActual.recargo)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-[var(--linea)] pt-3 mt-3">
            <dt className="font-semibold text-[var(--texto)]">Total a pagar</dt>
            <dd className="text-[20px] font-semibold tabular-nums text-[var(--texto)]">${fmt2(importeActual.total)}</dd>
          </div>
        </dl>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-50/70 px-3 py-2.5 text-[13.5px] text-red-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
          </p>
        )}

        {!esSimulado && !cobraEnCliente && !kushkiListo && pasarela.clavePublica && (
          <p className="mt-4 text-[13px] text-[var(--tenue)]">Preparando la pasarela…</p>
        )}
        {!esSimulado && !cobraEnCliente && !pasarela.clavePublica && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/70 px-3 py-2.5 text-[13.5px] text-amber-900">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            El cobro en línea todavía no está activo. Escríbenos y lo resolvemos.
          </p>
        )}

        {/* Con la Cajita el botón desaparece en cuanto ella se pinta: quien cobra a partir
            de ese momento es PayPhone, y dejar debajo un botón nuestro que dice «Pagar»
            invita a pulsar el que no cobra. */}
        {!paramsCajita && (
          <button type="submit" disabled={!puedePagar}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--violeta)] px-5 py-3 text-[15px] font-semibold text-white transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            {enviando
              ? <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Procesando…</>
              : metodo === 'transfer'
                ? <><Landmark className="w-[18px] h-[18px]" /> Ver datos para transferir</>
                : cobraEnCliente
                  ? <><Lock className="w-[18px] h-[18px]" /> Continuar al pago</>
                  : <><Lock className="w-[18px] h-[18px]" /> Pagar ${fmt2(importeActual.total)}</>}
          </button>
        )}

        {/* Donde PayPhone dibuja su formulario. El div existe siempre que haya parámetros:
            si se montara solo al estar lista la librería, `render('pp-button')` no
            encontraría el contenedor la primera vez. */}
        {paramsCajita && (
          <div className="mt-5">
            {!cajitaLista && (
              <p className="mb-3 flex items-center gap-2 text-[13px] text-[var(--tenue)]">
                <Loader2 className="w-4 h-4 animate-spin" /> Abriendo la pasarela de pago…
              </p>
            )}
            <div id="pp-button" />
          </div>
        )}

        {metodo === 'card' && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--tenue)]">
            <Lock className="w-3.5 h-3.5" />
            Los datos de tu tarjeta viajan cifrados a la pasarela. GCC no los recibe ni los guarda.
          </p>
        )}
      </div>
    </form>
  );
}
