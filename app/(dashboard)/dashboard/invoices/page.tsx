'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';

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
          { key: 'number', header: 'Factura', render: (i: any) => i.invoice_number || `#${i.id}`, width: '100px' },
          { key: 'client', header: 'Cliente', render: (i: any) => i.client_name || '-' },
          { key: 'total', header: 'Total', render: (i: any) => `$${Number(i.total || 0).toFixed(2)}` },
          { key: 'status', header: 'Estado', render: (i: any) => (
            <PixelBadge variant={STATUS_V[i.status] || 'default'}>{i.status}</PixelBadge>
          )},
          { key: 'date', header: 'Fecha', render: (i: any) => i.created_at ? new Date(i.created_at).toLocaleDateString() : '-' },
        ]}
        data={invoices}
        onRowClick={(i: any) => router.push(`/dashboard/invoices/${i.id}`)}
        emptyTitle="Sin facturas"
        emptyDesc="No hay facturas registradas aun."
      />
    </div>
  );
}
