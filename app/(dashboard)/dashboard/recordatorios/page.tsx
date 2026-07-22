'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { AlarmClock, Plus, X, Paperclip, Trash2, Check, Download, ListChecks, Video } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Task = { id: string; text: string; done: boolean };
type Attach = { id?: number; filename: string; content_type?: string | null; kind?: string; size?: number | null; data?: string };
type Reminder = {
  id: number; title: string; notes?: string; remind_at?: string | null; tasks: Task[];
  status: string; source: string; source_event_id?: string | null; attachment_count?: number; attachments?: Attach[];
};

/** ISO → valor para <input type="datetime-local"> en hora local. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtDate(iso?: string | null): string {
  if (!iso) return 'Sin fecha';
  return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
function relative(iso?: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'vencido';
  const h = Math.floor(ms / 3600000);
  if (h < 1) return `en ${Math.max(1, Math.round(ms / 60000))} min`;
  if (h < 24) return `en ${h} h`;
  return `en ${Math.round(h / 24)} d`;
}

export default function RecordatoriosPage() {
  const [list, setList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [attachments, setAttachments] = useState<Attach[]>([]);

  const fetchList = useCallback(async () => {
    try {
      const r = await fetch('/api/reminders');
      const d = await r.json();
      setList(d.data || []);
    } catch { toast.error('Error al cargar recordatorios'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchList(); }, [fetchList]);

  const resetForm = () => { setTitle(''); setNotes(''); setRemindAt(''); setTasks([]); setNewTask(''); setAttachments([]); };

  const openCreate = () => { setEditId(null); resetForm(); setModal(true); };

  const openEdit = async (id: number) => {
    try {
      const r = await fetch(`/api/reminders/${id}`);
      const { data } = await r.json();
      setEditId(id);
      setTitle(data.title || '');
      setNotes(data.notes || '');
      setRemindAt(toLocalInput(data.remind_at));
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
      setAttachments(data.attachments || []);
      setNewTask('');
      setModal(true);
    } catch { toast.error('Error al abrir el recordatorio'); }
  };

  // Enlace profundo desde la reunión (?open=<id>) → abre ese recordatorio.
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) openEdit(Number(openId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTask = () => { const t = newTask.trim(); if (!t) return; setTasks(p => [...p, { id: `t${Date.now()}`, text: t, done: false }]); setNewTask(''); };
  const toggleTask = (id: string) => setTasks(p => p.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTask = (id: string) => setTasks(p => p.filter(t => t.id !== id));

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 9 * 1024 * 1024) { toast.error(`"${f.name}" supera 9MB`); continue; }
      const data = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(f); });
      const att: Attach = { filename: f.name, content_type: f.type, kind: 'file', size: f.size, data };
      if (editId) {
        try {
          const r = await fetch(`/api/reminders/${editId}/attachments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(att) });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setAttachments(p => [...p, d.data]);
        } catch (e: any) { toast.error(e.message || 'Error al subir'); }
      } else {
        setAttachments(p => [...p, att]);
      }
    }
  };

  const removeAttach = async (att: Attach, i: number) => {
    if (att.id && editId) {
      try { await fetch(`/api/reminders/${editId}/attachments/${att.id}`, { method: 'DELETE' }); } catch { /* ignore */ }
    }
    setAttachments(p => p.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!title.trim()) { toast.error('El título es requerido'); return; }
    setSaving(true);
    try {
      const remindIso = remindAt ? new Date(remindAt).toISOString() : null;
      if (editId) {
        const r = await fetch(`/api/reminders/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, remind_at: remindIso, tasks }) });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success('Recordatorio actualizado');
      } else {
        const r = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, remind_at: remindIso, tasks, attachments }) });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success('Recordatorio creado');
      }
      setModal(false); resetForm(); fetchList();
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!editId) return;
    try { await fetch(`/api/reminders/${editId}`, { method: 'DELETE' }); toast.success('Recordatorio eliminado'); setModal(false); fetchList(); }
    catch { toast.error('Error al eliminar'); }
  };

  const markDone = async (r: Reminder) => {
    try { await fetch(`/api/reminders/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: r.status === 'done' ? 'active' : 'done' }) }); fetchList(); }
    catch { toast.error('Error'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-semibold text-digi-text inline-flex items-center gap-2" style={df}><AlarmClock className="w-5 h-5 text-accent" /> Recordatorios</h1>
          <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>Recordatorios con tareas y adjuntos. Recibes correos según se acerca la fecha. Los de reuniones de Meet se generan solos.</p>
        </div>
        <button onClick={openCreate} className={BTN_PRIMARY}><Plus className="w-4 h-4" /> Nuevo recordatorio</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando…" /></div>
      ) : list.length === 0 ? (
        <div className="bg-digi-card border border-digi-border rounded-lg py-16 text-center">
          <AlarmClock className="w-8 h-8 text-digi-muted/50 mx-auto mb-2" />
          <p className="text-[13px] text-digi-muted" style={mf}>Aún no tienes recordatorios. Crea uno o se generarán al terminar tus reuniones de Meet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {list.map(r => {
            const total = (r.tasks || []).length;
            const done = (r.tasks || []).filter(t => t.done).length;
            const overdue = r.remind_at && new Date(r.remind_at).getTime() < Date.now();
            const isDone = r.status === 'done';
            return (
              <div key={r.id} onClick={() => openEdit(r.id)}
                className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm cursor-pointer hover:border-accent/40 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {r.source === 'meeting' && <Video className="w-3.5 h-3.5 text-accent shrink-0" />}
                    <h3 className={`text-[14px] font-medium truncate ${isDone ? 'line-through text-digi-muted' : 'text-digi-text'}`} style={mf}>{r.title}</h3>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); markDone(r); }} title={isDone ? 'Reactivar' : 'Marcar hecho'}
                    className={`shrink-0 w-5 h-5 rounded-[5px] border flex items-center justify-center transition-colors ${isDone ? 'bg-accent border-accent text-white' : 'border-digi-border hover:border-accent'}`}>
                    {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px]" style={mf}>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${overdue && !isDone ? 'bg-red-500/10 text-red-500' : 'bg-accent/10 text-accent'}`}>
                    <AlarmClock className="w-3 h-3" /> {fmtDate(r.remind_at)} {r.remind_at && !isDone && <span className="opacity-70">· {relative(r.remind_at)}</span>}
                  </span>
                  {total > 0 && <span className="inline-flex items-center gap-1 text-digi-muted"><ListChecks className="w-3 h-3" /> {done}/{total}</span>}
                  {!!r.attachment_count && <span className="inline-flex items-center gap-1 text-digi-muted"><Paperclip className="w-3 h-3" /> {r.attachment_count}</span>}
                </div>
                {r.notes && <p className="text-[12px] text-digi-muted mt-2 line-clamp-2" style={mf}>{r.notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      <PixelModal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar recordatorio' : 'Nuevo recordatorio'} size="lg">
        <div className="space-y-3">
          <PixelInput label="Título *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Enviar cotización a…" />
          <PixelInput label="Fecha y hora del recordatorio" type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Contexto del recordatorio…"
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>

          {/* Tareas */}
          <div>
            <label className="field-label text-[10px] text-accent-glow opacity-70 block mb-1" style={df}>Tareas</label>
            <div className="space-y-1 mb-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 group/task">
                  <button type="button" onClick={() => toggleTask(t.id)}
                    className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${t.done ? 'bg-accent border-accent text-white' : 'border-digi-border bg-digi-darker'}`}>
                    {t.done && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 text-[13px] ${t.done ? 'line-through text-digi-muted' : 'text-digi-text'}`} style={mf}>{t.text}</span>
                  <button type="button" onClick={() => removeTask(t.id)} className="text-digi-muted/50 hover:text-red-500 opacity-0 group-hover/task:opacity-100 transition-opacity"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                placeholder="Agregar tarea…" className="field-control flex-1 px-3 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              <button type="button" onClick={addTask} className={BTN_SECONDARY}><Plus className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Adjuntos */}
          <div>
            <label className="field-label text-[10px] text-accent-glow opacity-70 block mb-1" style={df}>Adjuntos</label>
            <div className="space-y-1 mb-2">
              {attachments.map((a, i) => (
                <div key={a.id ?? `n${i}`} className="flex items-center gap-2 px-2 py-1 border border-digi-border rounded bg-digi-darker">
                  <Paperclip className="w-3.5 h-3.5 text-digi-muted shrink-0" />
                  <span className="flex-1 text-[12px] text-digi-text truncate" style={mf}>{a.filename}{a.kind === 'transcript' ? ' · transcripción' : ''}</span>
                  {a.id && editId && (
                    <a href={`/api/reminders/${editId}/attachments/${a.id}`} onClick={(e) => e.stopPropagation()} className="text-digi-muted hover:text-accent" title="Descargar"><Download className="w-3.5 h-3.5" /></a>
                  )}
                  <button type="button" onClick={() => removeAttach(a, i)} className="text-digi-muted/60 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <label className={`${BTN_SECONDARY} cursor-pointer inline-flex`}>
              <Paperclip className="w-4 h-4" /> Adjuntar archivo
              <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-digi-border">
            {editId ? (
              <button onClick={del} className="inline-flex items-center gap-1.5 py-2 px-3 text-sm font-medium text-red-500 border border-red-500/40 rounded hover:bg-red-500/10 transition-colors" style={mf}><Trash2 className="w-4 h-4" /> Eliminar</button>
            ) : <span />}
            <div className="flex gap-2">
              <button onClick={() => setModal(false)} className={BTN_SECONDARY}>Cancelar</button>
              <button onClick={save} disabled={saving || !title.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>{saving ? 'Guardando…' : editId ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
