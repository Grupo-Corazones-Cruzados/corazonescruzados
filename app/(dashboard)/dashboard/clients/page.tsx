'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import ModuleToolbar from '@/components/ui/ModuleToolbar';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';

const pf = { fontFamily: 'var(--font-display)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;
const inputCls = 'w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none';
const smallInputCls = 'w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none';

const ID_TYPE_LABEL: Record<string, string> = { '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Cons. Final', '08': 'ID Exterior' };
const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = { pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error', failed: 'error' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada', failed: 'Fallida' };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaEs(ymd: string | null): string {
  if (!ymd) return '-';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MESES[m - 1]} ${y}`;
}

export default function ClientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cIdType, setCIdType] = useState('04');
  const [cRuc, setCRuc] = useState('');
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');

  // Detail / edit
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [e, setE] = useState<any>({ id_type: '04', ruc: '', name: '', email: '', phone: '', address: '', notes: '' });
  const [confirmCfg, setConfirmCfg] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/billing-clients?${params}`);
      const data = await res.json();
      setClients(data.data || []);
    } catch { setClients([]); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetCreate = () => { setCIdType('04'); setCRuc(''); setCName(''); setCEmail(''); setCPhone(''); setCAddress(''); };

  const createClient = async () => {
    if (cIdType !== '07' && !cRuc.trim()) { toast.error('Ingresa la identificación'); return; }
    if (cIdType !== '07' && !cName.trim()) { toast.error('Ingresa el nombre / razón social'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/billing-clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_type: cIdType, ruc: cRuc, name: cName, email: cEmail, phone: cPhone, address: cAddress }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Error'); return; }
      toast.success('Cliente creado');
      setShowCreate(false); resetCreate(); fetchData();
    } catch { toast.error('Error al crear'); }
    finally { setCreating(false); }
  };

  const openDetail = async (c: any) => {
    setSelected(c); setDetail(null); setLoadingDetail(true);
    try {
      const res = await fetch(`/api/billing-clients/${c.id}`);
      const data = await res.json();
      setDetail(data.data || null);
      if (data.data) setE({ id_type: data.data.id_type, ruc: data.data.ruc, name: data.data.name, email: data.data.email || '', phone: data.data.phone || '', address: data.data.address || '', notes: data.data.notes || '' });
    } catch { toast.error('No se pudo cargar el detalle'); }
    finally { setLoadingDetail(false); }
  };

  const saveClient = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing-clients/${detail.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(e),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      setDetail(data.data); toast.success('Cliente actualizado'); fetchData();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const deleteClient = () => {
    if (!detail) return;
    setConfirmCfg({
      message: `¿Eliminar el cliente "${detail.name}"? Solo se borra el registro; las facturas se conservan.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/billing-clients/${detail.id}`, { method: 'DELETE' });
          if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Error'); return; }
          toast.success('Cliente eliminado'); setSelected(null); setDetail(null); fetchData();
        } catch { toast.error('Error al eliminar'); }
      },
    });
  };

  const goOrigin = (inv: any) => {
    if (inv.origin_type === 'ticket') router.push(`/dashboard/tickets/${inv.origin_id}`);
    else if (inv.origin_type === 'project') router.push(`/dashboard/projects/${inv.origin_id}`);
    else if (inv.origin_type === 'subscription') router.push(`/dashboard/subscriptions`);
  };

  return (
    <div>
      <ModuleToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Buscar por nombre, identificación o email..."
        action={
          <button onClick={() => { resetCreate(); setShowCreate(true); }} className="pixel-btn pixel-btn-primary text-[9px]">
            + Nuevo Cliente
          </button>
        }
      />

      <PixelDataTable
        singleLine
        bottomReserve={48}
        columns={[
          { key: 'name', header: 'Cliente', width: '190px', render: (c: any) => (
            <span className="flex items-center gap-2 min-w-0">
              <span className="truncate">{c.name}</span>
              {c.is_consumidor_final && <PixelBadge variant="info" className="shrink-0">CF</PixelBadge>}
            </span>
          )},
          { key: 'id', header: 'Identificación', width: '160px', render: (c: any) => (
            <span className="text-[10px]" style={mf}><span className="text-digi-muted">{ID_TYPE_LABEL[c.id_type] || c.id_type}</span> {c.ruc}</span>
          )},
          { key: 'email', header: 'Email', render: (c: any) => c.email || '-' },
          { key: 'facturas', header: 'Facturas', width: '90px', render: (c: any) => (
            <span className="text-[10px]" style={mf}>{c.facturas}{c.autorizadas ? <span className="text-green-400"> ({c.autorizadas} aut.)</span> : ''}</span>
          )},
          { key: 'total', header: 'Total Facturado', width: '120px', render: (c: any) => `$${Number(c.total).toFixed(2)}` },
          { key: 'ultima', header: 'Última factura', width: '150px', render: (c: any) => fechaEs(c.ultima) },
        ]}
        data={clients}
        onRowClick={(c: any) => openDetail(c)}
        emptyTitle="Sin clientes"
        emptyDesc="No hay clientes de facturación registrados aún."
      />

      {/* Resumen fijo al fondo */}
      <div className="fixed bottom-0 left-0 lg:left-56 right-0 z-20 bg-digi-card border-t-2 border-digi-border px-4 md:px-6 py-2.5 flex items-center justify-between">
        <span className="text-[10px] text-digi-muted" style={mf}>
          {clients.length} cliente{clients.length === 1 ? '' : 's'} · {clients.reduce((s, c) => s + Number(c.facturas || 0), 0)} facturas
        </span>
        <span className="text-xs text-digi-text" style={pf}>
          Total facturado: <span className="text-accent-glow font-semibold">${clients.reduce((s, c) => s + Number(c.total || 0), 0).toFixed(2)}</span>
        </span>
      </div>

      {/* Create Modal */}
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Cliente">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[8px] text-digi-muted" style={pf}>Tipo ID</label>
              <select value={cIdType} onChange={ev => { const t = ev.target.value; setCIdType(t); if (t === '07') { setCRuc('9999999999999'); setCName('CONSUMIDOR FINAL'); } else { if (cRuc === '9999999999999') setCRuc(''); if (cName === 'CONSUMIDOR FINAL') setCName(''); } }} className={smallInputCls} style={mf}>
                <option value="04">RUC</option><option value="05">Cédula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[8px] text-digi-muted" style={pf}>Identificación *</label>
              <input value={cRuc} onChange={ev => setCRuc(ev.target.value)} disabled={cIdType === '07'} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Nombre / Razón Social *</label>
            <input value={cName} onChange={ev => setCName(ev.target.value)} disabled={cIdType === '07'} className={`${inputCls} disabled:opacity-50`} style={mf} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1"><label className="text-[8px] text-digi-muted" style={pf}>Email</label><input value={cEmail} onChange={ev => setCEmail(ev.target.value)} type="email" className={smallInputCls} style={mf} /></div>
            <div className="flex flex-col gap-1"><label className="text-[8px] text-digi-muted" style={pf}>Teléfono</label><input value={cPhone} onChange={ev => setCPhone(ev.target.value)} className={smallInputCls} style={mf} /></div>
          </div>
          <div className="flex flex-col gap-1"><label className="text-[8px] text-digi-muted" style={pf}>Dirección</label><input value={cAddress} onChange={ev => setCAddress(ev.target.value)} className={smallInputCls} style={mf} /></div>
          <button onClick={createClient} disabled={creating} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">{creating ? '...' : 'Crear Cliente'}</button>
        </div>
      </PixelModal>

      {/* Detail panel */}
      <PixelModal open={!!selected} onClose={() => { setSelected(null); setDetail(null); }} title={selected ? selected.name : 'Cliente'} size="lg">
        {loadingDetail || !detail ? (
          <div className="py-10 text-center text-[10px] text-digi-muted" style={pf}>Cargando…</div>
        ) : (
          <div className="space-y-4">
            {/* Datos de facturación (editable) */}
            <div>
              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mb-2" style={pf}>Datos de facturación</h4>
              {detail.is_consumidor_final && <p className="text-[8px] text-digi-muted mb-2" style={pf}>Registro especial: agrupa todas las facturas a consumidor final.</p>}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] text-digi-muted" style={pf}>Tipo ID</label>
                  <select value={e.id_type} onChange={ev => setE({ ...e, id_type: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf}>
                    <option value="04">RUC</option><option value="05">Cédula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] text-digi-muted" style={pf}>Identificación</label>
                  <input value={e.ruc} onChange={ev => setE({ ...e, ruc: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
                </div>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                <label className="text-[8px] text-digi-muted" style={pf}>Nombre / Razón Social</label>
                <input value={e.name} onChange={ev => setE({ ...e, name: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="flex flex-col gap-1"><label className="text-[8px] text-digi-muted" style={pf}>Email</label><input value={e.email} onChange={ev => setE({ ...e, email: ev.target.value })} type="email" className={smallInputCls} style={mf} /></div>
                <div className="flex flex-col gap-1"><label className="text-[8px] text-digi-muted" style={pf}>Teléfono</label><input value={e.phone} onChange={ev => setE({ ...e, phone: ev.target.value })} className={smallInputCls} style={mf} /></div>
              </div>
              <div className="flex flex-col gap-1 mt-2"><label className="text-[8px] text-digi-muted" style={pf}>Dirección</label><input value={e.address} onChange={ev => setE({ ...e, address: ev.target.value })} className={smallInputCls} style={mf} /></div>
              <div className="flex flex-col gap-1 mt-2"><label className="text-[8px] text-digi-muted" style={pf}>Notas</label><textarea value={e.notes} onChange={ev => setE({ ...e, notes: ev.target.value })} rows={2} className={`${smallInputCls} resize-none`} style={mf} /></div>
              <button onClick={saveClient} disabled={saving} className="pixel-btn pixel-btn-primary w-full mt-3 disabled:opacity-50">{saving ? '...' : 'Guardar cambios'}</button>
            </div>

            {/* Totales */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-digi-card border border-digi-border rounded-lg px-3 py-2"><div className="text-[8px] text-digi-muted uppercase" style={pf}>Facturas</div><div className="text-base text-digi-text" style={pf}>{detail.summary.count}</div></div>
              <div className="bg-digi-card border border-digi-border rounded-lg px-3 py-2"><div className="text-[8px] text-digi-muted uppercase" style={pf}>Total facturado</div><div className="text-base text-digi-text" style={pf}>${detail.summary.total_facturado.toFixed(2)}</div></div>
              <div className="bg-digi-card border border-digi-border rounded-lg px-3 py-2"><div className="text-[8px] text-digi-muted uppercase" style={pf}>Autorizado</div><div className="text-base text-green-400" style={pf}>${detail.summary.total_autorizado.toFixed(2)}</div></div>
            </div>

            {/* Facturas del cliente */}
            <div>
              <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mb-2" style={pf}>Facturas ({detail.invoices.length})</h4>
              {detail.invoices.length === 0 ? (
                <p className="text-[9px] text-digi-muted py-3 text-center" style={pf}>Sin facturas registradas para este cliente.</p>
              ) : (
                <div className="space-y-2">
                  {detail.invoices.map((inv: any) => (
                    <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 border border-digi-border bg-digi-darker">
                      <div className="min-w-0">
                        <div className="text-[11px] text-digi-text" style={pf}>{inv.invoice_number || `Factura #${inv.id}`}</div>
                        <div className="text-[8px] text-digi-muted flex items-center gap-2 flex-wrap" style={mf}>
                          <span>{inv.created_at}</span>
                          <span>· ${inv.total.toFixed(2)}</span>
                          <PixelBadge variant={STATUS_V[inv.status] || 'default'}>{STATUS_LABEL[inv.status] || inv.status}</PixelBadge>
                          {inv.origin_label && <span className="text-digi-muted">· {inv.origin_label}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {inv.origin_type && (
                          <button onClick={() => goOrigin(inv)} className="px-2 py-0.5 text-[8px] border border-digi-border text-digi-muted hover:text-digi-text transition-colors" style={pf}>Ver origen</button>
                        )}
                        <button onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="px-2 py-0.5 text-[8px] border border-accent/40 text-accent-glow hover:bg-accent/10 transition-colors" style={pf}>Ver factura</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {user?.role === 'admin' && !detail.is_consumidor_final && (
              <div className="pt-2 border-t border-digi-border">
                <button onClick={deleteClient} className="text-[8px] px-2 py-1 border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors" style={pf}>Eliminar cliente</button>
              </div>
            )}
          </div>
        )}
      </PixelModal>

      <PixelConfirm
        open={!!confirmCfg}
        title="Eliminar cliente"
        message={confirmCfg?.message || ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { const fn = confirmCfg?.onConfirm; setConfirmCfg(null); fn?.(); }}
        onCancel={() => setConfirmCfg(null)}
      />
    </div>
  );
}
