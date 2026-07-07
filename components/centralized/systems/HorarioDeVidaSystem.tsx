'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarClock, ListTodo, GripVertical, MousePointerClick } from 'lucide-react';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Sistema "Horario de Vida" (Controlador · Implementación). Lista de usuarios
 * (candidatos+miembros) · panel de tareas (arrastrables, origen por definir) ·
 * calendario horizontal por semana (hoy a la izquierda). El horario se habilita
 * solo con un usuario seleccionado.
 */
export default function HorarioDeVidaSystem({ isAdmin: _isAdmin }: { system?: any; isAdmin: boolean }) {
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfDay(new Date()));

  const today = startOfDay(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const enabled = !!selected;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <UsersList selected={selected} onSelect={setSelected} className="w-full lg:w-[260px] shrink-0" />

      {!enabled ? (
        <div className="flex-1 min-w-0 w-full bg-digi-card border border-digi-border rounded-xl py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><MousePointerClick className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un candidato o miembro</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>El horario de vida se habilita al elegir un usuario de la lista. Podrás arrastrar tareas a su semana.</p>
        </div>
      ) : (
        <>
          {/* Panel de tareas */}
          <div className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-digi-dark border-b border-digi-border">
              <ListTodo className="w-4 h-4 text-digi-muted" />
              <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Tareas</span>
            </div>
            <div className="p-3">
              <div className="rounded-lg border border-dashed border-digi-border/80 bg-digi-darker/40 p-4 text-center">
                <GripVertical className="w-5 h-5 text-digi-muted/50 mx-auto mb-1.5" />
                <p className="text-[12px] text-digi-muted" style={mf}>Aquí aparecerán las tareas para arrastrarlas al horario.</p>
                <p className="text-[11px] text-digi-muted/70 mt-1" style={mf}>(Origen por definir)</p>
              </div>
            </div>
          </div>

          {/* Calendario horizontal por semana */}
          <div className="flex-1 min-w-0 w-full bg-digi-card border border-digi-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-digi-border">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarClock className="w-4 h-4 text-accent shrink-0" />
                <span className="text-[13px] font-semibold text-digi-text truncate" style={mf}>Horario de {selected.name}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setWeekStart(startOfDay(new Date()))} className="px-2.5 py-1.5 text-[12px] font-medium border border-digi-border rounded-md text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>Hoy</button>
                <button onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Semana anterior" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Semana siguiente" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="p-3 overflow-x-auto">
              <div className="flex gap-2 min-w-max">
                {days.map((d, i) => {
                  const isToday = sameDay(d, today);
                  return (
                    <div key={i} className="w-[150px] shrink-0 border border-digi-border rounded-lg overflow-hidden bg-digi-card">
                      <div className={`px-2 py-2 text-center border-b border-digi-border ${isToday ? 'bg-accent-light' : 'bg-digi-dark'}`}>
                        <div className="text-[10.5px] font-semibold text-digi-muted uppercase" style={mf}>{DAY_ABBR[d.getDay()]}{isToday ? ' · HOY' : ''}</div>
                        <div className={`text-[16px] tabular-nums leading-tight ${isToday ? 'text-accent font-bold' : 'text-digi-text'}`} style={mf}>{d.getDate()}</div>
                        <div className="text-[10px] text-digi-muted" style={mf}>{MONTH_ABBR[d.getMonth()]}</div>
                      </div>
                      <div className="min-h-[240px] p-2 flex items-center justify-center text-center">
                        <span className="text-[10.5px] text-digi-muted/50" style={mf}>Arrastra tareas aquí</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
