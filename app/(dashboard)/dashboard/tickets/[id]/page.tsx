'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', confirmed: 'info', in_progress: 'info',
  completed: 'success', cancelled: 'error', withdrawn: 'default',
};

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setTicket(data);
    } catch {
      toast.error('Error al cargar ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const updateStatus = async (status: string, extra?: Record<string, any>) => {
    try {
      await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      toast.success('Estado actualizado');
      fetchTicket();
    } catch { toast.error('Error'); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando ticket..." /></div>;
  if (!ticket) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-400">Ticket no encontrado</p></div>;

  const timeSlots = ticket.time_slots || [];

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <Link href="/dashboard/tickets" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>&lt; Volver a tickets</Link>
      </div>

      <PageHeader
        title={ticket.title || `Ticket #${ticket.id}`}
        action={<PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{ticket.status}</PixelBadge>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Main */}
        <div className="md:col-span-2 space-y-4">
          {ticket.description && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Descripcion</h3>
              <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{ticket.description}</p>
            </div>
          )}

          {/* Work days */}
          {timeSlots.length > 0 && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Dias de Trabajo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {timeSlots.map((slot: any, i: number) => (
                  <div key={i} className="px-2 py-1.5 border border-digi-border/50 text-center">
                    <p className="text-xs text-digi-text" style={mf}>{new Date(slot.date).toLocaleDateString()}</p>
                    {slot.start_time && (
                      <p className="text-[9px] text-digi-muted" style={mf}>{slot.start_time} - {slot.end_time}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Meet link */}
          {ticket.meet_link && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Enlace de Reunion</h3>
              <a href={ticket.meet_link} target="_blank" rel="noopener noreferrer"
                className="text-xs text-accent-glow hover:underline break-all" style={mf}>{ticket.meet_link}</a>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="pixel-card">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Detalles</h3>
            <div className="space-y-2 text-[10px]" style={mf}>
              <DetailRow label="Cliente" value={ticket.client_name || '-'} />
              <DetailRow label="Miembro" value={ticket.member_name || '-'} />
              <DetailRow label="Servicio" value={ticket.service_name || '-'} />
              <DetailRow label="Limite" value={ticket.deadline ? new Date(ticket.deadline).toLocaleDateString() : '-'} />
              <DetailRow label="Horas est." value={ticket.estimated_hours ? `${ticket.estimated_hours}h` : '-'} />
              <DetailRow label="Costo est." value={ticket.estimated_cost ? `$${ticket.estimated_cost}` : '-'} />
              <DetailRow label="Creado" value={new Date(ticket.created_at).toLocaleDateString()} />
            </div>
          </div>

          {/* Actions */}
          {(user?.role === 'admin' || user?.role === 'member') && !['completed', 'cancelled', 'withdrawn'].includes(ticket.status) && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Acciones</h3>
              <div className="space-y-1.5">
                {ticket.status === 'pending' && (
                  <button onClick={() => updateStatus('confirmed')} className="pixel-btn pixel-btn-primary w-full text-[9px]">Confirmar</button>
                )}
                {(ticket.status === 'confirmed' || ticket.status === 'in_progress') && (
                  <button onClick={() => updateStatus('completed')} className="pixel-btn pixel-btn-primary w-full text-[9px]">Completar</button>
                )}
                <button onClick={() => updateStatus('cancelled')} className="w-full py-1.5 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-digi-border/30 last:border-0">
      <span className="text-digi-muted">{label}</span>
      <span className="text-digi-text text-right">{value}</span>
    </div>
  );
}
