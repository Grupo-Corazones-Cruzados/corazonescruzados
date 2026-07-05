'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import Link from 'next/link';
import {
  Layers, Globe, Landmark, ClipboardList, Wrench, Boxes, Users, Plus,
  Share2, Pencil, Trash2, Search, ChevronLeft, ArrowRight, Link2, X,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/* ── Modelo 4P ─────────────────────────────────────────────────────────── */
const PISOS = [
  { key: 'global', label: 'Global', Icon: Globe, hint: 'Sistemas fundamentales' },
  { key: 'pilar', label: 'Pilar', Icon: Landmark, hint: 'Proyectos aprobados' },
  { key: 'controlador', label: 'Controlador', Icon: ClipboardList, hint: 'Asignación de tareas' },
  { key: 'colaborador', label: 'Colaborador', Icon: Wrench, hint: 'Ejecución de tareas' },
] as const;
const PASOS = [
  { key: 'fundamentacion', label: 'Fundamentación' },
  { key: 'creacion', label: 'Creación' },
  { key: 'implementacion', label: 'Implementación' },
  { key: 'gestion', label: 'Gestión' },
] as const;
const PISO_LABEL: Record<string, string> = Object.fromEntries(PISOS.map((p) => [p.key, p.label]));
const PASO_LABEL: Record<string, string> = Object.fromEntries(PASOS.map((p) => [p.key, p.label]));
const CELL_MAP: Record<string, Record<string, string>> = {
  global: { fundamentacion: 'Condiciología', creacion: 'Control Psicosocial', implementacion: 'Centralizado', gestion: 'Gestión Psicosocial' },
  pilar: { fundamentacion: 'Academia', creacion: 'Tecnología', implementacion: 'Organización', gestion: 'Publicación' },
  controlador: { fundamentacion: 'Conocimiento', creacion: 'Herramientas', implementacion: 'Estrategias', gestion: 'Soluciones' },
  colaborador: { fundamentacion: 'Investigador', creacion: 'Desarrollador', implementacion: 'Planificador', gestion: 'Líder' },
};

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
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState<any[]>([]);
  const [allSystems, setAllSystems] = useState<any[]>([]);

  // Overview navigation
  const [scopePiso, setScopePiso] = useState<string>('all'); // rail selection
  const [pasoFilter, setPasoFilter] = useState<string>('');   // command-bar filter
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);        // system shown in detail panel

  // Drill-in system view
  const [activeSystem, setActiveSystem] = useState<any>(null);
  const [sysSubTab, setSysSubTab] = useState('');

  // System editor modal (create / edit)
  const [sysModal, setSysModal] = useState(false);
  const [editingSys, setEditingSys] = useState<any>(null);
  const [formPiso, setFormPiso] = useState('global');
  const [formPaso, setFormPaso] = useState('fundamentacion');
  const [sysName, setSysName] = useState('');
  const [sysDesc, setSysDesc] = useState('');
  const [savingSys, setSavingSys] = useState(false);

  // Share access modal
  const [shareModal, setShareModal] = useState(false);
  const [shareSearch, setShareSearch] = useState('');
  const [shareMembers, setShareMembers] = useState<any[]>([]);
  const [shareSelected, setShareSelected] = useState<number[]>([]);
  const [shareExisting, setShareExisting] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  // Admin review modal (Solicitudes)
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

  // Keep the detail panel in sync with the freshest data.
  useEffect(() => {
    if (!selected) return;
    const fresh = allSystems.find((s) => s.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [allSystems]); // eslint-disable-line react-hooks/exhaustive-deps

  const countByPiso = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of allSystems) m[s.piso] = (m[s.piso] || 0) + 1;
    return m;
  }, [allSystems]);

  const visibleSystems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSystems.filter((s) => {
      if (scopePiso !== 'all' && s.piso !== scopePiso) return false;
      if (pasoFilter && s.paso !== pasoFilter) return false;
      if (q && !(`${s.name} ${s.description || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allSystems, scopePiso, pasoFilter, search]);

  /* ── System CRUD ─────────────────────────────────────────────────────── */
  const openNewSystem = () => {
    setEditingSys(null);
    setFormPiso(scopePiso !== 'all' ? scopePiso : 'global');
    setFormPaso(pasoFilter || 'fundamentacion');
    setSysName(''); setSysDesc('');
    setSysModal(true);
  };
  const openEditSystem = (sys: any) => {
    setEditingSys(sys);
    setFormPiso(sys.piso); setFormPaso(sys.paso);
    setSysName(sys.name); setSysDesc(sys.description || '');
    setSysModal(true);
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
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Sistema actualizado');
      } else {
        const res = await fetch('/api/centralized/systems', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sysName, description: sysDesc, piso: formPiso, paso: formPaso }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Sistema creado');
      }
      setSysModal(false);
      await fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingSys(false); }
  };

  const handleDeleteSys = async (sys: any) => {
    if (!window.confirm(`¿Eliminar el sistema "${sys.name}"? Se revocarán todos sus accesos.`)) return;
    try {
      const res = await fetch(`/api/centralized/systems/${sys.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Sistema eliminado');
      if (selected?.id === sys.id) setSelected(null);
      await fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const handleToggleActive = async (sys: any) => {
    try {
      const res = await fetch(`/api/centralized/systems/${sys.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !sys.is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(sys.is_active ? 'Sistema desactivado' : 'Sistema activado');
      await fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  /* ── Share access ────────────────────────────────────────────────────── */
  const openShareModal = async (sys: any) => {
    setShareSearch(''); setShareSelected([]); setShareModal(true);
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
  const toggleShareMember = (id: number) =>
    setShareSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleShare = async () => {
    if (!selected || !shareSelected.length) return;
    setSharing(true);
    try {
      for (const memberId of shareSelected) {
        const res = await fetch('/api/centralized/access', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: memberId, system_ids: [selected.id] }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      toast.success(`Acceso compartido con ${shareSelected.length} miembro(s)`);
      setShareSelected([]);
      const aRes = await fetch(`/api/centralized/access?system_id=${selected.id}`);
      setShareExisting((await aRes.json()).data || []);
      fetchSystems();
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
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Acceso revocado');
      setShareExisting((prev) => prev.filter((a: any) => a.id !== accessId));
      fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setRevokingId(null); }
  };

  const filteredShareMembers = shareMembers.filter((m: any) => {
    if (shareExisting.some((a: any) => a.member_id === m.id)) return false;
    if (!shareSearch.trim()) return true;
    return m.name?.toLowerCase().includes(shareSearch.toLowerCase()) || m.email?.toLowerCase().includes(shareSearch.toLowerCase());
  });

  /* ── Review (Solicitudes) ────────────────────────────────────────────── */
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

  if (!user?.member_id && user?.role !== 'admin') {
    return (
      <div className="pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-digi-muted">Solo disponible para miembros</p>
      </div>
    );
  }

  /* ═══════════════ Drill-in: single system view ═══════════════ */
  if (activeSystem) {
    return (
      <div>
        {/* Breadcrumb + command bar */}
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-digi-border flex-wrap">
          <button
            onClick={() => setActiveSystem(null)}
            className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors"
            style={mf}
          >
            <ChevronLeft className="w-4 h-4" /> Centralizado
          </button>
          <span className="text-digi-muted/50">/</span>
          <span className="text-[12px] text-digi-muted" style={mf}>{activeSystem.cell_name}</span>
          <span className="text-digi-muted/50">/</span>
          <span className="text-[13px] font-semibold text-digi-text" style={mf}>{activeSystem.name}</span>
          {isAdmin && (
            <button
              onClick={() => { setSelected(activeSystem); openShareModal(activeSystem); }}
              className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
              style={mf}
            >
              <Share2 className="w-3.5 h-3.5" /> Compartir acceso
            </button>
          )}
        </div>

        {activeSystem.cell_name === 'Centralizado' && activeSystem.name === 'Solicitudes y Denuncias' ? (
          <div>
            <PixelTabs
              tabs={[{ value: 'requests', label: 'Solicitudes' }, { value: 'reports', label: 'Denuncias' }]}
              active={sysSubTab || 'requests'}
              onChange={setSysSubTab}
            />
            {(sysSubTab || 'requests') === 'requests' ? (
              <PixelDataTable
                columns={[
                  { key: 'id', header: 'ID', render: (r: any) => `#${r.id}`, width: '60px' },
                  ...(isAdmin ? [{ key: 'member', header: 'Miembro', width: '160px', render: (r: any) => (
                    <div className="flex items-center gap-2">
                      {r.photo_url ? (
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
              <div className="pixel-card text-center py-12">
                <p className="text-sm text-digi-text font-semibold" style={mf}>Próximamente</p>
                <p className="text-[12px] text-digi-muted mt-1" style={mf}>El módulo de denuncias estará disponible pronto.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="pixel-card text-center py-16">
            <div className="w-12 h-12 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3">
              <Boxes className="w-6 h-6 text-accent" />
            </div>
            <p className="text-base text-digi-text font-semibold mb-1" style={mf}>{activeSystem.name}</p>
            {activeSystem.description && <p className="text-[12px] text-digi-muted mb-3 max-w-md mx-auto" style={mf}>{activeSystem.description}</p>}
            <p className="text-[12px] text-digi-muted" style={mf}>La interfaz de este sistema estará disponible pronto.</p>
          </div>
        )}

        {renderModals()}
      </div>
    );
  }

  /* ═══════════════ Overview: rail + list + detail panel ═══════════════ */
  const RailItem = ({ active, Icon, label, hint, count, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
        active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-[12.5px] font-medium truncate" style={mf}>{label}</span>
        {hint && <span className="block text-[10px] text-digi-muted truncate" style={mf}>{hint}</span>}
      </span>
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count}</span>
      )}
    </button>
  );

  return (
    <div>
      <PageHeader title="Proyecto Centralizado" description="Modelo 4P — sistemas fundamentales del grupo" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: Pisos ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Estructura 4P</p>
          <div className="space-y-0.5">
            <RailItem active={scopePiso === 'all'} Icon={Layers} label="Todos los sistemas"
              count={allSystems.length} onClick={() => setScopePiso('all')} />
            <div className="h-px bg-digi-border/60 my-1.5 mx-2" />
            <p className="text-[9px] font-semibold text-digi-muted/70 uppercase tracking-wider px-2 pb-1" style={df}>Pisos</p>
            {PISOS.map((p) => (
              <RailItem key={p.key} active={scopePiso === p.key} Icon={p.Icon} label={p.label} hint={p.hint}
                count={countByPiso[p.key] || 0} onClick={() => setScopePiso(p.key)} />
            ))}
          </div>
        </aside>

        {/* ── Right region: command bar + (list · detail) ── */}
        <div className="flex-1 min-w-0 w-full">
          {/* Command bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar sistema..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>
            <select
              value={pasoFilter}
              onChange={(e) => setPasoFilter(e.target.value)}
              className="field-control field-select appearance-none px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none sm:w-48"
              style={mf}
            >
              <option value="">Todos los pasos</option>
              {PASOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
            {isAdmin && (
              <button onClick={openNewSystem}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors shrink-0"
                style={mf}>
                <Plus className="w-4 h-4" /> Nuevo sistema
              </button>
            )}
          </div>

          {/* list · detail */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
            <div className="min-w-0">
            <PixelDataTable
            data={visibleSystems}
            onRowClick={(s: any) => setSelected(s)}
            emptyTitle="Sin sistemas"
            emptyDesc={isAdmin ? 'Crea el primer sistema con "Nuevo sistema".' : 'Aún no hay sistemas en este ámbito.'}
            columns={[
              { key: 'name', header: 'Sistema', render: (s: any) => (
                <div className="flex items-center gap-2.5">
                  <div className="relative w-8 h-8 rounded-md bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
                    <Boxes className="w-4 h-4 text-accent" />
                    <span title={s.is_active ? 'Activo' : 'Inactivo'} className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-digi-card ${s.is_active ? 'bg-green-500' : 'bg-digi-muted'}`} />
                  </div>
                  <div className="min-w-0">
                    <span className={`block text-[13px] font-medium truncate ${selected?.id === s.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{s.name}</span>
                    {s.description && <span className="block text-[11px] text-digi-muted truncate max-w-[280px]" style={mf}>{s.description}</span>}
                  </div>
                </div>
              ) },
              { key: 'piso', header: 'Piso', width: '120px', render: (s: any) => (
                <span className="text-[12px] text-digi-text" style={mf}>{PISO_LABEL[s.piso] || s.piso}</span>
              ) },
              { key: 'paso', header: 'Paso', width: '130px', render: (s: any) => (
                <span className="text-[12px] text-digi-muted" style={mf}>{PASO_LABEL[s.paso] || s.paso}</span>
              ) },
              { key: 'access', header: 'Acceso', width: '90px', render: (s: any) => (
                <span className="inline-flex items-center gap-1 text-[12px] text-digi-muted" style={mf}>
                  <Users className="w-3.5 h-3.5" /> {s.access_count ?? 0}
                </span>
              ) },
            ]}
          />
            </div>

            {/* ── Detail panel ── */}
            <aside className="w-full xl:w-[300px]">
          {selected ? (
            <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                  <Boxes className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.name}</h3>
                  <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{selected.cell_name}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-2.5">
                {selected.description && (
                  <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>{selected.description}</p>
                )}
                {[
                  ['Piso', PISO_LABEL[selected.piso] || selected.piso],
                  ['Paso', PASO_LABEL[selected.paso] || selected.paso],
                  ['Acceso', `${selected.access_count ?? 0} miembro(s)`],
                  ['Estado', selected.is_active ? 'Activo' : 'Inactivo'],
                  ['Creado', selected.created_at ? new Date(selected.created_at).toLocaleDateString('es-EC') : '—'],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
                    <span className="text-digi-muted" style={mf}>{k}</span>
                    <span className="text-digi-text text-right" style={mf}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 pt-0 space-y-2">
                <button
                  onClick={() => { setActiveSystem(selected); setSysSubTab(''); }}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors"
                  style={mf}
                >
                  Abrir sistema <ArrowRight className="w-4 h-4" />
                </button>
                {isAdmin && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => openShareModal(selected)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
                      <Share2 className="w-3.5 h-3.5" /> Compartir
                    </button>
                    <button onClick={() => openEditSystem(selected)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
                      <Pencil className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={() => handleToggleActive(selected)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
                      {selected.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => handleDeleteSys(selected)}
                      className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-red-500/30 rounded text-[12px] text-red-500 hover:bg-red-50 transition-colors" style={mf}>
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center">
              <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                <Boxes className="w-5 h-5 text-digi-muted" />
              </div>
              <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un sistema para ver sus detalles y acciones.</p>
            </div>
          )}
            </aside>
          </div>
        </div>
      </div>

      {renderModals()}
    </div>
  );

  /* ── Shared modals (used by both views) ──────────────────────────────── */
  function renderModals() {
    return (
      <>
        {/* System editor */}
        <PixelModal open={sysModal} onClose={() => !savingSys && setSysModal(false)}
          title={editingSys ? 'Editar sistema' : 'Nuevo sistema'}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <PixelSelect label="Piso" value={formPiso} disabled={!!editingSys}
                onChange={(e) => setFormPiso(e.target.value)}
                options={PISOS.map((p) => ({ value: p.key, label: p.label }))} />
              <PixelSelect label="Paso" value={formPaso} disabled={!!editingSys}
                onChange={(e) => setFormPaso(e.target.value)}
                options={PASOS.map((p) => ({ value: p.key, label: p.label }))} />
            </div>
            <p className="text-[11px] text-digi-muted" style={mf}>
              Celda: <span className="text-digi-text font-medium">{CELL_MAP[formPiso]?.[formPaso] || '—'}</span>
            </p>
            <PixelInput label="Nombre" value={sysName} onChange={(e) => setSysName(e.target.value)} placeholder="Nombre del sistema" />
            <div className="flex flex-col gap-1">
              <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Descripción (opcional)</label>
              <textarea value={sysDesc} onChange={(e) => setSysDesc(e.target.value)} rows={2}
                className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none"
                style={mf} placeholder="Descripción..." />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setSysModal(false)} className="pixel-btn pixel-btn-secondary text-sm flex-1" style={mf}>Cancelar</button>
              <button onClick={handleSaveSys} disabled={savingSys} className="pixel-btn pixel-btn-primary text-sm flex-1 disabled:opacity-50" style={mf}>
                {savingSys ? '...' : editingSys ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </PixelModal>

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
                <span className="field-label text-[10px] text-digi-muted block mb-1" style={df}>Motivo del miembro</span>
                <p className="text-[12px] text-digi-text p-2 bg-digi-darker border border-digi-border rounded" style={mf}>{selectedReq.reason}</p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Nota del revisor</label>
                <textarea value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={2}
                  className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
              </div>
              <PixelInput label="Cuota de perjuicio (USD, opcional)" type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="0.00" />
              <div className="flex gap-2">
                <button onClick={() => handleReview('exit_no_fee')} disabled={reviewing} className="flex-1 pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={mf}>
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

        {/* Share access */}
        <PixelModal open={shareModal} onClose={() => !sharing && setShareModal(false)} title={`Compartir — ${selected?.name || ''}`}>
          <div className="space-y-4">
            <div>
              <label className="field-label text-[10px] text-accent-glow opacity-70 block mb-1.5" style={df}>Agregar personas</label>
              <div className="border-2 border-digi-border bg-digi-darker rounded focus-within:border-accent transition-colors">
                {shareSelected.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-2 pt-2">
                    {shareSelected.map((id) => {
                      const m = shareMembers.find((x: any) => x.id === id);
                      if (!m) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-accent-light border border-accent/30 rounded px-2 py-0.5">
                          <span className="text-[11px] text-digi-text" style={mf}>{m.name}</span>
                          <button onClick={() => toggleShareMember(id)} className="text-digi-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <input type="text" value={shareSearch} onChange={(e) => setShareSearch(e.target.value)}
                  placeholder="Buscar por nombre o email..."
                  className="w-full px-3 py-2 bg-transparent text-sm text-digi-text focus:outline-none" style={mf} />
              </div>
              {shareSearch.trim() && filteredShareMembers.length > 0 && (
                <div className="border border-digi-border bg-digi-card rounded max-h-36 overflow-y-auto mt-1">
                  {filteredShareMembers.map((m: any) => (
                    <div key={m.id} onClick={() => { toggleShareMember(m.id); setShareSearch(''); }}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent-light transition-colors border-b border-digi-border/40 last:border-b-0">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={m.name} className="w-6 h-6 rounded-full object-cover border border-digi-border" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                          <span className="text-[9px] text-accent font-semibold">{m.name?.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] text-digi-text block" style={mf}>{m.name}</span>
                        {m.email && <span className="text-[10px] text-digi-muted block truncate" style={mf}>{m.email}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {shareSearch.trim() && filteredShareMembers.length === 0 && (
                <p className="text-[11px] text-digi-muted text-center py-2 mt-1" style={mf}>No se encontraron miembros</p>
              )}
            </div>

            {shareSelected.length > 0 && (
              <button onClick={handleShare} disabled={sharing} className="w-full pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={mf}>
                {sharing ? 'Compartiendo...' : `Compartir con ${shareSelected.length} persona(s)`}
              </button>
            )}

            <div className="h-px bg-digi-border/60" />

            <div>
              <label className="field-label text-[10px] text-accent-glow opacity-70 block mb-1.5 flex items-center gap-1.5" style={df}>
                <Link2 className="w-3.5 h-3.5" /> Personas con acceso
              </label>
              {shareExisting.length > 0 ? (
                <div className="border border-digi-border bg-digi-card rounded max-h-48 overflow-y-auto">
                  {shareExisting.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 border-b border-digi-border/40 last:border-b-0">
                      {a.photo_url ? (
                        <img src={a.photo_url} alt={a.member_name} className="w-7 h-7 rounded-full object-cover border border-digi-border" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                          <span className="text-[10px] text-accent font-semibold">{a.member_name?.charAt(0)}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[12px] text-digi-text block" style={mf}>{a.member_name}</span>
                        <span className="text-[10px] text-digi-muted" style={mf}>Desde {new Date(a.created_at).toLocaleDateString('es-EC')}</span>
                      </div>
                      <button onClick={() => handleRevokeShare(a.id)} disabled={revokingId === a.id}
                        className="text-[11px] text-red-500 border border-red-500/30 rounded px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50" style={mf}>
                        {revokingId === a.id ? '...' : 'Quitar'}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-digi-muted text-center py-4 border border-digi-border rounded bg-digi-darker" style={mf}>
                  Nadie tiene acceso a este sistema aún.
                </p>
              )}
            </div>
          </div>
        </PixelModal>
      </>
    );
  }
}
