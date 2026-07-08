'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, CalendarClock, ListTodo, GripVertical, MousePointerClick, Tag, X, Gem, Sparkles } from 'lucide-react';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';
import PixelModal from '@/components/ui/PixelModal';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { VALORES, VALOR_LABEL } from '@/lib/centralized/valores';
import { TALENTOS } from '@/lib/centralized/talentos';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const DAY_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const startOfDay = (d: Date) => { const r = new Date(d); r.setHours(0, 0, 0, 0); return r; };
const addDays = (d: Date, n: number) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface Task { id: number; title: string; description: string | null; problems: { title: string; dimension: string | null }[]; values: string[]; talents: string[] }
interface ScheduleEntry { id: number; alternativeId: number; day: string }

const VALOR_OPTIONS = VALORES.map((v) => ({ value: v.key, label: v.label }));
const TALENTO_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));

/**
 * Sistema "Horario de Vida". Las TAREAS son las alternativas del sistema de Apoyo que
 * aún no se han convertido en solución. Cada tarea debe recibir ETIQUETAS (valores y/o
 * talentos) antes de poder arrastrarse a un día de la semana del usuario.
 */
export default function HorarioDeVidaSystem({ isAdmin: _isAdmin }: { system?: any; isAdmin: boolean }) {
  const [selected, setSelected] = useState<SelectedUser | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfDay(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Editor de etiquetas
  const [editing, setEditing] = useState<Task | null>(null);
  const [draftValues, setDraftValues] = useState<string[]>([]);
  const [draftTalents, setDraftTalents] = useState<string[]>([]);
  const [savingLabels, setSavingLabels] = useState(false);

  // Drag & drop (HTML5 nativo)
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const today = startOfDay(new Date());
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const enabled = !!selected;

  const load = useCallback(async () => {
    if (!selected) { setTasks([]); setSchedule([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/centralized/horario?subject_kind=${selected.kind}&subject_id=${selected.id}`);
      const d = await res.json();
      setTasks(d.data?.tasks || []);
      setSchedule(d.data?.schedule || []);
    } catch { setTasks([]); setSchedule([]); }
    finally { setLoading(false); }
  }, [selected]);

  useEffect(() => { load(); }, [load]);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const hasLabels = (t: Task) => t.values.length > 0 || t.talents.length > 0;
  const scheduleByDay = useMemo(() => {
    const m = new Map<string, ScheduleEntry[]>();
    for (const e of schedule) { const a = m.get(e.day) || []; a.push(e); m.set(e.day, a); }
    return m;
  }, [schedule]);

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

  const assign = async (task: Task, day: Date) => {
    if (!selected) return;
    if (!hasLabels(task)) { toast.error('Agrega etiquetas a la tarea antes de programarla'); return; }
    const dayStr = ymd(day);
    try {
      const res = await fetch('/api/centralized/horario/schedule', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject_kind: selected.kind, subject_id: selected.id, alternativeId: task.id, day: dayStr }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      const d = await res.json();
      setSchedule((s) => [...s, { id: d.id, alternativeId: task.id, day: dayStr }]);
      toast.success(`"${task.title}" programada`);
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const unassign = async (entry: ScheduleEntry) => {
    setSchedule((s) => s.filter((e) => e.id !== entry.id)); // optimista
    try {
      const res = await fetch('/api/centralized/horario/schedule', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: entry.id }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); load(); }
  };

  const onDropDay = (day: Date) => {
    setDragOverDay(null);
    const id = dragId;
    setDragId(null);
    if (id == null) return;
    const t = taskById.get(id);
    if (t) assign(t, day);
  };

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
              <span className="ml-auto text-[11px] text-digi-muted tabular-nums" style={mf}>{tasks.length}</span>
            </div>
            <div className="p-2.5 space-y-2 max-h-[calc(100dvh-220px)] overflow-y-auto">
              {loading ? (
                <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Cargando…</p>
              ) : tasks.length === 0 ? (
                <div className="rounded-lg border border-dashed border-digi-border/80 bg-digi-darker/40 p-4 text-center">
                  <GripVertical className="w-5 h-5 text-digi-muted/50 mx-auto mb-1.5" />
                  <p className="text-[12px] text-digi-muted" style={mf}>Sin tareas. Crea alternativas en Apoyo y Autoayuda para este usuario.</p>
                </div>
              ) : (
                tasks.map((t) => {
                  const ready = hasLabels(t);
                  const scheduledCount = schedule.filter((e) => e.alternativeId === t.id).length;
                  return (
                    <div key={t.id}
                      draggable={ready}
                      onDragStart={(e) => { if (!ready) return; setDragId(t.id); e.dataTransfer.setData('text/plain', String(t.id)); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragEnd={() => { setDragId(null); setDragOverDay(null); }}
                      className={`rounded-lg border p-2.5 bg-digi-darker/50 transition-colors ${ready ? 'border-digi-border cursor-grab active:cursor-grabbing hover:border-accent/50' : 'border-dashed border-digi-border/70'} ${dragId === t.id ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-1.5">
                        <GripVertical className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${ready ? 'text-digi-muted' : 'text-digi-muted/40'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-digi-text leading-snug" style={mf}>{t.title}</p>
                          {t.problems.length > 0 && (
                            <p className="text-[10.5px] text-digi-muted truncate mt-0.5" style={mf}>Para: {t.problems.map((p) => p.title).join(', ')}</p>
                          )}
                        </div>
                      </div>

                      {/* Etiquetas */}
                      {(t.values.length > 0 || t.talents.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {t.values.map((v) => (
                            <span key={`v-${v}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10px] text-violet-300" style={mf}><Gem className="w-2.5 h-2.5" />{VALOR_LABEL[v] || v}</span>
                          ))}
                          {t.talents.map((tal) => (
                            <span key={`t-${tal}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10px] text-sky-300" style={mf}><Sparkles className="w-2.5 h-2.5" />{tal}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        <button onClick={() => openEditor(t)} className="inline-flex items-center gap-1 text-[11px] text-accent hover:text-accent-hover transition-colors" style={mf}>
                          <Tag className="w-3 h-3" /> {ready ? 'Editar etiquetas' : 'Agregar etiquetas'}
                        </button>
                        {scheduledCount > 0 && <span className="text-[10px] text-digi-muted tabular-nums" style={mf}>{scheduledCount} en agenda</span>}
                      </div>
                      {!ready && <p className="text-[10px] text-digi-muted/70 mt-1" style={mf}>Necesita etiquetas para arrastrarla al horario.</p>}
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
                        {entries.length === 0 ? (
                          <div className="h-full min-h-[220px] flex items-center justify-center text-center">
                            <span className="text-[10.5px] text-digi-muted/50" style={mf}>{over ? 'Suelta para programar' : 'Arrastra tareas aquí'}</span>
                          </div>
                        ) : (
                          entries.map((e) => {
                            const t = taskById.get(e.alternativeId);
                            return (
                              <div key={e.id} className="group flex items-start gap-1 rounded-md border border-accent/25 bg-accent-light px-2 py-1.5">
                                <span className="text-[11px] text-accent leading-snug flex-1 min-w-0" style={mf}>{t?.title || 'Tarea'}</span>
                                <button onClick={() => unassign(e)} className="opacity-0 group-hover:opacity-100 text-accent/70 hover:text-accent transition-opacity shrink-0" aria-label="Quitar"><X className="w-3 h-3" /></button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
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
