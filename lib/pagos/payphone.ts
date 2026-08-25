/**
 * PAYPHONE — la pasarela con la que GCC cobra de verdad (2026-08-25).
 *
 * Sustituye a Kushki, que quedó descartada al descubrir que **no atiende comercios de este
 * tamaño**: su formulario de afiliación empieza en 200.000 USD mensuales y GCC factura
 * ~20.000 al año. PayPhone se activa el mismo día con el RUC, no cobra fijos, el retiro al
 * banco es gratis, y acepta tarjetas **de cualquier banco del mundo** — que es lo que cubre
 * al cliente de fuera de Ecuador.
 *
 * ⚠️ SU FLUJO NO ES EL DE KUSHKI, Y LA DIFERENCIA IMPORTA:
 *
 *   Kushki    → el navegador tokeniza · el servidor cobra · **el webhook confirma**.
 *   PayPhone  → la Cajita cobra dentro de nuestra página · PayPhone redirige a la Url de
 *               respuesta · **NOSOTROS confirmamos llamando a su API**.
 *
 * 🔴 Y ESTO ES LO QUE NO SE PUEDE OLVIDAR: **si la confirmación no se ejecuta dentro de los
 * primeros 5 MINUTOS, PayPhone reversa la transacción automáticamente.** Un cobro que
 * «parece» haber funcionado pero no se confirmó se deshace solo, y nadie se entera hasta
 * cuadrar el mes. Por eso la Url de respuesta (`/pagos/respuesta`) confirma en el acto y
 * no delega en ningún proceso posterior.
 *
 * Consecuencia de diseño: aquí `crearCobro` **no cobra**. El cobro lo hace la Cajita en el
 * navegador; este archivo solo prepara lo que la Cajita necesita y confirma después.
 */
import type {
  ProveedorDePago, SolicitudCobro, ResultadoCobro, EventoWebhook, MetodoPago,
} from './tipos';

const API_CONFIRM = 'https://paymentbox.payphonetodoesposible.com/api/confirm';

const token = () => process.env.PAYPHONE_TOKEN || '';
const storeId = () => process.env.PAYPHONE_STORE_ID || '';

/**
 * PayPhone trabaja en **CENTAVOS, y como entero**. 892,84 $ viaja como `89284`.
 * Un decimal colado ahí es un cobro por otro importe, así que la conversión vive en una
 * sola función y se redondea explícitamente.
 */
export function aCentavos(dolares: number): number {
  return Math.round(dolares * 100);
}

export function aDolares(centavos: number): number {
  return Math.round(centavos) / 100;
}

/**
 * Los parámetros que necesita la Cajita en el navegador.
 *
 * ⚠️ `amount` tiene que ser **exactamente** la suma de los demás:
 *     amount = amountWithoutTax + amountWithTax + tax + service + tip
 * GCC factura con **tarifa 0 %** (ver MEMORIA: «GCC no cobra IVA por ahora»), así que todo
 * el importe va en `amountWithoutTax` y los otros quedan en cero. El día que haya que
 * desglosar IVA se reparte AQUÍ, no en la pantalla.
 */
export function parametrosCajita(opts: {
  intentId: number;
  total: number;
  referencia: string;
  email?: string;
  telefono?: string | null;
  documento?: string | null;
}) {
  const centavos = aCentavos(opts.total);
  return {
    token: token(),
    storeId: storeId(),
    clientTransactionId: String(opts.intentId),
    amount: centavos,
    amountWithoutTax: centavos,
    amountWithTax: 0,
    tax: 0,
    service: 0,
    tip: 0,
    currency: 'USD',
    // Máximo 100 caracteres según su documentación; se recorta antes de enviar.
    reference: opts.referencia.slice(0, 100),
    lang: 'es',
    timeZone: -5,
    ...(opts.email ? { email: opts.email } : {}),
    ...(opts.telefono ? { phoneNumber: opts.telefono } : {}),
    ...(opts.documento ? { documentId: opts.documento } : {}),
  };
}

export type ConfirmacionPayphone = {
  aprobada: boolean;
  intentId: number | null;
  transactionId: number | null;
  estado: string;
  autorizacion: string | null;
  /** Lo que PayPhone dice que cobró, en dólares. Se compara con lo que esperábamos. */
  importe: number | null;
  marcaTarjeta: string | null;
  mensaje: string | null;
};

/**
 * CONFIRMA la transacción contra PayPhone. Es la llamada de los 5 minutos.
 *
 * Devuelve el resultado en vez de lanzar cuando la respuesta es legítima (aprobada o
 * rechazada): un rechazo no es un fallo del sistema, es información que el cliente
 * necesita. Solo lanza si no se pudo hablar con PayPhone.
 */
export async function confirmarTransaccion(id: number, clientTxId: string): Promise<ConfirmacionPayphone> {
  if (!token()) throw new Error('PayPhone no está configurado (falta PAYPHONE_TOKEN).');

  const res = await fetch(API_CONFIRM, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ id, clientTxId }),
  });

  const texto = await res.text();
  let d: any = null;
  try { d = texto ? JSON.parse(texto) : null; } catch { /* no era JSON */ }

  if (!res.ok) {
    const motivo = d?.message || d?.errors?.[0]?.message || texto || `HTTP ${res.status}`;
    throw new Error(`PayPhone no confirmó la transacción: ${motivo}`);
  }

  const estado = String(d?.transactionStatus || '').trim();
  const bruto = d?.clientTransactionId ?? clientTxId;
  return {
    aprobada: estado.toLowerCase() === 'approved',
    intentId: /^\d+$/.test(String(bruto)) ? Number(bruto) : null,
    transactionId: d?.transactionId != null ? Number(d.transactionId) : null,
    estado: estado || 'Desconocido',
    autorizacion: d?.authorizationCode ?? null,
    importe: d?.amount != null ? aDolares(Number(d.amount)) : null,
    marcaTarjeta: d?.cardBrand ?? null,
    mensaje: d?.message ?? null,
  };
}

export const payphone: ProveedorDePago = {
  nombre: 'payphone',

  // El cobro ocurre en el navegador, dentro de la Cajita. El servidor solo confirma.
  cobraEnCliente: true,

  parametrosCliente(datos) {
    return parametrosCajita(datos);
  },

  disponible() {
    // Los DOS hacen falta: con token pero sin storeId la Cajita ni siquiera se dibuja.
    return Boolean(token() && storeId());
  },

  metodos(): MetodoPago[] {
    // Solo tarjeta (y saldo PayPhone, que para nosotros se comporta igual). La
    // transferencia bancaria ecuatoriana NO la da PayPhone: esa vendrá por Deuna.
    return ['card'];
  },

  /**
   * No cobra: prepara. El cobro lo ejecuta la Cajita en el navegador del cliente.
   *
   * Se devuelve `pendiente` a propósito, y no `aprobado`: mientras la Url de respuesta no
   * confirme, **no hay cobro**. Decir aquí que está aprobado sería la mentira más cara
   * posible en este archivo.
   */
  async crearCobro(s: SolicitudCobro): Promise<ResultadoCobro> {
    if (!this.disponible()) {
      throw new Error('PayPhone no está configurado (faltan PAYPHONE_TOKEN o PAYPHONE_STORE_ID).');
    }
    return {
      estado: 'pendiente',
      referencia: null,
      metodo: 'card',
      detalleProveedor: 'A la espera de la Cajita de Pagos',
    };
  },

  /**
   * PayPhone tiene notificación externa, pero **el camino bueno es la Url de respuesta**:
   * es la que corre dentro de la ventana de 5 minutos. Devolver `false` aquí evita que un
   * webhook mal configurado se convierta en una segunda puerta de confirmación sin firma
   * verificada.
   */
  verificarWebhook(): boolean {
    return false;
  },

  interpretarWebhook(): EventoWebhook | null {
    return null;
  },
};
