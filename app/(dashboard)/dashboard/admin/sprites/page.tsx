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
        <Link href="/dashboard/admin" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={{ fontFamily: "'Silkscreen', cursive" }}>
          &lt; Volver a Admin
        </Link>
        <span className="text-[10px] text-digi-muted" style={{ fontFamily: "'Silkscreen', cursive" }}>DigiMundo &gt; Sprites</span>
      </div>
      <div className="border-2 border-digi-border overflow-hidden" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <SpritesEditor />
      </div>
    </div>
  );
}
