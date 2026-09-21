/**
 * FECHAS EN LA ZONA DEL INQUILINO.
 *
 * El servidor de Railway corre en UTC y el hotel está en Ecuador (UTC−5). Un
 * «día» calculado con `setHours(0,0,0,0)` en el servidor empieza cinco horas
 * antes que el del hotel, y eso fue lo que hizo que «Hoy» abriera el 19 siendo
 * 20 y que las flechas de la agenda no hicieran nada (caían en la misma
 * dirección). Regla: todo lo que es «un día» viaja como `AAAA-MM-DD`, y los
 * límites del día y el parseo de un `datetime-local` se hacen con la zona del
 * inquilino (`inquilino.zonaHoraria`), nunca con la del proceso.
 */

export type Dia = string; // 'AAAA-MM-DD'
export type FechaHora = string; // 'AAAA-MM-DDTHH:mm', lo que da un <input type="datetime-local">

const p2 = (n: number) => String(n).padStart(2, '0');

type Partes = { anio: number; mes: number; dia: number; hora: number; minuto: number };

/** Un instante, en piezas de reloj de pared de la zona dada. */
export function partesEnZona(instante: Date, zonaHoraria: string): Partes {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instante);
  const v = (t: string) => Number(f.find((p) => p.type === t)!.value);
  // A medianoche, `hour` en formato 24h puede venir como 24 en algunas implementaciones.
  return { anio: v('year'), mes: v('month'), dia: v('day'), hora: v('hour') % 24, minuto: v('minute') };
}

/**
 * El instante que corresponde a un reloj de pared de la zona. Se calcula el
 * desfase de la zona en ese momento y se corrige; una sola pasada basta salvo en
 * el propio salto de horario de verano, que Ecuador no tiene.
 */
export function instanteEnZona(
  anio: number,
  mes: number,
  dia: number,
  hora: number,
  minuto: number,
  zonaHoraria: string,
): Date {
  const supuesto = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const p = partesEnZona(new Date(supuesto), zonaHoraria);
  const leido = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  return new Date(supuesto - (leido - supuesto));
}

export const esDia = (s: unknown): s is Dia =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

export const esFechaHora = (s: unknown): s is FechaHora =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}:00Z`));

/** Hoy en la zona del inquilino. */
export function hoyEn(zonaHoraria: string, ahora = new Date()): Dia {
  const p = partesEnZona(ahora, zonaHoraria);
  return `${p.anio}-${p2(p.mes)}-${p2(p.dia)}`;
}

/** El día (AAAA-MM-DD) en el que cae un instante, en la zona. */
export function diaDe(instante: Date, zonaHoraria: string): Dia {
  return hoyEn(zonaHoraria, instante);
}

export function sumarDias(dia: Dia, n: number): Dia {
  const [a, m, d] = dia.split('-').map(Number);
  const x = new Date(Date.UTC(a, m - 1, d + n));
  return `${x.getUTCFullYear()}-${p2(x.getUTCMonth() + 1)}-${p2(x.getUTCDate())}`;
}

/** Primer día del mes de un día. */
export function primeroDelMes(dia: Dia): Dia {
  return `${dia.slice(0, 7)}-01`;
}

/** Medianoche del día, como instante, en la zona. */
export function inicioDelDiaEn(dia: Dia, zonaHoraria: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return instanteEnZona(a, m, d, 0, 0, zonaHoraria);
}

/** El último milisegundo del día, en la zona. */
export function finDelDiaEn(dia: Dia, zonaHoraria: string): Date {
  return new Date(inicioDelDiaEn(sumarDias(dia, 1), zonaHoraria).getTime() - 1);
}

/** 'AAAA-MM-DDTHH:mm' escrito en la zona → instante. `null` si no es una fecha. */
export function desdeCampoFechaHora(texto: string, zonaHoraria: string): Date | null {
  if (!esFechaHora(texto)) return null;
  const [dia, hm] = texto.split('T');
  const [a, m, d] = dia.split('-').map(Number);
  const [h, mi] = hm.split(':').map(Number);
  return instanteEnZona(a, m, d, h, mi, zonaHoraria);
}

/** Instante → 'AAAA-MM-DDTHH:mm' en la zona, para rellenar un <input type="datetime-local">. */
export function aCampoFechaHoraEn(instante: Date, zonaHoraria: string): FechaHora {
  const p = partesEnZona(instante, zonaHoraria);
  return `${p.anio}-${p2(p.mes)}-${p2(p.dia)}T${p2(p.hora)}:${p2(p.minuto)}`;
}

/**
 * Un `Date` cuyas piezas LOCALES son el reloj de pared de la zona. Sirve para
 * pasarle un instante a `format()` de date-fns en el servidor y que escriba la
 * hora del hotel, sea cual sea la zona del proceso.
 */
export function relojDePared(instante: Date, zonaHoraria: string): Date {
  const p = partesEnZona(instante, zonaHoraria);
  return new Date(p.anio, p.mes - 1, p.dia, p.hora, p.minuto, 0, 0);
}

/**
 * Lo mismo, pero con las piezas en UTC: es lo que ExcelJS convierte a fecha de
 * hoja de cálculo (usa los componentes UTC), así la celda dice la hora del hotel.
 */
export function relojDeParedUtc(instante: Date, zonaHoraria: string): Date {
  const p = partesEnZona(instante, zonaHoraria);
  return new Date(Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto));
}

// ── En el navegador ─────────────────────────────────────────────────────────

/** Fecha a lo que entiende un <input type="datetime-local">: AAAA-MM-DDTHH:mm (zona local del navegador). */
export function aCampoFechaHora(d: Date): FechaHora {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

/** Fecha a AAAA-MM-DD en la zona local del navegador. */
export function aCampoFecha(d: Date): Dia {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

/** 'AAAA-MM-DD' → `Date` a medianoche LOCAL del navegador, para etiquetas (día de la semana, número). */
export function diaLocal(dia: Dia): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d);
}
