'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import BrandLoader from '@/components/ui/BrandLoader';
import { Globe, Image as ImageIcon, ShieldAlert } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

// Panel de administración = DigiMundo. Quedan solo Mundo y Sprites (los proyectos e
// incidentes del DigiMundo se retiraron; los incidentes viven ahora en cada proyecto
// del módulo de Proyectos).
const TABS = [
  { value: 'world', label: 'Mundo', Icon: Globe },
  { value: 'sprites', label: 'Sprites', Icon: ImageIcon },
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
      <PageHeader title="DigiMundo" description="Mundo y sprites del videojuego" />

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
          {tab === 'sprites' && <SpritesEditor />}
        </div>
      </div>
    </div>
  );
}
