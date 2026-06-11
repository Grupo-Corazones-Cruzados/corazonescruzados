'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: 'var(--font-display)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada',
};
const SRI_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  generated: 'default', signed: 'info', sent: 'info', authorized: 'success', rejected: 'error', error: 'error',
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
        <h1 className="pixel-heading text-lg text-digi-text">{invoice.invoice_number || `Factura #${invoice.id}`}</h1>
        <div className="flex gap-2">
          {invoice.sri_status && <PixelBadge variant={SRI_V[invoice.sri_status] || 'default'}>SRI: {invoice.sri_status}</PixelBadge>}
          <PixelBadge variant={STATUS_V[invoice.status] || 'default'}>{STATUS_LABEL[invoice.status] || invoice.status}</PixelBadge>
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
                    <td className="px-4 py-2 text-right text-digi-text" style={mf}>${Number(item.subtotal || (Number(item.quantity) * Number(item.unit_price))).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-digi-border">
                  <td colSpan={4} className="px-4 py-2 text-right text-[9px] text-digi-muted" style={pf}>Subtotal</td>
                  <td className="px-4 py-2 text-right text-digi-text" style={mf}>${subtotal.toFixed(2)}</td>
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
                  <p className="text-[7px] text-digi-text break-all leading-relaxed mb-1" style={mf}>{invoice.access_key}</p>
                  <button onClick={() => { navigator.clipboard.writeText(invoice.access_key); toast.success('Clave copiada'); }}
                    className="text-[7px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>Copiar clave</button>
                </div>
                {invoice.authorization_number && (
                  <div>
                    <label className="text-[8px] text-digi-muted block mb-0.5" style={pf}>No. Autorizacion</label>
                    <p className="text-[7px] text-digi-text break-all leading-relaxed mb-1" style={mf}>{invoice.authorization_number}</p>
                    <button onClick={() => { navigator.clipboard.writeText(invoice.authorization_number); toast.success('Autorizacion copiada'); }}
                      className="text-[7px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>Copiar autorizacion</button>
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
                  {isAdmin && (
                    <>
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
                </>
              )}
              {invoice.sri_status === 'voided' && (
                <>
                  <p className="text-[9px] text-red-400 text-center py-2" style={mf}>Factura anulada</p>
                  {isAdmin && (
                    <button onClick={() => router.push(`/dashboard/invoices?refactor=${id}`)}
                      className="w-full py-1.5 text-[9px] text-yellow-400 border border-yellow-500/40 hover:bg-yellow-900/20 transition-colors" style={pf}>
                      Refacturar
                    </button>
                  )}
                </>
              )}
              {(invoice.sri_status === 'rejected' || invoice.sri_status === 'error') && isAdmin && (
                <>
                  <div className="px-2 py-1.5 border border-red-700/50 bg-red-900/10 text-[8px] text-red-400 leading-relaxed" style={mf}>
                    {(() => {
                      try {
                        const r = typeof invoice.sri_response === 'string' ? JSON.parse(invoice.sri_response) : invoice.sri_response;
                        const msgs = r?.comprobantes?.[0]?.mensajes || r?.mensajes;
                        if (Array.isArray(msgs) && msgs.length > 0) return msgs.map((m: any) => m.mensaje || m.informacionAdicional).filter(Boolean).join(' · ');
                      } catch {}
                      return typeof invoice.sri_response === 'string' ? invoice.sri_response : 'Factura rechazada por el SRI';
                    })()}
                  </div>
                  {invoice.sri_status === 'error' && (
                    <button onClick={handleResendToSri} disabled={resendingSri}
                      className="w-full py-1.5 text-[9px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors disabled:opacity-50" style={pf}>
                      {resendingSri ? 'Reenviando...' : 'Reenviar al SRI'}
                    </button>
                  )}
                  <button onClick={openEditModal}
                    className="w-full py-1.5 text-[9px] text-yellow-400 border border-yellow-500/40 hover:bg-yellow-900/20 transition-colors" style={pf}>
                    Editar y Reintentar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Payment Proof */}
          {isAdmin && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Comprobante de Pago</h3>
              {invoice.has_payment_proof ? (
                <div className="space-y-1.5">
                  <button onClick={() => setShowProof(true)}
                    className="w-full py-1.5 text-[9px] text-green-400 border border-green-500/30 hover:bg-green-900/20 transition-colors" style={pf}>
                    Ver Comprobante
                  </button>
                  <button onClick={() => window.open(`/api/invoices/${id}/proof`, '_blank')}
                    className="w-full py-1.5 text-[9px] text-accent-glow border border-accent/30 hover:bg-accent/10 transition-colors" style={pf}>
                    Abrir en Nueva Pestaña
                  </button>
                  <label className="block w-full py-1.5 text-[9px] text-digi-muted border border-digi-border hover:text-digi-text hover:border-accent/30 transition-colors text-center cursor-pointer" style={pf}>
                    {uploadingProof ? 'Subiendo...' : 'Reemplazar'}
                    <input type="file" accept="image/*" onChange={handleUploadProof} className="hidden" disabled={uploadingProof} />
                  </label>
                  <button onClick={handleDeleteProof}
                    className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>
                    Eliminar Comprobante
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[9px] text-digi-muted" style={mf}>Sin comprobante adjunto</p>
                  <label className="block w-full py-2 text-[9px] text-accent-glow border-2 border-dashed border-accent/30 hover:bg-accent/5 transition-colors text-center cursor-pointer" style={pf}>
                    {uploadingProof ? 'Subiendo...' : 'Adjuntar Imagen'}
                    <input type="file" accept="image/*" onChange={handleUploadProof} className="hidden" disabled={uploadingProof} />
                  </label>
                  <p className="text-[7px] text-digi-muted" style={mf}>JPG, PNG, WEBP o GIF</p>
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
            <button onClick={() => setShowVoid(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors" style={pf}>Cancelar</button>
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

      {/* Edit & Retry Modal */}
      <PixelModal open={showEdit} onClose={() => !editing && setShowEdit(false)} title="Editar y Reintentar Factura" size="lg">
        <div className="space-y-4">
          <div className="px-3 py-2 border border-yellow-700/50 bg-yellow-900/10 text-[9px] text-yellow-400" style={mf}>
            Corrige los datos del cliente o de los items. Se generará una nueva clave de acceso con un nuevo secuencial y se reenviará al SRI automáticamente.
          </div>

          <div>
            <h4 className="text-[10px] text-accent-glow mb-2" style={pf}>Cliente</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Tipo ID</label>
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
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>RUC / Cédula</label>
                <input value={editForm.clientRuc} onChange={e => setEditForm({ ...editForm, clientRuc: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="col-span-2">
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Razón Social / Nombre</label>
                <input value={editForm.clientName} onChange={e => setEditForm({ ...editForm, clientName: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Email</label>
                <input value={editForm.clientEmail} onChange={e => setEditForm({ ...editForm, clientEmail: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Teléfono</label>
                <input value={editForm.clientPhone} onChange={e => setEditForm({ ...editForm, clientPhone: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
              <div className="col-span-2">
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Dirección</label>
                <input value={editForm.clientAddress} onChange={e => setEditForm({ ...editForm, clientAddress: e.target.value })}
                  className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[10px] text-accent-glow" style={pf}>Items</h4>
              <button onClick={() => setEditForm({ ...editForm, items: [...editForm.items, { description: '', quantity: 1, unitPrice: 0, ivaRate: 15 }] })}
                className="text-[8px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>+ Item</button>
            </div>
            <div className="space-y-2">
              {editForm.items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1 items-start">
                  <input value={it.description} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, description: e.target.value };
                    setEditForm({ ...editForm, items });
                  }} placeholder="Descripción"
                    className="col-span-5 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  <input type="number" step="0.01" value={it.quantity} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, quantity: Number(e.target.value) };
                    setEditForm({ ...editForm, items });
                  }} placeholder="Cant"
                    className="col-span-2 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  <input type="number" step="0.01" value={it.unitPrice} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, unitPrice: Number(e.target.value) };
                    setEditForm({ ...editForm, items });
                  }} placeholder="P.Unit"
                    className="col-span-2 px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  <select value={it.ivaRate} onChange={e => {
                    const items = [...editForm.items]; items[idx] = { ...it, ivaRate: Number(e.target.value) };
                    setEditForm({ ...editForm, items });
                  }} className="col-span-2 px-1 py-1.5 bg-digi-darker border-2 border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={15}>15%</option>
                  </select>
                  <button onClick={() => setEditForm({ ...editForm, items: editForm.items.filter((_, i) => i !== idx) })}
                    className="col-span-1 py-1.5 text-[10px] text-red-400 border-2 border-red-700/50 hover:bg-red-900/20" style={pf}>×</button>
                </div>
              ))}
              {editForm.items.length === 0 && (
                <p className="text-[9px] text-digi-muted text-center py-2" style={mf}>Sin items. Agrega al menos uno.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setShowEdit(false)} disabled={editing} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors disabled:opacity-50" style={pf}>Cancelar</button>
            <button onClick={handleRegenerate} disabled={editing || editForm.items.length === 0 || !editForm.clientName.trim()}
              className="px-4 py-2 text-[9px] border-2 border-yellow-700 bg-yellow-900/30 text-yellow-400 hover:bg-yellow-900/50 transition-colors disabled:opacity-50" style={pf}>
              {editing ? 'Regenerando...' : 'Regenerar y Reenviar'}
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
            <button onClick={() => setShowResend(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors" style={pf}>Cancelar</button>
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
