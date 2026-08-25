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
import { CreditCard, Landmark, Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fmt2 } from '@/lib/format';

declare global {
  interface Window {
    Kushki?: any;
    /** Constructor de la Cajita de Pagos de PayPhone, que llega por su CDN. */
    PPaymentButtonBox?: any;
  }
}

export type DatosPago = {
  proyecto: { id: number; titulo: string; descripcion: string | null; estado: string | null; cliente: string | null; etapas: any[] };
  etapa: { id: number; nombre: string };
  importes: { neto: number; recargo: number; total: number };
  pasarela: { proveedor: string; metodos: string[]; cobraEnCliente?: boolean; clavePublica: string | null; entorno: string };
  facturacion: any;
  correoDestino: string | null;
  canal: string;
  yaPagada: { invoiceId: number | null } | null;
};

const TIPOS_ID = [
  { valor: '05', etiqueta: 'Cédula' },
  { valor: '04', etiqueta: 'RUC' },
  { valor: '06', etiqueta: 'Pasaporte' },
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
  datos, link, projectId, stageId, onPagado,
}: {
  datos: DatosPago;
  link?: string;
  projectId?: number;
  stageId?: number;
  onPagado?: (invoiceId: number | null) => void;
}) {
  const { importes, pasarela } = datos;
  const esSimulado = pasarela.proveedor === 'simulado';
  // PayPhone cobra en el navegador con su propia Cajita; Kushki cobra en el servidor con un
  // token. La pantalla no pregunta «¿eres PayPhone?»: lo declara el proveedor.
  const cobraEnCliente = Boolean(pasarela.cobraEnCliente);
  const kushkiListo = useKushki(esSimulado || cobraEnCliente ? null : pasarela.clavePublica, pasarela.entorno);
  const cajitaLista = useCajitaPayphone(cobraEnCliente);
  const [paramsCajita, setParamsCajita] = useState<Record<string, unknown> | null>(null);

  const [metodo, setMetodo] = useState<'card' | 'transfer'>(
    pasarela.metodos.includes('card') ? 'card' : 'transfer',
  );

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
          link, project_id: projectId, stage_id: stageId,
          token, metodo, facturacion: f,
          meses: metodo === 'card' && meses > 1 ? meses : undefined,
        }),
      });
      const d = await res.json();

      if (!res.ok) { setError(d.error || 'No se pudo completar el pago.'); setEnviando(false); return; }

      if (d.estado === 'rechazado') { setError(d.error); setEnviando(false); return; }

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
      <fieldset className={pasarela.metodos.length > 1 ? '' : 'hidden'}>
        <legend className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--violeta-txt)] mb-3">
          Cómo quieres pagar
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {pasarela.metodos.includes('card') && (
            <button type="button" onClick={() => setMetodo('card')}
              className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium transition ${
                metodo === 'card'
                  ? 'border-[var(--violeta-vivo)] bg-[var(--violeta)]/8 text-[var(--texto)]'
                  : 'border-[var(--linea-fuerte)] text-[var(--suave)] hover:border-[var(--violeta-vivo)]/50'}`}>
              <CreditCard className="w-[18px] h-[18px]" /> Tarjeta
            </button>
          )}
          {pasarela.metodos.includes('transfer') && (
            <button type="button" onClick={() => setMetodo('transfer')}
              className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-[14px] font-medium transition ${
                metodo === 'transfer'
                  ? 'border-[var(--violeta-vivo)] bg-[var(--violeta)]/8 text-[var(--texto)]'
                  : 'border-[var(--linea-fuerte)] text-[var(--suave)] hover:border-[var(--violeta-vivo)]/50'}`}>
              <Landmark className="w-[18px] h-[18px]" /> Transferencia
            </button>
          )}
        </div>
        {metodo === 'transfer' && (
          <p className="mt-2.5 text-[13px] text-[var(--tenue)]">
            Te llevaremos al portal de tu banco para que autorices el débito. Solo Banco Pichincha
            y Banco de Guayaquil, con cuentas personales.
          </p>
        )}
      </fieldset>

      {/* ── Facturación ── */}
      <fieldset>
        <legend className="text-[13px] font-semibold uppercase tracking-[0.1em] text-[var(--violeta-txt)] mb-3">
          Datos para tu factura
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={ETIQUETA} htmlFor="tipo-id">Tipo de identificación</label>
            <select id="tipo-id" className={CAMPO} value={f.id_type} onChange={e => set('id_type', e.target.value)}>
              {TIPOS_ID.map(t => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
            </select>
          </div>
          <div>
            <label className={ETIQUETA} htmlFor="ruc">Identificación</label>
            <input id="ruc" className={CAMPO} value={f.ruc} onChange={e => set('ruc', e.target.value)}
              inputMode="numeric" autoComplete="off" required />
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
      <div className="rounded-xl border border-[var(--linea-fuerte)] bg-[var(--tarjeta)] p-5">
        <dl className="space-y-2 text-[14px]">
          <div className="flex justify-between gap-4">
            <dt className="text-[var(--suave)]">{datos.etapa.nombre}</dt>
            <dd className="tabular-nums text-[var(--texto)]">${fmt2(importes.neto)}</dd>
          </div>
          {importes.recargo > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tenue)]">Gastos de procesamiento de pago en línea</dt>
              <dd className="tabular-nums text-[var(--tenue)]">${fmt2(importes.recargo)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-[var(--linea)] pt-3 mt-3">
            <dt className="font-semibold text-[var(--texto)]">Total a pagar</dt>
            <dd className="text-[20px] font-semibold tabular-nums text-[var(--texto)]">${fmt2(importes.total)}</dd>
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
              : cobraEnCliente
                ? <><Lock className="w-[18px] h-[18px]" /> Continuar al pago</>
                : <><Lock className="w-[18px] h-[18px]" /> Pagar ${fmt2(importes.total)}</>}
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

        <p className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] text-[var(--tenue)]">
          <Lock className="w-3.5 h-3.5" />
          Los datos de tu tarjeta viajan cifrados a la pasarela. GCC no los recibe ni los guarda.
        </p>
      </div>
    </form>
  );
}
