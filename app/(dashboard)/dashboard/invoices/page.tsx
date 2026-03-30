'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const TABS = [
  { value: 'all', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'sent', label: 'Enviadas' },
  { value: 'paid', label: 'Pagadas' },
  { value: 'cancelled', label: 'Canceladas' },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error',
};
const SRI_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  generated: 'default', signed: 'info', sent: 'info', authorized: 'success', rejected: 'error', error: 'error', voided: 'error',
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const isAdmin = user?.role === 'admin';

  // Manual invoice modal states
  const [showManual, setShowManual] = useState(false);
  const [manualType, setManualType] = useState<'completo' | 'con_fallo'>('completo');
  const [manualStep, setManualStep] = useState<'type' | 'projects' | 'form' | 'paid' | 'processing'>('type');

  // Paid amount (con fallo)
  const [mPaidAmount, setMPaidAmount] = useState('');

  // Project selector
  const [projectSearch, setProjectSearch] = useState('');
  const [projectResults, setProjectResults] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<any[]>([]);
  const [searchingProjects, setSearchingProjects] = useState(false);
  const searchTimeout = useRef<any>(null);

  // Client form
  const [mIdType, setMIdType] = useState('07');
  const [mClientName, setMClientName] = useState('');
  const [mClientRuc, setMClientRuc] = useState('');
  const [mClientEmail, setMClientEmail] = useState('');
  const [mClientPhone, setMClientPhone] = useState('');
  const [mClientAddress, setMClientAddress] = useState('');
  const [mPaymentCode, setMPaymentCode] = useState('20');
  const [mItems, setMItems] = useState<{ description: string; quantity: string; unitPrice: string; ivaRate: string; discount: string }[]>([]);
  const [mAdditionalFields, setMAdditionalFields] = useState<{ name: string; value: string }[]>([]);
  const [mSendEmail, setMSendEmail] = useState(true);

  // Currency
  const [currencies, setCurrencies] = useState<{ code: string; symbol: string; name: string; rate: number }[]>([]);
  const [mCurrency, setMCurrency] = useState('USD');
  const [mExchangeRate, setMExchangeRate] = useState('1');

  // Processing
  const [processing, setProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/invoices?${params}`);
      const data = await res.json();
      setInvoices(data.data || []);
    } catch { setInvoices([]); }
  }, [tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch currencies on mount
  useEffect(() => {
    fetch('/api/exchange-rates').then(r => r.json()).then(d => setCurrencies(d.currencies || [])).catch(() => {});
  }, []);

  // Search projects for manual invoice
  const searchProjects = useCallback(async (q: string) => {
    if (!q.trim()) { setProjectResults([]); return; }
    setSearchingProjects(true);
    try {
      const res = await fetch(`/api/projects?search=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      // Filter out already-selected projects
      const selectedIds = new Set(selectedProjects.map(p => p.id));
      setProjectResults((data.data || []).filter((p: any) => !selectedIds.has(p.id)));
    } catch { setProjectResults([]); }
    finally { setSearchingProjects(false); }
  }, [selectedProjects]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchProjects(projectSearch), 300);
    return () => clearTimeout(searchTimeout.current);
  }, [projectSearch, searchProjects]);

  const addProject = (p: any) => {
    setSelectedProjects(prev => [...prev, p]);
    setProjectResults(prev => prev.filter(r => r.id !== p.id));
    setProjectSearch('');
  };

  const removeProject = (id: string) => {
    setSelectedProjects(prev => prev.filter(p => p.id !== id));
  };

  const openManualModal = () => {
    setManualStep('type');
    setManualType('completo');
    setMPaidAmount('');
    setSelectedProjects([]);
    setProjectSearch('');
    setProjectResults([]);
    setMIdType('07');
    setMClientName('CONSUMIDOR FINAL');
    setMClientRuc('9999999999999');
    setMClientEmail('');
    setMClientPhone('');
    setMClientAddress('');
    setMPaymentCode('20');
    setMItems([]);
    setMAdditionalFields([]);
    setMSendEmail(true);
    setMCurrency('USD');
    setMExchangeRate('1');
    setProcessing(false);
    setProcessStep('');
    setShowManual(true);
  };

  // Advance from project selection to client form
  const goToForm = async () => {
    // Load requirements with their costs from selected projects
    const allItems: typeof mItems = [];
    for (const p of selectedProjects) {
      try {
        // Use the invoice-items endpoint that aggregates assignment costs properly
        const res = await fetch(`/api/projects/${p.id}/invoice-items`);
        const data = await res.json();
        const items = data.data || [];
        if (items.length > 0) {
          for (const it of items) {
            allItems.push({
              description: it.description,
              quantity: '1',
              unitPrice: String(Number(it.cost) || 0),
              ivaRate: '0',
              discount: '0',
            });
          }
        } else {
          allItems.push({
            description: `Servicios: ${p.title}`,
            quantity: '1',
            unitPrice: String(Number(p.final_cost) || 0),
            ivaRate: '0',
            discount: '0',
          });
        }
      } catch {
        allItems.push({
          description: `Servicios: ${p.title}`,
          quantity: '1',
          unitPrice: String(Number(p.final_cost) || 0),
          ivaRate: '0',
          discount: '0',
        });
      }
    }
    setMItems(allItems.length > 0 ? allItems : [{ description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }]);
    setManualStep('form');
  };

  // For "con fallo": calculate items total in USD (before currency conversion)
  const itemsTotalUsd = mItems.reduce((s, it) => {
    const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
    return s + base;
  }, 0);

  // Apply proportional discounts based on paid amount
  const applyDiscountsAndSubmit = () => {
    const paidUsd = Number(mPaidAmount) || 0;
    if (paidUsd <= 0 || paidUsd >= itemsTotalUsd) {
      // No discount needed or invalid
      handleManualSubmit();
      return;
    }
    const totalDiscount = itemsTotalUsd - paidUsd;
    // Distribute discount proportionally across items based on each item's weight
    const updatedItems = mItems.map(it => {
      const itemBase = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
      const weight = itemsTotalUsd > 0 ? itemBase / itemsTotalUsd : 0;
      const itemDiscount = Math.round(totalDiscount * weight * 100) / 100;
      return { ...it, discount: String(itemDiscount) };
    });
    // Fix rounding: adjust last item so total discount is exact
    const appliedDiscount = updatedItems.reduce((s, it) => s + Number(it.discount), 0);
    const diff = Math.round((totalDiscount - appliedDiscount) * 100) / 100;
    if (diff !== 0 && updatedItems.length > 0) {
      const last = updatedItems[updatedItems.length - 1];
      last.discount = String(Math.round((Number(last.discount) + diff) * 100) / 100);
    }
    setMItems(updatedItems);
    // Submit after state update via setTimeout
    setTimeout(() => handleManualSubmitWithItems(updatedItems), 50);
  };

  const handleManualSubmitWithItems = async (itemsToUse: typeof mItems) => {
    setManualStep('processing');
    setProcessing(true);
    setProcessStep('Guardando datos del cliente...');
    try {
      await new Promise(r => setTimeout(r, 300));
      setProcessStep('Generando factura electronica...');

      const res = await fetch('/api/invoices/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_ids: selectedProjects.map(p => p.id),
          client_id_type: mIdType,
          client_name: mClientName,
          client_ruc: mClientRuc,
          client_email: mClientEmail,
          client_phone: mClientPhone,
          client_address: mClientAddress,
          payment_code: mPaymentCode,
          send_email: mSendEmail,
          currency: mCurrency,
          exchange_rate: Number(mExchangeRate) || 1,
          invoice_items: itemsToUse.map(it => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            ivaRate: Number(it.ivaRate) || 0,
            discount: Number(it.discount) || 0,
          })),
          additional_fields: mAdditionalFields.filter(f => f.name.trim() && f.value.trim()),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al crear factura');
        setManualStep('form');
        setProcessing(false);
        return;
      }

      const sriOk = data.sriResult?.authorized;
      const sriError = data.sriResult?.error;

      if (data.invoiceId && sriOk) {
        setProcessStep('Factura autorizada por el SRI');
      } else if (data.invoiceId && sriError) {
        setProcessStep(`Factura generada — SRI: ${sriError}`);
      }

      await new Promise(r => setTimeout(r, 500));
      setProcessStep('Proceso completado');
      await new Promise(r => setTimeout(r, 800));

      toast.success(
        'Factura manual creada' +
        (sriOk ? ' — Autorizada por el SRI' : '') +
        (mSendEmail && mClientEmail && sriOk ? ' — Enviada por correo' : '')
      );
      if (sriError && !sriOk) toast.error(`SRI: ${sriError}`);

      setShowManual(false);
      fetchData();
    } catch {
      toast.error('Error al crear factura manual');
      setManualStep('form');
      setProcessing(false);
    }
  };

  const handleManualSubmit = async () => {
    setManualStep('processing');
    setProcessing(true);
    setProcessStep('Guardando datos del cliente...');
    try {
      await new Promise(r => setTimeout(r, 300));
      setProcessStep('Generando factura electronica...');

      const res = await fetch('/api/invoices/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_ids: selectedProjects.map(p => p.id),
          client_id_type: mIdType,
          client_name: mClientName,
          client_ruc: mClientRuc,
          client_email: mClientEmail,
          client_phone: mClientPhone,
          client_address: mClientAddress,
          payment_code: mPaymentCode,
          send_email: mSendEmail,
          currency: mCurrency,
          exchange_rate: Number(mExchangeRate) || 1,
          invoice_items: mItems.map(it => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            ivaRate: Number(it.ivaRate) || 0,
            discount: Number(it.discount) || 0,
          })),
          additional_fields: mAdditionalFields.filter(f => f.name.trim() && f.value.trim()),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Error al crear factura');
        setManualStep('form');
        setProcessing(false);
        return;
      }

      const sriOk = data.sriResult?.authorized;
      const sriError = data.sriResult?.error;

      if (data.invoiceId && sriOk) {
        setProcessStep('Factura autorizada por el SRI');
      } else if (data.invoiceId && sriError) {
        setProcessStep(`Factura generada — SRI: ${sriError}`);
      }

      await new Promise(r => setTimeout(r, 500));
      setProcessStep('Proceso completado');
      await new Promise(r => setTimeout(r, 800));

      toast.success(
        'Factura manual creada' +
        (sriOk ? ' — Autorizada por el SRI' : '') +
        (mSendEmail && mClientEmail && sriOk ? ' — Enviada por correo' : '')
      );
      if (sriError && !sriOk) toast.error(`SRI: ${sriError}`);

      setShowManual(false);
      fetchData();
    } catch {
      toast.error('Error al crear factura manual');
      setManualStep('form');
      setProcessing(false);
    }
  };

  // Form validation
  const invoiceTotal = mItems.reduce((s, it) => {
    const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
    return s + base + base * ((Number(it.ivaRate) || 0) / 100);
  }, 0);
  const consumidorFinalOver50 = mIdType === '07' && invoiceTotal > 50;
  const isFormValid = !processing && mClientName.trim() && mClientRuc.trim() && mClientAddress.trim() &&
    (mIdType === '07' || mClientEmail.trim()) && mItems.length > 0 &&
    !(mIdType === '04' && mClientRuc.length !== 13) && !(mIdType === '05' && mClientRuc.length !== 10) &&
    !consumidorFinalOver50;

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Borrador', open: 'Abierto', in_progress: 'En Progreso', in_review: 'En Revision', completed: 'Completado', cancelled: 'Cancelado',
  };
  const STATUS_V_PROJECT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
    draft: 'default', open: 'info', in_progress: 'warning', in_review: 'info', completed: 'success', cancelled: 'error',
  };

  return (
    <div>
      <PageHeader
        title="Facturas"
        description="Gestiona tus facturas"
        action={isAdmin ? (
          <button onClick={openManualModal} className="pixel-btn pixel-btn-primary text-[9px]">
            + Factura Manual
          </button>
        ) : undefined}
      />

      <div className="mb-4">
        <input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none w-full max-w-xs"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>

      <PixelTabs tabs={TABS} active={tab} onChange={setTab} />

      <PixelDataTable
        columns={[
          { key: 'number', header: 'No. Factura', render: (i: any) => (
            <div className="flex items-center gap-1.5">
              <span className="text-white">{i.invoice_number || `#${i.id}`}</span>
              {i.is_manual && <span className="text-[6px] px-1 py-0.5 border border-purple-500/40 text-purple-400 leading-none" style={pf}>MANUAL</span>}
            </div>
          ), width: '160px' },
          { key: 'client', header: 'Cliente', render: (i: any) => i.client_name_sri || i.client_name || '-' },
          { key: 'total', header: 'Total', render: (i: any) => <span className="text-accent-glow">${Number(i.total || 0).toFixed(2)}</span> },
          { key: 'sri', header: 'SRI', render: (i: any) => i.sri_status ? (
            <PixelBadge variant={SRI_STATUS_V[i.sri_status] || 'default'}>{i.sri_status}</PixelBadge>
          ) : <span className="text-digi-muted">-</span> },
          { key: 'status', header: 'Estado', render: (i: any) => (
            <PixelBadge variant={STATUS_V[i.status] || 'default'}>{i.status}</PixelBadge>
          )},
          { key: 'date', header: 'Fecha', render: (i: any) => i.created_at ? new Date(i.created_at).toLocaleDateString() : '-' },
          { key: 'actions', header: '', width: '160px', render: (i: any) => (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              {i.access_key && (
                <button onClick={() => { navigator.clipboard.writeText(i.access_key); }}
                  className="px-1.5 py-0.5 text-[7px] border border-digi-border text-digi-muted hover:text-accent-glow hover:border-accent/30 transition-colors" style={pf}
                  title={`Clave: ${i.access_key}`}>Clave</button>
              )}
              {i.authorization_number && (
                <button onClick={() => { navigator.clipboard.writeText(i.authorization_number); }}
                  className="px-1.5 py-0.5 text-[7px] border border-digi-border text-digi-muted hover:text-accent-glow hover:border-accent/30 transition-colors" style={pf}
                  title={`Auth: ${i.authorization_number}`}>Auth</button>
              )}
              {i.sri_status === 'authorized' && (
                <button onClick={() => window.open(`/api/invoices/${i.id}/pdf`, '_blank')}
                  className="px-1.5 py-0.5 text-[7px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>PDF</button>
              )}
            </div>
          )},
        ]}
        data={invoices}
        onRowClick={(i: any) => router.push(`/dashboard/invoices/${i.id}`)}
        emptyTitle="Sin facturas"
        emptyDesc="No hay facturas registradas aun."
      />

      {/* Manual Invoice Modal */}
      <PixelModal open={showManual} onClose={() => !processing && setShowManual(false)} title="Factura Manual" size="lg">
        {manualStep === 'processing' ? (
          <div className="py-8 space-y-6">
            <div className="space-y-3">
              <div className="w-full h-1.5 bg-digi-border overflow-hidden">
                <div className="h-full bg-accent animate-[progressPulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
              </div>
              <p className="text-center text-xs text-accent-glow" style={mf}>{processStep}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {[
                { label: 'Cliente', done: processStep !== 'Guardando datos del cliente...' },
                { label: 'Factura', done: processStep.includes('autorizada') || processStep.includes('Proceso completado') },
                { label: 'SRI', done: processStep.includes('autorizada') || processStep.includes('Proceso completado') },
                { label: 'Email', done: processStep === 'Proceso completado' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-6 h-6 flex items-center justify-center text-[8px] border-2 transition-all ${
                    s.done ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-digi-border text-digi-muted animate-pulse'
                  }`} style={pf}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[8px] ${s.done ? 'text-green-400' : 'text-digi-muted'}`} style={pf}>{s.label}</span>
                  {i < 3 && <div className={`w-4 h-0.5 ${s.done ? 'bg-green-500' : 'bg-digi-border'}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-[8px] text-digi-muted" style={mf}>No cierres esta ventana hasta que el proceso termine</p>
          </div>

        ) : manualStep === 'type' ? (
          <div className="space-y-4">
            <p className="text-[10px] text-digi-muted" style={mf}>Selecciona el tipo de factura manual que deseas generar.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setManualType('completo'); setManualStep('projects'); }}
                className="p-4 border-2 border-digi-border hover:border-accent transition-colors text-left space-y-2">
                <div className="text-[10px] text-accent-glow font-bold" style={pf}>Completo</div>
                <p className="text-[9px] text-digi-muted" style={mf}>El cliente pago el monto total del proyecto. La factura se genera con el valor completo de los requerimientos.</p>
              </button>
              <button onClick={() => { setManualType('con_fallo'); setManualStep('projects'); }}
                className="p-4 border-2 border-digi-border hover:border-orange-500/50 transition-colors text-left space-y-2">
                <div className="text-[10px] text-orange-400 font-bold" style={pf}>Con Fallo</div>
                <p className="text-[9px] text-digi-muted" style={mf}>El cliente envio un monto inferior al total. Se aplicara un descuento proporcional en los requerimientos para igualar lo pagado.</p>
              </button>
            </div>
          </div>

        ) : manualStep === 'projects' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              {manualType === 'con_fallo' && <span className="text-[8px] px-1.5 py-0.5 border border-orange-500/40 text-orange-400" style={pf}>CON FALLO</span>}
            </div>
            <p className="text-[10px] text-digi-muted" style={mf}>Busca y selecciona los proyectos a incluir en la factura manual.</p>

            {/* Project search */}
            <div className="relative">
              <input
                value={projectSearch}
                onChange={e => setProjectSearch(e.target.value)}
                placeholder="Buscar proyecto por titulo..."
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
              {searchingProjects && <span className="absolute right-3 top-2.5 text-[8px] text-digi-muted animate-pulse" style={pf}>...</span>}

              {/* Dropdown results */}
              {projectResults.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-digi-darker border-2 border-digi-border max-h-48 overflow-y-auto">
                  {projectResults.map(p => (
                    <button key={p.id} onClick={() => addProject(p)}
                      className="w-full text-left px-3 py-2 hover:bg-accent/10 border-b border-digi-border/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-digi-text" style={mf}>#{p.id} — {p.title}</span>
                        <PixelBadge variant={STATUS_V_PROJECT[p.status] || 'default'}>{STATUS_LABELS[p.status] || p.status}</PixelBadge>
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-[8px] text-digi-muted" style={mf}>{p.client_name || 'Sin cliente'}</span>
                        {p.final_cost && <span className="text-[8px] text-accent-glow" style={mf}>${Number(p.final_cost).toFixed(2)}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected projects */}
            {selectedProjects.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[9px] text-accent-glow" style={pf}>Proyectos seleccionados ({selectedProjects.length})</label>
                {selectedProjects.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 border border-accent/30 bg-accent/5">
                    <div>
                      <span className="text-xs text-digi-text" style={mf}>#{p.id} — {p.title}</span>
                      <div className="flex gap-3 mt-0.5">
                        <PixelBadge variant={STATUS_V_PROJECT[p.status] || 'default'}>{STATUS_LABELS[p.status] || p.status}</PixelBadge>
                        {p.final_cost && <span className="text-[8px] text-accent-glow" style={mf}>${Number(p.final_cost).toFixed(2)}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeProject(p.id)} className="text-red-400/60 hover:text-red-400 text-[8px] px-2 py-1 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>Quitar</button>
                  </div>
                ))}
              </div>
            )}

            {/* Next button */}
            <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
              <button onClick={() => setManualStep('type')} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Atras</button>
              <button onClick={goToForm} disabled={selectedProjects.length === 0}
                className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                Siguiente
              </button>
            </div>
          </div>

        ) : manualStep === 'form' ? (
          /* Form step - client data + invoice items */
          <div className="max-h-[80vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* LEFT: Adquirente + Pago */}
              <div className="space-y-2">
                <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1" style={pf}>Adquirente</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Tipo ID <span className="text-red-400">*</span></label>
                    <select value={mIdType} onChange={e => {
                      const t = e.target.value;
                      setMIdType(t);
                      if (t === '07') { setMClientRuc('9999999999999'); setMClientName('CONSUMIDOR FINAL'); }
                      else { if (mClientRuc === '9999999999999') setMClientRuc(''); if (mClientName === 'CONSUMIDOR FINAL') setMClientName(''); }
                    }} className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                      <option value="04">RUC</option><option value="05">Cedula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Identificacion <span className="text-red-400">*</span></label>
                    <input value={mClientRuc} onChange={e => setMClientRuc(e.target.value)} disabled={mIdType === '07'}
                      placeholder={mIdType === '04' ? '0900000000001' : '0900000000'} maxLength={mIdType === '04' ? 13 : mIdType === '05' ? 10 : 20}
                      className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                    {mIdType === '04' && mClientRuc && mClientRuc.length !== 13 && <p className="text-[7px] text-red-400" style={mf}>13 digitos</p>}
                    {mIdType === '05' && mClientRuc && mClientRuc.length !== 10 && <p className="text-[7px] text-red-400" style={mf}>10 digitos</p>}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Razon Social <span className="text-red-400">*</span></label>
                  <input value={mClientName} onChange={e => setMClientName(e.target.value)} disabled={mIdType === '07'}
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                </div>
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Direccion <span className="text-red-400">*</span></label>
                  <input value={mClientAddress} onChange={e => setMClientAddress(e.target.value)} placeholder="Direccion"
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Email {mIdType !== '07' && <span className="text-red-400">*</span>}</label>
                    <input value={mClientEmail} onChange={e => setMClientEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
                      className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Telefono</label>
                    <input value={mClientPhone} onChange={e => setMClientPhone(e.target.value)} placeholder="0999999999"
                      className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                </div>

                <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Forma de Pago</h4>
                <select value={mPaymentCode} onChange={e => setMPaymentCode(e.target.value)}
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

                <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Moneda</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Moneda de la factura</label>
                    <select value={mCurrency} onChange={e => {
                      const code = e.target.value;
                      setMCurrency(code);
                      const c = currencies.find(c => c.code === code);
                      setMExchangeRate(c ? String(c.rate) : '1');
                    }} className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                      {currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Tasa (1 USD = ?)</label>
                    <input value={mExchangeRate} onChange={e => setMExchangeRate(e.target.value)}
                      type="number" min="0.0001" step="0.0001" disabled={mCurrency === 'USD'}
                      className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                  </div>
                </div>
                {mCurrency !== 'USD' && (
                  <div className="px-2 py-1.5 border border-purple-500/30 bg-purple-900/10 text-[9px] text-purple-300 mt-1" style={mf}>
                    Equivalente para el cliente: {(() => {
                      const t = mItems.reduce((s, it) => {
                        const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                        return s + base + base * ((Number(it.ivaRate) || 0) / 100);
                      }, 0);
                      const sym = currencies.find(c => c.code === mCurrency)?.symbol || mCurrency;
                      return `${sym} ${(t * (Number(mExchangeRate) || 1)).toFixed(2)} ${mCurrency}`;
                    })()}
                    <span className="text-digi-muted"> (referencia, factura en USD)</span>
                  </div>
                )}

                <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Campos Adicionales</h4>
                <div className="space-y-1">
                  {mAdditionalFields.map((f, i) => (
                    <div key={i} className="flex gap-1">
                      <input value={f.name} onChange={e => { const n = [...mAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setMAdditionalFields(n); }}
                        placeholder="Nombre" className="w-1/3 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <input value={f.value} onChange={e => { const n = [...mAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setMAdditionalFields(n); }}
                        placeholder="Descripcion" className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <button onClick={() => setMAdditionalFields(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-400/60 hover:text-red-400 text-[8px] px-1" style={pf}>X</button>
                    </div>
                  ))}
                  <button onClick={() => setMAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                    className="text-[8px] text-digi-muted border border-digi-border px-2 py-0.5 hover:text-accent-glow hover:border-accent/30 transition-colors" style={pf}>+ Campo adicional</button>
                </div>

                {/* Selected projects summary */}
                <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Proyectos ({selectedProjects.length})</h4>
                <div className="space-y-1">
                  {selectedProjects.map(p => (
                    <div key={p.id} className="text-[9px] text-digi-muted px-2 py-1 border border-digi-border/30" style={mf}>
                      #{p.id} — {p.title}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: Detalle + Totales */}
              <div className="space-y-2">
                <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1" style={pf}>Detalle</h4>
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                  {mItems.map((item, i) => (
                    <div key={i} className="border border-digi-border/50 p-1.5">
                      <div className="flex gap-1 mb-1">
                        <input value={item.description} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], description: e.target.value }; setMItems(n); }}
                          placeholder="Descripcion" className="flex-1 px-2 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <button onClick={() => setMItems(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400/60 hover:text-red-400 text-[7px] px-1" style={pf}>X</button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <div>
                          <label className="text-[7px] text-digi-muted" style={pf}>Cant.</label>
                          <input value={item.quantity} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], quantity: e.target.value }; setMItems(n); }}
                            type="number" min="0.01" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        </div>
                        <div>
                          <label className="text-[7px] text-digi-muted" style={pf}>P.Unit.</label>
                          <input value={item.unitPrice} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setMItems(n); }}
                            type="number" min="0" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        </div>
                        <div>
                          <label className="text-[7px] text-digi-muted" style={pf}>IVA</label>
                          <select value={item.ivaRate} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], ivaRate: e.target.value }; setMItems(n); }}
                            className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                            <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[7px] text-digi-muted" style={pf}>Desc.</label>
                          <input value={item.discount} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], discount: e.target.value }; setMItems(n); }}
                            type="number" min="0" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setMItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
                  className="text-[8px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>+ Item</button>

                {/* Totales */}
                {(() => {
                  const subtotal = mItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0), 0);
                  const totalDiscount = mItems.reduce((s, it) => s + (Number(it.discount) || 0), 0);
                  const ivaByRate: Record<string, number> = {};
                  mItems.forEach(it => {
                    const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                    const rate = it.ivaRate || '0';
                    ivaByRate[rate] = (ivaByRate[rate] || 0) + base;
                  });
                  const totalIva = mItems.reduce((s, it) => {
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

            {/* Footer */}
            <div className="pt-3 mt-3 border-t-2 border-digi-border space-y-2">
              {consumidorFinalOver50 && (
                <div className="px-3 py-2 border border-red-700/50 bg-red-900/10 text-[9px] text-red-400" style={mf}>
                  El SRI requiere identificar al cliente (RUC o Cedula) en facturas mayores a $50.00. El total actual es ${invoiceTotal.toFixed(2)}. Cambia el tipo de identificacion.
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mSendEmail} onChange={e => setMSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                  <span className="text-[9px] text-digi-muted" style={mf}>Enviar por correo</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setManualStep('projects')} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Atras</button>
                  {manualType === 'con_fallo' ? (
                    <button onClick={() => setManualStep('paid')} disabled={!isFormValid} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                      Siguiente
                    </button>
                  ) : (
                    <button onClick={handleManualSubmit} disabled={!isFormValid} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                      Generar Factura
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

        ) : manualStep === 'paid' ? (
          /* Paid amount step (con fallo) */
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] px-1.5 py-0.5 border border-orange-500/40 text-orange-400" style={pf}>CON FALLO</span>
            </div>
            <p className="text-[10px] text-digi-muted" style={mf}>Ingresa el monto que el cliente envio (en USD). El descuento se distribuira proporcionalmente entre los requerimientos.</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Total real de requerimientos (USD)</label>
                  <div className="px-3 py-2 bg-digi-darker border border-digi-border text-xs text-digi-text" style={mf}>
                    ${itemsTotalUsd.toFixed(2)}
                  </div>
                </div>
                <div>
                  <label className="text-[8px] text-accent-glow mb-0.5 block" style={pf}>Monto pagado por el cliente (USD) <span className="text-red-400">*</span></label>
                  <input value={mPaidAmount} onChange={e => setMPaidAmount(e.target.value)}
                    type="number" min="0.01" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2 bg-digi-darker border-2 border-accent/50 text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                {mCurrency !== 'USD' && Number(mPaidAmount) > 0 && (
                  <div className="px-2 py-1.5 border border-purple-500/30 bg-purple-900/10 text-[9px] text-purple-300" style={mf}>
                    En {mCurrency}: {currencies.find(c => c.code === mCurrency)?.symbol || ''}{(Number(mPaidAmount) * (Number(mExchangeRate) || 1)).toFixed(2)}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {Number(mPaidAmount) > 0 && Number(mPaidAmount) < itemsTotalUsd && (
                  <>
                    <div>
                      <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Descuento total a aplicar (USD)</label>
                      <div className="px-3 py-2 bg-red-900/10 border border-red-500/30 text-xs text-red-400 font-bold" style={mf}>
                        -${(itemsTotalUsd - Number(mPaidAmount)).toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Distribucion por item</label>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {mItems.map((it, i) => {
                          const itemBase = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                          const weight = itemsTotalUsd > 0 ? itemBase / itemsTotalUsd : 0;
                          const itemDiscount = Math.round((itemsTotalUsd - Number(mPaidAmount)) * weight * 100) / 100;
                          return (
                            <div key={i} className="flex justify-between text-[8px] px-2 py-1 border border-digi-border/30" style={mf}>
                              <span className="text-digi-muted truncate max-w-[60%]">{it.description || `Item ${i + 1}`}</span>
                              <span className="text-red-400">-${itemDiscount.toFixed(2)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                {Number(mPaidAmount) > 0 && Number(mPaidAmount) >= itemsTotalUsd && (
                  <div className="px-3 py-2 border border-yellow-500/30 bg-yellow-900/10 text-[9px] text-yellow-400" style={mf}>
                    El monto pagado es igual o mayor al total. No se aplicara descuento. Usa el tipo "Completo" en su lugar.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-digi-border">
              <button onClick={() => setManualStep('form')} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Atras</button>
              <button onClick={applyDiscountsAndSubmit}
                disabled={!Number(mPaidAmount) || Number(mPaidAmount) <= 0 || Number(mPaidAmount) >= itemsTotalUsd}
                className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                Generar Factura con Descuento
              </button>
            </div>
          </div>
        ) : null}
      </PixelModal>
    </div>
  );
}
