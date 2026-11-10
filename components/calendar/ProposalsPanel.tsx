'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Inbox, Check, X, RefreshCw, Repeat } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { MONTH_LABELS_ES } from '@/lib/calendar/recurrence';

const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  timezone: string;
  recurrence_type: string;
  recurrence_days: number[] | null;
  recurrence_until: string | null;
  created_at: string;
  proposer_email: string | null;
  proposer_first_name: string | null;
  proposer_last_name: string | null;
  proposer_guest_name: string | null;
}

function fmt(d: Date, tz?: string) {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (tz) {
    return new Intl.DateTimeFormat('es-EC', {
      timeZone: tz, day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(d);
  }
  return `${pad(d.getDate())} ${MONTH_LABELS_ES[d.getMonth()].slice(0, 3)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface Props {
  onDecision?: () => void;
}

export default function ProposalsPanel({ onDecision }: Props) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/members/calendar/proposals');
      const data = await res.json();
      setProposals(data.data || []);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respond = async (id: string, action: 'accept' | 'reject') => {
    setBusy(id);
    try {
      const res = await fetch(`/api/members/calendar/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast.success(action === 'accept' ? 'Propuesta aceptada' : 'Propuesta rechazada');
      await load();
      onDecision?.();
    } catch {
      toast.error('Error al responder');
    } finally {
      setBusy(null);
    }
  };

  /*
   * UN ESPACIO PROPIO BAJO LAS TAREAS (Fernando, 2026-11-09: «al tener que deslizarse de página para
   * verlas se pierde mucho esa información»). Antes era una tarjeta ancha bajo el calendario. Ahora es
   * la parte de abajo del raíl derecho de Mi día, con su cabecera como la de Tareas y su propio
   * desplazamiento: siempre a la vista, también cuando no hay ninguna.
   */
  return (
    <section className="flex flex-col min-h-0 max-xl:border-t border-digi-border">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-digi-dark border-y border-digi-border shrink-0">
        <Inbox className="w-4 h-4 text-digi-muted" />
        <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Propuestas</span>
        <span className={`text-[11px] tabular-nums ${proposals.length ? 'text-accent font-semibold' : 'text-digi-muted'}`} style={mf}>{loading ? '' : proposals.length}</span>
        <button onClick={load} title="Refrescar" aria-label="Refrescar propuestas"
          className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded text-digi-muted hover:text-accent transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-2.5 space-y-2 flex-1 min-h-0 xl:overflow-y-auto">
        {!loading && proposals.length === 0 && (
          <p className="text-[12px] text-digi-muted text-center py-4" style={mf}>Sin propuestas pendientes.</p>
        )}
        {proposals.map((p) => {
          const proposer = [p.proposer_first_name, p.proposer_last_name].filter(Boolean).join(' ').trim()
            || p.proposer_guest_name
            || p.proposer_email
            || 'Cliente';
          const tz = p.timezone || undefined;
          const mismaZona = !p.timezone || p.timezone === 'America/Guayaquil';
          return (
            <div key={p.id} className="rounded-lg border border-digi-border bg-digi-darker/40 p-2.5">
              <p className="text-[12.5px] font-medium text-digi-text leading-snug" style={mf}>{p.title}</p>
              <p className="text-[11px] text-digi-muted mt-0.5 truncate" style={mf} title={p.proposer_email || undefined}>De: {proposer}</p>

              <div className="mt-1.5 space-y-1 text-[11.5px]" style={mf}>
                <p className="text-digi-text"><span className="text-digi-muted">Ecuador · </span>{fmt(new Date(p.start_at), 'America/Guayaquil')} — {fmt(new Date(p.end_at), 'America/Guayaquil')}</p>
                {!mismaZona && (
                  <p className="text-digi-text"><span className="text-digi-muted">Cliente ({p.timezone}) · </span>{fmt(new Date(p.start_at), tz)} — {fmt(new Date(p.end_at), tz)}</p>
                )}
              </div>

              {p.recurrence_type === 'weekly' && p.recurrence_days && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-digi-muted" style={mf}>
                  <Repeat className="w-3 h-3 shrink-0" />
                  {p.recurrence_days.map((d) => ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'][d]).join(' · ')}
                  {p.recurrence_until && ` · hasta ${p.recurrence_until}`}
                </p>
              )}

              {p.description && (
                <p className="mt-1.5 text-[11.5px] text-digi-text whitespace-pre-wrap line-clamp-4" style={mf} title={p.description}>{p.description}</p>
              )}

              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button onClick={() => respond(p.id, 'reject')} disabled={busy === p.id} className={`${BTN_SECONDARY} px-2 py-1 text-[12px]`} style={mf}>
                  <X className="w-3.5 h-3.5" /> Rechazar
                </button>
                <button onClick={() => respond(p.id, 'accept')} disabled={busy === p.id} className={`${BTN_PRIMARY} px-2 py-1 text-[12px]`} style={mf}>
                  <Check className="w-3.5 h-3.5" /> Aceptar
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
