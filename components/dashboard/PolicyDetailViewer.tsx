'use client';

import FloatingWindow from '@/components/ui/FloatingWindow';
import type { PolicyDetailDoc } from '@/components/providers/PolicyEffectsProvider';
import { Target, Compass } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * Lectura (solo lectura) de un documento de detalle/términos de una política, en una
 * ventana flotante que se puede mover y redimensionar (FloatingWindow).
 */
export default function PolicyDetailViewer({
  open, detail, policyName, onClose,
}: {
  open: boolean;
  detail: PolicyDetailDoc | null;
  policyName?: string;
  onClose: () => void;
}) {
  if (!detail) return null;
  return (
    <FloatingWindow open={open} onClose={onClose} title={detail.title || 'Detalle de la política'} initialWidth={680} initialHeight={560}>
      <div className="space-y-4">
        {policyName && <p className="text-[11px] uppercase tracking-wide text-digi-muted" style={df}>Política · {policyName}</p>}

        {detail.purpose && (
          <section>
            <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text mb-1" style={mf}><Target className="w-4 h-4 text-accent" /> Propósito</h4>
            <p className="text-[13px] text-digi-text/90 leading-relaxed whitespace-pre-wrap" style={mf}>{detail.purpose}</p>
          </section>
        )}

        {detail.conduct && (
          <section>
            <h4 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text mb-1" style={mf}><Compass className="w-4 h-4 text-accent" /> Modo de actuación</h4>
            <p className="text-[13px] text-digi-text/90 leading-relaxed whitespace-pre-wrap" style={mf}>{detail.conduct}</p>
          </section>
        )}

        {detail.clauses.length > 0 && (
          <section>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-digi-muted mb-2" style={df}>Términos y condiciones</h4>
            <ol className="space-y-3">
              {detail.clauses.map((c, i) => (
                <li key={i} className="rounded-lg border border-digi-border bg-digi-darker p-3">
                  <p className="text-[13px] font-semibold text-digi-text" style={mf}>{i + 1}. {c.title || 'Cláusula'}</p>
                  {c.text && <p className="text-[12.5px] text-digi-text/85 leading-relaxed mt-1 whitespace-pre-wrap" style={mf}>{c.text}</p>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {!detail.purpose && !detail.conduct && detail.clauses.length === 0 && (
          <p className="text-[13px] text-digi-muted" style={mf}>Este detalle aún no tiene contenido.</p>
        )}
      </div>
    </FloatingWindow>
  );
}
