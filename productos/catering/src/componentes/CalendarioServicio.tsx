'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { DiaCalendario } from '@/lib/servicios';
import { aFechaSql, mesDe, sumarDias } from '@/lib/fechas';

/**
 * El calendario del servicio: un mes por bloque, con cada día pintado según lo
 * que es. Quien lo pulsa decide (cancelar, reactivar); el calendario solo enseña.
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

export function CalendarioServicio({
  dias,
  hoy,
  alPulsar,
  compacto,
}: {
  dias: DiaCalendario[];
  hoy: string;
  alPulsar?: (d: DiaCalendario) => void;
  compacto?: boolean;
}) {
  const meses = useMemo(() => {
    if (!dias.length) return [];
    const porDia = new Map(dias.map((d) => [d.dia, d]));
    const salida: { clave: string; titulo: string; celdas: (DiaCalendario | { dia: string; estado: 'FUERA' } | null)[] }[] = [];
    let { desde } = mesDe(dias[0].dia);
    const ultimo = dias[dias.length - 1].dia;
    while (desde <= ultimo) {
      const { hasta } = mesDe(desde);
      const primero = aFechaSql(desde);
      const hueco = (primero.getUTCDay() + 6) % 7; // lunes = 0
      const celdas: (typeof salida)[number]['celdas'] = Array(hueco).fill(null);
      for (let d = desde; d <= hasta; d = sumarDias(d, 1)) celdas.push(porDia.get(d) ?? { dia: d, estado: 'FUERA' });
      salida.push({ clave: desde, titulo: `${MESES[primero.getUTCMonth()]} ${primero.getUTCFullYear()}`, celdas });
      desde = sumarDias(hasta, 1);
    }
    return salida;
  }, [dias]);

  return (
    <div className={cn('grid gap-4', compacto ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3')}>
      {meses.map((m) => (
        <div key={m.clave} className="tarjeta p-3">
          <p className="mb-2 text-[12px] font-semibold first-letter:uppercase">{m.titulo}</p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-tenue">
            {CABECERA.map((c) => <span key={c}>{c}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {m.celdas.map((c, i) => {
              if (!c) return <span key={i} />;
              const n = Number(c.dia.slice(-2));
              const esHoy = c.dia === hoy;
              const pulsable = alPulsar && (c.estado === 'PENDIENTE' || c.estado === 'CANCELADO' || c.estado === 'SERVIDO');
              const clase = {
                SERVIDO: 'bg-acento text-acento-contraste',
                PENDIENTE: 'bg-acento-suave text-acento font-semibold',
                CANCELADO: 'bg-error-suave text-error line-through',
                FERIADO: 'bg-aviso-suave text-aviso',
                SIN_SERVICIO: 'text-tenue',
                FUERA: 'text-borde',
              }[c.estado];
              return (
                <button
                  key={c.dia}
                  type="button"
                  disabled={!pulsable}
                  onClick={() => pulsable && alPulsar!(c as DiaCalendario)}
                  title={c.estado === 'CANCELADO' && 'motivo' in c && c.motivo ? `Cancelado: ${c.motivo}` : c.estado === 'FERIADO' ? 'Feriado' : undefined}
                  className={cn(
                    'flex h-8 items-center justify-center rounded text-[12px] transition-colors',
                    clase,
                    esHoy && 'ring-2 ring-acento ring-offset-1 ring-offset-tarjeta',
                    pulsable ? 'cursor-pointer hover:brightness-95' : 'cursor-default',
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeyendaCalendario() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-tenue">
      {[
        ['bg-acento', 'Servido'],
        ['bg-acento-suave border border-acento', 'Pendiente'],
        ['bg-error-suave border border-error', 'Cancelado'],
        ['bg-aviso-suave border border-aviso', 'Feriado'],
      ].map(([c, t]) => (
        <span key={t} className="flex items-center gap-1.5"><span className={cn('h-3 w-3 rounded', c)} />{t}</span>
      ))}
    </div>
  );
}
