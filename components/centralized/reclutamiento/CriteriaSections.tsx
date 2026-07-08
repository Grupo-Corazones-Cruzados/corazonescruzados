'use client';

import { useState } from 'react';
import { Sparkles, Gem, Activity, HeartHandshake, Info, ChevronDown } from 'lucide-react';
import { VALUE_ITEMS, DIMENSION_ITEMS, APOYO_ITEMS, sortedTalents, type CandidateCriteria, type CriterionItem } from '@/lib/centralized/reclutamiento';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * Criterios de desarrollo de un sujeto (candidato o miembro), en 4 secciones colapsables:
 * Talento (top 10 %), Valores (barra divergente completadas/fallidas), Dimensiones
 * (carga de problemas) y Apoyo. Reutilizable en la pestaña de Candidatos y en la
 * prospección de Miembros. Sin datos → se muestra como "sin evaluar" (—).
 */
export default function CriteriaSections({ criteria, defaultOpen = false }: { criteria: CandidateCriteria | null; defaultOpen?: boolean }) {
  return (
    <div className="space-y-4">
      {!criteria && (
        <div className="flex items-center gap-2 rounded-lg border border-digi-border bg-digi-darker px-3 py-2 text-[12px] text-digi-muted" style={mf}>
          <Info className="w-4 h-4 shrink-0 text-accent" />
          Aún no hay datos de criterios. Se llenan desde Apoyo y Autoayuda (dimensiones) y el Horario de Vida (talentos/valores).
        </div>
      )}

      <Section title="Talento" Icon={Sparkles} subtitle="Top 10 talentos, de mayor a menor potencial" count={sortedTalents(criteria?.talents).length || 10} defaultOpen={defaultOpen}>
        {(() => {
          const talents = sortedTalents(criteria?.talents);
          if (talents.length === 0) return <EmptyNote text="Sin datos de talentos aún." />;
          return <div className="space-y-2.5">{talents.map((t, i) => <Bar key={i} label={t.name} value={t.score} />)}</div>;
        })()}
      </Section>

      <Section title="Valores" Icon={Gem} subtitle="Cumplimiento de tareas por valor" count={VALUE_ITEMS.length} defaultOpen={defaultOpen}>
        <div className="space-y-2.5">
          {VALUE_ITEMS.map((it) => <ValueBalanceBar key={it.key} label={it.label} data={criteria?.valuesBalance?.[it.key]} />)}
        </div>
      </Section>

      <Section title="Dimensiones" Icon={Activity} subtitle="Problemas en cada aspecto de su desarrollo" count={DIMENSION_ITEMS.length} defaultOpen={defaultOpen}>
        <CriteriaGrid items={DIMENSION_ITEMS} group={criteria?.dimensions} />
      </Section>

      <Section title="Apoyo" Icon={HeartHandshake} subtitle="Redes de apoyo del usuario" count={APOYO_ITEMS.length} defaultOpen={defaultOpen}>
        <CriteriaGrid items={APOYO_ITEMS} group={criteria?.apoyo} />
      </Section>
    </div>
  );
}

function Section({ title, subtitle, Icon, count, children, defaultOpen = false }: { title: string; subtitle?: string; Icon: any; count?: number; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="w-full flex items-center gap-2.5 p-4 text-left hover:bg-black/[0.02] transition-colors">
        <div className="w-8 h-8 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-accent" /></div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[13.5px] font-semibold text-digi-text leading-none" style={df}>{title}</h4>
          {subtitle && <p className="text-[11px] text-digi-muted mt-0.5 truncate" style={mf}>{subtitle}</p>}
        </div>
        {count != null && <span className="text-[11px] text-digi-muted tabular-nums shrink-0" style={mf}>{count}</span>}
        <ChevronDown className={`w-4 h-4 text-digi-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function CriteriaGrid({ items, group }: { items: CriterionItem[]; group?: Record<string, number> | null }) {
  return <div className="space-y-2.5">{items.map((it) => <Bar key={it.key} label={it.label} value={group?.[it.key]} />)}</div>;
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
        {has ? <><span className="text-emerald-600">{completed}</span><span className="text-digi-muted/50">/</span><span className="text-red-500">{failed}</span></> : <span className="text-digi-muted/50">—</span>}
      </span>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <p className="text-[12px] text-digi-muted py-2" style={mf}>{text}</p>;
}
