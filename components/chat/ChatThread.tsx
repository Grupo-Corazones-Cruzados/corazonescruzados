'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { MessageCircle, Send, Loader2, AlertCircle } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface Msg {
  id: number; userId: string; authorName: string;
  authorAvatar: string | null; authorRole: string; body: string; createdAt: string;
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Miembro', client: 'Cliente' };

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'America/Guayaquil' });
export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const fmtDayLabel = (iso: string) => {
  const today = dayKey(new Date().toISOString());
  const yest = dayKey(new Date(Date.now() - 86400000).toISOString());
  const k = dayKey(iso);
  if (k === today) return 'Hoy';
  if (k === yest) return 'Ayer';
  return new Date(iso).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Guayaquil' });
};
export const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; m: Msg; chained: boolean };

/**
 * Hilo de mensajes reusable: lista + compositor. Definición ÚNICA que comparten el **chat
 * grupal** y los **chats de ticket/proyecto/experiencia**, para que ambos se comporten igual.
 *
 * El padre es dueño de los datos (sondeo, envío, paginación); aquí vive solo la presentación
 * y el comportamiento del scroll, que es la parte delicada:
 *  - no arrastra la vista hacia abajo si el usuario subió a leer historial;
 *  - al cargar mensajes antiguos conserva la posición visual.
 */
export default function ChatThread({
  messages, me, loading, sending, err, emptyText = 'Todavía no hay mensajes',
  hasMore, loadingMore, onLoadMore, onSend, disabled,
}: {
  messages: Msg[]; me: string; loading: boolean; sending: boolean; err?: string | null;
  emptyText?: string;
  hasMore: boolean; loadingMore: boolean; onLoadMore: () => void;
  onSend: (body: string) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);
  const prevHeightRef = useRef(0);
  const lastIdRef = useRef(0);

  const rendered = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    messages.forEach((m, i) => {
      const k = dayKey(m.createdAt);
      if (k !== lastDay) { out.push({ type: 'day', key: `d-${k}-${m.id}`, label: fmtDayLabel(m.createdAt) }); lastDay = k; }
      const prev = messages[i - 1];
      const chained = !!prev && prev.userId === m.userId && dayKey(prev.createdAt) === k
        && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
      out.push({ type: 'msg', key: `m-${m.id}`, m, chained });
    });
    return out;
  }, [messages]);

  // Distingue "llegó un mensaje nuevo" (bajar) de "se cargó historial" (conservar posición).
  useEffect(() => {
    const el = listRef.current;
    if (!el || messages.length === 0) return;
    const newestId = messages[messages.length - 1].id;
    const grewAtTop = prevHeightRef.current > 0 && el.scrollHeight > prevHeightRef.current && newestId === lastIdRef.current;
    if (grewAtTop) {
      el.scrollTop = el.scrollHeight - prevHeightRef.current;
    } else if (stickRef.current) {
      requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: lastIdRef.current ? 'smooth' : 'auto' }));
    }
    lastIdRef.current = newestId;
    prevHeightRef.current = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending || disabled) return;
    setDraft('');
    stickRef.current = true;
    await onSend(body);
    taRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  return (
    <>
      <div ref={listRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1">
        {loading ? (
          <p className="text-center text-[12px] text-digi-muted py-8" style={mf}>Cargando…</p>
        ) : messages.length === 0 ? (
          <div className="text-center py-10">
            <MessageCircle className="w-7 h-7 text-digi-muted mx-auto mb-2" />
            <p className="text-[12.5px] text-digi-text font-medium" style={mf}>{emptyText}</p>
            <p className="text-[11.5px] text-digi-muted mt-1" style={mf}>Escribe el primero.</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="text-center pb-2">
                <button onClick={onLoadMore} disabled={loadingMore}
                  className="text-[11.5px] text-accent hover:underline disabled:opacity-50" style={mf}>
                  {loadingMore ? 'Cargando…' : 'Ver mensajes anteriores'}
                </button>
              </div>
            )}
            {rendered.map((row) =>
              row.type === 'day' ? (
                <div key={row.key} className="flex items-center gap-2 py-2">
                  <span className="flex-1 h-px bg-digi-border" />
                  <span className="text-[10px] uppercase tracking-wide text-digi-muted" style={mf}>{row.label}</span>
                  <span className="flex-1 h-px bg-digi-border" />
                </div>
              ) : (
                <Bubble key={row.key} m={row.m} mine={row.m.userId === me} chained={row.chained} />
              ),
            )}
          </>
        )}
      </div>

      {err && (
        <p className="shrink-0 px-3 py-1.5 text-[11px] text-red-600 bg-red-500/10 border-t border-red-400/30 flex items-center gap-1.5" style={mf}>
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
        </p>
      )}

      <div className="shrink-0 border-t border-digi-border p-2 flex items-end gap-2">
        <AutoGrowTextarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          minRows={1}
          maxHeight={140}
          disabled={disabled}
          placeholder={disabled ? 'Chat cerrado' : 'Escribe un mensaje…'}
          className="flex-1 px-2.5 py-2 bg-digi-darker border border-digi-border rounded-lg text-[12.5px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none disabled:opacity-60"
          style={mf}
        />
        <button onClick={submit} disabled={sending || disabled || !draft.trim()} aria-label="Enviar mensaje"
          className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:pointer-events-none transition-colors">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </>
  );
}

/** Burbuja: la propia a la derecha en color de marca; la ajena a la izquierda con autor. */
function Bubble({ m, mine, chained }: { m: Msg; mine: boolean; chained: boolean }) {
  return (
    <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'} ${chained ? 'mt-0.5' : 'mt-2'}`}>
      {!mine && (
        <div className="w-7 shrink-0">
          {!chained && (m.authorAvatar ? (
            <img src={m.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-digi-border" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/20 text-accent flex items-center justify-center text-[10px] font-semibold" style={mf}>
              {initials(m.authorName)}
            </div>
          ))}
        </div>
      )}
      <div className={`max-w-[76%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!mine && !chained && (
          <p className="text-[10.5px] text-digi-muted mb-0.5 px-1 truncate" style={mf}>
            {m.authorName}
            {ROLE_LABEL[m.authorRole] && <span className="text-digi-muted/60"> · {ROLE_LABEL[m.authorRole]}</span>}
          </p>
        )}
        <div
          className={`px-2.5 py-1.5 rounded-2xl text-[12.5px] leading-relaxed break-words whitespace-pre-wrap ${
            mine ? 'bg-accent text-white rounded-br-md'
                 : 'bg-digi-darker border border-digi-border text-digi-text rounded-bl-md'
          }`}
          style={mf}
        >
          {m.body}
        </div>
        <span className="text-[9.5px] text-digi-muted/70 mt-0.5 px-1 tabular-nums" style={mf}>{fmtTime(m.createdAt)}</span>
      </div>
    </div>
  );
}
