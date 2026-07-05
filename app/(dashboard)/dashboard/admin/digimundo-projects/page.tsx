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
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[12px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>DigiMundo &gt; Proyectos</span>
      </div>
      <div style={{ height: 'calc(100vh - 140px)' }}><ProjectsEditor /></div>
    </div>
  );
}
