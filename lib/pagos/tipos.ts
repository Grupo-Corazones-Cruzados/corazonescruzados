/**
 * EL CONTRATO DE UN PROVEEDOR DE PAGO.
 *
 * Kushki es la pasarela elegida, pero **no es el flujo**: es una implementación de este
 * contrato. Fernando ya anunció PayPal, PayPhone y Binance, y los tres canales de cobro
 * (manual, cliente y enlace) no pueden enterarse de cuál está conectado. Esta separación
 * no es arquitectura por gusto — es [[gcc-equivalente-no-es-igual]] aplicado ANTES de que
 * duela: sin ella, meter el segundo proveedor obliga a reescribir las tres pantallas.
 *
 * ⚠️ Lo que este contrato NO hace, a propósito: no toca la base de datos, no emite
 * facturas y no decide importes. Un proveedor solo sabe hablar con su pasarela. Quien
 * calcula, guarda y factura es `lib/pagos/intentos.ts`, para que el día que un proveedor
 * se comporte raro no haya que auditar también la contabilidad.
 */

/** Los dos métodos de la v1. Deciden el `formaPago` del XML del SRI. */
export type MetodoPago = 'card' | 'transfer';

/** Estado de un cobro visto desde fuera del proveedor. */
export type EstadoCobro = 'aprobado' | 'redirigir' | 'pendiente' | 'rechazado';

export type SolicitudCobro = {
  /** El intento de `payment_intents`. Viaja al proveedor como referencia nuestra. */
  intentId: number;
  /**
   * El token que el navegador generó con la librería del proveedor.
   * ⚠️ Los datos de la tarjeta NUNCA pasan por nuestro servidor: llegan tokenizados.
   * Es lo que mantiene a GCC en el nivel más bajo de exigencia PCI.
   */
  token: string;
  metodo: MetodoPago;
  /** Lo que paga el cliente (neto + recargo). Se recalcula en servidor, jamás llega del navegador. */
  total: number;
  descripcion: string;
  email: string;
  /** Meses del diferido con tarjeta de crédito. Sin valor = pago corriente. */
  meses?: number;
  /** A dónde vuelve el cliente tras el portal del banco (solo transferencia). */
  urlRetorno: string;
};

export type ResultadoCobro = {
  estado: EstadoCobro;
  /** El identificador de la transacción en el proveedor. Es la llave de la conciliación. */
  referencia: string | null;
  /** Solo en transferencia: a dónde hay que mandar al cliente para que autorice en su banco. */
  urlRedireccion?: string | null;
  metodo: MetodoPago;
  /** El estado tal como lo dijo el proveedor, sin traducir. Para poder discutir un cobro. */
  detalleProveedor?: string | null;
  motivoFallo?: string | null;
};

/** Un evento de webhook ya traducido a nuestro lenguaje. */
export type EventoWebhook = {
  /**
   * Identificador ÚNICO del evento en el proveedor. Es lo que hace la idempotencia
   * posible: Kushki reintenta hasta 7 veces en 3 horas, y sin esto el segundo intento
   * emitiría un segundo comprobante del mismo cobro.
   */
  eventId: string;
  referencia: string | null;
  /** Nuestro `payment_intents.id`, si el proveedor nos lo devuelve en los metadatos. */
  intentId: number | null;
  estado: 'paid' | 'failed' | 'pending';
  metodo?: MetodoPago;
  detalle?: string | null;
};

export interface ProveedorDePago {
  /** El nombre con el que se guarda en `payment_intents.provider`. */
  readonly nombre: string;
  /** Si tiene credenciales configuradas. Sin ellas no se le puede ofrecer al cliente. */
  disponible(): boolean;
  /** Qué métodos puede cobrar hoy este proveedor. */
  metodos(): MetodoPago[];
  crearCobro(solicitud: SolicitudCobro): Promise<ResultadoCobro>;
  /**
   * ⚠️ Se verifica sobre el CUERPO CRUDO, no sobre el JSON ya parseado: la firma se
   * calcula sobre los bytes exactos que llegaron, y `JSON.parse` + `JSON.stringify`
   * reordena claves y cambia espacios. Un webhook sin verificar es una puerta abierta
   * para que cualquiera marque una factura como pagada.
   */
  verificarWebhook(cuerpoCrudo: string, cabeceras: Headers): boolean;
  interpretarWebhook(payload: any): EventoWebhook | null;
  /** Consulta directa al proveedor. La red de seguridad cuando el webhook no llega. */
  consultarCobro?(referencia: string): Promise<ResultadoCobro>;

  /**
   * `true` cuando **el cobro lo ejecuta el navegador**, no el servidor.
   *
   * Kushki tokeniza en el navegador y cobra en el servidor. PayPhone hace lo contrario: su
   * Cajita cobra dentro de la página del cliente y el servidor solo confirma después. No es
   * un detalle de implementación — cambia qué devuelve `/api/pagos/cobrar` y qué pinta la
   * pantalla, así que el contrato tiene que declararlo en vez de que cada endpoint adivine
   * mirando el nombre del proveedor.
   */
  readonly cobraEnCliente?: boolean;

  /** Lo que el navegador necesita para cobrar. Solo si `cobraEnCliente`. */
  parametrosCliente?(datos: {
    intentId: number;
    total: number;
    referencia: string;
    email?: string;
    telefono?: string | null;
    documento?: string | null;
  }): Record<string, unknown>;
}

/**
 * Formas de pago del SRI (tabla 24 de la Ficha Técnica de comprobantes electrónicos).
 *
 * Hasta hoy el `paymentCode` del XML era una elección de pantalla en el modal de
 * facturar. Con la pasarela deja de serlo: es un dato del cobro, y lo pone el método
 * con el que el cliente pagó de verdad.
 */
export const FORMA_PAGO_SRI: Record<MetodoPago, string> = {
  card: '19',      // Tarjeta de crédito
  transfer: '20',  // Otros con utilización del sistema financiero (transferencia)
};

/** Tarjeta de DÉBITO tiene su propio código; el proveedor lo distingue al cobrar. */
export const FORMA_PAGO_DEBITO = '16';
