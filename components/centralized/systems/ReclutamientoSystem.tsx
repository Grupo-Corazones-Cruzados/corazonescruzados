'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, Users, UserRound } from 'lucide-react';
import SolicitudesTab from './reclutamiento/SolicitudesTab';
import CandidatosTab from './reclutamiento/CandidatosTab';
import MembersTab from './reclutamiento/MembersTab';
import FilterRail from '@/components/ui/FilterRail';

const mf = { fontFamily: 'var(--font-body)' } as const;

const TABS = [
  { value: 'solicitudes', label: 'Solicitudes', Icon: Inbox },
  { value: 'candidatos', label: 'Candidatos', Icon: Users },
  { value: 'miembros', label: 'Miembros', Icon: UserRound },
] as const;

/**
 * Sistema "Reclutamiento y Selección" (celda Centralizado / Global · Implementación).
 * Rail con pestañas: "Solicitudes" (postulaciones) y "Candidatos" (aprobados con
 * perfil completo + sus criterios). Deep-links: `?tab=candidatos`, `?solicitud=<id>`,
 * `?candidato=<id>`.
 */
export default function ReclutamientoSystem({ isAdmin }: { system: any; isAdmin: boolean }) {
  const params = useSearchParams();
  const initialTab =
    params.get('tab') === 'miembros' || params.get('miembro') ? 'miembros'
      : params.get('tab') === 'candidatos' || params.get('candidato') ? 'candidatos'
        : 'solicitudes';
  const [tab, setTab] = useState<string>(initialTab);

  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [candCount, setCandCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);

  // Cuenta cada pestaña con la MISMA fuente/filtro que su lista (candidatos ya
  // excluye convertidos; miembros solo activos). Se re-carga tras cada conversión.
  const loadCounts = useCallback(() => {
    fetch('/api/admin/candidate-proposals').then((r) => r.json())
      .then((d) => setPendingCount((d.data || []).filter((p: any) => p.status === 'pending').length)).catch(() => {});
    fetch('/api/admin/candidates').then((r) => r.json())
      .then((d) => setCandCount((d.data || []).length)).catch(() => {});
    fetch('/api/admin/team').then((r) => r.json())
      .then((d) => setMemberCount((d.data || []).filter((m: any) => m.is_active).length)).catch(() => {});
  }, []);

  useEffect(() => { loadCounts(); }, [loadCounts]);

  const countFor = (value: string) =>
    value === 'solicitudes' ? pendingCount : value === 'candidatos' ? candCount : memberCount;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Rail: pestañas del sistema */}
      <FilterRail
        title="Reclutamiento"
        items={TABS.map((t) => ({ value: t.value, label: t.label, Icon: t.Icon, count: countFor(t.value) ?? 0 }))}
        value={tab}
        onChange={setTab}
        hideZeroCounts
      />

      {/* Contenido de la pestaña activa */}
      <div className="flex-1 min-w-0 w-full">
        {tab === 'miembros' ? <MembersTab isAdmin={isAdmin} onChanged={loadCounts} />
          : tab === 'candidatos' ? <CandidatosTab isAdmin={isAdmin} onChanged={loadCounts} />
            : <SolicitudesTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
