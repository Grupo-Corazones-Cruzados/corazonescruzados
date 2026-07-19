'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { accessRoleOf } from '@/lib/dashboard/access';
import GroupPanel from '@/components/chat/GroupPanel';
import PersonalPanel, { type ScopeChat } from '@/components/chat/PersonalPanel';
import { MessageCircle, Inbox, X } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const POLL_IDLE = 30000;
const LS_PANEL = 'gcc_chat_panel';

type Panel = 'none' | 'group' | 'personal';

/**
 * Muelle de chats, fijo en la esquina inferior derecha y **justo encima de la barra de ruta**
 * (`DashboardBreadcrumb` es `fixed bottom-0 h-9`, de ahí el `bottom-11`). Dentro del `.corp`
 * del layout para heredar el tema.
 *
 * Dos lanzadores en fila: **Chat general** (grupal, candidatos y miembros) y, a su derecha,
 * **Mis chats** (privados de ticket / proyecto / evento). Se abre uno u otro, nunca los dos:
 * en una esquina no caben dos paneles sin estorbarse.
 *
 * El muelle es quien sondea los CONTADORES (cada 30 s) aunque los paneles estén cerrados; el
 * panel abierto sondea sus propios mensajes cada 4 s. Así la burbuja de no leídos está viva
 * sin mantener dos bucles caros.
 */
export default function ChatDock() {
  const { user } = useAuth();
  const role = accessRoleOf(user);
  // El chat grupal es solo de candidatos y miembros; los personales los tiene cualquiera
  // que participe en un ticket/proyecto/evento abierto (un cliente, por ejemplo).
  const canGroup = !!user && (role === 'candidate' || role === 'member' || role === 'admin');

  const [panel, setPanel] = useState<Panel>('none');
  const [groupUnread, setGroupUnread] = useState(0);
  const [chats, setChats] = useState<ScopeChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_PANEL);
      if (v === 'group' || v === 'personal') setPanel(v);
    } catch {}
  }, []);
  const open = (p: Panel) => {
    setPanel(p);
    try { localStorage.setItem(LS_PANEL, p); } catch {}
  };

  const refreshCounts = useCallback(async () => {
    if (!user) return;
    try {
      const jobs: Promise<any>[] = [fetch('/api/chat/personales').then((r) => (r.ok ? r.json() : null))];
      if (canGroup) jobs.push(fetch('/api/chat/grupo?only=unread').then((r) => (r.ok ? r.json() : null)));
      const [p, g] = await Promise.all(jobs);
      if (p?.data) { setChats(p.data.chats || []); }
      if (g?.data) setGroupUnread(g.data.unread || 0);
    } catch { /* un fallo puntual no debe romper el muelle */ }
    finally { setLoadingChats(false); }
  }, [user, canGroup]);

  useEffect(() => {
    if (!user) return;
    refreshCounts();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (id) clearInterval(id); id = setInterval(refreshCounts, POLL_IDLE); };
    const onVis = () => { if (document.hidden) { if (id) { clearInterval(id); id = null; } } else { refreshCounts(); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => { if (id) clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [user, refreshCounts]);

  const personalUnread = chats.reduce((n, c) => n + c.unread, 0);
  // Sin chat grupal y sin chats personales no hay nada que mostrar: no se pinta el muelle.
  if (!user || (!canGroup && chats.length === 0)) return null;

  return (
    <div className="fixed bottom-11 right-3 lg:right-4 z-[90] flex flex-col items-end" style={mf}>
      {panel === 'group' && canGroup && (
        <div className="mb-2"><GroupPanel onClose={() => open('none')} onRead={() => setGroupUnread(0)} /></div>
      )}
      {panel === 'personal' && (
        <div className="mb-2">
          <PersonalPanel chats={chats} loading={loadingChats} onClose={() => open('none')} onRefresh={refreshCounts} />
        </div>
      )}

      <div className="flex items-center gap-2">
        {canGroup && (
          <Launcher
            active={panel === 'group'} label="Chat" unread={groupUnread}
            Icon={MessageCircle}
            onClick={() => open(panel === 'group' ? 'none' : 'group')}
          />
        )}
        <Launcher
          active={panel === 'personal'} label="Mis chats" unread={personalUnread}
          Icon={Inbox} count={chats.length}
          onClick={() => open(panel === 'personal' ? 'none' : 'personal')}
        />
      </div>
    </div>
  );
}

function Launcher({ active, label, unread, Icon, onClick, count }: {
  active: boolean; label: string; unread: number; Icon: any; onClick: () => void; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={active ? `Cerrar ${label}` : `Abrir ${label}${unread ? `, ${unread} sin leer` : ''}`}
      className={`relative inline-flex items-center gap-2 h-10 pl-3 pr-4 rounded-full shadow-lg transition-colors ${
        active ? 'bg-accent-hover text-white' : 'bg-accent text-white hover:bg-accent-hover'
      }`}
    >
      {active ? <X className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
      <span className="text-[12.5px] font-medium">{label}</span>
      {count != null && count > 0 && !active && (
        <span className="text-[11px] opacity-80 tabular-nums">{count}</span>
      )}
      {!active && unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-semibold tabular-nums border-2 border-digi-card">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </button>
  );
}
