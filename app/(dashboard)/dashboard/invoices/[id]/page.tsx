'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error',
};
const SRI_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  generated: 'default', signed: 'info', sent: 'info', authorized: 'success', rejected: 'error', error: 'error',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [sriItems, setSriItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResend, setShowResend] = useState(false);
  const [resendEmails, setResendEmails] = useState('');
  const [sending, setSending] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const fetchInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setInvoice(data);
      // Fetch SRI items
      if (data.id) {
        const itemsRes = await fetch(`/api/invoices/${id}/items`);
        if (itemsRes.ok) {
          const itemsData = await itemsRes.json();
          setSriItems(itemsData.data || []);
        }
      }
    } catch { toast.error('Error al cargar factura'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchInvoice(); }, [fetchInvoice]);

  const handleResend = async () => {
    setSending(true);
    try {
      const emails = resendEmails.split(';').map(e => e.trim()).filter(Boolean);
      const res = await fetch(`/api/invoices/${id}/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      if (res.ok) {
        toast.success(`Factura enviada a ${emails.length} destinatario(s)`);
        setShowResend(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al enviar');
      }
    } catch { toast.error('Error de conexion'); }
    finally { setSending(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando factura..." /></div>;
  if (!invoice) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-400">Factura no encontrada</p></div>;

  // Use SRI items if available, fallback to regular items
  const items = sriItems.length > 0 ? sriItems : (invoice.items || []);
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.subtotal || (Number(i.quantity) * Number(i.unit_price))), 0);
  const totalIva = items.reduce((s: number, i: any) => s + Number(i.iva_amount || 0), 0);
  const total = Number(invoice.total) || (subtotal + totalIva);

  return (
    <div className="max-w-5xl">
      <div className="mb-4">
        <Link href="/dashboard/invoices" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>&lt; Volver a facturas</Link>
      </div>

      <div className="flex items-start justify-between gap-3 mb-6">
        <h1 className="pixel-heading text-lg text-white">{invoice.invoice_number || `Factura #${invoice.id}`}</h1>
        <div className="flex gap-2">
          {invoice.sri_status && <PixelBadge variant={SRI_V[invoice.sri_status] || 'default'}>SRI: {invoice.sri_status}</PixelBadge>}
          <PixelBadge variant={STATUS_V[invoice.status] || 'default'}>{invoice.status}</PixelBadge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ─── Items table ─── */}
        <div className="md:col-span-2 space-y-4">
          <div className="pixel-card p-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-digi-border">
                  <th className="text-left px-4 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Descripcion</th>
                  <th className="text-center px-2 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Cant.</th>
                  <th className="text-right px-2 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>P.Unit.</th>
                  <th className="text-right px-2 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>IVA</th>
                  <th className="text-right px-4 py-2.5 text-[9px] text-digi-muted uppercase" style={pf}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-digi-muted text-[9px]" style={mf}>Sin items</td></tr>
                ) : items.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="border-b border-digi-border/30">
                    <td className="px-4 py-2 text-digi-text" style={mf}>{item.description}</td>
                    <td className="px-2 py-2 text-center text-digi-muted" style={mf}>{Number(item.quantity).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right text-digi-muted" style={mf}>${Number(item.unit_price).toFixed(2)}</td>
                    <td className="px-2 py-2 text-right text-digi-muted" style={mf}>{Number(item.iva_rate || 0)}%</td>
                    <td className="px-4 py-2 text-right text-white" style={mf}>${Number(item.subtotal || (Number(item.quantity) * Number(item.unit_price))).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-digi-border">
                  <td colSpan={4} className="px-4 py-2 text-right text-[9px] text-digi-muted" style={pf}>Subtotal</td>
                  <td className="px-4 py-2 text-right text-white" style={mf}>${subtotal.toFixed(2)}</td>
                </tr>
                {totalIva > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-1 text-right text-[9px] text-digi-muted" style={pf}>IVA</td>
                    <td className="px-4 py-1 text-right text-digi-muted" style={mf}>${totalIva.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="border-t border-digi-border">
                  <td colSpan={4} className="px-4 py-2 text-right text-[10px] text-accent-glow" style={pf}>Total</td>
                  <td className="px-4 py-2 text-right text-sm text-accent-glow font-bold" style={mf}>${total.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4">
          <div className="pixel-card">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Detalles</h3>
            <div className="space-y-2 text-[10px]" style={mf}>
              <DetailRow label="Cliente" value={invoice.client_name_sri || invoice.client_name || '-'} />
              <DetailRow label="RUC/CI" value={invoice.client_ruc || '-'} />
              <DetailRow label="Email" value={invoice.client_email_sri || '-'} />
              <DetailRow label="Creado" value={new Date(invoice.created_at).toLocaleDateString()} />
              {invoice.authorization_date && <DetailRow label="Autorizado" value={new Date(invoice.authorization_date).toLocaleDateString()} />}
            </div>
          </div>

          {/* SRI Info */}
          {invoice.access_key && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>SRI</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] text-digi-muted block mb-0.5" style={pf}>Clave de Acceso</label>
                  <div className="flex gap-1">
                    <input value={invoice.access_key} readOnly className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[8px] text-digi-text focus:outline-none" style={mf} />
                    <button onClick={() => { navigator.clipboard.writeText(invoice.access_key); toast.success('Copiado'); }}
                      className="px-2 py-1 text-[7px] border border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Copiar</button>
                  </div>
                </div>
                {invoice.authorization_number && (
                  <div>
                    <label className="text-[8px] text-digi-muted block mb-0.5" style={pf}>No. Autorizacion</label>
                    <div className="flex gap-1">
                      <input value={invoice.authorization_number} readOnly className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[8px] text-digi-text focus:outline-none" style={mf} />
                      <button onClick={() => { navigator.clipboard.writeText(invoice.authorization_number); toast.success('Copiado'); }}
                        className="px-2 py-1 text-[7px] border border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Copiar</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pixel-card">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Acciones</h3>
            <div className="space-y-1.5">
              {invoice.sri_status === 'authorized' && (
                <>
                  <button onClick={() => window.open(`/api/invoices/${id}/pdf`, '_blank')}
                    className="w-full py-1.5 text-[9px] text-green-400 border border-green-500/30 hover:bg-green-900/20 transition-colors" style={pf}>
                    Descargar PDF
                  </button>
                  <button onClick={() => { setResendEmails(invoice.client_email_sri || ''); setShowResend(true); }}
                    className="w-full py-1.5 text-[9px] text-accent-glow border border-accent/30 hover:bg-accent/10 transition-colors" style={pf}>
                    Reenviar por Correo
                  </button>
                  <button onClick={() => setShowVoid(true)}
                    className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
                    Anular Factura
                  </button>
                </>
              )}
              {invoice.sri_status === 'voided' && (
                <p className="text-[9px] text-red-400 text-center py-2" style={mf}>Factura anulada</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Void Modal */}
      <PixelModal open={showVoid} onClose={() => setShowVoid(false)} title="Anular Factura" size="sm">
        <div className="space-y-3">
          <div className="px-3 py-2 border border-red-700/50 bg-red-900/10 text-[9px] text-red-400" style={mf}>
            Se emitira una Nota de Credito ante el SRI por el valor total de la factura. Esta accion no se puede deshacer.
          </div>
          <div>
            <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Motivo de anulacion <span className="text-red-400">*</span></label>
            <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
              placeholder="Ej: Error en los datos del comprobante"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setShowVoid(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
            <button onClick={async () => {
              if (!voidReason.trim()) return;
              setVoiding(true);
              try {
                const res = await fetch(`/api/invoices/${id}/void`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ motivo: voidReason }),
                });
                const data = await res.json();
                if (data.ok) {
                  toast.success(`Factura anulada — Nota de Credito: ${data.creditNote}`);
                  setShowVoid(false);
                  fetchInvoice();
                } else {
                  toast.error(data.error || 'Error al anular');
                }
              } catch { toast.error('Error de conexion'); }
              finally { setVoiding(false); }
            }} disabled={voiding || !voidReason.trim()} className="px-4 py-2 text-[9px] border-2 border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors disabled:opacity-50" style={pf}>
              {voiding ? 'Procesando...' : 'Confirmar Anulacion'}
            </button>
          </div>
        </div>
      </PixelModal>

      {/* Resend Modal */}
      <PixelModal open={showResend} onClose={() => setShowResend(false)} title="Reenviar Factura" size="sm">
        <div className="space-y-3">
          <p className="text-[9px] text-digi-muted" style={mf}>
            Ingresa los correos separados por punto y coma (;)
          </p>
          <div>
            <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Destinatarios</label>
            <textarea value={resendEmails} onChange={e => setResendEmails(e.target.value)} rows={3}
              placeholder="correo1@ejemplo.com; correo2@ejemplo.com"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setShowResend(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
            <button onClick={handleResend} disabled={sending || !resendEmails.trim()} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </PixelModal>
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
