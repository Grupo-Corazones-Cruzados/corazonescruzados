'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';
import { ChevronLeft } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const SEV_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  low: 'default', medium: 'warning', high: 'error', critical: 'error',
};
const SEV_L: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica' };
const INC_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'info', reviewing: 'info', completed: 'success', rejected: 'error',
};
const INC_L: Record<string, string> = { pending: 'Pendiente', approved: 'Aprobado', reviewing: 'En revisión', completed: 'Completado', rejected: 'Rechazado' };

const STATUSES = [
  { value: 'all', label: 'Todos' }, { value: 'pending', label: 'Pendientes' },
  { value: 'reviewing', label: 'En revisión' }, { value: 'approved', label: 'Aprobados' },
  { value: 'completed', label: 'Completados' }, { value: 'rejected', label: 'Rechazados' },
];

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [digiProjects, setDigiProjects] = useState<any[]>([]);
  const [tab, setTab] = useState('all');
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

  const projectName = (pid: string) => digiProjects.find((p: any) => p.id === pid)?.name || pid.slice(0, 8);
  let filtered = incidents;
  if (tab !== 'all') filtered = filtered.filter((i: any) => i.status === tab);
  if (projectFilter) filtered = filtered.filter((i: any) => i.projectId === projectFilter);

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando incidentes..." /></div>;

  return (
    <div>
      <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors mb-2" style={mf}>
        <ChevronLeft className="w-4 h-4" /> Admin
      </Link>
      <PageHeader title="Incidentes de DigiMundo" description={`${incidents.length} incidente(s) en total`} />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
          className="field-control field-select appearance-none px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
          <option value="">Todos los proyectos</option>
          {digiProjects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="inline-flex flex-wrap gap-1 p-0.5 bg-black/[0.04] rounded-md">
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setTab(s.value)}
              className={`px-2.5 py-1 text-[12px] font-medium rounded transition-colors ${tab === s.value ? 'bg-digi-card text-accent shadow-sm' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>
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
          { key: 'images', header: 'Imgs', width: '70px', render: (i: any) => <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{i.imageCount || 0}</span> },
          { key: 'date', header: 'Fecha', width: '110px', render: (i: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(i.createdAt).toLocaleDateString('es-EC')}</span> },
        ]}
      />
    </div>
  );
}
