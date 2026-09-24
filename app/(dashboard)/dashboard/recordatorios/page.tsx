'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail from '@/components/ui/FilterRail';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import {
  Inbox, Clock, CheckCircle2, AlertTriangle, Search, Plus, X, Paperclip, Trash2,
  Check, Download, ListChecks, Video, AlarmClock, Pencil, RotateCcw,
  RefreshCw, Sparkles, CalendarDays, CalendarClock, Radio, ArrowRight,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Task = { id: string; text: string; done: boolean };
type Attach = { id?: number; filename: string; content_type?: string | null; kind?: string; size?: number | null; data?: string };
type Reminder = {
  id: number; title: string; notes?: string; remind_at?: string | null; tasks: Task[];
  status: string; source: string; source_event_id?: string | null; attachment_count?: number; attachments?: Attach[];
};

/** Reunión de Meet candidata a generar recordatorio (GET /api/reminders/meetings). */
type MeetCandidate = {
  recordName: string; meetingCode: string | null; meetingUrl: string | null;
  startTime: string | null; endTime: string | null; minutes: number | null;
  title: string; kind: 'scheduled' | 'instant'; calendarEventId: string | null;
  state: 'ready' | 'no-transcript' | 'generated'; reminderId: number | null;
};

const DAY_OPTIONS = [
  { value: '2', label: 'Últimos 2 días' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
];

const SCAN_NOTE: Record<string, string> = {
  'google-not-configured': 'Google Workspace no está configurado en el servidor, no se pueden leer las reuniones.',
  'no-workspace-email': 'Tu usuario no tiene una cuenta corporativa @grupocc.org vinculada, que es la que guarda las reuniones de Meet.',
};

const STATUS_TABS = [
  { value: 'all', label: 'Todos', Icon: Inbox },
  { value: 'active', label: 'Pendientes', Icon: Clock },
  { value: 'expired', label: 'Vencidos', Icon: AlertTriangle },
  { value: 'done', label: 'Completados', Icon: CheckCircle2 },
];

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  active: 'info', expired: 'error', done: 'success',
};
const STATUS_LABEL: Record<string, string> = { active: 'Pendiente', expired: 'Vencido', done: 'Completado' };
const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500', warning: 'bg-amber-500', error: 'bg-red-500', info: 'bg-accent', default: 'bg-digi-muted',
};

/** Estado efectivo para la UI: los activos ya vencidos se muestran como "Vencido" aunque el cron aún no los haya marcado. */
function effStatus(r: { status: string; remind_at?: string | null }): 'active' | 'expired' | 'done' {
  if (r.status === 'done') return 'done';
  if (r.remind_at && new Date(r.remind_at).getTime() <= Date.now()) return 'expired';
  return 'active';
}

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
function fmtShort(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
}
/** "29 jul, 17:59 · 47 min" para una reunión de Meet. */
function fmtMeetingWhen(c: { endTime: string | null; minutes: number | null }): string {
  if (!c.endTime) return '—';
  const when = new Date(c.endTime).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return c.minutes != null ? `${when} · ${c.minutes} min` : when;
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
  /**
   * ⚠️ EL MODAL DE TELÉFONO **NO SE MONTA** EN ESCRITORIO, y no es una optimización.
   *
   * Antes iba envuelto en `<div className="xl:hidden">`: invisible en pantalla grande,
   * pero montado. Y un `<dialog>` montado al que se le llama `showModal()` **deja inerte
   * el resto de la página** aunque no se vea — así que al abrir una ficha en escritorio
   * dejaban de funcionar TODOS los botones, sin nada que mirar. (Fernando, 2026-09-23:
   * «como si algo lo estuviese tapando, algo invisible y el mouse no hace nada».)
   *
   * Aquí no se elige un aspecto, se elige QUÉ SE MONTA: o el panel lateral o el modal.
   * Eso se decide en JavaScript, no con una clase.
   */
  const enTelefono = !useConsultaMedia(PANTALLA_XL);

  const [list, setList] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

  // Selección / detalle (panel derecho).
  const [selected, setSelected] = useState<Reminder | null>(null);
  const [selDetail, setSelDetail] = useState<Reminder | null>(null);
  const [selLoading, setSelLoading] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<number | null>(null);

  // Modal crear/editar.
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState('');
  const [markDoneForm, setMarkDoneForm] = useState(false);
  const [attachments, setAttachments] = useState<Attach[]>([]);

  // Modal "Buscar reuniones" (generación MANUAL desde una reunión de Meet).
  const [meetModal, setMeetModal] = useState(false);
  const [meetDays, setMeetDays] = useState('7');
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetList, setMeetList] = useState<MeetCandidate[]>([]);
  const [meetNote, setMeetNote] = useState<string | null>(null);
  const [meetScanned, setMeetScanned] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    try {
      const r = await fetch('/api/reminders');
      const d = await r.json();
      setList(d.data || []);
    } catch { toast.error('Error al cargar recordatorios'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchList(); }, [fetchList]);

  const selectReminder = useCallback(async (r: Reminder) => {
    setSelected(r); setSelDetail(null); setSelLoading(true);
    try {
      const res = await fetch(`/api/reminders/${r.id}`);
      const { data } = await res.json();
      setSelDetail(data || null);
    } catch { setSelDetail(null); }
    finally { setSelLoading(false); }
  }, []);

  // Enlace profundo desde la reunión (?open=<id>) → selecciona ese recordatorio en el panel.
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) setPendingOpen(Number(openId));
  }, []);
  useEffect(() => {
    if (pendingOpen == null || list.length === 0) return;
    const found = list.find((r) => r.id === pendingOpen);
    if (found) { selectReminder(found); setPendingOpen(null); }
  }, [pendingOpen, list, selectReminder]);

  // Lista filtrada por estado efectivo + búsqueda; y conteos por estado.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length, active: 0, expired: 0, done: 0 };
    for (const r of list) c[effStatus(r)]++;
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (tab !== 'all' && effStatus(r) !== tab) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, tab, search]);

  // ── Crear / editar ──
  const resetForm = () => { setTitle(''); setNotes(''); setRemindAt(''); setTasks([]); setNewTask(''); setAttachments([]); setMarkDoneForm(false); };
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
      setMarkDoneForm(data.status === 'done');
      setNewTask('');
      setModal(true);
    } catch { toast.error('Error al abrir el recordatorio'); }
  };

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
        const r = await fetch(`/api/reminders/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, remind_at: remindIso, tasks, status: markDoneForm ? 'done' : 'active' }) });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success('Recordatorio actualizado');
      } else {
        const r = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, notes, remind_at: remindIso, tasks, attachments }) });
        if (!r.ok) throw new Error((await r.json()).error);
        toast.success('Recordatorio creado');
      }
      setModal(false); resetForm();
      await fetchList();
      if (editId && selected?.id === editId) { const fresh = { id: editId } as Reminder; selectReminder(fresh); }
    } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    try {
      await fetch(`/api/reminders/${id}`, { method: 'DELETE' });
      toast.success('Recordatorio eliminado');
      setModal(false);
      if (selected?.id === id) { setSelected(null); setSelDetail(null); }
      fetchList();
    } catch { toast.error('Error al eliminar'); }
  };

  // Cambia el estado (completado ↔ activo) y refresca lista + detalle.
  const setStatus = async (id: number, status: 'done' | 'active') => {
    try {
      await fetch(`/api/reminders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      toast.success(status === 'done' ? 'Marcado como completado' : 'Reactivado');
      await fetchList();
      if (selected?.id === id) selectReminder({ id } as Reminder);
    } catch { toast.error('Error'); }
  };

  // ── Buscar reuniones de Meet y generar el recordatorio a mano ──
  const loadMeetings = useCallback(async (days: string) => {
    setMeetLoading(true);
    try {
      const r = await fetch(`/api/reminders/meetings?days=${days}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al buscar reuniones');
      setMeetList(d.data || []);
      setMeetNote(d.note || null);
      setMeetScanned(true);
    } catch (e: any) {
      toast.error(e.message || 'Error al buscar reuniones');
    } finally { setMeetLoading(false); }
  }, []);

  const openMeetings = () => {
    setMeetModal(true);
    if (!meetScanned) loadMeetings(meetDays);
  };

  const changeMeetDays = (days: string) => { setMeetDays(days); loadMeetings(days); };

  const generateFromMeeting = async (c: MeetCandidate) => {
    setGenerating(c.recordName);
    try {
      const r = await fetch('/api/reminders/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordName: c.recordName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al generar el recordatorio');
      toast.success(d.data.alreadyExisted ? 'Esa reunión ya tenía recordatorio' : `Recordatorio creado: ${d.data.title}`);
      setMeetList(prev => prev.map(m => m.recordName === c.recordName
        ? { ...m, state: 'generated', reminderId: d.data.reminderId } : m));
      await fetchList();
    } catch (e: any) {
      toast.error(e.message || 'Error al generar el recordatorio');
    } finally { setGenerating(null); }
  };

  // Abre el recordatorio ya generado de una reunión (cierra el modal y lo selecciona).
  const openGenerated = (reminderId: number) => {
    setMeetModal(false);
    setPendingOpen(reminderId);
  };

  // Marca/desmarca una tarea desde el panel de detalle (persiste).
  const toggleDetailTask = async (taskId: string) => {
    if (!selDetail) return;
    const next = (selDetail.tasks || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t);
    setSelDetail({ ...selDetail, tasks: next });
    try {
      await fetch(`/api/reminders/${selDetail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tasks: next }) });
      setList(prev => prev.map(r => r.id === selDetail.id ? { ...r, tasks: next } : r));
    } catch { toast.error('Error al actualizar la tarea'); }
  };


  const detail = selDetail || selected;
  const detailStatus = detail ? effStatus(detail) : 'active';

  /**
   * EL CUERPO DEL DETALLE, UNA SOLA VEZ. Se pinta en dos envoltorios —la columna de
   * escritorio y el panel a pantalla completa del teléfono— y por eso vive aquí: dos
   * copias del mismo bloque acabarían siendo dos detalles distintos.
   */
  const cuerpoDetalle = !detail ? null : (
  <div className="p-4 space-y-3">
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-digi-muted" style={mf}>Estado</span>
      <PixelBadge variant={STATUS_VARIANT[detailStatus] || 'default'}>{STATUS_LABEL[detailStatus]}</PixelBadge>
    </div>
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-digi-muted" style={mf}>Fecha y hora</span>
      <span className="text-digi-text text-right" style={mf}>
        {fmtDate(detail.remind_at)}
        {detail.remind_at && detailStatus === 'active' && <span className="text-digi-muted"> · {relative(detail.remind_at)}</span>}
      </span>
    </div>

    {detail.notes && (
      <div className="pt-2 border-t border-digi-border">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1" style={mf}>Notas</p>
        <p className="text-[12px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>{detail.notes}</p>
      </div>
    )}

    {/* Tareas (marcables) */}
    {selLoading ? (
      <p className="text-[11px] text-digi-muted pt-1" style={mf}>Cargando…</p>
    ) : (detail.tasks?.length ?? 0) > 0 && (
      <div className="pt-2 border-t border-digi-border">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>
          Tareas ({(detail.tasks || []).filter(t => t.done).length}/{detail.tasks!.length})
        </p>
        <div className="space-y-1.5">
          {detail.tasks!.map((t) => (
            <div key={t.id} className="flex items-start gap-2 text-[12.5px]">
              <button type="button" onClick={() => toggleDetailTask(t.id)}
                className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 mt-px transition-colors ${t.done ? 'bg-accent border-accent text-white' : 'border-digi-border bg-digi-darker hover:border-accent'}`}>
                {t.done && <Check className="w-3 h-3" strokeWidth={3} />}
              </button>
              <span className={`flex-1 ${t.done ? 'line-through text-digi-muted' : 'text-digi-text'}`} style={mf}>{t.text}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Adjuntos */}
    {(detail.attachments?.length ?? 0) > 0 && (
      <div className="pt-2 border-t border-digi-border">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Adjuntos ({detail.attachments!.length})</p>
        <div className="space-y-1">
          {detail.attachments!.map((a) => (
            <a key={a.id} href={`/api/reminders/${detail.id}/attachments/${a.id}`}
              className="flex items-center gap-2 px-2 py-1 border border-digi-border rounded bg-digi-darker hover:border-accent transition-colors group">
              <Paperclip className="w-3.5 h-3.5 text-digi-muted shrink-0" />
              <span className="flex-1 text-[12px] text-digi-text truncate" style={mf}>{a.filename}{a.kind === 'transcript' ? ' · transcripción' : ''}</span>
              <Download className="w-3.5 h-3.5 text-digi-muted group-hover:text-accent shrink-0" />
            </a>
          ))}
        </div>
      </div>
    )}

    {/* Acciones */}
    <div className="space-y-2 pt-2 border-t border-digi-border">
      {detailStatus === 'done' ? (
        <button onClick={() => setStatus(detail.id, 'active')} className={`${BTN_SECONDARY} w-full`}>
          <RotateCcw className="w-4 h-4" /> Reactivar recordatorio
        </button>
      ) : (
        <button onClick={() => setStatus(detail.id, 'done')} className={`${BTN_PRIMARY} w-full`}>
          <CheckCircle2 className="w-4 h-4" /> Marcar como completado
        </button>
      )}
      <div className="flex gap-2">
        <button onClick={() => openEdit(detail.id)} className={`${BTN_SECONDARY} flex-1`}>
          <Pencil className="w-4 h-4" /> Editar
        </button>
        <button onClick={() => del(detail.id)} className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-sm font-medium text-red-500 border border-red-500/40 rounded hover:bg-red-500/10 transition-colors" style={mf}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
  );

  return (
    <div>
      <PageHeader title="Recordatorios" description="Recordatorios con tareas y adjuntos" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: estado ── */}
        <FilterRail
          title="Estado"
          items={STATUS_TABS.map((s) => ({ value: s.value, label: s.label, Icon: s.Icon, count: counts[s.value] }))}
          value={tab}
          onChange={setTab}
        />

        {/* ── Right region: command bar + table + detail ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>
            {/* Los dos botones comparten fila en teléfono: uno debajo del otro eran dos
                pantallazos de 44 px antes de llegar a la lista, que es lo que se viene a ver. */}
            <div className="flex gap-2">
              <button onClick={openMeetings} className={`${BTN_SECONDARY} flex-1 sm:flex-none h-11 sm:h-auto shrink-0`} title="Buscar reuniones de Meet y generar su recordatorio">
                <Video className="w-4 h-4" /> <span className="sm:hidden">Reuniones</span><span className="hidden sm:inline">Buscar reuniones</span>
              </button>
              <button onClick={openCreate} className={`${BTN_PRIMARY} flex-1 sm:flex-none h-11 sm:h-auto shrink-0`}>
                <Plus className="w-4 h-4" /> <span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo recordatorio</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              {loading ? (
                <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando…" /></div>
              ) : (
              <PixelDataTable
                singleLine
                columns={[
                  { key: 'title', header: 'Recordatorio', render: (r: Reminder) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <span title={STATUS_LABEL[effStatus(r)]} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[STATUS_VARIANT[effStatus(r)] || 'default']}`} />
                      {r.source === 'meeting' && <Video className="w-3.5 h-3.5 text-accent shrink-0" />}
                      <span className={`truncate text-[13px] font-medium ${selected?.id === r.id ? 'text-accent' : effStatus(r) === 'done' ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</span>
                    </span>
                  ) },
                  { key: 'remind_at', header: 'Fecha', width: '120px', render: (r: Reminder) => (
                    <span className="text-[12px] text-digi-muted" style={mf}>{fmtShort(r.remind_at)}</span>
                  ) },
                  { key: 'tasks', header: 'Tareas', width: '90px', hideOnMobile: true, render: (r: Reminder) => {
                    const total = (r.tasks || []).length;
                    if (!total) return <span className="text-[12px] text-digi-muted/50" style={mf}>—</span>;
                    const done = (r.tasks || []).filter(t => t.done).length;
                    return <span className="inline-flex items-center gap-1 text-[12px] text-digi-muted tabular-nums" style={mf}><ListChecks className="w-3.5 h-3.5" /> {done}/{total}</span>;
                  } },
                ]}
                data={filtered}
                onRowClick={(r: Reminder) => selectReminder(r)}
                emptyTitle="Sin recordatorios"
                emptyDesc="No hay recordatorios en este estado."
                /* ── El recordatorio, contado para un teléfono ───────────────────────
                   La tabla recorta el título a media columna («Desarrollar Fase 1 el
                   Videoju…»), y un recordatorio del que no se lee el título no sirve
                   de nada: es TODO lo que tiene. Aquí ocupa el ancho y hasta dos
                   líneas, y debajo van la fecha y las tareas con su nombre. */
                tarjetaMovil={(r: Reminder) => {
                  const est = effStatus(r);
                  const tareas = r.tasks || [];
                  const hechas = tareas.filter((t) => t.done).length;
                  return (
                    <>
                      <div className="flex items-start gap-2">
                        <span title={STATUS_LABEL[est]} className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATUS_DOT[STATUS_VARIANT[est] || 'default']}`} />
                        {r.source === 'meeting' && <Video className="w-4 h-4 text-accent shrink-0 mt-0.5" />}
                        <span className={`flex-1 min-w-0 text-[13.5px] font-medium leading-snug ${est === 'done' ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>
                          {r.title}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 pl-4 text-[12px] text-digi-muted" style={mf}>
                        <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {fmtShort(r.remind_at)}</span>
                        {tareas.length > 0 && (
                          <span className="inline-flex items-center gap-1 tabular-nums"><ListChecks className="w-3.5 h-3.5" /> {hechas}/{tareas.length}</span>
                        )}
                        <span className="ml-auto"><PixelBadge variant={STATUS_VARIANT[est] || 'default'}>{STATUS_LABEL[est]}</PixelBadge></span>
                      </div>
                    </>
                  );
                }}
              />
              )}
            </div>

            {/* ── Detalle ─────────────────────────────────────────────────────────
                En escritorio es la tercera columna. En TELÉFONO el <aside> caía por
                debajo de la lista entera —a más de 1.500 px—, así que tocar una fila
                **no producía ningún cambio visible**: el detalle existía fuera de la
                pantalla. Aquí el mismo contenido se abre como panel a pantalla
                completa, que es el estándar del proyecto para lo que no cabe al lado. */}
            <aside className="hidden xl:block w-full xl:w-[360px]">
              {!detail ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <AlarmClock className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un recordatorio para ver su detalle.</p>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight flex items-center gap-1.5" style={mf}>
                        {detail.source === 'meeting' && <Video className="w-4 h-4 text-accent shrink-0" />}
                        <span className={detailStatus === 'done' ? 'line-through text-digi-muted' : ''}>{detail.title}</span>
                      </h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{detail.source === 'meeting' ? 'Generado de una reunión' : 'Recordatorio manual'}</p>
                    </div>
                    <button onClick={() => { setSelected(null); setSelDetail(null); }} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>
                  {cuerpoDetalle}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* El detalle en teléfono. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal
          open={!!detail}
          onClose={() => { setSelected(null); setSelDetail(null); }}
          title={detail?.title || 'Recordatorio'}
          size="md"
        >
          {cuerpoDetalle}
        </PixelModal>
      )}

      {/* Modal: reuniones de Meet → generar recordatorio a mano */}
      <PixelModal open={meetModal} onClose={() => setMeetModal(false)} title="Reuniones recientes de Meet" size="lg" busy={!!generating}>
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Tus reuniones de Google Meet, incluidas las <span className="text-digi-text font-medium">iniciadas sin agendar</span>.
            Genera el recordatorio con su transcripción cuando quieras: la IA saca el título, las tareas y la fecha de seguimiento.
          </p>

          <div className="flex items-center gap-2">
            <div className="w-48 shrink-0">
              <PixelSelect
                options={DAY_OPTIONS}
                value={meetDays}
                onChange={(e) => changeMeetDays(e.target.value)}
                disabled={meetLoading || !!generating}
              />
            </div>
            <button onClick={() => loadMeetings(meetDays)} disabled={meetLoading || !!generating} className={BTN_SECONDARY}>
              <RefreshCw className={`w-4 h-4 ${meetLoading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>

          {meetNote && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
              <p className="text-[12px] text-digi-text" style={mf}>{SCAN_NOTE[meetNote] || meetNote}</p>
            </div>
          )}

          {meetLoading ? (
            <div className="flex justify-center py-10"><BrandLoader size="lg" label="Buscando reuniones…" /></div>
          ) : meetList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                <Video className="w-5 h-5 text-digi-muted" />
              </div>
              <p className="text-[12px] text-digi-muted" style={mf}>
                {meetScanned && !meetNote ? 'No se encontraron reuniones en este periodo.' : 'Sin reuniones para mostrar.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {meetList.map((c) => (
                <div key={c.recordName} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-digi-border bg-digi-darker/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-digi-text truncate flex items-center gap-1.5" style={mf}>
                      <span className="shrink-0 inline-flex" title={c.kind === 'scheduled' ? 'Agendada en Mi día' : 'Iniciada sin agendar'}>
                        {c.kind === 'scheduled'
                          ? <CalendarDays className="w-3.5 h-3.5 text-accent" />
                          : <Radio className="w-3.5 h-3.5 text-accent" />}
                      </span>
                      {c.title}
                    </p>
                    <p className="text-[11px] text-digi-muted truncate" style={mf}>
                      {fmtMeetingWhen(c)}{c.meetingCode ? ` · ${c.meetingCode}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {c.state === 'generated' ? (
                      <button onClick={() => c.reminderId && openGenerated(c.reminderId)} disabled={!c.reminderId}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline disabled:opacity-50" style={mf}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ya generado <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : c.state === 'no-transcript' ? (
                      <PixelBadge variant="default">Sin transcripción</PixelBadge>
                    ) : (
                      <button onClick={() => generateFromMeeting(c)} disabled={!!generating}
                        className={`${BTN_PRIMARY} px-2.5 py-1.5 text-[12px]`}>
                        {generating === c.recordName
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando…</>
                          : <><Sparkles className="w-3.5 h-3.5" /> Generar</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-digi-muted leading-relaxed pt-2 border-t border-digi-border" style={mf}>
            <span className="text-digi-text font-medium">Sin transcripción</span> = la reunión se hizo con la
            transcripción desactivada, o Google todavía no la ha liberado (puede tardar más de 15 minutos
            después de terminar). Vuelve a Actualizar más tarde.
          </p>
        </div>
      </PixelModal>

      {/* Modal crear / editar */}
      <PixelModal open={modal} onClose={() => setModal(false)} title={editId ? 'Editar recordatorio' : 'Nuevo recordatorio'} size="lg">
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
                  <button type="button" onClick={() => removeTask(t.id)} aria-label="Quitar tarea" className="acciones-al-pasar shrink-0 w-11 h-11 sm:w-auto sm:h-auto inline-flex items-center justify-center text-digi-muted/50 hover:text-red-500"><X className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
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
            {editId ? (
              <button onClick={() => del(editId)} className="inline-flex items-center gap-1.5 py-2 px-3 text-sm font-medium text-red-500 border border-red-500/40 rounded hover:bg-red-500/10 transition-colors" style={mf}><Trash2 className="w-4 h-4" /> Eliminar</button>
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
