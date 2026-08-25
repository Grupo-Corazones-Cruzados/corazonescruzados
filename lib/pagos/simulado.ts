/**
 * PROVEEDOR SIMULADO — para probar los tres canales antes de tener credenciales.
 *
 * No es un atajo ni un mock de conveniencia: la afiliación a Kushki tarda ~5 días
 * hábiles más certificación técnica, y sin esto la máquina de estados (crear intento →
 * cobrar → webhook → emitir factura → cuadrar la etapa) no se podría ejercitar hasta
 * entonces. Lo que se prueba con él es **nuestro** código, que es donde están los fallos
 * que nos tocan.
 *
 * ⚠️ APAGADO SALVO QUE SE ENCIENDA A MANO, Y NUNCA EN PRODUCCIÓN. La razón es seria: un
 * cobro simulado dispara la MISMA emisión de factura electrónica que uno real, y una
 * factura autorizada por el SRI no se borra — se anula con nota de crédito. Dejar esto
 * accesible en producción es la vía corta a ensuciar la numeración fiscal de verdad.
 */
import type {
  ProveedorDePago, SolicitudCobro, ResultadoCobro, EventoWebhook, MetodoPago,
} from './tipos';

/** Con este número de tarjeta/documento el cobro se rechaza, para probar el camino malo. */
export const TOKEN_RECHAZO = 'rechazar';

export const simulado: ProveedorDePago = {
  nombre: 'simulado',

  disponible() {
    if (process.env.NODE_ENV === 'production') return false;
    return process.env.PAGOS_SIMULADO === '1';
  },

  metodos(): MetodoPago[] {
    return ['card', 'transfer'];
  },

  async crearCobro(s: SolicitudCobro): Promise<ResultadoCobro> {
    const referencia = `sim-${s.intentId}-${s.metodo}`;

    if (s.token.includes(TOKEN_RECHAZO)) {
      return {
        estado: 'rechazado',
        referencia,
        metodo: s.metodo,
        detalleProveedor: 'DECLINED',
        motivoFallo: 'Cobro rechazado a propósito (token de prueba).',
      };
    }

    if (s.metodo === 'transfer') {
      // Igual que Kushki: la transferencia no se resuelve aquí, manda al «banco» y el
      // pago se confirma después por webhook. Probar el camino corto sería probar otro.
      return {
        estado: 'redirigir',
        referencia,
        urlRedireccion: `${s.urlRetorno}${s.urlRetorno.includes('?') ? '&' : '?'}sim=${encodeURIComponent(referencia)}`,
        metodo: 'transfer',
        detalleProveedor: 'PENDING',
      };
    }

    return { estado: 'aprobado', referencia, metodo: 'card', detalleProveedor: 'APPROVAL' };
  },

  verificarWebhook(): boolean {
    // Solo vive fuera de producción y detrás de una variable; no hay firma que verificar.
    return this.disponible();
  },

  interpretarWebhook(payload: any): EventoWebhook | null {
    if (!payload?.referencia && payload?.intentId == null) return null;
    return {
      eventId: String(payload.eventId || `${payload.referencia}:${payload.estado}`),
      referencia: payload.referencia ?? null,
      intentId: payload.intentId != null ? Number(payload.intentId) : null,
      estado: payload.estado === 'failed' ? 'failed' : payload.estado === 'pending' ? 'pending' : 'paid',
      metodo: payload.metodo === 'transfer' ? 'transfer' : 'card',
      detalle: 'SIMULADO',
    };
  },
};
