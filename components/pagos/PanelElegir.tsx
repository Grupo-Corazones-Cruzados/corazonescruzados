'use client';

import { Check } from 'lucide-react';
import { fmt2 } from '@/lib/format';

type Modo = 'completo' | 'etapas' | 'requerimientos';

/**
 * «CÓMO QUIERES PAGAR» (Fernando, 2026-11-12). En el enlace de pago de un ticket, el cliente elige el
 * formato: el pago completo de lo pendiente, unas ETAPAS o unos REQUERIMIENTOS (los registros de trabajo).
 * Lo pagado se reparte después sobre los requerimientos de más antiguo a más nuevo; uno a medias dice
 * cuánto lleva («Pagado $100 de $200»). Mismo lenguaje que el resto de la pantalla de pago: rótulo violeta
 * en mayúsculas, filas separadas por líneas, nada con relleno de fondo salvo el control segmentado.
 */
export default function PanelElegir({ elegir, modo, marcadas, onModo, onAlternar, total, recalculando, bloqueo }: {
  elegir: { pendiente: number; etapas: any[]; requerimientos: any[] };
  modo: Modo;
  marcadas: number[];
  onModo: (m: Modo) => void;
  onAlternar: (id: number) => void;
  total: number | null;
  recalculando: boolean;
  bloqueo: string;
}) {
  const etapasPendientes = elegir.etapas.filter((e) => !e.pagada && e.importe > 0);
  const opciones: { id: Modo; texto: string }[] = [
    { id: 'completo', texto: 'Pago completo' },
    ...(etapasPendientes.length ? [{ id: 'etapas' as Modo, texto: 'Por etapa' }] : []),
    ...(elegir.requerimientos.some((r) => r.restante > 0) ? [{ id: 'requerimientos' as Modo, texto: 'Por requerimiento' }] : []),
  ];

  const fila = (id: number, nombre: string, sub: string | null, importe: number, hecho: boolean, marcada: boolean) => (
    <li key={id}>
      <button type="button" disabled={hecho} onClick={() => onAlternar(id)} aria-pressed={marcada}
        className="w-full flex items-center gap-3 py-3 text-left disabled:cursor-default">
        <span className={`w-5 h-5 shrink-0 rounded-[5px] flex items-center justify-center border transition-colors ${
          hecho ? 'bg-[var(--violeta)] border-[var(--violeta)] text-white opacity-60'
          : marcada ? 'bg-[var(--violeta-vivo)] border-[var(--violeta-vivo)] text-white'
          : 'border-[var(--linea-fuerte)]'}`}>
          {(hecho || marcada) && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] ${hecho ? 'text-[var(--tenue)]' : 'text-[var(--texto)]'}`}>{nombre}</span>
          {sub && <span className="block text-[12.5px] text-[var(--tenue)]">{sub}</span>}
        </span>
        <span className={`shrink-0 text-[15px] tabular-nums ${hecho ? 'text-[var(--tenue)]' : 'text-[var(--texto)]'}`}>{hecho ? 'Pagado' : `$${fmt2(importe)}`}</span>
      </button>
    </li>
  );

  return (
    <div className="mt-6 border-t border-[var(--linea)] pt-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--violeta-txt)]">Cómo quieres pagar</p>
        <p className="text-[13px] text-[var(--tenue)]">Pendiente: <span className="font-semibold tabular-nums text-[var(--texto)]">${fmt2(elegir.pendiente)}</span></p>
      </div>

      {opciones.length > 1 && (
        <div role="radiogroup" aria-label="Formato de pago" className="mt-3 grid gap-1 rounded-lg border border-[var(--linea)] p-1"
          style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}>
          {opciones.map((o) => (
            <button key={o.id} type="button" role="radio" aria-checked={modo === o.id} onClick={() => onModo(o.id)}
              className={`h-10 rounded-md text-[14px] font-medium transition-colors ${modo === o.id
                ? 'bg-[var(--violeta)] text-white' : 'text-[var(--suave)] hover:text-[var(--texto)]'}`}>
              {o.texto}
            </button>
          ))}
        </div>
      )}

      {modo === 'etapas' && (
        <ul className="mt-2 divide-y divide-[var(--linea)]">
          {elegir.etapas.map((e) => fila(e.id, e.nombre, null, e.importe, !!e.pagada, marcadas.includes(e.id)))}
        </ul>
      )}
      {modo === 'requerimientos' && (
        <ul className="mt-2 divide-y divide-[var(--linea)]">
          {elegir.requerimientos.map((r) => fila(
            r.id, r.nombre,
            r.estado === 'parcial' ? `Pagado $${fmt2(r.pagado)} de $${fmt2(r.costo)} · quedan $${fmt2(r.restante)}`
              : r.fecha ? new Date(r.fecha + 'T12:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
            r.restante, r.estado === 'pagado', marcadas.includes(r.id),
          ))}
        </ul>
      )}
      {modo === 'completo' && (
        <p className="mt-3 text-[14px] text-[var(--suave)]">Pagas todo lo que queda pendiente de este ticket.</p>
      )}

      {modo !== 'completo' && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--linea)] pt-3">
          <p className={`text-[13.5px] ${bloqueo ? 'text-red-700' : 'text-[var(--tenue)]'}`}>
            {bloqueo || (recalculando ? 'Calculando…' : `${marcadas.length} elegido${marcadas.length === 1 ? '' : 's'}`)}
          </p>
          <p className="text-[15px] font-semibold tabular-nums text-[var(--texto)]">{total != null && !recalculando ? `$${fmt2(total)}` : '—'}</p>
        </div>
      )}
    </div>
  );
}
