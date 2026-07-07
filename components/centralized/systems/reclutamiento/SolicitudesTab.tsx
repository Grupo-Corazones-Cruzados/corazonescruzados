'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import { BTN_PRIMARY, BTN_DANGER } from '@/components/ui/Button';
import {
  Inbox, Mail, Check, X, ShieldCheck, ShieldAlert, Megaphone, CalendarDays, UserPlus, Search,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'success', rejected: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada',
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Pestaña "Solicitudes": postulaciones enviadas desde el formulario "Quiero
 * postularme como candidato" de la landing (`candidate_proposals`). Lista buscable +
 * panel grande de detalle; el admin aprueba (crea cuenta de candidato) o rechaza.
 * Soporta `?solicitud=<id>` para abrir una directamente.
 */
export default function SolicitudesTab({ isAdmin }: { isAdmin: boolean }) {
  const params = useSearchParams();
  const deepLinkId = params.get('solicitud');

  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/candidate-proposals');
      const data = await res.json();
      setProposals(data.data || []);
    } catch { setProposals([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (deepLinkId && proposals.some((p) => String(p.id) === String(deepLinkId))) {
      setSelectedId(String(deepLinkId));
    }
  }, [deepLinkId, proposals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter((p) => `${p.email} ${p.reason || ''}`.toLowerCase().includes(q));
  }, [proposals, search]);

  const selected = useMemo(() => proposals.find((p) => String(p.id) === selectedId) || null, [proposals, selectedId]);

  const decide = async (p: any, action: 'approve' | 'reject') => {
    if (action === 'reject' && !window.confirm(`¿Rechazar la postulación de ${p.email}? Se eliminará y el correo quedará libre.`)) return;
    setBusyId(String(p.id));
    try {
      const res = await fetch(`/api/admin/candidate-proposals/${p.id}/${action}`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success(action === 'approve' ? 'Postulación aprobada — cuenta de candidato creada' : 'Postulación rechazada');
      if (action === 'reject' && selectedId === String(p.id)) setSelectedId(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4 items-start">
      {/* Lista */}
      <div className="min-w-0">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por correo o motivo..."
            className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
        </div>

        {loading ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><Inbox className="w-5 h-5 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin solicitudes</p>
            <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{isAdmin ? 'Aún no hay postulaciones de candidatos.' : 'No tienes acceso a las postulaciones.'}</p>
          </div>
        ) : (
          <ul className="bg-digi-card border border-digi-border rounded-lg divide-y divide-digi-border/60 overflow-hidden">
            {filtered.map((p) => {
              const active = String(p.id) === selectedId;
              return (
                <li key={p.id}>
                  <button onClick={() => setSelectedId(String(p.id))}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-l-2 ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}>
                    <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                      <span className="text-[12px] font-semibold text-accent uppercase" style={mf}>{(p.email || '?').charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{p.email}</p>
                      {p.reason && <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{p.reason}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        <PixelBadge variant={STATUS_VARIANT[p.status] || 'default'}>{STATUS_LABEL[p.status] || p.status}</PixelBadge>
                        <span className="text-[10.5px] text-digi-muted tabular-nums" style={mf}>{fmtDate(p.created_at)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalle */}
      <aside className="w-full">
        {selected ? (
          <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden lg:sticky lg:top-4">
            <div className="flex items-start gap-3 p-4 border-b border-digi-border">
              <div className="w-11 h-11 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0"><UserPlus className="w-5 h-5 text-accent" /></div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[15px] font-semibold text-digi-text leading-tight truncate" style={df}>{selected.email}</h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <PixelBadge variant={STATUS_VARIANT[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>
                  <span className="text-[11.5px] text-digi-muted" style={mf}>Postuló el {fmtDate(selected.created_at)}</span>
                </div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-[13px]">
                <Mail className="w-4 h-4 text-digi-muted shrink-0" />
                <a href={`mailto:${selected.email}`} className="text-accent hover:underline break-all" style={mf}>{selected.email}</a>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={df}>Motivo para unirse</p>
                <p className="text-[13px] text-digi-text leading-relaxed whitespace-pre-wrap rounded-lg border border-digi-border bg-digi-darker p-3" style={mf}>{selected.reason || 'Sin motivo indicado.'}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={df}>Detalles</p>
                <dl className="rounded-lg border border-digi-border divide-y divide-digi-border/60 overflow-hidden">
                  <Row Icon={selected.email_verified ? ShieldCheck : ShieldAlert} label="Correo verificado" value={<PixelBadge variant={selected.email_verified ? 'success' : 'warning'}>{selected.email_verified ? 'Verificado' : 'Sin verificar'}</PixelBadge>} />
                  <Row Icon={Megaphone} label="Acepta comunicaciones" value={<span className="text-[12.5px] text-digi-text" style={mf}>{selected.marketing ? 'Sí' : 'No'}</span>} />
                  <Row Icon={CalendarDays} label="Fecha de postulación" value={<span className="text-[12.5px] text-digi-text tabular-nums" style={mf}>{fmtDate(selected.created_at)}</span>} />
                  {selected.decided_at && (
                    <Row Icon={Check} label="Decidida" value={<span className="text-[12.5px] text-digi-text" style={mf}>{fmtDate(selected.decided_at)}{selected.decided_by ? ` · ${selected.decided_by}` : ''}</span>} />
                  )}
                </dl>
              </div>

              {isAdmin && selected.status !== 'approved' && (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => decide(selected, 'approve')} disabled={busyId === String(selected.id)} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>
                    <Check className="w-4 h-4" /> {busyId === String(selected.id) ? '...' : 'Aprobar'}
                  </button>
                  <button onClick={() => decide(selected, 'reject')} disabled={busyId === String(selected.id)} className={`${BTN_DANGER} flex-1 disabled:opacity-50`}>
                    <X className="w-4 h-4" /> Rechazar
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-xl p-10 text-center lg:sticky lg:top-4">
            <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><Inbox className="w-6 h-6 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona una solicitud</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Elige una postulación de la lista para ver su contenido completo.</p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ Icon, label, value }: { Icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-digi-card">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-digi-muted" style={mf}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-right">{value}</span>
    </div>
  );
}
