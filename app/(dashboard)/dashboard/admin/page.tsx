'use client';

import { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';
import {
  Users, UserRound, UserPlus, Gamepad2, LayoutDashboard, Globe, FolderKanban,
  AlertTriangle, Image as ImageIcon, Check, X, ShieldAlert, Clock, Flame, type LucideIcon,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const MAIN_TABS = [
  { value: 'team', label: 'Equipo', Icon: Users },
  { value: 'clients', label: 'Clientes', Icon: UserRound },
  { value: 'proposals', label: 'Postulaciones', Icon: UserPlus },
  { value: 'digimundo', label: 'DigiMundo', Icon: Gamepad2 },
];

const DIGI_TABS = [
  { value: 'digi-dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { value: 'digi-world', label: 'Mundo', Icon: Globe },
  { value: 'digi-projects', label: 'Proyectos', Icon: FolderKanban },
  { value: 'digi-incidents', label: 'Incidentes', Icon: AlertTriangle },
  { value: 'digi-sprites', label: 'Sprites', Icon: ImageIcon },
];

const SEV_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  low: 'default', medium: 'warning', high: 'error', critical: 'error',
};
const SEV_L: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
const INC_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'info', reviewing: 'info', completed: 'success', rejected: 'error',
};
const INC_L: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobado', reviewing: 'En revisión', completed: 'Completado', rejected: 'Rechazado' };

const WorldViewer = dynamic(() => import('@/app/(main)/world/page'), {
  ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando mundo..." /></div>,
});
const SpritesEditor = dynamic(() => import('@/app/(main)/sprites/page'), {
  ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando sprites..." /></div>,
});
const ProjectsEditor = dynamic(() => import('@/app/(main)/projects/page'), {
  ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando proyectos..." /></div>,
});

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('team');
  const [digiTab, setDigiTab] = useState('digi-dashboard');

  if (user?.role !== 'admin') {
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg text-center py-12">
        <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center mx-auto mb-2"><ShieldAlert className="w-5 h-5 text-red-600" /></div>
        <p className="text-sm font-semibold text-digi-text" style={mf}>Acceso denegado</p>
        <p className="text-[12px] text-digi-muted mt-1" style={mf}>Solo administradores pueden ver esta página.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Administración" description="Gestiona equipo, clientes, postulaciones y DigiMundo" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: secciones ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Administración</p>
          <div className="space-y-0.5">
            {MAIN_TABS.map((t) => {
              const active = tab === t.value;
              return (
                <button key={t.value} onClick={() => setTab(t.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
                    active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
                  }`}>
                  <t.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
                  <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0 w-full">
          {tab === 'team' && <TeamSection />}
          {tab === 'clients' && <ClientsSection />}
          {tab === 'proposals' && <ProposalsSection />}
          {tab === 'digimundo' && (
            <div>
              {/* DigiMundo sub-nav — segmented control */}
              <div className="inline-flex flex-wrap gap-1 p-0.5 bg-black/[0.04] rounded-md mb-4">
                {DIGI_TABS.map(dt => {
                  const active = digiTab === dt.value;
                  return (
                    <button key={dt.value} onClick={() => setDigiTab(dt.value)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded transition-colors ${active ? 'bg-digi-card text-accent shadow-sm' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>
                      <dt.Icon className="w-3.5 h-3.5" /> {dt.label}
                    </button>
                  );
                })}
              </div>

              {digiTab === 'digi-dashboard' && <DigiDashboard />}
              {digiTab === 'digi-world' && (
                <div className="border border-digi-border rounded-lg overflow-hidden relative" style={{ height: 'calc(100vh - 220px)', minHeight: 400 }}>
                  <div className="absolute inset-0 overflow-hidden [&>div]:!m-0 [&>div]:!h-full"><WorldViewer /></div>
                </div>
              )}
              {digiTab === 'digi-projects' && (
                <div style={{ height: 'calc(100vh - 180px)' }}><ProjectsEditor /></div>
              )}
              {digiTab === 'digi-incidents' && <DigiIncidents />}
              {digiTab === 'digi-sprites' && <SpritesEditor />}
            </div>
          )}
        </div>
      </div>
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
      singleLine
      data={data}
      emptyTitle="Sin miembros"
      emptyDesc="No hay miembros registrados."
      columns={[
        { key: 'name', header: 'Nombre', render: (m: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{m.name}</span> },
        { key: 'email', header: 'Email', render: (m: any) => <span className="text-[12px] text-digi-muted" style={mf}>{m.email}</span> },
        { key: 'position', header: 'Posición', width: '160px', render: (m: any) => <span className="text-[12px] text-digi-text" style={mf}>{m.position_name || '—'}</span> },
        { key: 'rate', header: 'Tarifa/h', width: '90px', render: (m: any) => <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{m.hourly_rate ? `$${m.hourly_rate}` : '—'}</span> },
        { key: 'active', header: 'Activo', width: '100px', render: (m: any) => (
          <PixelBadge variant={m.is_active ? 'success' : 'default'}>{m.is_active ? 'Activo' : 'Inactivo'}</PixelBadge>
        ) },
      ]}
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
      singleLine
      data={data}
      emptyTitle="Sin clientes"
      emptyDesc="No hay clientes registrados."
      columns={[
        { key: 'name', header: 'Nombre', render: (c: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{`${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email}</span> },
        { key: 'email', header: 'Email', render: (c: any) => <span className="text-[12px] text-digi-muted" style={mf}>{c.email}</span> },
        { key: 'phone', header: 'Teléfono', width: '140px', render: (c: any) => <span className="text-[12px] text-digi-text" style={mf}>{c.phone || '—'}</span> },
        { key: 'verified', header: 'Verificado', width: '120px', render: (c: any) => (
          <PixelBadge variant={c.is_verified ? 'success' : 'warning'}>{c.is_verified ? 'Sí' : 'No'}</PixelBadge>
        ) },
        { key: 'date', header: 'Registro', width: '110px', render: (c: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(c.created_at).toLocaleDateString('es-EC')}</span> },
      ]}
    />
  );
}

/* ─── Postulaciones de candidatos ─── */
const PROP_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'success', rejected: 'error',
};
const PROP_STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };

function ProposalsSection() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/candidate-proposals').then(r => r.json()).then(d => setData(d.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const approve = async (p: any) => {
    setBusyId(p.id); setMsg(null);
    try {
      const r = await fetch(`/api/admin/candidate-proposals/${p.id}/approve`, { method: 'POST' });
      const j = await r.json();
      if (!r.ok) { setMsg(j?.error ?? 'No se pudo aprobar'); return; }
      setMsg(j.emailSent === false ? 'Aprobado (no se envió el correo).' : `Aprobado: se envió el correo a ${p.email}.`);
      load();
    } catch { setMsg('Error de red'); } finally { setBusyId(null); }
  };
  const reject = async (p: any) => {
    setBusyId(p.id); setMsg(null);
    try {
      const r = await fetch(`/api/admin/candidate-proposals/${p.id}/reject`, { method: 'POST' });
      if (!r.ok) { const j = await r.json(); setMsg(j?.error ?? 'No se pudo rechazar'); return; }
      load();
    } catch { setMsg('Error de red'); } finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando postulaciones..." /></div>;

  return (
    <div>
      {msg && <div className="mb-3 px-3 py-2 rounded-lg border border-accent/30 bg-accent-light text-[12px] text-accent" style={mf}>{msg}</div>}
      <PixelDataTable
        data={data}
        emptyTitle="Sin postulaciones"
        emptyDesc="No hay postulaciones de candidatos."
        columns={[
          { key: 'email', header: 'Correo', render: (p: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{p.email}</span> },
          { key: 'reason', header: 'Motivación', render: (p: any) => <span className="text-[12px] text-digi-muted truncate max-w-[260px] inline-block" style={mf}>{p.reason || '—'}</span> },
          { key: 'verified', header: 'Correo', width: '130px', render: (p: any) => (
            <PixelBadge variant={p.email_verified ? 'success' : 'warning'}>{p.email_verified ? 'Verificado' : 'Sin verificar'}</PixelBadge>
          ) },
          { key: 'status', header: 'Estado', width: '120px', render: (p: any) => (
            <PixelBadge variant={PROP_STATUS_V[p.status] || 'default'}>{PROP_STATUS_LABEL[p.status] || p.status}</PixelBadge>
          ) },
          { key: 'date', header: 'Fecha', width: '110px', render: (p: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(p.created_at).toLocaleDateString('es-EC')}</span> },
          { key: 'actions', header: '', width: '200px', render: (p: any) => (
            <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
              {p.status !== 'approved' && (
                <button onClick={() => approve(p)} disabled={busyId === p.id}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-green-600 rounded px-2.5 py-1 hover:bg-green-700 transition-colors disabled:opacity-50" style={mf}>
                  <Check className="w-3.5 h-3.5" /> {busyId === p.id ? '...' : 'Aprobar'}
                </button>
              )}
              {p.status !== 'rejected' && (
                <button onClick={() => reject(p)} disabled={busyId === p.id}
                  className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600 border border-red-300 rounded px-2.5 py-1 hover:bg-red-50 transition-colors disabled:opacity-50" style={mf}>
                  <X className="w-3.5 h-3.5" /> Rechazar
                </button>
              )}
            </div>
          ) },
        ]}
      />
    </div>
  );
}

/* ─── DigiMundo Dashboard ─── */
function DigiStat({ Icon, label, value, tone }: { Icon: LucideIcon; label: string; value: number; tone: 'accent' | 'amber' | 'red' }) {
  const chip = tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-accent-light text-accent';
  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm flex items-center gap-3">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${chip}`}><Icon className="w-5 h-5" /></div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-digi-muted truncate" style={mf}>{label}</p>
        <p className="text-xl font-semibold text-digi-text leading-tight tabular-nums" style={mf}>{value}</p>
      </div>
    </div>
  );
}

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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <DigiStat Icon={FolderKanban} label="Proyectos" value={stats.projects} tone="accent" />
      <DigiStat Icon={Users} label="Ciudadanos" value={stats.citizens} tone="accent" />
      <DigiStat Icon={AlertTriangle} label="Incidentes" value={stats.incidents} tone="accent" />
      <DigiStat Icon={Clock} label="Pendientes" value={stats.pending} tone="amber" />
      <DigiStat Icon={Flame} label="Críticos" value={stats.critical} tone="red" />
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

  const STATUSES = [
    { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' },
    { value: 'reviewing', label: 'En revisión' }, { value: 'completed', label: 'Completados' },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
          className="field-control field-select appearance-none px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
          <option value="">Todos los proyectos</option>
          {digiProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="inline-flex flex-wrap gap-1 p-0.5 bg-black/[0.04] rounded-md">
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded transition-colors ${statusFilter === s.value ? 'bg-digi-card text-accent shadow-sm' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <PixelDataTable
        singleLine
        data={filtered}
        emptyTitle="Sin incidentes"
        emptyDesc="No hay incidentes con este filtro."
        columns={[
          { key: 'title', header: 'Título', render: (i: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{i.title}</span> },
          { key: 'project', header: 'Proyecto', width: '150px', render: (i: any) => <span className="text-[12px] text-accent" style={mf}>{projectName(i.projectId)}</span> },
          { key: 'client', header: 'Cliente', width: '150px', render: (i: any) => <span className="text-[12px] text-digi-text" style={mf}>{i.clientName || '—'}</span> },
          { key: 'severity', header: 'Severidad', width: '110px', render: (i: any) => (
            <PixelBadge variant={SEV_V[i.severity] || 'default'}>{SEV_L[i.severity] || i.severity}</PixelBadge>
          ) },
          { key: 'status', header: 'Estado', width: '120px', render: (i: any) => (
            <PixelBadge variant={INC_V[i.status] || 'default'}>{INC_L[i.status] || i.status}</PixelBadge>
          ) },
          { key: 'date', header: 'Fecha', width: '110px', render: (i: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(i.createdAt).toLocaleDateString('es-EC')}</span> },
        ]}
      />
    </div>
  );
}
