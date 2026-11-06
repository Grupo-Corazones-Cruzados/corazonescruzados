'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, CheckCircle2, Download, Paperclip, Plus } from 'lucide-react';
import BotonEliminar from '@/components/ui/BotonEliminar';
import BotonQuitar from '@/components/ui/BotonQuitar';
import PixelInput from '@/components/ui/PixelInput';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { pedirNormal, toLocalInput, type Attach, type Pedir, type Reminder, type Task } from './comun';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/** Crear o editar un recordatorio. `datos` es el que se edita; sin él, uno nuevo. */
export default function FormRecordatorio({ abierto, datos, onClose, onGuardado, onEliminar, pedir = pedirNormal, alDescargar }: {
  abierto: boolean; datos: Reminder | null; onClose: () => void; onGuardado: (id: number | null) => void; onEliminar: (id: number) => void; pedir?: Pedir; alDescargar?: (a: Attach) => void;
}) {
  const editId = datos?.id ?? null;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [markDoneForm, setMarkDoneForm] = useState(false);
  const [attachments, setAttachments] = useState<Attach[]>([]);

  useEffect(() => {
    if (!abierto) return;
    setTitle(datos?.title || '');
    setNotes(datos?.notes || '');
    setRemindAt(toLocalInput(datos?.remind_at));
    setTasks(Array.isArray(datos?.tasks) ? datos!.tasks : []);
    setAttachments(datos?.attachments || []);
    setMarkDoneForm(datos?.status === 'done');
    setNewTask('');
  }, [abierto, datos]);

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
          const r = await pedir(`/api/reminders/${editId}/attachments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(att) });
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
      try { await pedir(`/api/reminders/${editId}/attachments/${att.id}`, { method: 'DELETE' }); } catch { /* ignore */ }
    }
    setAttachments(p => p.filter((_, idx) => idx !== i));
  };

  const save = async () => {
    if (!title.trim()) { toast.error('El título es requerido'); return; }
    setSaving(true);
    try {
      const remindIso = remindAt ? new Date(remindAt).toISOString() : null;
      if (editId) {
        const r = await pedir(`/api/reminders/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, remind_at: remindIso, tasks, status: markDoneForm ? 'done' : 'active' }) });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success('Recordatorio actualizado');
      } else {
        const r = await pedir('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, remind_at: remindIso, tasks, attachments }) });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success('Recordatorio creado');
      }
      onGuardado(editId);
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  return (
    <PixelModal open={abierto} onClose={onClose} title={editId ? 'Editar recordatorio' : 'Nuevo recordatorio'} size="lg">
        <div className="space-y-3">
          <PixelInput label="Título *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Enviar cotización a…" />
          <PixelInput label="Fecha y hora del recordatorio" type="datetime-local" value={remindAt} onChange={(e) => setRemindAt(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Notas</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6} placeholder="Contexto del recordatorio…"
              className="field-control w-full h-40 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-y overflow-y-auto" style={mf} />
          </div>

          {/* Tareas */}
          <div>
            <label className="field-label text-[10px] text-accent-glow opacity-70 block mb-1" style={df}>Tareas</label>
            <div className="space-y-1 mb-2">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 group group/task">
                  <button type="button" onClick={() => toggleTask(t.id)}
                    className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${t.done ? 'bg-accent border-accent text-white' : 'border-digi-border bg-digi-darker'}`}>
                    {t.done && <Check className="w-3 h-3" strokeWidth={3} />}
                  </button>
                  <span className={`flex-1 text-[13px] ${t.done ? 'line-through text-digi-muted' : 'text-digi-text'}`} style={mf}>{t.text}</span>
                  <BotonQuitar onClick={() => removeTask(t.id)} etiqueta="Quitar tarea" tamano="xs" className="acciones-al-pasar" />
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
                    <a href={`/api/reminders/${editId}/attachments/${a.id}`} onClick={(e) => { e.stopPropagation(); if (alDescargar) { e.preventDefault(); alDescargar(a); } }} className="text-digi-muted hover:text-accent" title="Descargar"><Download className="w-3.5 h-3.5" /></a>
                  )}
                  <BotonQuitar onClick={() => removeAttach(a, i)} etiqueta="Quitar adjunto" tamano="xs" />
                </div>
              ))}
            </div>
            <label className={`${BTN_SECONDARY} cursor-pointer inline-flex`}>
              <Paperclip className="w-4 h-4" /> Adjuntar archivo
              <input type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
          </div>

          {/* Completado: corta los correos de recordatorio */}
          {editId && (
            <label className="flex items-start gap-2 px-3 py-2 rounded-md border border-digi-border cursor-pointer hover:bg-black/[0.03] transition-colors" style={mf}>
              <input type="checkbox" checked={markDoneForm} onChange={(e) => setMarkDoneForm(e.target.checked)} className="mt-0.5 accent-accent" />
              <span className="min-w-0">
                <span className="text-[12.5px] font-medium text-digi-text inline-flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-green-400" /> Marcar como completado</span>
                <span className="block text-[10.5px] text-digi-muted">Deja de enviar correos de recordatorio.</span>
              </span>
            </label>
          )}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-digi-border">
            {editId ? <BotonEliminar onClick={() => onEliminar(editId)} etiqueta="Eliminar recordatorio" /> : <span />}
            <div className="flex gap-2">
              <button onClick={() => onClose()} className={BTN_SECONDARY}>Cancelar</button>
              <button onClick={save} disabled={saving || !title.trim()} className={`${BTN_PRIMARY} disabled:opacity-50`}>{saving ? 'Guardando…' : editId ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </div>
    </PixelModal>
  );
}
