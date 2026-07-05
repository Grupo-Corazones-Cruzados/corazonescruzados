'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import BrandLoader from '@/components/ui/BrandLoader';

const SpritesEditor = dynamic(
  () => import('@/app/(main)/sprites/page'),
  { ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando sprites..." /></div> }
);

export default function AdminSpritesPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Link href="/dashboard/admin" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[12px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>DigiMundo &gt; Sprites</span>
      </div>
      <div className="border border-digi-border rounded-lg overflow-hidden" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <SpritesEditor />
      </div>
    </div>
  );
}
