'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MessageSquare, Send } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const pf = { fontFamily: 'var(--font-body)' } as const;

/** Observaciones del cliente sobre la cotización (vista interna del responsable, con opción de agregar). */
export default function QuoteObservationsPanel({ projectId, canAdd }: { projectId: number | string; canAdd?: boolean }) {
  const [obs, setObs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/quotes/${projectId}/observations`);
      const d = await r.json();
      if (r.ok) setObs(d.data || []);
    } catch { /* ignore */ }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const body = text.trim();
    if (!body) return;
    setSending(true);
    try {
      const r = await fetch(`/api/quotes/${projectId}/observations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error');
      setObs((o) => [d.data, ...o]); setText('');
      toast.success('Observación agregada');
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSending(false); }
  };

  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
      <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-2 inline-flex items-center gap-1.5" style={pf}>
        <MessageSquare className="w-3.5 h-3.5 text-accent" /> Observaciones ({obs.length})
      </h3>

      {canAdd && (
        <div className="flex flex-col gap-2 mb-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Agrega una observación…"
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-y" style={mf} />
          <button onClick={add} disabled={sending || !text.trim()} className="self-end inline-flex items-center gap-1.5 px-3 py-1.5 bg-accent text-white text-[13px] font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
            <Send className="w-4 h-4" /> Agregar
          </button>
        </div>
      )}

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
