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
import { Plus, Trash2, Save, X, Gem, Sparkles, Users, UserRound } from 'lucide-react';

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

  useEffect(() => { if (open) { setTasks(initialTasks); setUser(null); setScope('user'); setDraft(emptyDraft()); } }, [open, initialTasks]);

  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleWeekday = (dow: number) => setDraft((d) => ({ ...d, weekdays: d.weekdays.includes(dow) ? d.weekdays.filter((x) => x !== dow) : [...d.weekdays, dow].sort() }));

  // El formulario se habilita si es "todos" o si hay un usuario elegido.
  const formReady = scope === 'all' || !!user;

  const addTask = () => {
    if (!formReady) return;
    if (!draft.title.trim()) return;
    const base = {
      title: draft.title.trim(), detail: draft.detail.trim(),
      valores: draft.valores, talentos: draft.talentos,
      daysCount: Math.max(1, draft.daysCount || 1),
      weekdays: draft.weekdays,
      allDay: draft.allDay,
      startTime: draft.startTime, endTime: draft.endTime,
    };
    const t: TaskProgram = scope === 'all'
      ? { scope: 'all', userKind: 'member', userId: '', userName: 'Todos los usuarios', ...base }
      : { scope: 'user', userKind: user!.kind, userId: user!.id, userName: user!.name, ...base };
    setTasks((ts) => [...ts, t]);
    setDraft(emptyDraft());
  };
  const removeTask = (i: number) => setTasks((ts) => ts.filter((_, k) => k !== i));

  // Resumen de presencia: ventana + filtro de días + horario/todo el día (combinados).
  const spanLabel = (t: TaskProgram) => {
    const parts = [`${t.daysCount} día(s)`];
    parts.push(t.weekdays.length ? t.weekdays.map((d) => DAY_LABELS_ES_SHORT[d]).join(', ') : 'todos los días');
    parts.push(t.allDay ? 'todo el día' : `${t.startTime}–${t.endTime}`);
    return parts.join(' · ');
  };

  return (
    <FloatingWindow open={open} onClose={onClose} title="Generar tareas" initialWidth={860} initialHeight={640}>
      <div className="flex gap-3 h-full min-h-0">
        {/* Selección de usuario (se atenúa si el alcance es "todos") */}
        <div className={`w-[230px] shrink-0 self-stretch flex flex-col min-h-0 transition-opacity ${scope === 'all' ? 'opacity-40 pointer-events-none' : ''}`}>
          <UsersList selected={user} onSelect={setUser} className="flex-1 min-h-0 overflow-y-auto" />
        </div>

        {/* Formulario + lista de tareas agregadas */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Alcance: todos los usuarios vs. usuario específico */}
          <div>
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

          {scope === 'user' && !user ? (
            <div className="flex-1 flex items-center justify-center text-center px-4 border border-dashed border-digi-border rounded-lg">
              <p className="text-[12.5px] text-digi-muted" style={mf}>Selecciona un candidato o miembro para programarle una tarea, o cambia el alcance a “Todos los usuarios”.</p>
            </div>
          ) : (
            <div className="border border-digi-border rounded-lg p-3 space-y-3">
              <p className="text-[12px] font-semibold text-digi-text inline-flex items-center gap-1.5" style={mf}>
                Nueva tarea para {scope === 'all'
                  ? <span className="text-accent inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> todos los usuarios</span>
                  : <span className="text-accent">{user!.name}</span>}
              </p>
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

              <button type="button" onClick={addTask} disabled={!draft.title.trim()}
                className={`${BTN_PRIMARY} w-full disabled:opacity-50`}><Plus className="w-4 h-4" /> Agregar tarea</button>
            </div>
          )}

          {/* Tareas programadas */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted mb-1.5" style={df}>Tareas programadas · {tasks.length}</p>
            {tasks.length === 0 ? (
              <p className="text-[12px] text-digi-muted" style={mf}>Aún no has agregado tareas.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t, i) => (
                  <div key={i} className="rounded-lg border border-digi-border bg-digi-darker/40 p-2.5 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium text-digi-text truncate" style={mf}>{t.title}</p>
                      <p className="text-[11px] text-digi-muted truncate inline-flex items-center gap-1" style={mf}>
                        {t.scope === 'all' ? <Users className="w-3 h-3 text-accent shrink-0" /> : <UserRound className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{t.userName} · {spanLabel(t)}</span>
                      </p>
                      {(t.valores.length > 0 || t.talentos.length > 0) && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.valores.map((v) => <span key={`v-${v}`} className="text-[10px] px-1.5 py-0.5 rounded bg-accent-light text-accent" style={mf}>{VALOR_LABEL[v] || v}</span>)}
                          {t.talentos.slice(0, 3).map((v) => <span key={`t-${v}`} className="text-[10px] px-1.5 py-0.5 rounded bg-black/[0.05] text-digi-muted" style={mf}>{v}</span>)}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeTask(i)} title="Quitar" className="text-digi-muted hover:text-red-600 shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
            <button type="button" onClick={onClose} className={BTN_SECONDARY}><X className="w-4 h-4" /> Cancelar</button>
            <button type="button" onClick={() => { onSave(tasks); onClose(); }} className={BTN_PRIMARY}><Save className="w-4 h-4" /> Guardar tareas</button>
          </div>
        </div>
      </div>
    </FloatingWindow>
  );
}
