'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';
import DetailHeader from '@/components/ui/DetailHeader';
import PropertyRail from '@/components/ui/PropertyRail';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { Check, Send, Lock } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En proceso', resolved: 'Resuelto', closed: 'Cerrado',
};
const TYPE_L: Record<string, string> = { bug: 'Error', feature: 'Sugerencia', question: 'Pregunta', other: 'Otro' };

function MessageCard({ name, date, message, avatarUrl, initial, attachment }: {
  name: string; date: string; message: string; avatarUrl?: string; initial: string; attachment?: string;
}) {
  return (
    <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2.5 mb-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="w-8 h-8 rounded-full border border-digi-border object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-light border border-accent/20 text-accent text-[12px] font-semibold" style={mf}>{initial}</div>
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-digi-text truncate" style={mf}>{name}</p>
          <p className="text-[11px] text-digi-muted" style={mf}>{date}</p>
        </div>
      </div>
      <p className="text-[13px] text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{message}</p>
      {attachment && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={attachment} alt="Adjunto" className="mt-3 max-w-full rounded-lg border border-digi-border" style={{ maxHeight: 240 }} />
      )}
    </div>
  );
}

export default function SupportDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/support/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setTicket(data);
    } catch { toast.error('Error al cargar ticket'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/support/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: reply }),
      });
      setReply(''); toast.success('Respuesta enviada'); fetchTicket();
    } catch { toast.error('Error'); }
    finally { setSending(false); }
  };

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/support/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      toast.success('Estado actualizado'); fetchTicket();
    } catch { toast.error('Error'); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando ticket..." /></div>;
  if (!ticket) return <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center"><p className="text-sm font-semibold text-red-600">Ticket no encontrado</p></div>;

  const replies = ticket.replies || [];
  const isAdmin = user?.role === 'admin';
  const isOwner = ticket.user_id === user?.id;

  return (
    <div>
      <DetailHeader
        breadcrumb={{ label: 'Soporte', href: '/dashboard/support' }}
        title={ticket.subject}
        status={
          <span className="flex items-center gap-2">
            <PixelBadge variant="info">{TYPE_L[ticket.type] || ticket.type}</PixelBadge>
            <PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{STATUS_LABEL[ticket.status] || ticket.status}</PixelBadge>
          </span>
        }
        actions={
          <>
            {isAdmin && ticket.status !== 'resolved' && ticket.status !== 'closed' && (
              <button onClick={() => updateStatus('resolved')} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors">
                <Check className="w-4 h-4" /> Resolver
              </button>
            )}
            {(isAdmin || isOwner) && ticket.status !== 'closed' && (
              <button onClick={() => updateStatus('closed')} className={BTN_SECONDARY}><Lock className="w-4 h-4" /> Cerrar</button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        <div className="min-w-0 space-y-3">
        {/* Conversation thread */}
        <div className="space-y-3">
        <MessageCard
          name={[ticket.first_name, ticket.last_name].filter(Boolean).join(' ') || ticket.user_email}
          date={new Date(ticket.created_at).toLocaleString('es-EC')}
          message={ticket.message}
          avatarUrl={ticket.avatar_url}
          initial={(ticket.first_name?.[0] || ticket.user_email?.[0] || '?').toUpperCase()}
          attachment={ticket.attachment_url}
        />
        {replies.map((r: any) => (
          <MessageCard key={r.id}
            name={[r.first_name, r.last_name].filter(Boolean).join(' ') || 'Usuario'}
            date={new Date(r.created_at).toLocaleString('es-EC')}
            message={r.message}
            avatarUrl={r.avatar_url}
            initial={(r.first_name?.[0] || '?').toUpperCase()}
            attachment={r.attachment_url}
          />
        ))}
      </div>

        {/* Reply form */}
        {ticket.status !== 'closed' ? (
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
            <h3 className="text-[13px] font-semibold text-digi-text mb-2" style={mf}>Responder</h3>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} placeholder="Escribe tu respuesta..."
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none mb-3" style={mf} />
            <div className="flex justify-end">
              <button onClick={sendReply} disabled={sending || !reply.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50">
                <Send className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar respuesta'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-digi-muted text-center py-4" style={mf}>Este ticket está cerrado.</p>
        )}
        </div>

        <PropertyRail
          title="Detalles"
          items={[
            { label: 'Solicitante', value: [ticket.first_name, ticket.last_name].filter(Boolean).join(' ') || ticket.user_email || '—' },
            { label: 'Tipo', value: TYPE_L[ticket.type] || ticket.type },
            { label: 'Estado', value: <PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{STATUS_LABEL[ticket.status] || ticket.status}</PixelBadge> },
            { label: 'Respuestas', value: String(replies.length) },
            { label: 'Creado', value: new Date(ticket.created_at).toLocaleDateString('es-EC') },
          ]}
        />
      </div>
    </div>
  );
}
