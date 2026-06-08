'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import BrandLoader from '@/components/ui/BrandLoader';

const ProjectsEditor = dynamic(
  () => import('@/app/(main)/projects/page'),
  { ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando proyectos..." /></div> }
);

export default function AdminDigimundoProjectsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/dashboard/admin" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={{ fontFamily: 'var(--font-display)' }}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[10px] text-digi-muted" style={{ fontFamily: 'var(--font-display)' }}>DigiMundo &gt; Proyectos</span>
      </div>
      <ProjectsEditor />
    </div>
  );
}
