'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CalendarDays, ChevronLeft, ChevronRight, Ticket, FolderKanban, Gem, Sparkles,
  CheckCircle2, XCircle, CircleDashed, Briefcase, Dumbbell, Brain, Users, CalendarRange, Lock,
} from 'lucide-react';
import { DIMENSION_COLOR, DIMENSION_LABEL } from '@/lib/centralized/apoyo';
import { VALOR_LABEL } from '@/lib/centralized/valores';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIM_ICON: Record<string, any> = { laboral: Briefcase, corporal: Dumbbell, mental: Brain, social: Users };

const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const longDate = (d: Date) => d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

type Status = 'pending' | 'completed' | 'failed';
interface TaskLink { source: 'ticket' | 'project'; title: string; status: string | null; start: string | null; end: string | null }
interface Task { id: number; title: string; description: string | null; problems: { title: string; dimension: string | null }[]; values: string[]; talents: string[]; link: TaskLink | null }
interface Sched { id: number; alternativeId: number; day: string; status: Status }
interface Auto { alternativeId: number; day: string; source: 'ticket' | 'project'; refTitle: string; status: Status }
interface Data { subject: { kind: string; id: string } | null; tasks: Task[]; schedule: Sched[]; auto: Auto[] }

type DayItem =
  | { kind: 'manual'; id: number; alternativeId: number; day: string; status: Status }
  | { kind: 'auto'; alternativeId: number; day: string; status: Status; source: 'ticket' | 'project'; refTitle: string };

/**
 * "Mi día": las tareas del USUARIO ACTUAL según su Horario de Vida. Vista principal =
 * las tareas de HOY; vista secundaria = tira de la semana y calendario del mes para
 * revisar otros días. Se pueden marcar completada/fallida/pendiente (afecta el perfil).
 */
export default function MiDiaPage() {
  const today = startOfDay(new Date());
  const todayStr = ymd(today);
  const [anchor, setAnchor] = useState<Date>(today);
  const [showMonth, setShowMonth] = useState(false);
  const [data, setData] = useState<Data>({ subject: null, tasks: [], schedule: [], auto: [] });
  const [loading, setLoading] = useState(true);

  const monthKey = `${anchor.getFullYear()}-${anchor.getMonth()}`;
  const monthGrid = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = ymd(monthGrid[0]), to = ymd(monthGrid[41]);
    try {
      const res = await fetch(`/api/centralized/horario/me?from=${from}&to=${to}`);
      const d = await res.json();
      setData(d.data || { subject: null, tasks: [], schedule: [], auto: [] });
    } catch { /* deja lo que haya */ }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);
  useEffect(() => { load(); }, [load]);

  const taskById = useMemo(() => new Map(data.tasks.map((t) => [t.id, t])), [data.tasks]);
  const countByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.schedule) m.set(e.day, (m.get(e.day) || 0) + 1);
    for (const e of data.auto) m.set(e.day, (m.get(e.day) || 0) + 1);
    return m;
  }, [data]);

  const anchorStr = ymd(anchor);
  const isToday = anchorStr === todayStr;
  const dayItems: DayItem[] = useMemo(() => {
    const manual = data.schedule.filter((e) => e.day === anchorStr).map((e) => ({ kind: 'manual' as const, id: e.id, alternativeId: e.alternativeId, day: e.day, status: e.status }));
    const auto = data.auto.filter((e) => e.day === anchorStr).map((e) => ({ kind: 'auto' as const, alternativeId: e.alternativeId, day: e.day, status: e.status, source: e.source, refTitle: e.refTitle }));
    return [...manual, ...auto];
  }, [data, anchorStr]);

  const weekStart = addDays(anchor, -anchor.getDay());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const setStatus = async (item: DayItem, status: Status) => {
    if (!data.subject) return;
    if (item.kind === 'manual') {
      setData((d) => ({ ...d, schedule: d.schedule.map((e) => (e.id === item.id ? { ...e, status } : e)) }));
      try {
        const res = await fetch('/api/centralized/horario/schedule', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, status }) });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
      } catch (e: any) { toast.error(e.message || 'Error'); load(); }
    } else {
      setData((d) => ({ ...d, auto: d.auto.map((e) => (e.alternativeId === item.alternativeId && e.day === item.day ? { ...e, status } : e)) }));
      try {
        const res = await fetch('/api/centralized/horario/auto-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject_kind: data.subject.kind, subject_id: data.subject.id, alternativeId: item.alternativeId, day: item.day, status }) });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
      } catch (e: any) { toast.error(e.message || 'Error'); load(); }
    }
  };

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold text-digi-text inline-flex items-center gap-2" style={df}><CalendarDays className="w-5 h-5 text-accent" /> Mi día</h1>
          <p className="text-[13px] text-digi-muted mt-0.5 capitalize" style={mf}>{isToday ? 'Hoy · ' : ''}{longDate(anchor)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isToday && <button onClick={() => setAnchor(today)} className="px-2.5 py-1.5 text-[12px] font-medium border border-digi-border rounded-md text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>Hoy</button>}
          <button onClick={() => setAnchor(startOfDay(addDays(anchor, -1)))} aria-label="Día anterior" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setAnchor(startOfDay(addDays(anchor, 1)))} aria-label="Día siguiente" className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setShowMonth((v) => !v)} className={`px-2.5 py-1.5 text-[12px] font-medium border rounded-md inline-flex items-center gap-1.5 transition-colors ${showMonth ? 'bg-accent-light border-accent text-accent' : 'border-digi-border text-digi-text hover:border-accent hover:text-accent'}`} style={mf}><CalendarRange className="w-3.5 h-3.5" /> Mes</button>
        </div>
      </div>

      {!loading && !data.subject ? (
        <div className="bg-digi-card border border-digi-border rounded-xl py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><CalendarDays className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Aún no tienes un horario asignado</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>Tus tareas aparecerán aquí cuando se te asignen en el Horario de Vida.</p>
        </div>
      ) : (
        <>
          {/* Vista secundaria: tira de la semana */}
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {weekDays.map((d) => {
              const ds = ymd(d); const sel = ds === anchorStr; const isT = ds === todayStr; const c = countByDay.get(ds) || 0;
              return (
                <button key={ds} onClick={() => setAnchor(startOfDay(d))}
                  className={`rounded-lg border p-2 text-center transition-colors ${sel ? 'border-accent bg-accent-light' : 'border-digi-border hover:border-accent/50'}`}>
                  <div className="text-[10px] uppercase tracking-wide text-digi-muted" style={mf}>{DAY_ABBR[d.getDay()]}</div>
                  <div className={`text-[15px] font-semibold leading-tight ${isT ? 'text-accent' : sel ? 'text-accent' : 'text-digi-text'}`} style={mf}>{d.getDate()}</div>
                  <div className="h-4 flex items-center justify-center">
                    {c > 0 && <span className={`text-[9.5px] px-1.5 rounded-full tabular-nums ${sel ? 'bg-accent/20 text-accent' : 'bg-black/[0.06] text-digi-muted'}`} style={mf}>{c}</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Vista secundaria: calendario del mes */}
          {showMonth && (
            <div className="mb-4 rounded-xl border border-digi-border bg-digi-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-semibold text-digi-text capitalize" style={df}>{MONTH[anchor.getMonth()]} {anchor.getFullYear()}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setAnchor(startOfDay(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1)))} aria-label="Mes anterior" className="w-7 h-7 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronLeft className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setAnchor(startOfDay(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)))} aria-label="Mes siguiente" className="w-7 h-7 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:text-accent hover:border-accent transition-colors"><ChevronRight className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-digi-muted mb-1" style={mf}>{DAY_ABBR.map((a) => <span key={a}>{a}</span>)}</div>
              <div className="grid grid-cols-7 gap-1">
                {monthGrid.map((d) => {
                  const ds = ymd(d); const c = countByDay.get(ds) || 0; const inMonth = d.getMonth() === anchor.getMonth(); const sel = ds === anchorStr; const isT = ds === todayStr;
                  return (
                    <button key={ds} onClick={() => { setAnchor(startOfDay(d)); setShowMonth(false); }}
                      className={`aspect-square rounded-md flex flex-col items-center justify-center transition-colors ${sel ? 'bg-accent-light border border-accent' : inMonth ? 'hover:bg-black/[0.03]' : 'opacity-40'} ${isT && !sel ? 'ring-1 ring-inset ring-accent/50' : ''}`}>
                      <span className={`text-[12px] ${isT || sel ? 'text-accent font-semibold' : 'text-digi-text'}`} style={mf}>{d.getDate()}</span>
                      {c > 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent mt-0.5" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vista principal: tareas del día seleccionado */}
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-[12px] font-semibold uppercase tracking-wide text-digi-muted" style={df}>{isToday ? 'Tareas de hoy' : 'Tareas del día'}</h2>
            {dayItems.length > 0 && <span className="text-[11px] text-digi-muted tabular-nums" style={mf}>· {dayItems.length}</span>}
          </div>

          {loading ? (
            <div className="bg-digi-card border border-digi-border rounded-xl py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
          ) : dayItems.length === 0 ? (
            <div className="bg-digi-card border border-digi-border rounded-xl py-14 text-center">
              <div className="w-11 h-11 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><CheckCircle2 className="w-5 h-5 text-digi-muted" /></div>
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin tareas {isToday ? 'para hoy' : 'este día'}</p>
              <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>Nada asignado en tu horario para esta fecha.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayItems.map((item) => {
                const t = taskById.get(item.alternativeId);
                const dims = Array.from(new Set((t?.problems || []).map((p) => p.dimension).filter(Boolean))) as string[];
                return (
                  <div key={item.kind === 'manual' ? `m-${item.id}` : `a-${item.alternativeId}-${item.day}`}
                    className={`rounded-xl border bg-digi-card p-3.5 flex items-start gap-3 ${item.status === 'completed' ? 'border-emerald-400/40' : item.status === 'failed' ? 'border-red-400/40' : 'border-digi-border'}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {dims.map((dm) => { const DI = DIM_ICON[dm]; return (
                          <span key={dm} title={`Dimensión: ${DIMENSION_LABEL[dm] || dm}`} className="shrink-0 inline-flex">
                            {DI ? <DI className="w-3.5 h-3.5" style={{ color: DIMENSION_COLOR[dm] || '#888' }} /> : null}
                          </span>
                        ); })}
                        <h3 className="text-[14px] font-semibold text-digi-text leading-snug min-w-0 truncate" style={mf}>{t?.title || 'Tarea'}</h3>
                        {item.kind === 'auto' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/30 text-[10px] text-sky-500" style={mf}>
                            <Lock className="w-2.5 h-2.5" /> {item.source === 'ticket' ? <Ticket className="w-2.5 h-2.5" /> : <FolderKanban className="w-2.5 h-2.5" />} {item.refTitle}
                          </span>
                        )}
                      </div>
                      {t?.description && <p className="text-[12px] text-digi-muted mt-1 leading-relaxed line-clamp-2" style={mf}>{t.description}</p>}
                      {t && (t.values.length > 0 || t.talents.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {t.values.map((v) => <span key={`v-${v}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-400/25 text-[10px] text-violet-500" style={mf}><Gem className="w-2.5 h-2.5" />{VALOR_LABEL[v] || v}</span>)}
                          {t.talents.map((tal) => <span key={`t-${tal}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-400/25 text-[10px] text-sky-500" style={mf}><Sparkles className="w-2.5 h-2.5" />{tal}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBtn active={item.status === 'completed'} tone="completed" onClick={() => setStatus(item, 'completed')} Icon={CheckCircle2} label="Completada" />
                      <StatusBtn active={item.status === 'failed'} tone="failed" onClick={() => setStatus(item, 'failed')} Icon={XCircle} label="Fallida" />
                      <StatusBtn active={item.status === 'pending'} tone="pending" onClick={() => setStatus(item, 'pending')} Icon={CircleDashed} label="Pendiente" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatusBtn({ active, tone, onClick, Icon, label }: { active: boolean; tone: 'completed' | 'failed' | 'pending'; onClick: () => void; Icon: any; label: string }) {
  const cls = tone === 'completed'
    ? (active ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-600' : 'border-digi-border text-digi-muted hover:border-emerald-400/40 hover:text-emerald-600')
    : tone === 'failed'
      ? (active ? 'bg-red-500/20 border-red-400/50 text-red-600' : 'border-digi-border text-digi-muted hover:border-red-400/40 hover:text-red-600')
      : (active ? 'bg-black/[0.06] border-digi-border text-digi-text' : 'border-digi-border text-digi-muted hover:text-digi-text');
  return (
    <button onClick={onClick} title={label} aria-label={label} className={`w-8 h-8 flex items-center justify-center rounded-md border transition-colors ${cls}`}>
      <Icon className="w-4 h-4" />
    </button>
  );
}
