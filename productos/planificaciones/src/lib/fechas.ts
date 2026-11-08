/**
 * FECHAS DE CALENDARIO. Todo lo que es «un día» (inicio y fin del PUD, de cada
 * semana) viaja como cadena `AAAA-MM-DD` y se guarda como `date`. Un `Date` de
 * JavaScript es un instante, y confundir las dos cosas ya costó cinco commits en
 * otro proyecto de la casa.
 */
export type Dia = string; // 'AAAA-MM-DD'

const p2 = (n: number) => String(n).padStart(2, '0');

/** Hoy en la zona horaria de la institución, como AAAA-MM-DD. */
export function hoyEn(zonaHoraria: string, ahora = new Date()): Dia {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Un `Date` de Postgres (columna `date`, que Prisma devuelve a medianoche UTC) → AAAA-MM-DD. */
export function aDia(d: Date): Dia {
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

/** AAAA-MM-DD → el `Date` que Prisma espera para una columna `date` (medianoche UTC). */
export function aFechaSql(dia: Dia): Date {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

export const esDia = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(aFechaSql(s).getTime());

export function sumarDias(dia: Dia, n: number): Dia {
  const d = aFechaSql(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return aDia(d);
}

/** 0 = domingo … 6 = sábado. */
export const diaSemanaDe = (dia: Dia) => aFechaSql(dia).getUTCDay();

/** El lunes de la semana de un día. */
export function lunesDe(dia: Dia): Dia {
  const ds = diaSemanaDe(dia);
  return sumarDias(dia, ds === 0 ? -6 : 1 - ds);
}

/**
 * El instante en que empezó la semana natural (lunes 0:00) en la zona de la
 * institución. Es contra lo que se cuenta el tope de generaciones.
 */
export function inicioDeSemanaEn(zonaHoraria: string, ahora = new Date()): Date {
  const lunes = lunesDe(hoyEn(zonaHoraria, ahora));
  // Desfase de la zona en ese día: se mira qué hora local es a la medianoche UTC
  // del lunes y se corrige. (Guayaquil: a las 0:00 UTC son las 19:00 del domingo,
  // así que la medianoche local llega 5 horas después.)
  const utc = aFechaSql(lunes);
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(utc);
  const v = (t: string) => Number(f.find((p) => p.type === t)!.value);
  const localComoUtc = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'));
  const desfase = localComoUtc - utc.getTime();
  return new Date(utc.getTime() - desfase);
}

/*
  FECHAS IGUALES EN EL SERVIDOR Y EN EL NAVEGADOR (2026-11-08, como Automatizaciones
  `lib/formato.ts`). Estas se pintan también en componentes de cliente (la galería de semanas,
  los campos): `toLocaleDateString` depende del ICU de cada lado y rompía la hidratación (#418).
  Se arman a mano con las partes numéricas del día, que no varían. El texto es el mismo de antes.
*/
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const partesUtc = (d: Date) => ({ a: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), s: d.getUTCDay() });
const dos = (n: number) => String(n).padStart(2, '0');

/** «lunes, 15 de septiembre de 2026», para las pantallas. */
export function fechaLarga(dia: Dia) {
  const p = partesUtc(aFechaSql(dia));
  return `${DIAS_SEMANA[p.s]}, ${p.d} de ${MESES[p.m]} de ${p.a}`;
}

/** «26 de mayo», como escribe la docente las fechas del formato. */
export function diaDeMes(dia: Dia | Date | null | undefined) {
  if (!dia) return '';
  const p = partesUtc(typeof dia === 'string' ? aFechaSql(dia) : dia);
  return `${p.d} de ${MESES[p.m]}`;
}

/** «15/09/2026». */
export function fechaCorta(dia: Dia | Date | null | undefined) {
  if (!dia) return '—';
  const p = partesUtc(typeof dia === 'string' ? aFechaSql(dia) : dia);
  return `${dos(p.d)}/${dos(p.m + 1)}/${p.a}`;
}

/** Un instante (creado_en) en la zona de la institución: «15/09/2026 14:30». */
export function instante(d: Date | string, zonaHoraria: string) {
  return new Date(d).toLocaleString('es-EC', {
    timeZone: zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
