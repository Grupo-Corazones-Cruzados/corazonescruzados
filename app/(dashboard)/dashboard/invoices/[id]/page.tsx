'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';
import DetailHeader from '@/components/ui/DetailHeader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { Download, Mail, RefreshCw, Pencil, Copy, KeyRound, FileCheck2, FileText, Plus, X } from 'lucide-react';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { fmt2 } from '@/lib/format';
import { SRI_MAX } from '@/lib/integrations/sri/text';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error', failed: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada', failed: 'Fallida',
};
const SRI_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  generated: 'default', signed: 'info', sent: 'info', authorized: 'success', rejected: 'error', error: 'error',
};
const SRI_LABEL: Record<string, string> = {
  generated: 'Generada', signed: 'Firmada', sent: 'Enviada', authorized: 'Autorizada',
  rejected: 'Rechazada', error: 'Error', voided: 'Anulada',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [sriItems, setSriItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResend, setShowResend] = useState(false);
  const [resendEmails, setResendEmails] = useState('');
  // DETALLE DE SERVICIOS: documento informativo con conceptos que NO se facturan
  // (transferencias, remesas…). No es un comprobante; ver lib/documents/detalle-servicios.ts.
  const [showDetalle, setShowDetalle] = useState(false);
  const [detalleItems, setDetalleItems] = useState<{ description: string; quantity: string; unitPrice: string }[]>([]);
  const [detalleNotas, setDetalleNotas] = useState('');
  const [detalleFacturados, setDetalleFacturados] = useState<any[]>([]);
  const [detalleExiste, setDetalleExiste] = useState(false);
  const [guardandoDetalle, setGuardandoDetalle] = useState(false);
  const [sending, setSending] = useState(false);
  const [showVoid, setShowVoid] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editing, setEditing] = useState(false);
  const [resendingSri, setResendingSri] = useState(false);
  const [editForm, setEditForm] = useState<{
    clientIdType: string;
    clientRuc: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string;
    items: { description: string; quantity: number; unitPrice: number; ivaRate: number }[];
  }>({ clientIdType: '05', clientRuc: '', clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', items: [] });

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

  const isAdmin = user?.role === 'admin';

  const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/invoices/${id}/proof`, { method: 'POST', body: formData });
      if (res.ok) {
        toast.success('Comprobante adjuntado');
        fetchInvoice();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Error al subir');
      }
    } catch { toast.error('Error al subir comprobante'); }
    finally { setUploadingProof(false); e.target.value = ''; }
  };

  /** Trae lo guardado del documento y los ítems reales de la factura, y abre el panel. */
  const abrirDetalle = async () => {
    try {
      const r = await fetch(`/api/invoices/${id}/detail-doc`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo cargar');
      setDetalleFacturados(d.invoiceItems || []);
      setDetalleExiste(!!d.data);
      setDetalleItems((d.data?.items || []).map((i: any) => ({
        description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice),
      })));
      setDetalleNotas(d.data?.notes || '');
      if (!d.data) setDetalleItems([{ description: '', quantity: '1', unitPrice: '' }]);
      setShowDetalle(true);
    } catch (e: any) { toast.error(e.message); }
  };

  const guardarDetalle = async () => {
    const items = detalleItems
      .map(i => ({ description: i.description.trim(), quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitPrice) || 0 }))
      .filter(i => i.description && i.quantity > 0);
    if (items.length === 0) { toast.error('Añade al menos un concepto'); return; }
    setGuardandoDetalle(true);
    try {
      const r = await fetch(`/api/invoices/${id}/detail-doc`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, notes: detalleNotas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      setDetalleExiste(true);
      toast.success('Detalle de servicios guardado');
      window.open(`/api/invoices/${id}/detail-doc/pdf`, '_blank');
      setShowDetalle(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setGuardandoDetalle(false); }
  };

  const borrarDetalle = async () => {
    setGuardandoDetalle(true);
    try {
      const r = await fetch(`/api/invoices/${id}/detail-doc`, { method: 'DELETE' });
      if (!r.ok) throw new Error('No se pudo eliminar');
      setDetalleExiste(false);
      setShowDetalle(false);
      toast.success('Detalle de servicios eliminado');
    } catch (e: any) { toast.error(e.message); }
    finally { setGuardandoDetalle(false); }
  };

  const openEditModal = () => {
    const inferredIdType = (invoice.client_ruc && invoice.client_ruc.length === 13) ? '04' : '05';
    setEditForm({
      clientIdType: inferredIdType,
      clientRuc: invoice.client_ruc || '',
      clientName: invoice.client_name_sri || '',
      clientEmail: invoice.client_email_sri || '',
      clientPhone: invoice.client_phone_sri || '',
      clientAddress: invoice.client_address_sri || '',
      items: (sriItems.length > 0 ? sriItems : []).map((it: any) => ({
        description: it.description,
        quantity: Number(it.quantity),
        unitPrice: Number(it.unit_price),
        ivaRate: Number(it.iva_rate || 0),
      })),
    });
    setShowEdit(true);
  };

  const handleRegenerate = async () => {
    if (!editForm.clientName.trim() || editForm.items.length === 0) {
      toast.error('Datos incompletos');
      return;
    }
    setEditing(true);
    try {
      const res = await fetch(`/api/invoices/${id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, retry: true }),
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        toast.success('Factura autorizada por el SRI');
        setShowEdit(false);
        fetchInvoice();
      } else if (res.ok && !data.authorized) {
        toast.error(data.error || 'SRI rechazó nuevamente la factura');
        fetchInvoice();
      } else {
        toast.error(data.error || 'Error al regenerar');
      }
    } catch { toast.error('Error de conexión'); }
    finally { setEditing(false); }
  };

  const handleResendToSri = async () => {
    setResendingSri(true);
    try {
      const res = await fetch(`/api/invoices/${id}/send-sri`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.authorized) {
        toast.success('Factura autorizada por el SRI');
        fetchInvoice();
      } else if (res.ok && !data.authorized) {
        toast.error(data.error || 'SRI rechazó la factura');
        fetchInvoice();
      } else {
        toast.error(data.error || 'Error al reenviar al SRI');
        fetchInvoice();
      }
    } catch { toast.error('Error de conexión'); }
    finally { setResendingSri(false); }
  };

  const handleDeleteProof = async () => {
    try {
      const res = await fetch(`/api/invoices/${id}/proof`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Comprobante eliminado');
        setShowProof(false);
        fetchInvoice();
      }
    } catch { toast.error('Error al eliminar'); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando factura..." /></div>;
  if (!invoice) return <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center"><p className="text-sm font-semibold text-red-600">Factura no encontrada</p></div>;

  // Use SRI items if available, fallback to regular items
  const items = sriItems.length > 0 ? sriItems : (invoice.items || []);
  const subtotal = items.reduce((s: number, i: any) => s + Number(i.subtotal || (Number(i.quantity) * Number(i.unit_price))), 0);
  const totalIva = items.reduce((s: number, i: any) => s + Number(i.iva_amount || 0), 0);
  const total = Number(invoice.total) || (subtotal + totalIva);

  return (
    <div>
      <DetailHeader
        breadcrumb={{ label: 'Facturas', href: '/dashboard/invoices' }}
        title={invoice.invoice_number || `Factura #${invoice.id}`}
        status={
          <span className="flex items-center gap-2">
            {invoice.sri_status && <PixelBadge variant={SRI_V[invoice.sri_status] || 'default'}>SRI: {SRI_LABEL[invoice.sri_status] || invoice.sri_status}</PixelBadge>}
            <PixelBadge variant={STATUS_V[invoice.status] || 'default'}>{STATUS_LABEL[invoice.status] || invoice.status}</PixelBadge>
          </span>
        }
        actions={
          <>
            {invoice.sri_status === 'authorized' && (
              <button onClick={() => window.open(`/api/invoices/${id}/pdf`, '_blank')} className={BTN_PRIMARY}><Download className="w-4 h-4" /> Descargar PDF</button>
            )}
            {invoice.sri_status === 'authorized' && isAdmin && (
              <button onClick={() => { setResendEmails(invoice.client_email_sri || ''); setShowResend(true); }} className={BTN_SECONDARY}><Mail className="w-4 h-4" /> Reenviar</button>
            )}
            {invoice.sri_status === 'error' && isAdmin && (
              <button onClick={handleResendToSri} disabled={resendingSri} className={BTN_SECONDARY}><RefreshCw className="w-4 h-4" /> {resendingSri ? 'Reenviando...' : 'Reenviar al SRI'}</button>
            )}
            {(invoice.sri_status === 'rejected' || invoice.sri_status === 'error') && isAdmin && (
              <button onClick={openEditModal} className={BTN_SECONDARY}><Pencil className="w-4 h-4" /> Editar y reintentar</button>
            )}
            {invoice.sri_status === 'voided' && isAdmin && (
              <button onClick={() => router.push(`/dashboard/invoices?refactor=${id}`)} className={BTN_SECONDARY}>Refacturar</button>
            )}
            {isAdmin && (
              <button onClick={abrirDetalle} className={BTN_SECONDARY}>
                <FileText className="w-4 h-4" /> Detalle de servicios
              </button>
            )}
          </>
        }
        overflow={[
          ...(invoice.sri_status === 'authorized' && isAdmin ? [{ label: 'Anular factura', onClick: () => setShowVoid(true), danger: true }] : []),
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
        {/* ─── Items table ─── */}
        <div className="min-w-0 space-y-4">
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-digi-border">
                  <th className="text-left px-4 py-2.5 text-[11px] text-digi-muted uppercase" style={pf}>Descripcion</th>
                  <th className="text-center px-2 py-2.5 text-[11px] text-digi-muted uppercase" style={pf}>Cant.</th>
                  <th className="text-right px-2 py-2.5 text-[11px] text-digi-muted uppercase" style={pf}>P.Unit.</th>
                  <th className="text-right px-2 py-2.5 text-[11px] text-digi-muted uppercase" style={pf}>IVA</th>
                  <th className="text-right px-4 py-2.5 text-[11px] text-digi-muted uppercase" style={pf}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-4 text-center text-digi-muted text-[11px]" style={mf}>Sin items</td></tr>
                ) : items.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="border-b border-digi-border/30">
                    <td className="px-4 py-2 text-digi-text" style={mf}>{item.description}</td>
                    <td className="px-2 py-2 text-center text-digi-muted" style={mf}>{fmt2(Number(item.quantity))}</td>
                    <td className="px-2 py-2 text-right text-digi-muted" style={mf}>${fmt2(Number(item.unit_price))}</td>
                    <td className="px-2 py-2 text-right text-digi-muted" style={mf}>{Number(item.iva_rate || 0)}%</td>
                    <td className="px-4 py-2 text-right text-digi-text" style={mf}>${fmt2(Number(item.subtotal || (Number(item.quantity) * Number(item.unit_price))))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-digi-border">
                  <td colSpan={4} className="px-4 py-2 text-right text-[11px] text-digi-muted" style={pf}>Subtotal</td>
                  <td className="px-4 py-2 text-right text-digi-text" style={mf}>${fmt2(subtotal)}</td>
                </tr>
                {totalIva > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-1 text-right text-[11px] text-digi-muted" style={pf}>IVA</td>
                    <td className="px-4 py-1 text-right text-digi-muted" style={mf}>${fmt2(totalIva)}</td>
                  </tr>
                )}
                <tr className="border-t border-digi-border">
                  <td colSpan={4} className="px-4 py-2 text-right text-[12px] font-semibold text-digi-text" style={pf}>Total</td>
                  <td className="px-4 py-2 text-right text-sm text-accent font-bold" style={mf}>${fmt2(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ─── Right rail ─── */}
        <div className="space-y-4 lg:sticky lg:top-4">
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
            <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3" style={pf}>Detalles</h3>
            <div className="space-y-2 text-[12px]" style={mf}>
              <DetailRow label="Cliente" value={invoice.client_name_sri || invoice.client_name || '-'} />
              <DetailRow label="RUC/CI" value={invoice.client_ruc || '-'} />
              <DetailRow label="Email" value={invoice.client_email_sri || '-'} />
              <DetailRow label="Creado" value={new Date(invoice.created_at).toLocaleDateString()} />
              {invoice.authorization_date && <DetailRow label="Autorizado" value={new Date(invoice.authorization_date).toLocaleDateString()} />}
            </div>
          </div>

          {/* SRI error */}
          {(invoice.sri_status === 'rejected' || invoice.sri_status === 'error') && isAdmin && (
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
              <h3 className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-2" style={pf}>Rechazo del SRI</h3>
              <div className="px-2.5 py-2 rounded border border-red-300 bg-red-50 text-[11px] text-red-600 leading-relaxed" style={mf}>
                {(() => {
                  try {
                    const r = typeof invoice.sri_response === 'string' ? JSON.parse(invoice.sri_response) : invoice.sri_response;
                    const msgs = r?.comprobantes?.[0]?.mensajes || r?.mensajes;
                    if (Array.isArray(msgs) && msgs.length > 0) return msgs.map((m: any) => m.mensaje || m.informacionAdicional).filter(Boolean).join(' · ');
                  } catch {}
                  return typeof invoice.sri_response === 'string' ? invoice.sri_response : 'Factura rechazada por el SRI';
                })()}
              </div>
            </div>
          )}

          {/* SRI Info */}
          {invoice.access_key && (
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
              <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3 flex items-center gap-1.5" style={pf}><KeyRound className="w-3.5 h-3.5" /> SRI</h3>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-digi-muted block mb-0.5" style={pf}>Clave de Acceso</label>
                  <p className="text-[11px] text-digi-text break-all leading-relaxed mb-1" style={mf}>{invoice.access_key}</p>
                  <button onClick={() => { navigator.clipboard.writeText(invoice.access_key); toast.success('Clave copiada'); }}
                    className="inline-flex items-center gap-1 text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors" style={pf}><Copy className="w-3 h-3" /> Copiar clave</button>
                </div>
                {invoice.authorization_number && (
                  <div>
                    <label className="text-[11px] text-digi-muted block mb-0.5" style={pf}>No. Autorizacion</label>
                    <p className="text-[11px] text-digi-text break-all leading-relaxed mb-1" style={mf}>{invoice.authorization_number}</p>
                    <button onClick={() => { navigator.clipboard.writeText(invoice.authorization_number); toast.success('Autorizacion copiada'); }}
                      className="inline-flex items-center gap-1 text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors" style={pf}><Copy className="w-3 h-3" /> Copiar autorización</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {invoice.sri_status === 'voided' && (
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4 text-center">
              <p className="text-[12px] text-red-600 font-medium" style={mf}>Factura anulada</p>
            </div>
          )}

          {/* Payment Proof */}
          {isAdmin && (
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
              <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3 flex items-center gap-1.5" style={pf}><FileCheck2 className="w-3.5 h-3.5" /> Comprobante de pago</h3>
              {invoice.has_payment_proof ? (
                <div className="space-y-1.5">
                  <button onClick={() => setShowProof(true)}
                    className="w-full py-2 text-sm font-medium rounded text-green-600 border border-green-300 hover:bg-green-50 transition-colors" style={pf}>
                    Ver Comprobante
                  </button>
                  <button onClick={() => window.open(`/api/invoices/${id}/proof`, '_blank')}
                    className="w-full py-2 text-sm font-medium rounded text-accent border border-accent/40 hover:bg-accent-light transition-colors" style={pf}>
                    Abrir en Nueva Pestaña
                  </button>
                  <label className="block w-full py-2 text-sm font-medium rounded text-digi-muted border border-digi-border hover:text-digi-text hover:border-accent/30 transition-colors text-center cursor-pointer" style={pf}>
                    {uploadingProof ? 'Subiendo...' : 'Reemplazar'}
                    <input type="file" accept="image/*" onChange={handleUploadProof} className="hidden" disabled={uploadingProof} />
                  </label>
                  <button onClick={handleDeleteProof}
                    className="w-full py-2 text-sm font-medium rounded text-red-600 border border-red-300 hover:bg-red-50 transition-colors" style={pf}>
                    Eliminar Comprobante
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-digi-muted" style={mf}>Sin comprobante adjunto</p>
                  <label className="block w-full py-2 text-sm font-medium rounded text-accent border-2 border-dashed border-accent/30 hover:bg-accent-light transition-colors text-center cursor-pointer" style={pf}>
                    {uploadingProof ? 'Subiendo...' : 'Adjuntar Imagen'}
                    <input type="file" accept="image/*" onChange={handleUploadProof} className="hidden" disabled={uploadingProof} />
                  </label>
                  <p className="text-[11px] text-digi-muted" style={mf}>JPG, PNG, WEBP o GIF</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Proof Modal */}
      <PixelModal open={showProof} onClose={() => setShowProof(false)} title="Comprobante de Pago" size="lg">
        <div className="flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/invoices/${id}/proof`} alt="Comprobante de pago" className="max-w-full max-h-[75vh] object-contain" />
        </div>
      </PixelModal>

      {/* ── DETALLE DE SERVICIOS ──────────────────────────────────────────────────
          Formulario con lista → panel lateral derecho, que es lo que manda el sistema.
          Los ítems facturados se enseñan pero NO se editan: si hubiera que cambiarlos,
          lo que se corrige es la factura, no este papel. */}
      <EditPanel
        open={showDetalle}
        title="Detalle de servicios"
        onClose={() => !guardandoDetalle && setShowDetalle(false)}
        onSave={guardarDetalle}
        saving={guardandoDetalle}
        canSave={detalleItems.some(i => i.description.trim() && Number(i.quantity) > 0)}
        saveLabel="Guardar y descargar"
        danger={detalleExiste ? { label: 'Eliminar documento', onClick: borrarDetalle } : undefined}
      >
        <EditField label="Qué es este documento" hint={
          <>Un papel informativo para el cliente que lo pide: reúne los ítems de la factura y los
          conceptos que tú no facturas. <strong>No es un comprobante</strong>: el válido sigue
          siendo la factura, que aparece referenciada arriba del documento. Se descarga y se
          envía a mano.</>
        }>
          <div className={`${EDIT_INPUT} text-[12.5px] leading-relaxed opacity-80`}>
            Referencia: {invoice.invoice_number || `#${id}`} · {detalleFacturados.length} ítems facturados
            por ${fmt2(detalleFacturados.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0))}
          </div>
        </EditField>

        <div>
          <label className="text-[12px] font-semibold text-digi-text opacity-70 mb-1.5 block" style={pf}>
            Conceptos adicionales
          </label>
          <div className="space-y-2">
            {detalleItems.map((it, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <input value={it.description} placeholder="Transferencias internacionales"
                    onChange={e => { const n = [...detalleItems]; n[i] = { ...n[i], description: e.target.value }; setDetalleItems(n); }}
                    className={EDIT_INPUT} />
                </div>
                <div className="w-16 shrink-0">
                  <input value={it.quantity} type="number" min="0" step="1" placeholder="1"
                    onChange={e => { const n = [...detalleItems]; n[i] = { ...n[i], quantity: e.target.value }; setDetalleItems(n); }}
                    className={`${EDIT_INPUT} tabular-nums`} />
                </div>
                <div className="w-24 shrink-0">
                  <input value={it.unitPrice} type="number" min="0" step="0.01" placeholder="0.00"
                    onChange={e => { const n = [...detalleItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setDetalleItems(n); }}
                    className={`${EDIT_INPUT} tabular-nums`} />
                </div>
                <button type="button" onClick={() => setDetalleItems(detalleItems.filter((_, idx) => idx !== i))}
                  disabled={detalleItems.length <= 1}
                  className="mb-1.5 text-red-500/70 hover:text-red-600 disabled:opacity-30 shrink-0" title="Quitar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button"
              onClick={() => setDetalleItems([...detalleItems, { description: '', quantity: '1', unitPrice: '' }])}
              className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={pf}>
              <Plus className="w-3.5 h-3.5" /> Añadir concepto
            </button>
          </div>
        </div>

        <EditField label="Observaciones">
          <input value={detalleNotas} onChange={e => setDetalleNotas(e.target.value)}
            placeholder="Opcional: una línea que verá el cliente" className={EDIT_INPUT} />
        </EditField>

        {/* Las tres cifras, como en el documento */}
        {(() => {
          const facturado = detalleFacturados.reduce((s: number, i: any) => s + Number(i.subtotal || 0), 0);
          const adicional = detalleItems.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
          return (
            <div className="border border-digi-border rounded-lg p-3 text-[12.5px] space-y-1" style={mf}>
              <div className="flex justify-between"><span className="text-digi-muted">Total facturado</span><span className="text-digi-text tabular-nums">${fmt2(facturado)}</span></div>
              <div className="flex justify-between"><span className="text-digi-muted">Total adicional</span><span className="text-digi-text tabular-nums">${fmt2(adicional)}</span></div>
              <div className="flex justify-between border-t border-digi-border pt-1">
                <span className="text-accent font-semibold">Total general</span>
                <span className="text-accent font-semibold tabular-nums">${fmt2(facturado + adicional)}</span>
              </div>
            </div>
          );
        })()}

        {detalleExiste && (
          <button type="button" onClick={() => window.open(`/api/invoices/${id}/detail-doc/pdf`, '_blank')}
            className={`${BTN_SECONDARY} w-full`}>
            <Download className="w-4 h-4" /> Descargar el documento guardado
          </button>
        )}
      </EditPanel>

      {/* Void Modal */}
      <PixelModal open={showVoid} onClose={() => setShowVoid(false)} title="Anular Factura" size="sm">
        <div className="space-y-3">
          <div className="px-3 py-2 border border-red-300 bg-red-50 text-[11px] text-red-600" style={mf}>
            Se emitira una Nota de Credito ante el SRI por el valor total de la factura. Esta accion no se puede deshacer.
          </div>
          <div>
            <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Motivo de anulacion <span className="text-red-600">*</span></label>
            <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
              placeholder="Ej: Error en los datos del comprobante"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setShowVoid(false)} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Cancelar</button>
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
            }} disabled={voiding || !voidReason.trim()} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors disabled:opacity-50" style={pf}>
              {voiding ? 'Procesando...' : 'Confirmar Anulacion'}
            </button>
          </div>
        </div>
      </PixelModal>

      {/* Edit & Retry Modal */}
      <PixelModal open={showEdit} onClose={() => !editing && setShowEdit(false)} title="Editar y Reintentar Factura" size="lg">
        <div className="space-y-4">
          <div className="px-3 py-2 rounded border border-amber-300 bg-amber-50 text-[11px] text-amber-700" style={mf}>
            Corrige los datos del cliente o de los items. Se generará una nueva clave de acceso con un nuevo secuencial y se reenviará al SRI automáticamente.
          </div>

          <div>
            <h4 className="text-[12px] font-semibold text-digi-text mb-2" style={pf}>Cliente</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Tipo ID</label>
                <select value={editForm.clientIdType} onChange={e => setEditForm({ ...editForm, clientIdType: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  <option value="04">RUC</option>
                  <option value="05">Cédula</option>
                  <option value="06">Pasaporte</option>
                  <option value="07">Consumidor Final</option>
                  <option value="08">Identificación del Exterior</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>RUC / Cédula</label>
                <input value={editForm.clientRuc} onChange={e => setEditForm({ ...editForm, clientRuc: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Razón Social / Nombre</label>
                <input value={editForm.clientName} onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div>
                <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Email</label>
                <input value={editForm.clientEmail} onChange={e => setEditForm({ ...editForm, clientEmail: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div>
                <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Teléfono</label>
                <input value={editForm.clientPhone} onChange={e => setEditForm({ ...editForm, clientPhone: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Dirección</label>
                <input value={editForm.clientAddress} onChange={e => setEditForm({ ...editForm, clientAddress: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[12px] font-semibold text-digi-text" style={pf}>Items</h4>
              <button onClick={() => setEditForm({ ...editForm, items: [...editForm.items, { description: '', quantity: 1, unitPrice: 0, ivaRate: 15 }] })}
                className="text-[11px] text-accent border border-accent/40 px-2 py-0.5 hover:bg-accent-light transition-colors" style={pf}>+ Item</button>
            </div>
            <div className="space-y-2">
              {editForm.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-start">
                  <div className="col-span-5">
                    <input value={it.description} onChange={e => {
                      const items = [...editForm.items]; items[idx] = { ...it, description: e.target.value };
                      setEditForm({ ...editForm, items });
                    }} placeholder="Descripción"
                      className={`w-full px-2 py-1.5 bg-digi-darker border-2 text-[12px] text-digi-text focus:border-accent focus:outline-none ${
                        it.description.length > SRI_MAX.descripcion ? 'border-red-500' : 'border-digi-border'}`} style={mf} />
                    {/* El XSD del SRI limita la descripción a 300; pasarse hace que DEVUELVA
                        la factura con "ARCHIVO NO CUMPLE ESTRUCTURA XML". */}
                    {it.description.length > SRI_MAX.descripcion && (
                      <p className="mt-0.5 text-[10px] text-red-400" style={mf}>
                        {it.description.length}/{SRI_MAX.descripcion} — el SRI no acepta más de {SRI_MAX.descripcion}; se enviará recortada
                      </p>
                    )}
                  </div>
                  <input type="number" step="0.01" value={it.quantity} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, quantity: Number(e.target.value) };
                    setEditForm({ ...editForm, items });
                  }} placeholder="Cant"
                    className="col-span-2 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  <input type="number" step="0.01" value={it.unitPrice} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, unitPrice: Number(e.target.value) };
                    setEditForm({ ...editForm, items });
                  }} placeholder="P.Unit"
                    className="col-span-2 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  <select value={it.ivaRate} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, ivaRate: Number(e.target.value) };
                    setEditForm({ ...editForm, items });
                  }} className="col-span-2 px-1 py-1.5 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={15}>15%</option>
                  </select>
                  <button onClick={() => setEditForm({ ...editForm, items: editForm.items.filter((_, i) => i !== idx) })}
                    className="col-span-1 py-1.5 text-[12px] text-red-600 border-2 border-red-300 hover:bg-red-50" style={pf}>×</button>
                </div>
              ))}
              {editForm.items.length === 0 && (
                <p className="text-[11px] text-digi-muted text-center py-2" style={mf}>Sin items. Agrega al menos uno.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setShowEdit(false)} disabled={editing} className="pixel-btn pixel-btn-secondary text-sm disabled:opacity-50" style={pf}>Cancelar</button>
            <button onClick={handleRegenerate} disabled={editing || editForm.items.length === 0 || !editForm.clientName.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={pf}>
              {editing ? 'Regenerando...' : 'Regenerar y Reenviar'}
            </button>
          </div>
        </div>
      </PixelModal>

      {/* Resend Modal */}
      <PixelModal open={showResend} onClose={() => setShowResend(false)} title="Reenviar Factura" size="sm">
        <div className="space-y-3">
          <p className="text-[11px] text-digi-muted" style={mf}>
            Ingresa los correos separados por punto y coma (;)
          </p>
          <div>
            <label className="text-[11px] text-digi-muted mb-0.5 block" style={pf}>Destinatarios</label>
            <textarea value={resendEmails} onChange={e => setResendEmails(e.target.value)} rows={3}
              placeholder="correo1@ejemplo.com; correo2@ejemplo.com"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setShowResend(false)} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Cancelar</button>
            <button onClick={handleResend} disabled={sending || !resendEmails.trim()} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none" style={pf}>
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
