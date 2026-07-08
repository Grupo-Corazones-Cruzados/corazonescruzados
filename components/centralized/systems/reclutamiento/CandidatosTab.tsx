'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import ActionsMenu from '@/components/centralized/ActionsMenu';
import CriteriaSections from '@/components/centralized/reclutamiento/CriteriaSections';
import ProspeccionBar from '@/components/centralized/reclutamiento/ProspeccionBar';
import { Users, Mail, X, Search, Phone, Building2, Globe, UserCheck } from 'lucide-react';
import { type CandidateCriteria } from '@/lib/centralized/reclutamiento';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Pestaña "Candidatos": postulantes aprobados que iniciaron sesión y completaron su
 * perfil (`/api/admin/candidates`). Al seleccionar uno, a la derecha se ven sus
 * criterios en 4 secciones: Talento, Valores, Dimensiones y Apoyo (barras de %).
 * Los datos de evaluación aún no existen → se muestran como "sin evaluar".
 * Soporta `?candidato=<id>`.
 */
export default function CandidatosTab({ isAdmin, onChanged }: { isAdmin: boolean; onChanged?: () => void }) {
  const params = useSearchParams();
  const deepLinkId = params.get('candidato');

  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [converting, setConverting] = useState<string | null>(null);
  const [confirmConvert, setConfirmConvert] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/candidates');
      const data = await res.json();
      setCandidates(data.data || []);
    } catch { setCandidates([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (deepLinkId && candidates.some((c) => String(c.id) === String(deepLinkId))) {
      setSelectedId(String(deepLinkId));
    }
  }, [deepLinkId, candidates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => `${c.full_name || c.name || ''} ${c.email || ''}`.toLowerCase().includes(q));
  }, [candidates, search]);

  const selected = useMemo(() => candidates.find((c) => String(c.id) === selectedId) || null, [candidates, selectedId]);
  const criteria: CandidateCriteria | null = selected?.criteria || null;
  const displayName = (c: any) => c?.full_name || c?.name || c?.email || 'Candidato';

  const doConvert = async (c: any) => {
    setConfirmConvert(false);
    setConverting(String(c.id));
    try {
      const res = await fetch(`/api/admin/candidates/${c.id}/convert`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success('Candidato convertido en miembro');
      setSelectedId(null);
      await load();
      onChanged?.();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setConverting(null); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start">
      {/* Lista de candidatos */}
      <div className="min-w-0">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar candidato..."
            className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
        </div>

        {loading ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><Users className="w-5 h-5 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin candidatos</p>
            <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{isAdmin ? 'Aún no hay candidatos aprobados con perfil completo.' : 'No tienes acceso a los candidatos.'}</p>
          </div>
        ) : (
          <ul className="bg-digi-card border border-digi-border rounded-lg divide-y divide-digi-border/60 overflow-hidden">
            {filtered.map((c) => {
              const active = String(c.id) === selectedId;
              return (
                <li key={c.id}>
                  <button onClick={() => setSelectedId(String(c.id))}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors border-l-2 ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}>
                    <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                      <span className="text-[12px] font-semibold text-accent uppercase" style={mf}>{displayName(c).charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{displayName(c)}</p>
                      {c.email && <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{c.email}</p>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalle del candidato: criterios */}
      <aside className="w-full">
        {selected ? (
          <div className="space-y-4">
            {/* Encabezado */}
            <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                  <span className="text-[18px] font-semibold text-accent uppercase" style={df}>{displayName(selected).charAt(0)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-semibold text-digi-text leading-tight truncate" style={df}>{displayName(selected)}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-digi-muted" style={mf}>
                    {selected.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selected.email}</span>}
                    {selected.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selected.phone}</span>}
                    {selected.company && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {selected.company}</span>}
                    {selected.country && <span className="inline-flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {selected.country}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {isAdmin && (
                    <ActionsMenu items={[
                      { label: converting === String(selected.id) ? 'Convirtiendo…' : 'Convertir en miembro', icon: UserCheck, onClick: () => setConfirmConvert(true), disabled: converting === String(selected.id) },
                    ]} />
                  )}
                  <button onClick={() => setSelectedId(null)} className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
              </div>
              {/* Fecha a la izquierda, Prospección al borde derecho (misma altura) */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 mt-3">
                <p className="text-[11px] text-digi-muted/80" style={mf}>Última sesión: {fmtDate(selected.last_seen_at)}</p>
                <ProspeccionBar criteria={criteria} />
              </div>
            </div>

            <CriteriaSections criteria={criteria} />
          </div>
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-xl p-10 text-center lg:sticky lg:top-4">
            <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><Users className="w-6 h-6 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un candidato</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Elige un candidato para ver sus criterios: talento, valores, dimensiones y apoyo.</p>
          </div>
        )}
      </aside>

      <PixelConfirm
        open={confirmConvert}
        title="Convertir en miembro"
        message={selected ? `¿Convertir a ${displayName(selected)} en miembro? Se creará su perfil de miembro y su acceso al dashboard con su cuenta actual.` : ''}
        confirmLabel="Convertir"
        onConfirm={() => selected && doConvert(selected)}
        onCancel={() => setConfirmConvert(false)}
      />
    </div>
  );
}
