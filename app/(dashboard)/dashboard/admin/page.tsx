'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';
import FlowSidePanel from '@/components/dashboard/flows/FlowSidePanel';
import WhatsAppFlowPanel from '@/components/dashboard/flows/WhatsAppFlowPanel';
import ChatbotFlowPanel from '@/components/dashboard/flows/ChatbotFlowPanel';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const MAIN_TABS = [
  { value: 'team', label: 'Equipo' },
  { value: 'clients', label: 'Clientes' },
  { value: 'digimundo', label: 'DigiMundo' },
  { value: 'flows', label: 'Flujos' },
];

const DIGI_TABS = [
  { value: 'digi-dashboard', label: 'Dashboard' },
  { value: 'digi-world', label: 'Mundo' },
  { value: 'digi-projects', label: 'Proyectos' },
  { value: 'digi-incidents', label: 'Incidentes' },
  { value: 'digi-sprites', label: 'Sprites' },
];

const SEV_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  low: 'default', medium: 'warning', high: 'error', critical: 'error',
};
const INC_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'info', reviewing: 'info', completed: 'success', rejected: 'error',
};

// Lazy-load heavy DigiMundo components
const WorldViewer = dynamic(() => import('@/app/(main)/world/page'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando mundo..." /></div>,
});
const SpritesEditor = dynamic(() => import('@/app/(main)/sprites/page'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando sprites..." /></div>,
});
const ProjectsEditor = dynamic(() => import('@/app/(main)/projects/page'), {
  ssr: false,
  loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando proyectos..." /></div>,
});

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('team');
  const [digiTab, setDigiTab] = useState('digi-dashboard');

  if (user?.role !== 'admin') {
    return (
      <div className="pixel-card text-center py-12">
        <p className="pixel-heading text-sm text-red-400">Acceso Denegado</p>
        <p className="text-xs text-digi-muted mt-1" style={mf}>Solo administradores pueden ver esta pagina.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Administracion" description="Gestiona equipo, clientes, DigiMundo y flujos" />
      <PixelTabs tabs={MAIN_TABS} active={tab} onChange={setTab} />

      {tab === 'team' && <TeamSection />}
      {tab === 'clients' && <ClientsSection />}
      {tab === 'flows' && <FlujosSection />}
      {tab === 'digimundo' && (
        <div>
          {/* DigiMundo sub-tabs */}
          <div className="mb-4 flex gap-1 overflow-x-auto">
            {DIGI_TABS.map(dt => (
              <button
                key={dt.value}
                onClick={() => setDigiTab(dt.value)}
                className={`px-3 py-1.5 text-[9px] border transition-colors whitespace-nowrap ${
                  digiTab === dt.value
                    ? 'border-accent bg-accent/15 text-accent-glow'
                    : 'border-digi-border text-digi-muted hover:text-digi-text hover:border-digi-muted'
                }`}
                style={pf}
              >
                {dt.label}
              </button>
            ))}
          </div>

          {digiTab === 'digi-dashboard' && <DigiDashboard />}
          {digiTab === 'digi-world' && (
            <div
              className="border-2 border-digi-border overflow-hidden relative"
              style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}
            >
              {/* Reset the negative margins the world viewer applies */}
              <div className="absolute inset-0 overflow-hidden [&>div]:!m-0 [&>div]:!h-full">
                <WorldViewer />
              </div>
            </div>
          )}
          {digiTab === 'digi-projects' && (
            <div className="border-2 border-digi-border overflow-auto p-3" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <ProjectsEditor />
            </div>
          )}
          {digiTab === 'digi-incidents' && <DigiIncidents />}
          {digiTab === 'digi-sprites' && (
            <div className="border-2 border-digi-border overflow-auto p-3" style={{ maxHeight: 'calc(100vh - 220px)' }}>
              <SpritesEditor />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Team ─── */
function TeamSection() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/team').then(r => r.json()).then(d => setData(d.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando equipo..." /></div>;

  return (
    <PixelDataTable
      columns={[
        { key: 'name', header: 'Nombre', render: (m: any) => m.name },
        { key: 'email', header: 'Email', render: (m: any) => m.email },
        { key: 'position', header: 'Posicion', render: (m: any) => m.position_name || '-' },
        { key: 'rate', header: 'Tarifa/h', render: (m: any) => m.hourly_rate ? `$${m.hourly_rate}` : '-' },
        { key: 'active', header: 'Activo', render: (m: any) => (
          <PixelBadge variant={m.is_active ? 'success' : 'default'}>{m.is_active ? 'Si' : 'No'}</PixelBadge>
        )},
      ]}
      data={data}
      emptyTitle="Sin miembros"
      emptyDesc="No hay miembros registrados."
    />
  );
}

/* ─── Clients ─── */
function ClientsSection() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/clients').then(r => r.json()).then(d => setData(d.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando clientes..." /></div>;

  return (
    <PixelDataTable
      columns={[
        { key: 'name', header: 'Nombre', render: (c: any) => `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email },
        { key: 'email', header: 'Email', render: (c: any) => c.email },
        { key: 'phone', header: 'Telefono', render: (c: any) => c.phone || '-' },
        { key: 'verified', header: 'Verificado', render: (c: any) => (
          <PixelBadge variant={c.is_verified ? 'success' : 'warning'}>{c.is_verified ? 'Si' : 'No'}</PixelBadge>
        )},
        { key: 'date', header: 'Registro', render: (c: any) => new Date(c.created_at).toLocaleDateString() },
      ]}
      data={data}
      emptyTitle="Sin clientes"
      emptyDesc="No hay clientes registrados."
    />
  );
}

/* ─── DigiMundo Dashboard ─── */
function DigiDashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/digimundo/projects').then(r => r.json()),
      fetch('/api/incidents').then(r => r.json()),
      fetch('/api/world').then(r => r.json()),
    ]).then(([proj, inc, world]) => {
      const incidents = Array.isArray(inc) ? inc : inc.data || [];
      setStats({
        projects: (proj.data || []).length,
        incidents: incidents.length,
        pending: incidents.filter((i: any) => i.status === 'pending').length,
        critical: incidents.filter((i: any) => i.severity === 'critical' || i.severity === 'high').length,
        citizens: (world.citizens || []).length,
      });
    }).catch(() => {});
  }, []);

  if (!stats) return <div className="flex justify-center py-8"><BrandLoader size="md" /></div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {[
        { label: 'Proyectos', value: stats.projects },
        { label: 'Ciudadanos', value: stats.citizens },
        { label: 'Incidentes', value: stats.incidents },
        { label: 'Pendientes', value: stats.pending, color: 'text-yellow-400' },
        { label: 'Criticos', value: stats.critical, color: 'text-red-400' },
      ].map(s => (
        <div key={s.label} className="pixel-card py-4 text-center">
          <p className="text-[9px] text-digi-muted mb-1" style={pf}>{s.label}</p>
          <p className={`text-2xl font-bold ${s.color || 'text-white'}`} style={mf}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── DigiMundo Incidents ─── */
function DigiIncidents() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [digiProjects, setDigiProjects] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/incidents').then(r => r.json()),
      fetch('/api/digimundo/projects').then(r => r.json()),
    ]).then(([inc, proj]) => {
      setIncidents(Array.isArray(inc) ? inc : inc.data || []);
      setDigiProjects(proj.data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando incidentes..." /></div>;

  const projectName = (pid: string) => digiProjects.find((p: any) => p.id === pid)?.name || pid.slice(0, 8);

  let filtered = incidents;
  if (statusFilter !== 'all') filtered = filtered.filter((i: any) => i.status === statusFilter);
  if (projectFilter) filtered = filtered.filter((i: any) => i.projectId === projectFilter);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
          style={{
            ...mf,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            paddingRight: '28px',
          }}
        >
          <option value="">Todos los proyectos</option>
          {digiProjects.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {['all', 'pending', 'reviewing', 'completed'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2 py-1 text-[9px] border transition-colors ${
                statusFilter === s ? 'border-accent text-accent-glow bg-accent/10' : 'border-digi-border text-digi-muted'
              }`}
              style={pf}
            >
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      <PixelDataTable
        columns={[
          { key: 'title', header: 'Titulo', render: (i: any) => i.title },
          { key: 'project', header: 'Proyecto', render: (i: any) => (
            <span className="text-accent-glow">{projectName(i.projectId)}</span>
          )},
          { key: 'client', header: 'Cliente', render: (i: any) => i.clientName || '-' },
          { key: 'severity', header: 'Severidad', render: (i: any) => (
            <PixelBadge variant={SEV_V[i.severity] || 'default'}>{i.severity}</PixelBadge>
          )},
          { key: 'status', header: 'Estado', render: (i: any) => (
            <PixelBadge variant={INC_V[i.status] || 'default'}>{i.status}</PixelBadge>
          )},
          { key: 'date', header: 'Fecha', render: (i: any) => new Date(i.createdAt).toLocaleDateString() },
        ]}
        data={filtered}
        emptyTitle="Sin incidentes"
        emptyDesc="No hay incidentes con este filtro."
      />
    </div>
  );
}

/* ─── Flujos (Automatizaciones) ─── */
const FLOW_TYPES: Record<string, { label: string; color: string }> = {
  email: { label: 'Email Masivo', color: 'text-blue-400' },
  whatsapp: { label: 'WhatsApp', color: 'text-green-400' },
  chatbot: { label: 'Chatbot', color: 'text-yellow-400' },
  ai_agent: { label: 'Agente IA', color: 'text-purple-400' },
  custom: { label: 'Personalizado', color: 'text-digi-muted' },
};

const FLOW_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', active: 'success', paused: 'warning', archived: 'error',
};

const FLOW_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', active: 'Activo', paused: 'Pausado', archived: 'Archivado',
};

interface Flow {
  id: number;
  name: string;
  type: string;
  description: string;
  status: string;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

function FlujosSection() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<Flow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  const [form, setForm] = useState({ name: '', type: 'email', description: '' });

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/flows');
      const data = await res.json();
      setFlows(data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'email', description: '' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (flow: Flow) => {
    setEditing(flow);
    setForm({ name: flow.name, type: flow.type, description: flow.description || '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('El nombre es requerido'); return; }
    setSaving(true);
    setFormError('');
    try {
      const url = editing ? `/api/admin/flows/${editing.id}` : '/api/admin/flows';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || 'Error al guardar');
        return;
      }
      setModalOpen(false);
      fetchFlows();
    } catch {
      setFormError('Error de conexion');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (flow: Flow) => {
    const nextStatus = flow.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/admin/flows/${flow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchFlows();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/flows/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      fetchFlows();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando flujos..." /></div>;

  let filtered = flows;
  if (filterType !== 'all') filtered = filtered.filter(f => f.type === filterType);
  if (filterStatus !== 'all') filtered = filtered.filter(f => f.status === filterStatus);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Type filter */}
        <div className="flex gap-1">
          {[{ value: 'all', label: 'Todos' }, ...Object.entries(FLOW_TYPES).map(([v, t]) => ({ value: v, label: t.label }))].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-2 py-1 text-[9px] border transition-colors ${
                filterType === opt.value ? 'border-accent text-accent-glow bg-accent/10' : 'border-digi-border text-digi-muted'
              }`}
              style={pf}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
          style={{
            ...mf,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            paddingRight: '28px',
          }}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(FLOW_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Create button */}
        <button onClick={openCreate} className="ml-auto pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>
          + Nuevo Flujo
        </button>
      </div>

      {/* Table */}
      <PixelDataTable
        columns={[
          { key: 'name', header: 'Nombre', render: (f: Flow) => (
            <span className="text-white font-medium">{f.name}</span>
          )},
          { key: 'type', header: 'Tipo', render: (f: Flow) => {
            const t = FLOW_TYPES[f.type] || FLOW_TYPES.custom;
            return <span className={t.color}>{t.label}</span>;
          }},
          { key: 'description', header: 'Descripcion', render: (f: Flow) => (
            <span className="text-digi-muted truncate max-w-[200px] inline-block">{f.description || '-'}</span>
          )},
          { key: 'status', header: 'Estado', render: (f: Flow) => (
            <PixelBadge variant={FLOW_STATUS_V[f.status] || 'default'}>
              {FLOW_STATUS_LABELS[f.status] || f.status}
            </PixelBadge>
          )},
          { key: 'date', header: 'Creado', render: (f: Flow) => new Date(f.created_at).toLocaleDateString() },
          { key: 'actions', header: '', width: '120px', render: (f: Flow) => (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleToggleStatus(f)}
                className={`px-2 py-0.5 text-[8px] border transition-colors ${
                  f.status === 'active'
                    ? 'border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20'
                    : 'border-green-700/50 text-green-400 hover:bg-green-900/20'
                }`}
                style={pf}
                title={f.status === 'active' ? 'Pausar' : 'Activar'}
              >
                {f.status === 'active' ? 'Pausar' : 'Activar'}
              </button>
              <button
                onClick={() => openEdit(f)}
                className="px-2 py-0.5 text-[8px] border border-accent/50 text-accent-glow hover:bg-accent/10 transition-colors"
                style={pf}
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmDelete(f)}
                className="px-2 py-0.5 text-[8px] border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors"
                style={pf}
              >
                X
              </button>
            </div>
          )},
        ]}
        data={filtered}
        onRowClick={(f) => setSelectedFlow(f)}
        emptyTitle="Sin flujos"
        emptyDesc="Crea tu primer flujo de automatizacion."
      />

      {/* Side Panel */}
      {selectedFlow && selectedFlow.type === 'whatsapp' && (
        <WhatsAppFlowPanel flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}
      {selectedFlow && selectedFlow.type === 'chatbot' && (
        <ChatbotFlowPanel flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}
      {selectedFlow && selectedFlow.type !== 'whatsapp' && selectedFlow.type !== 'chatbot' && (
        <FlowSidePanel flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}

      {/* Create/Edit Modal */}
      <PixelModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Flujo' : 'Nuevo Flujo'}>
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Nombre</label>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del flujo"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>

          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Tipo</label>
            <select
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
              style={{
                ...mf,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: '28px',
              }}
            >
              {Object.entries(FLOW_TYPES).map(([v, t]) => (
                <option key={v} value={v}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Descripcion</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripcion del flujo..."
              rows={3}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none"
              style={mf}
            />
          </div>

          {formError && <p className="text-xs text-red-400" style={mf}>{formError}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors" style={pf}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="pixel-btn-primary px-4 py-2 text-[9px]" style={pf}>
              {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </PixelModal>

      {/* Delete Confirmation Modal */}
      <PixelModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar Flujo" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-digi-muted" style={mf}>
            Estas seguro de eliminar <span className="text-white">{confirmDelete?.name}</span>? Esta accion no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-white transition-colors" style={pf}>
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-[9px] border-2 border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
              style={pf}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
