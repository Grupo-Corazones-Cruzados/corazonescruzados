'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Users, UserRound, ChevronDown, ChevronLeft, ChevronRight, CalendarClock, ListTodo, GripVertical, MousePointerClick,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

type SelectedUser = { kind: 'candidate' | 'member'; id: string; name: string; email?: string };

/**
 * Sistema "Horario de Vida" (Controlador · Implementación). De aquí se obtienen los
 * criterios de talento del sujeto. UI: lista de usuarios (candidatos + miembros en
 * grupos colapsables) · panel de tareas (arrastrables, origen por definir) · calendario
 * horizontal por semana (hoy a la izquierda, días siguientes a la derecha). El horario
 * solo se habilita con un candidato/miembro seleccionado.
 */
export default function HorarioDeVidaSystem({ isAdmin }: { system?: any; isAdmin: boolean }) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [candOpen, setCandOpen] = useState(true);
  const [memOpen, setMemOpen] = useState(true);
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfDay(new Date()));

  const load = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([fetch('/api/admin/candidates'), fetch('/api/admin/team')]);
      const c = await cRes.json();
      const m = await mRes.json();
      setCandidates(c.data || []);
      setMembers((m.data || []).filter((x: any) => x.is_active));
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const today = startOfDay(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const enabled = !!selected;
  const nameOf = (u: any) => u.full_name || u.name || u.email || 'Usuario';

  const UserRow = ({ u, kind }: { u: any; kind: SelectedUser['kind'] }) => {
    const active = selected?.kind === kind && selected?.id === String(u.id);
    return (
      <button
        onClick={() => setSelected({ kind, id: String(u.id), name: nameOf(u), email: u.email })}
        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 border-l-2 transition-colors ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}
      >
        {u.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-digi-border shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-accent uppercase" style={mf}>{nameOf(u).charAt(0)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[12.5px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{nameOf(u)}</p>
          {u.email && <p className="text-[11px] text-digi-muted truncate" style={mf}>{u.email}</p>}
        </div>
      </button>
    );
  };

  const GroupHeader = ({ label, Icon, count, open, onToggle }: any) => (
    <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 bg-digi-dark border-b border-digi-border text-left">
      <Icon className="w-4 h-4 text-digi-muted shrink-0" />
      <span className="flex-1 text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>{label}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums bg-black/[0.05] text-digi-muted">{count}</span>
      <ChevronDown className={`w-4 h-4 text-digi-muted shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* ── Lista de usuarios (candidatos + miembros) ── */}
      <aside className="w-full lg:w-[260px] shrink-0 bg-digi-card border border-digi-border rounded-lg overflow-hidden">
        {/* Candidatos */}
        <GroupHeader label="Candidatos" Icon={UserRound} count={candidates.length} open={candOpen} onToggle={() => setCandOpen((o) => !o)} />
        {candOpen && (
          <div className="divide-y divide-digi-border/50">
            {candidates.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Sin candidatos.</p>
            ) : candidates.map((u) => <UserRow key={`c-${u.id}`} u={u} kind="candidate" />)}
          </div>
        )}
        {/* Miembros */}
        <GroupHeader label="Miembros" Icon={Users} count={members.length} open={memOpen} onToggle={() => setMemOpen((o) => !o)} />
        {memOpen && (
          <div className="divide-y divide-digi-border/50">
            {members.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Sin miembros.</p>
            ) : members.map((u) => <UserRow key={`m-${u.id}`} u={u} kind="member" />)}
          </div>
        )}
      </aside>

      {!enabled ? (
        /* Sin usuario seleccionado → horario deshabilitado */
        <div className="flex-1 min-w-0 w-full bg-digi-card border border-digi-border rounded-xl py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><MousePointerClick className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un candidato o miembro</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>El horario de vida se habilita al elegir un usuario de la lista. Podrás arrastrar tareas a su semana.</p>
        </div>
      ) : (
        <>
          {/* ── Panel de tareas ── */}
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

          {/* ── Calendario: vista horizontal por semana ── */}
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

            {/* Galería horizontal de días (hoy a la izquierda) */}
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
