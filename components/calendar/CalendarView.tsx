'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import type { EventInstance } from '@/lib/calendar/recurrence';
import { DAY_LABELS_ES_SHORT, DAY_LABELS_ES_LONG, colorForEvent, EVENT_COLORS } from '@/lib/calendar/recurrence';

// Dashboard Fluent (.corp): ambas fuentes resuelven a Segoe UI. Se conserva el
// nombre `pf` por uso interno, pero apunta al cuerpo (no al pixel display).
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

export type CalendarViewMode = 'month' | 'week' | 'day';

interface Props {
  view: CalendarViewMode;
  currentDate: Date;
  instances: EventInstance[];
  // Clic para CREAR un evento (día/hora concretos): abre el formulario de nuevo evento.
  onDayClick: (date: Date) => void;
  // Clic para SELECCIONAR un día (encabezado/número): cambia el día enfocado, sin abrir formulario.
  onDaySelect?: (date: Date) => void;
  onEventClick: (ev: EventInstance) => void;
  // Clic sobre un bloque de tarea GENERADA por política (abre popover de estado).
  onGeneratedClick?: (ev: EventInstance, e: React.MouseEvent) => void;
  // Cuando es true, el calendario llena el alto de su contenedor y su cuerpo (grilla
  // de horas / mes) se desplaza internamente; el encabezado (días) queda fijo arriba.
  fillHeight?: boolean;
}

const WEEK_HOUR_START = 0;
const WEEK_HOUR_END = 23;
const HOUR_PX = 44;

export default function CalendarView(props: Props) {
  if (props.view === 'month') return <MonthView {...props} />;
  if (props.view === 'week') return <WeekView {...props} />;
  return <DayView {...props} />;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function endOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function formatTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Hora actual del miembro en Ecuador (America/Guayaquil, GMT-5, sin DST),
// independiente de la zona horaria del navegador del visitante.
type NowParts = { y: number; mo0: number; d: number; minutes: number };

function ecuadorNowParts(): NowParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Guayaquil',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const hour = get('hour') % 24;
  return { y: get('year'), mo0: get('month') - 1, d: get('day'), minutes: hour * 60 + get('minute') };
}

// null hasta montar (evita desajuste de hidratación SSR); luego refresca cada minuto.
function useEcuadorNow(): NowParts | null {
  const [now, setNow] = useState<NowParts | null>(null);
  useEffect(() => {
    setNow(ecuadorNowParts());
    const id = setInterval(() => setNow(ecuadorNowParts()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const NOW_COLOR = '#ef4444';

// Minutos por tipo dedicados a un día (porción de cada evento dentro del día;
// excluye propuestas no confirmadas).
function dayTotals(instances: EventInstance[], day: Date): { work: number; personal: number } {
  const ds = startOfDay(day).getTime();
  const de = endOfDay(day).getTime() + 1;
  let work = 0;
  let personal = 0;
  for (const ev of instances) {
    if (ev.status === 'proposed' || ev.generated) continue; // las tareas de política no cuentan como horas
    const s = Math.max(ev.instanceStart.getTime(), ds);
    const e = Math.min(ev.instanceEnd.getTime(), de);
    if (e <= s) continue;
    const minutes = (e - s) / 60000;
    if (ev.event_type === 'progreso') work += minutes;
    else personal += minutes;
  }
  return { work: Math.round(work), personal: Math.round(personal) };
}

function fmtDur(min: number): string {
  if (min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}`;
}

function DayTotals({ totals }: { totals: { work: number; personal: number } }) {
  if (totals.work <= 0 && totals.personal <= 0) return null;
  return (
    <div className="flex items-center gap-1.5 text-[8px] leading-none" style={pf}>
      {totals.work > 0 && (
        <span className="flex items-center gap-0.5" style={{ color: EVENT_COLORS.progreso }}>
          <span className="w-1.5 h-1.5" style={{ backgroundColor: EVENT_COLORS.progreso }} />
          {fmtDur(totals.work)}
        </span>
      )}
      {totals.personal > 0 && (
        <span className="flex items-center gap-0.5" style={{ color: EVENT_COLORS.personal }}>
          <span className="w-1.5 h-1.5" style={{ backgroundColor: EVENT_COLORS.personal }} />
          {fmtDur(totals.personal)}
        </span>
      )}
    </div>
  );
}

function MonthView({ currentDate, instances, onDayClick, onDaySelect, onEventClick, onGeneratedClick, fillHeight }: Props) {
  const cells = useMemo(() => {
    const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const today = new Date();

  return (
    <div className={`border border-digi-border rounded-lg overflow-hidden bg-digi-card ${fillHeight ? 'h-full flex flex-col' : ''}`}>
      <div className="grid grid-cols-7 border-b border-digi-border bg-digi-dark shrink-0">
        {DAY_LABELS_ES_SHORT.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-[11px] font-semibold text-digi-muted text-center border-r border-digi-border last:border-r-0"
            style={mf}
          >
            {label}
          </div>
        ))}
      </div>
      <div className={fillHeight ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
      <div className={`grid grid-cols-7 grid-rows-6 ${fillHeight ? 'min-h-full' : ''}`}>
        {cells.map((day, idx) => {
          const inMonth = day.getMonth() === currentDate.getMonth();
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, currentDate);
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const dayEvents = instances
            .filter((ev) => ev.instanceEnd >= dayStart && ev.instanceStart <= dayEnd)
            .slice(0, 10);

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`min-h-[104px] p-1.5 border-r border-b border-digi-border last:border-r-0 cursor-pointer transition-colors ${
                inMonth ? 'hover:bg-black/[0.02]' : 'bg-digi-dark/60 text-digi-muted'
              } ${isToday ? 'bg-accent-light/50' : ''} ${isSelected && !isToday ? 'ring-1 ring-accent ring-inset' : ''}`}
            >
              {/* Clic en el encabezado (número + horas) = SELECCIONAR el día; el resto de la celda crea evento. */}
              <div
                className="flex items-center justify-between gap-1 mb-1 -mx-0.5 px-0.5 rounded hover:bg-accent/10"
                onClick={(e) => { e.stopPropagation(); (onDaySelect || onDayClick)(day); }}
                title="Seleccionar este día"
              >
                <span
                  className={`inline-flex items-center justify-center text-[11px] tabular-nums ${
                    isToday ? 'w-5 h-5 rounded-full bg-accent text-white font-semibold' : inMonth ? 'text-digi-text' : 'text-digi-muted'
                  }`}
                  style={mf}
                >
                  {day.getDate()}
                </span>
                <DayTotals totals={dayTotals(instances, day)} />
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev, i) => {
                  const proposed = ev.status === 'proposed';
                  return (
                    <div
                      key={`${ev.id}-${i}`}
                      onClick={(e) => { e.stopPropagation(); if (ev.generated && onGeneratedClick) onGeneratedClick(ev, e); else onEventClick(ev); }}
                      className={`text-[10.5px] px-1.5 py-0.5 rounded-[3px] truncate border-l-[3px] hover:opacity-80 transition-opacity ${
                        proposed ? 'border-dashed italic' : ev.generated ? 'border-dashed' : ''
                      }`}
                      style={{
                        ...mf,
                        borderLeftColor: proposed ? '#d97706' : colorForEvent(ev),
                        backgroundColor: proposed ? '#f59e0b1f' : `${colorForEvent(ev)}1f`,
                        color: 'var(--color-digi-text)',
                      }}
                      title={proposed ? `Propuesta: ${ev.title}` : ev.title}
                    >
                      {!ev.all_day && <span className="text-digi-muted tabular-nums">{formatTime(ev.instanceStart)} </span>}
                      {ev.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-digi-muted px-1 font-medium" style={mf}>
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function WeekView({ currentDate, instances, onDayClick, onDaySelect, onEventClick, onGeneratedClick, fillHeight }: Props) {
  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const hours = Array.from({ length: WEEK_HOUR_END - WEEK_HOUR_START + 1 }, (_, i) => i + WEEK_HOUR_START);
  const today = new Date();
  const now = useEcuadorNow();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Al mostrar el calendario acotado, arranca el scroll en la mañana (07:00) en vez de 00:00.
  useEffect(() => { if (fillHeight && scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX; }, [fillHeight]);

  return (
    <div className={`border border-digi-border rounded-lg overflow-hidden bg-digi-card ${fillHeight ? 'h-full flex flex-col' : ''}`}>
      <div className="grid shrink-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-b border-digi-border bg-digi-dark" />
        {weekDays.map((day) => {
          const isToday = sameDay(day, today);
          const isSelected = sameDay(day, currentDate);
          return (
            <div
              key={day.toISOString()}
              onClick={() => (onDaySelect || onDayClick)(day)}
              title="Seleccionar este día"
              className={`px-2 py-2 text-center border-r border-b border-digi-border last:border-r-0 cursor-pointer transition-colors ${
                isToday ? 'bg-accent-light/50' : isSelected ? 'bg-accent-light/30' : 'bg-digi-dark hover:bg-black/[0.02]'
              } ${isSelected && !isToday ? 'ring-1 ring-accent ring-inset' : ''}`}
            >
              <div className="text-[10px] font-semibold text-digi-muted" style={mf}>
                {DAY_LABELS_ES_SHORT[day.getDay()]}
              </div>
              <div className={`inline-flex items-center justify-center mt-0.5 text-[14px] tabular-nums ${isToday ? 'w-6 h-6 rounded-full bg-accent text-white font-semibold' : 'text-digi-text'}`} style={mf}>
                {day.getDate()}
              </div>
              <div className="flex justify-center mt-0.5">
                <DayTotals totals={dayTotals(instances, day)} />
              </div>
            </div>
          );
        })}
      </div>
      <div ref={scrollRef} className={fillHeight ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
      <div className="grid relative" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-digi-border">
          {hours.map((h) => (
            <div
              key={h}
              className="text-[9px] text-digi-muted px-1 text-right border-b border-digi-border/50"
              style={{ height: HOUR_PX, ...mf }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {weekDays.map((day) => (
          <DayColumn
            key={day.toISOString()}
            day={day}
            instances={instances}
            hours={hours}
            now={now}
            onDayClick={onDayClick}
            onEventClick={onEventClick}
            onGeneratedClick={onGeneratedClick}
          />
        ))}
      </div>
      </div>
    </div>
  );
}

function DayView({ currentDate, instances, onDayClick, onEventClick, onGeneratedClick, fillHeight }: Props) {
  const hours = Array.from({ length: WEEK_HOUR_END - WEEK_HOUR_START + 1 }, (_, i) => i + WEEK_HOUR_START);
  const now = useEcuadorNow();
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (fillHeight && scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_PX; }, [fillHeight]);
  return (
    <div className={`border border-digi-border rounded-lg overflow-hidden bg-digi-card ${fillHeight ? 'h-full flex flex-col' : ''}`}>
      <div className="grid shrink-0" style={{ gridTemplateColumns: '56px 1fr' }}>
        <div className="border-r border-b border-digi-border bg-digi-dark" />
        <div className="px-3 py-2 border-b border-digi-border bg-digi-dark flex items-center justify-between gap-2">
          <div className="text-[13px] font-semibold text-digi-text capitalize" style={mf}>
            {DAY_LABELS_ES_LONG[currentDate.getDay()]} {currentDate.getDate()}
          </div>
          <DayTotals totals={dayTotals(instances, currentDate)} />
        </div>
      </div>
      <div ref={scrollRef} className={fillHeight ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
      <div className="grid" style={{ gridTemplateColumns: '56px 1fr' }}>
        <div className="border-r border-digi-border">
          {hours.map((h) => (
            <div
              key={h}
              className="text-[9px] text-digi-muted px-1 text-right border-b border-digi-border/50"
              style={{ height: HOUR_PX, ...mf }}
            >
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        <DayColumn
          day={currentDate}
          instances={instances}
          hours={hours}
          now={now}
          onDayClick={onDayClick}
          onEventClick={onEventClick}
          onGeneratedClick={onGeneratedClick}
        />
      </div>
      </div>
    </div>
  );
}

function DayColumn({
  day,
  instances,
  hours,
  now,
  onDayClick,
  onEventClick,
  onGeneratedClick,
}: {
  day: Date;
  instances: EventInstance[];
  hours: number[];
  now?: NowParts | null;
  onDayClick: (d: Date) => void;
  onEventClick: (ev: EventInstance) => void;
  onGeneratedClick?: (ev: EventInstance, e: React.MouseEvent) => void;
}) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const gridStart = WEEK_HOUR_START * 60;
  const gridEnd = (WEEK_HOUR_END + 1) * 60;

  const showNow =
    !!now &&
    day.getFullYear() === now.y &&
    day.getMonth() === now.mo0 &&
    day.getDate() === now.d &&
    now.minutes >= gridStart &&
    now.minutes <= gridEnd;
  const nowTop = showNow ? ((now!.minutes - gridStart) / 60) * HOUR_PX : 0;

  const dayEvents = instances.filter((ev) => ev.instanceEnd >= dayStart && ev.instanceStart <= dayEnd);

  const handleBgClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const totalMin = gridStart + (y / HOUR_PX) * 60;
    const slot = new Date(day);
    slot.setHours(Math.floor(totalMin / 60), Math.round((totalMin % 60) / 15) * 15, 0, 0);
    onDayClick(slot);
  };

  return (
    <div
      className="relative border-r border-digi-border last:border-r-0 cursor-pointer"
      style={{ height: hours.length * HOUR_PX }}
      onClick={handleBgClick}
    >
      {hours.map((h) => (
        <div
          key={h}
          className="border-b border-digi-border/50"
          style={{ height: HOUR_PX }}
        />
      ))}
      {dayEvents.map((ev, i) => {
        const startMin = Math.max(
          gridStart,
          ev.instanceStart < dayStart
            ? gridStart
            : ev.instanceStart.getHours() * 60 + ev.instanceStart.getMinutes(),
        );
        const endMin = Math.min(
          gridEnd,
          ev.instanceEnd > dayEnd
            ? gridEnd
            : ev.instanceEnd.getHours() * 60 + ev.instanceEnd.getMinutes(),
        );
        if (endMin <= startMin) return null;
        const top = ((startMin - gridStart) / 60) * HOUR_PX;
        const height = Math.max(18, ((endMin - startMin) / 60) * HOUR_PX - 2);
        const proposed = ev.status === 'proposed';
        const color = proposed ? '#f59e0b' : colorForEvent(ev);
        return (
          <div
            key={`${ev.id}-${i}`}
            onClick={(e) => { e.stopPropagation(); if (ev.generated && onGeneratedClick) onGeneratedClick(ev, e); else onEventClick(ev); }}
            className={`absolute left-1 right-1 px-1.5 py-1 text-[10.5px] rounded-[4px] overflow-hidden hover:opacity-90 transition-opacity border-l-[3px] ${
              proposed ? 'border-dashed italic' : ev.generated ? 'border-dashed' : ''
            }`}
            style={{
              ...mf,
              top,
              height,
              borderLeftColor: color,
              backgroundColor: `${color}24`,
              color: 'var(--color-digi-text)',
            }}
            title={proposed ? `Propuesta: ${ev.title}` : ev.title}
          >
            <div className="font-semibold truncate">{ev.title}</div>
            <div className="text-[9.5px] text-digi-muted tabular-nums truncate">
              {proposed && '(propuesta) · '}
              {formatTime(ev.instanceStart)} – {formatTime(ev.instanceEnd)}
            </div>
          </div>
        );
      })}
      {showNow && (
        <div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ top: nowTop, height: 0, zIndex: 30 }}
        >
          <span
            className="absolute -left-[3px] -top-[4px] w-2 h-2 rounded-full"
            style={{ backgroundColor: NOW_COLOR, boxShadow: `0 0 5px ${NOW_COLOR}` }}
          />
          <div
            style={{
              borderTop: `2px dashed ${NOW_COLOR}`,
              filter: `drop-shadow(0 0 3px ${NOW_COLOR})`,
            }}
          />
        </div>
      )}
    </div>
  );
}
