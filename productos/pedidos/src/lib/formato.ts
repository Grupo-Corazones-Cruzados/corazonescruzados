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

/** «07:49» */
export function horaCorta(fecha: string | Date, zona = 'America/Guayaquil') {
  const { h, min } = partes(fecha, zona);
  return `${h}:${min}`;
}

/** «8/11/2026» */
export function fechaCorta(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, a } = partes(fecha, zona);
  return `${d}/${m}/${a}`;
}

/** «domingo 8 de noviembre» */
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export function diaConNombre(fecha: string | Date, zona = 'America/Guayaquil') {
  const { d, m, a } = partes(fecha, zona);
  const dia = DIAS[new Date(Date.UTC(Number(a), m - 1, d)).getUTCDay()];
  return `${dia} ${d} de ${MESES[m - 1]}`;
}

/**
 * EL «HOY» DEL NEGOCIO, como instantes (2026-11-08). El servidor corre en UTC: un `setHours(0)`
 * del proceso da el día de Greenwich, que en Ecuador empieza a las 19:00 del día anterior. Aquí
 * se toma la fecha en la zona del negocio y se devuelven su primer y su último milisegundo.
 * (El desfase se mide en el momento actual: vale para zonas sin cambio de hora ese día.)
 */
export function limitesDelDia(zona = 'America/Guayaquil', ahora = new Date()) {
  const { d, m, a, h, min } = partes(ahora, zona);
  const s = ahora.getUTCSeconds() * 1000 + ahora.getUTCMilliseconds();
  const desfase = Date.UTC(Number(a), m - 1, d, Number(h), Number(min)) + s - ahora.getTime();
  const desde = new Date(Date.UTC(Number(a), m - 1, d) - desfase);
  return { desde, hasta: new Date(desde.getTime() + 86400000 - 1) };
}
