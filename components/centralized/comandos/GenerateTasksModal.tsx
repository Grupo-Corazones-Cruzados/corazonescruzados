'use client';

import { useEffect, useState } from 'react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelInput from '@/components/ui/PixelInput';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { VALORES } from '@/lib/centralized/valores';
import { TALENTOS } from '@/lib/centralized/talentos';
import { DAY_LABELS_ES_SHORT } from '@/lib/calendar/recurrence';
import type { TaskProgram } from '@/lib/centralized/comandos';
import { Plus, Trash2, Save, X, Gem, Sparkles, Users, UserRound, ListChecks } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const VALOR_OPTIONS = VALORES.map((v) => ({ value: v.key, label: v.label }));
const TALENTO_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));
const VALOR_LABEL: Record<string, string> = Object.fromEntries(VALORES.map((v) => [v.key, v.label]));

type Draft = {
  title: string; detail: string; valores: string[]; talentos: string[];
  daysCount: number; weekdays: number[]; allDay: boolean; startTime: string; endTime: string;
};
const emptyDraft = (): Draft => ({ title: '', detail: '', valores: [], talentos: [], daysCount: 7, weekdays: [], allDay: false, startTime: '09:00', endTime: '10:00' });

/**
 * Modal de "Generar tareas": se elige un usuario y se le programan tareas (etiquetas de
 * valores/talentos, detalle, recurrencia, día de inicio y modo de presencia). Devuelve el
 * arreglo de TaskProgram para guardarlo en la config de la función. La generación real de
 * las tareas ocurre al ACTIVAR la política (iteración de enforcement).
 */
export default function GenerateTasksModal({
  open, initialTasks, onSave, onClose,
}: {
  open: boolean;
  initialTasks: TaskProgram[];
  onSave: (tasks: TaskProgram[]) => void;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<TaskProgram[]>(initialTasks);
  const [user, setUser] = useState<SelectedUser | null>(null);
  // Alcance de la tarea: 'user' = usuario elegido en la lista; 'all' = todos los usuarios.
  const [scope, setScope] = useState<'user' | 'all'>('user');
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  // Índice de la tarea que se está EDITANDO (null = se está creando una nueva).
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // Burbuja flotante que muestra las etiquetas de una tarjeta al pasar el puntero (igual que el Horario de Vida).
  const [bubble, setBubble] = useState<{ kind: 'values' | 'talents'; items: string[]; x: number; y: number } | null>(null);
  const showBubble = (el: HTMLElement, kind: 'values' | 'talents', items: string[]) => {
    const r = el.getBoundingClientRect();
    setBubble({ kind, items, x: r.left + r.width / 2, y: r.top });
  };

  useEffect(() => { if (open) { setTasks(initialTasks); setUser(null); setScope('user'); setDraft(emptyDraft()); setBubble(null); setEditingIndex(null); } }, [open, initialTasks]);

  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleWeekday = (dow: number) => setDraft((d) => ({ ...d, weekdays: d.weekdays.includes(dow) ? d.weekdays.filter((x) => x !== dow) : [...d.weekdays, dow].sort() }));

  // El formulario se habilita si es "todos" o si hay un usuario elegido.
  const formReady = scope === 'all' || !!user;

  // Construye el TaskProgram a partir del formulario actual (o null si no está listo).
  const buildTask = (): TaskProgram | null => {
    if (!formReady || !draft.title.trim()) return null;
    const base = {
      title: draft.title.trim(), detail: draft.detail.trim(),
      valores: draft.valores, talentos: draft.talentos,
      daysCount: Math.max(1, draft.daysCount || 1),
      weekdays: draft.weekdays,
      allDay: draft.allDay,
      startTime: draft.startTime, endTime: draft.endTime,
    };
    return scope === 'all'
      ? { scope: 'all', userKind: 'member', userId: '', userName: 'Todos los usuarios', ...base }
      : { scope: 'user', userKind: user!.kind, userId: user!.id, userName: user!.name, ...base };
  };

  // Agrega una tarea nueva o, si se está editando, guarda los cambios sobre la misma.
  const submitTask = () => {
    const t = buildTask();
    if (!t) return;
    if (editingIndex != null) {
      setTasks((ts) => ts.map((x, k) => (k === editingIndex ? t : x)));
      setEditingIndex(null);
    } else {
      setTasks((ts) => [...ts, t]);
    }
    setDraft(emptyDraft());
  };

  // Carga una tarea existente en el formulario para editarla.
  const editTask = (i: number) => {
    const t = tasks[i];
    if (!t) return;
    setEditingIndex(i);
    setDraft({
      title: t.title, detail: t.detail,
      valores: t.valores, talentos: t.talentos,
      daysCount: t.daysCount, weekdays: t.weekdays,
      allDay: t.allDay, startTime: t.startTime, endTime: t.endTime,
    });
    if (t.scope === 'all') { setScope('all'); }
    else { setScope('user'); setUser({ kind: t.userKind, id: t.userId, name: t.userName }); }
  };

  const cancelEdit = () => { setEditingIndex(null); setDraft(emptyDraft()); };
  const removeTask = (i: number) => {
    setTasks((ts) => ts.filter((_, k) => k !== i));
    // Mantén coherente el índice en edición: si se borra la que se edita, salir de edición;
    // si se borra una anterior, corre el índice una posición.
    setEditingIndex((cur) => (cur == null ? null : (i === cur ? null : (i < cur ? cur - 1 : cur))));
    if (editingIndex === i) setDraft(emptyDraft());
  };

  // Resumen de presencia: ventana + filtro de días + horario/todo el día (combinados).
  const spanLabel = (t: TaskProgram) => {
    const parts = [`${t.daysCount} día(s)`];
    parts.push(t.weekdays.length ? t.weekdays.map((d) => DAY_LABELS_ES_SHORT[d]).join(', ') : 'todos los días');
    parts.push(t.allDay ? 'todo el día' : `${t.startTime}–${t.endTime}`);
    return parts.join(' · ');
  };

  return (
    <FloatingWindow open={open} onClose={onClose} title="Generar tareas" initialWidth={1040} initialHeight={640} minWidth={720}>
      <div className="flex flex-col h-full min-h-0 gap-3">
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Selección de usuario (se atenúa si el alcance es "todos") */}
          <div className={`w-[210px] shrink-0 self-stretch flex flex-col min-h-0 transition-opacity ${scope === 'all' ? 'opacity-40 pointer-events-none' : ''}`}>
            <UsersList selected={user} onSelect={setUser} className="flex-1 min-h-0 overflow-y-auto" />
          </div>

          {/* Formulario (columna central, con scroll propio) */}
          <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
            {/* Alcance: todos los usuarios vs. usuario específico */}
            <div className="shrink-0">
              <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>Alcance de la tarea</div>
              <div className="flex gap-2">
                {([
                  ['all', 'Todos los usuarios', Users],
                  ['user', 'Usuario específico', UserRound],
                ] as const).map(([val, label, Icon]) => (
                  <button key={val} type="button" onClick={() => setScope(val)}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[12.5px] border rounded-md transition-colors ${scope === val ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:text-digi-text'}`} style={mf}>
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5">
              {scope === 'user' && !user ? (
                <div className="h-full flex items-center justify-center text-center px-4 border border-dashed border-digi-border rounded-lg">
                  <p className="text-[12.5px] text-digi-muted" style={mf}>Selecciona un candidato o miembro para programarle una tarea, o cambia el alcance a “Todos los usuarios”.</p>
                </div>
              ) : (
                <div className={`border rounded-lg p-3 space-y-3 ${editingIndex != null ? 'border-accent' : 'border-digi-border'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-digi-text inline-flex items-center gap-1.5 min-w-0" style={mf}>
                      <span className="shrink-0">{editingIndex != null ? 'Editar tarea' : 'Nueva tarea'} para</span>
                      {scope === 'all'
                        ? <span className="text-accent inline-flex items-center gap-1 shrink-0"><Users className="w-3.5 h-3.5" /> todos los usuarios</span>
                        : <span className="text-accent truncate">{user!.name}</span>}
                    </p>
                    {editingIndex != null && (
                      <button type="button" onClick={cancelEdit} className="shrink-0 text-[11px] text-digi-muted hover:text-digi-text inline-flex items-center gap-1" style={mf}><X className="w-3 h-3" /> Cancelar edición</button>
                    )}
                  </div>
                  <PixelInput label="TÍTULO" value={draft.title} onChange={(e) => upd('title', e.target.value)} placeholder="Ej. Rutina de ejercicio" />
                  <div>
                    <label className="text-[12px] font-medium text-digi-muted" style={mf}>Detalle</label>
                    <textarea value={draft.detail} onChange={(e) => upd('detail', e.target.value)} rows={2}
                      className="field-control w-full px-2.5 py-1.5 mt-1 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-muted mb-1" style={mf}><Gem className="w-3.5 h-3.5" /> Valores</label>
                      <MultiSelectSearch options={VALOR_OPTIONS} selected={draft.valores} onChange={(v) => upd('valores', v)} placeholder="Buscar valor…" />
                    </div>
                    <div>
                      <label className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-muted mb-1" style={mf}><Sparkles className="w-3.5 h-3.5" /> Talentos</label>
                      <MultiSelectSearch options={TALENTO_OPTIONS} selected={draft.talentos} onChange={(v) => upd('talentos', v)} placeholder="Buscar talento…" />
                    </div>
                  </div>

                  {/* Presencia: campos combinables (la ventana es el límite; los días, la recurrencia) */}
                  <div className="rounded-lg border border-digi-border p-3 space-y-3">
                    <PixelInput type="number" min={1} label="CANTIDAD DE DÍAS" value={draft.daysCount} onChange={(e) => upd('daysCount', Math.max(1, parseInt(e.target.value, 10) || 1))} />

                    <div>
                      <div className="text-[12px] font-medium text-digi-muted mb-1" style={mf}>Días de la semana</div>
                      <div className="flex gap-1 flex-wrap">
                        {DAY_LABELS_ES_SHORT.map((label, dow) => {
                          const active = draft.weekdays.includes(dow);
                          return (
                            <button key={dow} type="button" onClick={() => toggleWeekday(dow)}
                              className={`w-9 h-9 text-[12px] border rounded-md transition-colors ${active ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:text-digi-text'}`} style={mf}>{label}</button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-[13px] text-digi-text cursor-pointer" style={mf}>
                      <input type="checkbox" checked={draft.allDay} onChange={(e) => upd('allDay', e.target.checked)} className="accent-accent" />
                      Todo el día (ocupa toda la jornada)
                    </label>

                    {!draft.allDay && (
                      <div className="grid grid-cols-2 gap-3">
                        <PixelInput type="time" label="HORA DE INICIO" value={draft.startTime} onChange={(e) => upd('startTime', e.target.value)} />
                        <PixelInput type="time" label="HORA DE FIN" value={draft.endTime} onChange={(e) => upd('endTime', e.target.value)} />
                      </div>
                    )}
                  </div>

                  <button type="button" onClick={submitTask} disabled={!draft.title.trim()}
                    className={`${BTN_PRIMARY} w-full disabled:opacity-50`}>
                    {editingIndex != null ? <><Save className="w-4 h-4" /> Guardar cambios</> : <><Plus className="w-4 h-4" /> Agregar tarea</>}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Panel de tareas agregadas (derecha) — estilo del Horario de Vida */}
          <aside className="w-[268px] shrink-0 self-stretch bg-digi-card border border-digi-border rounded-lg overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-digi-dark border-b border-digi-border shrink-0">
              <ListChecks className="w-4 h-4 text-digi-muted" />
              <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Tareas</span>
              <span className="ml-auto text-[11px] text-digi-muted tabular-nums" style={mf}>{tasks.length}</span>
            </div>
            <div className="p-2.5 space-y-2 flex-1 min-h-0 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center px-3">
                  <p className="text-[12px] text-digi-muted" style={mf}>Aún no has agregado tareas. Complétalas en el formulario y pulsa “Agregar tarea”.</p>
                </div>
              ) : (
                tasks.map((t, i) => (
                  <div key={i} onClick={() => editTask(i)}
                    title="Editar esta tarea"
                    className={`rounded-lg border p-2.5 cursor-pointer transition-colors ${editingIndex === i ? 'border-accent ring-1 ring-accent bg-accent-light/20' : 'border-digi-border bg-digi-darker/40 hover:border-accent/50'}`}>
                    <div className="flex items-start gap-1.5">
                      {t.scope === 'all'
                        ? <Users className="w-3.5 h-3.5 mt-0.5 shrink-0 text-accent" />
                        : <UserRound className="w-3.5 h-3.5 mt-0.5 shrink-0 text-digi-muted" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-digi-text leading-snug" style={mf}>{t.title}</p>
                        <p className="text-[10.5px] text-digi-muted truncate mt-0.5" style={mf}>Para: {t.userName}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeTask(i); }} title="Quitar" className="text-digi-muted hover:text-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <p className="text-[10.5px] text-digi-muted/80 mt-1 ml-5" style={mf}>{spanLabel(t)}</p>
                    {(t.valores.length > 0 || t.talentos.length > 0) && (
                      <div className="flex items-center gap-1.5 mt-2 ml-5">
                        {t.valores.length > 0 && (
                          <button type="button"
                            onMouseEnter={(e) => showBubble(e.currentTarget, 'values', t.valores.map((v) => VALOR_LABEL[v] || v))}
                            onMouseLeave={() => setBubble(null)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-[10.5px] text-violet-300 cursor-default" style={mf}>
                            <Gem className="w-3 h-3" /> {t.valores.length}
                          </button>
                        )}
                        {t.talentos.length > 0 && (
                          <button type="button"
                            onMouseEnter={(e) => showBubble(e.currentTarget, 'talents', t.talentos)}
                            onMouseLeave={() => setBubble(null)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-400/30 text-[10.5px] text-sky-300 cursor-default" style={mf}>
                            <Sparkles className="w-3 h-3" /> {t.talentos.length}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t border-digi-border shrink-0">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}><X className="w-4 h-4" /> Cancelar</button>
          <button type="button" onClick={() => { onSave(tasks); onClose(); }} className={BTN_PRIMARY}><Save className="w-4 h-4" /> Guardar tareas</button>
        </div>
      </div>

      {/* Burbuja flotante de etiquetas (hover sobre los iconos de la tarjeta) */}
      {bubble && (
        <div className="fixed z-[80] pointer-events-none -translate-x-1/2 -translate-y-full -mt-2" style={{ left: bubble.x, top: bubble.y }}>
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
    </FloatingWindow>
  );
}
