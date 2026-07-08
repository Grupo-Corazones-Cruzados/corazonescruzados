'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import ProfilePanel from '@/components/settings/ProfilePanel';
import CvPanel from '@/components/settings/CvPanel';
import AvailabilityPanel from '@/components/settings/AvailabilityPanel';
import PortfolioPanel from '@/components/settings/PortfolioPanel';
import { Settings } from 'lucide-react';

const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * Configuración: carril horizontal de paneles (Perfil → CV → Disponibilidad → Portafolio).
 * Todos con el MISMO ancho, alto = alto disponible de la página, y scroll vertical interno.
 * Se desliza horizontalmente para ver los siguientes. Los paneles de miembro solo aparecen
 * si el usuario tiene member_id.
 */
export default function SettingsPage() {
  const { user } = useAuth();
  const isMember = !!user?.member_id;
  const rowRef = useRef<HTMLDivElement>(null);
  const [rowH, setRowH] = useState(600);

  useEffect(() => {
    const recompute = () => {
      const el = rowRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      // Deja libre el breadcrumb fijo (h-9 = 36px) + un pequeño margen.
      setRowH(Math.max(360, window.innerHeight - top - 44));
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, [isMember]);

  return (
    <div>
      <h1 className="text-[20px] font-semibold text-digi-text inline-flex items-center gap-2 mb-3" style={df}>
        <Settings className="w-5 h-5 text-accent" /> Configuración
      </h1>

      <div ref={rowRef} className="flex gap-4 overflow-x-auto pb-2" style={{ height: rowH }}>
        <ProfilePanel />
        {isMember && <CvPanel />}
        {isMember && <AvailabilityPanel />}
        {isMember && <PortfolioPanel />}
      </div>
    </div>
  );
}
