'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const SEV_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  low: 'default', medium: 'warning', high: 'error', critical: 'error',
};
const INC_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'info', reviewing: 'info', completed: 'success', rejected: 'error',
};

const STATUS_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'reviewing', label: 'En Revision' },
  { value: 'approved', label: 'Aprobados' },
  { value: 'completed', label: 'Completados' },
  { value: 'rejected', label: 'Rechazados' },
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
      // incidents API returns array directly (not { data: [...] })
      setIncidents(Array.isArray(inc) ? inc : inc.data || []);
      setDigiProjects(proj.data || []);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const projectName = (pid: string) => digiProjects.find((p: any) => p.id === pid)?.name || pid.slice(0, 8);

  let filtered = incidents;
  if (tab !== 'all') filtered = filtered.filter((i: any) => i.status === tab);
  if (projectFilter) filtered = filtered.filter((i: any) => i.projectId === projectFilter);

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando incidentes..." /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/dashboard/admin" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[10px] text-digi-muted" style={pf}>DigiMundo &gt; Incidentes ({incidents.length})</span>
      </div>

      {/* Project filter */}
      <div className="mb-3">
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
      </div>

      <PixelTabs tabs={STATUS_TABS} active={tab} onChange={setTab} />

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
          { key: 'images', header: 'Imgs', render: (i: any) => i.imageCount || 0, width: '50px' },
          { key: 'date', header: 'Fecha', render: (i: any) => new Date(i.createdAt).toLocaleDateString() },
        ]}
        data={filtered}
        emptyTitle="Sin incidentes"
        emptyDesc="No hay incidentes con este filtro."
      />
    </div>
  );
}
