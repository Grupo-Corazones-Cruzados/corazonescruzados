'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, CheckCheck, Check, Circle } from 'lucide-react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelInput from '@/components/ui/PixelInput';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { FilaMarcable } from '@/components/ui/ListaMarcable';
import { BTN_PRIMARY, BTN_ICONO_PRIMARIO } from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface WorkTask { id: number; title: string; created_at: string; completed_at: string | null }

const hora = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Ventana FLOTANTE de las tareas de una sesión de «Trabajando» (Fernando, 2026-10-01).
 *
 * Cada tarea se guarda al agregarla, con su fecha y hora. La casilla es SOLO VISUAL: no se
 * guarda, vive en esta ventana. Lo que da las tareas por hechas es «Completado», que las
 * marca todas a la vez y devuelve el estado a «Conectado» (`onCompleted`).
 */
export default function WorkTasksWindow({
  open, onClose, onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/members/calendar/work');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setTasks(d.data || []);
    } catch { toast.error('No se pudieron cargar las tareas'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const add = async () => {
    const t = title.trim();
    if (!t || adding) return;
    setAdding(true);
    try {
      const res = await fetch('/api/members/calendar/work', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo agregar la tarea');
      setTasks((ts) => [...ts, d.data]);
      setTitle('');
    } catch (err: any) { toast.error(err?.message || 'No se pudo agregar la tarea'); }
    finally { setAdding(false); }
  };

  const remove = async (id: number) => {
    const prev = tasks;
    setTasks((ts) => ts.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/members/calendar/work?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'No se pudo eliminar'); }
    } catch (err: any) { setTasks(prev); toast.error(err?.message || 'No se pudo eliminar'); }
  };

  const toggle = (id: number) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const complete = async () => {
    if (completing || tasks.length === 0) return;
    setCompleting(true);
    try {
      const res = await fetch('/api/members/calendar/work/complete', { method: 'POST' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'No se pudo completar'); }
      toast.success('Tareas completadas · Disponibilidad: Conectado');
      setChecked(new Set());
      onCompleted();
    } catch (err: any) { toast.error(err?.message || 'No se pudo completar'); }
    finally { setCompleting(false); }
  };

  return (
    <FloatingWindow open={open} onClose={onClose} title="Trabajando · tareas" initialWidth={440} initialHeight={520} minWidth={300}>
      <div className="flex flex-col min-h-full gap-3">
        <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <div className="flex-1 min-w-0">
            <PixelInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} placeholder="Nueva tarea" aria-label="Nueva tarea" autoFocus />
          </div>
          <button type="submit" disabled={adding || !title.trim()} className={`${BTN_ICONO_PRIMARIO} disabled:opacity-50`} aria-label="Agregar tarea" title="Agregar tarea">
            <Plus className="w-4 h-4" />
          </button>
        </form>

        <div className="flex-1 min-h-0">
          {loading ? (
            <p className="text-[12.5px] text-digi-muted text-center py-6" style={mf}>Cargando…</p>
          ) : tasks.length === 0 ? (
            <p className="text-[12.5px] text-digi-muted text-center py-6" style={mf}>Sin tareas todavía.</p>
          ) : (
            <ul className="rounded-lg border border-digi-border divide-y divide-digi-border overflow-hidden">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-1 pr-1.5">
                  <div className="flex-1 min-w-0">
                    <FilaMarcable marcada={checked.has(t.id)} etiqueta={t.title} nota={hora(t.created_at)} onClick={() => toggle(t.id)} />
                  </div>
                  <BotonQuitar etiqueta="Eliminar tarea" onClick={() => remove(t.id)} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-3 border-t border-digi-border">
          <button type="button" onClick={complete} disabled={completing || tasks.length === 0} className={BTN_PRIMARY} style={mf}
            title={tasks.length === 0 ? 'Agrega al menos una tarea' : 'Marca todas las tareas como hechas y pasa a Conectado'}>
            <CheckCheck className="w-4 h-4" /> {completing ? 'Completando…' : 'Completado'}
          </button>
        </div>
      </div>
    </FloatingWindow>
  );
}

/**
 * Las tareas de una sesión de «Trabajando» ya registrada, de solo lectura: va en la ventana
 * de detalle del bloque del calendario (`EventModal`).
 */
export function WorkTasksSummary({ eventId }: { eventId: string }) {
  const [tasks, setTasks] = useState<WorkTask[] | null>(null);
  useEffect(() => {
    let alive = true;
    setTasks(null);
    fetch(`/api/members/calendar/work?event=${encodeURIComponent(eventId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (alive) setTasks(d.data || []); })
      .catch(() => { if (alive) setTasks([]); toast.error('No se pudieron cargar las tareas de la sesión'); });
    return () => { alive = false; };
  }, [eventId]);

  return (
    <div style={mf}>
      <div className="text-[12px] font-medium text-digi-muted mb-1">Tareas de la sesión</div>
      {tasks === null ? (
        <p className="text-[12.5px] text-digi-muted py-2">Cargando…</p>
      ) : tasks.length === 0 ? (
        <p className="text-[12.5px] text-digi-muted py-2">No se registraron tareas.</p>
      ) : (
        <ul className="rounded-lg border border-digi-border divide-y divide-digi-border">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]"
              title={t.completed_at ? `Completada a las ${hora(t.completed_at)}` : 'Sin completar'}>
              {t.completed_at
                ? <Check className="w-3.5 h-3.5 shrink-0 text-green-500" />
                : <Circle className="w-3.5 h-3.5 shrink-0 text-digi-muted" />}
              <span className="flex-1 min-w-0 truncate text-digi-text">{t.title}</span>
              <span className="shrink-0 text-[11.5px] text-digi-muted tabular-nums">{hora(t.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
