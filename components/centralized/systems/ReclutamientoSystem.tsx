'use client';

import { useSearchParams } from 'next/navigation';
import { UserPlus, Users, ClipboardCheck, ArrowRight } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * Sistema "Reclutamiento y Selección" (celda Centralizado / Global · Implementación).
 *
 * Andamiaje inicial: aquí se construirá el flujo de reclutamiento y selección de
 * candidatos. La página ya soporta parámetros en la URL para acceso rápido — p. ej.
 * `?candidato=123` abrirá directo el detalle de ese candidato. Este componente lee
 * ese parámetro y lo deja listo para el desarrollo futuro.
 */
export default function ReclutamientoSystem({ isAdmin }: { system: any; isAdmin: boolean }) {
  const params = useSearchParams();
  const candidatoId = params.get('candidato');

  return (
    <div className="space-y-4">
      {candidatoId && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-light px-3 py-2 text-[12.5px] text-accent" style={mf}>
          <ArrowRight className="w-4 h-4 shrink-0" />
          Acceso directo por URL detectado — candidato <span className="font-semibold">#{candidatoId}</span>. (Pendiente: abrir su detalle.)
        </div>
      )}

      <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-digi-text" style={df}>Reclutamiento y Selección</h2>
            <p className="text-[12px] text-digi-muted" style={mf}>Flujo de candidatos: recepción, evaluación y selección.</p>
          </div>
        </div>

        <p className="text-[13px] text-digi-text leading-relaxed" style={mf}>
          Este sistema está listo para desarrollarse. Tiene su propia ruta estable
          (<code className="text-[12px] text-accent bg-accent-light rounded px-1 py-0.5">/dashboard/centralized/global/implementacion/reclutamiento-y-seleccion</code>)
          y admite parámetros para acceso rápido a registros.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {[
            { Icon: Users, title: 'Candidatos', desc: 'Listado y búsqueda de postulantes.' },
            { Icon: ClipboardCheck, title: 'Evaluación', desc: 'Etapas y criterios de selección.' },
            { Icon: UserPlus, title: 'Afiliación', desc: 'Conversión candidato → miembro.' },
          ].map(({ Icon, title, desc }) => (
            <div key={title} className="rounded-lg border border-digi-border bg-digi-darker p-3">
              <Icon className="w-4 h-4 text-accent mb-1.5" />
              <p className="text-[13px] font-medium text-digi-text" style={mf}>{title}</p>
              <p className="text-[11.5px] text-digi-muted mt-0.5" style={mf}>{desc}</p>
            </div>
          ))}
        </div>

        {!isAdmin && (
          <p className="text-[11.5px] text-digi-muted mt-4" style={mf}>
            Como miembro con acceso, aquí verás y gestionarás lo que corresponda a tu rol.
          </p>
        )}
      </div>
    </div>
  );
}
