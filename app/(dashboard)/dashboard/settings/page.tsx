'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProfilePanel from '@/components/settings/ProfilePanel';
import CvPanel from '@/components/settings/CvPanel';
import AvailabilityPanel from '@/components/settings/AvailabilityPanel';
import PortfolioPanel from '@/components/settings/PortfolioPanel';
import PanelCompartirCv from '@/components/settings/PanelCompartirCv';
import { FileText, CalendarClock, Briefcase, Share2, type LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

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
  const [compartir, setCompartir] = useState(false);

  return (
    <div>
      {/* La fila llena el alto disponible del viewport (en desktop); las tarjetas se estiran
          (`items-stretch`) para aprovechar el espacio. Si el contenido es más alto, la fila
          crece y la página se desplaza (sin scroll interno). */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:min-h-[calc(100dvh-8rem)]">
        <ProfilePanel />

        {isMember && (
          <div className="flex-1 min-w-0 w-full flex flex-col bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
            {/* Barra de pestañas + «Compartir CV» a la derecha, como el «Compartir
                acceso» de un proyecto.

                ⚠️ **NADA DE `overflow-x-auto` AQUÍ.** La primera versión lo puso en
                el grupo de pestañas «por si algún día no caben», y con tres pestañas
                y sitio de sobra el navegador dibujaba igualmente su barra horizontal:
                se comía alto y asomaba un cuadrito en la esquina. Lo vio Fernando.
                Un contenedor de scroll que nunca desplaza nada solo estorba; si algún
                día hicieran falta más pestañas, se envuelven (`flex-wrap`), que en
                una barra ancha es mejor gesto que arrastrar de lado.

                `justify-between` en vez del hueco `flex-1`: es la misma colocación con
                un elemento menos. */}
            <div className="flex items-stretch justify-between gap-2 border-b border-digi-border shrink-0">
              <div className="flex items-stretch flex-wrap">
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
              <div className="flex items-center shrink-0 px-2">
                <button onClick={() => setCompartir(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-accent text-accent text-[13px] font-medium rounded hover:bg-accent-light transition-colors whitespace-nowrap" style={mf}>
                  <Share2 className="w-4 h-4" /> Compartir CV
                </button>
              </div>
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

      {/* Panel lateral derecho con overlay: el mismo diseño que «Compartir acceso»
          de una cotización. */}
      <PanelCompartirCv open={compartir} onClose={() => setCompartir(false)} />
    </div>
  );
}
