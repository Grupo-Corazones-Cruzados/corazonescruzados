'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setInvoice(data);
    } catch {
      toast.error('Error al cargar factura');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const updateStatus = async (status: string) => {
    const extra: any = {};
    if (status === 'sent') extra.sent_at = new Date().toISOString();
    if (status === 'paid') extra.paid_at = new Date().toISOString();
    try {
      await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      toast.success('Estado actualizado');
      fetchInvoice();
    } catch { toast.error('Error'); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando factura..." /></div>;
  if (!invoice) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-400">Factura no encontrada</p></div>;

  const items = invoice.items || [];
  const subtotal = items.reduce((sum: number, i: any) => sum + (Number(i.quantity) * Number(i.unit_price)), 0);
  const tax = Number(invoice.tax || 0);
  const total = subtotal + (subtotal * tax / 100);

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/dashboard/invoices" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>&lt; Volver a facturas</Link>
      </div>

      <PageHeader
        title={invoice.invoice_number || `Factura #${invoice.id}`}
        action={<PixelBadge variant={STATUS_V[invoice.status] || 'default'}>{invoice.status}</PixelBadge>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Items table */}
        <div className="md:col-span-2 space-y-4">
          <div className="pixel-card p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-digi-border">
                  <th className="text-left px-4 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Descripcion</th>
                  <th className="text-center px-3 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Cant.</th>
                  <th className="text-right px-3 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Precio</th>
                  <th className="text-right px-4 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} className="border-b border-digi-border/30">
                    <td className="px-4 py-2" style={mf}>{item.description}</td>
                    <td className="px-3 py-2 text-center text-digi-muted" style={mf}>{item.quantity}</td>
                    <td className="px-3 py-2 text-right text-digi-muted" style={mf}>${Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-4 py-2 text-right" style={mf}>${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-digi-border">
                  <td colSpan={3} className="px-4 py-2 text-right text-[9px] text-digi-muted" style={pf}>Subtotal</td>
                  <td className="px-4 py-2 text-right" style={mf}>${subtotal.toFixed(2)}</td>
                </tr>
                {tax > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-1 text-right text-[9px] text-digi-muted" style={pf}>Impuesto ({tax}%)</td>
                    <td className="px-4 py-1 text-right text-digi-muted" style={mf}>${(subtotal * tax / 100).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="border-t border-digi-border">
                  <td colSpan={3} className="px-4 py-2 text-right text-[10px] text-accent-glow" style={pf}>Total</td>
                  <td className="px-4 py-2 text-right text-sm text-white font-bold" style={mf}>${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {invoice.notes && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Notas</h3>
              <p className="text-xs text-digi-muted leading-relaxed whitespace-pre-wrap" style={mf}>{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="pixel-card">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Detalles</h3>
            <div className="space-y-2 text-[10px]" style={mf}>
              <DetailRow label="Cliente" value={invoice.client_name || '-'} />
              <DetailRow label="Creado" value={new Date(invoice.created_at).toLocaleDateString()} />
              <DetailRow label="Enviado" value={invoice.sent_at ? new Date(invoice.sent_at).toLocaleDateString() : '-'} />
              <DetailRow label="Pagado" value={invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : '-'} />
            </div>
          </div>

          {(user?.role === 'admin' || user?.role === 'member') && !['paid', 'cancelled'].includes(invoice.status) && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Acciones</h3>
              <div className="space-y-1.5">
                {invoice.status === 'pending' && (
                  <button onClick={() => updateStatus('sent')} className="pixel-btn pixel-btn-primary w-full text-[9px]">Marcar Enviada</button>
                )}
                {invoice.status === 'sent' && (
                  <button onClick={() => updateStatus('paid')} className="pixel-btn pixel-btn-primary w-full text-[9px]">Marcar Pagada</button>
                )}
                <button onClick={() => updateStatus('cancelled')} className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-digi-border/30 last:border-0">
      <span className="text-digi-muted">{label}</span>
      <span className="text-digi-text text-right">{value}</span>
    </div>
  );
}
