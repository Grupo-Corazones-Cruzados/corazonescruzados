import type {
  EstadoPedido,
  EstadoItem,
  EstadoMesa,
  MetodoPagoPedido,
  EstadoReservaMesa,
} from '@/generated/prisma/enums';

// ── Aritmética del pedido ───────────────────────────────────────────────────
/**
 * El IVA de un pedido se calcula de UNA de dos maneras según cómo estén escritos
 * los precios del catálogo, y confundirlas cambia lo que se cobra:
 *
 *  · **Precio con IVA dentro** (lo normal en una carta: «Ceviche $8,00»): el total
 *    es la suma tal cual, y el IVA se DESGLOSA hacia atrás. Sumarle un 15 % encima
 *    cobraría de más.
 *  · **Precio sin IVA**: el impuesto se SUMA al final.
 *
 * Y si el negocio no cobra IVA, no hay impuesto y punto.
 *
 * Se trabaja en CENTAVOS enteros: con decimales flotantes, 0,1 + 0,2 no da 0,3 y
 * la cuenta de un pedido largo se va por unos centavos que nadie sabe explicar.
 */
export type LineaCalculo = { precioUnitario: number; cantidad: number };

export type Cuenta = { subtotal: number; iva: number; total: number; ivaPorcentaje: number };

export function calcularCuenta(
  lineas: LineaCalculo[],
  config: { aplicaIva: boolean; ivaPorcentaje: number; precioConIva: boolean },
): Cuenta {
  const centavos = lineas.reduce(
    (a, l) => a + Math.round(l.precioUnitario * 100) * Math.max(0, Math.trunc(l.cantidad)),
    0,
  );

  if (!config.aplicaIva || config.ivaPorcentaje <= 0)
    return { subtotal: centavos / 100, iva: 0, total: centavos / 100, ivaPorcentaje: 0 };

  const tasa = config.ivaPorcentaje / 100;

  if (config.precioConIva) {
    const base = Math.round(centavos / (1 + tasa));
    return {
      subtotal: base / 100,
      iva: (centavos - base) / 100,
      total: centavos / 100,
      ivaPorcentaje: config.ivaPorcentaje,
    };
  }

  const impuesto = Math.round(centavos * tasa);
  return {
    subtotal: centavos / 100,
    iva: impuesto / 100,
    total: (centavos + impuesto) / 100,
    ivaPorcentaje: config.ivaPorcentaje,
  };
}

// ── Estados y su presentación ───────────────────────────────────────────────
export const ETIQUETA_PEDIDO: Record<EstadoPedido, string> = {
  EN_PREPARACION: 'En preparación',
  LISTO: 'Listo para servir',
  SERVIDO: 'Servido',
  COBRADO: 'Cobrado',
  ANULADO: 'Anulado',
};

export const TONO_PEDIDO = {
  EN_PREPARACION: 'info',
  LISTO: 'aviso',
  SERVIDO: 'exito',
  COBRADO: 'neutro',
  ANULADO: 'error',
} as const;

export const ETIQUETA_MESA: Record<EstadoMesa, string> = {
  LIBRE: 'Libre',
  ESPERANDO_ATENCION: 'Esperando atención',
  OCUPADA: 'Ocupada',
};

export const TONO_MESA = {
  LIBRE: 'exito',
  ESPERANDO_ATENCION: 'aviso',
  OCUPADA: 'info',
} as const;

export const ETIQUETA_ITEM: Record<EstadoItem, string> = {
  PENDIENTE: 'En cocina',
  LISTO: 'Listo',
};

export const ETIQUETA_PAGO: Record<MetodoPagoPedido, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  OTRO: 'Otro',
};

export const ETIQUETA_RESERVA: Record<EstadoReservaMesa, string> = {
  PENDIENTE: 'Pendiente',
  CUMPLIDA: 'Cumplida',
  CANCELADA: 'Cancelada',
  NO_PRESENTADO: 'No se presentó',
};

export const TONO_RESERVA = {
  PENDIENTE: 'info',
  CUMPLIDA: 'exito',
  CANCELADA: 'neutro',
  NO_PRESENTADO: 'error',
} as const;

/** Un pedido sigue vivo mientras no se haya cobrado ni anulado. */
export const PEDIDOS_ABIERTOS: EstadoPedido[] = ['EN_PREPARACION', 'LISTO', 'SERVIDO'];

/**
 * El estado del pedido según sus platos. Se recalcula al añadir o marcar: si el
 * mesero añade una segunda ronda, el pedido vuelve a preparación **sin borrar** que
 * lo anterior ya salió — eso lo guarda cada plato.
 */
export function estadoSegunItems(
  items: { estado: EstadoItem }[],
  estadoActual: EstadoPedido,
): EstadoPedido {
  if (estadoActual === 'COBRADO' || estadoActual === 'ANULADO') return estadoActual;
  if (!items.length) return 'EN_PREPARACION';
  const quedaAlgo = items.some((i) => i.estado === 'PENDIENTE');
  if (quedaAlgo) return 'EN_PREPARACION';
  // Todo está listo. Si ya se había servido, servido sigue.
  return estadoActual === 'SERVIDO' ? 'SERVIDO' : 'LISTO';
}

/** Minutos transcurridos, para «esta mesa lleva 12 minutos esperando». */
export const minutosDesde = (d: Date, ahora = new Date()) =>
  Math.max(0, Math.floor((ahora.getTime() - d.getTime()) / 60000));

export function textoEspera(minutos: number) {
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
