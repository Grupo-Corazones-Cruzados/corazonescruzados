'use client';

import { fmtNum } from '@/lib/format';
import { HardDrive } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface EspacioDriveDatos { limite: number | null; uso: number; libre: number | null }

/** Bytes en es-ES: «1,2 GB», «850 MB». */
export function fmtBytes(n: number): string {
  const u = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${fmtNum(n, i >= 3 ? 1 : 0)} ${u[i]}`;
}

/**
 * BARRA DE ESPACIO del Google Drive del usuario — definición única (Configuración →
 * Conexiones y Experiencias personales). Ámbar desde el 90 %, roja al llenarse.
 */
export default function EspacioDrive({ espacio }: { espacio: EspacioDriveDatos }) {
  if (espacio.limite == null) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
        <HardDrive className="w-4 h-4" /> {fmtBytes(espacio.uso)} usados · almacenamiento ilimitado
      </p>
    );
  }
  const pct = espacio.limite > 0 ? Math.min(100, (espacio.uso / espacio.limite) * 100) : 100;
  const lleno = (espacio.libre ?? 0) <= 0;
  const color = lleno ? 'bg-red-500' : pct >= 90 ? 'bg-amber-500' : 'bg-accent';
  return (
    <div className="flex flex-col gap-1 min-w-[200px]">
      <div className="flex items-center justify-between gap-3 text-[12px]" style={mf}>
        <span className="inline-flex items-center gap-1.5 text-digi-text"><HardDrive className="w-4 h-4 text-digi-muted" /> Google Drive</span>
        <span className={`tabular-nums ${lleno ? 'text-red-600 font-semibold' : 'text-digi-muted'}`}>
          {lleno ? 'Sin espacio' : `${fmtBytes(espacio.libre ?? 0)} libres`} de {fmtBytes(espacio.limite)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-black/[0.06] overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
