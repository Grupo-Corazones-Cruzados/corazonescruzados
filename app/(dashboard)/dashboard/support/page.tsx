'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';

const TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Abiertos' },
  { value: 'in_progress', label: 'En Proceso' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'closed', label: 'Cerrados' },
];

const TYPE_LABELS: Record<string, string> = {
  bug: 'Error', feature: 'Sugerencia', question: 'Pregunta', other: 'Otro',
};

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [tab, setTab] = useState('all');

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    try {
      const res = await fetch(`/api/support?${params}`);
      const data = await res.json();
      setTickets(data.data || []);
    } catch { setTickets([]); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <PageHeader title="Soporte" description="Tickets de soporte y ayuda" />

      <PixelTabs tabs={TABS} active={tab} onChange={setTab} />

      <PixelDataTable
        columns={[
          { key: 'id', header: 'ID', render: (t: any) => `#${t.id}`, width: '60px' },
          { key: 'type', header: 'Tipo', render: (t: any) => (
            <PixelBadge variant="info">{TYPE_LABELS[t.type] || t.type}</PixelBadge>
          )},
          { key: 'subject', header: 'Asunto', render: (t: any) => t.subject },
          { key: 'status', header: 'Estado', render: (t: any) => (
            <PixelBadge variant={STATUS_V[t.status] || 'default'}>{t.status}</PixelBadge>
          )},
          { key: 'replies', header: 'Respuestas', render: (t: any) => t.reply_count || 0 },
          { key: 'date', header: 'Fecha', render: (t: any) => new Date(t.created_at).toLocaleDateString() },
        ]}
        data={tickets}
        onRowClick={(t: any) => router.push(`/dashboard/support/${t.id}`)}
        emptyTitle="Sin tickets"
        emptyDesc="No hay tickets de soporte aun."
      />
    </div>
  );
}
