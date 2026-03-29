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
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};
const TYPE_L: Record<string, string> = { bug: 'Error', feature: 'Sugerencia', question: 'Pregunta', other: 'Otro' };

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
    } catch {
      toast.error('Error al cargar ticket');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  const sendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      });
      setReply('');
      toast.success('Respuesta enviada');
      fetchTicket();
    } catch { toast.error('Error'); }
    finally { setSending(false); }
  };

  const updateStatus = async (status: string) => {
    try {
      await fetch(`/api/support/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      toast.success('Estado actualizado');
      fetchTicket();
    } catch { toast.error('Error'); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando ticket..." /></div>;
  if (!ticket) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-400">Ticket no encontrado</p></div>;

  const replies = ticket.replies || [];

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <Link href="/dashboard/support" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>&lt; Volver a soporte</Link>
      </div>

      <PageHeader
        title={ticket.subject}
        action={
          <div className="flex gap-2">
            <PixelBadge variant="info">{TYPE_L[ticket.type] || ticket.type}</PixelBadge>
            <PixelBadge variant={STATUS_V[ticket.status] || 'default'}>{ticket.status}</PixelBadge>
          </div>
        }
      />

      {/* Original message */}
      <div className="pixel-card mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 flex items-center justify-center bg-accent/20 border border-accent/30 text-accent-glow text-[8px]" style={pf}>
            {(ticket.first_name?.[0] || ticket.user_email?.[0] || '?').toUpperCase()}
          </div>
          <div>
            <p className="text-[10px] text-digi-text" style={pf}>
              {[ticket.first_name, ticket.last_name].filter(Boolean).join(' ') || ticket.user_email}
            </p>
            <p className="text-[8px] text-digi-muted" style={mf}>{new Date(ticket.created_at).toLocaleString()}</p>
          </div>
        </div>
        <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{ticket.message}</p>
        {ticket.attachment_url && (
          <img src={ticket.attachment_url} alt="Adjunto" className="mt-3 max-w-full border border-digi-border" style={{ maxHeight: 200 }} />
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-2 mb-4">
          {replies.map((r: any) => (
            <div key={r.id} className="pixel-card">
              <div className="flex items-center gap-2 mb-2">
                {r.avatar_url ? (
                  <img src={r.avatar_url} alt="" className="w-6 h-6 border border-accent/30 object-cover" />
                ) : (
                  <div className="w-6 h-6 flex items-center justify-center bg-accent/20 border border-accent/30 text-accent-glow text-[8px]" style={pf}>
                    {(r.first_name?.[0] || '?').toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-digi-text" style={pf}>
                    {[r.first_name, r.last_name].filter(Boolean).join(' ') || 'Usuario'}
                  </p>
                  <p className="text-[8px] text-digi-muted" style={mf}>{new Date(r.created_at).toLocaleString()}</p>
                </div>
              </div>
              <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{r.message}</p>
              {r.attachment_url && (
                <img src={r.attachment_url} alt="Adjunto" className="mt-2 max-w-full border border-digi-border" style={{ maxHeight: 200 }} />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply form */}
      {ticket.status !== 'closed' && (
        <div className="pixel-card">
          <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Responder</h3>
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            placeholder="Escribe tu respuesta..."
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none mb-3"
            style={mf}
          />
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {user?.role === 'admin' && ticket.status !== 'resolved' && (
                <button onClick={() => updateStatus('resolved')} className="text-[9px] text-green-400 border border-green-500/30 px-2 py-1 hover:bg-green-900/20 transition-colors" style={pf}>Resolver</button>
              )}
              {(user?.role === 'admin' || ticket.user_id === user?.id) && (
                <button onClick={() => updateStatus('closed')} className="text-[9px] text-digi-muted border border-digi-border px-2 py-1 hover:bg-digi-border/30 transition-colors" style={pf}>Cerrar</button>
              )}
            </div>
            <button onClick={sendReply} disabled={sending || !reply.trim()} className="pixel-btn pixel-btn-primary text-[9px] disabled:opacity-50">
              {sending ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
