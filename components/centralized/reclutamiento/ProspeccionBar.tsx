'use client';

import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import type { CandidateCriteria } from '@/lib/centralized/reclutamiento';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Barrita compacta de PROSPECCIÓN: capacidad para alcanzar el objetivo a partir de todos
 * los indicadores de Valores (total positivo = tareas completadas, total negativo =
 * fallidas). Se anima el llenado al aparecer/cargar para dar sensación de cálculo.
 * Pensada para ir en la cabecera del perfil (candidato/miembro).
 */
export default function ProspeccionBar({ criteria }: { criteria: CandidateCriteria | null }) {
  const vb = criteria?.valuesBalance || {};
  let pos = 0, neg = 0;
  for (const k of Object.keys(vb)) { pos += vb[k].completed || 0; neg += vb[k].failed || 0; }
  const total = pos + neg;
  const posPct = total ? (pos / total) * 100 : 0;
  const negPct = total ? (neg / total) * 100 : 0;
  const net = pos - neg;

  // Arranca en 0 y anima hasta el ancho real cuando cambian los datos (o al montar).
  const [grown, setGrown] = useState(false);
  useEffect(() => { setGrown(false); const t = setTimeout(() => setGrown(true), 60); return () => clearTimeout(t); }, [pos, neg]);

  return (
    <div className="inline-flex items-center gap-2" style={mf} title={`Prospección · +${pos} positivo / −${neg} negativo`}>
      <Target className="w-3.5 h-3.5 text-accent shrink-0" />
      <span className="text-[11px] text-digi-muted hidden sm:inline">Prospección</span>
      <div className="w-32 h-2 rounded-full bg-digi-border/50 overflow-hidden flex shrink-0">
        <div className="h-full bg-emerald-500 transition-[width] duration-[900ms] ease-out" style={{ width: grown ? `${posPct}%` : '0%' }} />
        <div className="h-full bg-red-500 transition-[width] duration-[900ms] ease-out" style={{ width: grown ? `${negPct}%` : '0%' }} />
      </div>
      <span className={`text-[11px] font-semibold tabular-nums shrink-0 ${net > 0 ? 'text-emerald-500' : net < 0 ? 'text-red-500' : 'text-digi-muted'}`}>{net > 0 ? `+${net}` : net}</span>
    </div>
  );
}
