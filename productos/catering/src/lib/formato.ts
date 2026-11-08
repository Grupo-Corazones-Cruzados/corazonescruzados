/**
 * Presentación numérica es-ES: miles con «.» y decimales con «,» ($1.234,56).
 * Fuente única — al mostrar cantidades en la interfaz se usan estos ayudantes,
 * nunca `.toFixed()` crudo.
 *
 * ⚠️ NO aplicar a lo que no es una cantidad (identificadores, años) ni a lo que
 * viaja a otro sistema (una hoja de cálculo o un JSON quieren punto decimal).
 *
 * Se arman A MANO (2026-11-08, como Automatizaciones): `Intl` agrupa distinto en Node y en
 * Chrome («1234» frente a «1.234») y un número pintado en los dos lados rompía la hidratación.
 */

/** Miles con «.» armados a mano: igual en Node y en Chrome. */
export const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const num2 = (v: unknown) => {
  const n = Number(v ?? 0);
  const [ent, dec] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${miles(Number(ent))},${dec}`;
};
export const numEntero = (v: unknown) => {
  const n = Math.round(Number(v ?? 0));
  return `${n < 0 ? '-' : ''}${miles(Math.abs(n))}`;
};
export const dinero = (v: unknown, moneda = 'USD') =>
  moneda === 'USD' ? `$${num2(v)}` : `${num2(v)} ${moneda}`;
