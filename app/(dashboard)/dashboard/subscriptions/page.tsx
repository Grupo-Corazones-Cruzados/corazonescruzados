'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY } from '@/components/ui/Button';
import {
  Layers, CheckCircle2, PauseCircle, XCircle, Search, Plus, X, Trash2, FileText,
  ChevronLeft, ChevronRight, CreditCard,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todas', Icon: Layers },
  { value: 'active', label: 'Activas', Icon: CheckCircle2 },
  { value: 'paused', label: 'Pausadas', Icon: PauseCircle },
  { value: 'cancelled', label: 'Canceladas', Icon: XCircle },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  active: 'success', paused: 'warning', cancelled: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Activa', paused: 'Pausada', cancelled: 'Cancelada',
};

const PER_PAGE = 15;

const ID_TYPE_LABEL: Record<string, string> = {
  '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Consumidor Final', '08': 'ID Exterior',
};

type BillingClient = {
  id: number; id_type: string; ruc: string; name: string;
  email: string | null; phone: string | null; address: string | null;
  is_consumidor_final: boolean;
};

function dueText(daysUntilDue: number) {
  if (daysUntilDue < 0) return `Vencido hace ${Math.abs(daysUntilDue)}d`;
  if (daysUntilDue === 0) return 'Vence hoy';
  return `En ${daysUntilDue}d`;
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [billingClients, setBillingClients] = useState<BillingClient[]>([]);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cBillingId, setCBillingId] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cCost, setCCost] = useState('');
  const [cStart, setCStart] = useState(() => new Date().toISOString().split('T')[0]);

  // Detail panel (months)
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [busyPeriod, setBusyPeriod] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const [confirmCfg, setConfirmCfg] = useState<{ title: string; message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
    if (tab !== 'all') params.set('status', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/subscriptions?${params}`);
      const data = await res.json();
      setSubs(data.data || []);
      setTotal(data.total || 0);
      setCounts(data.counts || {});
    } catch { setSubs([]); }
  }, [page, tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [tab, search]);
  useEffect(() => {
    fetch('/api/billing-clients').then(r => r.json()).then(d => setBillingClients(d.data || [])).catch(() => {});
  }, []);

  const selectedClient = useMemo(
    () => billingClients.find(c => String(c.id) === cBillingId) || null,
    [billingClients, cBillingId],
  );

  const resetCreate = () => {
    setCBillingId(''); setCTitle(''); setCCost(''); setCStart(new Date().toISOString().split('T')[0]);
  };

  const createSubscription = async () => {
    if (!selectedClient) { toast.error('Selecciona un cliente'); return; }
    if (!cTitle.trim()) { toast.error('Ingresa el título de la suscripción'); return; }
    if (!cCost || Number(cCost) <= 0) { toast.error('Ingresa un costo mensual válido'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: null, title: cTitle, monthly_cost: Number(cCost), iva_rate: 0, start_date: cStart,
          client_id_type: selectedClient.id_type, client_ruc: selectedClient.ruc,
          client_name_sri: selectedClient.name, client_email_sri: selectedClient.email || '',
          client_phone_sri: selectedClient.phone || '', client_address_sri: selectedClient.address || '',
        }),
      });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success('Suscripción creada');
      setShowCreate(false); resetCreate(); fetchData();
    } catch { toast.error('Error al crear la suscripción'); }
    finally { setCreating(false); }
  };

  const openDetail = async (sub: any) => {
    setSelected(sub); setDetail(null); setPayError(null); setLoadingDetail(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`);
      const data = await res.json();
      setDetail(data.data || null);
    } catch { toast.error('No se pudo cargar el detalle'); }
    finally { setLoadingDetail(false); }
  };

  const refreshDetail = async (id: number) => {
    const res = await fetch(`/api/subscriptions/${id}`);
    setDetail((await res.json()).data || null);
  };

  const requestMarkPaid = (period: string, periodLabel: string) => setConfirmCfg({
    title: 'Marcar como pagado',
    message: `¿Marcar "${periodLabel}" como pagado? Se generará la factura electrónica para el cliente, se le enviará por correo y se registrará el ingreso.`,
    confirmLabel: 'Marcar pagado', danger: false, onConfirm: () => doMarkPaid(period, periodLabel),
  });

  const doMarkPaid = async (period: string, _periodLabel: string) => {
    if (!detail) return;
    setBusyPeriod(period); setPayError(null);
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', period, send_email: true }),
      });
      const data = await res.json();
      if (!res.ok) { const msg = data.error || 'No se pudo facturar'; setPayError(msg); toast.error(msg); return; }
      toast.success(`Pagado · factura generada${data.emailed ? ' y enviada' : ''}`);
      await refreshDetail(detail.id); fetchData();
    } catch { setPayError('Error al procesar el cobro'); toast.error('Error al procesar el cobro'); }
    finally { setBusyPeriod(null); }
  };

  const requestUnmarkPaid = (period: string, periodLabel: string) => setConfirmCfg({
    title: 'Desmarcar mes', message: `¿Desmarcar "${periodLabel}" como pagado?`,
    confirmLabel: 'Desmarcar', danger: false, onConfirm: () => doUnmarkPaid(period),
  });

  const doUnmarkPaid = async (period: string) => {
    if (!detail) return;
    setBusyPeriod(period);
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}/pay`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpay', period }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo desmarcar'); return; }
      toast.success('Mes desmarcado');
      await refreshDetail(detail.id); fetchData();
    } catch { toast.error('Error'); }
    finally { setBusyPeriod(null); }
  };

  const changeStatus = async (status: string) => {
    if (!detail) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      setDetail(data.data); fetchData();
    } catch { toast.error('Error'); }
    finally { setUpdatingStatus(false); }
  };

  const requestDelete = () => {
    if (!detail) return;
    setConfirmCfg({
      title: 'Eliminar suscripción',
      message: `¿Eliminar la suscripción "${detail.title}"? Esto borra la suscripción y su historial de marcas (las facturas ya emitidas se conservan).`,
      confirmLabel: 'Eliminar', danger: true, onConfirm: () => doDeleteSubscription(),
    });
  };

  const doDeleteSubscription = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}`, { method: 'DELETE' });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success('Suscripción eliminada');
      setSelected(null); setDetail(null); fetchData();
    } catch { toast.error('Error al eliminar'); }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  const RailItem = ({ active, Icon, label, count, onClick }: any) => (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
        active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
      }`}>
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
      <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{label}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count ?? 0}</span>
    </button>
  );

  return (
    <div>
      <PageHeader title="Suscripciones" description="Cobros mensuales recurrentes y su facturación" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: estado ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Estado</p>
          <div className="space-y-0.5">
            {STATUS_TABS.map((s) => (
              <RailItem key={s.value} active={tab === s.value} Icon={s.Icon} label={s.label}
                count={counts[s.value]} onClick={() => setTab(s.value)} />
            ))}
          </div>
        </aside>

        {/* ── Right region: command bar + (list · detail) ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título o cliente..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf} />
            </div>
            <button onClick={() => { resetCreate(); setShowCreate(true); }} className={`${BTN_PRIMARY} shrink-0`}>
              <Plus className="w-4 h-4" /> Nueva suscripción
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                singleLine
                data={subs}
                onRowClick={(s: any) => openDetail(s)}
                rowClassName={(s: any) => s.status === 'paused' ? 'bg-amber-50' : s.status === 'cancelled' ? 'bg-red-50 opacity-60' : ''}
                emptyTitle="Sin suscripciones"
                emptyDesc="No hay suscripciones en este estado."
                columns={[
                  { key: 'id', header: 'ID', width: '56px', render: (s: any) => <span className="tabular-nums text-digi-muted">#{s.id}</span> },
                  { key: 'client', header: 'Cliente', render: (s: any) => {
                    const dot = s.status === 'cancelled' ? 'bg-digi-muted'
                      : s.alert === 'overdue' ? 'bg-red-500'
                      : s.alert === 'due_soon' ? 'bg-amber-500'
                      : 'bg-green-500';
                    const dotTitle = s.status === 'cancelled' ? 'Cancelada'
                      : s.alert === 'overdue' ? `Vencido${s.next_due ? ` · ${dueText(s.next_due.daysUntilDue)}` : ''}`
                      : s.alert === 'due_soon' ? `Por vencer${s.next_due ? ` · ${dueText(s.next_due.daysUntilDue)}` : ''}`
                      : (s.next_due ? 'Al día' : 'Sin cobros pendientes');
                    return (
                      <span className="flex items-center gap-2 min-w-0">
                        <span title={dotTitle} className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                        <span className={`truncate text-[13px] font-medium ${selected?.id === s.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{s.client_name || '—'}</span>
                      </span>
                    );
                  } },
                  { key: 'title', header: 'Razón / Título', render: (s: any) => <span className="text-[12px] text-digi-text" style={mf}>{s.title}</span> },
                  { key: 'cost', header: 'Costo', width: '100px', render: (s: any) => <span className="text-[12px] text-digi-text tabular-nums" style={mf}>${Number(s.monthly_cost).toFixed(2)}</span> },
                  { key: 'next', header: 'Próximo cobro', width: '200px', render: (s: any) => {
                    if (s.status === 'cancelled') return <span className="text-digi-muted/50 text-[12px]">—</span>;
                    if (!s.next_due) return <span className="text-green-600 text-[12px] font-medium" style={mf}>Al día</span>;
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-digi-text" style={mf}>{s.next_due.label}</span>
                        <span className="text-[11px] text-digi-muted" style={mf}>· {dueText(s.next_due.daysUntilDue)}</span>
                      </div>
                    );
                  } },
                  { key: 'paid', header: 'Pagados', width: '90px', render: (s: any) => (
                    <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{s.paid_count}/{s.total_periods}</span>
                  ) },
                ]}
              />

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-3">
                  <span className="text-[12px] text-digi-muted" style={mf}>Página {page} de {totalPages} · {total} suscripciones</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors" style={mf}>
                      <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                    </button>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors" style={mf}>
                      Siguiente <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Detail panel: meses ── */}
            <aside className="w-full xl:w-[360px]">
              {!selected ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <CreditCard className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona una suscripción para ver sus meses y cobrar.</p>
                </div>
              ) : loadingDetail || !detail ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-10 text-center text-[12px] text-digi-muted" style={mf}>Cargando…</div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                      <CreditCard className="w-5 h-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{detail.title}</h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{detail.client_name || '—'}</p>
                    </div>
                    <button onClick={() => { setSelected(null); setDetail(null); }} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-[12px]" style={mf}>
                      <div><span className="text-digi-muted">Costo:</span> <span className="text-digi-text">${Number(detail.monthly_cost).toFixed(2)}</span></div>
                      <div><span className="text-digi-muted">Día corte:</span> <span className="text-digi-text">{detail.cut_day}</span></div>
                      <div className="col-span-2"><span className="text-digi-muted">Inicio:</span> <span className="text-digi-text">{detail.start_date}</span></div>
                    </div>

                    <div className="flex items-center justify-between border-y border-digi-border py-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-digi-muted" style={mf}>Estado</label>
                        <select value={detail.status} onChange={e => changeStatus(e.target.value)} disabled={updatingStatus}
                          className="field-control field-select appearance-none px-2.5 py-1 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                          <option value="active">Activa</option><option value="paused">Pausada</option><option value="cancelled">Cancelada</option>
                        </select>
                      </div>
                      <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{detail.summary?.paidCount}/{detail.summary?.totalPeriods} pagados</span>
                    </div>

                    {payError && (
                      <div className="border border-red-300 rounded bg-red-50 px-3 py-2 flex items-start justify-between gap-2">
                        <div className="text-[12px] text-red-700 leading-relaxed" style={mf}><span className="font-semibold">No se pudo facturar:</span> {payError}</div>
                        <button onClick={() => setPayError(null)} className="text-red-500 hover:text-red-600 shrink-0"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    )}

                    <div className="space-y-2 max-h-[46vh] overflow-y-auto -mx-1 px-1">
                      {detail.periods.slice().reverse().map((p: any) => {
                        const busy = busyPeriod === p.period;
                        return (
                          <div key={p.period}
                            className={`flex items-center justify-between gap-2 px-3 py-2 rounded border ${p.paid ? 'border-green-300 bg-green-50' : p.status === 'overdue' ? 'border-red-300 bg-red-50' : p.status === 'due_soon' ? 'border-amber-300 bg-amber-50' : 'border-digi-border bg-digi-darker'}`}>
                            <div className="min-w-0">
                              <div className="text-[12px] font-medium text-digi-text" style={mf}>{p.label}</div>
                              <div className="text-[11px] text-digi-muted" style={mf}>
                                Vence {p.dueDate}
                                {p.paid
                                  ? <> · <span className="text-green-600">Pagado{p.paidAt ? ` el ${String(p.paidAt).split('T')[0]}` : ''}</span></>
                                  : <> · {p.status === 'overdue' ? <span className="text-red-600">{dueText(p.daysUntilDue)}</span> : p.status === 'due_soon' ? <span className="text-amber-700">{dueText(p.daysUntilDue)}</span> : <span>{dueText(p.daysUntilDue)}</span>}</>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {p.paid ? (
                                <>
                                  {p.invoiceId && (
                                    <button onClick={() => window.open(`/api/invoices/${p.invoiceId}/pdf`, '_blank')}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border border-green-500/40 rounded text-green-700 hover:bg-green-100 transition-colors" style={mf}><FileText className="w-3 h-3" /> PDF</button>
                                  )}
                                  <button onClick={() => requestUnmarkPaid(p.period, p.label)} disabled={busy}
                                    className="px-2 py-0.5 text-[11px] border border-digi-border rounded text-digi-muted hover:text-digi-text transition-colors disabled:opacity-50" style={mf}>
                                    {busy ? '...' : 'Desmarcar'}
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => requestMarkPaid(p.period, p.label)} disabled={busy || detail.status === 'cancelled'}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent text-white text-[11px] font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
                                  {busy ? 'Procesando…' : 'Marcar pagado'}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-digi-muted leading-relaxed" style={mf}>
                      Al marcar un mes como pagado se genera la factura electrónica (SRI), se envía por correo al cliente y se registra el ingreso. Un mes con factura emitida no puede desmarcarse (requiere nota de crédito).
                    </p>

                    {user?.role === 'admin' && (
                      <div className="pt-2 border-t border-digi-border">
                        <button onClick={requestDelete}
                          className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 border border-red-300 rounded text-red-600 hover:bg-red-50 transition-colors" style={mf}>
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar suscripción
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva suscripción">
        <div className="space-y-3">
          <PixelSelect label="Cliente *" value={cBillingId} onChange={e => setCBillingId(e.target.value)}
            placeholder="— Selecciona un cliente —"
            options={billingClients.map(c => ({ value: String(c.id), label: `${c.name}${!c.is_consumidor_final && c.ruc ? ` · ${c.ruc}` : ''}` }))} />
          <span className="text-[11px] text-digi-muted block -mt-1" style={mf}>De la lista de clientes registrados (incluye Consumidor Final)</span>

          {selectedClient && (
            <div className="border border-digi-border rounded-lg bg-digi-darker p-3 space-y-1.5">
              <div className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={mf}>Datos de facturación (automáticos)</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]" style={mf}>
                <div><span className="text-digi-muted">Tipo ID:</span> <span className="text-digi-text">{ID_TYPE_LABEL[selectedClient.id_type] || selectedClient.id_type}</span></div>
                <div><span className="text-digi-muted">Identificación:</span> <span className="text-digi-text">{selectedClient.ruc}</span></div>
                <div className="col-span-2"><span className="text-digi-muted">Razón Social:</span> <span className="text-digi-text">{selectedClient.name}</span></div>
                <div><span className="text-digi-muted">Email:</span> <span className="text-digi-text">{selectedClient.email || '—'}</span></div>
                <div><span className="text-digi-muted">Teléfono:</span> <span className="text-digi-text">{selectedClient.phone || '—'}</span></div>
                <div className="col-span-2"><span className="text-digi-muted">Dirección:</span> <span className="text-digi-text">{selectedClient.address || '—'}</span></div>
              </div>
              <p className="text-[11px] text-digi-muted leading-relaxed" style={mf}>Estos datos provienen del cliente seleccionado. Para modificarlos, edita el cliente en el módulo Clientes.</p>
            </div>
          )}

          <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-2" style={mf}>Suscripción</h4>
          <PixelInput label="Razón / Título del cobro *" value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="Ej. Mantenimiento mensual del sitio web" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <PixelInput label="Costo mensual ($) *" type="number" value={cCost} onChange={e => setCCost(e.target.value)} placeholder="0.00" />
              <span className="text-[11px] text-digi-muted block mt-0.5" style={mf}>Valor neto · sin IVA</span>
            </div>
            <div>
              <PixelInput label="Fecha de inicio *" type="date" value={cStart} onChange={e => setCStart(e.target.value)} />
              <span className="text-[11px] text-digi-muted block mt-0.5" style={mf}>Fija el día de corte mensual</span>
            </div>
          </div>

          <button onClick={createSubscription} disabled={creating || !cBillingId || !cTitle.trim() || !cCost} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {creating ? '...' : 'Crear suscripción'}
          </button>
        </div>
      </PixelModal>

      <PixelConfirm
        open={!!confirmCfg}
        title={confirmCfg?.title}
        message={confirmCfg?.message || ''}
        confirmLabel={confirmCfg?.confirmLabel}
        danger={confirmCfg?.danger}
        onConfirm={() => { const fn = confirmCfg?.onConfirm; setConfirmCfg(null); fn?.(); }}
        onCancel={() => setConfirmCfg(null)}
      />
    </div>
  );
}
