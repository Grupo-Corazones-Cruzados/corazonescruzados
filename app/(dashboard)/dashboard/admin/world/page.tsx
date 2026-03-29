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
        <Link href="/dashboard/admin" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={{ fontFamily: "'Silkscreen', cursive" }}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[10px] text-digi-muted" style={{ fontFamily: "'Silkscreen', cursive" }}>DigiMundo &gt; Mundo</span>
      </div>
      <div className="border-2 border-digi-border overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
        <WorldViewer />
      </div>
    </div>
  );
}
