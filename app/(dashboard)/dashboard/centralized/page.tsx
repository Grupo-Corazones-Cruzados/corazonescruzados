'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import Link from 'next/link';
import SystemsTab from '@/components/centralized/SystemsTab';
import AccessTab from '@/components/centralized/AccessTab';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const ALL_TABS = [
  { value: 'structure', label: 'Estructura' },
  { value: 'systems', label: 'Sistemas', adminOnly: true },
  { value: 'access', label: 'Accesos' },
  { value: 'requests', label: 'Solicitudes' },
  { value: 'reports', label: 'Denuncias' },
];

const STRUCTURE_COLUMNS = [
  { label: 'Fundamentación', key: 'fundamentacion' },
  { label: 'Creación', key: 'creacion' },
  { label: 'Implementación', key: 'implementacion' },
  { label: 'Gestión', key: 'gestion' },
];
const STRUCTURE_ROWS = [
  { title: 'Global', piso: 'global', cells: ['Condiciología', 'Control Psicosocial', 'Centralizado', 'Gestión Psicosocial'] },
  { title: 'Pilar', piso: 'pilar', cells: ['Academia', 'Tecnología', 'Organización', 'Publicación'] },
  { title: 'Controlador', piso: 'controlador', cells: ['Conocimiento', 'Herramientas', 'Estrategias', 'Soluciones'] },
  { title: 'Colaborador', piso: 'colaborador', cells: ['Investigador', 'Desarrollador', 'Planificador', 'Líder'] },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'success', rejected: 'error',
  exit_no_fee: 'success', exit_with_fee: 'warning',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado',
  exit_no_fee: 'Salida sin cuota', exit_with_fee: 'Salida con cuota',
};
const TYPE_LABEL: Record<string, string> = {
  withdrawal: 'Desistimiento', supervised_exit: 'Salida Supervisada',
};

export default function CentralizedPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('structure');
  const [requests, setRequests] = useState<any[]>([]);
  const [allSystems, setAllSystems] = useState<any[]>([]);

  // Admin review modal
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

  const fetchSystems = useCallback(async () => {
    try {
      const res = await fetch('/api/centralized/systems');
      const data = await res.json();
      setAllSystems(data.data || []);
    } catch { setAllSystems([]); }
  }, []);

  useEffect(() => { fetchRequests(); fetchSystems(); }, [fetchRequests, fetchSystems]);

  const getSystemsFor = (piso: string, paso: string) =>
    allSystems.filter((s: any) => s.piso === piso && s.paso === paso && s.is_active);

  const isAdmin = user?.role === 'admin';
  const tabs = ALL_TABS.filter((t) => !('adminOnly' in t) || isAdmin).map(({ value, label }) => ({ value, label }));

  const handleReview = async (status: string) => {
    if (!selectedReq) return;
    setReviewing(true);
    try {
      const res = await fetch(`/api/projects/${selectedReq.project_id}/requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: selectedReq.id, status, review_note: reviewNote, fee_amount: feeAmount ? Number(feeAmount) : null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Solicitud revisada');
      setReviewModal(false);
      fetchRequests();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setReviewing(false); }
  };

  if (!user?.member_id && user?.role !== 'admin') {
    return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-digi-muted">Solo disponible para miembros</p></div>;
  }

  return (
    <div>
      <PageHeader title="Proyecto Centralizado" description="Movimiento Organizacional" />
      <PixelTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'structure' ? (
        <div className="pixel-card p-4 md:p-6 overflow-x-auto">
          {/* Column headers */}
          <div className="grid grid-cols-[100px_repeat(4,1fr)] md:grid-cols-[140px_repeat(4,1fr)] gap-2 mb-2 min-w-[600px]">
            <div />
            {STRUCTURE_COLUMNS.map((col) => (
              <div key={col.key} className="text-center py-2 px-1 border border-accent/40 bg-accent/10">
                <span className="text-[9px] md:text-[11px] text-accent-glow uppercase tracking-wider" style={pf}>{col.label}</span>
              </div>
            ))}
          </div>

          {/* Rows */}
          {STRUCTURE_ROWS.map((row) => (
            <div key={row.title} className="grid grid-cols-[100px_repeat(4,1fr)] md:grid-cols-[140px_repeat(4,1fr)] gap-2 mb-2 min-w-[600px]">
              {/* Row title */}
              <div className="flex items-center justify-center py-3 px-2 border border-accent/40 bg-accent/10">
                <span className="text-[9px] md:text-[11px] text-accent-glow uppercase tracking-wider text-center" style={pf}>{row.title}</span>
              </div>
              {/* Cells with systems */}
              {row.cells.map((cell, i) => {
                const paso = STRUCTURE_COLUMNS[i].key;
                const cellSystems = getSystemsFor(row.piso, paso);
                return (
                  <div
                    key={`${row.title}-${i}`}
                    className="flex flex-col border border-digi-border/50 bg-digi-darker hover:border-accent/60 hover:bg-accent/5 transition-all cursor-default group"
                  >
                    <div className="flex items-center justify-center py-2.5 px-2">
                      <span className="text-[10px] md:text-xs text-digi-text group-hover:text-accent-glow transition-colors text-center font-bold" style={mf}>{cell}</span>
                    </div>
                    {cellSystems.length > 0 && (
                      <div className="border-t border-digi-border/30 px-2 py-1.5 space-y-0.5">
                        {cellSystems.map((sys: any) => (
                          <div key={sys.id} className="flex items-center gap-1">
                            <span className="text-[6px] text-accent-glow">&#9654;</span>
                            <span className="text-[8px] md:text-[9px] text-digi-muted group-hover:text-digi-text transition-colors" style={mf}>{sys.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : tab === 'systems' && isAdmin ? (
        <SystemsTab />
      ) : tab === 'access' ? (
        <AccessTab isAdmin={isAdmin} />
      ) : tab === 'requests' ? (
        <PixelDataTable
          columns={[
            { key: 'id', header: 'ID', render: (r: any) => `#${r.id}`, width: '60px' },
            ...(isAdmin ? [{ key: 'member', header: 'Miembro', render: (r: any) => (
              <div className="flex items-center gap-1.5">
                {r.photo_url ? (
                  <img src={r.photo_url} alt={r.member_name} className="w-5 h-5 rounded-full object-cover border border-digi-border" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center">
                    <span className="text-[7px] text-accent-glow" style={pf}>{r.member_name?.charAt(0)}</span>
                  </div>
                )}
                <span className="text-[10px] text-digi-text" style={mf}>{r.member_name}</span>
              </div>
            ), width: '140px' }] : []),
            { key: 'project', header: 'Proyecto', render: (r: any) => (
              <Link href={`/dashboard/projects/${r.project_id}`} className="text-accent-glow hover:underline text-[10px]" style={mf}>
                {r.project_title}
              </Link>
            )},
            { key: 'type', header: 'Tipo', render: (r: any) => (
              <PixelBadge variant={r.type === 'withdrawal' ? 'info' : 'warning'}>
                {TYPE_LABEL[r.type] || r.type}
              </PixelBadge>
            ), width: '140px' },
            { key: 'status', header: 'Estado', render: (r: any) => (
              <PixelBadge variant={STATUS_V[r.status] || 'default'}>
                {STATUS_LABEL[r.status] || r.status}
              </PixelBadge>
            ), width: '130px' },
            { key: 'date', header: 'Fecha', render: (r: any) => (
              <span className="text-[10px] text-digi-muted" style={mf}>
                {new Date(r.created_at).toLocaleDateString('es-EC')}
              </span>
            ), width: '100px' },
            ...(isAdmin ? [{ key: 'actions', header: '', width: '80px', render: (r: any) => (
              r.status === 'pending' && r.type === 'supervised_exit' ? (
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedReq(r); setReviewNote(''); setFeeAmount(''); setReviewModal(true); }}
                  className="text-[9px] text-accent-glow border border-accent/40 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                  style={pf}
                >
                  Revisar
                </button>
              ) : null
            )}] : []),
          ]}
          data={requests}
          emptyTitle="Sin solicitudes"
          emptyDesc="No hay solicitudes registradas."
        />
      ) : (
        <div className="pixel-card text-center py-12">
          <p className="text-sm text-digi-muted" style={pf}>Proximamente</p>
          <p className="text-[10px] text-digi-muted mt-1" style={mf}>El modulo de denuncias estara disponible pronto.</p>
        </div>
      )}

      {/* Admin Review Modal */}
      <PixelModal open={reviewModal} onClose={() => !reviewing && setReviewModal(false)} title="Revisar Salida Supervisada">
        {selectedReq && (
          <div className="space-y-3">
            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Miembro</span>
              <span className="text-white">{selectedReq.member_name}</span>
            </div>
            <div className="flex justify-between text-[10px] py-1 border-b border-digi-border/30" style={mf}>
              <span className="text-digi-muted">Proyecto</span>
              <span className="text-white">{selectedReq.project_title}</span>
            </div>
            <div>
              <span className="text-[9px] text-digi-muted block mb-1" style={pf}>Motivo del miembro</span>
              <p className="text-[10px] text-digi-text p-2 bg-digi-darker border border-digi-border" style={mf}>{selectedReq.reason}</p>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Nota del revisor</label>
              <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2}
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
            </div>
            <PixelInput label="Cuota de perjuicio (USD, opcional)" type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0.00" />
            <div className="flex gap-2">
              <button onClick={() => handleReview('exit_no_fee')} disabled={reviewing}
                className="flex-1 pixel-btn pixel-btn-primary text-[9px] disabled:opacity-50">
                {reviewing ? '...' : 'Salida sin Cuota'}
              </button>
              <button onClick={() => handleReview('exit_with_fee')} disabled={reviewing || !feeAmount}
                className="flex-1 py-2 text-[9px] text-yellow-400 border border-yellow-500/30 hover:bg-yellow-900/20 transition-colors disabled:opacity-50" style={pf}>
                {reviewing ? '...' : 'Salida con Cuota'}
              </button>
            </div>
          </div>
        )}
      </PixelModal>
    </div>
  );
}
