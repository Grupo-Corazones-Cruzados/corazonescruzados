export type EventType = 'work' | 'personal';
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
}

export interface EventInstance extends CalendarEvent {
  instanceStart: Date;
  instanceEnd: Date;
  isRecurring: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HARD_LIMIT = 500;

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

    const untilTs = ev.recurrence_until
      ? new Date(`${ev.recurrence_until}T23:59:59`).getTime()
      : Number.POSITIVE_INFINITY;
    const stopTs = Math.min(untilTs, rangeEnd.getTime());
    const interval = ev.recurrence_interval > 0 ? ev.recurrence_interval : 1;

    if (ev.recurrence_type === 'daily') {
      let cursor = new Date(start);
      let n = 0;
      while (cursor.getTime() <= stopTs && n < HARD_LIMIT) {
        const iEnd = new Date(cursor.getTime() + duration);
        if (iEnd.getTime() >= rangeStart.getTime()) {
          out.push(instance(ev, new Date(cursor), iEnd, true));
        }
        cursor = new Date(cursor.getTime() + interval * DAY_MS);
        n++;
      }
    } else if (ev.recurrence_type === 'weekly') {
      const days = ev.recurrence_days && ev.recurrence_days.length ? ev.recurrence_days : [start.getDay()];
      let weekStart = startOfWeek(start);
      let weekIndex = 0;
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

export function colorForEvent(ev: CalendarEvent): string {
  if (ev.color) return ev.color;
  return ev.event_type === 'work' ? '#7B5FBF' : '#22c55e';
}

export const DAY_LABELS_ES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const DAY_LABELS_ES_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const MONTH_LABELS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
