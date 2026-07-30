/**
 * PROGRAMACIÓN de una campaña: una sola vez, o con frecuencia (cada N segundos / minutos /
 * horas / días / meses / años), con fecha de inicio y fecha de fin opcional.
 *
 * Módulo **puro** (sin `pg`, sin red): lo importan el endpoint, el cron y el navegador, así
 * que la vista previa de "próximos envíos" que ve el usuario sale del MISMO cálculo que usa
 * el disparador. Si divergieran, la pantalla mentiría.
 *
 * ⚠️ El disparador (cron de Railway) revisa **cada ~10 minutos**. Un intervalo por debajo de
 * eso —segundos, o "cada 2 minutos"— NO puede lanzarse más seguido: se lanzará como máximo
 * una vez por pase. Se permite configurarlo (la aritmética es la misma) pero la interfaz lo
 * advierte con `belowCronResolution()`, en vez de prometer algo que la plataforma no da.
 */

export type ScheduleKind = 'once' | 'recurring';
export type FreqUnit = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

/** Cada cuánto revisa el disparador, en milisegundos (cron de Railway cada 10 min). */
export const CRON_RESOLUTION_MS = 10 * 60 * 1000;

export interface FreqUnitInfo {
  value: FreqUnit;
  /** Singular / plural para armar frases: "cada 2 horas". */
  one: string;
  many: string;
}

export const FREQ_UNITS: FreqUnitInfo[] = [
  { value: 'second', one: 'segundo', many: 'segundos' },
  { value: 'minute', one: 'minuto', many: 'minutos' },
  { value: 'hour',   one: 'hora',   many: 'horas' },
  { value: 'day',    one: 'día',    many: 'días' },
  { value: 'month',  one: 'mes',    many: 'meses' },
  { value: 'year',   one: 'año',    many: 'años' },
];

export const MAX_INTERVAL = 999;

export function isFreqUnit(v: unknown): v is FreqUnit {
  return FREQ_UNITS.some((u) => u.value === v);
}

/** Duración fija de las unidades que no dependen del calendario. */
const FIXED_MS: Partial<Record<FreqUnit, number>> = {
  second: 1000,
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,   // Ecuador no tiene horario de verano: un día son 24 h exactas
};

/**
 * Ocurrencia número `count` (0 = la primera) contada **desde el inicio**, no desde la
 * anterior. Es a propósito: encadenar sumas arrastra el redondeo de los meses cortos (31 ene
 * → 28 feb → 28 mar → …) y la serie se desplaza sola. Anclando al inicio, "cada mes" desde el
 * 31 de enero da 28 feb, 31 mar, 30 abr… que es lo que espera cualquiera.
 */
export function occurrenceAt(start: Date | string, unit: FreqUnit, interval: number, count: number): Date {
  const s = new Date(start);
  const step = Math.max(1, Math.floor(interval));
  const n = Math.max(0, Math.floor(count));

  const fixed = FIXED_MS[unit];
  if (fixed) return new Date(s.getTime() + fixed * step * n);

  // Meses y años: aritmética de calendario, con el día recortado al último del mes destino.
  const months = (unit === 'year' ? 12 : 1) * step * n;
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth() + months;
  const targetY = y + Math.floor(m / 12);
  const targetM = ((m % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const day = Math.min(s.getUTCDate(), lastDay);
  return new Date(Date.UTC(
    targetY, targetM, day,
    s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds(), s.getUTCMilliseconds(),
  ));
}

export interface ScheduleSpec {
  kind: ScheduleKind;
  /** Primera salida; ancla de toda la serie. */
  start: Date | string;
  unit?: FreqUnit | null;
  interval?: number | null;
  /** Última fecha en la que puede lanzarse (inclusive). `null` = sin fin. */
  until?: Date | string | null;
}

/**
 * Siguiente salida después de haber lanzado `runCount` veces, o `null` si la serie terminó
 * (una sola vez ya lanzada, o la próxima cae después de la fecha de fin).
 *
 * Si se perdieron pases (el cron estuvo caído), avanza hasta la primera ocurrencia futura en
 * vez de disparar una ráfaga de atrasados.
 */
export function nextRunAfter(spec: ScheduleSpec, runCount: number, now: Date = new Date()): Date | null {
  const start = new Date(spec.start);
  const until = spec.until ? new Date(spec.until) : null;

  if (spec.kind === 'once') {
    if (runCount > 0) return null;
    return until && start.getTime() > until.getTime() ? null : start;
  }

  const unit = spec.unit && isFreqUnit(spec.unit) ? spec.unit : 'day';
  const interval = Math.max(1, Math.floor(Number(spec.interval) || 1));

  let n = Math.max(0, Math.floor(runCount));
  let candidate = occurrenceAt(start, unit, interval, n);

  // Tope de seguridad: con "cada segundo" y un cron caído meses, saltar de uno en uno sería
  // eterno. 500.000 iteraciones cubre cualquier caso real y corta cualquier bucle.
  let guard = 0;
  while (candidate.getTime() <= now.getTime() && guard++ < 500_000) {
    n += 1;
    candidate = occurrenceAt(start, unit, interval, n);
  }

  if (until && candidate.getTime() > until.getTime()) return null;
  return candidate;
}

/** Las próximas `howMany` salidas, para la vista previa del formulario. */
export function upcomingRuns(spec: ScheduleSpec, howMany = 4, from: Date = new Date()): Date[] {
  const out: Date[] = [];
  if (spec.kind === 'once') {
    const first = nextRunAfter(spec, 0, new Date(0));
    return first ? [first] : [];
  }
  const start = new Date(spec.start);
  const until = spec.until ? new Date(spec.until) : null;
  const unit = spec.unit && isFreqUnit(spec.unit) ? spec.unit : 'day';
  const interval = Math.max(1, Math.floor(Number(spec.interval) || 1));

  for (let n = 0; out.length < howMany && n < 10_000; n++) {
    const d = occurrenceAt(start, unit, interval, n);
    if (until && d.getTime() > until.getTime()) break;
    // La primera salida se muestra aunque sea "ahora mismo"; las siguientes, futuras.
    if (n === 0 || d.getTime() > from.getTime()) out.push(d);
  }
  return out;
}

/** "cada 2 horas" · "una sola vez". Para la barra de la campaña y los avisos. */
export function describeSchedule(spec: Pick<ScheduleSpec, 'kind' | 'unit' | 'interval'>): string {
  if (spec.kind === 'once') return 'una sola vez';
  const unit = spec.unit && isFreqUnit(spec.unit) ? spec.unit : 'day';
  const interval = Math.max(1, Math.floor(Number(spec.interval) || 1));
  const info = FREQ_UNITS.find((u) => u.value === unit)!;
  return interval === 1 ? `cada ${info.one}` : `cada ${interval} ${info.many}`;
}

/** true = el intervalo pedido es más fino de lo que el disparador puede cumplir. */
export function belowCronResolution(unit?: FreqUnit | null, interval?: number | null): boolean {
  if (!unit || !isFreqUnit(unit)) return false;
  const fixed = FIXED_MS[unit];
  if (!fixed) return false;   // meses y años nunca son un problema
  return fixed * Math.max(1, Math.floor(Number(interval) || 1)) < CRON_RESOLUTION_MS;
}

export class ScheduleError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

/** Valida y normaliza lo que llega del cliente. Lanza `ScheduleError` con mensaje en claro. */
export function parseScheduleInput(body: any): {
  kind: ScheduleKind; start: Date; unit: FreqUnit | null; interval: number | null; until: Date | null;
} {
  const kind: ScheduleKind = body?.kind === 'recurring' ? 'recurring' : 'once';

  const start = new Date(String(body?.scheduled_at || ''));
  if (Number.isNaN(start.getTime())) throw new ScheduleError('Fecha y hora de inicio inválidas');
  // Margen de un minuto: el cron revisa cada 10, no tiene sentido programar "hace un rato".
  if (start.getTime() < Date.now() - 60_000) throw new ScheduleError('Esa fecha y hora ya pasaron');

  let until: Date | null = null;
  if (body?.recur_until) {
    until = new Date(String(body.recur_until));
    if (Number.isNaN(until.getTime())) throw new ScheduleError('Fecha y hora de fin inválidas');
    if (until.getTime() <= start.getTime()) throw new ScheduleError('La fecha de fin debe ser posterior a la de inicio');
  }

  if (kind === 'once') return { kind, start, unit: null, interval: null, until };

  if (!isFreqUnit(body?.freq_unit)) throw new ScheduleError('Elige la frecuencia (hora, día, mes…)');
  const interval = Math.floor(Number(body?.freq_interval));
  if (!Number.isFinite(interval) || interval < 1) throw new ScheduleError('El intervalo debe ser 1 o más');
  if (interval > MAX_INTERVAL) throw new ScheduleError(`El intervalo no puede pasar de ${MAX_INTERVAL}`);

  return { kind, start, unit: body.freq_unit, interval, until };
}
