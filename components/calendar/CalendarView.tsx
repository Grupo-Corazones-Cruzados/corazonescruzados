'use client';

import { useMemo } from 'react';
import type { EventInstance } from '@/lib/calendar/recurrence';
import { DAY_LABELS_ES_SHORT, colorForEvent } from '@/lib/calendar/recurrence';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

export type CalendarViewMode = 'month' | 'week' | 'day';

interface Props {
  view: CalendarViewMode;
  currentDate: Date;
  instances: EventInstance[];
  onDayClick: (date: Date) => void;
  onEventClick: (ev: EventInstance) => void;
}

const WEEK_HOUR_START = 7;
const WEEK_HOUR_END = 22;
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

function MonthView({ currentDate, instances, onDayClick, onEventClick }: Props) {
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
    <div className="border-2 border-digi-border bg-digi-darker">
      <div className="grid grid-cols-7 border-b-2 border-digi-border">
        {DAY_LABELS_ES_SHORT.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-[10px] text-accent-glow text-center border-r border-digi-border last:border-r-0"
            style={pf}
          >
            {label.toUpperCase()}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {cells.map((day, idx) => {
          const inMonth = day.getMonth() === currentDate.getMonth();
          const isToday = sameDay(day, today);
          const dayStart = startOfDay(day);
          const dayEnd = endOfDay(day);
          const dayEvents = instances
            .filter((ev) => ev.instanceEnd >= dayStart && ev.instanceStart <= dayEnd)
            .slice(0, 10);

          return (
            <div
              key={idx}
              onClick={() => onDayClick(day)}
              className={`min-h-[96px] p-1.5 border-r border-b border-digi-border last:border-r-0 cursor-pointer hover:bg-digi-dark/40 transition-colors ${
                inMonth ? '' : 'opacity-40'
              } ${isToday ? 'bg-accent/5' : ''}`}
            >
              <div
                className={`text-[10px] mb-1 ${isToday ? 'text-accent-glow' : 'text-digi-text'}`}
                style={pf}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((ev, i) => {
                  const proposed = ev.status === 'proposed';
                  return (
                    <div
                      key={`${ev.id}-${i}`}
                      onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                      className={`text-[9px] px-1 py-0.5 truncate border-l-2 hover:opacity-80 transition-opacity ${
                        proposed ? 'border-dashed italic opacity-75' : ''
                      }`}
                      style={{
                        ...mf,
                        borderLeftColor: proposed ? '#f59e0b' : colorForEvent(ev),
                        backgroundColor: proposed ? '#f59e0b20' : `${colorForEvent(ev)}20`,
                        color: '#e5e7eb',
                      }}
                      title={proposed ? `Propuesta: ${ev.title}` : ev.title}
                    >
                      {proposed && '⏳ '}
                      {!ev.all_day && formatTime(ev.instanceStart) + ' '}
                      {ev.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[9px] text-digi-muted px-1" style={pf}>
                    +{dayEvents.length - 3} más
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ currentDate, instances, onDayClick, onEventClick }: Props) {
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

  return (
    <div className="border-2 border-digi-border bg-digi-darker">
      <div className="grid" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
        <div className="border-r border-b-2 border-digi-border" />
        {weekDays.map((day) => {
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`px-2 py-2 text-center border-r border-b-2 border-digi-border last:border-r-0 cursor-pointer hover:bg-digi-dark/40 ${
                isToday ? 'bg-accent/5' : ''
              }`}
            >
              <div className="text-[9px] text-digi-muted" style={pf}>
                {DAY_LABELS_ES_SHORT[day.getDay()].toUpperCase()}
              </div>
              <div className={`text-sm ${isToday ? 'text-accent-glow' : 'text-digi-text'}`} style={pf}>
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>
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
            onDayClick={onDayClick}
            onEventClick={onEventClick}
          />
        ))}
      </div>
    </div>
  );
}

function DayView({ currentDate, instances, onDayClick, onEventClick }: Props) {
  const hours = Array.from({ length: WEEK_HOUR_END - WEEK_HOUR_START + 1 }, (_, i) => i + WEEK_HOUR_START);
  return (
    <div className="border-2 border-digi-border bg-digi-darker">
      <div className="grid" style={{ gridTemplateColumns: '56px 1fr' }}>
        <div className="border-r border-b-2 border-digi-border" />
        <div className="px-3 py-2 border-b-2 border-digi-border">
          <div className="text-[10px] text-accent-glow" style={pf}>
            {DAY_LABELS_ES_SHORT[currentDate.getDay()].toUpperCase()} {currentDate.getDate()}
          </div>
        </div>
      </div>
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
          onDayClick={onDayClick}
          onEventClick={onEventClick}
        />
      </div>
    </div>
  );
}

function DayColumn({
  day,
  instances,
  hours,
  onDayClick,
  onEventClick,
}: {
  day: Date;
  instances: EventInstance[];
  hours: number[];
  onDayClick: (d: Date) => void;
  onEventClick: (ev: EventInstance) => void;
}) {
  const dayStart = startOfDay(day);
  const dayEnd = endOfDay(day);
  const gridStart = WEEK_HOUR_START * 60;
  const gridEnd = (WEEK_HOUR_END + 1) * 60;

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
            onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
            className={`absolute left-1 right-1 px-1.5 py-1 text-[9px] overflow-hidden hover:opacity-80 transition-opacity border-l-2 ${
              proposed ? 'border-dashed' : ''
            }`}
            style={{
              ...mf,
              top,
              height,
              borderLeftColor: color,
              backgroundColor: `${color}30`,
              color: '#f3f4f6',
              outline: proposed ? `1px dashed ${color}80` : undefined,
            }}
            title={proposed ? `Propuesta: ${ev.title}` : ev.title}
          >
            <div className="font-semibold truncate">
              {proposed && '⏳ '}
              {ev.title}
            </div>
            <div className="text-[8px] opacity-70">
              {proposed && '(propuesta) · '}
              {formatTime(ev.instanceStart)} – {formatTime(ev.instanceEnd)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
