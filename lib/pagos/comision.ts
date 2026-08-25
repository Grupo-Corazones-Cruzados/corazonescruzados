/**
 * EL RECARGO DE LA PASARELA — módulo PURO (sin `pg`, sin red, sin `process` en el cálculo).
 *
 * Fernando decidió el 2026-08-25 que **la comisión la paga el cliente**, subiendo el
 * precio de origen y mostrándose como línea aparte en la factura. Este archivo es la
 * ÚNICA definición de esa aritmética: la usan el servidor al crear el cobro, la pantalla
 * del cliente al enseñarle cuánto va a pagar, y el correo del enlace de pago. Si el
 * cálculo viviera en dos sitios, el importe de la pantalla y el del cobro se separarían
 * el día que alguien toque uno solo — y eso se descubre cuando el cliente reclama.
 *
 * ⚠️ NO es «sumarle el 2,95 %». Si a 2.000 $ se le suma su 2,95 %, la pasarela cobra su
 * comisión sobre el TOTAL resultante y a GCC le llegan 1.998,42 $: faltan 1,58 $. Hay
 * que despejar al revés (gross-up):
 *
 *        total = (neto + fijo) / (1 − porcentaje)
 *
 * ⚠️ EL REDONDEO VA HACIA ARRIBA, SIEMPRE. Al centavo más cercano, la mitad de las veces
 * faltaría un centavo del importe pactado. Que sobre un centavo no le hace daño a nadie;
 * que falte descuadra la etapa contra el plan.
 */

export type Tarifa = {
  /** Porcentaje sobre el total cobrado, en tanto por uno (0,0295 = 2,95 %). */
  porcentaje: number;
  /** Cargo fijo por transacción, en dólares. */
  fijo: number;
};

export type Recargo = {
  /** Lo pactado en el plan de etapas: lo que debe llegar a GCC. */
  neto: number;
  /** El recargo trasladado al cliente. Va como línea propia de la factura. */
  recargo: number;
  /** Lo que el cliente paga = neto + recargo. Es el total de la factura. */
  total: number;
};

/**
 * Tarifas por proveedor.
 *
 * ⚠️ Son las PUBLICADAS en agosto de 2026, no las contratadas: Kushki negocia la tarifa
 * por comercio, así que al firmar hay que traer aquí la real. Por eso admiten override
 * por variable de entorno (`PAGOS_KUSHKI_PORCENTAJE`, `PAGOS_KUSHKI_FIJO`): el día que
 * cambie el contrato, cambia el número sin tocar el código ni volver a desplegar.
 */
export const TARIFAS: Record<string, Tarifa> = {
  // 2,95 % + 0,25 $ por transacción aprobada.
  kushki: { porcentaje: 0.0295, fijo: 0.25 },
  // 5 % + IVA SOBRE LA COMISIÓN (no sobre la venta) = 5,75 % efectivo. Sin cargo fijo.
  payphone: { porcentaje: 0.0575, fijo: 0 },
  // El canal manual no tiene pasarela, así que no hay nada que trasladar.
  manual: { porcentaje: 0, fijo: 0 },
  // ⚠️ EL SIMULADO COBRA LA MISMA TARIFA QUE KUSHKI, y no es un descuido. Con tarifa cero
  // las pruebas verían una factura de UNA línea, que es justo lo contrario de lo que hay
  // que comprobar: que el recargo sale aparte y que los importes cuadran. Un entorno de
  // pruebas que se comporta distinto del real no prueba el real.
  simulado: { porcentaje: 0.0295, fijo: 0.25 },
};

/** Redondeo al centavo HACIA ARRIBA. El epsilon evita que 20,610000000000003 suba a 20,62. */
export function centavosArriba(n: number): number {
  return Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
}

/** Redondeo al centavo más cercano, para importes que no son el total a cobrar. */
export function centavos(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Cuánto hay que cobrarle al cliente para que a GCC le lleguen `neto` dólares limpios.
 *
 * Con tarifa cero (canal manual) devuelve el neto tal cual, sin recargo: así el mismo
 * código sirve para los tres canales y el manual no necesita un camino aparte.
 */
export function calcularRecargo(neto: number, tarifa: Tarifa): Recargo {
  const base = centavos(neto);
  if (!(base > 0)) return { neto: 0, recargo: 0, total: 0 };
  if (tarifa.porcentaje <= 0 && tarifa.fijo <= 0) {
    return { neto: base, recargo: 0, total: base };
  }
  if (tarifa.porcentaje >= 1) {
    throw new Error('Tarifa inválida: el porcentaje no puede llegar al 100 %.');
  }
  const total = centavosArriba((base + tarifa.fijo) / (1 - tarifa.porcentaje));
  return { neto: base, recargo: centavos(total - base), total };
}

/**
 * La tarifa de un proveedor, con el override de entorno aplicado.
 *
 * Es la única función de este archivo que mira `process.env`; el cálculo de arriba sigue
 * siendo puro y comprobable sin montar nada.
 */
export function tarifaDe(proveedor: string): Tarifa {
  const base = TARIFAS[proveedor];
  // El mensaje nombra el archivo a propósito: `proveedorPorNombre` lanzaba uno idéntico,
  // y al depurar mandó a revisar el registro de proveedores cuando lo que faltaba era la
  // tarifa. Dos errores distintos no pueden decir lo mismo.
  if (!base) throw new Error(`Sin tarifa configurada para el proveedor «${proveedor}» (lib/pagos/comision.ts).`);
  const clave = proveedor.toUpperCase();
  const pct = Number(process.env[`PAGOS_${clave}_PORCENTAJE`]);
  const fijo = Number(process.env[`PAGOS_${clave}_FIJO`]);
  return {
    porcentaje: Number.isFinite(pct) && pct >= 0 && pct < 1 ? pct : base.porcentaje,
    fijo: Number.isFinite(fijo) && fijo >= 0 ? fijo : base.fijo,
  };
}

/**
 * Lo que de verdad le queda a GCC si la pasarela cobra su comisión sobre el total.
 * Sirve para comprobar que el gross-up no dejó a nadie corto — y para conciliar contra
 * la liquidación del proveedor, que es donde se ve el dinero real.
 */
export function netoRecibido(total: number, tarifa: Tarifa): number {
  const comision = centavos(centavos(total * tarifa.porcentaje) + tarifa.fijo);
  return centavos(total - comision);
}

/** El texto de la línea del recargo en la factura. Una sola redacción para todos lados. */
export const CONCEPTO_RECARGO = 'Gastos de procesamiento de pago en línea';
