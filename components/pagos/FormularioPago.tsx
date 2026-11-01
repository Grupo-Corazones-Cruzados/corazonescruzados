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
import {
  CreditCard, Landmark, Lock, Loader2, AlertCircle, CheckCircle2, Clock, Copy, Check, Upload,
  ArrowLeft, ArrowRight, FileText, Wallet, type LucideIcon,
} from 'lucide-react';
import IndicadorPasos from '@/components/pagos/IndicadorPasos';
import { PAISES } from '@/lib/countries';
import { PAIS_LOCAL, etiquetaProvisional } from '@/lib/pagos/identificacion';
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
  /** Todos los datos de facturación guardados del cliente (hasta 3), los predeterminados primero. */
  facturacionOpciones?: any[];
  correoDestino: string | null;
  canal: string;
  yaPagada: { invoiceId: number | null } | null;
  /** Lo que cuesta por cada método: la transferencia no lleva recargo. */
  importesPorMetodo?: Record<string, { recargo: number; total: number }>;
  cuentas?: CuentaBancaria[];
  detalle?: { etiqueta: string; valor: string }[];
  /** Dónde ver el ticket o proyecto: su panel (con sesión y siendo suyo) o la página pública. */
  detalleUrl?: string | null;
};

export type CuentaBancaria = {
  id: string; banco: string; tipo: string; numero: string;
  titular: string; identificacion: string; correo: string; swift?: string;
  /** El símbolo del banco (`public/bancos/`). */
  logo?: string;
};

/** El símbolo del banco en su cuadro blanco: se reconoce de un vistazo a qué banco va el dinero. */
function LogoBanco({ cuenta, tamano = 'md' }: { cuenta: CuentaBancaria; tamano?: 'sm' | 'md' }) {
  const caja = tamano === 'sm' ? 'w-7 h-7 p-1 rounded-md' : 'w-11 h-11 p-1.5 rounded-lg';
  return (
    <span className={`${caja} shrink-0 inline-flex items-center justify-center bg-white border border-[var(--linea)]`}>
      {cuenta.logo
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={cuenta.logo} alt="" className="w-full h-full object-contain" />
        : <Landmark className="w-full h-full text-[var(--violeta-txt)]" />}
    </span>
  );
}

/**
 * ⭐ LOS PASOS (Fernando, 2026-10-31). El formulario se recorre por pasos, y cada método tiene
 * los suyos. En la transferencia la CUENTA va ANTES que la factura: *«al no poder ver la cuenta
 * del banco confunde»* — antes los datos del banco solo salían después de rellenar la factura.
 * El orden del servidor no cambia: la factura sigue creando el cobro (que deja apuntados sus
 * datos) y el comprobante se sube después.
 */
type IdPaso = 'metodo' | 'cuenta' | 'factura' | 'pago' | 'comprobante';
const PASOS: Record<IdPaso, { nombre: string; titulo: string; Icon: LucideIcon }> = {
  metodo: { nombre: 'Método', titulo: '¿Cómo quieres pagar?', Icon: Wallet },
  cuenta: { nombre: 'Cuenta', titulo: 'Transfiere a nuestra cuenta', Icon: Landmark },
  factura: { nombre: 'Factura', titulo: 'Datos para tu factura', Icon: FileText },
  pago: { nombre: 'Pago', titulo: 'Confirma y paga', Icon: Lock },
  comprobante: { nombre: 'Comprobante', titulo: 'Sube tu comprobante', Icon: Upload },
};

/**
 * Tipos de identificación del comprador (tabla 6 del SRI).
 *
 * ⚠️ El **08, «Identificación del exterior»**, es para los clientes de fuera de Ecuador. Sin
 * él, un cliente extranjero no puede ni elegir su tipo ni pagar — y es justo el que usa la
 * tarjeta internacional que motivó elegir PayPhone.
 */
// El tipo de identificación del SRI ya no se pregunta: se DEDUCE del país y del número
// (`lib/pagos/identificacion.ts`). «Tipo de identificación» es vocabulario del SRI, no del
// cliente — él sabe de qué país es y cuál es su número, y traducirlo es trabajo nuestro.

const CAMPO = 'w-full rounded-lg border border-[var(--linea-fuerte)] bg-[var(--tarjeta)] px-3 py-2.5 text-[15px] text-[var(--texto)] outline-none focus:border-[var(--tenue)] transition';
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

  // ── Los pasos ──────────────────────────────────────────────────────────────
  // Con un solo método no hay nada que elegir: el camino empieza en el siguiente paso.
  const pasos: IdPaso[] = metodo === 'transfer'
    ? [...(puedeTarjeta ? ['metodo' as const] : []), 'cuenta', 'factura', 'comprobante']
    : ['metodo', 'factura', 'pago'];
  const [paso, setPaso] = useState<IdPaso>(pasos[0]);
  const [sentido, setSentido] = useState<1 | -1>(1);
  const iPaso = Math.max(0, pasos.indexOf(paso));
  const ir = (p: IdPaso) => {
    setError('');
    setSentido(pasos.indexOf(p) < iPaso ? -1 : 1);
    setPaso(p);
  };
  /**
   * A qué paso se puede volver. Con el cobro ya creado (transferencia esperando comprobante o
   * Cajita de PayPhone pintada) no se vuelve a la factura ni al método: cambiarlos ahí dejaría
   * un cobro hecho con otros datos.
   */
  const alcanzable = (i: number) => {
    if (paramsCajita) return false;
    if (transferIntent) return pasos[i] === 'cuenta';
    return i < iPaso;
  };
  let anterior: IdPaso | null = null;
  for (let i = iPaso - 1; i >= 0 && !anterior; i--) if (alcanzable(i)) anterior = pasos[i];
  const cuentaElegida = (datos.cuentas || []).find(c => c.id === (bancoUsado || cuentaAbierta)) || datos.cuentas?.[0];

  const copiar = (texto: string, cual: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(cual);
    setTimeout(() => setCopiado(null), 1600);
  };

  const [f, setF] = useState({
    pais: datos.facturacion?.pais || PAIS_LOCAL,
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
  // Con varios datos guardados se elige cuál (Fernando, 2026-10-31); se puede seguir escribiendo
  // a mano, y entonces el selector dice «Otros datos».
  const opciones: any[] = datos.facturacionOpciones || [];
  const opcionElegida = opciones.findIndex(o => ['ruc', 'name', 'email', 'phone', 'address', 'pais']
    .every(k => String(o[k] || '') === String((f as any)[k] || '')));
  const elegirOpcion = (i: number) => {
    const o = opciones[i];
    if (o) setF({ pais: o.pais || PAIS_LOCAL, ruc: o.ruc || '', name: o.name || '', email: o.email || '', phone: o.phone || '', address: o.address || '' });
  };
  const esLocal = f.pais === PAIS_LOCAL;
  // La MISMA función que usa el servidor para decidir: si aquí dijera una cosa y allí otra,
  // el cliente vería «se registrará como RUC» y el cobro se caería con otro mensaje.
  const etiquetaId = etiquetaProvisional(f.pais, f.ruc);

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
          // Kushki quiere saber si es empresa o persona; se deduce igual que el tipo del
          // SRI, con la misma regla y no con una segunda copia de ella.
          userType: etiquetaId === 'RUC' ? '1' : '0',
          documentType: etiquetaId === 'RUC' ? 'RUC' : 'CI',
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

  async function pagar() {
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
        ir('comprobante');
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
  async function subirComprobante() {
    if (!transferIntent || !comprobante) return;
    setError('');
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append('intent_id', String(transferIntent));
      fd.append('archivo', comprobante);
      fd.append('referencia', referencia);
      fd.append('banco', cuentaElegida?.id || '');
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

  /** Lo que hace el botón principal en cada paso. */
  async function avanzar(e: React.FormEvent) {
    e.preventDefault();
    if (paso === 'metodo') return ir(pasos[iPaso + 1]);
    if (paso === 'cuenta') return ir(transferIntent ? 'comprobante' : 'factura');
    // La factura de una transferencia crea el cobro y, si sale bien, `pagar` lleva al comprobante.
    if (paso === 'factura') return metodo === 'transfer' ? pagar() : ir('pago');
    if (paso === 'pago') return pagar();
    if (paso === 'comprobante') return subirComprobante();
  }

  const principal: { texto: string; Icon: LucideIcon; desactivado?: boolean } | null =
    paso === 'pago'
      ? (paramsCajita ? null : {
        texto: cobraEnCliente ? 'Continuar al pago' : `Pagar $${fmt2(importeActual.total)}`,
        Icon: Lock, desactivado: !puedePagar,
      })
      : paso === 'comprobante'
        ? { texto: 'Enviar comprobante', Icon: Upload, desactivado: !comprobante || enviando }
        : paso === 'cuenta'
          ? { texto: transferIntent ? 'Ir al comprobante' : 'Ya tengo los datos', Icon: ArrowRight }
          : { texto: 'Continuar', Icon: ArrowRight, desactivado: enviando };

  const total = `$${fmt2(importeActual.total)}`;
  const fila = (etiqueta: string, valor: string, clave: string, fuerte = false) => (
    <div key={clave} className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-[13px] text-[var(--tenue)] shrink-0">{etiqueta}</dt>
      <dd className="flex items-center gap-1 min-w-0">
        <span className={`truncate tabular-nums ${fuerte ? 'text-[17px] font-semibold' : 'text-[14.5px]'} text-[var(--texto)]`}>{valor}</span>
        {/* Copiar importa de verdad: un número de cuenta tecleado a mano es una transferencia
            que se va a otra parte. */}
        <button type="button" onClick={() => copiar(valor.replace(/^\$/, ''), clave)}
          title={`Copiar ${etiqueta.toLowerCase()}`} aria-label={`Copiar ${etiqueta.toLowerCase()}`}
          className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-[var(--tenue)] hover:text-[var(--violeta-txt)] hover:bg-[#7b5fbf]/[0.08] transition-colors">
          {copiado === clave ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
        </button>
      </dd>
    </div>
  );

  const avisoError = error && (
    <p className="mt-5 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-50/70 px-3 py-2.5 text-[13.5px] text-red-800">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
    </p>
  );

  return (
    <form onSubmit={avanzar} className="flex flex-col">
      {/* ── Lo que se paga, siempre a la vista, y el camino ── */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--violeta-txt)]">Total a pagar</p>
          <p className="mt-1 truncate text-[13.5px] text-[var(--suave)]">{datos.etapa.nombre}</p>
        </div>
        <p className="text-[28px] leading-none font-semibold tabular-nums tracking-tight text-[var(--texto)]">{total}</p>
      </div>
      <div className="mt-6 -mx-1">
        <IndicadorPasos
          pasos={pasos.map(id => ({ id, nombre: PASOS[id].nombre, Icon: PASOS[id].Icon }))}
          actual={iPaso}
          alcanzable={alcanzable}
          onIr={(i) => ir(pasos[i])}
        />
      </div>

      {/* ── El paso ── */}
      <div key={paso} className={`mt-7 border-t border-[var(--linea)] pt-6 ${sentido > 0 ? 'pago-paso-adelante' : 'pago-paso-atras'}`}>
        <h2 className="text-[19px] font-semibold tracking-tight text-[var(--texto)]">{PASOS[paso].titulo}</h2>

        {/* 1 · Método: cada uno con su precio; la transferencia enseña ya sus bancos. */}
        {paso === 'metodo' && (
          <div role="radiogroup" aria-label="Método de pago" className="mt-5 grid gap-3">
            {([
              puedeTarjeta && {
                id: 'card' as const, Icon: CreditCard, nombre: 'Tarjeta de crédito o débito', detalle: 'Se acredita al instante',
                total: datos.importesPorMetodo?.card?.total ?? importes.total, extra: null,
              },
              {
                id: 'transfer' as const, Icon: Landmark, nombre: 'Transferencia bancaria', detalle: 'Verificamos tu comprobante',
                total: datos.importesPorMetodo?.transfer?.total ?? importes.neto,
                extra: (datos.cuentas || []).length > 0 && (
                  <span className="mt-3 flex items-center gap-2">
                    {(datos.cuentas || []).map(c => <LogoBanco key={c.id} cuenta={c} tamano="sm" />)}
                    <span className="text-[12.5px] text-[var(--tenue)]">{(datos.cuentas || []).map(c => c.banco.replace('Banco ', '')).join(' · ')}</span>
                  </span>
                ),
              },
            ].filter(Boolean) as any[]).map((m) => {
              const elegido = metodo === m.id;
              return (
                <button key={m.id} type="button" role="radio" aria-checked={elegido} onClick={() => setMetodo(m.id)}
                  className={`relative flex items-start gap-4 rounded-xl border p-4 text-left transition-all ${
                    elegido
                      ? 'border-[var(--violeta-vivo)] bg-[var(--violeta)]/[0.06] shadow-[0_0_0_3px_rgba(123,95,191,0.12)]'
                      : 'border-[var(--linea-fuerte)] hover:border-[var(--violeta-vivo)]/50'}`}>
                  <span className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                    elegido ? 'bg-[var(--violeta)] text-white' : 'bg-[var(--linea)] text-[var(--suave)]'}`}>
                    <m.Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-[var(--texto)]">{m.nombre}</span>
                    <span className="mt-0.5 block text-[13px] text-[var(--tenue)]">{m.detalle}</span>
                    {m.extra}
                  </span>
                  <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--texto)]">${fmt2(m.total)}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* 2 · Transferencia: elegir el banco y ver su cuenta, ANTES de la factura. */}
        {paso === 'cuenta' && cuentaElegida && (
          <div className="mt-5">
            <div role="radiogroup" aria-label="Banco" className="grid grid-cols-2 gap-3">
              {(datos.cuentas || []).map(c => {
                const elegido = c.id === cuentaElegida.id;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={elegido}
                    onClick={() => { setBancoUsado(c.id); setCuentaAbierta(c.id); }}
                    className={`flex items-center gap-2 sm:gap-3 max-sm:flex-col max-sm:text-center rounded-xl border p-3 sm:text-left transition-all ${
                      elegido
                        ? 'border-[var(--violeta-vivo)] bg-[var(--violeta)]/[0.06] shadow-[0_0_0_3px_rgba(123,95,191,0.12)]'
                        : 'border-[var(--linea-fuerte)] hover:border-[var(--violeta-vivo)]/50'}`}>
                    <LogoBanco cuenta={c} />
                    <span className="min-w-0 max-w-full">
                      <span className="block truncate text-[14.5px] font-medium text-[var(--texto)]">{c.banco}</span>
                      <span className="block truncate text-[12.5px] text-[var(--tenue)]">{c.tipo}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <dl key={cuentaElegida.id} className="pago-paso-adelante mt-4 rounded-xl border border-[var(--linea-fuerte)] px-4 divide-y divide-[var(--linea)]">
              {fila('Monto a transferir', total, 'monto', true)}
              {fila('Número de cuenta', cuentaElegida.numero, `${cuentaElegida.id}-numero`)}
              {fila('Titular', cuentaElegida.titular, `${cuentaElegida.id}-titular`)}
              {fila('Cédula', cuentaElegida.identificacion, `${cuentaElegida.id}-ced`)}
              {fila('Correo', cuentaElegida.correo, `${cuentaElegida.id}-correo`)}
              {cuentaElegida.swift && fila('Código SWIFT', cuentaElegida.swift, `${cuentaElegida.id}-swift`)}
            </dl>
          </div>
        )}

        {/* Factura */}
        {paso === 'factura' && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {opciones.length > 1 && (
              <div className="sm:col-span-2">
                <label className={ETIQUETA} htmlFor="datos-guardados">Datos guardados</label>
                <select id="datos-guardados" className={CAMPO} value={opcionElegida}
                  onChange={e => elegirOpcion(Number(e.target.value))}>
                  {opcionElegida < 0 && <option value={-1}>Otros datos</option>}
                  {opciones.map((o, i) => <option key={i} value={i}>{o.name}{o.ruc ? ` · ${o.ruc}` : ''}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className={ETIQUETA} htmlFor="pais">País</label>
              <select id="pais" className={CAMPO} value={f.pais} onChange={e => set('pais', e.target.value)}>
                {/* Ecuador primero porque es de donde viene casi todo el mundo; el resto,
                    alfabético. Hacer bajar 50 países hasta la E cada vez es fricción tonta. */}
                <option value={PAIS_LOCAL}>{PAIS_LOCAL}</option>
                <option disabled>──────────</option>
                {PAISES.filter(x => x !== PAIS_LOCAL).map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
            <div>
              <label className={ETIQUETA} htmlFor="ruc">{esLocal ? 'Cédula o RUC' : 'Identificación'}</label>
              <input id="ruc" className={CAMPO} value={f.ruc} onChange={e => set('ruc', e.target.value)}
                inputMode={esLocal ? 'numeric' : 'text'} autoComplete="off" required />
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
        )}

        {/* Tarjeta: confirmar y pagar */}
        {paso === 'pago' && (
          <div className="mt-5 space-y-5">
            <dl className="rounded-xl border border-[var(--linea-fuerte)] px-4 py-1 divide-y divide-[var(--linea)] text-[14px]">
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-[var(--tenue)]">Factura a</dt>
                <dd className="min-w-0 truncate text-right text-[var(--texto)]">{f.name}{f.ruc ? ` · ${f.ruc}` : ''}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2.5">
                <dt className="text-[var(--tenue)]">{datos.etapa.nombre}</dt>
                <dd className="tabular-nums text-[var(--texto)]">${fmt2(importes.neto)}</dd>
              </div>
              {importeActual.recargo > 0 && (
                <div className="flex justify-between gap-4 py-2.5">
                  <dt className="text-[var(--tenue)]">Gastos de procesamiento de pago en línea</dt>
                  <dd className="tabular-nums text-[var(--tenue)]">${fmt2(importeActual.recargo)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 py-3">
                <dt className="font-semibold text-[var(--texto)]">Total</dt>
                <dd className="text-[18px] font-semibold tabular-nums text-[var(--texto)]">{total}</dd>
              </div>
            </dl>

            {!esSimulado && !cobraEnCliente && (
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
                    <input id="tj-mes" className={CAMPO} placeholder="MM" maxLength={2} inputMode="numeric" autoComplete="cc-exp-month"
                      value={tarjeta.mes} onChange={e => setTarjeta(p => ({ ...p, mes: e.target.value }))} required />
                  </div>
                  <div>
                    <label className={ETIQUETA} htmlFor="tj-anio">Año</label>
                    <input id="tj-anio" className={CAMPO} placeholder="AA" maxLength={2} inputMode="numeric" autoComplete="cc-exp-year"
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
                </div>
              </div>
            )}

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

            {!esSimulado && !cobraEnCliente && !kushkiListo && pasarela.clavePublica && (
              <p className="text-[13px] text-[var(--tenue)]">Preparando la pasarela…</p>
            )}
            {!esSimulado && !cobraEnCliente && !pasarela.clavePublica && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/70 px-3 py-2.5 text-[13.5px] text-amber-900">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                El cobro en línea todavía no está activo. Escríbenos y lo resolvemos.
              </p>
            )}

            {/* Donde PayPhone dibuja su formulario. Con la Cajita pintada desaparece nuestro
                botón: quien cobra a partir de ahí es PayPhone, y un «Pagar» nuestro debajo
                invitaría a pulsar el que no cobra. */}
            {paramsCajita && (
              <div>
                {!cajitaLista && (
                  <p className="mb-3 flex items-center gap-2 text-[13px] text-[var(--tenue)]">
                    <Loader2 className="w-4 h-4 animate-spin" /> Abriendo la pasarela de pago…
                  </p>
                )}
                <div id="pp-button" />
              </div>
            )}
          </div>
        )}

        {/* Transferencia: el comprobante */}
        {paso === 'comprobante' && cuentaElegida && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-[var(--linea-fuerte)] p-3">
              <LogoBanco cuenta={cuentaElegida} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium text-[var(--texto)]">{cuentaElegida.banco}</span>
                <span className="block truncate text-[13px] tabular-nums text-[var(--tenue)]">N.º {cuentaElegida.numero}</span>
              </span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums text-[var(--texto)]">{total}</span>
            </div>

            {/* Soltar o elegir el archivo: la caja entera es el botón. */}
            <label htmlFor="tr-file"
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors ${
                comprobante
                  ? 'border-emerald-500/50 bg-emerald-50/50'
                  : 'border-[var(--linea-fuerte)] hover:border-[var(--violeta-vivo)] hover:bg-[var(--violeta)]/[0.04]'}`}>
              {comprobante
                ? <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                : <Upload className="w-7 h-7 text-[var(--violeta-txt)]" />}
              <span className="max-w-full truncate text-[14.5px] font-medium text-[var(--texto)]">
                {comprobante ? comprobante.name : 'Elige la foto o el PDF del comprobante'}
              </span>
              {comprobante && <span className="text-[13px] text-[var(--violeta-txt)]">Cambiar archivo</span>}
              <input id="tr-file" type="file" accept="image/*,application/pdf" className="sr-only"
                onChange={e => setComprobante(e.target.files?.[0] || null)} />
            </label>

            <div>
              <label className={ETIQUETA} htmlFor="tr-ref">Número de comprobante (opcional)</label>
              <input id="tr-ref" className={CAMPO} value={referencia} onChange={e => setReferencia(e.target.value)} />
            </div>
          </div>
        )}

        {avisoError}
      </div>

      {/* ── Atrás · principal: siempre en la misma fila, al final del paso ── */}
      {(anterior || principal) && (
        <div className="mt-7 flex items-center justify-between gap-3 border-t border-[var(--linea)] pt-5">
          {anterior ? (
            <button type="button" onClick={() => ir(anterior)} disabled={enviando}
              className="inline-flex items-center gap-2 h-11 px-4 rounded-lg border border-[var(--linea-fuerte)] text-[15px] font-medium text-[var(--texto)] hover:border-[var(--violeta)] transition-colors disabled:opacity-50">
              <ArrowLeft className="w-[18px] h-[18px]" /> Atrás
            </button>
          ) : <span />}
          {principal && (
            <button type="submit" disabled={principal.desactivado || enviando}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-lg bg-[var(--violeta)] hover:bg-[#3f2578] text-[15px] font-semibold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed max-sm:flex-1">
              {enviando
                ? <><Loader2 className="w-[18px] h-[18px] animate-spin" /> Procesando…</>
                : principal.Icon === ArrowRight
                  ? <>{principal.texto} <principal.Icon className="w-[18px] h-[18px]" /></>
                  : <><principal.Icon className="w-[18px] h-[18px]" /> {principal.texto}</>}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
