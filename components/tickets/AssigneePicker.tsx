'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Target, Sparkles, Check } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Assignee {
  member_id: string;
  name: string;
  role: string;
  prospeccion: { net: number; pos: number; neg: number };
  top_talents: string[];
}

/**
 * Buscador de ASIGNADOS para "Solicitar ticket": lista candidatos/miembros/admin con su
 * ROL, PROSPECCIÓN (neto) y TOP 5 de TALENTOS (de `/api/tickets/assignees`). Filtra por
 * nombre, rol o talento. Selección única → devuelve el `member_id`.
 */
export default function AssigneePicker({
  value, onChange, disabled = false,
}: {
  value: string;
  onChange: (memberId: string) => void;
  disabled?: boolean;
}) {
  const [list, setList] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/assignees').then((r) => r.json()).then((d) => { if (alive) setList(d.data || []); })
      .catch(() => { if (alive) setList([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((a) =>
      a.name.toLowerCase().includes(s) ||
      a.role.toLowerCase().includes(s) ||
      a.top_talents.some((t) => t.toLowerCase().includes(s)),
    );
  }, [list, q]);

  const roleColor = (role: string) =>
    role === 'Admin' ? 'text-amber-600 bg-amber-500/10 border-amber-400/30'
      : role === 'Candidato' ? 'text-violet-500 bg-violet-500/10 border-violet-400/30'
      : 'text-sky-600 bg-sky-500/10 border-sky-400/30';

  return (
    <div className={`rounded-lg border border-digi-border overflow-hidden ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <div className="relative border-b border-digi-border">
        <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, rol o talento…"
          className="w-full pl-8 pr-3 py-2 bg-digi-darker text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:outline-none" style={mf} />
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-digi-border/50">
        {loading ? (
          <p className="px-3 py-4 text-[12px] text-digi-muted text-center" style={mf}>Cargando…</p>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-4 text-[12px] text-digi-muted text-center" style={mf}>Sin resultados.</p>
        ) : (
          filtered.map((a) => {
            const active = value === a.member_id;
            const net = a.prospeccion.net;
            return (
              <button key={a.member_id} type="button" onClick={() => onChange(active ? '' : a.member_id)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${active ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`}>
                <div className={`w-4 h-4 mt-0.5 shrink-0 rounded border flex items-center justify-center ${active ? 'bg-accent border-accent text-white' : 'border-digi-border'}`}>
                  {active && <Check className="w-3 h-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12.5px] font-medium text-digi-text truncate" style={mf}>{a.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleColor(a.role)}`} style={mf}>{a.role}</span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] text-digi-muted" style={mf} title={`Prospección · +${a.prospeccion.pos} / −${a.prospeccion.neg}`}>
                      <Target className="w-3 h-3 text-accent" />
                      <span className={`font-semibold tabular-nums ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : ''}`}>{net > 0 ? `+${net}` : net}</span>
                    </span>
                  </div>
                  {a.top_talents.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mt-1">
                      <Sparkles className="w-3 h-3 text-digi-muted shrink-0" />
                      {a.top_talents.map((t) => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-black/[0.05] text-digi-muted" style={mf}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
