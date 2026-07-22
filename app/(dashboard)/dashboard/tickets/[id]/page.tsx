'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import DetailHeader, { HeaderChip } from '@/components/ui/DetailHeader';
import PropertyRail from '@/components/ui/PropertyRail';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';
import { ChevronLeft, ChevronRight, X, LayoutList, ListChecks, Pencil, Check, Receipt, Send, DoorOpen, Sparkles, CalendarDays } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import ClientPicker from '@/components/clients/ClientPicker';
import { fmt2 } from '@/lib/format';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

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
const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

/** Cronómetro en vivo "HH:MM:SS" desde un instante ISO hasta ahora. */
function elapsedLabel(startISO: string): string {
  const start = new Date(startISO).getTime();
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

type SelectedDates = string[];

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bids, setBids] = useState<any[]>([]);
  const [proposalText, setProposalText] = useState('');
  const [sendingBid, setSendingBid] = useState(false);

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
  // Config por día marcado como "Evento" (con reunión Meet): { date: { is_event, start_time, end_time } }
  const [slotCfg, setSlotCfg] = useState<Record<string, { is_event: boolean; start_time: string; end_time: string }>>({});
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [savingSlots, setSavingSlots] = useState(false);

  // Sesiones en vivo ("inicio ahora")
  const [sessionBusy, setSessionBusy] = useState(false);
  // Tick de reloj para refrescar el cronómetro de la sesión en curso cada segundo.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

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
  // Fase 3: cobro por abono (monto parcial) en el modal de facturar.
  const [abonoMode, setAbonoMode] = useState(false);
  const [abonoAmount, setAbonoAmount] = useState('');
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
      fetch(`/api/tickets/${id}/payments`).then(r => r.json()).then(d => setPayments(d.data || null)).catch(() => {});
    } catch {
      toast.error('Error al cargar ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const loadBids = useCallback(async () => {
    try { const res = await fetch(`/api/tickets/${id}/bids`); const d = await res.json(); setBids(d.data || []); }
    catch { setBids([]); }
  }, [id]);
  useEffect(() => { if (ticket?.open_for_proposals) loadBids(); }, [ticket?.open_for_proposals, loadBids]);

  const sendProposal = async () => {
    setSendingBid(true);
    try {
      const res = await fetch(`/api/tickets/${id}/bids`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ proposal: proposalText }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error');
      toast.success('Propuesta enviada');
      setProposalText('');
      await loadBids();
    } catch (e: any) { toast.error(e.message); }
    finally { setSendingBid(false); }
  };
  const acceptProposal = async (bidId: number) => {
    try {
      const res = await fetch(`/api/tickets/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: bidId }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error');
      toast.success('Propuesta aceptada — miembro asignado');
      await fetchTicket();
      await loadBids();
    } catch (e: any) { toast.error(e.message); }
  };
  const takeByTalent = async () => {
    try {
      const res = await fetch(`/api/tickets/${id}/take`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error');
      toast.success('Tomaste el ticket — quedas asignado');
      await fetchTicket();
    } catch (e: any) { toast.error(e.message); }
  };

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
      client_email: '',
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
          client_email: form.client_email?.trim() || undefined,
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

  const openCompleteModal = async () => {
    // Fase 2: para facturar, el ticket debe tener un cliente asignado.
    if (!ticket?.client_id) { toast.error('Asigna un cliente al ticket antes de facturar (edítalo y elige el cliente).'); return; }
    // Prellenado por defecto desde los datos del cliente del ticket.
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
    // Si el cliente ya tiene cuenta de facturación, se prellena desde ahí (editable).
    try {
      const r = await fetch(`/api/billing-clients?portal_client_id=${ticket.client_id}`);
      const { data: bc } = await r.json();
      if (bc) {
        setCompleteIdType(bc.id_type || '07');
        setCompleteClientRuc(bc.ruc || '9999999999999');
        setCompleteClientName(bc.name || 'CONSUMIDOR FINAL');
        setCompleteClientEmail(bc.email || '');
        setCompleteClientPhone(bc.phone || '');
        setCompleteClientAddress(bc.address || '');
      }
    } catch { /* sin cuenta de facturación → se llena a mano */ }
    setCompletePaymentCode('20');
    setCompleteCurrency('USD');
    setCompleteExchangeRate('1');
    setCompleteAdditionalFields([]);
    setCompleteSendEmail(true);
    const defaultMode: 'title' | 'breakdown' = (ticket.actions || []).length > 0 ? 'breakdown' : 'title';
    setItemsMode(defaultMode);
    setCompleteItems(buildItemsForMode(defaultMode));
    setAbonoMode(false);
    setAbonoAmount('');
    setCompleteModal(true);
  };

  const handleComplete = async (skipInvoice = false) => {
    const pending = Number(payments?.pending ?? 0);
    const abonoNum = Number(abonoAmount) || 0;
    const useAbono = abonoMode && !skipInvoice;
    if (useAbono) {
      if (abonoNum <= 0) { toast.error('Ingresa el monto del abono'); return; }
      if (payments && abonoNum > pending + 0.009) { toast.error(`El abono no puede superar el pendiente ($${fmt2(pending)})`); return; }
    }
    const abonoItems = [{ description: `Abono a cuenta — ${ticket.title}`, quantity: 1, unitPrice: abonoNum, ivaRate: 0, discount: 0 }];
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
          is_abono: useAbono,
          send_email: completeSendEmail,
          client_id_type: completeIdType,
          client_name: completeClientName,
          client_ruc: completeClientRuc,
          client_email: completeClientEmail,
          client_phone: completeClientPhone,
          client_address: completeClientAddress,
          payment_code: completePaymentCode,
          invoice_items: (useAbono ? abonoItems : completeItems).map(it => ({
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
  // Construye el payload de días, validando que los eventos tengan horas coherentes.
  const buildSlotsPayload = (): { date: string; is_event: boolean; start_time: string | null; end_time: string | null }[] | null => {
    const out = [];
    for (const d of selectedDates) {
      const cfg = slotCfg[d];
      if (cfg?.is_event) {
        if (!cfg.start_time || !cfg.end_time) { toast.error(`El evento del ${d} necesita hora de inicio y fin`); return null; }
        if (cfg.end_time <= cfg.start_time) { toast.error(`El evento del ${d}: la hora de fin debe ser posterior al inicio`); return null; }
        out.push({ date: d, is_event: true, start_time: cfg.start_time, end_time: cfg.end_time });
      } else {
        out.push({ date: d, is_event: false, start_time: null, end_time: null });
      }
    }
    return out;
  };

  const startEditSlots = () => {
    const existing = (ticket.time_slots || []).map((s: any) => s.date?.split('T')[0]).filter(Boolean);
    const cfg: Record<string, { is_event: boolean; start_time: string; end_time: string }> = {};
    for (const s of (ticket.time_slots || [])) {
      const d = s.date?.split('T')[0];
      if (d) cfg[d] = { is_event: !!s.is_event, start_time: s.start_time || '', end_time: s.end_time || '' };
    }
    setSelectedDates(existing);
    setSlotCfg(cfg);
    setEditingSlots(true);
  };

  const handleSaveSlots = async () => {
    if (selectedDates.length === 0) { toast.error('Agrega al menos un dia'); return; }
    const payload = buildSlotsPayload();
    if (!payload) return;
    setSavingSlots(true);
    try {
      const res = await fetch(`/api/tickets/${id}/time-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_slots: payload }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error); }
      toast.success('Dias de trabajo actualizados');
      setEditingSlots(false);
      fetchTicket();
    } catch (e: any) { toast.error(e?.message || 'Error al guardar dias'); }
    finally { setSavingSlots(false); }
  };

  const handleAccept = () => {
    setSelectedDates([]);
    setSlotCfg({});
    setEditingSlots(true);
  };

  const handleAcceptWithSlots = async () => {
    if (selectedDates.length === 0) { toast.error('Agrega al menos un dia de trabajo'); return; }
    const payload = buildSlotsPayload();
    if (!payload) return;
    setSavingSlots(true);
    try {
      const res = await fetch(`/api/tickets/${id}/time-slots`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_slots: payload }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error); }
      await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
      toast.success('Ticket aceptado');
      setEditingSlots(false);
      fetchTicket();
    } catch (e: any) { toast.error(e?.message || 'Error'); }
    finally { setSavingSlots(false); }
  };

  // --- Sesiones en vivo ("inicio ahora") ---
  const handleStartSession = async () => {
    setSessionBusy(true);
    try {
      const res = await fetch(`/api/tickets/${id}/sessions`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success('Sesión iniciada');
      await fetchTicket();
    } catch (e: any) { toast.error(e?.message || 'Error al iniciar la sesión'); }
    finally { setSessionBusy(false); }
  };

  const handleFinishSession = async (actionId: number) => {
    setSessionBusy(true);
    try {
      const res = await fetch(`/api/tickets/${id}/sessions/${actionId}`, { method: 'PATCH' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success(`Sesión terminada · ${data.durationLabel} · $${fmt2(Number(data.cost))}`);
      if (data.overBudget) toast.warning(`Se superó el presupuesto estimado en $${fmt2(Number(data.over))}`);
      await fetchTicket();
    } catch (e: any) { toast.error(e?.message || 'Error al terminar la sesión'); }
    finally { setSessionBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando ticket..." /></div>;
  if (!ticket) return <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center"><p className="text-sm font-semibold text-red-500">Ticket no encontrado</p></div>;

  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';
  const canEdit = isAdmin || isMember;
  const isClosed = ['completed', 'cancelled'].includes(ticket.status);
  const isPending = ticket.status === 'pending';
  const timeSlots = ticket.time_slots || [];
  // Is this a request from a client to this member?
  const isRequestForMe = isPending && isMember && user?.member_id && ticket.member_id === user.member_id;
  const showActions = !isPending && ticket.status !== 'withdrawn';
  // Propuestas (tickets abiertos a propuestas).
  const isOpen = !!ticket.open_for_proposals;
  const isOwner = !!ticket.user_id && String(ticket.user_id) === String(user?.id);
  const myBid = bids.find((b: any) => b.member_id === user?.member_id);
  const canBid = isOpen && !isOwner && !!user?.member_id;
  // Completar y FACTURAR es exclusivo del admin (regla de negocio).
  const canCompleteTicket = ticket.status === 'confirmed' && isAdmin;

  // Cabecera de sección reutilizable dentro del panel unificado (icono + título + contador opcional).
  const SectionHead = ({ Icon, title, count, action }: any) => (
    <div className="flex items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-accent shrink-0" />
        <h3 className="text-[12px] font-semibold text-digi-text uppercase tracking-wide truncate" style={df}>{title}</h3>
        {count !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent tabular-nums shrink-0">{count}</span>
        )}
      </div>
      {action}
    </div>
  );

  // Editor de días de trabajo, INLINE dentro de la tarjeta "Días de trabajo" (no cambia de página).
  const renderSlotEditor = () => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    const deadlineStr = ticket.deadline ? ticket.deadline.split('T')[0] : '';
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const dayNames = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];
    const toggleDate = (d: string) => setSelectedDates(prev => {
      if (prev.includes(d)) { setSlotCfg(c => { const n = { ...c }; delete n[d]; return n; }); return prev.filter(x => x !== d); }
      setSlotCfg(c => c[d] ? c : { ...c, [d]: { is_event: false, start_time: '', end_time: '' } });
      return [...prev, d].sort();
    });
    const setCfg = (d: string, patch: Partial<{ is_event: boolean; start_time: string; end_time: string }>) =>
      setSlotCfg(c => ({ ...c, [d]: { ...(c[d] ?? { is_event: false, start_time: '', end_time: '' }), ...patch } }));
    const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
    const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <div>
        <div className="max-w-sm">
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="p-1.5 text-digi-muted hover:text-accent border border-digi-border rounded hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-[13px] font-semibold text-digi-text" style={mf}>{monthNames[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 text-digi-muted hover:text-accent border border-digi-border rounded hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {dayNames.map(d => <div key={d} className="text-center text-[10px] text-digi-muted py-1 font-medium" style={mf}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-3">
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} />;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedDates.includes(dateStr);
              const isOutOfRange = dateStr < todayStr || (!!deadlineStr && dateStr > deadlineStr);
              return (
                <button key={dateStr} onClick={() => !isOutOfRange && toggleDate(dateStr)} disabled={isOutOfRange}
                  className={`py-1.5 text-[12px] text-center rounded border transition-colors ${isSelected ? 'bg-accent border-accent text-white font-medium' : isOutOfRange ? 'border-transparent text-digi-muted/30 cursor-default' : 'border-digi-border/60 text-digi-text hover:border-accent hover:bg-accent-light'}`}
                  style={mf}>{day}</button>
              );
            })}
          </div>
        </div>
        {selectedDates.length > 0 && (
          <div className="border-t border-digi-border pt-3 mb-3 space-y-2">
            {selectedDates.map(d => {
              const cfg = slotCfg[d] || { is_event: false, start_time: '', end_time: '' };
              return (
                <div key={d} className="border border-digi-border rounded-md p-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-[12px] font-medium text-digi-text" style={mf}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 text-[11px] text-digi-text cursor-pointer" style={mf}>
                        <input type="checkbox" checked={cfg.is_event} onChange={(e) => setCfg(d, { is_event: e.target.checked })}
                          className="accent-[var(--accent,#7c6cf5)]" />
                        Evento (reunión Meet)
                      </label>
                      <button onClick={() => toggleDate(d)} className="text-digi-muted hover:text-red-500 text-[14px] leading-none">×</button>
                    </div>
                  </div>
                  {cfg.is_event && (
                    <div className="flex items-end gap-2 mt-2 max-w-xs">
                      <div className="flex-1"><PixelInput label="Inicio" type="time" value={cfg.start_time} onChange={(e) => setCfg(d, { start_time: e.target.value })} /></div>
                      <div className="flex-1"><PixelInput label="Fin" type="time" value={cfg.end_time} onChange={(e) => setCfg(d, { end_time: e.target.value })} /></div>
                    </div>
                  )}
                  {cfg.is_event && (
                    <p className="text-[10px] text-digi-muted mt-1.5" style={mf}>
                      Se creará una reunión de Google Meet invitando al cliente{ticket.client_name ? ` (${ticket.client_name})` : ''} y al miembro. Horario de Ecuador (GMT-5).
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2 max-w-sm">
          <button onClick={() => setEditingSlots(false)} className={`${BTN_SECONDARY} flex-1`}>Cancelar</button>
          <button onClick={isRequestForMe ? handleAcceptWithSlots : handleSaveSlots} disabled={savingSlots || selectedDates.length === 0}
            className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>
            {savingSlots ? 'Guardando...' : isRequestForMe ? `Aceptar (${selectedDates.length} días)` : `Guardar (${selectedDates.length} días)`}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div>
      <DetailHeader
        breadcrumb={{ label: 'Tickets', href: '/dashboard/tickets' }}
        title={ticket.title || `Ticket #${ticket.id}`}
        status={<PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{STATUS_LABEL[ticket.status] || ticket.status}</PixelBadge>}
        chips={(
          <>
            {ticket.client_name && <HeaderChip>{ticket.client_name}</HeaderChip>}
            {ticket.estimated_cost != null && ticket.estimated_cost !== '' && <HeaderChip>${fmt2(Number(ticket.estimated_cost))}</HeaderChip>}
            {ticket.deadline && <HeaderChip>Límite {new Date(ticket.deadline).toLocaleDateString()}</HeaderChip>}
          </>
        )}
        actions={!editingSlots ? (
          <>
            {(ticket.status === 'pending' || ticket.status === 'withdrawn') && canEdit && !isRequestForMe && (
              <button onClick={() => updateStatus('confirmed')} className={BTN_PRIMARY}><Check className="w-4 h-4" /> Confirmar</button>
            )}
            {canCompleteTicket && (
              <button onClick={openCompleteModal} className={BTN_PRIMARY}><Receipt className="w-4 h-4" /> Completar y facturar</button>
            )}
            {canEdit && <button onClick={startEdit} className={BTN_SECONDARY}><Pencil className="w-3.5 h-3.5" /> Editar</button>}
          </>
        ) : undefined}
        overflow={!editingSlots ? [
          ...(isAdmin && ticket.status !== 'cancelled' ? [{ label: 'Cancelar ticket', onClick: () => updateStatus('cancelled'), danger: true }] : []),
          ...(isAdmin ? [{ label: 'Eliminar ticket', onClick: () => setDeleteModal(true), danger: true }] : []),
        ] : []}
      />

      {/* ========== PENDING REQUEST BANNER ========== */}
      {isRequestForMe && !editingSlots && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
          <p className="text-[13px] font-semibold text-amber-800 mb-1" style={mf}>Solicitud pendiente de un cliente</p>
          <p className="text-[12px] text-digi-muted mb-3" style={mf}>
            El cliente {ticket.client_name || ''} te ha solicitado este servicio. Acepta e indica los días de trabajo, o rechaza la solicitud.
          </p>
          <div className="flex gap-2">
            <button onClick={handleAccept} className={BTN_PRIMARY}>
              <Check className="w-4 h-4" /> Aceptar e indicar días
            </button>
            <button onClick={() => updateStatus('cancelled')}
              className="inline-flex items-center gap-1.5 py-2 px-3 text-sm font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors" style={mf}>
              <X className="w-4 h-4" /> Rechazar
            </button>
          </div>
        </div>
      )}


      {/* ========== VIEW MODE — panel unificado (sin pestañas) + property rail ========== */}
      <div className="flex flex-col lg:flex-row gap-4 items-start">
          {/* ── IZQUIERDA: Días de trabajo ── */}
          <aside className="w-full lg:w-[300px] shrink-0 order-2 lg:order-1">
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4 lg:sticky lg:top-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-[13px] font-semibold text-digi-text inline-flex items-center gap-1.5" style={mf}>
                  <CalendarDays className="w-4 h-4 text-accent" /> Días de trabajo
                  {timeSlots.length > 0 && <span className="text-digi-muted font-normal">({timeSlots.length})</span>}
                </h3>
                {canEdit && !isClosed && !editingSlots && (
                  <button onClick={startEditSlots} className="shrink-0 text-[11px] text-accent border border-digi-border rounded px-2 py-1 hover:bg-accent/5 transition-colors" style={pf}>Editar</button>
                )}
              </div>
              {editingSlots ? (
                renderSlotEditor()
              ) : timeSlots.length > 0 ? (
                <div className="space-y-2">
                  {timeSlots.map((slot: any, i: number) => (
                    <div key={i} className={`px-2.5 py-2 border rounded ${slot.is_event ? 'border-accent/40 bg-accent-light' : 'border-digi-border bg-[#faf9f8]'}`}>
                      {slot.is_event && (
                        <span className="inline-block mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent" style={mf}>Evento</span>
                      )}
                      <p className="text-xs text-digi-text" style={mf}>{new Date(String(slot.date).split('T')[0] + 'T12:00:00').toLocaleDateString()}</p>
                      {slot.start_time && <p className="text-[11px] text-digi-muted" style={mf}>{slot.start_time} - {slot.end_time}</p>}
                      {slot.is_event && slot.meeting_url && (
                        <a href={slot.meeting_url} target="_blank" rel="noopener noreferrer"
                          className="inline-block mt-1 text-[10.5px] font-medium text-accent hover:underline" style={mf}>Unirse (Meet)</a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-digi-muted" style={mf}>Sin días asignados</p>
              )}
            </div>
          </aside>

          {/* Columna principal: TODO en un solo espacio (resumen + acciones combinados) */}
          <div className="flex-1 min-w-0 w-full space-y-4 order-1 lg:order-2">
            {ticket.open_for_talent && (
              <div className="bg-digi-card border border-accent/30 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <DoorOpen className="w-4 h-4 text-accent" />
                  <h3 className="text-[12px] font-semibold text-digi-text" style={df}>Abierto por talento</h3>
                </div>
                <p className="text-[11.5px] text-digi-muted mb-2" style={mf}>Un miembro con al menos uno de los talentos requeridos puede tomar este ticket de inmediato.</p>
                {(ticket.required_talents || []).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-digi-muted shrink-0" />
                    {(ticket.required_talents || []).map((t: string) => (
                      <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded bg-black/[0.05] text-digi-text" style={mf}>{t}</span>
                    ))}
                  </div>
                )}
                {!isOwner && !!user?.member_id && (
                  <button onClick={takeByTalent} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md px-3 py-1.5" style={mf}>
                    <Check className="w-3.5 h-3.5" /> Tomar este ticket
                  </button>
                )}
                {isOwner && <p className="text-[10.5px] text-digi-muted" style={mf}>Estás esperando a que un miembro con el talento lo tome.</p>}
              </div>
            )}

            {/* ── PANEL DE TRABAJO: descripción + días + registro/sesiones, todo en una tarjeta ── */}
            {(() => {
              const estimated = Number(ticket.estimated_cost) || 0;
              const actions = ticket.actions || [];
              const total = Number(ticket.actions_total) || 0;
              const remaining = Math.max(0, estimated - total);
              const canManageActions =
                (isAdmin || (isMember && user?.member_id && ticket.member_id === user.member_id)) && !isClosed;
              const budgetExhausted = estimated > 0 && remaining <= 0;
              const pct = estimated > 0 ? Math.min(100, (total / estimated) * 100) : 0;
              const serviceRate = Number(ticket.service_base_price) || 0;
              const runningSession = actions.find((a: any) => a.session_started_at && !a.session_ended_at);
              // Días de trabajo se movió al panel izquierdo; esta tarjeta solo agrupa
              // Descripción + Registro. Si no hay ninguno, no se renderiza (evita caja vacía).
              if (!ticket.description && !showActions) return null;
              return (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
                  {/* Descripción */}
                  {ticket.description && (
                    <div className="p-4 border-b border-digi-border">
                      <SectionHead Icon={LayoutList} title="Descripción" />
                      <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{ticket.description}</p>
                    </div>
                  )}

                  {/* Registro de trabajo y sesiones (antes pestaña "Acciones") */}
                  {showActions && (
                    <div className="p-4">
                      <SectionHead Icon={ListChecks} title="Registro de trabajo" count={actions.length || undefined} />

                      {estimated > 0 && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-[11px] mb-1.5" style={mf}>
                            <span className="text-digi-muted">Presupuesto</span>
                            <span className="text-digi-text">${fmt2(total)} / ${fmt2(estimated)} · disp. <span className={remaining <= 0 ? 'text-red-500' : 'text-green-600'}>${fmt2(remaining)}</span></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[#edebe9] overflow-hidden">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )}

                      {/* Sesión en vivo ("inicio ahora"): inicia reunión + cronómetro; cobra el tiempo real. */}
                      {canManageActions && (
                        <div className="mb-2 rounded-md border border-accent/25 bg-accent-light/60 p-3">
                          {runningSession ? (
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <p className="text-[11px] font-semibold text-accent flex items-center gap-1.5" style={mf}>
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> Sesión en curso
                                </p>
                                <p className="text-[20px] font-bold text-digi-text tabular-nums leading-tight" style={df}>{elapsedLabel(runningSession.session_started_at)}</p>
                                {serviceRate > 0 && (
                                  <p className="text-[10px] text-digi-muted" style={mf}>
                                    ${fmt2(serviceRate)}/h · llevas ${fmt2((Math.max(0, (Date.now() - new Date(runningSession.session_started_at).getTime()) / 1000) / 3600) * serviceRate)}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {runningSession.meeting_url && (
                                  <a href={runningSession.meeting_url} target="_blank" rel="noopener noreferrer" className={BTN_SECONDARY}>Unirse (Meet)</a>
                                )}
                                <button onClick={() => handleFinishSession(runningSession.id)} disabled={sessionBusy} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                                  <Check className="w-4 h-4" /> {sessionBusy ? '...' : 'Terminar sesión'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <p className="text-[12px] font-semibold text-digi-text" style={mf}>Iniciar sesión ahora</p>
                                <p className="text-[10.5px] text-digi-muted" style={mf}>
                                  {serviceRate > 0
                                    ? `Crea la reunión (Meet) e inicia el cronómetro. Se cobra el tiempo real a $${fmt2(serviceRate)}/h.`
                                    : 'El servicio del ticket no tiene precio por hora definido.'}
                                </p>
                              </div>
                              <button onClick={handleStartSession} disabled={sessionBusy || serviceRate <= 0} className={`${BTN_PRIMARY} disabled:opacity-50`}>
                                {sessionBusy ? '...' : 'Iniciar sesión ahora'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="-mx-1">
                        {actions.length > 0 ? actions.map((a: any) => {
                          const isRunning = a.session_started_at && !a.session_ended_at;
                          return (
                          <div key={a.id} className="group flex items-center gap-3 px-3 py-2 rounded hover:bg-[#f3f2f1] transition-colors">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isRunning ? 'bg-red-500 animate-pulse' : 'bg-accent'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-digi-text break-words" style={mf}>{a.description}</p>
                              <p className="text-[10px] text-digi-muted" style={mf}>{new Date(a.created_at).toLocaleDateString()}</p>
                            </div>
                            {isRunning ? (
                              <span className="text-[12px] font-semibold text-accent shrink-0 tabular-nums" style={mf}>{elapsedLabel(a.session_started_at)}</span>
                            ) : (
                              <span className="text-[12px] font-semibold text-digi-text shrink-0" style={mf}>${fmt2(Number(a.cost))}</span>
                            )}
                            {canManageActions && (
                              <button onClick={() => handleDeleteAction(a.id)} aria-label="Eliminar acción" className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-600 transition-opacity shrink-0"><X className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                          );
                        }) : (
                          <p className="text-[11px] text-digi-muted px-3 py-5 text-center" style={mf}>Sin acciones registradas</p>
                        )}
                      </div>

                      {canManageActions && (
                        estimated <= 0 ? (
                          <p className="text-[11px] text-amber-600 pt-2" style={mf}>Define un costo estimado en el ticket para registrar acciones.</p>
                        ) : budgetExhausted ? (
                          <p className="text-[11px] text-amber-600 pt-2" style={mf}>Presupuesto agotado. No puedes agregar más acciones.</p>
                        ) : (
                          <div className="border-t border-digi-border pt-3 mt-2 flex flex-col sm:flex-row gap-2 sm:items-end">
                            <div className="flex-1"><PixelInput label="Nueva acción" value={actionForm.description} onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })} placeholder="Qué se hizo..." /></div>
                            <div className="w-full sm:w-36"><PixelInput label={`Costo (máx $${fmt2(remaining)})`} type="number" value={actionForm.cost} onChange={(e) => setActionForm({ ...actionForm, cost: e.target.value })} placeholder="0.00" /></div>
                            <button onClick={handleAddAction} disabled={savingAction || !actionForm.description.trim() || !actionForm.cost} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50 shrink-0">{savingAction ? '...' : 'Agregar'}</button>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {isOpen && (
              <div className="space-y-3">
                {canBid && !myBid && (
                  <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
                    <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-2" style={pf}>Postularme a este ticket</h3>
                    <textarea
                      className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none"
                      rows={3} value={proposalText} onChange={(e) => setProposalText(e.target.value)}
                      placeholder="Cuéntale al cliente por qué eres la persona indicada…"
                    />
                    <div className="flex justify-end mt-2">
                      <button onClick={sendProposal} disabled={sendingBid} className="pixel-btn pixel-btn-primary text-sm inline-flex items-center gap-1.5 disabled:opacity-50">
                        <Send className="w-3.5 h-3.5" /> {sendingBid ? 'Enviando…' : 'Enviar propuesta'}
                      </button>
                    </div>
                  </div>
                )}
                {myBid && (
                  <div className="bg-accent-light border border-accent/20 rounded-lg p-3 text-[12px] text-digi-text" style={mf}>
                    Ya enviaste tu propuesta{myBid.status === 'accepted' ? ' y fue aceptada ✓' : myBid.status === 'rejected' ? ' (no fue seleccionada).' : ' — a la espera de que el cliente decida.'}
                  </div>
                )}
                {!isOwner && !canBid && !myBid && (
                  <p className="text-[11px] text-digi-muted" style={mf}>Solo miembros pueden postularse a este ticket.</p>
                )}
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-digi-border">
                    <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Propuestas ({bids.length})</h3>
                  </div>
                  <div className="p-2">
                    {bids.length > 0 ? bids.map((b: any) => (
                      <div key={b.id} className="flex items-start gap-3 px-3 py-2.5 rounded hover:bg-[#f3f2f1] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0 text-[12px] font-semibold text-accent" style={df}>
                          {(b.member_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[12.5px] font-medium text-digi-text truncate" style={mf}>{b.member_name || `Miembro #${b.member_id}`}</span>
                            <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full ${b.status === 'accepted' ? 'bg-green-100 text-green-700' : b.status === 'rejected' ? 'bg-black/[0.06] text-digi-muted' : 'bg-amber-100 text-amber-700'}`} style={mf}>
                              {b.status === 'accepted' ? 'Aceptada' : b.status === 'rejected' ? 'No seleccionada' : 'Pendiente'}
                            </span>
                          </div>
                          {b.proposal && <p className="text-[11.5px] text-digi-text mt-1 leading-snug whitespace-pre-wrap" style={mf}>{b.proposal}</p>}
                        </div>
                        {isOwner && b.status === 'pending' && (
                          <button onClick={() => acceptProposal(b.id)} className="inline-flex items-center gap-1 text-[11px] text-white bg-green-600 hover:bg-green-700 rounded px-2 py-1 shrink-0 transition-colors" style={mf}>
                            <Check className="w-3 h-3" /> Aceptar
                          </button>
                        )}
                      </div>
                    )) : (
                      <p className="text-[11px] text-digi-muted px-3 py-5 text-center" style={mf}>Aún no hay propuestas.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-full lg:w-[300px] shrink-0 order-3">
          <PropertyRail
            items={[
              { label: 'Cliente', value: ticket.client_name || '-' },
              { label: 'Miembro', value: ticket.member_name || '-' },
              { label: 'Servicio', value: ticket.service_name || '-' },
              { label: 'Límite', value: ticket.deadline ? new Date(ticket.deadline).toLocaleDateString() : '-' },
              { label: 'Horas est.', value: ticket.estimated_hours ? `${ticket.estimated_hours}h` : '-' },
              { label: 'Costo est.', value: ticket.estimated_cost ? `$${fmt2(Number(ticket.estimated_cost))}` : '-' },
              { label: 'Creado', value: new Date(ticket.created_at).toLocaleDateString() },
            ]}
          >
            {canEdit && !isClosed && !isRequestForMe && ((ticket.status === 'pending' || ticket.status === 'withdrawn') || canCompleteTicket) && (
              <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm space-y-2">
                <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Acciones rápidas</h3>
                {(ticket.status === 'pending' || ticket.status === 'withdrawn') && (
                  <button onClick={() => updateStatus('confirmed')} className={`${BTN_PRIMARY} w-full`}><Check className="w-4 h-4" /> Confirmar</button>
                )}
                {canCompleteTicket && (
                  <button onClick={openCompleteModal} className={`${BTN_PRIMARY} w-full`}><Receipt className="w-4 h-4" /> Completar y facturar</button>
                )}
              </div>
            )}
            {payments && (Number(payments.total) > 0 || (payments.invoices || []).length > 0) && (() => {
              const pct = payments.total > 0 ? Math.min(100, (payments.invoiced / payments.total) * 100) : 0;
              return (
                <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
                  <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-2" style={pf}>Pagos</h3>
                  <div className="space-y-1 text-[12px]" style={mf}>
                    <div className="flex justify-between"><span className="text-digi-muted">Total</span><span className="text-digi-text tabular-nums">${fmt2(payments.total)}</span></div>
                    <div className="flex justify-between"><span className="text-digi-muted">Facturado</span><span className="text-green-600 tabular-nums">${fmt2(payments.invoiced)}</span></div>
                    <div className="flex justify-between"><span className="text-digi-muted">Pendiente</span><span className={`tabular-nums ${payments.pending > 0 ? 'text-amber-600' : 'text-digi-text'}`}>${fmt2(payments.pending)}</span></div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[#edebe9] overflow-hidden my-2"><div className="h-full rounded-full bg-green-500" style={{ width: `${pct}%` }} /></div>
                  {(payments.invoices || []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-digi-border space-y-0.5">
                      {payments.invoices.map((inv: any) => (
                        <button key={inv.id} onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="w-full flex items-center justify-between gap-2 text-[11.5px] hover:bg-black/[0.03] rounded px-1.5 py-1 transition-colors" style={mf}>
                          <span className="min-w-0 truncate text-digi-text">{inv.invoice_number || `#${inv.id}`}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className={`tabular-nums ${inv.status === 'cancelled' ? 'line-through text-digi-muted' : 'text-digi-text'}`}>${fmt2(inv.total)}</span>
                            {inv.status === 'cancelled' ? <span className="text-[9px] text-red-500">anulada</span> : inv.sri_status === 'authorized' ? <span className="text-[9px] text-green-600">SRI</span> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </PropertyRail>
          </div>
        </div>

      {/* ========== Modal de edición del ticket (overlay centrado) ========== */}
      <PixelModal open={editing} onClose={() => setEditing(false)} title="Editar ticket" size="lg">
        <div className="space-y-4">
          <PixelInput label="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={mf}>Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4}
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PixelSelect label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUSES} />
            <PixelSelect label="Servicio" value={form.service_id} onChange={(e) => setForm({ ...form, service_id: e.target.value })}
              options={services.map((s: any) => ({ value: String(s.id), label: s.name }))} placeholder="-- Sin servicio --" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PixelSelect label="Miembro asignado" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              options={members.map((m: any) => ({ value: String(m.id), label: m.name }))} placeholder="-- Sin asignar --" />
            <ClientPicker clientId={form.client_id} clientEmail={form.client_email || ''}
              onChange={(v) => setForm({ ...form, client_id: v.clientId, client_email: v.clientEmail })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PixelInput label="Fecha limite" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <PixelInput label="Horas estimadas" type="number" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
            <PixelInput label="Costo estimado (USD)" type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2 border-t border-digi-border">
            <button onClick={() => setEditing(false)} className={`${BTN_SECONDARY} flex-1`}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.title?.trim()} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </PixelModal>

      <PixelModal open={completeModal} onClose={() => !completing && setCompleteModal(false)} title="Completar Ticket y Generar Factura" size="lg">
        {completing ? (
          <div className="py-8 space-y-6">
            <div className="space-y-3">
              <div className="w-full h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                <div className="h-full bg-accent animate-[progressPulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
              </div>
              <p className="text-center text-[13px] text-digi-text" style={mf}>{completeStep}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {[
                { label: 'Cliente', done: completeStep !== 'Guardando datos del cliente...' && completeStep !== 'Completando ticket...' },
                { label: 'Factura', done: completeStep.includes('autorizada') || completeStep.includes('Proceso completado') },
                { label: 'SRI', done: completeStep.includes('autorizada') || completeStep.includes('Proceso completado') },
                { label: 'Email', done: completeStep === 'Proceso completado' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] border-2 transition-all ${s.done ? 'border-green-500 bg-green-50 text-green-600' : 'border-digi-border text-digi-muted animate-pulse'}`} style={pf}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[11px] ${s.done ? 'text-green-600' : 'text-digi-muted'}`} style={pf}>{s.label}</span>
                  {i < 3 && <div className={`w-4 h-0.5 ${s.done ? 'bg-green-500' : 'bg-digi-border'}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-[12px] text-digi-muted" style={mf}>No cierres esta ventana hasta que el proceso termine</p>
          </div>
        ) : (
        <div className="max-h-[80vh] overflow-y-auto pr-1">
          {/* Fase 3: Tipo de cobro — factura total o abono parcial */}
          {payments && (() => {
            const hasInvoiced = (payments.invoices || []).some((i: any) => i.status !== 'cancelled');
            return (
              <div className="mb-3">
                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mb-2" style={pf}>Tipo de cobro</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAbonoMode(false)} disabled={hasInvoiced}
                    className={`py-2 text-[12px] rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${!abonoMode ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:border-accent/50'}`} style={pf}>
                    Factura total<br /><span className="text-[11px] opacity-70">${fmt2(payments.total)}</span>
                  </button>
                  <button type="button" onClick={() => { setAbonoMode(true); if (!abonoAmount) setAbonoAmount(String(payments.pending)); }}
                    className={`py-2 text-[12px] rounded border transition-colors ${abonoMode ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:border-accent/50'}`} style={pf}>
                    Abono parcial<br /><span className="text-[11px] opacity-70">pendiente ${fmt2(payments.pending)}</span>
                  </button>
                </div>
                {abonoMode && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <label className="text-[11px] text-digi-muted" style={pf}>Monto del abono ($)</label>
                    <input value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} type="number" placeholder="0.00"
                      className="field-control w-32 px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <span className="text-[11px] text-digi-muted" style={pf}>de ${fmt2(payments.pending)} pendiente · factura una línea "Abono a cuenta"</span>
                  </div>
                )}
                <p className="text-[11px] text-digi-muted mt-1" style={pf}>El abono no completa el ticket hasta cubrir el total.</p>
              </div>
            );
          })()}

          {/* Items mode toggle — exclusivo de tickets: define el origen de los items */}
          {!abonoMode && (
          <div className="mb-3">
            <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mb-2" style={pf}>Items de la factura</h4>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => applyItemsMode('title')}
                className={`py-2 text-[12px] rounded border transition-colors ${itemsMode === 'title' ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:border-accent/50'}`} style={pf}>
                Titulo del ticket<br /><span className="text-[11px] opacity-70">${fmt2(Number(ticket.estimated_cost || 0))}</span>
              </button>
              <button type="button" onClick={() => applyItemsMode('breakdown')} disabled={(ticket.actions || []).length === 0}
                className={`py-2 text-[12px] rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${itemsMode === 'breakdown' ? 'border-accent bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:border-accent/50'}`} style={pf}>
                Desglose de acciones<br /><span className="text-[11px] opacity-70">{(ticket.actions || []).length} items - ${fmt2(Number(ticket.actions_total || 0))}</span>
              </button>
            </div>
            <p className="text-[11px] text-digi-muted mt-1" style={pf}>Cambiar el modo recarga los items; luego puedes editarlos abajo.</p>
          </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ─── LEFT: Adquirente + Pago ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-digi-border pb-1">
                <h4 className="text-[12px] font-semibold text-digi-text" style={mf}>Adquirente</h4>
                <span className="text-[10.5px] text-digi-muted" style={pf}>Datos del cliente del ticket</span>
              </div>
              <p className="text-[10.5px] text-digi-muted" style={pf}>Se prellenan desde la cuenta de facturación del cliente. Al facturar, los cambios se guardan para las próximas facturas.</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Tipo ID <span className="text-red-500">*</span></label>
                  <select value={completeIdType} onChange={e => {
                    const t = e.target.value;
                    setCompleteIdType(t);
                    if (t === '07') { setCompleteClientRuc('9999999999999'); setCompleteClientName('CONSUMIDOR FINAL'); }
                    else { if (completeClientRuc === '9999999999999') setCompleteClientRuc(''); if (completeClientName === 'CONSUMIDOR FINAL') setCompleteClientName(''); }
                  }} className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value="04">RUC</option><option value="05">Cedula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                  </select>
                </div>
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Identificacion <span className="text-red-500">*</span></label>
                  <input value={completeClientRuc} onChange={e => setCompleteClientRuc(e.target.value)} disabled={completeIdType === '07'}
                    placeholder={completeIdType === '04' ? '0900000000001' : '0900000000'} maxLength={completeIdType === '04' ? 13 : completeIdType === '05' ? 10 : 20}
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                  {completeIdType === '04' && completeClientRuc && completeClientRuc.length !== 13 && <p className="text-[11px] text-red-500" style={mf}>13 digitos</p>}
                  {completeIdType === '05' && completeClientRuc && completeClientRuc.length !== 10 && <p className="text-[11px] text-red-500" style={mf}>10 digitos</p>}
                </div>
              </div>
              <div>
                <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Razon Social <span className="text-red-500">*</span></label>
                <input value={completeClientName} onChange={e => setCompleteClientName(e.target.value)} disabled={completeIdType === '07'}
                  className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
              </div>
              <div>
                <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Direccion <span className="text-red-500">*</span></label>
                <input value={completeClientAddress} onChange={e => setCompleteClientAddress(e.target.value)} placeholder="Direccion"
                  className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Email {completeIdType !== '07' && <span className="text-red-500">*</span>}</label>
                  <input value={completeClientEmail} onChange={e => setCompleteClientEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Telefono</label>
                  <input value={completeClientPhone} onChange={e => setCompleteClientPhone(e.target.value)} placeholder="0999999999"
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
              </div>

              <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Forma de Pago</h4>
              <select value={completePaymentCode} onChange={e => setCompletePaymentCode(e.target.value)}
                className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
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
              <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Moneda</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Moneda</label>
                  <select value={completeCurrency} onChange={e => {
                    const code = e.target.value;
                    setCompleteCurrency(code);
                    const c = currencies.find(c => c.code === code);
                    setCompleteExchangeRate(c ? String(c.rate) : '1');
                  }} className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Tasa (1 USD = ?)</label>
                  <input value={completeExchangeRate} onChange={e => setCompleteExchangeRate(e.target.value)}
                    type="number" min="0.0001" step="0.0001" disabled={completeCurrency === 'USD'}
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                </div>
              </div>
              {completeCurrency !== 'USD' && (
                <div className="px-2 py-1.5 border border-accent/30 rounded bg-accent-light text-[12px] text-accent mt-1" style={mf}>
                  Equivalente para el cliente: {(() => {
                    const t = completeItems.reduce((s, it) => {
                      const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                      return s + base + base * ((Number(it.ivaRate) || 0) / 100);
                    }, 0);
                    const sym = currencies.find(c => c.code === completeCurrency)?.symbol || completeCurrency;
                    return `${sym} ${fmt2((t * (Number(completeExchangeRate) || 1)))} ${completeCurrency}`;
                  })()}
                  <span className="text-digi-muted"> (referencia, factura en USD)</span>
                </div>
              )}
              </>
              )}

              <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Campos Adicionales</h4>
              <div className="space-y-1">
                {completeAdditionalFields.map((f, i) => (
                  <div key={i} className="flex gap-1">
                    <input value={f.name} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setCompleteAdditionalFields(n); }}
                      placeholder="Nombre" className="w-1/3 field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <input value={f.value} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setCompleteAdditionalFields(n); }}
                      placeholder="Descripcion" className="flex-1 field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <button onClick={() => setCompleteAdditionalFields(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-500/70 hover:text-red-600 text-[13px] px-1" style={pf}>X</button>
                  </div>
                ))}
                <button onClick={() => setCompleteAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                  className="text-[12px] text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={pf}>+ Campo adicional</button>
              </div>
            </div>

            {/* ─── RIGHT: Detalle + Totales ─── */}
            <div className="space-y-2">
              <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5" style={pf}>Detalle</h4>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {completeItems.map((item, i) => (
                  <div key={i} className="border border-digi-border rounded-lg p-2">
                    <div className="flex gap-1 mb-1">
                      <input value={item.description} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], description: e.target.value }; setCompleteItems(n); }}
                        placeholder="Descripcion" className="flex-1 px-2 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <button onClick={() => setCompleteItems(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-500/70 hover:text-red-600 text-[13px] px-1" style={pf}>X</button>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <div>
                        <label className="text-[11px] text-digi-muted" style={pf}>Cant.</label>
                        <input value={item.quantity} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], quantity: e.target.value }; setCompleteItems(n); }}
                          type="number" min="0.01" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      </div>
                      <div>
                        <label className="text-[11px] text-digi-muted" style={pf}>P.Unit.</label>
                        <input value={item.unitPrice} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setCompleteItems(n); }}
                          type="number" min="0" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      </div>
                      <div>
                        <label className="text-[11px] text-digi-muted" style={pf}>IVA</label>
                        <select value={item.ivaRate} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], ivaRate: e.target.value }; setCompleteItems(n); }}
                          className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                          <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-digi-muted" style={pf}>Desc.</label>
                        <input value={item.discount} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], discount: e.target.value }; setCompleteItems(n); }}
                          type="number" min="0" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setCompleteItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
                className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={pf}>+ Item</button>

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
                  <div className="border border-digi-border rounded-lg p-3 text-[12px] space-y-1" style={mf}>
                    {Object.entries(ivaByRate).map(([rate, base]) => (
                      <div key={rate} className="flex justify-between"><span className="text-digi-muted">Subtotal {rate}%:</span><span className="text-digi-text">${fmt2(base)}</span></div>
                    ))}
                    {totalDiscount > 0 && <div className="flex justify-between"><span className="text-digi-muted">Total descuento:</span><span className="text-digi-text">${fmt2(totalDiscount)}</span></div>}
                    {totalIva > 0 && <div className="flex justify-between"><span className="text-digi-muted">IVA:</span><span className="text-digi-text">${fmt2(totalIva)}</span></div>}
                    <div className="flex justify-between border-t border-digi-border pt-1"><span className="text-accent font-semibold">Total:</span><span className="text-accent font-semibold">${fmt2((subtotal + totalIva))}</span></div>
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
              <div className="pt-3 mt-3 border-t border-digi-border space-y-2">
                {consumidorFinalOver50 && (
                  <div className="px-3 py-2 border border-red-300 rounded bg-red-50 text-[12px] text-red-600" style={mf}>
                    El SRI requiere identificar al cliente (RUC o Cedula) en facturas mayores a $50.00. El total actual es ${fmt2(invoiceTotal)}. Cambia el tipo de identificacion.
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={completeSendEmail} onChange={e => setCompleteSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                    <span className="text-[12px] text-digi-muted" style={mf}>Enviar por correo</span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={() => setCompleteModal(false)} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Cancelar</button>
                    <button onClick={() => handleComplete(true)} disabled={completing} className="pixel-btn pixel-btn-secondary text-sm disabled:opacity-50" style={pf}>
                      Completar sin Facturar
                    </button>
                    <button onClick={() => handleComplete(false)} disabled={!isFormValid} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={pf}>
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
            <button onClick={() => setDeleteModal(false)} className="pixel-btn pixel-btn-secondary flex-1 text-sm" style={pf}>Cancelar</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50" style={pf}>
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
