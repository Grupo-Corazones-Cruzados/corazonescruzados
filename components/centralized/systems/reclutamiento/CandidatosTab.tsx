'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import ActionsMenu from '@/components/centralized/ActionsMenu';
import {
  Users, Mail, X, Sparkles, Gem, Activity, HeartHandshake, Search, Phone, Building2, Globe, Info, ChevronDown,
  UserCheck,
} from 'lucide-react';
import {
  VALUE_ITEMS, DIMENSION_ITEMS, APOYO_ITEMS, sortedTalents,
  type CandidateCriteria, type CriterionItem,
} from '@/lib/centralized/reclutamiento';

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
                  <p className="text-[11px] text-digi-muted/80 mt-1" style={mf}>Última sesión: {fmtDate(selected.last_seen_at)}</p>
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
            </div>

            {!criteria && (
              <div className="flex items-center gap-2 rounded-lg border border-digi-border bg-digi-darker px-3 py-2 text-[12px] text-digi-muted" style={mf}>
                <Info className="w-4 h-4 shrink-0 text-accent" />
                Los criterios se llenarán desde el sistema de evaluación. Aún no hay datos para este candidato.
              </div>
            )}

            {/* 1 · Talento */}
            <Section title="Talento" Icon={Sparkles} subtitle="Top 10 talentos, de mayor a menor potencial" count={sortedTalents(criteria?.talents).length || 10}>
              {(() => {
                const talents = sortedTalents(criteria?.talents);
                if (talents.length === 0) return <EmptyNote text="Sin datos de talentos aún." />;
                return <div className="space-y-2.5">{talents.map((t, i) => <Bar key={i} label={t.name} value={t.score} />)}</div>;
              })()}
            </Section>

            {/* 2 · Valores (barra divergente: completadas vs no completadas) */}
            <Section title="Valores" Icon={Gem} subtitle="Cumplimiento de tareas por valor" count={VALUE_ITEMS.length}>
              <div className="space-y-2.5">
                {VALUE_ITEMS.map((it) => <ValueBalanceBar key={it.key} label={it.label} data={criteria?.valuesBalance?.[it.key]} />)}
              </div>
            </Section>

            {/* 3 · Dimensiones */}
            <Section title="Dimensiones" Icon={Activity} subtitle="Problemas en cada aspecto de su desarrollo" count={DIMENSION_ITEMS.length}>
              <CriteriaGrid items={DIMENSION_ITEMS} group={criteria?.dimensions} />
            </Section>

            {/* 4 · Apoyo */}
            <Section title="Apoyo" Icon={HeartHandshake} subtitle="Redes de apoyo del candidato" count={APOYO_ITEMS.length}>
              <CriteriaGrid items={APOYO_ITEMS} group={criteria?.apoyo} />
            </Section>
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

function Section({ title, subtitle, Icon, count, children }: { title: string; subtitle?: string; Icon: any; count?: number; children: React.ReactNode }) {
  // Contraída por defecto; se expande al hacer clic en la cabecera.
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2.5 p-4 text-left hover:bg-black/[0.02] transition-colors"
      >
        <div className="w-8 h-8 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-accent" /></div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13.5px] font-semibold text-digi-text leading-none" style={df}>{title}</h4>
          {subtitle && <p className="text-[11px] text-digi-muted mt-0.5 truncate" style={mf}>{subtitle}</p>}
        </div>
        {count != null && (
          <span className="text-[11px] text-digi-muted tabular-nums shrink-0" style={mf}>{count}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-digi-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function CriteriaGrid({ items, group }: { items: CriterionItem[]; group?: Record<string, number> | null }) {
  return (
    <div className="space-y-2.5">
      {items.map((it) => <Bar key={it.key} label={it.label} value={group?.[it.key]} />)}
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number | null | undefined }) {
  const has = typeof value === 'number';
  const pct = has ? Math.max(0, Math.min(100, value as number)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-[12.5px] text-digi-text truncate" style={mf} title={label}>{label}</span>
      <div className="flex-1 h-2 rounded-full bg-digi-border/50 overflow-hidden">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-right text-[12px] tabular-nums shrink-0" style={mf}>
        {has ? `${Math.round(pct)}%` : <span className="text-digi-muted/50">—</span>}
      </span>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-[12px] text-digi-muted py-2" style={mf}>{text}</p>;
}

/**
 * Barra DIVERGENTE de un valor: una sola barra donde el tramo verde = proporción de
 * tareas completadas y el tramo rojo = proporción de no completadas (sobre el total de
 * tareas etiquetadas con ese valor). A la derecha, los conteos ✓/✗.
 */
function ValueBalanceBar({ label, data }: { label: string; data?: { completed: number; failed: number } }) {
  const completed = data?.completed ?? 0;
  const failed = data?.failed ?? 0;
  const total = completed + failed;
  const has = total > 0;
  const pos = has ? (completed / total) * 100 : 0;
  const neg = has ? (failed / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-[12.5px] text-digi-text truncate" style={mf} title={label}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-digi-border/50 overflow-hidden flex">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pos}%` }} />
        <div className="h-full bg-red-500 transition-all" style={{ width: `${neg}%` }} />
      </div>
      <span className="w-14 text-right text-[11.5px] tabular-nums shrink-0" style={mf}>
        {has ? (
          <><span className="text-emerald-600">{completed}</span><span className="text-digi-muted/50">/</span><span className="text-red-500">{failed}</span></>
        ) : <span className="text-digi-muted/50">—</span>}
      </span>
    </div>
  );
}
