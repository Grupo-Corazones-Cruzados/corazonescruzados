import type { DiaSemana } from '@/generated/prisma/enums';

/**
 * FECHAS DE CALENDARIO. Todo lo que es «un día» (menú, feriado, cancelación,
 * inicio del servicio) viaja como cadena `AAAA-MM-DD` y se guarda como `date`.
 * Un `Date` de JavaScript es un instante, y el proyecto de referencia pagó cinco
 * commits por confundir las dos cosas.
 */
export type Dia = string; // 'AAAA-MM-DD'

const p2 = (n: number) => String(n).padStart(2, '0');

/** Hoy en la zona horaria del negocio, como AAAA-MM-DD. */
export function hoyEn(zonaHoraria: string, ahora = new Date()): Dia {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** La hora (0–23) ahora mismo en la zona del negocio. */
export function horaEn(zonaHoraria: string, ahora = new Date()) {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: zonaHoraria, hour: '2-digit', hour12: false }).format(ahora);
  return Number(h) % 24;
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

const DIAS: DiaSemana[] = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

/** Qué día de la semana es un AAAA-MM-DD. */
export function diaSemanaDe(dia: Dia): DiaSemana {
  return DIAS[aFechaSql(dia).getUTCDay()];
}

/** Primer y último día del mes de un AAAA-MM-DD. */
export function mesDe(dia: Dia): { desde: Dia; hasta: Dia } {
  const [a, m] = dia.split('-').map(Number);
  return { desde: `${a}-${p2(m)}-01`, hasta: aDia(new Date(Date.UTC(a, m, 0))) };
}

/** «lunes 15 de septiembre de 2026», para las pantallas. */
export function fechaLarga(dia: Dia) {
  return aFechaSql(dia).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** «15/09/2026». */
export function fechaCorta(dia: Dia | Date | null | undefined) {
  if (!dia) return '—';
  const d = typeof dia === 'string' ? aFechaSql(dia) : dia;
  return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/** Un instante (creado_en) en la zona del negocio: «15/09/2026 14:30». */
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

/** Fecha a AAAA-MM-DD en la zona local del navegador (para valores por defecto de <input type="date">). */
export function aCampoFecha(d: Date) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
