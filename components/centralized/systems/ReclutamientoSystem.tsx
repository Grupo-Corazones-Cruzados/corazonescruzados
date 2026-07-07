'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Inbox, Users, UserRound } from 'lucide-react';
import SolicitudesTab from './reclutamiento/SolicitudesTab';
import CandidatosTab from './reclutamiento/CandidatosTab';
import MembersTab from './reclutamiento/MembersTab';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

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

  useEffect(() => {
    fetch('/api/admin/candidate-proposals').then((r) => r.json())
      .then((d) => setPendingCount((d.data || []).filter((p: any) => p.status === 'pending').length)).catch(() => {});
    fetch('/api/admin/candidates').then((r) => r.json())
      .then((d) => setCandCount((d.data || []).length)).catch(() => {});
    fetch('/api/admin/team').then((r) => r.json())
      .then((d) => setMemberCount((d.data || []).length)).catch(() => {});
  }, []);

  const countFor = (value: string) =>
    value === 'solicitudes' ? pendingCount : value === 'candidatos' ? candCount : memberCount;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      {/* Rail: pestañas del sistema */}
      <aside className="w-full lg:w-[200px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Reclutamiento</p>
        <div className="space-y-0.5">
          {TABS.map((t) => {
            const active = tab === t.value;
            const count = countFor(t.value);
            return (
              <button key={t.value} onClick={() => setTab(t.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
                  active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
                }`}>
                <t.Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
                <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{t.label}</span>
                {count != null && count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Contenido de la pestaña activa */}
      <div className="flex-1 min-w-0 w-full">
        {tab === 'miembros' ? <MembersTab isAdmin={isAdmin} />
          : tab === 'candidatos' ? <CandidatosTab isAdmin={isAdmin} />
            : <SolicitudesTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}
