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
 * FECHAS IGUALES EN EL SERVIDOR Y EN EL NAVEGADOR (2026-11-08, como en Automatizaciones).
 *
 * `format()` de date-fns en un componente que se pinta en los dos lados escribe la hora de la
 * zona del PROCESO: el servidor corre en UTC y el navegador en la del hotel, así que React
 * rechazaba la hidratación (#418) y la hora salía cinco horas corrida en el primer pintado. Estas
 * se arman a mano con las partes numéricas en la zona del alojamiento, que no varían.
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function partes(fecha: string | Date, zona: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(fecha)).map((x) => [x.type, x.value]),
  );
  return { d: Number(p.day), m: Number(p.month), a: p.year, h: p.hour, min: p.minute };
}

/** «08/11/2026 05:20» */
export function fechaHora(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, a, h, min } = partes(fecha, zona);
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a} ${h}:${min}`;
}

/** «8 de noviembre de 2026» */
export function fechaLarga(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, a } = partes(fecha, zona);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}

/** «8 de noviembre, 14:00» */
export function diaYHora(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, h, min } = partes(fecha, zona);
  return `${d} de ${MESES[m - 1]}, ${h}:${min}`;
}

/** «8 nov» */
export function diaCorto(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m } = partes(fecha, zona);
  return `${d} ${MESES_CORTOS[m - 1]}`;
}

/** «07:49» */
export function horaCorta(fecha: string | Date, zona = 'America/Guayaquil') {
  const { h, min } = partes(fecha, zona);
  return `${h}:${min}`;
}

/** Miles con «.» armados a mano: igual en Node y en Chrome (los ICU agrupan distinto «1234»). */
export const miles = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
