'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import ModuleToolbar from '@/components/ui/ModuleToolbar';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';

const pf = { fontFamily: 'var(--font-display)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

const TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Activas' },
  { value: 'paused', label: 'Pausadas' },
  { value: 'cancelled', label: 'Canceladas' },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  active: 'success', paused: 'warning', cancelled: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  active: 'Activa', paused: 'Pausada', cancelled: 'Cancelada',
};

const PER_PAGE = 15;
const inputCls = 'w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none';

const ID_TYPE_LABEL: Record<string, string> = {
  '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Consumidor Final', '08': 'ID Exterior',
};

type BillingClient = {
  id: number; id_type: string; ruc: string; name: string;
  email: string | null; phone: string | null; address: string | null;
  is_consumidor_final: boolean;
};

function alertBadge(alert: string, label: string) {
  if (alert === 'overdue') return <PixelBadge variant="error">{label}</PixelBadge>;
  if (alert === 'due_soon') return <PixelBadge variant="warning">{label}</PixelBadge>;
  return null;
}

function dueText(daysUntilDue: number) {
  if (daysUntilDue < 0) return `Vencido hace ${Math.abs(daysUntilDue)}d`;
  if (daysUntilDue === 0) return 'Vence hoy';
  return `En ${daysUntilDue}d`;
}

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [subs, setSubs] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Reference data for the create form: registered clients (billing module, incl. Consumidor Final)
  const [billingClients, setBillingClients] = useState<BillingClient[]>([]);

  // Create modal — only client / title / cost / start are user-editable;
  // billing (SRI) data is auto-filled read-only from the selected client.
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

  // App-level confirmation dialog (replaces window.confirm)
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
    } catch { setSubs([]); }
  }, [page, tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [tab, search]);

  useEffect(() => {
    fetch('/api/billing-clients').then(r => r.json()).then(d => setBillingClients(d.data || [])).catch(() => {});
  }, []);

  const selectedClient = useMemo(
    () => billingClients.find(c => String(c.id) === cBillingId) || null,
    [billingClients, cBillingId]
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: null,
          title: cTitle,
          monthly_cost: Number(cCost),
          iva_rate: 0,
          start_date: cStart,
          client_id_type: selectedClient.id_type,
          client_ruc: selectedClient.ruc,
          client_name_sri: selectedClient.name,
          client_email_sri: selectedClient.email || '',
          client_phone_sri: selectedClient.phone || '',
          client_address_sri: selectedClient.address || '',
        }),
      });
      if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Error'); return; }
      toast.success('Suscripción creada');
      setShowCreate(false);
      resetCreate();
      fetchData();
    } catch { toast.error('Error al crear la suscripción'); }
    finally { setCreating(false); }
  };

  const openDetail = async (sub: any) => {
    setSelected(sub);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/subscriptions/${sub.id}`);
      const data = await res.json();
      setDetail(data.data || null);
    } catch { toast.error('No se pudo cargar el detalle'); }
    finally { setLoadingDetail(false); }
  };

  const refreshDetail = async (id: number) => {
    const res = await fetch(`/api/subscriptions/${id}`);
    const data = await res.json();
    setDetail(data.data || null);
  };

  const requestMarkPaid = (period: string, periodLabel: string) => {
    setConfirmCfg({
      title: 'Marcar como pagado',
      message: `¿Marcar "${periodLabel}" como pagado? Se generará la factura electrónica para el cliente, se le enviará por correo y se registrará el ingreso.`,
      confirmLabel: 'Marcar pagado',
      danger: false,
      onConfirm: () => doMarkPaid(period, periodLabel),
    });
  };

  const doMarkPaid = async (period: string, periodLabel: string) => {
    if (!detail) return;
    setBusyPeriod(period);
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pay', period, send_email: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo facturar'); return; }
      toast.success(`Pagado · factura generada${data.emailed ? ' y enviada' : ''}`);
      await refreshDetail(detail.id);
      fetchData();
    } catch { toast.error('Error al procesar el cobro'); }
    finally { setBusyPeriod(null); }
  };

  const requestUnmarkPaid = (period: string, periodLabel: string) => {
    setConfirmCfg({
      title: 'Desmarcar mes',
      message: `¿Desmarcar "${periodLabel}" como pagado?`,
      confirmLabel: 'Desmarcar',
      danger: false,
      onConfirm: () => doUnmarkPaid(period, periodLabel),
    });
  };

  const doUnmarkPaid = async (period: string, periodLabel: string) => {
    if (!detail) return;
    setBusyPeriod(period);
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unpay', period }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'No se pudo desmarcar'); return; }
      toast.success('Mes desmarcado');
      await refreshDetail(detail.id);
      fetchData();
    } catch { toast.error('Error'); }
    finally { setBusyPeriod(null); }
  };

  const changeStatus = async (status: string) => {
    if (!detail) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      setDetail(data.data);
      fetchData();
    } catch { toast.error('Error'); }
    finally { setUpdatingStatus(false); }
  };

  const requestDelete = () => {
    if (!detail) return;
    setConfirmCfg({
      title: 'Eliminar suscripción',
      message: `¿Eliminar la suscripción "${detail.title}"? Esto borra la suscripción y su historial de marcas (las facturas ya emitidas se conservan).`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: () => doDeleteSubscription(),
    });
  };

  const doDeleteSubscription = async () => {
    if (!detail) return;
    try {
      const res = await fetch(`/api/subscriptions/${detail.id}`, { method: 'DELETE' });
      if (!res.ok) { const e = await res.json(); toast.error(e.error || 'Error'); return; }
      toast.success('Suscripción eliminada');
      setSelected(null); setDetail(null);
      fetchData();
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div>
      <ModuleToolbar
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por título o cliente..."
        action={
          <button onClick={() => { resetCreate(); setShowCreate(true); }} className="pixel-btn pixel-btn-primary text-[9px]">
            + Nueva Suscripción
          </button>
        }
      />

      <PixelDataTable
        columns={[
          { key: 'id', header: 'ID', render: (s: any) => `#${s.id}`, width: '56px' },
          { key: 'client', header: 'Cliente', render: (s: any) => s.client_name || '-' },
          { key: 'title', header: 'Razón / Título', render: (s: any) => s.title },
          { key: 'cost', header: 'Costo Mensual', render: (s: any) => `$${Number(s.monthly_cost).toFixed(2)}` },
          { key: 'cut', header: 'Día Corte', width: '80px', render: (s: any) => `Día ${s.cut_day}` },
          { key: 'next', header: 'Próximo Cobro', render: (s: any) => {
            if (s.status === 'cancelled') return <span className="text-digi-muted text-[10px]">-</span>;
            if (!s.next_due) return <span className="text-green-400 text-[10px]" style={pf}>Al día</span>;
            return (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-digi-text" style={mf}>{s.next_due.label}</span>
                <span className="text-[9px] text-digi-muted" style={mf}>· {dueText(s.next_due.daysUntilDue)}</span>
                {alertBadge(s.alert, s.alert === 'overdue' ? 'Vencido' : 'Por vencer')}
              </div>
            );
          }},
          { key: 'paid', header: 'Pagados', width: '90px', render: (s: any) => (
            <span className="text-[10px] text-digi-muted" style={mf}>{s.paid_count}/{s.total_periods}</span>
          )},
          { key: 'status', header: 'Estado', width: '90px', render: (s: any) => (
            <PixelBadge variant={STATUS_V[s.status] || 'default'}>{STATUS_LABEL[s.status] || s.status}</PixelBadge>
          )},
        ]}
        data={subs}
        onRowClick={(s: any) => openDetail(s)}
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        onPageChange={setPage}
        emptyTitle="Sin suscripciones"
        emptyDesc="No hay suscripciones registradas aún."
      />

      {/* Create Modal (panel lateral derecho en .corp) */}
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Suscripción">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Cliente *</label>
            <select value={cBillingId} onChange={e => setCBillingId(e.target.value)} className={inputCls} style={mf}>
              <option value="">— Selecciona un cliente —</option>
              {billingClients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{!c.is_consumidor_final && c.ruc ? ` · ${c.ruc}` : ''}</option>
              ))}
            </select>
            <span className="text-[8px] text-digi-muted" style={pf}>De la lista de clientes registrados (incluye Consumidor Final)</span>
          </div>

          {/* Datos de facturación — autocompletados, solo lectura */}
          {selectedClient && (
            <div className="border border-digi-border bg-digi-darker p-2.5 space-y-1.5">
              <div className="text-[8px] text-accent-glow uppercase tracking-wide" style={pf}>
                Datos de facturación (automáticos)
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]" style={mf}>
                <div><span className="text-digi-muted">Tipo ID:</span> <span className="text-digi-text">{ID_TYPE_LABEL[selectedClient.id_type] || selectedClient.id_type}</span></div>
                <div><span className="text-digi-muted">Identificación:</span> <span className="text-digi-text">{selectedClient.ruc}</span></div>
                <div className="col-span-2"><span className="text-digi-muted">Razón Social:</span> <span className="text-digi-text">{selectedClient.name}</span></div>
                <div><span className="text-digi-muted">Email:</span> <span className="text-digi-text">{selectedClient.email || '—'}</span></div>
                <div><span className="text-digi-muted">Teléfono:</span> <span className="text-digi-text">{selectedClient.phone || '—'}</span></div>
                <div className="col-span-2"><span className="text-digi-muted">Dirección:</span> <span className="text-digi-text">{selectedClient.address || '—'}</span></div>
              </div>
              <p className="text-[8px] text-digi-muted leading-relaxed" style={pf}>
                Estos datos provienen del cliente seleccionado. Para modificarlos, edita el cliente en el módulo Clientes.
              </p>
            </div>
          )}

          <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-2" style={pf}>Suscripción</h4>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Razón / Título del cobro *</label>
            <input value={cTitle} onChange={e => setCTitle(e.target.value)} placeholder="Ej. Mantenimiento mensual del sitio web" className={inputCls} style={mf} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Costo mensual ($) *</label>
              <input value={cCost} onChange={e => setCCost(e.target.value)} type="number" min="0" step="0.01" placeholder="0.00" className={inputCls} style={mf} />
              <span className="text-[8px] text-digi-muted" style={pf}>Valor neto · sin IVA</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Fecha de inicio *</label>
              <input value={cStart} onChange={e => setCStart(e.target.value)} type="date" className={inputCls} style={mf} />
              <span className="text-[8px] text-digi-muted" style={pf}>Fija el día de corte mensual</span>
            </div>
          </div>

          <button onClick={createSubscription} disabled={creating || !cBillingId || !cTitle.trim() || !cCost} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {creating ? '...' : 'Crear Suscripción'}
          </button>
        </div>
      </PixelModal>

      {/* Detail panel: meses de la suscripción */}
      <PixelModal open={!!selected} onClose={() => { setSelected(null); setDetail(null); }} title={selected ? `Meses — ${selected.title}` : 'Meses'} size="lg">
        {loadingDetail || !detail ? (
          <div className="py-10 text-center text-[10px] text-digi-muted" style={pf}>Cargando…</div>
        ) : (
          <div className="space-y-3">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-2 text-[10px]" style={mf}>
              <div><span className="text-digi-muted">Cliente:</span> <span className="text-digi-text">{detail.client_name || '-'}</span></div>
              <div><span className="text-digi-muted">Costo:</span> <span className="text-digi-text">${Number(detail.monthly_cost).toFixed(2)} <span className="text-digi-muted">{Number(detail.iva_rate) > 0 ? '(IVA incl.)' : '(neto, sin IVA)'}</span></span></div>
              <div><span className="text-digi-muted">Día de corte:</span> <span className="text-digi-text">Día {detail.cut_day} de cada mes</span></div>
              <div><span className="text-digi-muted">Inicio:</span> <span className="text-digi-text">{detail.start_date}</span></div>
            </div>

            <div className="flex items-center justify-between border-y border-digi-border py-2">
              <div className="flex items-center gap-2">
                <label className="text-[8px] text-digi-muted" style={pf}>Estado</label>
                <select value={detail.status} onChange={e => changeStatus(e.target.value)} disabled={updatingStatus}
                  className="px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  <option value="active">Activa</option><option value="paused">Pausada</option><option value="cancelled">Cancelada</option>
                </select>
              </div>
              <span className="text-[10px] text-digi-muted" style={mf}>{detail.summary?.paidCount}/{detail.summary?.totalPeriods} pagados</span>
            </div>

            {/* Meses */}
            <div className="space-y-2">
              {detail.periods.slice().reverse().map((p: any) => {
                const busy = busyPeriod === p.period;
                return (
                  <div key={p.period}
                    className={`flex items-center justify-between gap-2 px-3 py-2 border ${p.paid ? 'border-green-700/40 bg-green-900/10' : p.status === 'overdue' ? 'border-red-700/40 bg-red-900/10' : p.status === 'due_soon' ? 'border-yellow-700/40 bg-yellow-900/10' : 'border-digi-border bg-digi-darker'}`}>
                    <div className="min-w-0">
                      <div className="text-[11px] text-digi-text" style={pf}>{p.label}</div>
                      <div className="text-[8px] text-digi-muted" style={mf}>
                        Vence {p.dueDate}
                        {p.paid
                          ? <> · <span className="text-green-400">Pagado{p.paidAt ? ` el ${String(p.paidAt).split('T')[0]}` : ''}</span></>
                          : <> · {p.status === 'overdue' ? <span className="text-red-400">{dueText(p.daysUntilDue)}</span> : p.status === 'due_soon' ? <span className="text-yellow-400">{dueText(p.daysUntilDue)}</span> : <span>{dueText(p.daysUntilDue)}</span>}</>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.paid ? (
                        <>
                          {p.invoiceId && (
                            <button onClick={() => window.open(`/api/invoices/${p.invoiceId}/pdf`, '_blank')}
                              className="px-1.5 py-0.5 text-[8px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>PDF</button>
                          )}
                          <button onClick={() => requestUnmarkPaid(p.period, p.label)} disabled={busy}
                            className="px-2 py-0.5 text-[8px] border border-digi-border text-digi-muted hover:text-digi-text transition-colors disabled:opacity-50" style={pf}>
                            {busy ? '...' : 'Desmarcar'}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => requestMarkPaid(p.period, p.label)} disabled={busy || detail.status === 'cancelled'}
                          className="pixel-btn pixel-btn-primary text-[8px] disabled:opacity-50" style={pf}>
                          {busy ? 'Procesando…' : 'Marcar pagado'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-[8px] text-digi-muted leading-relaxed" style={pf}>
              Al marcar un mes como pagado se genera la factura electrónica (SRI), se envía por correo al
              cliente y se registra el ingreso del mes actual. Un mes con factura emitida no puede desmarcarse
              (requiere nota de crédito).
            </p>

            {user?.role === 'admin' && (
              <div className="pt-2 border-t border-digi-border">
                <button onClick={requestDelete} className="text-[8px] px-2 py-1 border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors" style={pf}>
                  Eliminar suscripción
                </button>
              </div>
            )}
          </div>
        )}
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
