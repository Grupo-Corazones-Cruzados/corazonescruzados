'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { ChevronLeft, Share2, Boxes } from 'lucide-react';
import ShareAccessModal from '@/components/centralized/ShareAccessModal';
import SolicitudesSystem from '@/components/centralized/systems/SolicitudesSystem';
import ReclutamientoSystem from '@/components/centralized/systems/ReclutamientoSystem';
import HorarioDeVidaSystem from '@/components/centralized/systems/HorarioDeVidaSystem';
import { isPiso, isPaso, cellName as cellNameFor } from '@/lib/centralized/systems';

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function CentralizedSystemPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const routeParams = useParams();
  const piso = String(routeParams.piso || '');
  const paso = String(routeParams.paso || '');
  const slug = String(routeParams.slug || '');

  // undefined = cargando, null = no encontrado, objeto = sistema.
  const [system, setSystem] = useState<any | null | undefined>(undefined);
  const [shareOpen, setShareOpen] = useState(false);

  const fetchSystem = useCallback(async () => {
    if (!isPiso(piso) || !isPaso(paso) || !slug) { setSystem(null); return; }
    try {
      const res = await fetch(`/api/centralized/systems?piso=${piso}&paso=${paso}&slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      setSystem((data.data || [])[0] || null);
    } catch { setSystem(null); }
  }, [piso, paso, slug]);

  useEffect(() => { fetchSystem(); }, [fetchSystem]);

  if (!user?.member_id && user?.role !== 'admin') {
    return (
      <div className="bg-digi-card border border-digi-border rounded-xl text-center py-12">
        <p className="text-sm text-digi-muted" style={mf}>Solo disponible para miembros</p>
      </div>
    );
  }

  const backLink = (
    <Link href="/dashboard/centralized" className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors" style={mf}>
      <ChevronLeft className="w-4 h-4" /> Centralizado
    </Link>
  );

  if (system === undefined) {
    return (
      <div>
        <div className="mb-4">{backLink}</div>
        <div className="flex items-center justify-center py-16 text-[13px] text-digi-muted" style={mf}>Cargando…</div>
      </div>
    );
  }

  if (system === null) {
    return (
      <div>
        <div className="mb-4">{backLink}</div>
        <div className="bg-digi-card border border-digi-border rounded-xl py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3">
            <Boxes className="w-6 h-6 text-digi-muted" />
          </div>
          <p className="text-sm font-medium text-digi-text" style={mf}>Sistema no encontrado</p>
          <p className="text-[13px] text-digi-muted mt-1" style={mf}>No existe un sistema en esta ruta o no tienes acceso.</p>
        </div>
      </div>
    );
  }

  const cell = system.cell_name || cellNameFor(piso, paso);

  return (
    <div>
      {/* Breadcrumb + acciones */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-digi-border flex-wrap">
        {backLink}
        <span className="text-digi-muted/50">/</span>
        <span className="text-[12px] text-digi-muted" style={mf}>{cell}</span>
        <span className="text-digi-muted/50">/</span>
        <span className="text-[13px] font-semibold text-digi-text" style={mf}>{system.name}</span>
        {isAdmin && (
          <button
            onClick={() => setShareOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors"
            style={mf}
          >
            <Share2 className="w-3.5 h-3.5" /> Compartir acceso
          </button>
        )}
      </div>

      {/* Contenido específico del sistema (por slug) */}
      <Suspense fallback={<div className="py-12 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>}>
        {slug === 'solicitudes-y-denuncias' ? (
          <SolicitudesSystem isAdmin={isAdmin} />
        ) : slug === 'reclutamiento-y-seleccion' ? (
          <ReclutamientoSystem system={system} isAdmin={isAdmin} />
        ) : slug === 'horario-de-vida' ? (
          <HorarioDeVidaSystem system={system} isAdmin={isAdmin} />
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-xl text-center py-16">
            <div className="w-12 h-12 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3">
              <Boxes className="w-6 h-6 text-accent" />
            </div>
            <p className="text-base text-digi-text font-semibold mb-1" style={mf}>{system.name}</p>
            {system.description && <p className="text-[12px] text-digi-muted mb-3 max-w-md mx-auto" style={mf}>{system.description}</p>}
            <p className="text-[12px] text-digi-muted" style={mf}>La interfaz de este sistema estará disponible pronto.</p>
          </div>
        )}
      </Suspense>

      <ShareAccessModal system={system} open={shareOpen} onClose={() => setShareOpen(false)} onChanged={fetchSystem} />
    </div>
  );
}
