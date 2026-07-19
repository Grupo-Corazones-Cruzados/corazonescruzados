'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ChatThread, { type Msg } from '@/components/chat/ChatThread';
import { MessageCircle, ChevronDown } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const API = '/api/chat/grupo';
const POLL = 4000;

/**
 * Panel del CHAT GRUPAL. Único chat abierto de la organización (sin chats persona a persona).
 * Es dueño de sus datos; el hilo y el compositor los pone `ChatThread`.
 */
export default function GroupPanel({ onClose, onRead }: { onClose: () => void; onRead: () => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastIdRef = useRef(0);

  const markRead = useCallback(async (lastId: number) => {
    if (!lastId) return;
    try {
      await fetch(`${API}/leido`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastId }) });
      onRead();
    } catch { /* no crítico */ }
  }, [onRead]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(API);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Error');
        const list: Msg[] = j.data.messages || [];
        setMsgs(list); setMe(j.data.me || ''); setHasMore(list.length >= 50);
        lastIdRef.current = list.length ? list[list.length - 1].id : 0;
        if (lastIdRef.current) markRead(lastIdRef.current);
        setErr(null);
      } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
    })();
  }, [markRead]);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;
    const poll = async () => {
      try {
        const res = await fetch(`${API}?after=${lastIdRef.current}`);
        if (!res.ok) return;
        const j = await res.json();
        const fresh: Msg[] = j.data.messages || [];
        if (fresh.length) {
          setMsgs((prev) => { const seen = new Set(prev.map((m) => m.id)); return [...prev, ...fresh.filter((m) => !seen.has(m.id))]; });
          lastIdRef.current = fresh[fresh.length - 1].id;
          markRead(lastIdRef.current);
        }
      } catch { /* un fallo puntual no rompe el chat */ }
    };
    const start = () => { if (id) clearInterval(id); id = setInterval(poll, POLL); };
    const onVis = () => { if (document.hidden) { if (id) { clearInterval(id); id = null; } } else { poll(); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { if (id) clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [markRead]);

  const loadMore = async () => {
    if (!msgs.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${API}?before=${msgs[0].id}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const older: Msg[] = j.data.messages || [];
      setHasMore(older.length >= 50);
      if (older.length) setMsgs((prev) => [...older, ...prev]);
    } catch (e: any) { setErr(e.message); } finally { setLoadingMore(false); }
  };

  const send = async (body: string) => {
    setSending(true);
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      const m: Msg = j.data;
      setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      lastIdRef.current = Math.max(lastIdRef.current, m.id);
      setErr(null);
    } catch (e: any) { setErr(e.message); } finally { setSending(false); }
  };

  return (
    <section className="w-[min(92vw,360px)] h-[min(70vh,460px)] flex flex-col rounded-xl border border-digi-border bg-digi-card shadow-2xl overflow-hidden" aria-label="Chat general">
      <header className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-digi-border bg-accent text-white">
        <MessageCircle className="w-4 h-4 shrink-0" />
        <p className="flex-1 min-w-0 text-[13px] font-semibold truncate" style={df}>Chat general</p>
        <button onClick={onClose} aria-label="Minimizar chat" className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/15 transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>
      </header>
      <ChatThread
        messages={msgs} me={me} loading={loading} sending={sending} err={err}
        hasMore={hasMore} loadingMore={loadingMore} onLoadMore={loadMore} onSend={send}
      />
    </section>
  );
}
