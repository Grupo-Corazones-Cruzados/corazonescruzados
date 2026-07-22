'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const pf = { fontFamily: 'var(--font-body)' } as const;

/** Observaciones del cliente/externo sobre la cotización (vista interna del responsable). */
export default function QuoteObservationsPanel({ projectId }: { projectId: number | string }) {
  const [obs, setObs] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/quotes/${projectId}/observations`);
      const d = await r.json();
      if (r.ok) setObs(d.data || []);
    } catch { /* ignore */ }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-2 inline-flex items-center gap-1.5" style={pf}>
        <MessageSquare className="w-3.5 h-3.5 text-accent" /> Observaciones del cliente ({obs.length})
      </h3>
      {obs.length === 0 ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Aún no hay observaciones. El cliente puede dejarlas desde el enlace compartido.</p>
      ) : (
        <div className="space-y-2">
          {obs.map((o) => (
            <div key={o.id} className="border border-digi-border rounded-lg px-2.5 py-2 bg-digi-darker/40">
              <p className="text-[12px] text-digi-text whitespace-pre-wrap" style={mf}>{o.body}</p>
              <p className="text-[10.5px] text-digi-muted mt-1" style={mf}>{o.author_name || 'Cliente'} · {new Date(o.created_at).toLocaleString('es-EC')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
