'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import BrandLoader from '@/components/ui/BrandLoader';

const WorldViewer = dynamic(
  () => import('@/app/(main)/world/page'),
  { ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando mundo..." /></div> }
);

export default function AdminWorldPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[12px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>DigiMundo &gt; Mundo</span>
      </div>
      <div className="border border-digi-border rounded-lg overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        <WorldViewer />
      </div>
    </div>
  );
}
