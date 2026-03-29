'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';

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
  const router = useRouter();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');

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

  return (
    <div>
      <PageHeader title="Facturas" description="Gestiona tus facturas" />

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
          { key: 'number', header: 'No. Factura', render: (i: any) => <span className="text-white">{i.invoice_number || `#${i.id}`}</span>, width: '130px' },
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
    </div>
  );
}
