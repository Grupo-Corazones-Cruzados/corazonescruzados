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
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import AdquirenteFactura, { type CuentaFacturable, type ModoAdquirente, TOPE_CONSUMIDOR_FINAL } from '@/components/facturacion/AdquirenteFactura';
import DetalleFactura, { totalFactura } from '@/components/facturacion/DetalleFactura';
import Segmentado from '@/components/ui/Segmentado';
import RegistroTrabajo, { diaDe, segundosDe, fmtTiempo } from '@/components/tickets/RegistroTrabajo';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PanelEnlacePago from '@/components/pagos/PanelEnlacePago';
import BrandLoader from '@/components/ui/BrandLoader';
import { ChevronLeft, ChevronRight, X, LayoutList, ListChecks, Pencil, Check, Receipt, Send, DoorOpen, Sparkles, CalendarDays, Share2, Lock, Plus, AlertTriangle, ChevronDown } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_ICONO_PRIMARIO, BTN_ICONO_SECUNDARIO, BTN_ICONO_ACENTO } from '@/components/ui/Button';
import ClientPicker from '@/components/clients/ClientPicker';
import AssigneePicker from '@/components/tickets/AssigneePicker';
import CobrosEnEspera from '@/components/pagos/CobrosEnEspera';
import { fmt2 } from '@/lib/format';
import BotonQuitar from '@/components/ui/BotonQuitar';
import PanelEtapas from '@/components/facturacion/PanelEtapas';
import PestanasRail from '@/components/ui/PestanasRail';
import ActionsMenu from '@/components/centralized/ActionsMenu';
import IncidentsTab from '@/components/projects/IncidentsTab';

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
  // COBRO DEL TICKET (2026-09-30): lo consumido, lo facturado, lo cobrado y el plan de etapas.
  const [billing, setBilling] = useState<any>(null);
  const [etapasAbierto, setEtapasAbierto] = useState(false);
  const [rightTab, setRightTab] = useState<'propiedades' | 'incidentes'>('propiedades');
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  // Enlace de pago: de una etapa (su id) o de todo lo pendiente (null).
  const [enlaceEtapa, setEnlaceEtapa] = useState<number | null>(null);
  const [linkAbierto, setLinkAbierto] = useState(false);
  // Alto de las tres columnas del detalle: hasta el pie de la pantalla, como en el proyecto.
  const altoColumnas = useAltoHastaElPie({ minimo: 520 });
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

  // ⇒ DÍA DE TRABAJO ELEGIDO (Fernando, 2026-09-30): el registro del centro muestra el de
  // este día. Sin elegir, el último día con registros (o el último día de trabajo, u hoy).
  const [diaSel, setDiaSel] = useState<string | null>(null);

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
  // ⇒ El adquirente se ELIGE (Fernando, 2026-09-29), igual que en el proyecto.
  const [completeAdquirente, setCompleteAdquirente] = useState<ModoAdquirente>('cliente');
  const [completeCuentaId, setCompleteCuentaId] = useState('');
  const [cuentasFacturables, setCuentasFacturables] = useState<CuentaFacturable[]>([]);
  const [cargandoCuentas, setCargandoCuentas] = useState(false);
  const [completeSendEmail, setCompleteSendEmail] = useState(true);
  const [completeCurrency, setCompleteCurrency] = useState('USD');
  const [completeExchangeRate, setCompleteExchangeRate] = useState('1');
  const [currencies, setCurrencies] = useState<{ code: string; symbol: string; name: string; rate: number }[]>([]);

  const cargarPagos = useCallback(() => {
    fetch(`/api/tickets/${id}/payments`).then(r => r.json())
      .then(d => { setPayments(d.data || null); setBilling(d.billing || null); }).catch(() => {});
  }, [id]);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setTicket(data);
      cargarPagos();
    } catch {
      toast.error('Error al cargar ticket');
    } finally {
      setLoading(false);
    }
  }, [id, cargarPagos]);

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
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo cambiar el estado');
      toast.success('Estado actualizado');
      fetchTicket();
    } catch (e: any) { toast.error(e.message || 'Error'); }
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
      // El total es LO CONSUMIDO (2026-09-30); con plan de etapas, lo que falta por cobrar de
      // las etapas abiertas —las ya facturadas o cobradas no se vuelven a facturar—.
      const abiertas = (billing?.etapas || []).filter((e: any) => !e.invoiceId && !e.cobro);
      const importe = billing?.mode === 'etapas'
        ? abiertas.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
        : Number(billing?.total ?? ticket.estimated_cost) || 0;
      return [{
        description: ticket.title || `Ticket #${ticket.id}`,
        quantity: '1',
        unitPrice: String(Math.round(importe * 100) / 100),
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
    // Las cuentas con las que se puede facturar tal cual; se preselecciona la del cliente del
    // ticket si la tiene completa. Ver `cuentaFacturable` en lib/billing-clients.ts.
    setCompleteAdquirente('cliente');
    setCompleteCuentaId('');
    setCargandoCuentas(true);
    fetch('/api/billing-clients?facturables=1')
      .then((r) => r.json())
      .then(({ data }) => {
        const lista: CuentaFacturable[] = Array.isArray(data) ? data : [];
        setCuentasFacturables(lista);
        const propia = lista.find((c) => Number(c.portal_client_id) === Number(ticket.client_id));
        if (propia) { setCompleteCuentaId(String(propia.id)); setCompleteClientEmail(propia.email || ''); }
      })
      .catch(() => setCuentasFacturables([]))
      .finally(() => setCargandoCuentas(false));
    setCompletePaymentCode('20');
    setCompleteCurrency('USD');
    setCompleteExchangeRate('1');
    setCompleteAdditionalFields([]);
    setCompleteSendEmail(true);
    // Con parte del plan ya cobrada, el desglose por registros cobraría otra vez lo cobrado.
    const planEmpezado = billing?.mode === 'etapas' && (billing.etapas || []).some((e: any) => e.invoiceId || e.cobro);
    const defaultMode: 'title' | 'breakdown' = (ticket.actions || []).length > 0 && !planEmpezado ? 'breakdown' : 'title';
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
          // El comprador lo arma el servidor desde la cuenta elegida: aquí solo va QUÉ se eligió.
          adquirente: completeAdquirente,
          billing_client_id: completeAdquirente === 'cliente' ? Number(completeCuentaId) || null : null,
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
        (!skipInvoice && completeSendEmail && completeAdquirente === 'cliente' && sriOk ? ' — Enviada por correo' : '')
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
      const cfg = slotCfg[d] || { is_event: false, start_time: '', end_time: '' };
      const hasStart = !!cfg.start_time, hasEnd = !!cfg.end_time;
      if (cfg.is_event) {
        if (!hasStart || !hasEnd) { toast.error(`El evento del ${d} necesita hora de inicio y fin`); return null; }
        if (cfg.end_time <= cfg.start_time) { toast.error(`El evento del ${d}: la hora de fin debe ser posterior al inicio`); return null; }
        out.push({ date: d, is_event: true, start_time: cfg.start_time, end_time: cfg.end_time });
      } else {
        // Horas opcionales; si pones una, pon ambas (y fin posterior al inicio).
        if (hasStart !== hasEnd) { toast.error(`El día ${d}: indica hora de inicio y fin, o deja ambas vacías`); return null; }
        if (hasStart && hasEnd && cfg.end_time <= cfg.start_time) { toast.error(`El día ${d}: la hora de fin debe ser posterior al inicio`); return null; }
        out.push({ date: d, is_event: false, start_time: hasStart ? cfg.start_time : null, end_time: hasEnd ? cfg.end_time : null });
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
  // El cliente ve «Pagar»; el staff ve «Compartir enlace de pago». Es el mismo cobro por dos
  // puertas, y quién eres decide cuál te toca.
  const esClienteDelTicket = user?.role === 'client';

  // ENLACE DE PAGO del ticket (canal 3). Gemelo del de proyectos y con la misma lógica
  // detrás (`lib/pagos/enlaces.ts`): el de la cabecera cobra TODO lo pendiente; el icono de
  // cada etapa, solo esa etapa.
  const abrirEnlacePagoTicket = (etapa: number | null = null) => { setEnlaceEtapa(etapa); setLinkAbierto(true); };
  const pendienteTicket = Number(billing?.pending || 0);
  const conPlan = billing?.mode === 'etapas';

  const isMember = user?.role === 'member';
  const canEdit = isAdmin || isMember;
  const isClosed = ['completed', 'cancelled'].includes(ticket.status);
  const isPending = ticket.status === 'pending';
  const timeSlots = ticket.time_slots || [];
  const diasDeTrabajo: string[] = [...new Set<string>(timeSlots.map((s: any) => String(s.date).slice(0, 10)))].sort();
  const diasConRegistro: string[] = [...new Set<string>((ticket.actions || []).map((a: any) => diaDe(a)))].sort();
  const diaActivo: string | null = (diaSel && (diasDeTrabajo.includes(diaSel) || diasConRegistro.includes(diaSel)) ? diaSel : null)
    || diasConRegistro[diasConRegistro.length - 1] || diasDeTrabajo[diasDeTrabajo.length - 1] || null;
  // Por día: cuántos registros y cuánto tiempo (para la columna de días).
  const resumenDia = (d: string) => {
    const del = (ticket.actions || []).filter((a: any) => diaDe(a) === d);
    return { n: del.length, seg: del.reduce((s: number, a: any) => s + segundosDe(a), 0), enMarcha: del.some((a: any) => a.timer_started_at) };
  };
  // Is this a request from a client to this member?
  const isRequestForMe = isPending && isMember && user?.member_id && ticket.member_id === user.member_id;
  const showActions = !isPending && ticket.status !== 'withdrawn';
  // Propuestas (tickets abiertos a propuestas).
  const isOpen = !!ticket.open_for_proposals;
  // El selector de estado aparece cuando el ticket ya NO está abierto a propuestas (Fernando,
  // 2026-09-30); nunca al cliente ni en una solicitud que aún hay que aceptar.
  const puedeElegirEstado = canEdit && !isOpen && !isRequestForMe;
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

  // Cuerpo del editor de días de trabajo. Va dentro del PANEL LATERAL DERECHO
  // (`EditPanel`, al final del archivo): nunca sustituyendo la tarjeta que se está viendo.
  const renderSlotEditor = () => {
    const { year, month } = calMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = new Date().toISOString().split('T')[0];
    const deadlineStr = ticket.deadline ? ticket.deadline.split('T')[0] : '';
    const slotRate = Number(ticket.service_base_price) || 0;
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
        <div>
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
          <div className="border-t border-digi-border pt-3 space-y-2">
            {selectedDates.map(d => {
              const cfg = slotCfg[d] || { is_event: false, start_time: '', end_time: '' };
              const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
              const bothTimes = !!cfg.start_time && !!cfg.end_time && cfg.end_time > cfg.start_time;
              const mins = bothTimes ? (toMin(cfg.end_time) - toMin(cfg.start_time)) : 0;
              const sessionCost = Math.round((mins / 60) * slotRate * 100) / 100;
              const durLabel = `${Math.floor(mins / 60)}h ${mins % 60}m`;
              return (
                <div key={d} className="border border-digi-border rounded-md p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-medium text-digi-text truncate min-w-0" style={mf}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })}
                    </span>
                    <BotonQuitar onClick={() => toggleDate(d)} etiqueta="Quitar fecha" tamano="xs" />
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-digi-text cursor-pointer mt-1.5" style={mf}>
                    <input type="checkbox" checked={cfg.is_event} onChange={(e) => setCfg(d, { is_event: e.target.checked })}
                      className="accent-[var(--accent,#7c6cf5)] shrink-0" />
                    Evento (reunión Meet)
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <PixelInput label="Inicio" type="time" value={cfg.start_time} onChange={(e) => setCfg(d, { start_time: e.target.value })} className="min-w-0 !px-2" />
                    <PixelInput label="Fin" type="time" value={cfg.end_time} onChange={(e) => setCfg(d, { end_time: e.target.value })} className="min-w-0 !px-2" />
                  </div>
                  {cfg.is_event ? (
                    <p className="text-[10px] text-digi-muted mt-1.5" style={mf}>
                      Se creará una reunión de Google Meet invitando al cliente{ticket.client_name ? ` (${ticket.client_name})` : ''} y al miembro. Horario de Ecuador (GMT-5).
                      {bothTimes && ` Se registrará un bloque ocupado en «Mi día» y una acción «Sesión»${slotRate > 0 ? ` · ${durLabel} × $${slotRate}/h = $${fmt2(sessionCost)}` : ''}.`}
                    </p>
                  ) : bothTimes ? (
                    <p className="text-[10px] text-digi-muted mt-1.5" style={mf}>
                      Bloque ocupado (Progreso) en tu calendario «Mi día» y una acción «Sesión»{slotRate > 0 ? ` · ${durLabel} × $${slotRate}/h = $${fmt2(sessionCost)}` : ' (sin costo: el servicio no tiene tarifa/hora)'}.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <DetailHeader
        breadcrumb={{ label: 'Tickets', href: '/dashboard/tickets' }}
        title={ticket.title || `Ticket #${ticket.id}`}
        status={puedeElegirEstado ? (
          /* SELECTOR DE ESTADO (Fernando, 2026-09-30): una vez el ticket deja de estar abierto a
             propuestas, la insignia abre el menú Pendiente / Completado / Cancelado. «Completado»
             pasa por «Completar y facturar» para no saltarse el cobro; «Cancelado» pide confirmación. */
          <ActionsMenu label="Cambiar estado" disparador={(
            <span className="inline-flex items-center gap-0.5">
              <PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{STATUS_LABEL[ticket.status] || ticket.status}</PixelBadge>
              <ChevronDown className="w-3.5 h-3.5 text-digi-muted" />
            </span>
          )} items={[
            { label: 'Pendiente', activo: ticket.status === 'pending', disabled: ticket.status === 'pending',
              onClick: () => updateStatus('pending') },
            { label: 'Completado', activo: ticket.status === 'completed', disabled: ticket.status === 'completed' || !isAdmin,
              hint: !isAdmin ? 'Solo un administrador puede completar y facturar' : undefined,
              onClick: openCompleteModal },
            { label: 'Cancelado', activo: ticket.status === 'cancelled', disabled: ticket.status === 'cancelled' || !isAdmin, danger: true,
              hint: !isAdmin ? 'Solo un administrador puede cancelar un ticket' : undefined,
              onClick: () => setConfirmarCancelar(true) },
          ]} />
        ) : <PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{STATUS_LABEL[ticket.status] || ticket.status}</PixelBadge>}
        chips={(
          <>
            {ticket.client_name && <HeaderChip>{ticket.client_name}</HeaderChip>}
            {ticket.estimated_cost != null && ticket.estimated_cost !== '' && <HeaderChip>${fmt2(Number(ticket.estimated_cost))}</HeaderChip>}
            {ticket.deadline && <HeaderChip>Límite {new Date(ticket.deadline).toLocaleDateString()}</HeaderChip>}
          </>
        )}
        actions={(
          <>
            {/* ⇒ SOLO ICONOS, como en el proyecto (Fernando, 2026-09-29). Nombre en title/aria-label. */}
            {(ticket.status === 'pending' || ticket.status === 'withdrawn') && canEdit && !isRequestForMe && (
              <button onClick={() => updateStatus('confirmed')} className={BTN_ICONO_PRIMARIO} title="Confirmar" aria-label="Confirmar"><Check className="w-4 h-4" /></button>
            )}
            {/* El enlace de pago, a la izquierda de «Completar y facturar» —las dos formas de
                cobrar van juntas—. Estaba al pie de la tarjeta de Pagos. */}
            {/* Cobra TODO lo pendiente de lo consumido; se puede en cuanto hay consumo
                (Fernando, 2026-09-30), no solo al completar. */}
            {!esClienteDelTicket && ticket.status !== 'cancelled' && pendienteTicket > 0 && (
              <button onClick={() => abrirEnlacePagoTicket(null)} className={BTN_ICONO_ACENTO} title="Compartir enlace de pago de todo lo pendiente" aria-label="Compartir enlace de pago de todo lo pendiente"><Share2 className="w-4 h-4" /></button>
            )}
            {canCompleteTicket && (
              <button onClick={openCompleteModal} className={BTN_ICONO_PRIMARIO} title="Completar y facturar" aria-label="Completar y facturar"><Receipt className="w-4 h-4" /></button>
            )}
            {canEdit && <button onClick={startEdit} className={BTN_ICONO_SECUNDARIO} title="Editar" aria-label="Editar"><Pencil className="w-4 h-4" /></button>}
          </>
        )}
        overflow={[
          // Con el selector de estado a la vista, cancelar se hace desde él.
          ...(isAdmin && ticket.status !== 'cancelled' && !puedeElegirEstado ? [{ label: 'Cancelar ticket', onClick: () => setConfirmarCancelar(true), danger: true }] : []),
          ...(isAdmin ? [{ label: 'Eliminar ticket', onClick: () => setDeleteModal(true), danger: true }] : []),
        ]}
      />

      {/* ========== PENDING REQUEST BANNER ========== */}
      {isRequestForMe && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 mb-4">
          <p className="text-[13px] font-semibold text-amber-400 mb-1" style={mf}>Solicitud pendiente de un cliente</p>
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
      {/* ⇒ LAS TRES COLUMNAS MIDEN HASTA EL PIE y cada una se desplaza por dentro, igual que en
          el detalle del proyecto (Fernando, 2026-09-29). Solo desde `lg`; en el teléfono se
          apilan y la página se desplaza como siempre. */}
      <div ref={altoColumnas.ref}
        style={altoColumnas.style ? ({ '--alto-columnas': `${altoColumnas.style.height}px` } as React.CSSProperties) : undefined}
        className="flex flex-col lg:flex-row gap-4 items-start lg:items-stretch lg:h-[var(--alto-columnas)]">
          {/* ── IZQUIERDA: Días de trabajo ── */}
          <aside className="w-full lg:w-[300px] shrink-0 order-2 lg:order-1 lg:min-h-0 lg:overflow-y-auto">
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-[13px] font-semibold text-digi-text inline-flex items-center gap-1.5" style={mf}>
                  <CalendarDays className="w-4 h-4 text-accent" /> Días de trabajo
                  {timeSlots.length > 0 && <span className="text-digi-muted font-normal">({timeSlots.length})</span>}
                </h3>
                {canEdit && !isClosed && (
                  <button onClick={startEditSlots} className="shrink-0 h-11 sm:h-auto px-3 sm:px-2 sm:py-1 inline-flex items-center text-[11px] text-accent border border-digi-border rounded hover:bg-accent/5 transition-colors" style={pf}>Editar</button>
                )}
              </div>
              {timeSlots.length > 0 ? (
                <div className="space-y-2">
                  {/* ⇒ LOS DÍAS SE ELIGEN (Fernando, 2026-09-30): al pulsar uno, el registro del
                      centro muestra el de ese día. Cada día dice cuántos registros tiene y cuánto
                      tiempo suman, y un punto rojo si hay un reloj en marcha. */}
                  {timeSlots.map((slot: any, i: number) => {
                    const d = String(slot.date).slice(0, 10);
                    const elegido = d === diaActivo;
                    const r = resumenDia(d);
                    return (
                    <div key={i} role="button" tabIndex={0} aria-pressed={elegido}
                      onClick={() => setDiaSel(d)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDiaSel(d); } }}
                      className={`px-2.5 py-2 border rounded cursor-pointer transition-colors ${elegido ? 'border-accent/50 bg-accent-light/60' : slot.is_event ? 'border-accent/40 bg-accent-light hover:border-accent/60' : 'border-digi-border bg-[#faf9f8] hover:border-accent/30'}`}>
                      {slot.is_event && (
                        <span className="inline-block mb-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent" style={mf}>Evento</span>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-digi-text" style={mf}>{new Date(d + 'T12:00:00').toLocaleDateString()}</p>
                        {r.n > 0 && (
                          <span className="flex items-center gap-1.5 text-[11px] text-digi-muted tabular-nums" style={mf}>
                            {r.enMarcha && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                            {fmtTiempo(r.seg)}
                          </span>
                        )}
                      </div>
                      {slot.start_time && <p className="text-[11px] text-digi-muted" style={mf}>{slot.start_time} - {slot.end_time}</p>}
                      {slot.is_event && slot.meeting_url && (
                        <a href={slot.meeting_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                          className="inline-block mt-1 text-[10.5px] font-medium text-accent hover:underline" style={mf}>Unirse (Meet)</a>
                      )}
                    </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-digi-muted" style={mf}>Sin días asignados</p>
              )}
            </div>
          </aside>

          {/* Columna principal: TODO en un solo espacio (resumen + acciones combinados) */}
          {/* Columna en FLEX (no space-y): la tarjeta de trabajo se estira hasta el pie y lo que
              se desplaza es su interior, no la columna (Fernando, 2026-09-30). */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-4 order-1 lg:order-2 lg:min-h-0 lg:overflow-y-auto">
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
              const actions = ticket.actions || [];
              // Quien puede gestionar el registro: admin o el miembro asignado. Con el ticket
              // cerrado lo sigue VIENDO todo, pero bloqueado (`bloqueo` en el componente).
              const puedeRegistrar = isAdmin || (isMember && user?.member_id && ticket.member_id === user.member_id);
              const serviceRate = Number(ticket.service_base_price) || 0;
              // Días de trabajo se movió al panel izquierdo; esta tarjeta solo agrupa
              // Descripción + Registro. Si no hay ninguno, no se renderiza (evita caja vacía).
              if (!ticket.description && !showActions) return null;
              return (
                // ⇒ ALTO FIJO AL DE LA PANTALLA (Fernando, 2026-09-30): ocupa lo que queda de la
                // columna —que ya mide hasta el pie— y dentro se desplazan la lista y el registro.
                // `min-h` para que con otras tarjetas encima no quede reducida a una franja.
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden flex flex-col lg:flex-1 lg:min-h-[420px]">
                  {/* Descripción */}
                  {ticket.description && (
                    <div className="p-4 border-b border-digi-border shrink-0 max-h-40 overflow-y-auto">
                      <SectionHead Icon={LayoutList} title="Descripción" />
                      <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{ticket.description}</p>
                    </div>
                  )}

                  {/* ⇒ REGISTRO DE TRABAJO DEL DÍA ELEGIDO (Fernando, 2026-09-30): depende del día
                      marcado en «Días de trabajo», en dos partes —lista y registro elegido con
                      su reloj—. Sin tope por presupuesto: lo consumido se avisa en Propiedades. */}
                  {showActions && (
                    <div className="p-4 flex flex-col lg:flex-1 lg:min-h-0">
                      <SectionHead Icon={ListChecks} title="Registro de trabajo" count={actions.length || undefined} />
                      {diaActivo ? (
                        <RegistroTrabajo
                          ticketId={String(id)}
                          registros={actions}
                          dia={diaActivo}
                          tarifa={serviceRate}
                          puede={!!puedeRegistrar}
                          bloqueo={isClosed ? 'El ticket está cerrado: lo consumido ya está facturado' : undefined}
                          onCambio={fetchTicket}
                          onSesionMeet={async () => { await handleStartSession(); setDiaSel(hoyEcuadorCliente()); }}
                          sesionOcupada={sessionBusy}
                        />
                      ) : (
                        <p className="text-[12px] text-digi-muted py-4 text-center" style={mf}>Sin días de trabajo.</p>
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

          {/* ====== DERECHA: pestañas Propiedades / Incidentes, como en el proyecto ====== */}
          <div className="w-full lg:w-[300px] shrink-0 order-3 lg:min-h-0 lg:overflow-y-auto space-y-3">
          <PestanasRail valor={rightTab} onChange={setRightTab}
            opciones={[{ valor: 'propiedades', texto: 'Propiedades' }, { valor: 'incidentes', texto: 'Incidentes' }]} />
          {rightTab === 'incidentes' && (
            <IncidentsTab api={`/api/tickets/${id}`}
              canManage={isAdmin || (!!user?.member_id && Number(ticket.member_id) === Number(user.member_id))} />
          )}
          {rightTab === 'propiedades' && (
          <PropertyRail
            items={[
              { label: 'Cliente', value: ticket.client_name || '-' },
              { label: 'Miembro', value: ticket.member_name || '-' },
              { label: 'Servicio', value: ticket.service_name || '-' },
              { label: 'Límite', value: ticket.deadline ? new Date(ticket.deadline).toLocaleDateString() : '-' },
              { label: 'Horas est.', value: ticket.estimated_hours ? `${ticket.estimated_hours}h` : '-' },
              { label: 'Costo est.', value: ticket.estimated_cost ? `$${fmt2(Number(ticket.estimated_cost))}` : '-' },
              // ⇒ CONSUMIDO, con ⚠ amarillo si pasa del costo estimado (Fernando, 2026-09-30). El
              // estimado ya no pone tope al registro: solo se avisa aquí.
              { label: 'Consumido', value: (() => {
                const consumido = Number(ticket.actions_total) || 0;
                const estimado = Number(ticket.estimated_cost) || 0;
                const excede = estimado > 0 && consumido > estimado + 0.009;
                return (
                  <span className="inline-flex items-center gap-1.5 justify-end">
                    <span className="tabular-nums">${fmt2(consumido)} · {fmtTiempo(Number(ticket.actions_seconds) || 0)}</span>
                    {excede && (
                      <span title={`Supera el costo estimado en $${fmt2(consumido - estimado)}`} aria-label="Supera el costo estimado" className="inline-flex">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </span>
                    )}
                  </span>
                );
              })() },
              { label: 'Creado', value: new Date(ticket.created_at).toLocaleDateString() },
            ]}
          >
            <CobrosEnEspera tipo="ticket" id={String(id)} alConfirmar={() => {
              cargarPagos();
            }} />

            {billing && payments && (Number(billing.total) > 0 || (payments.invoices || []).length > 0) && (() => {
              const etapas: any[] = billing.etapas || [];
              return (
                <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
                  {/* «Editar» a la altura del título, como en el proyecto: la puerta al plan de etapas. */}
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Pagos</h3>
                    {/* Solo si lo consumido supera lo facturado y cobrado (Fernando, 2026-09-30):
                        un ticket pagado entero no tiene nada que repartir en etapas. */}
                    {isAdmin && ticket.status !== 'cancelled' && pendienteTicket > 0.009 && (
                      <button onClick={() => setEtapasAbierto(true)} title="Etapas de facturación"
                        className="destino-tactil text-[11px] text-accent border border-accent/30 px-1.5 py-0.5 rounded hover:bg-accent/10 transition-colors" style={pf}>Editar</button>
                    )}
                  </div>
                  <div className="space-y-1 text-[12px]" style={mf}>
                    <div className="flex justify-between"><span className="text-digi-muted">Consumido</span><span className="text-digi-text tabular-nums">${fmt2(billing.total)}</span></div>
                    <div className="flex justify-between"><span className="text-digi-muted">Facturado</span><span className="text-green-600 tabular-nums">${fmt2(billing.invoiced)}</span></div>
                    {Number(billing.cobradoSinFactura) > 0 && (
                      <div className="flex justify-between"><span className="text-digi-muted">Cobrado sin factura</span><span className="text-digi-text tabular-nums">${fmt2(billing.cobradoSinFactura)}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-digi-muted">Pendiente</span><span className={`tabular-nums ${pendienteTicket > 0 ? 'text-amber-600' : 'text-digi-text'}`}>${fmt2(pendienteTicket)}</span></div>
                  </div>
                  {/* Sin barra de «% facturado» (Fernando, 2026-09-29), como en el proyecto. */}
                  {(payments.invoices || []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-digi-border space-y-0.5">
                      {payments.invoices.map((inv: any) => (
                        <button key={inv.id} onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="w-full flex items-center justify-between gap-2 min-h-11 sm:min-h-0 text-[11.5px] hover:bg-black/[0.03] rounded px-1.5 py-1 transition-colors" style={mf}>
                          <span className="min-w-0 truncate text-digi-text">{inv.invoice_number || `#${inv.id}`}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className={`tabular-nums ${inv.status === 'cancelled' ? 'line-through text-digi-muted' : 'text-digi-text'}`}>${fmt2(inv.total)}</span>
                            {inv.status === 'cancelled' ? <span className="text-[9px] text-red-500">anulada</span> : inv.sri_status === 'authorized' ? <span className="text-[9px] text-green-600">SRI</span> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ETAPAS: reparten lo consumido; la última recoge el resto. Sin plan, la
                      sección no se pinta (se crea desde «Editar»). */}
                  {etapas.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-digi-border">
                      <span className="block text-[11px] text-digi-muted mb-1" style={pf}>Etapas de facturación</span>
                      {etapas.map((e: any) => {
                        const cerrada = !!e.invoiceId || !!e.cobro;
                        const cobrable = !cerrada && Number(e.amount) > 0 && ticket.status !== 'cancelled';
                        return (
                          <div key={e.id} className="flex items-center justify-between gap-2 text-[11.5px] px-1.5 py-1" style={mf}>
                            <span className="min-w-0 truncate text-digi-text">{e.name}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              <span className="tabular-nums text-digi-text">${fmt2(Number(e.amount))}</span>
                              {e.invoiceId
                                ? <span className="text-[9px] text-green-600" title={`Facturada en ${e.invoiceNumber}`}>{esClienteDelTicket ? 'pagada' : 'facturada'}</span>
                                : e.cobro === 'awaiting'
                                  ? <span className="text-[9px] text-digi-muted">en revisión</span>
                                  : e.cobro === 'paid'
                                    ? <span className="text-[9px] text-green-600">pagada</span>
                                    : <span className="text-[9px] text-amber-600">pendiente</span>}
                              {!esClienteDelTicket && !cerrada && (
                                <button onClick={() => abrirEnlacePagoTicket(Number(e.id))} disabled={!cobrable}
                                  title={cobrable ? 'Compartir enlace de pago de esta etapa' : 'La etapa aún no tiene importe'}
                                  className="destino-tactil text-accent hover:opacity-70 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">
                                  <Share2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {esClienteDelTicket && cobrable && (
                                <button onClick={() => router.push(`/pagar/cobro?tipo=ticket&id=${id}&etapa=${e.id}`)}
                                  className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-[10.5px] font-semibold text-white hover:opacity-90 transition-opacity">
                                  Pagar
                                </button>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* El cliente paga TODO lo pendiente desde aquí; el enlace del equipo está en la cabecera. */}
                  {pendienteTicket > 0 && ticket.status !== 'cancelled' && esClienteDelTicket && (
                    <div className="mt-2 pt-2 border-t border-digi-border">
                      <button
                        onClick={() => router.push(`/pagar/cobro?tipo=ticket&id=${id}`)}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[12px] font-semibold text-white hover:opacity-90 transition-opacity"
                        style={pf}>
                        <Lock className="w-3.5 h-3.5" /> Pagar pendiente ${fmt2(pendienteTicket)}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </PropertyRail>
          )}
          </div>
        </div>

      {/* ENLACE DE PAGO del ticket: el mismo formulario que el de la cotización y el del
          proyecto (`PanelEnlacePago` → `PanelCompartirEnlace`). */}
      <PanelEnlacePago
        open={linkAbierto} onClose={() => setLinkAbierto(false)}
        titulo="Compartir enlace de pago" que="este ticket"
        endpoint={`/api/tickets/${id}/payment-link`}
        cuerpo={enlaceEtapa ? { stage_id: enlaceEtapa } : undefined}
        correoInicial={ticket?.client_email || ''}
        importe={enlaceEtapa ? Number((billing?.etapas || []).find((e: any) => Number(e.id) === enlaceEtapa)?.amount || 0) : pendienteTicket}
        etiquetaImporte={enlaceEtapa ? `Etapa «${(billing?.etapas || []).find((e: any) => Number(e.id) === enlaceEtapa)?.name || ''}»` : 'Todo lo pendiente'}
      />

      {/* ETAPAS DE FACTURACIÓN del ticket: el mismo panel que el del proyecto. Reparte lo consumido. */}
      <PanelEtapas
        open={etapasAbierto}
        onClose={() => setEtapasAbierto(false)}
        endpoint={`/api/tickets/${id}/stages`}
        base={Number(billing?.base || 0)}
        etiquetaBase="Por cobrar de lo consumido"
        etapas={(billing?.etapas || []).map((e: any) => ({ id: e.id, name: e.name, amount: e.amount, invoiceNumber: e.invoiceNumber, cerrada: !!e.invoiceId || !!e.cobro }))}
        onGuardado={() => cargarPagos()}
        avisoQuitar="Plan de etapas eliminado — el ticket vuelve a cobrarse por su total"
      />

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
            <AssigneePicker label="Miembro" sinAsignar value={String(form.member_id || '')} onChange={(id) => setForm({ ...form, member_id: id })} />
            <ClientPicker clientId={form.client_id} clientEmail={form.client_email || ''}
              onChange={(v) => setForm({ ...form, client_id: v.clientId, client_email: v.clientEmail })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PixelInput label="Fecha limite" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <PixelInput label="Horas estimadas" type="number" value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} />
            <PixelInput label="Costo estimado (USD)" type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-digi-border">
            <button onClick={() => setEditing(false)} className={BTN_SECONDARY}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.title?.trim()} className={BTN_PRIMARY}>
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
          {/* ⇒ MISMA ESTRUCTURA QUE EL FORMULARIO DEL PROYECTO (Fernando, 2026-09-29): arriba lo
              que se elige, a todo el ancho; debajo el detalle en tabla. Lo propio del ticket
              —tipo de cobro y origen de los ítems— va con el mismo `Segmentado`. Sin notas de
              ayuda permanentes. */}
          {payments && (() => {
            const hasInvoiced = (payments.invoices || []).some((i: any) => i.status !== 'cancelled');
            return (
              <section className="space-y-2 mb-4">
                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5" style={pf}>Tipo de cobro</h4>
                <div className="flex flex-wrap items-end gap-3">
                  <Segmentado<'total' | 'abono'>
                    etiqueta="Tipo de cobro"
                    valor={abonoMode ? 'abono' : 'total'}
                    onChange={(v) => { if (v === 'abono') { setAbonoMode(true); if (!abonoAmount) setAbonoAmount(String(payments.pending)); } else setAbonoMode(false); }}
                    opciones={[
                      // Con plan, «Factura total» factura las etapas que quedan abiertas; el abono se
                      // cruzaría con ellas y cobraría dos veces lo mismo.
                      { valor: 'total', texto: 'Factura total', detalle: `$${fmt2(conPlan ? pendienteTicket : payments.total)}`, deshabilitada: hasInvoiced && !conPlan,
                        porque: 'Ya hay una factura: lo que queda se cobra como abono' },
                      { valor: 'abono', texto: 'Abono parcial', detalle: `pendiente $${fmt2(payments.pending)}`, deshabilitada: conPlan,
                        porque: 'El ticket se cobra por etapas' },
                    ]}
                  />
                  {abonoMode && (
                    <div className="w-40">
                      <EditField label="Monto del abono ($)">
                        <input value={abonoAmount} onChange={e => setAbonoAmount(e.target.value)} type="number" placeholder="0.00"
                          className={`${EDIT_INPUT} tabular-nums`} style={mf} />
                      </EditField>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5" style={pf}>Adquirente</h4>
            <AdquirenteFactura
              modo={completeAdquirente}
              onModo={setCompleteAdquirente}
              cuentaId={completeCuentaId}
              onCuenta={(v) => { setCompleteCuentaId(v); setCompleteClientEmail(cuentasFacturables.find((c) => String(c.id) === v)?.email || ''); }}
              cuentas={cuentasFacturables}
              total={abonoMode ? Number(abonoAmount) || 0 : totalFactura(completeItems)}
              cargando={cargandoCuentas}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <EditField label="Forma de pago">
                <select value={completePaymentCode} onChange={e => setCompletePaymentCode(e.target.value)} className={EDIT_INPUT} style={mf}>
                  <option value="01">Sin utilización del sistema financiero</option>
                  <option value="15">Compensación de deudas</option>
                  <option value="16">Tarjeta de débito</option>
                  <option value="17">Dinero electrónico</option>
                  <option value="18">Tarjeta prepago</option>
                  <option value="19">Tarjeta de crédito</option>
                  <option value="20">Otros con utilización del sistema financiero</option>
                  <option value="21">Endoso de títulos</option>
                </select>
              </EditField>
              <EditField label="Moneda">
                <select value={completeCurrency} onChange={e => {
                  const code = e.target.value;
                  setCompleteCurrency(code);
                  const c = currencies.find(c => c.code === code);
                  setCompleteExchangeRate(c ? String(c.rate) : '1');
                }} className={EDIT_INPUT} style={mf}>
                  {currencies.length === 0 && <option value="USD">USD — Dólar estadounidense</option>}
                  {currencies.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
                </select>
              </EditField>
              <EditField label="Tasa (1 USD = ?)">
                <input value={completeExchangeRate} onChange={e => setCompleteExchangeRate(e.target.value)}
                  type="number" min="0.0001" step="0.0001" disabled={completeCurrency === 'USD'}
                  className={`${EDIT_INPUT} tabular-nums disabled:opacity-50`} style={mf} />
              </EditField>
            </div>
            {completeCurrency !== 'USD' && (
              <p className="px-3 py-1.5 border border-accent/30 rounded bg-accent-light text-[12px] text-accent" style={mf}>
                Equivalente para el cliente: {currencies.find(c => c.code === completeCurrency)?.symbol || completeCurrency} {fmt2((abonoMode ? Number(abonoAmount) || 0 : totalFactura(completeItems)) * (Number(completeExchangeRate) || 1))} {completeCurrency}
                <span className="text-digi-muted"> (referencia, la factura va en USD)</span>
              </p>
            )}

            <div className="space-y-1.5">
              <span className="block text-[12px] font-semibold text-digi-text" style={pf}>Campos adicionales</span>
              {completeAdditionalFields.map((f, i) => (
                // Rejilla: `EDIT_INPUT` lleva `w-full`. Nombre 1/3, valor 2/3, papelera.
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-center">
                  <input value={f.name} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setCompleteAdditionalFields(n); }}
                    placeholder="Nombre" className={EDIT_INPUT} style={mf} />
                  <input value={f.value} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setCompleteAdditionalFields(n); }}
                    placeholder="Valor" className={EDIT_INPUT} style={mf} />
                  <BotonQuitar onClick={() => setCompleteAdditionalFields(prev => prev.filter((_, idx) => idx !== i))} etiqueta="Quitar campo adicional" />
                </div>
              ))}
              <button type="button" onClick={() => setCompleteAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                className="inline-flex items-center gap-1 text-[12px] text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={pf}>
                <Plus className="w-3.5 h-3.5" /> Campo adicional
              </button>
            </div>
          </section>

          {/* Detalle: con abono es una sola línea «Abono a cuenta», que se arma al enviar. */}
          {!abonoMode && (
            <section className="space-y-2 mt-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-digi-border pb-1.5">
                <h4 className="text-[12px] font-semibold text-digi-text" style={pf}>Detalle</h4>
                <Segmentado<'title' | 'breakdown'>
                  etiqueta="Origen de los ítems"
                  className=""
                  valor={itemsMode}
                  onChange={applyItemsMode}
                  opciones={[
                    { valor: 'title', texto: 'Título del ticket', detalle: `$${fmt2(Number(ticket.estimated_cost || 0))}` },
                    { valor: 'breakdown', texto: 'Desglose de acciones', detalle: `${(ticket.actions || []).length} · $${fmt2(Number(ticket.actions_total || 0))}`,
                      deshabilitada: (ticket.actions || []).length === 0, porque: 'El ticket no tiene acciones registradas' },
                  ]}
                />
              </div>
              <DetalleFactura items={completeItems} onChange={setCompleteItems} />
            </section>
          )}

          {/* ─── Pie ─── */}
          {(() => {
            const invoiceTotal = abonoMode ? Number(abonoAmount) || 0 : totalFactura(completeItems);
            const cfExcede = completeAdquirente === 'consumidor_final' && invoiceTotal > TOPE_CONSUMIDOR_FINAL;
            const faltaCuenta = completeAdquirente === 'cliente' && !completeCuentaId;
            const isFormValid = !completing && (abonoMode ? invoiceTotal > 0 : completeItems.length > 0) && !cfExcede && !faltaCuenta;
            return (
              <div className="pt-3 mt-4 border-t border-digi-border space-y-2">
                {cfExcede && (
                  <div className="px-3 py-2 border border-red-300 rounded bg-red-50 text-[12px] text-red-600" style={mf}>
                    El SRI no admite facturar a consumidor final por más de ${TOPE_CONSUMIDOR_FINAL}.00. El total es ${fmt2(invoiceTotal)}: elige un cliente.
                  </div>
                )}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={completeSendEmail} onChange={e => setCompleteSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                    <span className="text-[12px] text-digi-muted" style={mf}>Enviar por correo</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setCompleteModal(false)} className={BTN_SECONDARY}>Cancelar</button>
                    <button onClick={() => handleComplete(true)} disabled={completing} className={BTN_SECONDARY}>
                      Completar sin facturar
                    </button>
                    <span title={faltaCuenta ? 'Elige el cliente al que se factura' : undefined} className="inline-flex">
                      <button onClick={() => handleComplete(false)} disabled={!isFormValid} className={BTN_PRIMARY}>
                        <Receipt className="w-4 h-4" /> {abonoMode ? 'Facturar abono' : 'Completar y facturar'}
                      </button>
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
        )}
      </PixelModal>

      {/* Eliminar: la confirmación estándar, la misma del proyecto. */}
      <PixelConfirm
        open={confirmarCancelar}
        title="Cancelar ticket"
        message="El ticket pasará a Cancelado y dejará de poder cobrarse. Las facturas ya emitidas siguen siendo válidas."
        confirmLabel="Sí, cancelar"
        danger
        onConfirm={() => { setConfirmarCancelar(false); updateStatus('cancelled'); }}
        onCancel={() => setConfirmarCancelar(false)}
      />

      <PixelConfirm
        open={deleteModal}
        title="Eliminar ticket"
        message="¿Eliminar este ticket? Esta acción no se puede deshacer."
        confirmLabel={deleting ? 'Eliminando…' : 'Sí, eliminar'}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteModal(false)}
      />

      {/* Días de trabajo — panel lateral derecho (la edición nunca sustituye la tarjeta). */}
      <EditPanel
        open={editingSlots}
        title={isRequestForMe ? 'Aceptar e indicar días de trabajo' : 'Días de trabajo'}
        onClose={() => setEditingSlots(false)}
        onSave={isRequestForMe ? handleAcceptWithSlots : handleSaveSlots}
        saving={savingSlots}
        canSave={selectedDates.length > 0}
        saveLabel={isRequestForMe ? `Aceptar (${selectedDates.length} días)` : `Guardar (${selectedDates.length} días)`}
      >
        {renderSlotEditor()}
      </EditPanel>
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

/** Hoy en Ecuador como `AAAA-MM-DD`, en el navegador (el día que la API pone a una sesión). */
function hoyEcuadorCliente(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
