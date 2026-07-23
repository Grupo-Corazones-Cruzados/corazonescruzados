'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import BrandLoader from '@/components/ui/BrandLoader';
import RazonesPanel from '@/components/razones/RazonesPanel';
import { Globe, Image as ImageIcon, Flame, ShieldAlert } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Panel de administración = DigiMundo. Mundo y Sprites del videojuego + "Razones"
// (cuaderno personal del admin, tipo Pensamientos, sin clasificación por IA).
const TABS = [
  { value: 'world', label: 'Mundo', Icon: Globe },
  { value: 'sprites', label: 'Sprites', Icon: ImageIcon },
  { value: 'razones', label: 'Razones', Icon: Flame },
];

const WorldViewer = dynamic(() => import('@/app/(main)/world/page'), {
  ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando mundo..." /></div>,
});
const SpritesEditor = dynamic(() => import('@/app/(main)/sprites/page'), {
  ssr: false, loading: () => <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando sprites..." /></div>,
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
      <PageHeader title="Admin" description="Mundo, sprites y tus razones de lucha" />

      {/* ── Pestañas horizontales (arriba) ── */}
      <div className="flex items-center gap-1 bg-digi-card border border-digi-border rounded-lg p-1 mb-4 overflow-x-auto">
        {TABS.map((t) => {
          const active = tab === t.value;
          return (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md whitespace-nowrap transition-colors ${
                active ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.03]'
              }`}>
              <t.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
              <span className="text-[12.5px] font-medium" style={mf}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Contenido ── */}
      <div className="w-full">
        {tab === 'world' && (
          <div className="border border-digi-border rounded-lg overflow-hidden relative" style={{ height: 'calc(100vh - 200px)', minHeight: 400 }}>
            <div className="absolute inset-0 overflow-hidden [&>div]:!m-0 [&>div]:!h-full"><WorldViewer /></div>
          </div>
        )}
        {tab === 'sprites' && <SpritesEditor />}
        {tab === 'razones' && <RazonesPanel />}
      </div>
    </div>
  );
}
