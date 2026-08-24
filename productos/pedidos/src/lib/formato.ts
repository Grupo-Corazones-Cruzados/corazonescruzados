/**
 * Presentación numérica es-ES: miles con «.» y decimales con «,» ($1.234,56).
 * Fuente única — al mostrar cantidades en la interfaz se usan estos ayudantes,
 * nunca `.toFixed()` crudo.
 *
 * ⚠️ NO aplicar a lo que no es una cantidad (identificadores, años) ni a lo que
 * viaja a otro sistema (una hoja de cálculo o un JSON quieren punto decimal).
 */
const dosDecimales = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const entero = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

export const num2 = (v: unknown) => dosDecimales.format(Number(v ?? 0));
export const numEntero = (v: unknown) => entero.format(Number(v ?? 0));
export const dinero = (v: unknown, moneda = 'USD') =>
  moneda === 'USD' ? `$${num2(v)}` : `${num2(v)} ${moneda}`;
