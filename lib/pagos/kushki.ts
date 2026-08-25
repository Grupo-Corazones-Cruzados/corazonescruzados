/**
 * KUSHKI — la pasarela elegida por Fernando el 2026-08-25.
 *
 * Es la única que cubre de una sola integración los dos requisitos duros: **tarjeta**
 * (nacional e internacional, con diferidos) y **transferencia bancaria ecuatoriana**
 * (Banco Pichincha y Banco de Guayaquil, 24/7, de 1 a 10.000 $ por operación).
 *
 * ⚠️ ESCRITO CONTRA LA DOCUMENTACIÓN, NO CONTRA LA PASARELA. A fecha de hoy GCC todavía
 * no tiene credenciales: la afiliación tarda ~5 días hábiles y exige certificación
 * técnica en UAT. Todo lo de aquí sale de `docs.kushki.com` y **hay que darlo por
 * verificado solo cuando pase la certificación**. Mientras tanto se prueba con el
 * proveedor `simulado`, que ejercita la misma máquina de estados sin depender del trámite.
 *
 * Los dos flujos NO son iguales, y por eso el contrato tiene un estado `redirigir`:
 *   · Tarjeta      → el navegador tokeniza, el servidor cobra, la respuesta es inmediata.
 *   · Transferencia→ el navegador tokeniza, el servidor inicia, Kushki devuelve la URL del
 *                    banco, el cliente autoriza allí y **el pago se confirma por webhook**.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  ProveedorDePago, SolicitudCobro, ResultadoCobro, EventoWebhook, MetodoPago,
} from './tipos';

const UAT = 'https://api-uat.kushkipagos.com';
const PROD = 'https://api.kushkipagos.com';

function base(): string {
  // Producción solo cuando se pide a conciencia. El defecto es UAT: equivocarse hacia
  // el entorno de pruebas no cobra dinero de nadie; equivocarse al revés, sí.
  return process.env.KUSHKI_ENV === 'production' ? PROD : UAT;
}

const clavePrivada = () => process.env.KUSHKI_PRIVATE_MERCHANT_ID || '';
const claveWebhook = () => process.env.KUSHKI_WEBHOOK_SECRET || '';

/**
 * El objeto `amount` de Kushki.
 *
 * ⚠️ GCC factura con **tarifa 0 %** (ver MEMORIA: «GCC no cobra IVA por ahora»), así que
 * todo el importe va en `subtotalIva0` y el IVA queda en cero. El día que el SRI obligue
 * a desglosar IVA hay que repartir aquí, **no** en la pantalla: este es el único sitio
 * donde el importe se traduce al lenguaje de la pasarela.
 */
function importe(total: number) {
  return {
    subtotalIva: 0,
    subtotalIva0: Number(total.toFixed(2)),
    iva: 0,
    ice: 0,
    currency: 'USD',
  };
}

async function pedir(ruta: string, cuerpo: unknown): Promise<any> {
  const res = await fetch(`${base()}${ruta}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Private-Merchant-Id': clavePrivada(),
    },
    body: JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  let datos: any = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { /* la pasarela devolvió algo que no es JSON */ }
  if (!res.ok) {
    // El mensaje del proveedor se conserva tal cual: es lo que hay que enseñarle a
    // Fernando cuando un cobro se caiga, y traducirlo solo lo hace más difícil de buscar.
    const motivo = datos?.message || datos?.details?.message || texto || `HTTP ${res.status}`;
    const err: any = new Error(motivo);
    err.kushki = datos;
    err.status = res.status;
    throw err;
  }
  return datos;
}

export const kushki: ProveedorDePago = {
  nombre: 'kushki',

  disponible() {
    return Boolean(clavePrivada());
  },

  metodos(): MetodoPago[] {
    return ['card', 'transfer'];
  },

  async crearCobro(s: SolicitudCobro): Promise<ResultadoCobro> {
    if (!this.disponible()) throw new Error('Kushki no está configurado (falta KUSHKI_PRIVATE_MERCHANT_ID).');

    if (s.metodo === 'transfer') {
      // El token de transferencia ya lleva el `callbackUrl` desde el navegador; aquí solo
      // se inicia y Kushki devuelve a qué banco hay que mandar al cliente.
      const r = await pedir('/transfer/v1/init', {
        token: s.token,
        amount: importe(s.total),
        // `metadata` es lo que vuelve en el webhook: es cómo reconocemos NUESTRO intento
        // sin fiarnos de que el importe o el correo sean únicos.
        metadata: { intentId: String(s.intentId) },
      });
      const url = r?.redirectUrl || r?.url || null;
      return {
        estado: url ? 'redirigir' : 'pendiente',
        referencia: r?.transactionReference || r?.ticketNumber || null,
        urlRedireccion: url,
        metodo: 'transfer',
        detalleProveedor: r?.status || null,
      };
    }

    // ── Tarjeta ──────────────────────────────────────────────────────────────
    const cuerpo: any = {
      token: s.token,
      amount: importe(s.total),
      fullResponse: true,
      metadata: { intentId: String(s.intentId) },
      contactDetails: { email: s.email },
      orderDetails: { billingDetails: { name: s.descripcion.slice(0, 60) } },
    };
    // Diferidos: Kushki los cobra completos a GCC y es el banco del cliente quien le
    // reparte las cuotas. Por eso el importe que se factura no cambia.
    if (s.meses && s.meses > 1) {
      cuerpo.deferred = { graceMonths: '00', creditType: '01', months: s.meses };
      cuerpo.months = s.meses;
    }

    let r: any;
    try {
      r = await pedir('/card/v1/charges', cuerpo);
    } catch (err: any) {
      // Una tarjeta rechazada NO es un fallo del sistema: es una respuesta legítima que
      // el cliente tiene que ver para poder reintentar con otra. Solo los errores de
      // verdad (5xx, red, configuración) suben como excepción.
      if (err.status && err.status >= 400 && err.status < 500) {
        return {
          estado: 'rechazado',
          referencia: err.kushki?.ticketNumber || null,
          metodo: 'card',
          detalleProveedor: err.kushki?.code || null,
          motivoFallo: err.message,
        };
      }
      throw err;
    }

    const aprobado = String(r?.details?.transactionStatus || r?.transactionStatus || 'APPROVAL')
      .toUpperCase().startsWith('APPROV');
    return {
      estado: aprobado ? 'aprobado' : 'rechazado',
      referencia: r?.ticketNumber || r?.transactionReference || null,
      metodo: 'card',
      detalleProveedor: r?.details?.transactionStatus || null,
      motivoFallo: aprobado ? null : (r?.details?.responseText || 'La tarjeta fue rechazada.'),
    };
  },

  /**
   * Firma HMAC-SHA256 sobre **el cuerpo crudo + la marca de tiempo**, tal como la manda
   * Kushki en `X-Kushki-Signature` junto a `X-Kushki-Id` (timestamp Unix).
   *
   * ⚠️ Sin secreto configurado devuelve `false`, no `true`. La tentación de «déjalo pasar
   * mientras no esté configurado» convierte el webhook en un endpoint público que marca
   * facturas como pagadas: cualquiera con la URL cobraría gratis.
   */
  verificarWebhook(cuerpoCrudo: string, cabeceras: Headers): boolean {
    const secreto = claveWebhook();
    if (!secreto) return false;
    const firma = cabeceras.get('x-kushki-signature') || '';
    const marca = cabeceras.get('x-kushki-id') || '';
    if (!firma || !marca) return false;
    const esperada = createHmac('sha256', secreto).update(cuerpoCrudo + marca).digest('hex');
    const a = Buffer.from(esperada, 'utf8');
    const b = Buffer.from(firma.toLowerCase(), 'utf8');
    // Comparación en tiempo constante: comparar con `===` filtra el secreto carácter a
    // carácter a quien mida los tiempos de respuesta.
    return a.length === b.length && timingSafeEqual(a, b);
  },

  interpretarWebhook(payload: any): EventoWebhook | null {
    if (!payload) return null;
    const estadoCrudo = String(
      payload.transactionStatus || payload.status || payload.details?.transactionStatus || '',
    ).toUpperCase();
    const estado: EventoWebhook['estado'] =
      estadoCrudo.startsWith('APPROV') ? 'paid'
      : estadoCrudo.startsWith('DECLIN') || estadoCrudo.startsWith('FAIL') ? 'failed'
      : 'pending';

    const referencia = payload.transactionReference || payload.ticketNumber || null;
    const bruto = payload.metadata?.intentId ?? payload.contextualData?.intentId ?? null;
    const intentId = bruto != null && /^\d+$/.test(String(bruto)) ? Number(bruto) : null;

    // Sin identificador propio del evento, la referencia + el estado es lo más estable
    // que hay: un reintento del MISMO evento repite ambos, y un evento distinto del mismo
    // cobro (pendiente → aprobado) cambia el estado y por tanto sí se procesa.
    const eventId = String(payload.eventId || payload.id || `${referencia}:${estado}`);
    if (!referencia && intentId == null) return null;

    return {
      eventId,
      referencia,
      intentId,
      estado,
      metodo: payload.paymentMethod === 'transfer' ? 'transfer' : 'card',
      detalle: estadoCrudo || null,
    };
  },

  async consultarCobro(referencia: string): Promise<ResultadoCobro> {
    const res = await fetch(`${base()}/card/v1/charges/${encodeURIComponent(referencia)}`, {
      headers: { 'Private-Merchant-Id': clavePrivada() },
    });
    if (!res.ok) throw new Error(`No se pudo consultar el cobro ${referencia}: HTTP ${res.status}`);
    const r = await res.json();
    const aprobado = String(r?.transactionStatus || '').toUpperCase().startsWith('APPROV');
    return {
      estado: aprobado ? 'aprobado' : 'rechazado',
      referencia,
      metodo: 'card',
      detalleProveedor: r?.transactionStatus || null,
    };
  },
};
