'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const BASE_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Borrador' },
  { value: 'open', label: 'Abiertos' },
  { value: 'in_progress', label: 'En Progreso' },
  { value: 'in_review', label: 'En Revision' },
  { value: 'completed', label: 'Completados' },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', open: 'info', in_progress: 'warning',
  in_review: 'info', completed: 'success', closed: 'success', cancelled: 'error',
};

const PER_PAGE = 15;

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createBudgetMin, setCreateBudgetMin] = useState('');
  const [createBudgetMax, setCreateBudgetMax] = useState('');
  const [createDeadline, setCreateDeadline] = useState('');
  const [createClientEmail, setCreateClientEmail] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit modal
  const [editProject, setEditProject] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBudgetMin, setEditBudgetMin] = useState('');
  const [editBudgetMax, setEditBudgetMax] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const tabs = user?.role === 'member'
    ? [{ value: 'mine', label: 'Mis Proyectos' }, { value: 'invited', label: 'Invitado' }, ...BASE_TABS]
    : user?.role === 'client'
    ? [{ value: 'mine', label: 'Mis Proyectos' }, ...BASE_TABS]
    : BASE_TABS;

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
    if (tab !== 'all') params.set('status', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/projects?${params}`);
      const data = await res.json();
      setProjects(data.data || []);
      setTotal(data.total || 0);
    } catch { setProjects([]); }
  }, [page, tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const createProject = async () => {
    if (!createTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle,
          description: createDesc || null,
          budget_min: createBudgetMin ? Number(createBudgetMin) : null,
          budget_max: createBudgetMax ? Number(createBudgetMax) : null,
          deadline: createDeadline || null,
          client_email: createClientEmail || null,
        }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Error'); return; }
      const { data } = await res.json();
      toast.success('Proyecto creado');
      setShowCreate(false);
      setCreateTitle(''); setCreateDesc(''); setCreateBudgetMin(''); setCreateBudgetMax(''); setCreateDeadline(''); setCreateClientEmail('');
      router.push(`/dashboard/projects/${data.id}`);
    } catch { toast.error('Error al crear'); }
    finally { setCreating(false); }
  };

  const openEdit = (p: any) => {
    setEditProject(p);
    setEditTitle(p.title || '');
    setEditBudgetMin(p.budget_min || '');
    setEditBudgetMax(p.budget_max || '');
    setEditDeadline(p.deadline?.split('T')[0] || '');
  };

  const saveEdit = async () => {
    if (!editProject || !editTitle.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${editProject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          budget_min: editBudgetMin ? Number(editBudgetMin) : null,
          budget_max: editBudgetMax ? Number(editBudgetMax) : null,
          deadline: editDeadline || null,
        }),
      });
      toast.success('Proyecto actualizado');
      setEditProject(null);
      fetchData();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  const isOwnerOf = (p: any) => {
    if (user?.role === 'admin') return true;
    if (user?.role === 'member' && user.member_id && p.assigned_member_id == user.member_id) return true;
    return false;
  };

  return (
    <div>
      <PageHeader
        title="Proyectos"
        description="Gestiona tus proyectos"
        action={
          <button onClick={() => setShowCreate(true)} className="pixel-btn pixel-btn-primary text-[9px]">
            + Nuevo Proyecto
          </button>
        }
      />

      <div className="mb-4">
        <input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none w-full max-w-xs"
          style={mf}
        />
      </div>

      <PixelTabs tabs={tabs} active={tab} onChange={setTab} />

      <PixelDataTable
        columns={[
          { key: 'id', header: 'ID', render: (p: any) => `#${p.id}`, width: '60px' },
          { key: 'title', header: 'Titulo', render: (p: any) => p.title },
          { key: 'status', header: 'Estado', render: (p: any) => (
            <PixelBadge variant={STATUS_V[p.status] || 'default'}>{p.status}</PixelBadge>
          )},
          { key: 'client', header: 'Cliente', render: (p: any) => p.client_name || '-' },
          { key: 'budget', header: 'Presupuesto', render: (p: any) =>
            p.budget_min ? `$${p.budget_min}${p.budget_max ? `-${p.budget_max}` : ''}` : '-'
          },
          { key: 'final_cost', header: 'Costo Final', render: (p: any) =>
            p.final_cost ? `$${Number(p.final_cost).toFixed(2)}` : '-'
          },
          { key: 'deadline', header: 'Limite', render: (p: any) => p.deadline ? new Date(p.deadline).toLocaleDateString() : '-' },
          { key: 'actions', header: '', width: '40px', render: (p: any) => (
            isOwnerOf(p) && !['completed', 'closed', 'cancelled'].includes(p.status) ? (
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                className="text-[8px] text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent px-1.5 py-0.5 transition-colors"
                style={pf}
              >
                Editar
              </button>
            ) : null
          )},
        ]}
        data={projects}
        onRowClick={(p: any) => router.push(`/dashboard/projects/${p.id}`)}
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        onPageChange={setPage}
        emptyTitle="Sin proyectos"
        emptyDesc="No hay proyectos registrados aun."
      />

      {/* Create Modal */}
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo Proyecto">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Titulo *</label>
            <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Nombre del proyecto"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripcion</label>
            <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={3} placeholder="Descripcion del proyecto..."
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          {user?.role === 'member' && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Email del Cliente</label>
              <input value={createClientEmail} onChange={(e) => setCreateClientEmail(e.target.value)} placeholder="cliente@email.com"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Presupuesto Min ($)</label>
              <input value={createBudgetMin} onChange={(e) => setCreateBudgetMin(e.target.value)} type="number" placeholder="0"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Presupuesto Max ($)</label>
              <input value={createBudgetMax} onChange={(e) => setCreateBudgetMax(e.target.value)} type="number" placeholder="0"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Limite</label>
            <input value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} type="date"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          {user?.role === 'member' && (
            <p className="text-[8px] text-digi-muted" style={pf}>
              Como miembro, el proyecto se creara como privado y en progreso automaticamente.
            </p>
          )}
          <button onClick={createProject} disabled={creating || !createTitle.trim()} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {creating ? '...' : 'Crear Proyecto'}
          </button>
        </div>
      </PixelModal>

      {/* Edit Modal */}
      <PixelModal open={!!editProject} onClose={() => setEditProject(null)} title="Editar Proyecto" size="sm">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Titulo</label>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Presupuesto Min ($)</label>
              <input value={editBudgetMin} onChange={(e) => setEditBudgetMin(e.target.value)} type="number" placeholder="0"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Presupuesto Max ($)</label>
              <input value={editBudgetMax} onChange={(e) => setEditBudgetMax(e.target.value)} type="number" placeholder="0"
                className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Limite</label>
            <input value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} type="date"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <button onClick={saveEdit} disabled={saving || !editTitle.trim()} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </PixelModal>
    </div>
  );
}
