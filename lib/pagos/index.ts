/**
 * EL REGISTRO DE PROVEEDORES — la única puerta por la que se elige con qué se cobra.
 *
 * Ninguna pantalla ni endpoint importa `kushki` directamente: piden «el proveedor activo»
 * y reciben lo que haya configurado. Ese es el punto entero de la capa: el día que entren
 * PayPal, PayPhone o Binance —que Fernando ya anunció— se añaden aquí y los tres canales
 * de cobro no se enteran.
 */
import type { ProveedorDePago } from './tipos';
import { kushki } from './kushki';
import { simulado } from './simulado';

export * from './tipos';
export { calcularRecargo, tarifaDe, netoRecibido, TARIFAS, CONCEPTO_RECARGO } from './comision';

const PROVEEDORES: ProveedorDePago[] = [kushki, simulado];

export function proveedorPorNombre(nombre: string): ProveedorDePago {
  const p = PROVEEDORES.find(x => x.nombre === nombre);
  if (!p) throw new Error(`Proveedor de pago desconocido: ${nombre}`);
  return p;
}

/**
 * El proveedor con el que se cobra hoy.
 *
 * `PAGOS_PROVEEDOR` manda si está puesto; si no, gana el primero que tenga credenciales.
 * Sin ninguno disponible **lanza**, no devuelve un proveedor de mentira: un cobro que
 * parece funcionar sin pasarela detrás es peor que un error claro.
 */
export function proveedorActivo(): ProveedorDePago {
  const pedido = process.env.PAGOS_PROVEEDOR;
  if (pedido) {
    const p = proveedorPorNombre(pedido);
    if (!p.disponible()) {
      throw new Error(`El proveedor «${pedido}» está seleccionado pero no tiene credenciales configuradas.`);
    }
    return p;
  }
  const disponible = PROVEEDORES.find(p => p.disponible());
  if (!disponible) {
    throw new Error('No hay ninguna pasarela de pago configurada. El cobro en línea está apagado.');
  }
  return disponible;
}

/** Si hay pasarela, para poder esconder el botón en vez de enseñar uno que falla. */
export function hayPasarela(): boolean {
  try { proveedorActivo(); return true; } catch { return false; }
}
