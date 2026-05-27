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

  // Actions (work log)
  const [actionForm, setActionForm] = useState<{ description: string; cost: string }>({ description: '', cost: '' });
  const [savingAction, setSavingAction] = useState(false);

  // Complete + invoice modal (standardized to match projects modal UI)
  const [completeModal, setCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeStep, setCompleteStep] = useState('');
  const [itemsMode, setItemsMode] = useState<'title' | 'breakdown'>('title');
  const [completeIdType, setCompleteIdType] = useState('07');
  const [completeClientName, setCompleteClientName] = useState('CONSUMIDOR FINAL');
  const [completeClientRuc, setCompleteClientRuc] = useState('9999999999999');
  const [completeClientEmail, setCompleteClientEmail] = useState('');
  const [completeClientPhone, setCompleteClientPhone] = useState('');
  const [completeClientAddress, setCompleteClientAddress] = useState('');
  const [completePaymentCode, setCompletePaymentCode] = useState('20');
  const [completeItems, setCompleteItems] = useState<{ description: string; quantity: string; unitPrice: string; ivaRate: string; discount: string }[]>([]);
  const [completeAdditionalFields, setCompleteAdditionalFields] = useState<{ name: string; value: string }[]>([]);
  const [completeSendEmail, setCompleteSendEmail] = useState(true);
  const [completeCurrency, setCompleteCurrency] = useState('USD');
  const [completeExchangeRate, setCompleteExchangeRate] = useState('1');
  const [currencies, setCurrencies] = useState<{ code: string; symbol: string; name: string; rate: number }[]>([]);

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

  useEffect(() => {
    fetch('/api/exchange-rates').then(r => r.json()).then(d => setCurrencies(d.currencies || [])).catch(() => {});
  }, []);

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
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Ticket actualizado');
      setEditing(false);
      fetchTicket();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleAddAction = async () => {
    const desc = actionForm.description.trim();
    const costNum = Number(actionForm.cost);
    if (!desc) { toast.error('Descripcion requerida'); return; }
    if (!Number.isFinite(costNum) || costNum < 0) { toast.error('Costo invalido'); return; }
    setSavingAction(true);
    try {
      const res = await fetch(`/api/tickets/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, cost: costNum }),
      });
      const json = await res.json();
      if (!res.ok) { toast.error(json.error || 'Error al guardar accion'); return; }
      toast.success('Accion agregada');
      setActionForm({ description: '', cost: '' });
      fetchTicket();
    } catch { toast.error('Error al guardar accion'); }
    finally { setSavingAction(false); }
  };

  const buildItemsForMode = (mode: 'title' | 'breakdown') => {
    if (mode === 'title') {
      return [{
        description: ticket.title || `Ticket #${ticket.id}`,
        quantity: '1',
        unitPrice: String(Number(ticket.estimated_cost) || 0),
        ivaRate: '0',
        discount: '0',
      }];
    }
    return (ticket.actions || []).map((a: any) => ({
      description: a.description,
      quantity: '1',
      unitPrice: String(Number(a.cost) || 0),
      ivaRate: '0',
      discount: '0',
    }));
  };

  const applyItemsMode = (mode: 'title' | 'breakdown') => {
    setItemsMode(mode);
    setCompleteItems(buildItemsForMode(mode));
  };

  const openCompleteModal = () => {
    const ruc = ticket?.client_ruc || '';
    setCompleteClientName(ticket?.client_name || 'CONSUMIDOR FINAL');
    setCompleteClientRuc(ruc || '9999999999999');
    setCompleteClientEmail(ticket?.client_email || '');
    setCompleteClientPhone(ticket?.client_phone || '');
    setCompleteClientAddress(ticket?.client_address || '');
    if (ruc.length === 13 && ruc.endsWith('001')) setCompleteIdType('04');
    else if (ruc.length === 10) setCompleteIdType('05');
    else if (ruc.length > 0) setCompleteIdType('06');
    else setCompleteIdType('07');
    setCompletePaymentCode('20');
    setCompleteCurrency('USD');
    setCompleteExchangeRate('1');
    setCompleteAdditionalFields([]);
    setCompleteSendEmail(true);
    const defaultMode: 'title' | 'breakdown' = (ticket.actions || []).length > 0 ? 'breakdown' : 'title';
    setItemsMode(defaultMode);
    setCompleteItems(buildItemsForMode(defaultMode));
    setCompleteModal(true);
  };

  const handleComplete = async (skipInvoice = false) => {
    setCompleting(true);
    setCompleteStep('Completando ticket...');
    try {
      setCompleteStep('Guardando datos del cliente...');
      await new Promise(r => setTimeout(r, 300));

      setCompleteStep(skipInvoice ? 'Finalizando ticket...' : 'Generando factura electronica...');
      const res = await fetch('/api/invoices/from-ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: id,
          skip_invoice: skipInvoice,
          send_email: completeSendEmail,
          client_id_type: completeIdType,
          client_name: completeClientName,
          client_ruc: completeClientRuc,
          client_email: completeClientEmail,
          client_phone: completeClientPhone,
          client_address: completeClientAddress,
          payment_code: completePaymentCode,
          invoice_items: completeItems.map(it => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            ivaRate: Number(it.ivaRate) || 0,
            discount: Number(it.discount) || 0,
          })),
          additional_fields: completeAdditionalFields.filter(f => f.name.trim() && f.value.trim()),
          currency: completeCurrency,
          exchange_rate: Number(completeExchangeRate) || 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error al completar'); return; }

      const sriOk = data.sriResult?.authorized;
      const sriError = data.sriResult?.error;
      if (data.invoiceId && sriOk) setCompleteStep('Factura autorizada por el SRI');
      else if (data.invoiceId && sriError) setCompleteStep(`Factura generada — SRI: ${sriError}`);

      await new Promise(r => setTimeout(r, 500));
      setCompleteStep('Proceso completado');
      await new Promise(r => setTimeout(r, 800));

      toast.success(
        'Ticket completado' +
        (skipInvoice ? ' (sin factura)' : (data.invoiceId ? ' — Factura generada' : '')) +
        (!skipInvoice && sriOk ? ' y autorizada por el SRI' : '') +
        (!skipInvoice && completeSendEmail && completeClientEmail && sriOk ? ' — Enviada por correo' : '')
      );
      if (sriError && !sriOk) toast.error(`SRI: ${sriError}`);

      setCompleteModal(false);
      fetchTicket();
    } catch { toast.error('Error al completar'); }
    finally { setCompleting(false); setCompleteStep(''); }
  };

  const handleDeleteAction = async (actionId: number) => {
    try {
      const res = await fetch(`/api/tickets/${id}/actions/${actionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Accion eliminada');
      fetchTicket();
    } catch { toast.error('Error al eliminar accion'); }
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
                      <p className="text-xs text-digi-text" style={mf}>{new Date(String(slot.date).split('T')[0] + 'T12:00:00').toLocaleDateString()}</p>
                      {slot.start_time && <p className="text-[9px] text-digi-muted" style={mf}>{slot.start_time} - {slot.end_time}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-digi-muted/50" style={mf}>Sin dias asignados</p>
              )}
            </div>

            {/* Acciones realizadas (member work log) - solo despues de que el miembro acepto */}
            {!isPending && ticket.status !== 'withdrawn' && (() => {
              const estimated = Number(ticket.estimated_cost) || 0;
              const actions = ticket.actions || [];
              const total = Number(ticket.actions_total) || 0;
              const remaining = Math.max(0, estimated - total);
              const canManageActions =
                (isAdmin || (isMember && user?.member_id && ticket.member_id === user.member_id)) && !isClosed;
              const budgetExhausted = estimated > 0 && remaining <= 0;
              return (
                <div className="pixel-card">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] text-accent-glow" style={pf}>Acciones Realizadas</h3>
                    {estimated > 0 && (
                      <span className="text-[9px] text-digi-muted" style={mf}>
                        ${total.toFixed(2)} / ${estimated.toFixed(2)} (disp. ${remaining.toFixed(2)})
                      </span>
                    )}
                  </div>

                  {actions.length > 0 ? (
                    <div className="space-y-2 mb-3">
                      {actions.map((a: any) => (
                        <div key={a.id} className="flex items-start justify-between gap-2 px-2 py-1.5 border border-digi-border/50">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-digi-text break-words" style={mf}>{a.description}</p>
                            <p className="text-[9px] text-digi-muted" style={mf}>
                              {new Date(a.created_at).toLocaleDateString()} - ${Number(a.cost).toFixed(2)}
                            </p>
                          </div>
                          {canManageActions && (
                            <button onClick={() => handleDeleteAction(a.id)}
                              className="text-[9px] text-red-400 hover:text-red-300 px-1" style={pf}>x</button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-digi-muted/50 mb-3" style={mf}>Sin acciones registradas</p>
                  )}

                  {canManageActions && (
                    estimated <= 0 ? (
                      <p className="text-[9px] text-amber-400" style={mf}>
                        Define un costo estimado en el ticket para registrar acciones.
                      </p>
                    ) : budgetExhausted ? (
                      <p className="text-[9px] text-amber-400" style={mf}>
                        Presupuesto agotado. No puedes agregar mas acciones.
                      </p>
                    ) : (
                      <div className="space-y-2 border-t border-digi-border/30 pt-3">
                        <PixelInput
                          label="Descripcion de la accion"
                          value={actionForm.description}
                          onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
                          placeholder="Que se hizo..."
                        />
                        <PixelInput
                          label={`Costo (USD) - max $${remaining.toFixed(2)}`}
                          type="number"
                          value={actionForm.cost}
                          onChange={(e) => setActionForm({ ...actionForm, cost: e.target.value })}
                          placeholder="0.00"
                        />
                        <button
                          onClick={handleAddAction}
                          disabled={savingAction || !actionForm.description.trim() || !actionForm.cost}
                          className="pixel-btn pixel-btn-primary w-full text-[9px] disabled:opacity-50">
                          {savingAction ? 'Guardando...' : 'Agregar Accion'}
                        </button>
                      </div>
                    )
                  )}
                </div>
              );
            })()}

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
                  {ticket.status === 'confirmed' && (isAdmin || (isMember && user?.member_id && ticket.member_id === user.member_id)) && (
                    <button onClick={openCompleteModal} className="pixel-btn pixel-btn-primary w-full text-[9px]">Completar</button>
                  )}
                  {isAdmin && ticket.status !== 'cancelled' && (
                    <button onClick={() => updateStatus('cancelled')}
                      className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
                      Cancelar Ticket
                    </button>
                  )}
                </div>
              </div>
            )}

            {isAdmin && (
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

      <PixelModal open={completeModal} onClose={() => !completing && setCompleteModal(false)} title="Completar Ticket y Generar Factura" size="lg">
        {completing ? (
          <div className="py-8 space-y-6">
            <div className="space-y-3">
              <div className="w-full h-1.5 bg-digi-border overflow-hidden">
                <div className="h-full bg-accent animate-[progressPulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
              </div>
              <p className="text-center text-xs text-accent-glow" style={mf}>{completeStep}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {[
                { label: 'Cliente', done: completeStep !== 'Guardando datos del cliente...' && completeStep !== 'Completando ticket...' },
                { label: 'Factura', done: completeStep.includes('autorizada') || completeStep.includes('Proceso completado') },
                { label: 'SRI', done: completeStep.includes('autorizada') || completeStep.includes('Proceso completado') },
                { label: 'Email', done: completeStep === 'Proceso completado' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-6 h-6 flex items-center justify-center text-[8px] border-2 transition-all ${s.done ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-digi-border text-digi-muted animate-pulse'}`} style={pf}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[8px] ${s.done ? 'text-green-400' : 'text-digi-muted'}`} style={pf}>{s.label}</span>
                  {i < 3 && <div className={`w-4 h-0.5 ${s.done ? 'bg-green-500' : 'bg-digi-border'}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-[8px] text-digi-muted" style={mf}>No cierres esta ventana hasta que el proceso termine</p>
          </div>
        ) : (
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          {/* Items mode toggle — exclusivo de tickets: define el origen de los items */}
          <div className="mb-3">
            <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mb-2" style={pf}>Items de la factura</h4>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => applyItemsMode('title')}
                className={`py-2 text-[9px] border transition-colors ${itemsMode === 'title' ? 'border-accent bg-accent/20 text-white' : 'border-digi-border text-digi-muted hover:border-accent/50'}`} style={pf}>
                Titulo del ticket<br /><span className="text-[8px] opacity-70">${Number(ticket.estimated_cost || 0).toFixed(2)}</span>
              </button>
              <button type="button" onClick={() => applyItemsMode('breakdown')} disabled={(ticket.actions || []).length === 0}
                className={`py-2 text-[9px] border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${itemsMode === 'breakdown' ? 'border-accent bg-accent/20 text-white' : 'border-digi-border text-digi-muted hover:border-accent/50'}`} style={pf}>
                Desglose de acciones<br /><span className="text-[8px] opacity-70">{(ticket.actions || []).length} items - ${Number(ticket.actions_total || 0).toFixed(2)}</span>
              </button>
            </div>
            <p className="text-[8px] text-digi-muted mt-1" style={pf}>Cambiar el modo recarga los items; luego puedes editarlos abajo.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ─── LEFT: Adquirente + Pago ─── */}
            <div className="space-y-2">
              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1" style={pf}>Adquirente</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Tipo ID <span className="text-red-400">*</span></label>
                  <select value={completeIdType} onChange={e => {
                    const t = e.target.value;
                    setCompleteIdType(t);
                    if (t === '07') { setCompleteClientRuc('9999999999999'); setCompleteClientName('CONSUMIDOR FINAL'); }
                    else { if (completeClientRuc === '9999999999999') setCompleteClientRuc(''); if (completeClientName === 'CONSUMIDOR FINAL') setCompleteClientName(''); }
                  }} className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value="04">RUC</option><option value="05">Cedula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Identificacion <span className="text-red-400">*</span></label>
                  <input value={completeClientRuc} onChange={e => setCompleteClientRuc(e.target.value)} disabled={completeIdType === '07'}
                    placeholder={completeIdType === '04' ? '0900000000001' : '0900000000'} maxLength={completeIdType === '04' ? 13 : completeIdType === '05' ? 10 : 20}
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                  {completeIdType === '04' && completeClientRuc && completeClientRuc.length !== 13 && <p className="text-[7px] text-red-400" style={mf}>13 digitos</p>}
                  {completeIdType === '05' && completeClientRuc && completeClientRuc.length !== 10 && <p className="text-[7px] text-red-400" style={mf}>10 digitos</p>}
                </div>
              </div>
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Razon Social <span className="text-red-400">*</span></label>
                <input value={completeClientName} onChange={e => setCompleteClientName(e.target.value)} disabled={completeIdType === '07'}
                  className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
              </div>
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Direccion <span className="text-red-400">*</span></label>
                <input value={completeClientAddress} onChange={e => setCompleteClientAddress(e.target.value)} placeholder="Direccion"
                  className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Email {completeIdType !== '07' && <span className="text-red-400">*</span>}</label>
                  <input value={completeClientEmail} onChange={e => setCompleteClientEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Telefono</label>
                  <input value={completeClientPhone} onChange={e => setCompleteClientPhone(e.target.value)} placeholder="0999999999"
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
              </div>

              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Forma de Pago</h4>
              <select value={completePaymentCode} onChange={e => setCompletePaymentCode(e.target.value)}
                className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                <option value="01">Sin utilizacion del sistema financiero</option>
                <option value="15">Compensacion de deudas</option>
                <option value="16">Tarjeta de debito</option>
                <option value="17">Dinero electronico</option>
                <option value="18">Tarjeta prepago</option>
                <option value="19">Tarjeta de credito</option>
                <option value="20">Otros con utilizacion del sistema financiero</option>
                <option value="21">Endoso de titulos</option>
              </select>

              {currencies.length > 0 && (
              <>
              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Moneda</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Moneda</label>
                  <select value={completeCurrency} onChange={e => {
                    const code = e.target.value;
                    setCompleteCurrency(code);
                    const c = currencies.find(c => c.code === code);
                    setCompleteExchangeRate(c ? String(c.rate) : '1');
                  }} className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Tasa (1 USD = ?)</label>
                  <input value={completeExchangeRate} onChange={e => setCompleteExchangeRate(e.target.value)}
                    type="number" min="0.0001" step="0.0001" disabled={completeCurrency === 'USD'}
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                </div>
              </div>
              {completeCurrency !== 'USD' && (
                <div className="px-2 py-1.5 border border-purple-500/30 bg-purple-900/10 text-[9px] text-purple-300 mt-1" style={mf}>
                  Equivalente para el cliente: {(() => {
                    const t = completeItems.reduce((s, it) => {
                      const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                      return s + base + base * ((Number(it.ivaRate) || 0) / 100);
                    }, 0);
                    const sym = currencies.find(c => c.code === completeCurrency)?.symbol || completeCurrency;
                    return `${sym} ${(t * (Number(completeExchangeRate) || 1)).toFixed(2)} ${completeCurrency}`;
                  })()}
                  <span className="text-digi-muted"> (referencia, factura en USD)</span>
                </div>
              )}
              </>
              )}

              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Campos Adicionales</h4>
              <div className="space-y-1">
                {completeAdditionalFields.map((f, i) => (
                  <div key={i} className="flex gap-1">
                    <input value={f.name} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setCompleteAdditionalFields(n); }}
                      placeholder="Nombre" className="w-1/3 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <input value={f.value} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setCompleteAdditionalFields(n); }}
                      placeholder="Descripcion" className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <button onClick={() => setCompleteAdditionalFields(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400/60 hover:text-red-400 text-[8px] px-1" style={pf}>X</button>
                  </div>
                ))}
                <button onClick={() => setCompleteAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                  className="text-[8px] text-digi-muted border border-digi-border px-2 py-0.5 hover:text-accent-glow hover:border-accent/30 transition-colors" style={pf}>+ Campo adicional</button>
              </div>
            </div>

            {/* ─── RIGHT: Detalle + Totales ─── */}
            <div className="space-y-2">
              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1" style={pf}>Detalle</h4>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {completeItems.map((item, i) => (
                  <div key={i} className="border border-digi-border/50 p-1.5">
                    <div className="flex gap-1 mb-1">
                      <input value={item.description} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], description: e.target.value }; setCompleteItems(n); }}
                        placeholder="Descripcion" className="flex-1 px-2 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <button onClick={() => setCompleteItems(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400/60 hover:text-red-400 text-[7px] px-1" style={pf}>X</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <div>
                        <label className="text-[7px] text-digi-muted" style={pf}>Cant.</label>
                        <input value={item.quantity} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], quantity: e.target.value }; setCompleteItems(n); }}
                          type="number" min="0.01" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      </div>
                      <div>
                        <label className="text-[7px] text-digi-muted" style={pf}>P.Unit.</label>
                        <input value={item.unitPrice} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setCompleteItems(n); }}
                          type="number" min="0" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      </div>
                      <div>
                        <label className="text-[7px] text-digi-muted" style={pf}>IVA</label>
                        <select value={item.ivaRate} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], ivaRate: e.target.value }; setCompleteItems(n); }}
                          className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                          <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[7px] text-digi-muted" style={pf}>Desc.</label>
                        <input value={item.discount} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], discount: e.target.value }; setCompleteItems(n); }}
                          type="number" min="0" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setCompleteItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
                className="text-[8px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>+ Item</button>

              {/* Totales */}
              {(() => {
                const subtotal = completeItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0), 0);
                const totalDiscount = completeItems.reduce((s, it) => s + (Number(it.discount) || 0), 0);
                const ivaByRate: Record<string, number> = {};
                completeItems.forEach(it => {
                  const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                  const rate = it.ivaRate || '0';
                  ivaByRate[rate] = (ivaByRate[rate] || 0) + base;
                });
                const totalIva = completeItems.reduce((s, it) => {
                  const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                  return s + base * ((Number(it.ivaRate) || 0) / 100);
                }, 0);
                return (
                  <div className="border-2 border-digi-border p-2 text-[9px] space-y-0.5" style={mf}>
                    {Object.entries(ivaByRate).map(([rate, base]) => (
                      <div key={rate} className="flex justify-between"><span className="text-digi-muted">Subtotal {rate}%:</span><span className="text-white">${base.toFixed(2)}</span></div>
                    ))}
                    {totalDiscount > 0 && <div className="flex justify-between"><span className="text-digi-muted">Total descuento:</span><span className="text-white">${totalDiscount.toFixed(2)}</span></div>}
                    {totalIva > 0 && <div className="flex justify-between"><span className="text-digi-muted">IVA:</span><span className="text-white">${totalIva.toFixed(2)}</span></div>}
                    <div className="flex justify-between border-t border-digi-border pt-1"><span className="text-accent-glow font-bold">Total:</span><span className="text-accent-glow font-bold">${(subtotal + totalIva).toFixed(2)}</span></div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* ─── Footer ─── */}
          {(() => {
            const invoiceTotal = completeItems.reduce((s, it) => {
              const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
              return s + base + base * ((Number(it.ivaRate) || 0) / 100);
            }, 0);
            const consumidorFinalOver50 = completeIdType === '07' && invoiceTotal > 50;
            const isFormValid = !completing && completeClientName.trim() && completeClientRuc.trim() && completeClientAddress.trim() && (completeIdType === '07' || completeClientEmail.trim()) && completeItems.length > 0 && !(completeIdType === '04' && completeClientRuc.length !== 13) && !(completeIdType === '05' && completeClientRuc.length !== 10) && !consumidorFinalOver50;
            return (
              <div className="pt-3 mt-3 border-t-2 border-digi-border space-y-2">
                {consumidorFinalOver50 && (
                  <div className="px-3 py-2 border border-red-700/50 bg-red-900/10 text-[9px] text-red-400" style={mf}>
                    El SRI requiere identificar al cliente (RUC o Cedula) en facturas mayores a $50.00. El total actual es ${invoiceTotal.toFixed(2)}. Cambia el tipo de identificacion.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={completeSendEmail} onChange={e => setCompleteSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                    <span className="text-[9px] text-digi-muted" style={mf}>Enviar por correo</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setCompleteModal(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
                    <button onClick={() => handleComplete(true)} disabled={completing} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-text hover:border-accent hover:text-white transition-colors disabled:opacity-50" style={pf}>
                      Completar sin Facturar
                    </button>
                    <button onClick={() => handleComplete(false)} disabled={!isFormValid} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                      Completar y Facturar
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        )}
      </PixelModal>

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
