'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, CalendarClock, ListTodo, GripVertical, MousePointerClick, Tag, X,
  Gem, Sparkles, CheckCircle2, XCircle, CircleDashed, MoreVertical, Trash2, Ticket, FolderKanban, Lock, Flag,
  Briefcase, Dumbbell, Brain, Users,
} from 'lucide-react';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';
import TaskStatusButtons from '@/components/centralized/TaskStatusButtons';
import PixelModal from '@/components/ui/PixelModal';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { VALORES, VALOR_LABEL } from '@/lib/centralized/valores';
import { DIMENSION_COLOR, DIMENSION_LABEL } from '@/lib/centralized/apoyo';
import { TALENTOS } from '@/lib/centralized/talentos';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Status = 'pending' | 'completed' | 'failed';
interface TaskLink { source: 'ticket' | 'project'; title: string; status: string | null; description: string | null; start: string | null; end: string | null }
interface Task { id: number; title: string; description: string | null; problems: { title: string; dimension: string | null }[]; values: string[]; talents: string[]; link: TaskLink | null }
interface ScheduleEntry { id: number; alternativeId: number; day: string; status: Status }
interface AutoEntry { alternativeId: number; day: string; source: 'ticket' | 'project'; refTitle: string; status: Status }
interface TaskContext { problems: { title: string; dimension: string | null }[]; situations: string[]; causes: string[] }

// Icono que representa cada dimensión (con su color de `DIMENSION_COLOR`).
const DIM_ICON: Record<string, any> = { laboral: Briefcase, corporal: Dumbbell, mental: Brain, social: Users };

const VALOR_OPTIONS = VALORES.map((v) => ({ value: v.key, label: v.label }));
const TALENTO_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));

/**
 * Sistema "Horario de Vida". Las TAREAS son las alternativas del sistema de Apoyo que
 * aún no se han convertido en solución. Cada tarea debe recibir ETIQUETAS (valores y/o
 * talentos) antes de poder arrastrarse a un día de la semana. Una vez en el día, sus
 * tres puntos abren un panel de detalle donde se marca como completada/fallida/pendiente.
 */
export default function HorarioDeVidaSystem({ isAdmin: _isAdmin }: { system?: any; isAdmin: boolean }) {
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfDay(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [auto, setAuto] = useState<AutoEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor de etiquetas
  const [editing, setEditing] = useState<Task | null>(null);
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [draftTalents, setDraftTalents] = useState<string[]>([]);
  const [savingLabels, setSavingLabels] = useState(false);

  // Drag & drop (HTML5 nativo)
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Burbuja flotante de etiquetas (hover sobre los iconos de la tarjeta)
  const [bubble, setBubble] = useState<{ kind: 'values' | 'talents'; items: string[]; x: number; y: number } | null>(null);
  // Burbuja flotante con detalles del ticket/proyecto (hover sobre el candado)
  const [linkBubble, setLinkBubble] = useState<{ link: TaskLink; x: number; y: number } | null>(null);

  // Filtro del panel de tareas: solo pendientes (sin ninguna instancia completada)
  const [onlyPending, setOnlyPending] = useState(false);

  // Panel de detalle: asignación manual (`entry`) o entrada automática (`auto` con día+estado)
  const [panel, setPanel] = useState<{ alternativeId: number; entry: ScheduleEntry | null; auto: { day: string; status: Status } | null } | null>(null);
  const [panelCtx, setPanelCtx] = useState<TaskContext | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  const today = startOfDay(new Date());
  const todayStr = ymd(today);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const enabled = !!selected;

  const load = useCallback(async () => {
    if (!selected) { setTasks([]); setSchedule([]); setAuto([]); return; }
    setLoading(true);
    const from = ymd(weekStart), to = ymd(addDays(weekStart, 6));
    try {
      const res = await fetch(`/api/centralized/horario?subject_kind=${selected.kind}&subject_id=${selected.id}&from=${from}&to=${to}`);
      const d = await res.json();
      setTasks(d.data?.tasks || []);
      setSchedule(d.data?.schedule || []);
      setAuto(d.data?.auto || []);
    } catch { setTasks([]); setSchedule([]); setAuto([]); }
    finally { setLoading(false); }
  }, [selected, weekStart]);

  useEffect(() => { load(); setPanel(null); }, [load]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const hasLabels = (t: Task) => t.values.length > 0 || t.talents.length > 0;
  const scheduleByDay = useMemo(() => {
    const m = new Map<string, ScheduleEntry[]>();
    for (const e of schedule) { const a = m.get(e.day) || []; a.push(e); m.set(e.day, a); }
    return m;
  }, [schedule]);
  const autoByDay = useMemo(() => {
    const m = new Map<string, AutoEntry[]>();
    for (const e of auto) { const a = m.get(e.day) || []; a.push(e); m.set(e.day, a); }
    return m;
  }, [auto]);
  // Una tarea es "pendiente" mientras no tenga ninguna instancia resuelta (completada o fallida).
  const isPending = (t: Task) => !schedule.some((e) => e.alternativeId === t.id && (e.status === 'completed' || e.status === 'failed'));
  const visibleTasks = useMemo(() => (onlyPending ? tasks.filter(isPending) : tasks), [tasks, schedule, onlyPending]);

  const openEditor = (t: Task) => { setDraftValues(t.values); setDraftTalents(t.talents); setEditing(t); };

  const saveLabels = async () => {
    if (!editing) return;
    setSavingLabels(true);
    try {
      const res = await fetch('/api/centralized/horario', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alternativeId: editing.id, values: draftValues, talents: draftTalents }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      const d = await res.json();
      setTasks((ts) => ts.map((t) => (t.id === editing.id ? { ...t, values: d.values, talents: d.talents } : t)));
      toast.success('Etiquetas guardadas');
      setEditing(null);
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingLabels(false); }
  };

  // Salta el calendario a la semana que contiene la fecha indicada (inicio/fin del ref).
  const goToWeekOf = (dayStr: string | null) => { if (!dayStr) return; setWeekStart(startOfDay(new Date(`${dayStr}T00:00:00`))); };

  // Asignación OPTIMISTA: aparece al instante con un id temporal y luego se reconcilia.
  const assign = async (task: Task, day: Date) => {
    if (!selected) return;
    if (task.link) { toast.error('Esta tarea está fijada por su ticket/proyecto; no se agenda manualmente.'); return; }
    if (!hasLabels(task)) { toast.error('Agrega etiquetas a la tarea antes de programarla'); return; }
    const dayStr = ymd(day);
    const tempId = -Date.now();
    setSchedule((s) => [...s, { id: tempId, alternativeId: task.id, day: dayStr, status: 'pending' }]);
    try {
      const res = await fetch('/api/centralized/horario/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_kind: selected.kind, subject_id: selected.id, alternativeId: task.id, day: dayStr }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      const d = await res.json();
      setSchedule((s) => s.map((e) => (e.id === tempId ? { ...e, id: d.id } : e)));
    } catch (e: any) { toast.error(e.message || 'Error'); setSchedule((s) => s.filter((e) => e.id !== tempId)); }
  };

  const setEntryStatus = async (entry: ScheduleEntry, status: Status) => {
    setSchedule((s) => s.map((e) => (e.id === entry.id ? { ...e, status } : e)));
    setPanel((p) => (p && p.entry && p.entry.id === entry.id ? { ...p, entry: { ...p.entry, status } } : p));
    try {
      const res = await fetch('/api/centralized/horario/schedule', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id, status }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); load(); }
  };

  // Estado de una entrada automática (por día). Se materializa como fila `locked`.
  const setAutoStatusFor = async (alternativeId: number, day: string, status: Status) => {
    if (!selected) return;
    setAuto((a) => a.map((e) => (e.alternativeId === alternativeId && e.day === day ? { ...e, status } : e)));
    setPanel((p) => (p && p.auto && p.alternativeId === alternativeId && p.auto.day === day ? { ...p, auto: { ...p.auto, status } } : p));
    try {
      const res = await fetch('/api/centralized/horario/auto-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject_kind: selected.kind, subject_id: selected.id, alternativeId, day, status }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); load(); }
  };

  const unassign = async (entry: ScheduleEntry) => {
    setSchedule((s) => s.filter((e) => e.id !== entry.id));
    setPanel((p) => (p && p.entry && p.entry.id === entry.id ? null : p));
    try {
      const res = await fetch('/api/centralized/horario/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); load(); }
  };

  // Abre el panel de detalle: para una asignación manual (con estado/quitar) o para una
  // entrada automática (entry=null → solo detalles, incl. ticket/proyecto asociado).
  const openPanel = async (alternativeId: number, entry: ScheduleEntry | null, auto: { day: string; status: Status } | null = null) => {
    setPanel({ alternativeId, entry, auto });
    setPanelCtx(null);
    if (!selected) return;
    setPanelLoading(true);
    try {
      const res = await fetch(`/api/centralized/horario/task?subject_kind=${selected.kind}&subject_id=${selected.id}&alternative_id=${alternativeId}`);
      const d = await res.json();
      setPanelCtx(d.data || { problems: [], situations: [], causes: [] });
    } catch { setPanelCtx({ problems: [], situations: [], causes: [] }); }
    finally { setPanelLoading(false); }
  };

  const onDropDay = (day: Date) => {
    setDragOverDay(null);
    const id = dragId;
    setDragId(null);
    if (id == null) return;
    const t = taskById.get(id);
    if (t) assign(t, day);
  };

  const showBubble = (el: HTMLElement, kind: 'values' | 'talents', items: string[]) => {
    const r = el.getBoundingClientRect();
    setBubble({ kind, items, x: r.left + r.width / 2, y: r.top });
  };
  const showLinkBubble = (el: HTMLElement, link: TaskLink) => {
    const r = el.getBoundingClientRect();
    setLinkBubble({ link, x: r.left + r.width / 2, y: r.top });
  };
  const fmtDay = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <UsersList selected={selected} onSelect={setSelected} className="w-full lg:w-[260px] shrink-0" />

      {!enabled ? (
        <div className="flex-1 min-w-0 w-full bg-digi-card border border-digi-border rounded-xl py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><MousePointerClick className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un candidato o miembro</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>El horario de vida se habilita al elegir un usuario. Sus tareas provienen de las alternativas del sistema de Apoyo.</p>
        </div>
      ) : (
        <>
          {/* Panel de tareas */}
          <div className="w-full lg:w-[260px] shrink-0 bg-digi-card border border-digi-border rounded-lg overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-digi-dark border-b border-digi-border">
              <ListTodo className="w-4 h-4 text-digi-muted" />
              <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Tareas</span>
              <button
                onClick={() => setOnlyPending((v) => !v)}
                title={onlyPending ? 'Mostrando solo pendientes' : 'Mostrar solo pendientes'}
                aria-pressed={onlyPending}
                className={`ml-auto w-6 h-6 flex items-center justify-center rounded-md border transition-colors ${onlyPending ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-muted hover:text-accent hover:bg-black/[0.05]'}`}>
                <CircleDashed className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-digi-muted tabular-nums" style={mf}>{visibleTasks.length}</span>
            </div>
            <div className="p-2.5 space-y-2 max-h-[calc(100dvh-220px)] overflow-y-auto">
              {loading ? (
                <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Cargando…</p>
              ) : visibleTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-digi-border/80 bg-digi-darker/40 p-4 text-center">
                  <GripVertical className="w-5 h-5 text-digi-muted/50 mx-auto mb-1.5" />
                  <p className="text-[12px] text-digi-muted" style={mf}>{onlyPending && tasks.length > 0 ? 'No hay tareas pendientes.' : 'Sin tareas. Crea alternativas en Apoyo y Autoayuda para este usuario.'}</p>
                </div>
              ) : (
                visibleTasks.map((t) => {
                  const linked = !!t.link;
                  const ready = hasLabels(t);
                  const draggable = ready && !linked;
                  const scheduledCount = schedule.filter((e) => e.alternativeId === t.id).length;
                  return (
                    <div key={t.id}
                      draggable={draggable}
                      onDragStart={(e) => { if (!draggable) return; setDragId(t.id); e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragId(null); setDragOverDay(null); }}
                      className={`rounded-lg border p-2.5 transition-colors ${linked ? 'border-sky-400/30 bg-sky-500/[0.06]' : ready ? 'border-digi-border bg-digi-darker/50 cursor-grab active:cursor-grabbing hover:border-accent/50' : 'border-dashed border-digi-border/70 bg-digi-darker/50'} ${dragId === t.id ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-1.5">
                        {linked
                          ? <button type="button" onMouseEnter={(e) => t.link && showLinkBubble(e.currentTarget, t.link)} onMouseLeave={() => setLinkBubble(null)} className="mt-0.5 shrink-0 text-sky-400 hover:text-sky-300 cursor-help" aria-label="Detalles del ticket/proyecto"><Lock className="w-3.5 h-3.5" /></button>
                          : <GripVertical className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ready ? 'text-digi-muted' : 'text-digi-muted/40'}`} />}
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-digi-text leading-snug" style={mf}>{t.title}</p>
                          {t.problems.length > 0 && (
                            <p className="text-[10.5px] text-digi-muted truncate mt-0.5" style={mf}>Para: {t.problems.map((p) => p.title).join(', ')}</p>
                          )}
                        </div>
                      </div>

                      {/* Etiquetas: dos iconos con burbuja flotante al pasar el puntero */}
                      {(t.values.length > 0 || t.talents.length > 0) && (
                        <div className="flex items-center gap-1.5 mt-2 ml-5">
                          {t.values.length > 0 && (
                            <button type="button"
                              onMouseEnter={(e) => showBubble(e.currentTarget, 'values', t.values.map((v) => VALOR_LABEL[v] || v))}
                              onMouseLeave={() => setBubble(null)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10.5px] text-violet-300 cursor-default" style={mf}>
                              <Gem className="w-3 h-3" /> {t.values.length}
                            </button>
                          )}
                          {t.talents.length > 0 && (
                            <button type="button"
                              onMouseEnter={(e) => showBubble(e.currentTarget, 'talents', t.talents)}
                              onMouseLeave={() => setBubble(null)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10.5px] text-sky-300 cursor-default" style={mf}>
                              <Sparkles className="w-3 h-3" /> {t.talents.length}
                            </button>
                          )}
                        </div>
                      )}

                      {linked && t.link ? (
                        <div className="mt-2 ml-5 space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => goToWeekOf(t.link!.start)} disabled={!t.link.start} title="Ir a la fecha de inicio" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-digi-border text-[11px] text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={mf}><CalendarClock className="w-3 h-3" /> Inicio</button>
                            <button onClick={() => goToWeekOf(t.link!.end)} disabled={!t.link.end} title="Ir a la fecha límite" className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-digi-border text-[11px] text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed" style={mf}><Flag className="w-3 h-3" /> Fin</button>
                          </div>
                          <button onClick={() => openEditor(t)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors" style={mf}>
                            <Tag className="w-3 h-3" /> {ready ? 'Editar etiquetas' : 'Agregar etiquetas'}
                          </button>
                          {!ready && <p className="text-[10px] text-digi-muted/70" style={mf}>Agrega etiquetas para que su cumplimiento sume o reste al perfil.</p>}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mt-2 ml-5">
                            <button onClick={() => openEditor(t)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors" style={mf}>
                              <Tag className="w-3 h-3" /> {ready ? 'Editar etiquetas' : 'Agregar etiquetas'}
                            </button>
                            {scheduledCount > 0 && <span className="text-[10px] text-digi-muted tabular-nums" style={mf}>{scheduledCount} en agenda</span>}
                          </div>
                          {!ready && <p className="text-[10px] text-digi-muted/70 mt-1 ml-5" style={mf}>Necesita etiquetas para arrastrarla al horario.</p>}
                        </>
                      )}
                    </div>
                  );
                })
              )}
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
                  const dayStr = ymd(d);
                  const entries = scheduleByDay.get(dayStr) || [];
                  const autoEntries = autoByDay.get(dayStr) || [];
                  const over = dragOverDay === dayStr;
                  return (
                    <div key={i} className={`w-[150px] shrink-0 border rounded-lg overflow-hidden bg-digi-card transition-colors ${over ? 'border-accent ring-1 ring-accent' : 'border-digi-border'}`}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverDay(dayStr); }}
                      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay((c) => (c === dayStr ? null : c)); }}
                      onDrop={(e) => { e.preventDefault(); onDropDay(d); }}>
                      <div className={`px-2 py-2 text-center border-b border-digi-border ${isToday ? 'bg-accent-light' : 'bg-digi-dark'}`}>
                        <div className="text-[10.5px] font-semibold text-digi-muted uppercase" style={mf}>{DAY_ABBR[d.getDay()]}{isToday ? ' · HOY' : ''}</div>
                        <div className={`text-[16px] tabular-nums leading-tight ${isToday ? 'text-accent font-bold' : 'text-digi-text'}`} style={mf}>{d.getDate()}</div>
                        <div className="text-[10px] text-digi-muted" style={mf}>{MONTH_ABBR[d.getMonth()]}</div>
                      </div>
                      <div className={`min-h-[240px] p-2 space-y-1.5 ${over ? 'bg-accent-light/40' : ''}`}>
                        {entries.length === 0 && autoEntries.length === 0 ? (
                          <div className="h-full min-h-[220px] flex items-center justify-center text-center">
                            <span className="text-[10.5px] text-digi-muted/50" style={mf}>{over ? 'Suelta para programar' : 'Arrastra tareas aquí'}</span>
                          </div>
                        ) : (
                          <>
                            {entries.map((e) => {
                              const t = taskById.get(e.alternativeId);
                              const st = e.status;
                              const open = panel?.entry?.id === e.id;
                              const dims = Array.from(new Set((t?.problems || []).map((p) => p.dimension).filter(Boolean))) as string[];
                              return (
                                <div key={e.id} className={`flex items-center gap-1 rounded-md border pl-1.5 pr-0.5 py-1.5 ${st === 'completed' ? 'border-emerald-400/40 bg-emerald-500/10' : st === 'failed' ? 'border-red-400/40 bg-red-500/10' : 'border-accent/25 bg-accent-light'} ${open ? 'ring-1 ring-accent' : ''}`}>
                                  {dims.slice(0, 3).map((dm) => {
                                    const DI = DIM_ICON[dm];
                                    return (
                                      <span key={dm} title={`Dimensión: ${DIMENSION_LABEL[dm] || dm}`} className="shrink-0 inline-flex">
                                        {DI ? <DI className="w-3 h-3" style={{ color: DIMENSION_COLOR[dm] || '#888' }} /> : <span className="w-2 h-2 rounded-full" style={{ background: DIMENSION_COLOR[dm] || '#888' }} />}
                                      </span>
                                    );
                                  })}
                                  <span className={`text-[11px] leading-snug flex-1 min-w-0 ${st === 'completed' ? 'text-emerald-400' : st === 'failed' ? 'text-red-400' : 'text-accent'}`} style={mf}>{t?.title || 'Tarea'}</span>
                                  {st === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />}
                                  {st === 'failed' && <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                                  <button onClick={() => openPanel(e.alternativeId, e)} title="Detalles de la tarea" className="shrink-0 text-digi-muted hover:text-accent transition-colors" aria-label="Detalles"><MoreVertical className="w-3.5 h-3.5" /></button>
                                </div>
                              );
                            })}
                            {/* Entradas automáticas del ticket/proyecto asociado — fijas, pero con estado; ⋮ a la derecha abre el detalle */}
                            {autoEntries.map((a, ai) => {
                              const t = taskById.get(a.alternativeId);
                              const RefIcon = a.source === 'ticket' ? Ticket : FolderKanban;
                              const st = a.status;
                              const open = panel?.alternativeId === a.alternativeId && !!panel?.auto && panel.auto.day === a.day;
                              return (
                                <div key={`auto-${a.alternativeId}-${ai}`}
                                  className={`flex items-center gap-1 rounded-md border border-dashed pl-1.5 pr-0.5 py-1.5 ${st === 'completed' ? 'border-emerald-400/50 bg-emerald-500/10' : st === 'failed' ? 'border-red-400/50 bg-red-500/10' : 'border-sky-400/40 bg-sky-500/10'} ${open ? 'ring-1 ring-sky-400' : ''}`}>
                                  <RefIcon className={`w-3 h-3 shrink-0 ${st === 'completed' ? 'text-emerald-400' : st === 'failed' ? 'text-red-400' : 'text-sky-400'}`} />
                                  <span className={`text-[11px] leading-snug flex-1 min-w-0 ${st === 'completed' ? 'text-emerald-400' : st === 'failed' ? 'text-red-400' : 'text-sky-300'}`} style={mf}>{t?.title || 'Tarea'}</span>
                                  <button onClick={() => openPanel(a.alternativeId, null, { day: a.day, status: a.status })} title="Detalles de la tarea" className="shrink-0 text-sky-400/80 hover:text-sky-300 transition-colors" aria-label="Detalles"><MoreVertical className="w-3.5 h-3.5" /></button>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Panel de detalle de la tarea (a la derecha del calendario) */}
          {panel && (() => {
            const t = taskById.get(panel.alternativeId);
            const entry = panel.entry;
            const st = entry?.status;
            const link = t?.link || null;
            return (
              <div className="w-full lg:w-[300px] shrink-0 bg-digi-card border border-digi-border rounded-lg overflow-hidden self-stretch">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-digi-border">
                  <span className="text-[12.5px] font-semibold text-digi-text truncate flex-1" style={df}>Detalle de la tarea</span>
                  <button onClick={() => setPanel(null)} className="text-digi-muted hover:text-digi-text" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-3 space-y-3 max-h-[calc(100dvh-200px)] overflow-y-auto">
                  <div>
                    <h4 className="text-[14px] font-semibold text-digi-text leading-snug" style={mf}>{t?.title || 'Tarea'}</h4>
                    {t?.description && <p className="text-[12px] text-digi-muted mt-1 leading-relaxed" style={mf}>{t.description}</p>}
                  </div>

                  {/* Estado (asignación manual o entrada automática) */}
                  {(() => {
                    const cur = entry ? entry.status : panel.auto?.status;
                    if (!entry && !panel.auto) return null;
                    const set = (s: Status) => (entry ? setEntryStatus(entry, s) : setAutoStatusFor(panel.alternativeId, panel.auto!.day, s));
                    return (
                      <div>
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted mb-1.5" style={df}>Estado{panel.auto ? ` · ${fmtDay(panel.auto.day)}` : ''}</p>
                        <TaskStatusButtons value={cur ?? 'pending'} onChange={set} />
                        <p className="text-[10.5px] text-digi-muted/80 mt-1.5 leading-relaxed" style={mf}>
                          Completada suma a sus valores/talentos; fallida resta; pendiente no afecta el perfil.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Ticket/proyecto asociado */}
                  {link && (
                    <div className="rounded-lg border border-sky-400/30 bg-sky-500/[0.06] p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400 mb-1 inline-flex items-center gap-1" style={df}>
                        {link.source === 'ticket' ? <Ticket className="w-3 h-3" /> : <FolderKanban className="w-3 h-3" />} {link.source === 'ticket' ? 'Ticket asociado' : 'Proyecto asociado'}
                      </p>
                      <p className="text-[12.5px] font-medium text-digi-text leading-snug" style={mf}>{link.title}</p>
                      {link.status && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Estado: {link.status}</p>}
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Del {fmtDay(link.start)} al {fmtDay(link.end)}</p>
                      {link.description && <p className="text-[11px] text-digi-muted/90 mt-1 leading-snug" style={mf}>{link.description}</p>}
                      <div className="flex items-center gap-1.5 mt-2">
                        <button onClick={() => goToWeekOf(link.start)} disabled={!link.start} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-digi-border text-[11px] text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-40" style={mf}><CalendarClock className="w-3 h-3" /> Inicio</button>
                        <button onClick={() => goToWeekOf(link.end)} disabled={!link.end} className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-digi-border text-[11px] text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-40" style={mf}><Flag className="w-3 h-3" /> Fin</button>
                      </div>
                    </div>
                  )}

                  {/* Etiquetas */}
                  {t && (t.values.length > 0 || t.talents.length > 0) && (
                    <div className="flex flex-wrap gap-1">
                      {t.values.map((v) => <span key={`v-${v}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10px] text-violet-300" style={mf}><Gem className="w-2.5 h-2.5" />{VALOR_LABEL[v] || v}</span>)}
                      {t.talents.map((tal) => <span key={`t-${tal}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] text-sky-300" style={mf}><Sparkles className="w-2.5 h-2.5" />{tal}</span>)}
                    </div>
                  )}

                  {/* Contexto de Apoyo */}
                  {panelLoading ? (
                    <p className="text-[12px] text-digi-muted" style={mf}>Cargando contexto…</p>
                  ) : panelCtx && (
                    <div className="space-y-2.5 pt-1 border-t border-digi-border/60">
                      <CtxList title="Problema" items={panelCtx.problems.map((p) => p.title)} />
                      <CtxList title="Situaciones" items={panelCtx.situations} />
                      <CtxList title="Causas" items={panelCtx.causes} />
                    </div>
                  )}

                  {entry ? (
                    <button onClick={() => unassign(entry)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 mt-1 border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 rounded-md text-[12px] font-medium text-red-400 transition-colors" style={mf}>
                      <Trash2 className="w-3.5 h-3.5" /> Quitar del día
                    </button>
                  ) : (
                    <p className="text-[10.5px] text-sky-300/90 inline-flex items-start gap-1 pt-1" style={mf}><Lock className="w-3 h-3 mt-0.5 shrink-0" /> Fijada automáticamente por su {link?.source === 'ticket' ? 'ticket' : 'proyecto'}; no se mueve ni se quita, pero puedes marcar su estado.</p>
                  )}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {/* Burbuja flotante de etiquetas */}
      {bubble && (
        <div className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full -mt-2" style={{ left: bubble.x, top: bubble.y }}>
          <div className="p-2 rounded-md bg-digi-card border border-digi-border shadow-xl max-w-[240px]">
            <p className="text-[9.5px] uppercase tracking-wide text-digi-muted mb-1" style={df}>{bubble.kind === 'values' ? 'Valores' : 'Talentos'}</p>
            <div className="flex flex-wrap gap-1">
              {bubble.items.map((it, i) => (
                <span key={i} className={`px-1.5 py-0.5 rounded-full text-[10px] ${bubble.kind === 'values' ? 'bg-violet-500/15 text-violet-300' : 'bg-sky-500/15 text-sky-300'}`} style={mf}>{it}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Burbuja flotante con detalles del ticket/proyecto (hover sobre el candado) */}
      {linkBubble && (
        <div className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full -mt-2" style={{ left: linkBubble.x, top: linkBubble.y }}>
          <div className="p-2.5 rounded-md bg-digi-card border border-digi-border shadow-xl w-[220px]">
            <p className="text-[9.5px] uppercase tracking-wide text-sky-400 mb-0.5 inline-flex items-center gap-1" style={df}>
              {linkBubble.link.source === 'ticket' ? <Ticket className="w-3 h-3" /> : <FolderKanban className="w-3 h-3" />} {linkBubble.link.source === 'ticket' ? 'Ticket' : 'Proyecto'}
            </p>
            <p className="text-[12px] font-medium text-digi-text leading-snug" style={mf}>{linkBubble.link.title}</p>
            {linkBubble.link.status && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Estado: {linkBubble.link.status}</p>}
            <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Del {fmtDay(linkBubble.link.start)} al {fmtDay(linkBubble.link.end)}</p>
            {linkBubble.link.description && <p className="text-[11px] text-digi-muted/90 mt-1 line-clamp-3 leading-snug" style={mf}>{linkBubble.link.description}</p>}
          </div>
        </div>
      )}

      {/* Editor de etiquetas */}
      <PixelModal open={!!editing} onClose={() => !savingLabels && setEditing(null)} title={editing ? `Etiquetas — ${editing.title}` : 'Etiquetas'}>
        <div className="space-y-4">
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Asigna <span className="text-digi-text font-medium">valores</span> y <span className="text-digi-text font-medium">talentos</span> a esta tarea. Puedes elegir varios de cada uno. Con al menos una etiqueta, la tarea se podrá arrastrar al horario.
          </p>
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-digi-text mb-1.5" style={df}><Gem className="w-3.5 h-3.5 text-accent" /> Valores</label>
            <MultiSelectSearch options={VALOR_OPTIONS} selected={draftValues} onChange={setDraftValues} placeholder="Buscar valor…" />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-[12px] font-semibold text-digi-text mb-1.5" style={df}><Sparkles className="w-3.5 h-3.5 text-accent" /> Talentos</label>
            <MultiSelectSearch options={TALENTO_OPTIONS} selected={draftTalents} onChange={setDraftTalents} placeholder="Buscar talento…" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setEditing(null)} disabled={savingLabels} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-50" style={mf}>Cancelar</button>
            <button onClick={saveLabels} disabled={savingLabels} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>{savingLabels ? 'Guardando…' : 'Guardar etiquetas'}</button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}

function CtxList({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted mb-1" style={df}>{title}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((it, i) => <span key={i} className="px-2 py-0.5 rounded-md bg-digi-darker/60 border border-digi-border/70 text-[11px] text-digi-text" style={mf}>{it}</span>)}
      </div>
    </div>
  );
}
