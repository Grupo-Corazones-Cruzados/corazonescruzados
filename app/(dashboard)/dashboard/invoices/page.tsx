'use client';

import { Suspense, useCallback, useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Receipt, Clock, Send, CheckCircle2, XCircle, Ban, Search, Plus, X, ArrowRight, PenLine, Zap, Download, KeyRound, FileCheck2 } from 'lucide-react';
import { fmt2 } from '@/lib/format';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todas', Icon: Receipt },
  { value: 'pending', label: 'Pendientes', Icon: Clock },
  { value: 'sent', label: 'Enviadas', Icon: Send },
  { value: 'paid', label: 'Pagadas', Icon: CheckCircle2 },
  { value: 'failed', label: 'Fallidas', Icon: XCircle },
  { value: 'cancelled', label: 'Canceladas', Icon: Ban },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error', failed: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada', failed: 'Fallida',
};
// Punto de color por variante para mostrar el estado sin columna dedicada.
const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500', warning: 'bg-amber-500', error: 'bg-red-500', info: 'bg-accent', default: 'bg-digi-muted',
};
const SRI_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  generated: 'default', signed: 'info', sent: 'info', authorized: 'success', rejected: 'error', error: 'error', voided: 'error',
};
const SRI_STATUS_LABEL: Record<string, string> = {
  generated: 'Generada', signed: 'Firmada', sent: 'Enviada al SRI', authorized: 'Autorizada',
  rejected: 'Rechazada', error: 'Error', voided: 'Anulada',
};

export default function InvoicesPage() {
  return (
    <Suspense fallback={null}>
      <InvoicesPageInner />
    </Suspense>
  );
}

function InvoicesPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
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

  // Client history (clients from past invoices, for autofill)
  const [clientHistory, setClientHistory] = useState<{
    id_type: string; client_ruc: string; client_name: string;
    client_email: string; client_phone: string; client_address: string;
    last_used: string;
  }[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

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
      setCounts(data.counts || {});
    } catch { setInvoices([]); }
  }, [tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSelected(null); }, [tab, search]);

  // Fetch currencies on mount
  useEffect(() => {
    fetch('/api/exchange-rates').then(r => r.json()).then(d => setCurrencies(d.currencies || [])).catch(() => {});
  }, []);

  // Fetch client history when manual modal opens
  useEffect(() => {
    if (!showManual) return;
    fetch('/api/invoices/clients-history')
      .then(r => r.json())
      .then(d => setClientHistory(d.data || []))
      .catch(() => setClientHistory([]));
  }, [showManual]);

  const applyPastClient = (c: typeof clientHistory[0]) => {
    setMIdType(c.id_type);
    setMClientRuc(c.client_ruc);
    setMClientName(c.client_name);
    setMClientEmail(c.client_email);
    setMClientPhone(c.client_phone);
    setMClientAddress(c.client_address);
    setHistoryOpen(false);
    setHistorySearch('');
    toast.success(`Datos de ${c.client_name} cargados`);
  };

  const clearClientFields = () => {
    setMIdType('07');
    setMClientRuc('9999999999999');
    setMClientName('CONSUMIDOR FINAL');
    setMClientEmail('');
    setMClientPhone('');
    setMClientAddress('');
    setHistoryOpen(false);
    setHistorySearch('');
  };

  const filteredHistory = historySearch.trim()
    ? clientHistory.filter(c => {
        const q = historySearch.trim().toLowerCase();
        return c.client_name.toLowerCase().includes(q) || c.client_ruc.toLowerCase().includes(q);
      })
    : clientHistory;

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

  // Refactor: prefill modal with data from an existing invoice (e.g. a voided one)
  const openRefactorModal = useCallback(async (sourceId: string) => {
    try {
      const [invRes, itemsRes] = await Promise.all([
        fetch(`/api/invoices/${sourceId}`),
        fetch(`/api/invoices/${sourceId}/items`),
      ]);
      if (!invRes.ok) { toast.error('No se pudo cargar la factura origen'); return; }
      const { data: inv } = await invRes.json();
      const itemsData = itemsRes.ok ? await itemsRes.json() : { data: [] };
      const items = itemsData.data || [];

      setManualStep('form');
      setManualType('completo');
      setMPaidAmount('');
      setSelectedProjects([]);
      setProjectSearch('');
      setProjectResults([]);
      setMIdType(inv.client_id_type || '07');
      setMClientName(inv.client_name_sri || 'CONSUMIDOR FINAL');
      setMClientRuc(inv.client_ruc || '9999999999999');
      setMClientEmail(inv.client_email_sri || '');
      setMClientPhone(inv.client_phone_sri || '');
      setMClientAddress(inv.client_address_sri || '');
      setMPaymentCode('20');
      setMItems(items.length > 0
        ? items.map((it: any) => ({
            description: it.description,
            quantity: String(Number(it.quantity) || 1),
            unitPrice: String(Number(it.unit_price) || 0),
            ivaRate: String(Number(it.iva_rate) || 0),
            discount: '0',
          }))
        : [{ description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }]);
      setMAdditionalFields([]);
      setMSendEmail(true);
      setMCurrency(inv.currency || 'USD');
      setMExchangeRate(String(Number(inv.exchange_rate) || 1));
      setProcessing(false);
      setProcessStep('');
      setShowManual(true);
      toast.success(`Datos de factura ${inv.invoice_number} cargados — edita y envía`);
    } catch {
      toast.error('Error cargando datos de la factura');
    }
  }, []);

  // Detect ?refactor=<id> param and prefill the modal once
  const refactorProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    const refactorId = searchParams.get('refactor');
    if (!refactorId || !isAdmin) return;
    if (refactorProcessedRef.current === refactorId) return;
    refactorProcessedRef.current = refactorId;
    openRefactorModal(refactorId);
    // Clean the URL so reloads don't re-trigger
    router.replace('/dashboard/invoices');
  }, [searchParams, isAdmin, openRefactorModal, router]);

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
      <PageHeader title="Facturas" description="Facturación electrónica (SRI)" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: estado ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Estado</p>
          <div className="space-y-0.5">
            {STATUS_TABS.map((s) => {
              const active = tab === s.value;
              return (
                <button key={s.value} onClick={() => setTab(s.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
                    active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
                  }`}>
                  <s.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
                  <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{s.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{counts[s.value] ?? 0}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right region: command bar + tabla ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input value={search} onChange={(ev) => setSearch(ev.target.value)} placeholder="Buscar factura..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf} />
            </div>
            {isAdmin && (
              <button onClick={openManualModal} className={`${BTN_PRIMARY} shrink-0`}>
                <Plus className="w-4 h-4" /> Factura manual
              </button>
            )}
          </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        <div className="min-w-0">
      <PixelDataTable
        singleLine
        columns={[
          { key: 'number', header: 'No. Factura', width: '190px', render: (i: any) => (
            <span className="flex items-center gap-2 min-w-0">
              <span title={STATUS_LABEL[i.status] || i.status} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[STATUS_V[i.status] || 'default']}`} />
              <span className={`flex-1 truncate ${selected?.id === i.id ? 'text-accent font-medium' : 'text-digi-text'}`}>{i.invoice_number || `#${i.id}`}</span>
              {i.is_manual
                ? <span title="Factura manual" className="shrink-0 text-digi-muted"><PenLine className="w-3.5 h-3.5" /></span>
                : <span title="Factura automática" className="shrink-0 text-digi-muted"><Zap className="w-3.5 h-3.5" /></span>}
            </span>
          ) },
          { key: 'client', header: 'Cliente', render: (i: any) => <span className="text-digi-text">{i.client_name_sri || i.client_name || '-'}</span> },
          { key: 'total', header: 'Total', width: '100px', render: (i: any) => <span className="text-accent tabular-nums">${fmt2(Number(i.total || 0))}</span> },
          { key: 'sri', header: 'SRI', width: '150px', hideOnMobile: true, render: (i: any) => i.sri_status ? (
            <PixelBadge variant={SRI_STATUS_V[i.sri_status] || 'default'}>{SRI_STATUS_LABEL[i.sri_status] || i.sri_status}</PixelBadge>
          ) : <span className="text-digi-muted">-</span> },
          { key: 'date', header: 'Fecha', width: '110px', hideOnMobile: true, render: (i: any) => <span className="text-digi-muted">{i.created_at ? new Date(i.created_at).toLocaleDateString('es-EC') : '-'}</span> },
        ]}
        data={invoices}
        onRowClick={(i: any) => setSelected(i)}
        emptyTitle="Sin facturas"
        emptyDesc="No hay facturas registradas aun."
      />
        </div>

        {/* ── Detail preview panel ── */}
        <aside className="w-full xl:w-[340px]">
          {!selected ? (
            <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
              <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                <Receipt className="w-5 h-5 text-digi-muted" />
              </div>
              <p className="text-[12px] text-digi-muted" style={mf}>Selecciona una factura para ver un resumen.</p>
            </div>
          ) : (
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
              <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.invoice_number || `Factura #${selected.id}`}</h3>
                  <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{selected.client_name_sri || selected.client_name || '—'}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 space-y-2.5">
                {[
                  ['Total', <span key="t" className="text-accent font-semibold tabular-nums" style={mf}>${fmt2(Number(selected.total || 0))}</span>],
                  ['SRI', selected.sri_status ? <PixelBadge key="sri" variant={SRI_STATUS_V[selected.sri_status] || 'default'}>{SRI_STATUS_LABEL[selected.sri_status] || selected.sri_status}</PixelBadge> : '—'],
                  ['Estado', <PixelBadge key="s" variant={STATUS_V[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>],
                  ['Fecha', selected.created_at ? new Date(selected.created_at).toLocaleDateString('es-EC') : '—'],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-digi-muted" style={mf}>{k}</span>
                    <span className="text-digi-text text-right" style={mf}>{v}</span>
                  </div>
                ))}
                <div className="space-y-2 pt-1">
                  {selected.sri_status === 'authorized' && (
                    <button onClick={() => window.open(`/api/invoices/${selected.id}/pdf`, '_blank')} className={`${BTN_SECONDARY} w-full`}>
                      <Download className="w-4 h-4" /> Descargar PDF
                    </button>
                  )}
                  {(selected.access_key || selected.authorization_number) && (
                    <div className="grid grid-cols-2 gap-2">
                      {selected.access_key && (
                        <button onClick={() => { navigator.clipboard.writeText(selected.access_key); toast.success('Clave copiada'); }}
                          className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf} title={selected.access_key}>
                          <KeyRound className="w-3.5 h-3.5" /> Clave
                        </button>
                      )}
                      {selected.authorization_number && (
                        <button onClick={() => { navigator.clipboard.writeText(selected.authorization_number); toast.success('Autorización copiada'); }}
                          className="inline-flex items-center justify-center gap-1.5 px-2 py-1.5 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf} title={selected.authorization_number}>
                          <FileCheck2 className="w-3.5 h-3.5" /> Autorización
                        </button>
                      )}
                    </div>
                  )}
                  <button onClick={() => router.push(`/dashboard/invoices/${selected.id}`)} className={`${BTN_PRIMARY} w-full`}>
                    Ver factura <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
        </div>
      </div>

      {/* Manual Invoice Modal */}
      <PixelModal open={showManual} onClose={() => !processing && setShowManual(false)} title="Factura Manual" size="lg">
        {manualStep === 'processing' ? (
          <div className="py-8 space-y-6">
            <div className="space-y-3">
              <div className="w-full h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                <div className="h-full bg-accent animate-[progressPulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
              </div>
              <p className="text-center text-[13px] text-digi-text" style={mf}>{processStep}</p>
            </div>
            <div className="flex items-center justify-center gap-3">
              {[
                { label: 'Cliente', done: processStep !== 'Guardando datos del cliente...' },
                { label: 'Factura', done: processStep.includes('autorizada') || processStep.includes('Proceso completado') },
                { label: 'SRI', done: processStep.includes('autorizada') || processStep.includes('Proceso completado') },
                { label: 'Email', done: processStep === 'Proceso completado' },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] border-2 transition-all ${
                    s.done ? 'border-green-500 bg-green-50 text-green-600' : 'border-digi-border text-digi-muted animate-pulse'
                  }`} style={pf}>
                    {s.done ? '✓' : i + 1}
                  </div>
                  <span className={`text-[11px] ${s.done ? 'text-green-600' : 'text-digi-muted'}`} style={pf}>{s.label}</span>
                  {i < 3 && <div className={`w-4 h-0.5 ${s.done ? 'bg-green-500' : 'bg-digi-border'}`} />}
                </div>
              ))}
            </div>
            <p className="text-center text-[12px] text-digi-muted" style={mf}>No cierres esta ventana hasta que el proceso termine</p>
          </div>

        ) : manualStep === 'type' ? (
          <div className="space-y-4">
            <p className="text-[10px] text-digi-muted" style={mf}>Selecciona el tipo de factura manual que deseas generar.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setManualType('completo'); setManualStep('projects'); }}
                className="p-4 border-2 border-digi-border hover:border-accent transition-colors text-left space-y-2">
                <div className="text-[10px] text-accent font-semibold" style={pf}>Completo</div>
                <p className="text-[11px] text-digi-muted" style={mf}>El cliente pago el monto total del proyecto. La factura se genera con el valor completo de los requerimientos.</p>
              </button>
              <button onClick={() => { setManualType('con_fallo'); setManualStep('projects'); }}
                className="p-4 border-2 border-digi-border hover:border-orange-500/50 transition-colors text-left space-y-2">
                <div className="text-[10px] text-orange-400 font-bold" style={pf}>Con Fallo</div>
                <p className="text-[11px] text-digi-muted" style={mf}>El cliente envio un monto inferior al total. Se aplicara un descuento proporcional en los requerimientos para igualar lo pagado.</p>
              </button>
            </div>
          </div>

        ) : manualStep === 'projects' ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-1">
              {manualType === 'con_fallo' && <span className="text-[11px] px-1.5 py-0.5 border border-orange-500/40 text-orange-400" style={pf}>CON FALLO</span>}
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
              {searchingProjects && <span className="absolute right-3 top-2.5 text-[11px] text-digi-muted animate-pulse" style={pf}>...</span>}

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
                        <span className="text-[11px] text-digi-muted" style={mf}>{p.client_name || 'Sin cliente'}</span>
                        {p.final_cost && <span className="text-[11px] text-accent" style={mf}>${fmt2(Number(p.final_cost))}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected projects */}
            {selectedProjects.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] text-accent" style={pf}>Proyectos seleccionados ({selectedProjects.length})</label>
                {selectedProjects.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 border border-accent/30 bg-accent/5">
                    <div>
                      <span className="text-xs text-digi-text" style={mf}>#{p.id} — {p.title}</span>
                      <div className="flex gap-3 mt-0.5">
                        <PixelBadge variant={STATUS_V_PROJECT[p.status] || 'default'}>{STATUS_LABELS[p.status] || p.status}</PixelBadge>
                        {p.final_cost && <span className="text-[11px] text-accent" style={mf}>${fmt2(Number(p.final_cost))}</span>}
                      </div>
                    </div>
                    <button onClick={() => removeProject(p.id)} className="text-red-600/60 hover:text-red-600 text-[11px] px-2 py-1 border border-red-300 hover:bg-red-50 transition-colors" style={pf}>Quitar</button>
                  </div>
                ))}
              </div>
            )}

            {/* Next button */}
            <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
              <button onClick={() => setManualStep('type')} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Atras</button>
              <button onClick={goToForm} disabled={selectedProjects.length === 0}
                className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={pf}>
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
                <div className="flex items-center justify-between border-b border-digi-border pb-1">
                  <h4 className="text-[11px] text-accent" style={pf}>Adquirente</h4>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(o => !o)}
                      className="text-[11px] px-2 py-0.5 rounded border border-accent/40 text-accent hover:bg-accent-light transition-colors"
                      style={pf}
                    >
                      {historyOpen ? 'Cerrar' : `Cliente previo${clientHistory.length ? ` (${clientHistory.length})` : ''}`}
                    </button>
                    <button
                      type="button"
                      onClick={clearClientFields}
                      className="text-[11px] px-2 py-0.5 border border-digi-border text-digi-muted hover:text-digi-text transition-colors"
                      style={pf}
                      title="Limpiar campos"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>

                {historyOpen && (
                  <div className="border border-digi-border rounded-lg bg-digi-darker p-2 space-y-2">
                    <input
                      autoFocus
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      placeholder="Buscar por nombre o RUC..."
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none"
                      style={mf}
                    />
                    <div className="max-h-40 overflow-y-auto border border-digi-border/50">
                      {filteredHistory.length === 0 ? (
                        <div className="px-2 py-3 text-center text-[12px] text-digi-muted" style={pf}>
                          {clientHistory.length === 0 ? 'No hay clientes previos' : 'Sin resultados'}
                        </div>
                      ) : (
                        filteredHistory.slice(0, 50).map((c) => (
                          <button
                            key={c.client_ruc}
                            type="button"
                            onClick={() => applyPastClient(c)}
                            className="w-full text-left px-2 py-1.5 border-b border-digi-border/30 last:border-b-0 hover:bg-accent/10 transition-colors"
                          >
                            <div className="text-[12px] text-digi-text truncate" style={mf}>{c.client_name}</div>
                            <div className="text-[11px] text-digi-muted flex gap-2" style={mf}>
                              <span>{c.client_ruc}</span>
                              {c.client_email && <span className="truncate">· {c.client_email}</span>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    <div className="text-[11px] text-digi-muted" style={pf}>
                      Elige uno para rellenar los campos, o cierra y llena manualmente.
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Tipo ID <span className="text-red-600">*</span></label>
                    <select value={mIdType} onChange={e => {
                      const t = e.target.value;
                      setMIdType(t);
                      if (t === '07') { setMClientRuc('9999999999999'); setMClientName('CONSUMIDOR FINAL'); }
                      else { if (mClientRuc === '9999999999999') setMClientRuc(''); if (mClientName === 'CONSUMIDOR FINAL') setMClientName(''); }
                    }} className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                      <option value="04">RUC</option><option value="05">Cedula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Identificacion <span className="text-red-600">*</span></label>
                    <input value={mClientRuc} onChange={e => setMClientRuc(e.target.value)} disabled={mIdType === '07'}
                      placeholder={mIdType === '04' ? '0900000000001' : '0900000000'} maxLength={mIdType === '04' ? 13 : mIdType === '05' ? 10 : 20}
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                    {mIdType === '04' && mClientRuc && mClientRuc.length !== 13 && <p className="text-[11px] text-red-600" style={mf}>13 digitos</p>}
                    {mIdType === '05' && mClientRuc && mClientRuc.length !== 10 && <p className="text-[11px] text-red-600" style={mf}>10 digitos</p>}
                  </div>
                </div>
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Razon Social <span className="text-red-600">*</span></label>
                  <input value={mClientName} onChange={e => setMClientName(e.target.value)} disabled={mIdType === '07'}
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                </div>
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Direccion <span className="text-red-600">*</span></label>
                  <input value={mClientAddress} onChange={e => setMClientAddress(e.target.value)} placeholder="Direccion"
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Email {mIdType !== '07' && <span className="text-red-600">*</span>}</label>
                    <input value={mClientEmail} onChange={e => setMClientEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Telefono</label>
                    <input value={mClientPhone} onChange={e => setMClientPhone(e.target.value)} placeholder="0999999999"
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                </div>

                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Forma de Pago</h4>
                <select value={mPaymentCode} onChange={e => setMPaymentCode(e.target.value)}
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

                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Moneda</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Moneda de la factura</label>
                    <select value={mCurrency} onChange={e => {
                      const code = e.target.value;
                      setMCurrency(code);
                      const c = currencies.find(c => c.code === code);
                      setMExchangeRate(c ? String(c.rate) : '1');
                    }} className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                      {currencies.map(c => (
                        <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Tasa (1 USD = ?)</label>
                    <input value={mExchangeRate} onChange={e => setMExchangeRate(e.target.value)}
                      type="number" min="0.0001" step="0.0001" disabled={mCurrency === 'USD'}
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                  </div>
                </div>
                {mCurrency !== 'USD' && (
                  <div className="px-2 py-1.5 border border-accent/30 rounded bg-accent-light text-[12px] text-accent mt-1" style={mf}>
                    Equivalente para el cliente: {(() => {
                      const t = mItems.reduce((s, it) => {
                        const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                        return s + base + base * ((Number(it.ivaRate) || 0) / 100);
                      }, 0);
                      const sym = currencies.find(c => c.code === mCurrency)?.symbol || mCurrency;
                      return `${sym} ${fmt2((t * (Number(mExchangeRate) || 1)))} ${mCurrency}`;
                    })()}
                    <span className="text-digi-muted"> (referencia, factura en USD)</span>
                  </div>
                )}

                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Campos Adicionales</h4>
                <div className="space-y-1">
                  {mAdditionalFields.map((f, i) => (
                    <div key={i} className="flex gap-1">
                      <input value={f.name} onChange={e => { const n = [...mAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setMAdditionalFields(n); }}
                        placeholder="Nombre" className="w-1/3 field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <input value={f.value} onChange={e => { const n = [...mAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setMAdditionalFields(n); }}
                        placeholder="Descripcion" className="flex-1 field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <button onClick={() => setMAdditionalFields(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-red-500/70 hover:text-red-600 text-[13px] px-1" style={pf}>X</button>
                    </div>
                  ))}
                  <button onClick={() => setMAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                    className="text-[12px] text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={pf}>+ Campo adicional</button>
                </div>

                {/* Selected projects summary */}
                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Proyectos ({selectedProjects.length})</h4>
                <div className="space-y-1">
                  {selectedProjects.map(p => (
                    <div key={p.id} className="text-[11px] text-digi-muted px-2 py-1 border border-digi-border/30" style={mf}>
                      #{p.id} — {p.title}
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: Detalle + Totales */}
              <div className="space-y-2">
                <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5" style={pf}>Detalle</h4>
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                  {mItems.map((item, i) => (
                    <div key={i} className="border border-digi-border rounded-lg p-2">
                      <div className="flex gap-1 mb-1">
                        <input value={item.description} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], description: e.target.value }; setMItems(n); }}
                          placeholder="Descripcion" className="flex-1 px-2 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <button onClick={() => setMItems(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500/70 hover:text-red-600 text-[13px] px-1" style={pf}>X</button>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        <div>
                          <label className="text-[11px] text-digi-muted" style={pf}>Cant.</label>
                          <input value={item.quantity} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], quantity: e.target.value }; setMItems(n); }}
                            type="number" min="0.01" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        </div>
                        <div>
                          <label className="text-[11px] text-digi-muted" style={pf}>P.Unit.</label>
                          <input value={item.unitPrice} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setMItems(n); }}
                            type="number" min="0" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        </div>
                        <div>
                          <label className="text-[11px] text-digi-muted" style={pf}>IVA</label>
                          <select value={item.ivaRate} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], ivaRate: e.target.value }; setMItems(n); }}
                            className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                            <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-digi-muted" style={pf}>Desc.</label>
                          <input value={item.discount} onChange={e => { const n = [...mItems]; n[i] = { ...n[i], discount: e.target.value }; setMItems(n); }}
                            type="number" min="0" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setMItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
                  className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={pf}>+ Item</button>

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

            {/* Footer */}
            <div className="pt-3 mt-3 border-t border-digi-border space-y-2">
              {consumidorFinalOver50 && (
                <div className="px-3 py-2 border border-red-300 rounded bg-red-50 text-[12px] text-red-600" style={mf}>
                  El SRI requiere identificar al cliente (RUC o Cedula) en facturas mayores a $50.00. El total actual es ${fmt2(invoiceTotal)}. Cambia el tipo de identificacion.
                </div>
              )}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={mSendEmail} onChange={e => setMSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                  <span className="text-[12px] text-digi-muted" style={mf}>Enviar por correo</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setManualStep('projects')} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Atras</button>
                  {manualType === 'con_fallo' ? (
                    <button onClick={() => setManualStep('paid')} disabled={!isFormValid} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={pf}>
                      Siguiente
                    </button>
                  ) : (
                    <button onClick={handleManualSubmit} disabled={!isFormValid} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={pf}>
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
              <span className="text-[11px] px-1.5 py-0.5 border border-orange-500/40 text-orange-400" style={pf}>CON FALLO</span>
            </div>
            <p className="text-[10px] text-digi-muted" style={mf}>Ingresa el monto que el cliente envio (en USD). El descuento se distribuira proporcionalmente entre los requerimientos.</p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Total real de requerimientos (USD)</label>
                  <div className="px-3 py-2 bg-digi-darker border border-digi-border text-xs text-digi-text" style={mf}>
                    ${fmt2(itemsTotalUsd)}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-accent mb-0.5 block" style={pf}>Monto pagado por el cliente (USD) <span className="text-red-600">*</span></label>
                  <input value={mPaidAmount} onChange={e => setMPaidAmount(e.target.value)}
                    type="number" min="0.01" step="0.01" placeholder="0.00"
                    className="w-full px-3 py-2 bg-digi-darker border-2 border-accent/50 text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
                </div>
                {mCurrency !== 'USD' && Number(mPaidAmount) > 0 && (
                  <div className="px-2 py-1.5 border border-accent/30 rounded bg-accent-light text-[12px] text-accent" style={mf}>
                    En {mCurrency}: {currencies.find(c => c.code === mCurrency)?.symbol || ''}{fmt2((Number(mPaidAmount) * (Number(mExchangeRate) || 1)))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {Number(mPaidAmount) > 0 && Number(mPaidAmount) < itemsTotalUsd && (
                  <>
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Descuento total a aplicar (USD)</label>
                      <div className="px-3 py-2 bg-red-50 border border-red-300 text-xs text-red-600 font-bold" style={mf}>
                        -${fmt2((itemsTotalUsd - Number(mPaidAmount)))}
                      </div>
                    </div>
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Distribucion por item</label>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {mItems.map((it, i) => {
                          const itemBase = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0);
                          const weight = itemsTotalUsd > 0 ? itemBase / itemsTotalUsd : 0;
                          const itemDiscount = Math.round((itemsTotalUsd - Number(mPaidAmount)) * weight * 100) / 100;
                          return (
                            <div key={i} className="flex justify-between text-[11px] px-2 py-1 border border-digi-border/30" style={mf}>
                              <span className="text-digi-muted truncate max-w-[60%]">{it.description || `Item ${i + 1}`}</span>
                              <span className="text-red-600">-${fmt2(itemDiscount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
                {Number(mPaidAmount) > 0 && Number(mPaidAmount) >= itemsTotalUsd && (
                  <div className="px-3 py-2 border border-amber-300 bg-amber-50 text-[11px] text-amber-700" style={mf}>
                    El monto pagado es igual o mayor al total. No se aplicara descuento. Usa el tipo "Completo" en su lugar.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-digi-border">
              <button onClick={() => setManualStep('form')} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Atras</button>
              <button onClick={applyDiscountsAndSubmit}
                disabled={!Number(mPaidAmount) || Number(mPaidAmount) <= 0 || Number(mPaidAmount) >= itemsTotalUsd}
                className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={pf}>
                Generar Factura con Descuento
              </button>
            </div>
          </div>
        ) : null}
      </PixelModal>
    </div>
  );
}
