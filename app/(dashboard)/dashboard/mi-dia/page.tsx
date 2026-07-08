'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BTN_SECONDARY } from '@/components/ui/Button';
import {
  ChevronLeft, ChevronRight, Plus, Share2, CalendarDays, ListTodo, Lock, Ticket, FolderKanban,
  Briefcase, Dumbbell, Brain, Users, CheckCircle2, XCircle,
} from 'lucide-react';
import CalendarView, { type CalendarViewMode } from '@/components/calendar/CalendarView';
import EventModal, { type EventFormPayload, type ClientOption, type TaskOption } from '@/components/calendar/EventModal';
import ShareDialog from '@/components/calendar/ShareDialog';
import ProposalsPanel from '@/components/calendar/ProposalsPanel';
import {
  type CalendarEvent, type EventInstance, type EventType,
  expandEvents, MONTH_LABELS_ES, EVENT_COLORS,
} from '@/lib/calendar/recurrence';
import { type AvailabilityStatus, AVAILABILITY, AVAILABILITY_ORDER } from '@/lib/calendar/availability';
import { DIMENSION_COLOR, DIMENSION_LABEL } from '@/lib/centralized/apoyo';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const VIEWS: { value: CalendarViewMode; label: string }[] = [
  { value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'day', label: 'Día' },
];
const DIM_ICON: Record<string, any> = { laboral: Briefcase, corporal: Dumbbell, mental: Brain, social: Users };
const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayHeader = (ds: string) => { const d = new Date(`${ds}T00:00:00`); return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_LABELS_ES[d.getMonth()].slice(0, 3)}`; };

type Status = 'pending' | 'completed' | 'failed';
interface HTask { id: number; title: string; problems: { dimension: string | null }[]; values: string[]; talents: string[]; link: { source: 'ticket' | 'project'; title: string } | null }
interface Horario { subject: { kind: string; id: string } | null; tasks: HTask[]; schedule: { id: number; alternativeId: number; day: string; status: Status }[]; auto: { alternativeId: number; day: string; source: 'ticket' | 'project'; refTitle: string; status: Status }[] }

/**
 * "Mi día": el calendario del miembro (mes/semana/día, mismo que estaba en Configuración)
 * + un rail de las tareas planificadas según el Horario de Vida para el día enfocado. Al
 * crear un evento se puede elegir una tarea para justificar el tiempo (evento = inicio→fin).
 */
export default function MiDiaPage() {
  const [view, setView] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [horario, setHorario] = useState<Horario>({ subject: null, tasks: [], schedule: [], auto: [] });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [initialType, setInitialType] = useState<EventType>('work');
  const [initialTaskId, setInitialTaskId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityStatus>('conectado');
  const [savingAvail, setSavingAvail] = useState(false);

  const range = useMemo(() => {
    if (view === 'month') {
      const s = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      s.setDate(1 - s.getDay()); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(s.getDate() + 42);
      return { s, e };
    }
    if (view === 'week') {
      const s = new Date(currentDate); s.setDate(s.getDate() - s.getDay()); s.setHours(0, 0, 0, 0);
      const e = new Date(s); e.setDate(s.getDate() + 7);
      return { s, e };
    }
    const s = new Date(currentDate); s.setHours(0, 0, 0, 0);
    const e = new Date(s); e.setDate(s.getDate() + 1);
    return { s, e };
  }, [view, currentDate]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [evRes, clRes, avRes] = await Promise.all([
        fetch('/api/members/calendar/events'),
        fetch('/api/clients'),
        fetch('/api/members/calendar/availability'),
      ]);
      const evData = await evRes.json();
      const clData = await clRes.json();
      setEvents(evData.data || []);
      setClients((clData.data || []).map((c: any) => ({ id: c.id, name: c.name })));
      if (avRes.ok) { const av = await avRes.json(); if (av.status) setAvailability(av.status); }
    } catch { toast.error('Error al cargar el calendario'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadHorario = useCallback(async () => {
    const from = ymd(range.s), to = ymd(range.e);
    try {
      const res = await fetch(`/api/centralized/horario/me?from=${from}&to=${to}`);
      const d = await res.json();
      setHorario(d.data || { subject: null, tasks: [], schedule: [], auto: [] });
    } catch { /* deja lo que haya */ }
  }, [range.s, range.e]);
  useEffect(() => { loadHorario(); }, [loadHorario]);

  const instances: EventInstance[] = useMemo(() => expandEvents(events, range.s, range.e), [events, range]);
  const taskById = useMemo(() => new Map(horario.tasks.map((t) => [t.id, t])), [horario.tasks]);
  const taskOptions: TaskOption[] = useMemo(() => horario.tasks.map((t) => ({ id: t.id, title: t.title })), [horario.tasks]);

  // Tareas del RANGO de la vista (mes/semana/día), agrupadas por día.
  const rangeGroups = useMemo(() => {
    const from = ymd(range.s), to = ymd(range.e); // [from, to)
    const inRange = (ds: string) => ds >= from && ds < to;
    const byDay = new Map<string, { key: string; alternativeId: number; status: Status; auto: boolean; source?: 'ticket' | 'project'; refTitle?: string }[]>();
    const add = (ds: string, item: any) => { const a = byDay.get(ds) || []; a.push(item); byDay.set(ds, a); };
    for (const e of horario.schedule) if (inRange(e.day)) add(e.day, { key: `m-${e.id}`, alternativeId: e.alternativeId, status: e.status, auto: false });
    for (const e of horario.auto) if (inRange(e.day)) add(e.day, { key: `a-${e.alternativeId}-${e.day}`, alternativeId: e.alternativeId, status: e.status, auto: true, source: e.source, refTitle: e.refTitle });
    return Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, items]) => ({ day, items }));
  }, [horario, range]);
  const totalTasks = useMemo(() => rangeGroups.reduce((s, g) => s + g.items.length, 0), [rangeGroups]);

  // Eventos del rango de la vista, agrupados por día.
  const eventGroups = useMemo(() => {
    const byDay = new Map<string, EventInstance[]>();
    for (const ev of instances) { const ds = ymd(ev.instanceStart); const a = byDay.get(ds) || []; a.push(ev); byDay.set(ds, a); }
    return Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, items]) => ({ day, items: items.sort((a, b) => a.instanceStart.getTime() - b.instanceStart.getTime()) }));
  }, [instances]);
  const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const goPrev = () => { const d = new Date(currentDate); if (view === 'month') d.setMonth(d.getMonth() - 1); else if (view === 'week') d.setDate(d.getDate() - 7); else d.setDate(d.getDate() - 1); setCurrentDate(d); };
  const goNext = () => { const d = new Date(currentDate); if (view === 'month') d.setMonth(d.getMonth() + 1); else if (view === 'week') d.setDate(d.getDate() + 7); else d.setDate(d.getDate() + 1); setCurrentDate(d); };
  const goToday = () => setCurrentDate(new Date());

  const label = useMemo(() => {
    const m = MONTH_LABELS_ES[currentDate.getMonth()]; const y = currentDate.getFullYear();
    if (view === 'month') return `${m} ${y}`;
    if (view === 'week') { const s = new Date(currentDate); s.setDate(s.getDate() - s.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return `${s.getDate()} ${MONTH_LABELS_ES[s.getMonth()].slice(0, 3)} – ${e.getDate()} ${MONTH_LABELS_ES[e.getMonth()].slice(0, 3)} ${y}`; }
    return `${currentDate.getDate()} ${m} ${y}`;
  }, [view, currentDate]);

  const handleDayClick = (date: Date) => { setEditingEvent(null); setInitialDate(date); setInitialType('work'); setInitialTaskId(null); setCurrentDate(new Date(date)); setModalOpen(true); };
  const openNew = (type: EventType) => { setEditingEvent(null); setInitialDate(new Date()); setInitialType(type); setInitialTaskId(null); setModalOpen(true); };
  const openTaskEvent = (alternativeId: number, dayStr: string) => {
    const base = new Date(`${dayStr}T09:00:00`);
    setEditingEvent(null); setInitialDate(base); setInitialType('work'); setInitialTaskId(alternativeId); setModalOpen(true);
  };
  const handleEventClick = (inst: EventInstance) => { const full = events.find((e) => e.id === inst.id) || null; setEditingEvent(full); setInitialDate(null); setInitialTaskId(null); setModalOpen(true); };

  const handleSave = async (payload: EventFormPayload, id?: string) => {
    const res = await fetch(id ? `/api/members/calendar/events/${id}` : '/api/members/calendar/events', {
      method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Error al guardar'); }
    toast.success(id ? 'Evento actualizado' : 'Evento creado');
    await load();
  };
  const handleDelete = async (id: string) => { const res = await fetch(`/api/members/calendar/events/${id}`, { method: 'DELETE' }); if (!res.ok) { toast.error('Error al eliminar'); return; } toast.success('Evento eliminado'); await load(); };

  const changeAvailability = async (status: AvailabilityStatus) => {
    if (status === availability || savingAvail) return;
    setSavingAvail(true); const prev = availability; setAvailability(status);
    try {
      const res = await fetch('/api/members/calendar/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Error'); }
      toast.success(`Disponibilidad: ${AVAILABILITY[status].label}`); await load();
    } catch (err: any) { setAvailability(prev); toast.error(err?.message || 'Error'); }
    finally { setSavingAvail(false); }
  };

  return (
    <div>
      <h1 className="text-[20px] font-semibold text-digi-text inline-flex items-center gap-2 mb-3" style={df}><CalendarDays className="w-5 h-5 text-accent" /> Mi día</h1>
      <div className="flex flex-col xl:flex-row gap-4 items-start">
      {/* Panel izquierdo: eventos del rango de la vista + botón Nuevo */}
      <aside className="w-full xl:w-[260px] shrink-0 bg-digi-card border border-digi-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-digi-border">
          <CalendarDays className="w-4 h-4 text-digi-muted" />
          <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Eventos · {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}</span>
          <button onClick={() => openNew('work')} className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover transition-colors" style={mf}><Plus className="w-3 h-3" /> Nuevo</button>
        </div>
        <div className="p-2.5 space-y-3 max-h-[calc(100dvh-220px)] overflow-y-auto">
          {instances.length === 0 ? (
            <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Sin eventos en esta vista.</p>
          ) : (
            eventGroups.map((g) => (
              <div key={g.day}>
                {view !== 'day' && <p className="text-[10px] uppercase tracking-wide text-digi-muted mb-1.5 flex items-center gap-1.5" style={df}>{dayHeader(g.day)}{g.day === ymd(new Date()) && <span className="text-accent">· hoy</span>}</p>}
                <div className="space-y-1.5">
                  {g.items.map((ev) => {
                    const color = ev.color || EVENT_COLORS[ev.event_type];
                    return (
                      <button key={`${ev.id}-${ev.instanceStart.getTime()}`} onClick={() => handleEventClick(ev)}
                        className="w-full text-left rounded-lg border border-digi-border bg-digi-darker/40 hover:border-accent/50 transition-colors p-2 flex items-stretch gap-2">
                        <span className="w-1 rounded-full shrink-0" style={{ background: color }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-digi-text truncate leading-snug" style={mf}>{ev.title}</p>
                          <p className="text-[10.5px] text-digi-muted mt-0.5" style={mf}>{ev.all_day ? 'Todo el día' : `${fmtTime(ev.instanceStart)}–${fmtTime(ev.instanceEnd)}`}{ev.client_name ? ` · ${ev.client_name}` : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 min-w-0 w-full">
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
          {/* Command bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-digi-border">
            <div className="flex items-center gap-2">
              <button onClick={goToday} className={`${BTN_SECONDARY} !py-1.5`}>Hoy</button>
              <div className="flex items-center gap-1">
                <button onClick={goPrev} aria-label="Anterior" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={goNext} aria-label="Siguiente" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <span className="text-[15px] font-semibold text-digi-text capitalize ml-1" style={mf}>{label}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-digi-border overflow-hidden">
                {VIEWS.map((v) => (
                  <button key={v.value} onClick={() => setView(v.value)} className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${view === v.value ? 'bg-accent text-white' : 'text-digi-muted hover:bg-black/[0.03]'}`} style={mf}>{v.label}</button>
                ))}
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-digi-border pl-2.5 pr-1.5 py-1" title="Tu disponibilidad">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AVAILABILITY[availability].color }} />
                <select value={availability} disabled={savingAvail} onChange={(e) => changeAvailability(e.target.value as AvailabilityStatus)} className="bg-transparent text-[12.5px] text-digi-text focus:outline-none cursor-pointer disabled:opacity-50" style={mf} aria-label="Disponibilidad">
                  {AVAILABILITY_ORDER.map((s) => <option key={s} value={s}>{AVAILABILITY[s].label}</option>)}
                </select>
              </div>
              <button onClick={() => setShareOpen(true)} className={BTN_SECONDARY}><Share2 className="w-4 h-4" /> Compartir</button>
            </div>
          </div>

          {/* Grid */}
          <div className="p-3">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-digi-muted" style={mf}><CalendarDays className="w-4 h-4 animate-pulse" /> Cargando…</div>
            ) : (
              <CalendarView view={view} currentDate={currentDate} instances={instances} onDayClick={handleDayClick} onEventClick={handleEventClick} />
            )}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-digi-border text-[12px] text-digi-muted" style={mf}>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${EVENT_COLORS.work}30`, borderLeft: `3px solid ${EVENT_COLORS.work}` }} /> Laboral</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${EVENT_COLORS.personal}30`, borderLeft: `3px solid ${EVENT_COLORS.personal}` }} /> Personal</span>
            <span className="ml-auto tabular-nums">Zona horaria: América/Guayaquil (GMT-5)</span>
          </div>
        </div>

        <ProposalsPanel onDecision={load} />
      </div>

      {/* Rail: tareas planificadas del RANGO de la vista (Horario de Vida) */}
      <aside className="w-full xl:w-[280px] shrink-0 bg-digi-card border border-digi-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-digi-dark border-b border-digi-border">
          <ListTodo className="w-4 h-4 text-digi-muted" />
          <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Tareas · {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : 'Mes'}</span>
          <span className="ml-auto text-[11px] text-digi-muted tabular-nums" style={mf}>{totalTasks}</span>
        </div>
        <p className="text-[11px] text-digi-muted px-3 pt-2 leading-snug" style={mf}>Planificadas según tu Horario de Vida en <span className="text-digi-text font-medium capitalize">{label}</span>. Crea un evento para justificar el tiempo.</p>
        <div className="p-2.5 space-y-3 max-h-[calc(100dvh-260px)] overflow-y-auto">
          {!horario.subject ? (
            <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>No tienes un horario asignado.</p>
          ) : totalTasks === 0 ? (
            <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Sin tareas planificadas en esta vista.</p>
          ) : (
            rangeGroups.map((g) => (
              <div key={g.day}>
                {view !== 'day' && (
                  <p className="text-[10px] uppercase tracking-wide text-digi-muted mb-1.5 flex items-center gap-1.5" style={df}>
                    {dayHeader(g.day)}{g.day === ymd(new Date()) && <span className="text-accent">· hoy</span>}
                  </p>
                )}
                <div className="space-y-2">
                  {g.items.map((it) => {
                    const t = taskById.get(it.alternativeId);
                    const dims = Array.from(new Set((t?.problems || []).map((p) => p.dimension).filter(Boolean))) as string[];
                    return (
                      <div key={it.key} className={`rounded-lg border p-2.5 bg-digi-darker/40 ${it.status === 'completed' ? 'border-emerald-400/40' : it.status === 'failed' ? 'border-red-400/40' : 'border-digi-border'}`}>
                        <div className="flex items-center gap-1.5">
                          {it.auto && <Lock className="w-3 h-3 shrink-0 text-sky-400" />}
                          {dims.map((dm) => { const DI = DIM_ICON[dm]; return DI ? <DI key={dm} title={DIMENSION_LABEL[dm] || dm} className="w-3.5 h-3.5 shrink-0" style={{ color: DIMENSION_COLOR[dm] || '#888' }} /> : null; })}
                          <span className="text-[12.5px] font-medium text-digi-text leading-snug min-w-0 flex-1 truncate" style={mf}>{t?.title || 'Tarea'}</span>
                          {it.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                          {it.status === 'failed' && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                        </div>
                        {it.auto && (
                          <p className="text-[10.5px] text-sky-500 mt-1 inline-flex items-center gap-1" style={mf}>
                            {it.source === 'ticket' ? <Ticket className="w-2.5 h-2.5" /> : <FolderKanban className="w-2.5 h-2.5" />} {it.refTitle}
                          </p>
                        )}
                        <button onClick={() => openTaskEvent(it.alternativeId, g.day)} className="mt-2 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-accent/40 bg-accent-light text-[11.5px] font-medium text-accent hover:bg-accent hover:text-white transition-colors" style={mf}>
                          <Plus className="w-3 h-3" /> Registrar tiempo
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      <EventModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        event={editingEvent}
        initialDate={initialDate}
        initialType={initialType}
        clients={clients}
        tasks={taskOptions}
        initialTaskId={initialTaskId}
      />

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      </div>
    </div>
  );
}
