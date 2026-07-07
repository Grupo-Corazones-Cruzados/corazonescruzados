'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import {
  REQUEST_STATUS_VARIANT as STATUS_V,
  REQUEST_STATUS_LABEL as STATUS_LABEL,
  REQUEST_TYPE_LABEL as TYPE_LABEL,
} from '@/lib/centralized/systems';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Sistema "Solicitudes y Denuncias" (celda Centralizado / Global · Implementación).
 * Solicitudes de desistimiento / salida supervisada de proyectos; el admin revisa
 * las salidas supervisadas. Denuncias: próximamente.
 */
export default function SolicitudesSystem({ isAdmin }: { isAdmin: boolean }) {
  const [subTab, setSubTab] = useState('requests');
  const [requests, setRequests] = useState<any[]>([]);

  const [reviewModal, setReviewModal] = useState(false);
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      setRequests(data.data || []);
    } catch { setRequests([]); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleReview = async (status: string) => {
    if (!selectedReq) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/projects/${selectedReq.project_id}/requests`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: selectedReq.id, status, review_note: reviewNote, fee_amount: feeAmount ? Number(feeAmount) : null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Solicitud revisada');
      setReviewModal(false);
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setReviewing(false); }
  };

  return (
    <div>
      <PixelTabs
        tabs={[{ value: 'requests', label: 'Solicitudes' }, { value: 'reports', label: 'Denuncias' }]}
        active={subTab}
        onChange={setSubTab}
      />

      {subTab === 'requests' ? (
        <PixelDataTable
          columns={[
            { key: 'id', header: 'ID', render: (r: any) => `#${r.id}`, width: '60px' },
            ...(isAdmin ? [{ key: 'member', header: 'Miembro', width: '160px', render: (r: any) => (
              <div className="flex items-center gap-2">
                {r.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo_url} alt={r.member_name} className="w-6 h-6 rounded-full object-cover border border-digi-border" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                    <span className="text-[9px] text-accent font-semibold">{r.member_name?.charAt(0)}</span>
                  </div>
                )}
                <span className="text-[12px] text-digi-text" style={mf}>{r.member_name}</span>
              </div>
            ) }] : []),
            { key: 'project', header: 'Proyecto', render: (r: any) => (
              <Link href={`/dashboard/projects/${r.project_id}`} className="text-accent hover:underline text-[12px]" style={mf}>
                {r.project_title}
              </Link>
            ) },
            { key: 'type', header: 'Tipo', width: '150px', render: (r: any) => (
              <PixelBadge variant={r.type === 'withdrawal' ? 'info' : 'warning'}>{TYPE_LABEL[r.type] || r.type}</PixelBadge>
            ) },
            { key: 'status', header: 'Estado', width: '140px', render: (r: any) => (
              <PixelBadge variant={STATUS_V[r.status] || 'default'}>{STATUS_LABEL[r.status] || r.status}</PixelBadge>
            ) },
            { key: 'date', header: 'Fecha', width: '110px', render: (r: any) => (
              <span className="text-[12px] text-digi-muted" style={mf}>{new Date(r.created_at).toLocaleDateString('es-EC')}</span>
            ) },
            ...(isAdmin ? [{ key: 'actions', header: '', width: '90px', render: (r: any) => (
              r.status === 'pending' && r.type === 'supervised_exit' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedReq(r); setReviewNote(''); setFeeAmount(''); setReviewModal(true); }}
                  className="text-[11px] text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent-light transition-colors"
                  style={mf}
                >
                  Revisar
                </button>
              ) : null
            ) }] : []),
          ]}
          data={requests}
          emptyTitle="Sin solicitudes"
          emptyDesc="No hay solicitudes registradas."
        />
      ) : (
        <div className="bg-digi-card border border-digi-border rounded-xl py-12 text-center">
          <p className="text-sm text-digi-text font-semibold" style={mf}>Próximamente</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>El módulo de denuncias estará disponible pronto.</p>
        </div>
      )}

      {/* Review (Solicitudes) */}
      <PixelModal open={reviewModal} onClose={() => !reviewing && setReviewModal(false)} title="Revisar Salida Supervisada">
        {selectedReq && (
          <div className="space-y-3">
            <div className="flex justify-between text-[12px] py-1 border-b border-digi-border/60" style={mf}>
              <span className="text-digi-muted">Miembro</span><span className="text-digi-text">{selectedReq.member_name}</span>
            </div>
            <div className="flex justify-between text-[12px] py-1 border-b border-digi-border/60" style={mf}>
              <span className="text-digi-muted">Proyecto</span><span className="text-digi-text">{selectedReq.project_title}</span>
            </div>
            <div>
              <span className="text-[12px] font-medium text-digi-muted block mb-1" style={mf}>Motivo del miembro</span>
              <p className="text-[12px] text-digi-text p-2 bg-digi-darker border border-digi-border rounded-md" style={mf}>{selectedReq.reason}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[12px] font-medium text-digi-muted" style={mf}>Nota del revisor</label>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2}
                className="field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
            </div>
            <PixelInput label="Cuota de perjuicio (USD, opcional)" type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0.00" />
            <div className="flex gap-2">
              <button onClick={() => handleReview('exit_no_fee')} disabled={reviewing}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
                {reviewing ? '...' : 'Salida sin Cuota'}
              </button>
              <button onClick={() => handleReview('exit_with_fee')} disabled={reviewing || !feeAmount}
                className="flex-1 py-2 text-sm text-amber-700 border border-amber-400/50 rounded hover:bg-amber-50 transition-colors disabled:opacity-50" style={mf}>
                {reviewing ? '...' : 'Salida con Cuota'}
              </button>
            </div>
          </div>
        )}
      </PixelModal>
    </div>
  );
}
