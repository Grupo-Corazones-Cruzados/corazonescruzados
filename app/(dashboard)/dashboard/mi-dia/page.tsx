'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BTN_SECONDARY } from '@/components/ui/Button';
import {
  ChevronLeft, ChevronRight, ChevronDown, Plus, Share2, CalendarDays, ListTodo, Lock, Ticket, FolderKanban,
  Briefcase, Dumbbell, Brain, Users, ShieldCheck, Clock, PartyPopper,
} from 'lucide-react';
import CalendarView, { type CalendarViewMode } from '@/components/calendar/CalendarView';
import EventModal, { type EventFormPayload, type ClientOption, type TaskOption } from '@/components/calendar/EventModal';
import ShareDialog from '@/components/calendar/ShareDialog';
import ProposalsPanel from '@/components/calendar/ProposalsPanel';
import TaskStatusButtons from '@/components/centralized/TaskStatusButtons';
import {
  type CalendarEvent, type EventInstance, type EventType,
  expandEvents, MONTH_LABELS_ES, EVENT_COLORS,
} from '@/lib/calendar/recurrence';
import { type AvailabilityStatus, AVAILABILITY, AVAILABILITY_ORDER } from '@/lib/calendar/availability';
import { DIMENSION_COLOR, DIMENSION_LABEL } from '@/lib/centralized/apoyo';
import { DIMENSION_ICON as DIM_ICON } from '@/components/centralized/dimensionIcons';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const VIEWS: { value: CalendarViewMode; label: string }[] = [
  { value: 'month', label: 'Mes' }, { value: 'week', label: 'Semana' }, { value: 'day', label: 'Día' },
];
const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayHeader = (ds: string) => { const d = new Date(`${ds}T00:00:00`); return `${DAY_ABBR[d.getDay()]} ${d.getDate()} ${MONTH_LABELS_ES[d.getMonth()].slice(0, 3)}`; };

type Status = 'pending' | 'completed' | 'failed';
interface HTask { id: number; title: string; problems: { dimension: string | null }[]; values: string[]; talents: string[]; link: { source: 'ticket' | 'project'; title: string } | null }
interface GenTask { id: number; groupId: string; day: string; title: string; detail: string; values: string[]; talents: string[]; allDay: boolean; startTime: string | null; endTime: string | null; status: Status; policyName: string }
/** Tarea de un evento de "Gestión Social" que el usuario tomó desde el módulo Experiencias.
 *  Es FIJA y está BLOQUEADA (`locked`) mientras el organizador no marque el inicio del evento. */
interface SocialTask { id: number; taskId: number; eventId: number; eventName: string; eventStatus: string; day: string; title: string; detail: string; values: string[]; talents: string[]; allDay: boolean; startTime: string | null; endTime: string | null; status: Status; locked: boolean }
interface Horario { subject: { kind: string; id: string } | null; tasks: HTask[]; schedule: { id: number; alternativeId: number; day: string; status: Status }[]; auto: { alternativeId: number; day: string; source: 'ticket' | 'project'; refTitle: string; status: Status }[]; generated: GenTask[]; social: SocialTask[] }

/**
 * "Mi día": el calendario del miembro (mes/semana/día, mismo que estaba en Configuración)
 * + un rail de las tareas planificadas según el Horario de Vida para el día enfocado. Al
 * crear un evento se puede elegir una tarea para justificar el tiempo (evento = inicio→fin).
 */
export default function MiDiaPage() {
  const [view, setView] = useState<CalendarViewMode>('month');
  // En pantallas chicas se usa siempre la vista de DÍA (la grilla de 7 días queda muy
  // apretada en móvil); los botones Mes/Semana solo aparecen si la pantalla lo permite.
  const [allowMultiView, setAllowMultiView] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setAllowMultiView(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  useEffect(() => { if (!allowMultiView) setView('day'); }, [allowMultiView]);
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [horario, setHorario] = useState<Horario>({ subject: null, tasks: [], schedule: [], auto: [], generated: [], social: [] });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);
  const [initialType, setInitialType] = useState<EventType>('progreso');
  const [initialTaskId, setInitialTaskId] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  // Popover para marcar el estado de una tarea generada al hacer clic en su bloque del calendario.
  const [genPopover, setGenPopover] = useState<{ id: number; title: string; status: Status; x: number; y: number; kind: 'policy' | 'social'; locked?: boolean; eventName?: string } | null>(null);
  const [availability, setAvailability] = useState<AvailabilityStatus>('conectado');
  const [savingAvail, setSavingAvail] = useState(false);
  // Grupos de fecha del panel de eventos: contraídos por defecto (Set de días expandidos).
  const [openEventDays, setOpenEventDays] = useState<Set<string>>(new Set());
  const toggleEventDay = (day: string) => setOpenEventDays((s) => { const n = new Set(s); n.has(day) ? n.delete(day) : n.add(day); return n; });

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
      setHorario(d.data || { subject: null, tasks: [], schedule: [], auto: [], generated: [], social: [] });
    } catch { /* deja lo que haya */ }
  }, [range.s, range.e]);
  useEffect(() => { loadHorario(); }, [loadHorario]);

  const instances: EventInstance[] = useMemo(() => expandEvents(events, range.s, range.e), [events, range]);

  // Bloques SINTÉTICOS de las tareas generadas por política, para pintarlas en la grilla del
  // calendario (además del rail). Color por estado: completada=verde, fallida=rojo, pendiente=violeta.
  const generatedInstances: EventInstance[] = useMemo(() => horario.generated.map((g) => {
    const start = new Date(`${g.day}T00:00:00`);
    const end = new Date(`${g.day}T00:00:00`);
    if (g.allDay) { start.setHours(0, 0, 0, 0); end.setHours(23, 59, 0, 0); }
    else {
      const [sh, sm] = (g.startTime || '09:00').split(':').map((n) => parseInt(n, 10));
      const [eh, em] = (g.endTime || '10:00').split(':').map((n) => parseInt(n, 10));
      start.setHours(Number.isFinite(sh) ? sh : 9, Number.isFinite(sm) ? sm : 0, 0, 0);
      end.setHours(Number.isFinite(eh) ? eh : 10, Number.isFinite(em) ? em : 0, 0, 0);
      if (end.getTime() <= start.getTime()) end.setTime(start.getTime() + 60 * 60 * 1000);
    }
    const color = g.status === 'completed' ? '#22c55e' : g.status === 'failed' ? '#ef4444' : '#7c3aed';
    return {
      id: `gen-${g.id}`, title: g.title, description: g.detail || null,
      event_type: 'personal', client_id: null, client_name: null,
      start_at: start.toISOString(), end_at: end.toISOString(),
      all_day: g.allDay, timezone: 'America/Guayaquil',
      recurrence_type: 'none', recurrence_days: null, recurrence_interval: 1, recurrence_until: null,
      color, status: 'confirmed', alternative_id: null,
      instanceStart: start, instanceEnd: end, isRecurring: false,
      generated: true, generatedId: g.id, generatedStatus: g.status, taskKind: 'policy',
    } as EventInstance;
  }), [horario.generated]);

  // Bloques SINTÉTICOS de las tareas de eventos de Gestión Social. Mismo mecanismo que los de
  // política, pero en ÁMBAR mientras están pendientes (y bloqueadas si el evento no ha iniciado).
  const socialInstances: EventInstance[] = useMemo(() => horario.social.map((s) => {
    const start = new Date(`${s.day}T00:00:00`);
    const end = new Date(`${s.day}T00:00:00`);
    const allDay = s.allDay || !s.startTime;
    if (allDay) { start.setHours(0, 0, 0, 0); end.setHours(23, 59, 0, 0); }
    else {
      const [sh, sm] = (s.startTime || '09:00').split(':').map((n) => parseInt(n, 10));
      const [eh, em] = (s.endTime || '10:00').split(':').map((n) => parseInt(n, 10));
      start.setHours(Number.isFinite(sh) ? sh : 9, Number.isFinite(sm) ? sm : 0, 0, 0);
      end.setHours(Number.isFinite(eh) ? eh : 10, Number.isFinite(em) ? em : 0, 0, 0);
      if (end.getTime() <= start.getTime()) end.setTime(start.getTime() + 60 * 60 * 1000);
    }
    const color = s.status === 'completed' ? '#22c55e' : s.status === 'failed' ? '#ef4444' : '#f59e0b';
    return {
      id: `soc-${s.id}`, title: s.title, description: s.detail || null,
      event_type: 'personal', client_id: null, client_name: null,
      start_at: start.toISOString(), end_at: end.toISOString(),
      all_day: allDay, timezone: 'America/Guayaquil',
      recurrence_type: 'none', recurrence_days: null, recurrence_interval: 1, recurrence_until: null,
      color, status: 'confirmed', alternative_id: null,
      instanceStart: start, instanceEnd: end, isRecurring: false,
      generated: true, generatedId: s.id, generatedStatus: s.status,
      taskKind: 'social', socialLocked: s.locked,
    } as EventInstance;
  }), [horario.social]);

  // Solo el calendario recibe eventos + tareas sintéticas; el panel "Eventos" izquierdo usa `instances`.
  const allInstances = useMemo(
    () => [...instances, ...generatedInstances, ...socialInstances],
    [instances, generatedInstances, socialInstances],
  );

  const taskById = useMemo(() => new Map(horario.tasks.map((t) => [t.id, t])), [horario.tasks]);
  const taskOptions: TaskOption[] = useMemo(() => horario.tasks.map((t) => ({ id: t.id, title: t.title })), [horario.tasks]);

  // Tareas del RANGO de la vista (mes/semana/día), agrupadas por día.
  const rangeGroups = useMemo(() => {
    const from = ymd(range.s), to = ymd(range.e); // [from, to)
    const inRange = (ds: string) => ds >= from && ds < to;
    const byDay = new Map<string, { key: string; id?: number; alternativeId: number; status: Status; auto: boolean; source?: 'ticket' | 'project'; refTitle?: string; gen?: boolean; title?: string; policyName?: string; timeLabel?: string; social?: boolean; eventName?: string; locked?: boolean }[]>();
    const add = (ds: string, item: any) => { const a = byDay.get(ds) || []; a.push(item); byDay.set(ds, a); };
    for (const e of horario.schedule) if (inRange(e.day)) add(e.day, { key: `m-${e.id}`, id: e.id, alternativeId: e.alternativeId, status: e.status, auto: false });
    for (const e of horario.auto) if (inRange(e.day)) add(e.day, { key: `a-${e.alternativeId}-${e.day}`, alternativeId: e.alternativeId, status: e.status, auto: true, source: e.source, refTitle: e.refTitle });
    for (const g of horario.generated) if (inRange(g.day)) add(g.day, { key: `g-${g.id}`, id: g.id, alternativeId: -1, status: g.status, auto: false, gen: true, title: g.title, policyName: g.policyName, timeLabel: g.allDay ? 'Todo el día' : (g.startTime && g.endTime ? `${g.startTime}–${g.endTime}` : undefined) });
    // Tareas de eventos de Gestión Social (Experiencias): fijas y bloqueadas hasta que inicie el evento.
    for (const s of horario.social) if (inRange(s.day)) add(s.day, { key: `s-${s.id}`, id: s.id, alternativeId: -1, status: s.status, auto: false, social: true, title: s.title, eventName: s.eventName, locked: s.locked, timeLabel: s.allDay || !s.startTime ? 'Todo el día' : `${s.startTime}${s.endTime ? `–${s.endTime}` : ''}` });
    return Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, items]) => ({ day, items }));
  }, [horario, range]);
  const totalTasks = useMemo(() => rangeGroups.reduce((s, g) => s + g.items.length, 0), [rangeGroups]);

  // Eventos del rango de la vista, agrupados por día. Incluye las tareas generadas por
  // política (bloques sintéticos) para que también se listen en el panel "Eventos".
  const eventGroups = useMemo(() => {
    const byDay = new Map<string, EventInstance[]>();
    for (const ev of allInstances) { const ds = ymd(ev.instanceStart); const a = byDay.get(ds) || []; a.push(ev); byDay.set(ds, a); }
    return Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, items]) => ({ day, items: items.sort((a, b) => a.instanceStart.getTime() - b.instanceStart.getTime()) }));
  }, [allInstances]);
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

  const handleDayClick = (date: Date) => { setEditingEvent(null); setInitialDate(date); setInitialType('progreso'); setInitialTaskId(null); setCurrentDate(new Date(date)); setModalOpen(true); };
  // Seleccionar un día (clic en el encabezado/número) — cambia el día enfocado sin abrir el formulario.
  const handleDaySelect = (date: Date) => setCurrentDate(new Date(date));
  const openNew = (type: EventType) => { setEditingEvent(null); setInitialDate(new Date()); setInitialType(type); setInitialTaskId(null); setModalOpen(true); };
  const openTaskEvent = (alternativeId: number, dayStr: string) => {
    const base = new Date(`${dayStr}T09:00:00`);
    setEditingEvent(null); setInitialDate(base); setInitialType('progreso'); setInitialTaskId(alternativeId); setModalOpen(true);
  };
  const handleEventClick = (inst: EventInstance) => { const full = events.find((e) => e.id === inst.id) || null; setEditingEvent(full); setInitialDate(null); setInitialTaskId(null); setModalOpen(true); };

  // Marca el estado (completada/fallida/pendiente) de una tarea del rail; optimista.
  // Manual → PATCH /schedule por id; automática (ticket/proyecto) → POST /auto-status por día.
  const setTaskStatus = async (it: { id?: number; alternativeId: number; auto: boolean; gen?: boolean; social?: boolean; locked?: boolean }, day: string, status: Status) => {
    // Gestión Social: bloqueada mientras el evento no esté en curso.
    if (it.social) {
      if (!it.id || it.locked) return;
      setHorario((h) => ({ ...h, social: h.social.map((s) => (s.id === it.id ? { ...s, status } : s)) }));
      try {
        const res = await fetch('/api/centralized/horario/social', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, status }),
        });
        if (!res.ok) throw new Error();
      } catch { toast.error('No se pudo actualizar el estado'); loadHorario(); }
      return;
    }
    if (it.gen) {
      if (!it.id) return;
      setHorario((h) => ({ ...h, generated: h.generated.map((g) => (g.id === it.id ? { ...g, status } : g)) }));
      try {
        const res = await fetch('/api/centralized/horario/generated', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, status }),
        });
        if (!res.ok) throw new Error();
      } catch { toast.error('No se pudo actualizar el estado'); loadHorario(); }
      return;
    }
    if (it.auto) {
      const subject = horario.subject;
      if (!subject) return;
      setHorario((h) => ({ ...h, auto: h.auto.map((e) => (e.alternativeId === it.alternativeId && e.day === day ? { ...e, status } : e)) }));
      try {
        const res = await fetch('/api/centralized/horario/auto-status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject_kind: subject.kind, subject_id: subject.id, alternativeId: it.alternativeId, day, status }),
        });
        if (!res.ok) throw new Error();
      } catch { toast.error('No se pudo actualizar el estado'); loadHorario(); }
    } else {
      if (!it.id) return;
      setHorario((h) => ({ ...h, schedule: h.schedule.map((e) => (e.id === it.id ? { ...e, status } : e)) }));
      try {
        const res = await fetch('/api/centralized/horario/schedule', {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: it.id, status }),
        });
        if (!res.ok) throw new Error();
      } catch { toast.error('No se pudo actualizar el estado'); loadHorario(); }
    }
  };

  // Clic en un bloque sintético (política o Gestión Social) → popover de estado en el punto del clic.
  const onGeneratedBlockClick = (ev: EventInstance, e: React.MouseEvent) => {
    if (ev.taskKind === 'social') {
      const s = horario.social.find((x) => x.id === ev.generatedId);
      if (!s) return;
      setGenPopover({ id: s.id, title: s.title, status: s.status, x: e.clientX, y: e.clientY, kind: 'social', locked: s.locked, eventName: s.eventName });
      return;
    }
    const g = horario.generated.find((x) => x.id === ev.generatedId);
    if (!g) return;
    setGenPopover({ id: g.id, title: g.title, status: g.status, x: e.clientX, y: e.clientY, kind: 'policy' });
  };
  const setGenPopoverStatus = (status: Status) => {
    if (!genPopover || genPopover.locked) return;
    const isSocial = genPopover.kind === 'social';
    setTaskStatus({ id: genPopover.id, alternativeId: -1, auto: false, gen: !isSocial, social: isSocial, locked: genPopover.locked }, '', status);
    setGenPopover((p) => (p ? { ...p, status } : p));
  };

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
      <div className="flex flex-col xl:flex-row gap-4 items-start">
      {/* Panel izquierdo: eventos del rango de la vista + botón Nuevo */}
      <aside className="w-full xl:w-[260px] shrink-0 bg-digi-card border border-digi-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-digi-border">
          <CalendarDays className="w-4 h-4 text-digi-muted" />
          <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Eventos · {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : dayHeader(ymd(currentDate))}</span>
          <button onClick={() => openNew('progreso')} className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-white text-[11.5px] font-medium hover:bg-accent-hover transition-colors" style={mf}><Plus className="w-3 h-3" /> Nuevo</button>
        </div>
        <div className="p-2.5 space-y-3 max-h-[calc(100dvh-220px)] overflow-y-auto">
          {(() => {
            // En vista de MES el panel muestra solo el día seleccionado (currentDate);
            // en semana/día conserva el agrupado por día del rango de la vista.
            const panelGroups = view === 'month' ? eventGroups.filter((g) => g.day === ymd(currentDate)) : eventGroups;
            const expanded = view === 'day' || view === 'month';
            return panelGroups.length === 0 ? (
            <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>{view === 'month' ? 'Sin eventos este día.' : 'Sin eventos en esta vista.'}</p>
          ) : (
            panelGroups.map((g) => {
              const openG = expanded || openEventDays.has(g.day);
              const list = (
                <div className="space-y-1.5">
                  {g.items.map((ev) => {
                    const color = ev.color || EVENT_COLORS[ev.event_type];
                    return (
                      <button key={`${ev.id}-${ev.instanceStart.getTime()}`}
                        onClick={(e) => { if (ev.generated) onGeneratedBlockClick(ev, e); else handleEventClick(ev); }}
                        className="w-full text-left rounded-lg border border-digi-border bg-digi-darker/40 hover:border-accent/50 transition-colors p-2 flex items-stretch gap-2">
                        <span className="w-1 rounded-full shrink-0" style={{ background: color }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-digi-text truncate leading-snug inline-flex items-center gap-1" style={mf}>
                            {ev.generated && (ev.taskKind === 'social'
                              ? <PartyPopper className="w-3 h-3 shrink-0 text-amber-500" />
                              : <ShieldCheck className="w-3 h-3 shrink-0 text-violet-400" />)}
                            <span className="truncate">{ev.title}</span>
                          </p>
                          <p className="text-[10.5px] text-digi-muted mt-0.5" style={mf}>{ev.all_day ? 'Todo el día' : `${fmtTime(ev.instanceStart)}–${fmtTime(ev.instanceEnd)}`}{ev.client_name ? ` · ${ev.client_name}` : ''}{ev.generated ? (ev.taskKind === 'social' ? ' · evento' : ' · política') : ''}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
              if (expanded) return <div key={g.day}>{list}</div>;
              return (
                <div key={g.day}>
                  <button onClick={() => toggleEventDay(g.day)} className="w-full flex items-center gap-1.5 py-0.5 text-left hover:text-digi-text transition-colors" style={df}>
                    <ChevronDown className={`w-3.5 h-3.5 text-digi-muted shrink-0 transition-transform ${openG ? '' : '-rotate-90'}`} />
                    <span className="text-[10px] uppercase tracking-wide text-digi-muted">{dayHeader(g.day)}</span>
                    {g.day === ymd(new Date()) && <span className="text-[10px] uppercase text-accent">· hoy</span>}
                    <span className="ml-auto text-[10px] text-digi-muted tabular-nums">{g.items.length}</span>
                  </button>
                  {openG && <div className="mt-1.5">{list}</div>}
                </div>
              );
            })
          );
          })()}
        </div>
      </aside>

      <div className="flex-1 min-w-0 w-full">
        {/* El contenedor del calendario ocupa la altura disponible de la ventana; su cuerpo
            (grilla de horas / celdas de mes) llena el espacio y se desplaza internamente. */}
        <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[calc(100dvh-4.5rem)]">
          {/* Command bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-digi-border shrink-0">
            <div className="flex items-center gap-2">
              <button onClick={goToday} className={`${BTN_SECONDARY} !py-1.5`}>Hoy</button>
              <div className="flex items-center gap-1">
                <button onClick={goPrev} aria-label="Anterior" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={goNext} aria-label="Siguiente" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>
              <span className="text-[15px] font-semibold text-digi-text capitalize ml-1" style={mf}>{label}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {allowMultiView && (
                <div className="inline-flex rounded-md border border-digi-border overflow-hidden">
                  {VIEWS.map((v) => (
                    <button key={v.value} onClick={() => setView(v.value)} className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${view === v.value ? 'bg-accent text-white' : 'text-digi-muted hover:bg-black/[0.03]'}`} style={mf}>{v.label}</button>
                  ))}
                </div>
              )}
              <div className="inline-flex items-center gap-1.5 rounded-md border border-digi-border pl-2.5 pr-1.5 py-1" title="Tu disponibilidad">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: AVAILABILITY[availability].color }} />
                <select value={availability} disabled={savingAvail} onChange={(e) => changeAvailability(e.target.value as AvailabilityStatus)} className="bg-transparent text-[12.5px] text-digi-text focus:outline-none cursor-pointer disabled:opacity-50" style={mf} aria-label="Disponibilidad">
                  {AVAILABILITY_ORDER.map((s) => <option key={s} value={s}>{AVAILABILITY[s].label}</option>)}
                </select>
              </div>
              <button onClick={() => setShareOpen(true)} className={BTN_SECONDARY}><Share2 className="w-4 h-4" /> Compartir</button>
            </div>
          </div>

          {/* Grid — llena el alto disponible del contenedor; scroll interno en el cuerpo */}
          <div className="p-3 flex-1 min-h-0 flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-digi-muted" style={mf}><CalendarDays className="w-4 h-4 animate-pulse" /> Cargando…</div>
            ) : (
              <CalendarView view={view} currentDate={currentDate} instances={allInstances} onDayClick={handleDayClick} onDaySelect={handleDaySelect} onEventClick={handleEventClick} onGeneratedClick={onGeneratedBlockClick} fillHeight />
            )}
          </div>

          {/* Leyenda */}
          <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 border-t border-digi-border text-[12px] text-digi-muted shrink-0" style={mf}>
            <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ backgroundColor: `${EVENT_COLORS.progreso}30`, borderLeft: `3px solid ${EVENT_COLORS.progreso}` }} /> Progreso</span>
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
                    const t = (it.gen || it.social) ? undefined : taskById.get(it.alternativeId);
                    const dims = Array.from(new Set((t?.problems || []).map((p) => p.dimension).filter(Boolean))) as string[];
                    const borderCls = it.status === 'completed' ? 'border-emerald-400/40' : it.status === 'failed' ? 'border-red-400/40' : (it.gen ? 'border-violet-400/40' : it.social ? 'border-amber-400/40' : 'border-digi-border');
                    return (
                      <div key={it.key} className={`rounded-lg border p-2.5 bg-digi-darker/40 ${borderCls} ${it.social ? 'border-dashed' : ''}`}>
                        <div className="flex items-center gap-1.5">
                          {it.gen && <ShieldCheck className="w-3 h-3 shrink-0 text-violet-400" />}
                          {it.social && <PartyPopper className="w-3 h-3 shrink-0 text-amber-500" />}
                          {it.auto && <Lock className="w-3 h-3 shrink-0 text-sky-400" />}
                          {dims.map((dm) => { const DI = DIM_ICON[dm]; return DI ? <span key={dm} title={DIMENSION_LABEL[dm] || dm} className="inline-flex shrink-0"><DI className="w-3.5 h-3.5" style={{ color: DIMENSION_COLOR[dm] || '#888' }} /></span> : null; })}
                          <span className="text-[12.5px] font-medium text-digi-text leading-snug min-w-0 flex-1 truncate" style={mf}>{(it.gen || it.social) ? it.title : (t?.title || 'Tarea')}</span>
                        </div>
                        {/* Origen "Gestión Social": etiqueta ámbar + evento + aviso de bloqueo. */}
                        {it.social && (
                          <>
                            <p className="text-[10.5px] mt-1 flex items-center gap-1.5 flex-wrap" style={mf}>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-600">
                                <PartyPopper className="w-2.5 h-2.5" /> Gestión Social
                              </span>
                              <span className="text-amber-600 truncate">{it.eventName}</span>
                              {it.timeLabel && <span className="inline-flex items-center gap-1 text-digi-muted"><Clock className="w-2.5 h-2.5" /> {it.timeLabel}</span>}
                            </p>
                            {it.locked && (
                              <p className="text-[10.5px] text-digi-muted mt-1 inline-flex items-center gap-1" style={mf}>
                                <Lock className="w-2.5 h-2.5" /> Bloqueada hasta que inicie el evento
                              </p>
                            )}
                          </>
                        )}
                        {it.auto && (
                          <p className="text-[10.5px] text-sky-500 mt-1 inline-flex items-center gap-1" style={mf}>
                            {it.source === 'ticket' ? <Ticket className="w-2.5 h-2.5" /> : <FolderKanban className="w-2.5 h-2.5" />} {it.refTitle}
                          </p>
                        )}
                        {it.gen && (
                          <p className="text-[10.5px] text-violet-500 mt-1 inline-flex items-center gap-1.5 flex-wrap" style={mf}>
                            <span className="inline-flex items-center gap-1"><ShieldCheck className="w-2.5 h-2.5" /> {it.policyName || 'Política'}</span>
                            {it.timeLabel && <span className="inline-flex items-center gap-1 text-digi-muted"><Clock className="w-2.5 h-2.5" /> {it.timeLabel}</span>}
                          </p>
                        )}
                        <TaskStatusButtons className="mt-2" value={it.status} onChange={(s) => setTaskStatus(it, g.day, s)} disabled={!!it.locked} />
                        {!it.gen && !it.social && (
                          <button onClick={() => openTaskEvent(it.alternativeId, g.day)} className="mt-1.5 w-full inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-md border border-accent/40 bg-accent-light text-[11.5px] font-medium text-accent hover:bg-accent hover:text-white transition-colors" style={mf}>
                            <Plus className="w-3 h-3" /> Registrar tiempo
                          </button>
                        )}
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

      {/* Popover de estado de una tarea sintética (clic en su bloque del calendario) */}
      {genPopover && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setGenPopover(null)} />
          <div className="fixed z-[61] w-[224px] p-2.5 rounded-lg bg-digi-card border border-digi-border shadow-xl -translate-x-1/2"
            style={{ left: Math.min(Math.max(genPopover.x, 120), (typeof window !== 'undefined' ? window.innerWidth : 1200) - 120), top: genPopover.y + 10 }}>
            <div className="flex items-start gap-1.5 mb-1.5">
              {genPopover.kind === 'social'
                ? <PartyPopper className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
                : <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-violet-400" />}
              <p className="text-[12.5px] font-medium text-digi-text leading-snug" style={mf}>{genPopover.title}</p>
            </div>
            {genPopover.kind === 'social' && genPopover.eventName && (
              <p className="text-[10.5px] text-amber-600 mb-1.5 inline-flex items-center gap-1" style={mf}>
                <PartyPopper className="w-2.5 h-2.5" /> Gestión Social · {genPopover.eventName}
              </p>
            )}
            <p className="text-[10.5px] text-digi-muted mb-2 flex items-center gap-1" style={mf}>
              {genPopover.locked
                ? <><Lock className="w-2.5 h-2.5 shrink-0" /> Bloqueada hasta que inicie el evento.</>
                : 'Marca el estado de esta tarea.'}
            </p>
            <TaskStatusButtons value={genPopover.status} onChange={setGenPopoverStatus} disabled={!!genPopover.locked} />
          </div>
        </>
      )}
      </div>
    </div>
  );
}
