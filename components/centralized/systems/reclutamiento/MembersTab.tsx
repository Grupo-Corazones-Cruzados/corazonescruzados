'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserRound, Mail, X, Search, BadgeCheck, DollarSign, Briefcase, Info } from 'lucide-react';
import PixelBadge from '@/components/ui/PixelBadge';
import { fmt2 } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * Pestaña "Miembros": los miembros existentes del grupo (`/api/admin/team`). Lista
 * buscable + panel de detalle a la derecha. El contenido del detalle (información
 * específica del miembro) se definirá más adelante; por ahora se muestran los datos
 * básicos disponibles. Soporta `?miembro=<id>`.
 */
export default function MembersTab({ isAdmin }: { isAdmin: boolean }) {
  const params = useSearchParams();
  const deepLinkId = params.get('miembro');

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/team');
      const data = await res.json();
      setMembers(data.data || []);
    } catch { setMembers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (deepLinkId && members.some((m) => String(m.id) === String(deepLinkId))) {
      setSelectedId(String(deepLinkId));
    }
  }, [deepLinkId, members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => `${m.name || ''} ${m.email || ''} ${m.position_name || ''}`.toLowerCase().includes(q));
  }, [members, search]);

  const selected = useMemo(() => members.find((m) => String(m.id) === selectedId) || null, [members, selectedId]);
  const displayName = (m: any) => m?.name || m?.email || 'Miembro';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start">
      {/* Lista de miembros */}
      <div className="min-w-0">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar miembro..."
            className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
        </div>

        {loading ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><UserRound className="w-5 h-5 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin miembros</p>
            <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{isAdmin ? 'Aún no hay miembros registrados.' : 'No tienes acceso a los miembros.'}</p>
          </div>
        ) : (
          <ul className="bg-digi-card border border-digi-border rounded-lg divide-y divide-digi-border/60 overflow-hidden">
            {filtered.map((m) => {
              const active = String(m.id) === selectedId;
              return (
                <li key={m.id}>
                  <button onClick={() => setSelectedId(String(m.id))}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors border-l-2 ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}>
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-digi-border shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-semibold text-accent uppercase" style={mf}>{displayName(m).charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{displayName(m)}</p>
                      <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{m.position_name || m.email || '—'}</p>
                    </div>
                    {!m.is_active && <span className="text-[10px] text-digi-muted shrink-0" style={mf}>inactivo</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalle del miembro (contenido por definir) */}
      <aside className="w-full">
        {selected ? (
          <div className="space-y-4">
            <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                {selected.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.avatar_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-digi-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-[18px] font-semibold text-accent uppercase" style={df}>{displayName(selected).charAt(0)}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-semibold text-digi-text leading-tight truncate" style={df}>{displayName(selected)}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-digi-muted" style={mf}>
                    {selected.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selected.email}</span>}
                    {selected.position_name && <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {selected.position_name}</span>}
                    {selected.hourly_rate != null && <span className="inline-flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {fmt2(Number(selected.hourly_rate))}/h</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <PixelBadge variant={selected.is_active ? 'success' : 'default'}>{selected.is_active ? 'Activo' : 'Inactivo'}</PixelBadge>
                    {selected.role && <PixelBadge variant="info"><span className="inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> {selected.role}</span></PixelBadge>}
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-digi-border bg-digi-darker px-3 py-2 text-[12px] text-digi-muted" style={mf}>
              <Info className="w-4 h-4 shrink-0 text-accent" />
              El contenido del detalle de miembro se definirá a continuación.
            </div>
          </div>
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-xl p-10 text-center lg:sticky lg:top-4">
            <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><UserRound className="w-6 h-6 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un miembro</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Elige un miembro de la lista para ver su información.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
