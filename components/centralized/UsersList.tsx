'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users, UserRound, ChevronDown } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

export type SelectedUser = { kind: 'candidate' | 'member'; id: string; name: string; email?: string };

/**
 * Lista de usuarios (candidatos + miembros) en dos grupos colapsables. La comparten
 * los sistemas Horario de Vida y Apoyo y Autoayuda. Selección única.
 */
export default function UsersList({
  selected,
  onSelect,
  className = '',
}: {
  selected: SelectedUser | null;
  onSelect: (u: SelectedUser | null) => void;
  className?: string;
}) {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [candOpen, setCandOpen] = useState(true);
  const [memOpen, setMemOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const [cRes, mRes] = await Promise.all([fetch('/api/admin/candidates'), fetch('/api/admin/team')]);
      const c = await cRes.json();
      const m = await mRes.json();
      setCandidates(c.data || []);
      setMembers((m.data || []).filter((x: any) => x.is_active));
    } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const nameOf = (u: any) => u.full_name || u.name || u.email || 'Usuario';

  const Row = ({ u, kind }: { u: any; kind: SelectedUser['kind'] }) => {
    const active = selected?.kind === kind && selected?.id === String(u.id);
    return (
      <button
        onClick={() => onSelect({ kind, id: String(u.id), name: nameOf(u), email: u.email })}
        className={`w-full text-left px-3 py-2 flex items-center gap-2.5 border-l-2 transition-colors ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}
      >
        {u.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-digi-border shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
            <span className="text-[11px] font-semibold text-accent uppercase" style={mf}>{nameOf(u).charAt(0)}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-[12.5px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{nameOf(u)}</p>
          {u.email && <p className="text-[11px] text-digi-muted truncate" style={mf}>{u.email}</p>}
        </div>
      </button>
    );
  };

  const Header = ({ label, Icon, count, open, onToggle }: any) => (
    <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2 bg-digi-dark border-b border-digi-border text-left">
      <Icon className="w-4 h-4 text-digi-muted shrink-0" />
      <span className="flex-1 text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>{label}</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums bg-black/[0.05] text-digi-muted">{count}</span>
      <ChevronDown className={`w-4 h-4 text-digi-muted shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
  );

  return (
    <aside className={`bg-digi-card border border-digi-border rounded-lg overflow-hidden ${className}`}>
      <Header label="Candidatos" Icon={UserRound} count={candidates.length} open={candOpen} onToggle={() => setCandOpen((o) => !o)} />
      {candOpen && (
        <div className="divide-y divide-digi-border/50">
          {candidates.length === 0 ? <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Sin candidatos.</p> : candidates.map((u) => <Row key={`c-${u.id}`} u={u} kind="candidate" />)}
        </div>
      )}
      <Header label="Miembros" Icon={Users} count={members.length} open={memOpen} onToggle={() => setMemOpen((o) => !o)} />
      {memOpen && (
        <div className="divide-y divide-digi-border/50">
          {members.length === 0 ? <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Sin miembros.</p> : members.map((u) => <Row key={`m-${u.id}`} u={u} kind="member" />)}
        </div>
      )}
    </aside>
  );
}
