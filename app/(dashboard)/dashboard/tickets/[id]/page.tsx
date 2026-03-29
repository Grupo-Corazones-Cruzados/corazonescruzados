'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', confirmed: 'info', in_progress: 'info',
  completed: 'success', cancelled: 'error', withdrawn: 'default',
};

const STATUSES = [
  { value: 'pending', label: 'Pendiente' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'completed', label: 'Completado' },
  { value: 'cancelled', label: 'Cancelado' },
  { value: 'withdrawn', label: 'Retirado' },
];

type SelectedDates = string[];

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Lookups
  const [services, setServices] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // Time slots editing
  const [editingSlots, setEditingSlots] = useState(false);
  const [selectedDates, setSelectedDates] = useState<SelectedDates>([]);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [savingSlots, setSavingSlots] = useState(false);

  // Delete confirm
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setTicket(data);
    } catch {
      toast.error('Error al cargar ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast.success('Estado actualizado');
      fetchTicket();
    } catch { toast.error('Error'); }
  };

  const startEdit = async () => {
    setForm({
      title: ticket.title || '',
      description: ticket.description || '',
      status: ticket.status || 'pending',
      service_id: ticket.service_id ? String(ticket.service_id) : '',
      member_id: ticket.member_id ? String(ticket.member_id) : '',
      client_id: ticket.client_id ? String(ticket.client_id) : '',
      deadline: ticket.deadline ? ticket.deadline.split('T')[0] : '',
      estimated_hours: ticket.estimated_hours ? String(ticket.estimated_hours) : '',
      estimated_cost: ticket.estimated_cost ? String(ticket.estimated_cost) : '',
      meet_link: ticket.meet_link || '',
    });
    setEditing(true);
    const [sRes, mRes, cRes] = await Promise.all([
      fetch('/api/services').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/members/list').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clients').then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    setServices(sRes.data || []);
    setMembers(mRes.data || []);
    setClients(cRes.data || []);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error('El titulo es requerido'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title, description: form.description || null, status: form.status,
          service_id: form.service_id ? Number(form.service_id) : null,
          member_id: form.member_id ? Number(form.member_id) : null,
          client_id: form.client_id ? Number(form.client_id) : null,
          deadline: form.deadline || null,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
          estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
          meet_link: form.meet_link || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Ticket actualizado');
      setEditing(false);
      fetchTicket();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Ticket eliminado');
      router.push('/dashboard/tickets');
    } catch { toast.error('Error al eliminar'); }
    finally { setDeleting(false); }
  };

  // --- Time slots ---
  const startEditSlots = () => {
    const existing = (ticket.time_slots || []).map((s: any) => s.date?.split('T')[0]).filter(Boolean);
    setSelectedDates(existing);
    setEditingSlots(true);
  };

  const handleSaveSlots = async () => {
    if (selectedDates.length === 0) { toast.error('Agrega al menos un dia'); return; }
    setSavingSlots(true);
    try {
      const res = await fetch(`/api/tickets/${id}/time-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_slots: selectedDates.map(d => ({ date: d })) }),
      });
      if (!res.ok) throw new Error();
      toast.success('Dias de trabajo actualizados');
      setEditingSlots(false);
      fetchTicket();
    } catch { toast.error('Error al guardar dias'); }
    finally { setSavingSlots(false); }
  };

  const handleAccept = () => {
    setSelectedDates([]);
    setEditingSlots(true);
  };

  const handleAcceptWithSlots = async () => {
    if (selectedDates.length === 0) { toast.error('Agrega al menos un dia de trabajo'); return; }
    setSavingSlots(true);
    try {
      await fetch(`/api/tickets/${id}/time-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_slots: selectedDates.map(d => ({ date: d })) }),
      });
      await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      toast.success('Ticket aceptado');
      setEditingSlots(false);
      fetchTicket();
    } catch { toast.error('Error'); }
    finally { setSavingSlots(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando ticket..." /></div>;
  if (!ticket) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-400">Ticket no encontrado</p></div>;

  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';
  const canEdit = isAdmin || isMember;
  const isClosed = ['completed', 'cancelled'].includes(ticket.status);
  const isPending = ticket.status === 'pending';
  const timeSlots = ticket.time_slots || [];
  // Is this a request from a client to this member?
  const isRequestForMe = isPending && isMember && user?.member_id && ticket.member_id === user.member_id;

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/dashboard/tickets" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>&lt; Volver a tickets</Link>
      </div>

      <PageHeader
        title={editing ? 'Editando Ticket' : (ticket.title || `Ticket #${ticket.id}`)}
        action={
          <div className="flex items-center gap-2">
            <PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{ticket.status}</PixelBadge>
            {canEdit && !editing && !editingSlots && (
              <button onClick={startEdit} className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>
                Editar
              </button>
            )}
          </div>
        }
      />

      {/* ========== PENDING REQUEST BANNER ========== */}
      {isRequestForMe && !editingSlots && (
        <div className="pixel-card !border-amber-400/30 !bg-amber-400/5 mb-4">
          <p className="text-xs text-amber-400 mb-3" style={pf}>Solicitud pendiente de un cliente</p>
          <p className="text-[10px] text-digi-muted mb-3" style={mf}>
            El cliente {ticket.client_name || ''} te ha solicitado este servicio. Acepta e indica los dias de trabajo, o rechaza la solicitud.
          </p>
          <div className="flex gap-2">
            <button onClick={handleAccept} className="pixel-btn pixel-btn-primary text-[9px]">
              Aceptar e indicar dias
            </button>
            <button onClick={() => updateStatus('cancelled')}
              className="py-1.5 px-3 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
              Rechazar
            </button>
          </div>
        </div>
      )}

      {/* ========== CALENDAR EDITOR ========== */}
      {editingSlots && (() => {
        const { year, month } = calMonth;
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const todayStr = new Date().toISOString().split('T')[0];
        const deadlineStr = ticket.deadline ? ticket.deadline.split('T')[0] : '';
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const dayNames = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
        const toggleDate = (d: string) => setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
        const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
        const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
        const cells: (number | null)[] = [];
        for (let i = 0; i < firstDay; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div className="pixel-card mb-4">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>
              {isRequestForMe ? 'Selecciona los dias de trabajo para aceptar' : 'Editar dias de trabajo'}
            </h3>
            <div className="flex items-center justify-between mb-2">
              <button onClick={prevMonth} className="px-2 py-1 text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent/30 transition-colors text-[10px]" style={pf}>&lt;</button>
              <span className="text-xs text-white" style={pf}>{monthNames[month]} {year}</span>
              <button onClick={nextMonth} className="px-2 py-1 text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent/30 transition-colors text-[10px]" style={pf}>&gt;</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map(d => <div key={d} className="text-center text-[8px] text-digi-muted py-1" style={pf}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mb-3">
              {cells.map((day, i) => {
                if (day === null) return <div key={`e${i}`} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = selectedDates.includes(dateStr);
                const isOutOfRange = dateStr < todayStr || (!!deadlineStr && dateStr > deadlineStr);
                return (
                  <button key={dateStr} onClick={() => !isOutOfRange && toggleDate(dateStr)} disabled={isOutOfRange}
                    className={`py-1.5 text-[10px] text-center border transition-colors ${isSelected ? 'bg-accent/30 border-accent text-white' : isOutOfRange ? 'border-transparent text-digi-muted/30 cursor-default' : 'border-digi-border/30 text-digi-text hover:border-accent/50 hover:bg-accent/10'}`}
                    style={{ fontFamily: "'JetBrains Mono', monospace" }}>{day}</button>
                );
              })}
            </div>
            {selectedDates.length > 0 && (
              <div className="border-t border-digi-border/30 pt-2 mb-3">
                <div className="flex flex-wrap gap-1">
                  {selectedDates.map(d => (
                    <span key={d} className="text-[9px] px-1.5 py-0.5 bg-accent/20 border border-accent/30 text-accent-glow flex items-center gap-1" style={mf}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                      <button onClick={() => toggleDate(d)} className="text-red-400 hover:text-red-300 text-[8px]">x</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setEditingSlots(false)} className="flex-1 py-2 text-[10px] text-digi-muted border border-digi-border hover:bg-digi-darker transition-colors" style={pf}>Cancelar</button>
              <button onClick={isRequestForMe ? handleAcceptWithSlots : handleSaveSlots} disabled={savingSlots || selectedDates.length === 0}
                className="flex-1 pixel-btn pixel-btn-primary disabled:opacity-50">
                {savingSlots ? 'Guardando...' : isRequestForMe ? `Aceptar (${selectedDates.length} dias)` : `Guardar (${selectedDates.length} dias)`}
              </button>
            </div>
          </div>
        );
      })()}

      {editing ? (
        /* ========== EDIT MODE ========== */
        <div className="pixel-card space-y-4">
          <PixelInput label="Titulo *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripcion</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PixelSelect label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUSES} />
            <PixelSelect label="Servicio" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}
              options={services.map((s: any) => ({ value: String(s.id), label: s.name }))} placeholder="-- Sin servicio --" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PixelSelect label="Miembro asignado" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              options={members.map((m: any) => ({ value: String(m.id), label: m.name }))} placeholder="-- Sin asignar --" />
            <PixelSelect label="Cliente" value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              options={clients.map((c: any) => ({ value: String(c.id), label: c.name || c.email }))} placeholder="-- Sin cliente --" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PixelInput label="Fecha limite" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <PixelInput label="Horas estimadas" type="number" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
            <PixelInput label="Costo estimado (USD)" type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} />
          </div>
          <PixelInput label="Enlace de reunion" value={form.meet_link} onChange={(e) => setForm({ ...form, meet_link: e.target.value })} placeholder="https://meet.google.com/..." />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 py-2 text-[10px] text-digi-muted border border-digi-border hover:bg-digi-darker transition-colors" style={pf}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.title?.trim()} className="flex-1 pixel-btn pixel-btn-primary disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      ) : (
        /* ========== VIEW MODE ========== */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {ticket.description && (
              <div className="pixel-card">
                <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Descripcion</h3>
                <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{ticket.description}</p>
              </div>
            )}

            {/* Work days */}
            <div className="pixel-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-accent-glow" style={pf}>Dias de Trabajo</h3>
                {canEdit && !isClosed && !editingSlots && (
                  <button onClick={startEditSlots}
                    className="text-[9px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>
                    Editar dias
                  </button>
                )}
              </div>
              {timeSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {timeSlots.map((slot: any, i: number) => (
                    <div key={i} className="px-2 py-1.5 border border-digi-border/50 text-center">
                      <p className="text-xs text-digi-text" style={mf}>{new Date(slot.date).toLocaleDateString()}</p>
                      {slot.start_time && <p className="text-[9px] text-digi-muted" style={mf}>{slot.start_time} - {slot.end_time}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-digi-muted/50" style={mf}>Sin dias asignados</p>
              )}
            </div>

            {ticket.meet_link && (
              <div className="pixel-card">
                <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Enlace de Reunion</h3>
                <a href={ticket.meet_link} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-accent-glow hover:underline break-all" style={mf}>{ticket.meet_link}</a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Detalles</h3>
              <div className="space-y-2 text-[10px]" style={mf}>
                <DetailRow label="Cliente" value={ticket.client_name || '-'} />
                <DetailRow label="Miembro" value={ticket.member_name || '-'} />
                <DetailRow label="Servicio" value={ticket.service_name || '-'} />
                <DetailRow label="Limite" value={ticket.deadline ? new Date(ticket.deadline).toLocaleDateString() : '-'} />
                <DetailRow label="Horas est." value={ticket.estimated_hours ? `${ticket.estimated_hours}h` : '-'} />
                <DetailRow label="Costo est." value={ticket.estimated_cost ? `$${ticket.estimated_cost}` : '-'} />
                <DetailRow label="Creado" value={new Date(ticket.created_at).toLocaleDateString()} />
              </div>
            </div>

            {canEdit && !isClosed && !isRequestForMe && (
              <div className="pixel-card">
                <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Acciones rapidas</h3>
                <div className="space-y-1.5">
                  {(ticket.status === 'pending' || ticket.status === 'withdrawn') && (
                    <button onClick={() => updateStatus('confirmed')} className="pixel-btn pixel-btn-primary w-full text-[9px]">Confirmar</button>
                  )}
                  {ticket.status === 'confirmed' && (
                    <button onClick={() => updateStatus('in_progress')} className="pixel-btn pixel-btn-primary w-full text-[9px]">En Progreso</button>
                  )}
                  {(ticket.status === 'confirmed' || ticket.status === 'in_progress') && (
                    <button onClick={() => updateStatus('completed')} className="pixel-btn pixel-btn-primary w-full text-[9px]">Completar</button>
                  )}
                  {ticket.status !== 'cancelled' && (
                    <button onClick={() => updateStatus('cancelled')}
                      className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
                      Cancelar Ticket
                    </button>
                  )}
                </div>
              </div>
            )}

            {canEdit && (
              <div className="pixel-card">
                <button onClick={() => setDeleteModal(true)}
                  className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
                  Eliminar Ticket
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <PixelModal open={deleteModal} onClose={() => setDeleteModal(false)} title="Eliminar Ticket">
        <div className="space-y-4">
          <p className="text-xs text-digi-muted" style={mf}>Esta accion no se puede deshacer.</p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteModal(false)} className="flex-1 py-2 text-[10px] text-digi-muted border border-digi-border hover:bg-digi-darker transition-colors" style={pf}>Cancelar</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2 text-[10px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors disabled:opacity-50" style={pf}>
              {deleting ? 'Eliminando...' : 'Si, eliminar'}
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-digi-border/30 last:border-0">
      <span className="text-digi-muted">{label}</span>
      <span className="text-digi-text text-right">{value}</span>
    </div>
  );
}
