'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmado',
  in_progress: 'En progreso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  withdrawn: 'Retirado',
};

export default function PublicTicketPage() {
  const { id } = useParams();
  const search = useSearchParams();
  const token = search.get('token');
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/tickets/${id}/public?token=${encodeURIComponent(token || '')}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error || 'Error'); return; }
        setTicket(json.data);
      } catch {
        setError('Error al cargar ticket');
      } finally { setLoading(false); }
    })();
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-digi-dark flex items-center justify-center">
        <p className="text-[10px] text-accent-glow" style={pf}>Cargando...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-digi-dark flex items-center justify-center px-4">
        <div className="pixel-card max-w-md w-full text-center">
          <p className="text-[10px] text-red-400 mb-2" style={pf}>No se pudo cargar el ticket</p>
          <p className="text-xs text-digi-muted" style={mf}>{error || 'Ticket no disponible'}</p>
        </div>
      </div>
    );
  }

  const timeSlots = ticket.time_slots || [];
  const actions = ticket.actions || [];
  const fmtDate = (d: string) => new Date(String(d).split('T')[0] + 'T12:00:00').toLocaleDateString();

  return (
    <div className="min-h-screen bg-digi-dark py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <p className="text-[10px] text-accent-glow opacity-60" style={pf}>GCC WORLD</p>
          <h1 className="text-xl text-white mt-1" style={pf}>{ticket.title}</h1>
          <p className="text-[10px] text-digi-muted mt-1" style={mf}>
            Ticket #{ticket.id} - {STATUS_LABEL[ticket.status] || ticket.status}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {ticket.description && (
              <div className="pixel-card">
                <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Descripcion</h3>
                <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{ticket.description}</p>
              </div>
            )}

            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Dias de Trabajo</h3>
              {timeSlots.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {timeSlots.map((slot: any, i: number) => (
                    <div key={i} className="px-2 py-1.5 border border-digi-border/50 text-center">
                      <p className="text-xs text-digi-text" style={mf}>{fmtDate(slot.date)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-digi-muted/50" style={mf}>Sin dias asignados</p>
              )}
            </div>

            <div className="pixel-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-accent-glow" style={pf}>Acciones Realizadas</h3>
                {Number(ticket.estimated_cost) > 0 && (
                  <span className="text-[9px] text-digi-muted" style={mf}>
                    Total ${Number(ticket.actions_total).toFixed(2)} / ${Number(ticket.estimated_cost).toFixed(2)}
                  </span>
                )}
              </div>
              {actions.length > 0 ? (
                <div className="space-y-2">
                  {actions.map((a: any) => (
                    <div key={a.id} className="px-2 py-1.5 border border-digi-border/50">
                      <p className="text-xs text-digi-text break-words" style={mf}>{a.description}</p>
                      <p className="text-[9px] text-digi-muted" style={mf}>
                        {fmtDate(a.created_at)} - ${Number(a.cost).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-digi-muted/50" style={mf}>Sin acciones registradas</p>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Detalles</h3>
              <div className="space-y-2 text-[10px]" style={mf}>
                <Row label="Cliente" value={ticket.client_name || '-'} />
                <Row label="Miembro" value={ticket.member_name || '-'} />
                <Row label="Servicio" value={ticket.service_name || '-'} />
                <Row label="Limite" value={ticket.deadline ? fmtDate(ticket.deadline) : '-'} />
                <Row label="Horas est." value={ticket.estimated_hours ? `${ticket.estimated_hours}h` : '-'} />
                <Row label="Costo est." value={ticket.estimated_cost ? `$${Number(ticket.estimated_cost).toFixed(2)}` : '-'} />
                <Row label="Creado" value={fmtDate(ticket.created_at)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-digi-border/30 last:border-0">
      <span className="text-digi-muted">{label}</span>
      <span className="text-digi-text text-right">{value}</span>
    </div>
  );
}
