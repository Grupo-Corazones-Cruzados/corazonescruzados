'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf } from '@/lib/dashboard/access';
import { MessageCircle, X, ChevronDown, Send, Loader2, AlertCircle } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const API = '/api/chat/grupo';
/** Sondeo con el panel abierto (convención del repo: 4 s). */
const POLL_OPEN = 4000;
/** Sondeo con el panel cerrado: solo el contador de no leídos. */
const POLL_CLOSED = 30000;
const LS_OPEN = 'gcc_chat_open';

interface Msg {
  id: number; userId: string; authorName: string;
  authorAvatar: string | null; authorRole: string; body: string; createdAt: string;
}

const ROLE_LABEL: Record<string, string> = { admin: 'Admin', member: 'Miembro', client: 'Candidato' };

/** Fila renderizable: un separador de día o un mensaje. */
type Row =
  | { type: 'day'; key: string; label: string }
  | { type: 'msg'; key: string; m: Msg; chained: boolean };

const dayKey = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'America/Guayaquil' });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const fmtDayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = dayKey(new Date().toISOString());
  const yest = dayKey(new Date(Date.now() - 86400000).toISOString());
  const k = dayKey(iso);
  if (k === today) return 'Hoy';
  if (k === yest) return 'Ayer';
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Guayaquil' });
};
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';

/**
 * CHAT GRUPAL flotante, al estilo de los chats de Facebook: una pastilla en la esquina
 * inferior derecha que se despliega en un panel. Es un ÚNICO chat abierto de la organización
 * (no hay chats persona a persona).
 *
 * Se ancla **encima de la barra de ruta** (`DashboardBreadcrumb`, `fixed bottom-0 h-9`), por eso
 * el `bottom-11`. Va dentro del contenedor `.corp` del layout para heredar el tema claro/oscuro.
 * No necesita el estado del sidebar: está anclado a la derecha y el sidebar ocupa la izquierda.
 *
 * Entrega por SONDEO, no SSE: el único SSE del repo es de uso local y sin keepalive, y el
 * patrón establecido aquí es `setInterval` + `fetch`. Con el panel abierto pide solo lo nuevo
 * (`?after=<últimoId>`); cerrado, solo el contador. Se pausa con la pestaña oculta.
 */
export default function GroupChat() {
  const { user } = useAuth();
  const role = accessRoleOf(user);
  // Solo candidatos y miembros (y admin). Un cliente puro no ve el chat.
  const allowed = !!user && (role === 'candidate' || role === 'member' || role === 'admin');

  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState<string>('');
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const lastIdRef = useRef(0);
  // Si el usuario subió a leer historial, no lo arrastramos abajo al llegar un mensaje.
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    try { if (localStorage.getItem(LS_OPEN) === '1') setOpen(true); } catch {}
  }, []);
  const toggleOpen = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(LS_OPEN, next ? '1' : '0'); } catch {}
  };

  const scrollToBottom = useCallback((smooth = false) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  const markRead = useCallback(async (lastId: number) => {
    if (!lastId) return;
    try {
      await fetch(`${API}/leido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastId }),
      });
      setUnread(0);
    } catch { /* silencioso: no es crítico */ }
  }, []);

  /** Carga inicial (los últimos 50). */
  const loadInitial = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const list: Msg[] = j.data.messages || [];
      setMsgs(list);
      setMe(j.data.me || '');
      setUnread(j.data.unread || 0);
      setHasMore(list.length >= 50);
      lastIdRef.current = list.length ? list[list.length - 1].id : 0;
      setErr(null);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }, []);

  /** Sondeo incremental: solo lo posterior al último id conocido. */
  const poll = useCallback(async () => {
    try {
      if (!open) {
        const res = await fetch(`${API}?only=unread`);
        if (!res.ok) return;
        const j = await res.json();
        setUnread(j.data.unread || 0);
        return;
      }
      const res = await fetch(`${API}?after=${lastIdRef.current}`);
      if (!res.ok) return;
      const j = await res.json();
      const fresh: Msg[] = j.data.messages || [];
      if (fresh.length) {
        setMsgs((prev) => {
          // Defensa contra duplicados: el envío optimista ya pudo insertar el propio mensaje.
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
        });
        lastIdRef.current = fresh[fresh.length - 1].id;
      }
      setErr(null);
    } catch { /* un fallo de red puntual no debe romper el chat */ }
  }, [open]);

  // Carga inicial una sola vez, cuando el usuario tiene acceso.
  useEffect(() => { if (allowed) loadInitial(); }, [allowed, loadInitial]);

  // Bucle de sondeo, pausado si la pestaña está oculta.
  useEffect(() => {
    if (!allowed) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id) clearInterval(id);
      id = setInterval(poll, open ? POLL_OPEN : POLL_CLOSED);
    };
    const onVisibility = () => {
      if (document.hidden) { if (id) { clearInterval(id); id = null; } }
      else { poll(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { if (id) clearInterval(id); document.removeEventListener('visibilitychange', onVisibility); };
  }, [allowed, open, poll]);

  // Al abrir: bajar del todo y marcar leído.
  useEffect(() => {
    if (!open || loading) return;
    requestAnimationFrame(() => scrollToBottom());
    if (lastIdRef.current) markRead(lastIdRef.current);
    taRef.current?.focus();
  }, [open, loading, scrollToBottom, markRead]);

  // Mensajes nuevos: bajar solo si el usuario ya estaba abajo; y marcar leído si está abierto.
  useEffect(() => {
    if (!msgs.length) return;
    if (open && stickToBottomRef.current) requestAnimationFrame(() => scrollToBottom(true));
    if (open) markRead(msgs[msgs.length - 1].id);
  }, [msgs, open, scrollToBottom, markRead]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  const loadMore = async () => {
    if (!msgs.length || loadingMore) return;
    setLoadingMore(true);
    const el = listRef.current;
    const prevH = el?.scrollHeight ?? 0;
    try {
      const res = await fetch(`${API}?before=${msgs[0].id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const older: Msg[] = j.data.messages || [];
      setHasMore(older.length >= 50);
      if (older.length) {
        setMsgs((prev) => [...older, ...prev]);
        // Conserva la posición visual tras insertar arriba.
        requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH; });
      }
    } catch (e: any) { setErr(e.message); } finally { setLoadingMore(false); }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setDraft('');
    stickToBottomRef.current = true;
    try {
      const res = await fetch(API, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const m: Msg = j.data;
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      lastIdRef.current = Math.max(lastIdRef.current, m.id);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
      setDraft(body); // devuelve el texto para no perderlo
    } finally { setSending(false); taRef.current?.focus(); }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  /** Agrupa por día y encadena mensajes consecutivos del mismo autor. */
  const rendered = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let lastDay = '';
    msgs.forEach((m, i) => {
      const k = dayKey(m.createdAt);
      if (k !== lastDay) { out.push({ type: 'day', key: `d-${k}-${m.id}`, label: fmtDayLabel(m.createdAt) }); lastDay = k; }
      const prev = msgs[i - 1];
      const chained = !!prev && prev.userId === m.userId && dayKey(prev.createdAt) === k
        && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60000;
      out.push({ type: 'msg', key: `m-${m.id}`, m, chained });
    });
    return out;
  }, [msgs]);

  if (!allowed) return null;

  return (
    <div className="fixed bottom-11 right-3 lg:right-4 z-[90] flex flex-col items-end" style={mf}>
      {open && (
        <section
          className="mb-2 w-[min(92vw,360px)] h-[min(70vh,460px)] flex flex-col rounded-xl border border-digi-border bg-digi-card shadow-2xl overflow-hidden"
          aria-label="Chat general"
        >
          {/* Cabecera */}
          <header className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-digi-border bg-accent text-white">
            <MessageCircle className="w-4 h-4 shrink-0" />
            <p className="flex-1 min-w-0 text-[13px] font-semibold truncate" style={df}>Chat general</p>
            <button onClick={() => toggleOpen(false)} aria-label="Minimizar chat"
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/15 transition-colors">
              <ChevronDown className="w-4 h-4" />
            </button>
          </header>

          {/* Mensajes */}
          <div ref={listRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1">
            {loading ? (
              <p className="text-center text-[12px] text-digi-muted py-8">Cargando…</p>
            ) : msgs.length === 0 ? (
              <div className="text-center py-10">
                <MessageCircle className="w-7 h-7 text-digi-muted mx-auto mb-2" />
                <p className="text-[12.5px] text-digi-text font-medium">Todavía no hay mensajes</p>
                <p className="text-[11.5px] text-digi-muted mt-1">Escribe el primero.</p>
              </div>
            ) : (
              <>
                {hasMore && (
                  <div className="text-center pb-2">
                    <button onClick={loadMore} disabled={loadingMore}
                      className="text-[11.5px] text-accent hover:underline disabled:opacity-50">
                      {loadingMore ? 'Cargando…' : 'Ver mensajes anteriores'}
                    </button>
                  </div>
                )}
                {rendered.map((row) =>
                  row.type === 'day' ? (
                    <div key={row.key} className="flex items-center gap-2 py-2">
                      <span className="flex-1 h-px bg-digi-border" />
                      <span className="text-[10px] uppercase tracking-wide text-digi-muted">{row.label}</span>
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
            <p className="shrink-0 px-3 py-1.5 text-[11px] text-red-600 bg-red-500/10 border-t border-red-400/30 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {err}
            </p>
          )}

          {/* Compositor */}
          <div className="shrink-0 border-t border-digi-border p-2 flex items-end gap-2">
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Escribe un mensaje…"
              className="flex-1 max-h-24 px-2.5 py-2 bg-digi-darker border border-digi-border rounded-lg text-[12.5px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none"
            />
            <button onClick={send} disabled={sending || !draft.trim()} aria-label="Enviar mensaje"
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-lg bg-accent text-white hover:bg-accent-hover disabled:opacity-40 disabled:pointer-events-none transition-colors">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </section>
      )}

      {/* Pastilla lanzadora */}
      <button
        onClick={() => toggleOpen(!open)}
        aria-label={open ? 'Cerrar chat' : `Abrir chat${unread ? `, ${unread} sin leer` : ''}`}
        className="relative inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover transition-colors"
      >
        {open ? <X className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
        <span className="text-[12.5px] font-medium">Chat</span>
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums border-2 border-digi-card">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}

/** Burbuja: la propia va a la derecha en color de marca; la ajena a la izquierda con autor. */
function Bubble({ m, mine, chained }: { m: Msg; mine: boolean; chained: boolean }) {
  return (
    <div className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'} ${chained ? 'mt-0.5' : 'mt-2'}`}>
      {!mine && (
        <div className="w-7 shrink-0">
          {!chained && (m.authorAvatar ? (
            <img src={m.authorAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-digi-border" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/20 text-accent flex items-center justify-center text-[10px] font-semibold">
              {initials(m.authorName)}
            </div>
          ))}
        </div>
      )}
      <div className={`max-w-[76%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
        {!mine && !chained && (
          <p className="text-[10.5px] text-digi-muted mb-0.5 px-1 truncate">
            {m.authorName}
            {ROLE_LABEL[m.authorRole] && <span className="text-digi-muted/60"> · {ROLE_LABEL[m.authorRole]}</span>}
          </p>
        )}
        <div
          className={`px-2.5 py-1.5 rounded-2xl text-[12.5px] leading-relaxed break-words whitespace-pre-wrap ${
            mine
              ? 'bg-accent text-white rounded-br-md'
              : 'bg-digi-darker border border-digi-border text-digi-text rounded-bl-md'
          }`}
        >
          {m.body}
        </div>
        <span className="text-[9.5px] text-digi-muted/70 mt-0.5 px-1 tabular-nums">{fmtTime(m.createdAt)}</span>
      </div>
    </div>
  );
}
