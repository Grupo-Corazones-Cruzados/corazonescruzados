import { expandEvents, type CalendarEvent } from './recurrence';

export interface OverlapCandidate {
  start_at: string;
  end_at: string;
  recurrence_type: CalendarEvent['recurrence_type'];
  recurrence_days: number[] | null;
  recurrence_interval: number;
  recurrence_until: string | null;
}

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

export function findOverlappingInstances(
  existing: CalendarEvent[],
  candidate: OverlapCandidate,
  excludeEventId?: string,
): { start: Date; end: Date } | null {
  const candStart = new Date(candidate.start_at);
  const candEnd = new Date(candidate.end_at);
  if (Number.isNaN(candStart.getTime()) || Number.isNaN(candEnd.getTime())) return null;

  const rangeStart = new Date(Math.min(candStart.getTime(), Date.now()));
  const candidateUntilMs = candidate.recurrence_until
    ? new Date(`${candidate.recurrence_until}T23:59:59`).getTime()
    : candStart.getTime() + SIX_MONTHS_MS;
  const rangeEnd = new Date(Math.max(candEnd.getTime(), candidateUntilMs) + 1000);

  const existingInstances = expandEvents(
    existing.filter((e) => e.id !== excludeEventId && e.status !== 'cancelled'),
    rangeStart,
    rangeEnd,
  );

  const candidateAsEvent: CalendarEvent = {
    id: '__candidate__',
    title: '',
    description: null,
    event_type: 'work',
    client_id: null,
    client_name: null,
    start_at: candidate.start_at,
    end_at: candidate.end_at,
    all_day: false,
    timezone: 'America/Guayaquil',
    recurrence_type: candidate.recurrence_type,
    recurrence_days: candidate.recurrence_days,
    recurrence_interval: candidate.recurrence_interval,
    recurrence_until: candidate.recurrence_until,
    color: null,
    status: 'confirmed',
  };
  const candidateInstances = expandEvents([candidateAsEvent], rangeStart, rangeEnd);

  for (const ci of candidateInstances) {
    for (const ei of existingInstances) {
      if (ci.instanceEnd > ei.instanceStart && ci.instanceStart < ei.instanceEnd) {
        return { start: ci.instanceStart, end: ci.instanceEnd };
      }
    }
  }
  return null;
}
