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
import AccessTab from '@/components/centralized/AccessTab';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const ALL_TABS = [
  { value: 'structure', label: 'Estructura' },
  { value: 'access', label: 'Accesos' },
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

  // System view
  const [activeSystem, setActiveSystem] = useState<any>(null);
  const [sysSubTab, setSysSubTab] = useState('');

  // Cell systems modal (admin)
  const [cellModal, setCellModal] = useState(false);
  const [cellPiso, setCellPiso] = useState('');
  const [cellPaso, setCellPaso] = useState('');
  const [cellLabel, setCellLabel] = useState('');
  const [sysName, setSysName] = useState('');
  const [sysDesc, setSysDesc] = useState('');
  const [editingSys, setEditingSys] = useState<any>(null);
  const [savingSys, setSavingSys] = useState(false);
  const [deletingSysId, setDeletingSysId] = useState<number | null>(null);

  // Share access modal
  const [shareModal, setShareModal] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareMembers, setShareMembers] = useState<any[]>([]); // all members
  const [shareSelected, setShareSelected] = useState<number[]>([]); // selected member ids to add
  const [shareExisting, setShareExisting] = useState<any[]>([]); // current access for this system
  const [sharing, setSharing] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

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

  const openCellModal = (piso: string, paso: string, label: string) => {
    setCellPiso(piso); setCellPaso(paso); setCellLabel(label);
    setSysName(''); setSysDesc(''); setEditingSys(null);
    setCellModal(true);
  };

  const handleSaveSys = async () => {
    if (!sysName.trim()) { toast.error('El nombre es requerido'); return; }
    setSavingSys(true);
    try {
      if (editingSys) {
        const res = await fetch(`/api/centralized/systems/${editingSys.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sysName, description: sysDesc }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast.success('Sistema actualizado');
      } else {
        const res = await fetch('/api/centralized/systems', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sysName, description: sysDesc, piso: cellPiso, paso: cellPaso }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast.success('Sistema creado');
      }
      setSysName(''); setSysDesc(''); setEditingSys(null);
      fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingSys(false); }
  };

  const handleDeleteSys = async (id: number) => {
    setDeletingSysId(id);
    try {
      const res = await fetch(`/api/centralized/systems/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Sistema eliminado');
      fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setDeletingSysId(null); }
  };

  const startEditSys = (sys: any) => {
    setEditingSys(sys); setSysName(sys.name); setSysDesc(sys.description || '');
  };

  const cancelEditSys = () => {
    setEditingSys(null); setSysName(''); setSysDesc('');
  };

  // Share access
  const openShareModal = async (sys: any) => {
    setShareSearch(''); setShareSelected([]); setShareModal(true);
    // Fetch members and existing access in parallel
    try {
      const [mRes, aRes] = await Promise.all([
        fetch('/api/admin/team'),
        fetch(`/api/centralized/access?system_id=${sys.id}`),
      ]);
      const mData = await mRes.json();
      const aData = await aRes.json();
      setShareMembers((mData.data || []).filter((m: any) => m.is_active));
      setShareExisting(aData.data || []);
    } catch { setShareMembers([]); setShareExisting([]); }
  };

  const toggleShareMember = (id: number) => {
    setShareSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleShare = async () => {
    if (!activeSystem || !shareSelected.length) return;
    setSharing(true);
    try {
      for (const memberId of shareSelected) {
        const res = await fetch('/api/centralized/access', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: memberId, system_ids: [activeSystem.id] }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      }
      toast.success(`Acceso compartido con ${shareSelected.length} miembro(s)`);
      setShareSelected([]);
      // Refresh existing access
      const aRes = await fetch(`/api/centralized/access?system_id=${activeSystem.id}`);
      const aData = await aRes.json();
      setShareExisting(aData.data || []);
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSharing(false); }
  };

  const handleRevokeShare = async (accessId: number) => {
    setRevokingId(accessId);
    try {
      const res = await fetch('/api/centralized/access', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_id: accessId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Acceso revocado');
      setShareExisting((prev) => prev.filter((a: any) => a.id !== accessId));
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setRevokingId(null); }
  };

  const filteredShareMembers = shareMembers.filter((m: any) => {
    const alreadyHas = shareExisting.some((a: any) => a.member_id === m.id);
    if (alreadyHas) return false;
    if (!shareSearch.trim()) return true;
    return m.name?.toLowerCase().includes(shareSearch.toLowerCase()) || m.email?.toLowerCase().includes(shareSearch.toLowerCase());
  });

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
      <PixelTabs tabs={tabs} active={tab} onChange={(t) => { setTab(t); setActiveSystem(null); }} />

      {tab === 'structure' && activeSystem ? (
        /* ── System View ── */
        <div>
          {/* Breadcrumb + Share */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              onClick={() => setActiveSystem(null)}
              className="text-[9px] text-accent-glow border border-accent/40 px-2 py-0.5 hover:bg-accent/10 transition-colors"
              style={pf}
            >
              ← Estructura
            </button>
            <span className="text-[9px] text-digi-muted" style={mf}>/</span>
            <span className="text-[9px] text-digi-muted" style={mf}>{activeSystem.cell_name}</span>
            <span className="text-[9px] text-digi-muted" style={mf}>/</span>
            <span className="text-[10px] text-accent-glow" style={pf}>{activeSystem.name}</span>
            {isAdmin && (
              <button
                onClick={() => openShareModal(activeSystem)}
                className="ml-auto text-[9px] text-digi-text border border-accent/40 px-3 py-1 hover:bg-accent/10 hover:text-accent-glow transition-colors flex items-center gap-1.5"
                style={pf}
              >
                <span className="text-[10px]">&#128279;</span> Compartir acceso
              </button>
            )}
          </div>

          {/* System-specific content */}
          {activeSystem.cell_name === 'Centralizado' && activeSystem.name === 'Solicitudes y Denuncias' ? (
            <div>
              <PixelTabs
                tabs={[
                  { value: 'requests', label: 'Solicitudes' },
                  { value: 'reports', label: 'Denuncias' },
                ]}
                active={sysSubTab || 'requests'}
                onChange={setSysSubTab}
              />
              {(sysSubTab || 'requests') === 'requests' ? (
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
            </div>
          ) : (
            /* Default: system without specific interface yet */
            <div className="pixel-card text-center py-12">
              <p className="text-sm text-accent-glow mb-1" style={pf}>{activeSystem.name}</p>
              {activeSystem.description && <p className="text-[10px] text-digi-muted mb-3" style={mf}>{activeSystem.description}</p>}
              <p className="text-[10px] text-digi-muted" style={mf}>La interfaz de este sistema estará disponible pronto.</p>
            </div>
          )}
        </div>
      ) : tab === 'structure' ? (
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
                    onClick={isAdmin ? () => openCellModal(row.piso, paso, cell) : undefined}
                    className={`flex flex-col border border-digi-border/50 bg-digi-darker hover:border-accent/60 hover:bg-accent/5 transition-all group ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-center justify-center py-2.5 px-2">
                      <span className="text-[10px] md:text-xs text-digi-text group-hover:text-accent-glow transition-colors text-center font-bold" style={mf}>{cell}</span>
                    </div>
                    {cellSystems.length > 0 && (
                      <div className="border-t border-digi-border/30 px-2 py-1.5 space-y-0.5">
                        {cellSystems.map((sys: any) => (
                          <div
                            key={sys.id}
                            onClick={(e) => { e.stopPropagation(); setActiveSystem(sys); setSysSubTab(''); }}
                            className="flex items-center gap-1 cursor-pointer hover:bg-accent/10 px-1 py-0.5 -mx-1 transition-colors rounded-sm"
                          >
                            <span className="text-[6px] text-accent-glow">&#9654;</span>
                            <span className="text-[8px] md:text-[9px] text-digi-muted hover:text-accent-glow transition-colors" style={mf}>{sys.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isAdmin && cellSystems.length === 0 && (
                      <div className="border-t border-digi-border/20 px-2 py-1 text-center">
                        <span className="text-[7px] text-digi-muted/50 group-hover:text-accent/40 transition-colors" style={pf}>+ sistemas</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : tab === 'access' ? (
        <AccessTab isAdmin={isAdmin} />
      ) : null}

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

      {/* Share Access Modal */}
      <PixelModal open={shareModal} onClose={() => !sharing && setShareModal(false)} title={`Compartir — ${activeSystem?.name || ''}`}>
        <div className="space-y-4">
          {/* Search + select members */}
          <div>
            <label className="text-[10px] text-accent-glow opacity-70 block mb-1.5" style={pf}>Agregar personas</label>
            <div className="border-2 border-digi-border bg-digi-darker focus-within:border-accent transition-colors">
              {/* Selected chips */}
              {shareSelected.length > 0 && (
                <div className="flex flex-wrap gap-1 px-2 pt-2">
                  {shareSelected.map((id) => {
                    const m = shareMembers.find((x: any) => x.id === id);
                    if (!m) return null;
                    return (
                      <span key={id} className="inline-flex items-center gap-1 bg-accent/20 border border-accent/40 px-2 py-0.5">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={m.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full bg-accent/40 flex items-center justify-center text-[6px] text-accent-glow" style={pf}>{m.name?.charAt(0)}</span>
                        )}
                        <span className="text-[9px] text-digi-text" style={mf}>{m.name}</span>
                        <button onClick={() => toggleShareMember(id)} className="text-[8px] text-digi-muted hover:text-red-400 ml-0.5">✕</button>
                      </span>
                    );
                  })}
                </div>
              )}
              {/* Search input */}
              <input
                type="text"
                value={shareSearch}
                onChange={(e) => setShareSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full px-3 py-2 bg-transparent text-sm text-digi-text focus:outline-none"
                style={mf}
              />
            </div>

            {/* Member suggestions dropdown */}
            {shareSearch.trim() && filteredShareMembers.length > 0 && (
              <div className="border border-digi-border/50 bg-digi-darker max-h-36 overflow-y-auto mt-1">
                {filteredShareMembers.map((m: any) => (
                  <div
                    key={m.id}
                    onClick={() => { toggleShareMember(m.id); setShareSearch(''); }}
                    className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/10 transition-colors border-b border-digi-border/20 last:border-b-0 ${
                      shareSelected.includes(m.id) ? 'bg-accent/10' : ''
                    }`}
                  >
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.name} className="w-5 h-5 rounded-full object-cover border border-digi-border" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center">
                        <span className="text-[7px] text-accent-glow" style={pf}>{m.name?.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-digi-text block" style={mf}>{m.name}</span>
                      {m.email && <span className="text-[8px] text-digi-muted block truncate" style={mf}>{m.email}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {shareSearch.trim() && filteredShareMembers.length === 0 && (
              <p className="text-[9px] text-digi-muted text-center py-2 mt-1" style={mf}>No se encontraron miembros</p>
            )}
          </div>

          {/* Share button */}
          {shareSelected.length > 0 && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full pixel-btn pixel-btn-primary text-[9px] disabled:opacity-50"
              style={pf}
            >
              {sharing ? 'Compartiendo...' : `Compartir con ${shareSelected.length} persona(s)`}
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-digi-border/30" />

          {/* People with access */}
          <div>
            <label className="text-[10px] text-accent-glow opacity-70 block mb-1.5" style={pf}>Personas con acceso</label>
            {shareExisting.length > 0 ? (
              <div className="border border-digi-border/50 bg-digi-darker max-h-48 overflow-y-auto">
                {shareExisting.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 px-3 py-2 border-b border-digi-border/20 last:border-b-0">
                    {a.photo_url ? (
                      <img src={a.photo_url} alt={a.member_name} className="w-6 h-6 rounded-full object-cover border border-digi-border" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center">
                        <span className="text-[8px] text-accent-glow" style={pf}>{a.member_name?.charAt(0)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-digi-text block" style={mf}>{a.member_name}</span>
                      <span className="text-[8px] text-digi-muted" style={mf}>
                        Desde {new Date(a.created_at).toLocaleDateString('es-EC')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRevokeShare(a.id)}
                      disabled={revokingId === a.id}
                      className="text-[8px] text-red-400 border border-red-500/30 px-2 py-0.5 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      style={pf}
                    >
                      {revokingId === a.id ? '...' : 'Quitar'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-digi-muted text-center py-4 border border-digi-border/30 bg-digi-darker" style={mf}>
                Nadie tiene acceso a este sistema aún.
              </p>
            )}
          </div>
        </div>
      </PixelModal>

      {/* Cell Systems Modal (admin) */}
      <PixelModal open={cellModal} onClose={() => { setCellModal(false); cancelEditSys(); }} title={`Sistemas — ${cellLabel}`}>
        <div className="space-y-3">
          {/* Existing systems list */}
          {getSystemsFor(cellPiso, cellPaso).length > 0 ? (
            <div className="border border-digi-border/50 bg-digi-darker max-h-52 overflow-y-auto">
              {getSystemsFor(cellPiso, cellPaso).map((sys: any) => (
                <div key={sys.id} className="flex items-center justify-between px-3 py-2 border-b border-digi-border/20 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] text-digi-text block" style={mf}>{sys.name}</span>
                    {sys.description && <span className="text-[8px] text-digi-muted block truncate" style={mf}>{sys.description}</span>}
                  </div>
                  <div className="flex gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={() => startEditSys(sys)}
                      className="text-[8px] text-accent-glow border border-accent/40 px-1.5 py-0.5 hover:bg-accent/10 transition-colors"
                      style={pf}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteSys(sys.id)}
                      disabled={deletingSysId === sys.id}
                      className="text-[8px] text-red-400 border border-red-500/30 px-1.5 py-0.5 hover:bg-red-900/20 transition-colors disabled:opacity-50"
                      style={pf}
                    >
                      {deletingSysId === sys.id ? '...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-digi-muted text-center py-3 border border-digi-border/30 bg-digi-darker" style={mf}>
              No hay sistemas registrados en esta celda.
            </p>
          )}

          {/* Create / Edit form */}
          <div className="border-t border-digi-border/30 pt-3">
            <p className="text-[9px] text-accent-glow mb-2" style={pf}>
              {editingSys ? 'Editar sistema' : 'Agregar sistema'}
            </p>
            <div className="space-y-2">
              <PixelInput label="Nombre" value={sysName} onChange={(e) => setSysName(e.target.value)} placeholder="Nombre del sistema" />
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripción (opcional)</label>
                <textarea
                  value={sysDesc} onChange={(e) => setSysDesc(e.target.value)} rows={2}
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none"
                  style={mf} placeholder="Descripción..."
                />
              </div>
              <div className="flex gap-2">
                {editingSys && (
                  <button onClick={cancelEditSys} className="pixel-btn pixel-btn-secondary text-[9px] flex-1" style={pf}>
                    Cancelar
                  </button>
                )}
                <button onClick={handleSaveSys} disabled={savingSys} className="pixel-btn pixel-btn-primary text-[9px] flex-1 disabled:opacity-50" style={pf}>
                  {savingSys ? '...' : editingSys ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
