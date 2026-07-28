export type EventType = 'progreso' | 'personal';
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';
export type EventStatus = 'confirmed' | 'proposed' | 'cancelled';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  client_id: string | null;
  client_name: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  recurrence_type: RecurrenceType;
  recurrence_days: number[] | null;
  recurrence_interval: number;
  recurrence_until: string | null;
  color: string | null;
  status: EventStatus;
  alternative_id?: number | null; // tarea del Horario de Vida que justifica el evento
  meeting_url?: string | null; // enlace de reunión (Google Meet) si se agendó desde el calendario público
  meeting_provider?: string | null;
}

export interface EventInstance extends CalendarEvent {
  instanceStart: Date;
  instanceEnd: Date;
  isRecurring: boolean;
  // Bloque SINTÉTICO de una TAREA (no es un evento real del calendario): se pinta punteado en
  // la grilla con color según su estado, no cuenta en las horas del día, y su clic abre un
  // popover para marcarlo (nunca el editor de eventos).
  // `generated` = "es un bloque sintético"; `taskKind` dice de qué sistema viene.
  generated?: boolean;
  generatedId?: number;
  generatedStatus?: 'pending' | 'completed' | 'failed';
  /** Origen del bloque: política de Comandos Violeta o evento de Gestión Social. */
  taskKind?: 'policy' | 'social';
  /** Solo `social`: el evento aún no ha iniciado (o ya terminó) → no se puede marcar. */
  socialLocked?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HARD_LIMIT = 500;

/**
 * Normaliza `recurrence_until` a `'YYYY-MM-DD'`.
 *
 * La columna es `date`, pero el driver de pg la convierte en `Date` y `NextResponse.json`
 * la serializa como timestamp ISO completo (`'2026-07-21T05:00:00.000Z'`). Concatenarle
 * `'T23:59:59'` daba **Invalid Date** → `stopTs` = NaN → toda comparación falsa → el evento
 * recurrente con fecha fin **no generaba NI UNA instancia** (desaparecía del calendario y de
 * la detección de solapes). Por eso se normaliza aquí, y las rutas devuelven ya `YYYY-MM-DD`.
 */
export function toDateOnly(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const p = (n: number) => String(n).padStart(2, '0');
    return `${value.getFullYear()}-${p(value.getMonth() + 1)}-${p(value.getDate())}`;
  }
  const s = String(value).trim();
  // Se toma el prefijo de fecha tal cual: un `date` de Postgres nace a medianoche LOCAL,
  // así que su ISO conserva el mismo día en cualquier zona al oeste de UTC (la app es
  // America/Guayaquil). Nunca se pasa por `new Date()`, que restaría un día al parsear
  // 'YYYY-MM-DD' como UTC.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  return m ? m[1] : null;
}

/** Fin del día local de `recurrence_until`, o +∞ si el evento se repite «Siempre». */
function untilTimestamp(value: string | null | undefined): number {
  const day = toDateOnly(value);
  if (!day) return Number.POSITIVE_INFINITY;
  const ts = new Date(`${day}T23:59:59.999`).getTime();
  return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
}

export function expandEvents(
  events: CalendarEvent[],
  rangeStart: Date,
  rangeEnd: Date,
): EventInstance[] {
  const out: EventInstance[] = [];
  for (const ev of events) {
    const start = new Date(ev.start_at);
    const end = new Date(ev.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const duration = Math.max(0, end.getTime() - start.getTime());

    if (ev.recurrence_type === 'none') {
      if (overlaps(start, end, rangeStart, rangeEnd)) {
        out.push(instance(ev, start, end, false));
      }
      continue;
    }

    const untilTs = untilTimestamp(ev.recurrence_until);
    const stopTs = Math.min(untilTs, rangeEnd.getTime());
    const interval = ev.recurrence_interval > 0 ? ev.recurrence_interval : 1;

    if (ev.recurrence_type === 'daily') {
      const step = interval * DAY_MS;
      let cursor = new Date(start);
      // Salto directo al rango pedido: iterar día a día desde `start_at` agotaba HARD_LIMIT
      // ~500 días después del inicio y el evento diario «Siempre» dejaba de pintarse a partir
      // de ahí, aunque la ventana visible fueran 42 días.
      if (cursor.getTime() + duration < rangeStart.getTime()) {
        const skip = Math.floor((rangeStart.getTime() - duration - cursor.getTime()) / step);
        if (skip > 0) cursor = new Date(cursor.getTime() + skip * step);
      }
      let n = 0;
      while (cursor.getTime() <= stopTs && n < HARD_LIMIT) {
        const iEnd = new Date(cursor.getTime() + duration);
        if (iEnd.getTime() >= rangeStart.getTime()) {
          out.push(instance(ev, new Date(cursor), iEnd, true));
          n++;
        }
        cursor = new Date(cursor.getTime() + step);
      }
    } else if (ev.recurrence_type === 'weekly') {
      const days = ev.recurrence_days && ev.recurrence_days.length ? ev.recurrence_days : [start.getDay()];
      let weekStart = startOfWeek(start);
      let weekIndex = 0;
      // Mismo salto que en `daily`, respetando la fase del intervalo (`weekIndex` sigue
      // contando desde la semana de inicio, así que «cada 2 semanas» no se descuadra).
      const behind = Math.floor((rangeStart.getTime() - 7 * DAY_MS - weekStart.getTime()) / (7 * DAY_MS));
      if (behind > 0) {
        weekStart = new Date(weekStart.getTime() + behind * 7 * DAY_MS);
        weekIndex = behind;
      }
      let n = 0;
      while (weekStart.getTime() <= stopTs && n < HARD_LIMIT) {
        if (weekIndex % interval === 0) {
          for (const dow of days) {
            const occ = new Date(weekStart);
            occ.setDate(occ.getDate() + dow);
            occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
            if (occ.getTime() < start.getTime()) continue;
            if (occ.getTime() > stopTs) continue;
            const iEnd = new Date(occ.getTime() + duration);
            if (overlaps(occ, iEnd, rangeStart, rangeEnd)) {
              out.push(instance(ev, occ, iEnd, true));
              n++;
            }
          }
        }
        weekStart = new Date(weekStart.getTime() + 7 * DAY_MS);
        weekIndex++;
      }
    } else if (ev.recurrence_type === 'monthly') {
      let cursor = new Date(start);
      let n = 0;
      while (cursor.getTime() <= stopTs && n < HARD_LIMIT) {
        const iEnd = new Date(cursor.getTime() + duration);
        if (overlaps(cursor, iEnd, rangeStart, rangeEnd)) {
          out.push(instance(ev, new Date(cursor), iEnd, true));
        }
        const next = new Date(cursor);
        next.setMonth(next.getMonth() + interval);
        cursor = next;
        n++;
      }
    }
  }
  return out.sort((a, b) => a.instanceStart.getTime() - b.instanceStart.getTime());
}

function instance(ev: CalendarEvent, s: Date, e: Date, recurring: boolean): EventInstance {
  return { ...ev, instanceStart: s, instanceEnd: e, isRecurring: recurring };
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aEnd.getTime() >= bStart.getTime() && aStart.getTime() <= bEnd.getTime();
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

export const EVENT_COLORS: Record<EventType, string> = {
  progreso: '#7B5FBF',
  personal: '#22c55e',
};

export const EVENT_TYPE_LABELS_ES: Record<EventType, string> = {
  progreso: 'Progreso',
  personal: 'Personal',
};

export function colorForEvent(ev: CalendarEvent): string {
  if (ev.color) return ev.color;
  return EVENT_COLORS[ev.event_type] || EVENT_COLORS.personal;
}

export const DAY_LABELS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_LABELS_ES_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_LABELS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
