'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ChatThread, { type Msg, initials } from '@/components/chat/ChatThread';
import {
  Ticket, FolderKanban, PartyPopper, ChevronDown, ChevronLeft, Users, Inbox,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const API = '/api/chat/personales';
const POLL = 4000;

export interface ScopeChat {
  kind: 'ticket' | 'project' | 'experience';
  refId: string; title: string; status: string;
  conversationId: number | null; unread: number;
  lastAt: string | null; lastBody: string | null;
}

interface Person {
  userId: string; name: string; avatar: string | null;
  role: string; relation: string; online: boolean; lastSeenAt: string | null;
}

const KIND_META = {
  ticket: { Icon: Ticket, label: 'Ticket', cls: 'text-sky-500' },
  project: { Icon: FolderKanban, label: 'Proyecto', cls: 'text-emerald-500' },
  experience: { Icon: PartyPopper, label: 'Evento', cls: 'text-amber-500' },
} as const;

const fmtWhen = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date().toLocaleDateString('es-ES', { timeZone: 'America/Guayaquil' });
  const k = d.toLocaleDateString('es-ES', { timeZone: 'America/Guayaquil' });
  return k === today
    ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' })
    : d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', timeZone: 'America/Guayaquil' });
};
const fmtLastSeen = (iso: string | null) => {
  if (!iso) return 'Sin actividad';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `Hace ${h} h`;
  return `Hace ${Math.floor(h / 24)} d`;
};

/**
 * Panel de CHATS PERSONALES: a la izquierda la lista de chats abiertos (uno por ticket,
 * proyecto o evento NO completado en el que participas) y a la derecha los mensajes del
 * seleccionado. En móvil se navega entre lista y conversación.
 *
 * Son PRIVADOS: el servidor recalcula en cada petición quién participa en el origen, así que
 * solo el cliente y los responsables/participantes de ese ticket/proyecto/evento entran.
 */
export default function PersonalPanel({
  chats, loading, onClose, onRefresh,
}: {
  chats: ScopeChat[]; loading: boolean; onClose: () => void; onRefresh: () => void;
}) {
  const [sel, setSel] = useState<ScopeChat | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState('');
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const lastIdRef = useRef(0);

  // Mantiene la selección al refrescarse la lista (cambian los no leídos, no el chat).
  useEffect(() => {
    if (!sel) return;
    const fresh = chats.find((c) => c.kind === sel.kind && c.refId === sel.refId);
    if (!fresh) { setSel(null); setMsgs([]); }
  }, [chats, sel]);

  const qs = sel ? `kind=${sel.kind}&ref=${encodeURIComponent(sel.refId)}` : '';

  const markRead = useCallback(async (lastId: number) => {
    if (!sel || !lastId) return;
    try {
      await fetch(`${API}/leido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: sel.kind, ref: sel.refId, lastId }),
      });
      onRefresh();
    } catch { /* no crítico */ }
  }, [sel, onRefresh]);

  // Abrir un chat: carga mensajes y participantes.
  useEffect(() => {
    if (!sel) { setMsgs([]); setPeople(null); setPeopleOpen(false); return; }
    let cancelled = false;
    setLoadingMsgs(true);
    lastIdRef.current = 0;
    (async () => {
      try {
        const [mRes, pRes] = await Promise.all([
          fetch(`${API}/mensajes?${qs}`),
          fetch(`${API}/participantes?${qs}`),
        ]);
        const m = await mRes.json();
        const p = await pRes.json();
        if (cancelled) return;
        if (!mRes.ok) throw new Error(m.error || 'Error');
        const list: Msg[] = m.data.messages || [];
        setMsgs(list); setMe(m.data.me || ''); setHasMore(list.length >= 50);
        lastIdRef.current = list.length ? list[list.length - 1].id : 0;
        if (lastIdRef.current) markRead(lastIdRef.current);
        setPeople(pRes.ok ? (p.data.people || []) : []);
        setErr(null);
      } catch (e: any) { if (!cancelled) setErr(e.message); }
      finally { if (!cancelled) setLoadingMsgs(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.kind, sel?.refId]);

  // Sondeo incremental del chat abierto.
  useEffect(() => {
    if (!sel) return;
    let id: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      try {
        const res = await fetch(`${API}/mensajes?${qs}&after=${lastIdRef.current}`);
        if (!res.ok) return;
        const j = await res.json();
        const fresh: Msg[] = j.data.messages || [];
        if (fresh.length) {
          setMsgs((prev) => { const seen = new Set(prev.map((x) => x.id)); return [...prev, ...fresh.filter((x) => !seen.has(x.id))]; });
          lastIdRef.current = fresh[fresh.length - 1].id;
          markRead(lastIdRef.current);
        }
      } catch { /* silencioso */ }
    };
    const start = () => { if (id) clearInterval(id); id = setInterval(poll, POLL); };
    const onVis = () => { if (document.hidden) { if (id) { clearInterval(id); id = null; } } else { poll(); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { if (id) clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [sel, qs, markRead]);

  const loadMore = async () => {
    if (!sel || !msgs.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}/mensajes?${qs}&before=${msgs[0].id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const older: Msg[] = j.data.messages || [];
      setHasMore(older.length >= 50);
      if (older.length) setMsgs((prev) => [...older, ...prev]);
    } catch (e: any) { setErr(e.message); } finally { setLoadingMore(false); }
  };

  const send = async (body: string) => {
    if (!sel) return;
    setSending(true);
    try {
      const res = await fetch(`${API}/mensajes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: sel.kind, ref: sel.refId, body }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const m: Msg = j.data;
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      lastIdRef.current = Math.max(lastIdRef.current, m.id);
      onRefresh();
      setErr(null);
    } catch (e: any) { setErr(e.message); } finally { setSending(false); }
  };

  const onlineCount = people?.filter((p) => p.online).length ?? 0;

  return (
    <section className="w-[min(94vw,640px)] h-[min(74vh,500px)] flex rounded-xl border border-digi-border bg-digi-card shadow-2xl overflow-hidden" aria-label="Chats personales">
      {/* Lista de chats */}
      <div className={`${sel ? 'hidden sm:flex' : 'flex'} w-full sm:w-[220px] shrink-0 flex-col border-r border-digi-border`}>
        <header className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-digi-border bg-accent text-white">
          <Inbox className="w-4 h-4 shrink-0" />
          <p className="flex-1 min-w-0 text-[13px] font-semibold truncate" style={df}>Mis chats</p>
          <button onClick={onClose} aria-label="Minimizar" className="w-7 h-7 sm:hidden flex items-center justify-center rounded-md hover:bg-white/15">
            <ChevronDown className="w-4 h-4" />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-1">
          {loading ? (
            <p className="text-center text-[12px] text-digi-muted py-6" style={mf}>Cargando…</p>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 px-2">
              <Inbox className="w-6 h-6 text-digi-muted mx-auto mb-2" />
              <p className="text-[12px] text-digi-text font-medium" style={mf}>Sin chats abiertos</p>
              <p className="text-[11px] text-digi-muted mt-1" style={mf}>
                Aparecen aquí mientras tengas un ticket, proyecto o evento sin completar.
              </p>
            </div>
          ) : chats.map((c) => {
            const meta = KIND_META[c.kind];
            const active = sel?.kind === c.kind && sel?.refId === c.refId;
            return (
              <button key={`${c.kind}-${c.refId}`} onClick={() => setSel(c)}
                className={`w-full text-left rounded-lg px-2.5 py-2 transition-colors border-l-2 ${
                  active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.03]'
                }`}>
                <div className="flex items-center gap-1.5">
                  <meta.Icon className={`w-3.5 h-3.5 shrink-0 ${meta.cls}`} />
                  <span className={`flex-1 min-w-0 text-[12px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>
                    {c.title}
                  </span>
                  {c.unread > 0 && (
                    <span className="min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9.5px] font-semibold tabular-nums">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-digi-muted truncate mt-0.5" style={mf}>
                  {c.lastBody ? c.lastBody : <span className="text-digi-muted/60">Sin mensajes</span>}
                </p>
                <p className="text-[9.5px] text-digi-muted/70 mt-0.5" style={mf}>{meta.label} · {fmtWhen(c.lastAt)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conversación */}
      <div className={`${sel ? 'flex' : 'hidden sm:flex'} flex-1 min-w-0 flex-col relative`}>
        {!sel ? (
          <div className="flex-1 flex items-center justify-center text-center px-6">
            <p className="text-[12px] text-digi-muted" style={mf}>Elige un chat para ver los mensajes.</p>
          </div>
        ) : (
          <>
            <header className="shrink-0 flex items-center gap-1.5 px-2 h-11 border-b border-digi-border bg-digi-card">
              <button onClick={() => setSel(null)} aria-label="Volver" className="w-7 h-7 sm:hidden flex items-center justify-center rounded-md text-digi-muted hover:text-accent">
                <ChevronLeft className="w-4 h-4" />
              </button>
              {(() => { const M = KIND_META[sel.kind]; return <M.Icon className={`w-4 h-4 shrink-0 ${M.cls}`} />; })()}
              <p className="flex-1 min-w-0 text-[12.5px] font-semibold text-digi-text truncate" style={df}>{sel.title}</p>

              {/* Participantes + estado de conexión */}
              <button onClick={() => setPeopleOpen((v) => !v)} aria-expanded={peopleOpen}
                aria-label="Ver participantes y su estado de conexión"
                className={`inline-flex items-center gap-1 h-7 px-2 rounded-md border text-[11px] transition-colors ${
                  peopleOpen ? 'border-accent text-accent bg-accent-light' : 'border-digi-border text-digi-muted hover:text-accent hover:border-accent'
                }`} style={mf}>
                <Users className="w-3.5 h-3.5" />
                <span className="tabular-nums">{people?.length ?? 0}</span>
                {onlineCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
              <button onClick={onClose} aria-label="Minimizar" className="w-7 h-7 hidden sm:flex items-center justify-center rounded-md text-digi-muted hover:text-accent">
                <ChevronDown className="w-4 h-4" />
              </button>
            </header>

            {/* Burbuja de participantes */}
            {peopleOpen && (
              <>
                <div className="absolute inset-0 z-10" onClick={() => setPeopleOpen(false)} />
                <div className="absolute right-2 top-11 z-20 w-[230px] max-h-[60%] overflow-y-auto rounded-lg border border-digi-border bg-digi-card shadow-xl p-1.5">
                  <p className="text-[10px] uppercase tracking-wide text-digi-muted px-1.5 py-1" style={df}>
                    Participantes · {onlineCount} en línea
                  </p>
                  {(people || []).length === 0 ? (
                    <p className="text-[11.5px] text-digi-muted px-1.5 py-2" style={mf}>Sin participantes.</p>
                  ) : (people || []).map((p) => (
                    <div key={p.userId} className="flex items-center gap-2 px-1.5 py-1.5 rounded-md">
                      <div className="relative shrink-0">
                        {p.avatar ? (
                          <img src={p.avatar} alt="" className="w-7 h-7 rounded-full object-cover border border-digi-border" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/20 text-accent flex items-center justify-center text-[10px] font-semibold" style={mf}>
                            {initials(p.name)}
                          </div>
                        )}
                        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-digi-card ${p.online ? 'bg-emerald-500' : 'bg-digi-muted/50'}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11.5px] text-digi-text truncate" style={mf}>{p.name}</p>
                        <p className="text-[10px] text-digi-muted truncate" style={mf}>
                          {p.relation}{p.relation && ' · '}
                          <span className={p.online ? 'text-emerald-600' : ''}>{p.online ? 'En línea' : fmtLastSeen(p.lastSeenAt)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                  <p className="text-[9.5px] text-digi-muted/70 px-1.5 pt-1.5 border-t border-digi-border mt-1" style={mf}>
                    El estado refleja actividad dentro de la app.
                  </p>
                </div>
              </>
            )}

            <ChatThread
              messages={msgs} me={me} loading={loadingMsgs} sending={sending} err={err}
              hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} onSend={send}
            />
          </>
        )}
      </div>
    </section>
  );
}
