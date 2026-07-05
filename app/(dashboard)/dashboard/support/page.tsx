'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY } from '@/components/ui/Button';
import { LifeBuoy, DoorOpen, Loader, CheckCircle2, Archive, X, ArrowRight } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todos', Icon: LifeBuoy },
  { value: 'open', label: 'Abiertos', Icon: DoorOpen },
  { value: 'in_progress', label: 'En proceso', Icon: Loader },
  { value: 'resolved', label: 'Resueltos', Icon: CheckCircle2 },
  { value: 'closed', label: 'Cerrados', Icon: Archive },
];

const TYPE_LABELS: Record<string, string> = { bug: 'Error', feature: 'Sugerencia', question: 'Pregunta', other: 'Otro' };
const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En proceso', resolved: 'Resuelto', closed: 'Cerrado',
};
const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500', warning: 'bg-amber-500', error: 'bg-red-500', info: 'bg-accent', default: 'bg-digi-muted',
};

export default function SupportPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<any>(null);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    try {
      const res = await fetch(`/api/support?${params}`);
      const data = await res.json();
      setTickets(data.data || []);
      setCounts(data.counts || {});
    } catch { setTickets([]); }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSelected(null); }, [tab]);

  return (
    <div>
      <PageHeader title="Soporte" description="Tickets de soporte y su seguimiento" />

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

        {/* ── Right region: list · panel ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                singleLine
                data={tickets}
                onRowClick={(t: any) => setSelected(t)}
                emptyTitle="Sin tickets"
                emptyDesc="No hay tickets de soporte en este estado."
                columns={[
                  { key: 'id', header: 'ID', width: '56px', render: (t: any) => <span className="tabular-nums text-digi-muted">#{t.id}</span> },
                  { key: 'subject', header: 'Asunto', render: (t: any) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <span title={STATUS_LABEL[t.status] || t.status} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[STATUS_V[t.status] || 'default']}`} />
                      <span className={`truncate text-[13px] font-medium ${selected?.id === t.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{t.subject}</span>
                    </span>
                  ) },
                  { key: 'type', header: 'Tipo', width: '130px', render: (t: any) => <span className="text-[12px] text-digi-muted" style={mf}>{TYPE_LABELS[t.type] || t.type}</span> },
                  { key: 'replies', header: 'Respuestas', width: '100px', render: (t: any) => <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{t.reply_count || 0}</span> },
                  { key: 'date', header: 'Fecha', width: '110px', render: (t: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(t.created_at).toLocaleDateString('es-EC')}</span> },
                ]}
              />
            </div>

            {/* ── Detail preview panel ── */}
            <aside className="w-full xl:w-[340px]">
              {!selected ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <LifeBuoy className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un ticket para ver un resumen.</p>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.subject}</h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Ticket #{selected.id}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {[
                      ['Estado', <PixelBadge key="s" variant={STATUS_V[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>],
                      ['Tipo', TYPE_LABELS[selected.type] || selected.type],
                      ['Respuestas', String(selected.reply_count || 0)],
                      ['Fecha', new Date(selected.created_at).toLocaleDateString('es-EC')],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-digi-muted" style={mf}>{k}</span>
                        <span className="text-digi-text text-right" style={mf}>{v}</span>
                      </div>
                    ))}
                    {selected.message && <p className="text-[12px] text-digi-text leading-relaxed line-clamp-3" style={mf}>{selected.message}</p>}
                    <button onClick={() => router.push(`/dashboard/support/${selected.id}`)} className={`${BTN_PRIMARY} w-full mt-1`}>
                      Ver ticket <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
