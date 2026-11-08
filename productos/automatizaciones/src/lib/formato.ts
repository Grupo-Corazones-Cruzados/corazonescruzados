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

/**
 * FECHAS IGUALES EN EL SERVIDOR Y EN EL NAVEGADOR (2026-11-08).
 *
 * `toLocaleString('es-EC')` no sirve en un componente que se pinta en los dos lados: Node y
 * Chrome traen ICU distintos y escriben «a. m.» con espacios distintos, así que React rechaza
 * la hidratación (#418) aunque la zona sea la misma. Estas se arman a mano con las partes
 * numéricas, que no varían. Zona por defecto: la de los inquilinos actuales.
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function partes(fecha: string | Date, zona: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(fecha)).map((x) => [x.type, x.value]),
  );
  return { d: Number(p.day), m: Number(p.month), a: p.year, h: p.hour, min: p.minute };
}

/** «8/11/2026 05:20» */
export function fechaHora(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, a, h, min } = partes(fecha, zona);
  return `${d}/${m}/${a} ${h}:${min}`;
}

/** «8 de noviembre de 2026» */
export function fechaLarga(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, a } = partes(fecha, zona);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** Miles con «.» armados a mano: igual en Node y en Chrome (los ICU agrupan distinto «1234»). */
export const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
