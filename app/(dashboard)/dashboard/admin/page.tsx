'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';
import {
  Globe, FolderKanban, AlertTriangle, Image as ImageIcon, ShieldAlert,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

// Panel de administración = DigiMundo. Las pestañas de equipo/clientes/postulaciones se
// retiraron (esa gestión vive en sus módulos oficiales). Quedan solo las de DigiMundo.
const TABS = [
  { value: 'world', label: 'Mundo', Icon: Globe },
  { value: 'projects', label: 'Proyectos', Icon: FolderKanban },
  { value: 'incidents', label: 'Incidentes', Icon: AlertTriangle },
  { value: 'sprites', label: 'Sprites', Icon: ImageIcon },
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
  const [tab, setTab] = useState('world');

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
      <PageHeader title="DigiMundo" description="Mundo, proyectos, incidentes y sprites del videojuego" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: secciones de DigiMundo ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>DigiMundo</p>
          <div className="space-y-0.5">
            {TABS.map((t) => {
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
          {tab === 'world' && (
            <div className="border border-digi-border rounded-lg overflow-hidden relative" style={{ height: 'calc(100vh - 180px)', minHeight: 400 }}>
              <div className="absolute inset-0 overflow-hidden [&>div]:!m-0 [&>div]:!h-full"><WorldViewer /></div>
            </div>
          )}
          {tab === 'projects' && (
            <div style={{ height: 'calc(100vh - 160px)' }}><ProjectsEditor /></div>
          )}
          {tab === 'incidents' && <DigiIncidents />}
          {tab === 'sprites' && <SpritesEditor />}
        </div>
      </div>
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
          { key: 'project', header: 'Proyecto', width: '150px', hideOnMobile: true, render: (i: any) => <span className="text-[12px] text-accent" style={mf}>{projectName(i.projectId)}</span> },
          { key: 'client', header: 'Cliente', width: '150px', hideOnMobile: true, render: (i: any) => <span className="text-[12px] text-digi-text" style={mf}>{i.clientName || '—'}</span> },
          { key: 'severity', header: 'Severidad', width: '110px', hideOnMobile: true, render: (i: any) => (
            <PixelBadge variant={SEV_V[i.severity] || 'default'}>{SEV_L[i.severity] || i.severity}</PixelBadge>
          ) },
          { key: 'status', header: 'Estado', width: '120px', render: (i: any) => (
            <PixelBadge variant={INC_V[i.status] || 'default'}>{INC_L[i.status] || i.status}</PixelBadge>
          ) },
          { key: 'date', header: 'Fecha', width: '110px', hideOnMobile: true, render: (i: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(i.createdAt).toLocaleDateString('es-EC')}</span> },
        ]}
      />
    </div>
  );
}
