'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { PAISES } from '@/lib/countries';
import {
  Users, Building2, Contact, BookUser, UserRound, Globe, Search, Plus, X,
  Trash2, CheckCircle2, ChevronDown, ExternalLink, FileText,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const inputCls = 'field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none';
const smallInputCls = 'field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none';
const labelCls = 'field-label text-[11px] text-digi-muted mb-0.5 block';

const ID_TYPE_LABEL: Record<string, string> = { '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Cons. Final', '08': 'ID Exterior' };
const ID_TYPE_TABS = [
  { value: 'all', label: 'Todos', Icon: Users },
  { value: '04', label: 'RUC', Icon: Building2 },
  { value: '05', label: 'Cédula', Icon: Contact },
  { value: '06', label: 'Pasaporte', Icon: BookUser },
  { value: '07', label: 'Consumidor Final', Icon: UserRound },
  { value: '08', label: 'ID Exterior', Icon: Globe },
];
const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = { pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error', failed: 'error' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada', failed: 'Fallida' };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaEs(ymd: string | null): string {
  if (!ymd) return '-';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** Selector de país con buscador (lista desplegable en línea). */
function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = q ? PAISES.filter(p => p.toLowerCase().includes(q.toLowerCase())) : PAISES;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className={`${smallInputCls} text-left flex items-center justify-between`} style={mf}>
        <span className={value ? 'text-digi-text' : 'text-digi-muted'}>{value || 'Seleccionar país…'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-digi-muted" />
      </button>
      {open && (
        <div className="mt-1 border border-digi-border rounded-lg bg-digi-darker overflow-hidden">
          <input autoFocus value={q} onChange={ev => setQ(ev.target.value)} placeholder="Buscar país…"
            className="w-full px-2.5 py-1.5 bg-digi-card border-b border-digi-border text-[12px] text-digi-text focus:outline-none" style={mf} />
          <div className="max-h-48 overflow-y-auto">
            {value && <button type="button" onClick={() => { onChange(''); setOpen(false); setQ(''); }} className="w-full text-left px-2.5 py-1.5 text-[12px] text-digi-muted hover:bg-accent-light transition-colors" style={mf}>— Sin país —</button>}
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-[12px] text-digi-muted" style={mf}>Sin resultados</div>
            ) : filtered.map(p => (
              <button key={p} type="button" onClick={() => { onChange(p); setOpen(false); setQ(''); }}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-accent-light transition-colors ${p === value ? 'text-accent font-medium' : 'text-digi-text'}`} style={mf}>{p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [scopeType, setScopeType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const onSort = (key: string) => {
    if (key === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cIdType, setCIdType] = useState('04');
  const [cRuc, setCRuc] = useState('');
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cCountry, setCCountry] = useState('');

  // Detail / edit
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [e, setE] = useState<any>({ id_type: '04', ruc: '', name: '', email: '', phone: '', address: '', notes: '' });
  const [confirmCfg, setConfirmCfg] = useState<{ title: string; message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null>(null);
  const [detailTab, setDetailTab] = useState<'datos' | 'consumos'>('datos');

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

  const countByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of clients) m[c.id_type] = (m[c.id_type] || 0) + 1;
    m.all = clients.length;
    return m;
  }, [clients]);

  const sortedClients = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = clients.filter(c => scopeType === 'all' || c.id_type === scopeType);
    arr.sort((a, b) => {
      if (sortBy === 'name' || sortBy === 'country') {
        const av = (a[sortBy] || '').toString().trim().toLowerCase();
        const bv = (b[sortBy] || '').toString().trim().toLowerCase();
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === 'facturas' || sortBy === 'total') return (Number(a[sortBy] || 0) - Number(b[sortBy] || 0)) * dir;
      if (sortBy === 'ultima') {
        const av = a.ultima || ''; const bv = b.ultima || '';
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      }
      return 0;
    });
    return arr;
  }, [clients, scopeType, sortBy, sortDir]);

  const resetCreate = () => { setCIdType('04'); setCRuc(''); setCName(''); setCEmail(''); setCPhone(''); setCAddress(''); setCCountry(''); };

  const createClient = async () => {
    if (cIdType !== '07' && !cRuc.trim()) { toast.error('Ingresa la identificación'); return; }
    if (cIdType !== '07' && !cName.trim()) { toast.error('Ingresa el nombre / razón social'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/billing-clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_type: cIdType, ruc: cRuc, name: cName, email: cEmail, phone: cPhone, address: cAddress, country: cCountry }),
      });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success('Cliente creado');
      setShowCreate(false); resetCreate(); fetchData();
    } catch { toast.error('Error al crear'); }
    finally { setCreating(false); }
  };

  const openDetail = async (c: any) => {
    setSelected(c); setDetail(null); setDetailTab('datos'); setSavedOk(false); setLoadingDetail(true);
    try {
      const res = await fetch(`/api/billing-clients/${c.id}`);
      const data = await res.json();
      setDetail(data.data || null);
      if (data.data) setE({ id_type: data.data.id_type, ruc: data.data.ruc, name: data.data.name, email: data.data.email || '', phone: data.data.phone || '', address: data.data.address || '', notes: data.data.notes || '', country: data.data.country || '' });
    } catch { toast.error('No se pudo cargar el detalle'); }
    finally { setLoadingDetail(false); }
  };

  const saveClient = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/billing-clients/${detail.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      setDetail(data.data);
      setSavedOk(true); setTimeout(() => setSavedOk(false), 3000);
      toast.success('Cliente actualizado'); fetchData();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const deleteClient = () => {
    if (!detail) return;
    setConfirmCfg({
      title: 'Eliminar cliente', confirmLabel: 'Eliminar', danger: true,
      message: `¿Eliminar el cliente "${detail.name}"? Solo se borra el registro; las facturas se conservan.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/billing-clients/${detail.id}`, { method: 'DELETE' });
          if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
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
      <PageHeader title="Clientes" description="Clientes de facturación y sus consumos" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: tipo de identificación ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Tipo de identificación</p>
          <div className="space-y-0.5">
            {ID_TYPE_TABS.map((t) => (
              <RailItem key={t.value} active={scopeType === t.value} Icon={t.Icon} label={t.label}
                count={countByType[t.value]} onClick={() => setScopeType(t.value)} />
            ))}
          </div>
        </aside>

        {/* ── Right region: command bar + (list · detail) ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(e2) => setSearch(e2.target.value)}
                placeholder="Buscar por nombre, identificación o email..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf} />
            </div>
            <button onClick={() => { resetCreate(); setShowCreate(true); }} className={`${BTN_PRIMARY} shrink-0`}>
              <Plus className="w-4 h-4" /> Nuevo cliente
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                singleLine
                bottomReserve={52}
                sortBy={sortBy} sortDir={sortDir} onSort={onSort}
                data={sortedClients}
                onRowClick={(c: any) => openDetail(c)}
                emptyTitle="Sin clientes"
                emptyDesc="No hay clientes en este tipo."
                columns={[
                  { key: 'name', header: 'Cliente', width: '200px', sortKey: 'name', render: (c: any) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`truncate text-[13px] font-medium ${selected?.id === c.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{c.name}</span>
                      {c.is_consumidor_final && <PixelBadge variant="info" className="shrink-0">CF</PixelBadge>}
                    </span>
                  ) },
                  { key: 'id', header: 'Identificación', width: '150px', render: (c: any) => <span className="text-[12px] text-digi-text" style={mf}>{c.ruc}</span> },
                  { key: 'email', header: 'Email', width: '160px', render: (c: any) => <span className="text-[12px] text-digi-muted" style={mf}>{c.email || '—'}</span> },
                  { key: 'facturas', header: 'Facturas', width: '90px', sortKey: 'facturas', render: (c: any) => <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{c.facturas}</span> },
                  { key: 'total', header: 'Total facturado', width: '130px', sortKey: 'total', render: (c: any) => <span className="text-[12px] text-digi-text tabular-nums" style={mf}>${Number(c.total).toFixed(2)}</span> },
                  { key: 'ultima', header: 'Última factura', width: '140px', sortKey: 'ultima', render: (c: any) => <span className="text-[12px] text-digi-muted" style={mf}>{fechaEs(c.ultima)}</span> },
                ]}
              />
              <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-digi-border text-[12px]" style={mf}>
                <span className="text-digi-muted">{sortedClients.length} cliente{sortedClients.length === 1 ? '' : 's'} · {sortedClients.reduce((s, c) => s + Number(c.facturas || 0), 0)} facturas</span>
                <span className="text-digi-text">Total facturado: <span className="text-accent font-semibold tabular-nums">${sortedClients.reduce((s, c) => s + Number(c.total || 0), 0).toFixed(2)}</span></span>
              </div>
            </div>

            {/* ── Detail panel ── */}
            <aside className="w-full xl:w-[400px]">
              {!selected ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un cliente para ver y editar sus datos.</p>
                </div>
              ) : loadingDetail || !detail ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-10 text-center text-[12px] text-digi-muted" style={mf}>Cargando…</div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight flex items-center gap-2" style={mf}>
                        <span className="truncate">{detail.name}</span>
                        {detail.is_consumidor_final && <PixelBadge variant="info">CF</PixelBadge>}
                      </h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{ID_TYPE_LABEL[detail.id_type] || detail.id_type} · {detail.ruc}</p>
                    </div>
                    <button onClick={() => { setSelected(null); setDetail(null); }} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>

                  {/* Segmented toggle */}
                  <div className="px-4 pt-3">
                    <div className="inline-flex gap-1 p-0.5 bg-black/[0.04] rounded-md">
                      {(['datos', 'consumos'] as const).map(t => (
                        <button key={t} onClick={() => setDetailTab(t)}
                          className={`px-3 py-1 text-[12px] font-medium rounded transition-colors ${detailTab === t ? 'bg-white text-accent shadow-sm' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>
                          {t === 'datos' ? 'Datos' : `Consumos (${detail.invoices.length})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 space-y-3 max-h-[62vh] overflow-y-auto">
                    {detailTab === 'datos' ? (
                      <>
                        {detail.is_consumidor_final && <p className="text-[11px] text-digi-muted" style={mf}>Registro especial: agrupa todas las facturas a consumidor final.</p>}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className={labelCls} style={mf}>Tipo ID</label>
                            <select value={e.id_type} onChange={ev => setE({ ...e, id_type: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} field-select appearance-none disabled:opacity-50`} style={mf}>
                              <option value="04">RUC</option><option value="05">Cédula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                            </select>
                          </div>
                          <div>
                            <label className={labelCls} style={mf}>Identificación</label>
                            <input value={e.ruc} onChange={ev => setE({ ...e, ruc: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
                          </div>
                        </div>
                        <div>
                          <label className={labelCls} style={mf}>Nombre / Razón Social</label>
                          <input value={e.name} onChange={ev => setE({ ...e, name: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={labelCls} style={mf}>Email</label><input value={e.email} onChange={ev => setE({ ...e, email: ev.target.value })} type="email" className={smallInputCls} style={mf} /></div>
                          <div><label className={labelCls} style={mf}>Teléfono</label><input value={e.phone} onChange={ev => setE({ ...e, phone: ev.target.value })} className={smallInputCls} style={mf} /></div>
                        </div>
                        <div><label className={labelCls} style={mf}>Dirección</label><input value={e.address} onChange={ev => setE({ ...e, address: ev.target.value })} className={smallInputCls} style={mf} /></div>
                        <div><label className={labelCls} style={mf}>País</label><CountrySelect value={e.country || ''} onChange={(v) => setE({ ...e, country: v })} /></div>
                        <div><label className={labelCls} style={mf}>Notas</label><textarea value={e.notes} onChange={ev => setE({ ...e, notes: ev.target.value })} rows={2} className={`${smallInputCls} resize-none`} style={mf} /></div>
                        {detail.aliases?.length > 0 && (
                          <div className="text-[11px] text-digi-muted" style={mf}><span className="text-accent font-medium">Identificaciones fusionadas: </span>{detail.aliases.join(', ')}</div>
                        )}
                        <button onClick={saveClient} disabled={saving} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
                          {saving ? '...' : savedOk ? '✓ Guardado' : 'Guardar cambios'}
                        </button>
                        {savedOk && <p className="text-[12px] text-green-600 text-center flex items-center justify-center gap-1" style={mf}><CheckCircle2 className="w-3.5 h-3.5" /> Cambios guardados</p>}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-digi-darker border border-digi-border rounded-lg px-2.5 py-2"><div className="text-[10px] text-digi-muted uppercase tracking-wide" style={mf}>Facturas</div><div className="text-[16px] font-semibold text-digi-text" style={mf}>{detail.summary.count}</div></div>
                          <div className="bg-digi-darker border border-digi-border rounded-lg px-2.5 py-2"><div className="text-[10px] text-digi-muted uppercase tracking-wide" style={mf}>Total</div><div className="text-[16px] font-semibold text-digi-text tabular-nums" style={mf}>${detail.summary.total_facturado.toFixed(2)}</div></div>
                          <div className="bg-digi-darker border border-digi-border rounded-lg px-2.5 py-2"><div className="text-[10px] text-digi-muted uppercase tracking-wide" style={mf}>Autorizado</div><div className="text-[16px] font-semibold text-green-600 tabular-nums" style={mf}>${detail.summary.total_autorizado.toFixed(2)}</div></div>
                        </div>
                        <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5" style={mf}>Facturas ({detail.invoices.length})</h4>
                        {detail.invoices.length === 0 ? (
                          <p className="text-[12px] text-digi-muted py-3 text-center" style={mf}>Sin facturas registradas para este cliente.</p>
                        ) : (
                          <div className="space-y-2">
                            {detail.invoices.map((inv: any) => (
                              <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 border border-digi-border rounded-lg bg-digi-darker">
                                <div className="min-w-0">
                                  <div className="text-[12px] font-medium text-digi-text" style={mf}>{inv.invoice_number || `Factura #${inv.id}`}</div>
                                  <div className="text-[11px] text-digi-muted flex items-center gap-2 flex-wrap" style={mf}>
                                    <span>{inv.created_at}</span>
                                    <span>· ${inv.total.toFixed(2)}</span>
                                    <PixelBadge variant={STATUS_V[inv.status] || 'default'}>{STATUS_LABEL[inv.status] || inv.status}</PixelBadge>
                                    {inv.origin_label && <span className="text-digi-muted">· {inv.origin_label}</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {inv.origin_type && (
                                    <button onClick={() => goOrigin(inv)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border border-digi-border rounded text-digi-muted hover:text-digi-text transition-colors" style={mf}><ExternalLink className="w-3 h-3" /> Origen</button>
                                  )}
                                  <button onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border border-accent/40 rounded text-accent hover:bg-accent-light transition-colors" style={mf}><FileText className="w-3 h-3" /> Factura</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}

                    {user?.role === 'admin' && !detail.is_consumidor_final && (
                      <div className="pt-2 border-t border-digi-border">
                        <button onClick={deleteClient} className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 border border-red-300 rounded text-red-600 hover:bg-red-50 transition-colors" style={mf}>
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar cliente
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
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo cliente">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} style={mf}>Tipo ID</label>
              <select value={cIdType} onChange={ev => { const t = ev.target.value; setCIdType(t); if (t === '07') { setCRuc('9999999999999'); setCName('CONSUMIDOR FINAL'); } else { if (cRuc === '9999999999999') setCRuc(''); if (cName === 'CONSUMIDOR FINAL') setCName(''); } }} className={`${smallInputCls} field-select appearance-none`} style={mf}>
                <option value="04">RUC</option><option value="05">Cédula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={mf}>Identificación *</label>
              <input value={cRuc} onChange={ev => setCRuc(ev.target.value)} disabled={cIdType === '07'} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={mf}>Nombre / Razón Social *</label>
            <input value={cName} onChange={ev => setCName(ev.target.value)} disabled={cIdType === '07'} className={`${inputCls} disabled:opacity-50`} style={mf} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls} style={mf}>Email</label><input value={cEmail} onChange={ev => setCEmail(ev.target.value)} type="email" className={smallInputCls} style={mf} /></div>
            <div><label className={labelCls} style={mf}>Teléfono</label><input value={cPhone} onChange={ev => setCPhone(ev.target.value)} className={smallInputCls} style={mf} /></div>
          </div>
          <div><label className={labelCls} style={mf}>Dirección</label><input value={cAddress} onChange={ev => setCAddress(ev.target.value)} className={smallInputCls} style={mf} /></div>
          <div><label className={labelCls} style={mf}>País</label><CountrySelect value={cCountry} onChange={setCCountry} /></div>
          <button onClick={createClient} disabled={creating} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">{creating ? '...' : 'Crear cliente'}</button>
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
