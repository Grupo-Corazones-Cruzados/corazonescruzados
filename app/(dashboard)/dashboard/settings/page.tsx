'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProfilePanel from '@/components/settings/ProfilePanel';
import CvPanel from '@/components/settings/CvPanel';
import AvailabilityPanel from '@/components/settings/AvailabilityPanel';
import PortfolioPanel from '@/components/settings/PortfolioPanel';
import { Settings, FileText, CalendarClock, Briefcase, type LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type TabKey = 'cv' | 'availability' | 'portfolio';
const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'cv', label: 'Mi CV', Icon: FileText },
  { key: 'availability', label: 'Disponibilidad', Icon: CalendarClock },
  { key: 'portfolio', label: 'Portafolio', Icon: Briefcase },
];

/**
 * Configuración: **Perfil fijo a la izquierda** + a la derecha una zona con **pestañas**
 * (CV · Disponibilidad · Portafolio). El contenido de la pestaña activa llena todo el
 * ancho disponible (layouts multi-columna) sin scroll interno — la página se desplaza si
 * hace falta. Las pestañas de miembro solo aparecen si el usuario tiene member_id.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const isMember = !!user?.member_id;
  const [tab, setTab] = useState<TabKey>('cv');

  return (
    <div>
      <h1 className="text-[20px] font-semibold text-digi-text inline-flex items-center gap-2 mb-3" style={df}>
        <Settings className="w-5 h-5 text-accent" /> Configuración
      </h1>

      {/* La fila llena el alto disponible del viewport (en desktop); las tarjetas se estiran
          (`items-stretch`) para aprovechar el espacio. Si el contenido es más alto, la fila
          crece y la página se desplaza (sin scroll interno). */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:min-h-[calc(100dvh-8rem)]">
        <ProfilePanel />

        {isMember && (
          <div className="flex-1 min-w-0 w-full flex flex-col bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
            {/* Barra de pestañas horizontal */}
            <div className="flex items-stretch border-b border-digi-border overflow-x-auto shrink-0">
              {TABS.map((t) => {
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`inline-flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${active ? 'border-accent text-accent bg-accent-light/40' : 'border-transparent text-digi-muted hover:text-digi-text'}`} style={mf}>
                    <t.Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* Contenido de la pestaña activa: llena el alto del panel (ancho completo, sin scroll interno) */}
            <div className="p-4 flex-1 min-h-0">
              {tab === 'cv' && <CvPanel />}
              {tab === 'availability' && <AvailabilityPanel />}
              {tab === 'portfolio' && <PortfolioPanel />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
