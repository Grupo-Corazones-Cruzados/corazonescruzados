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

  if (loading) return null;
  if (proposals.length === 0) return null;

  return (
    <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Inbox className="w-4 h-4 text-accent" />
          <h3 className="text-[14px] font-semibold text-digi-text" style={pf}>
            Propuestas pendientes ({proposals.length})
          </h3>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 text-[12px] text-digi-muted hover:text-accent transition-colors"
          style={mf}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refrescar
        </button>
      </div>

      <div className="space-y-2">
        {proposals.map((p) => {
          const proposer = [p.proposer_first_name, p.proposer_last_name].filter(Boolean).join(' ').trim()
            || p.proposer_email
            || 'Cliente';
          return (
            <div key={p.id} className="rounded-lg border border-digi-border bg-digi-darker p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-digi-text truncate" style={mf}>{p.title}</div>
                  <div className="text-[12px] text-digi-muted mt-0.5" style={mf}>
                    De: {proposer}{p.proposer_email && ` · ${p.proposer_email}`}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => respond(p.id, 'accept')}
                    disabled={busy === p.id}
                    className={`${BTN_PRIMARY} px-2.5 py-1 text-[12px]`}
                    style={mf}
                  >
                    <Check className="w-4 h-4" /> Aceptar
                  </button>
                  <button
                    onClick={() => respond(p.id, 'reject')}
                    disabled={busy === p.id}
                    className={`${BTN_SECONDARY} px-2.5 py-1 text-[12px]`}
                    style={mf}
                  >
                    <X className="w-4 h-4" /> Rechazar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[12px]" style={mf}>
                <div className="rounded-md border border-digi-border px-2 py-1">
                  <div className="text-digi-muted">Ecuador (GMT-5)</div>
                  <div className="text-digi-text">
                    {fmt(new Date(p.start_at), 'America/Guayaquil')} — {fmt(new Date(p.end_at), 'America/Guayaquil')}
                  </div>
                </div>
                <div className="rounded-md border border-digi-border px-2 py-1">
                  <div className="text-digi-muted">Cliente ({p.timezone || '—'})</div>
                  <div className="text-digi-text">
                    {fmt(new Date(p.start_at), p.timezone || undefined)} — {fmt(new Date(p.end_at), p.timezone || undefined)}
                  </div>
                </div>
              </div>

              {p.recurrence_type === 'weekly' && p.recurrence_days && (
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
                  <Repeat className="w-3.5 h-3.5" />
                  Recurrente: {p.recurrence_days.map((d) => ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'][d]).join(' · ')}
                  {p.recurrence_until && ` · hasta ${p.recurrence_until}`}
                </div>
              )}

              {p.description && (
                <div className="mt-2 text-[13px] text-digi-text whitespace-pre-wrap border-t border-digi-border pt-2" style={mf}>
                  {p.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
