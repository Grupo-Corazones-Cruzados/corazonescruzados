'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Selector, Tarjeta } from '@/componentes/ui';
import { cn } from '@/lib/utils';
import { ETIQUETA_COMIDA } from '@/lib/catalogo';
import { sumarDias } from '@/lib/fechas';
import type { TipoComida } from '@/generated/prisma/enums';

/** La barra de «qué día, qué comida, qué motorizado» de etiquetas, rutas y restricciones. Una sola. */
export default function FiltroDia({
  base, dia, comidas, comida, motorizados, motorizadoId,
}: {
  base: string;
  dia: string;
  comidas?: TipoComida[];
  comida?: TipoComida | null;
  motorizados?: { id: number; nombre: string }[];
  motorizadoId?: number | null;
}) {
  const router = useRouter();
  const ir = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const v = { dia, comida: comida ?? '', motorizado: motorizadoId ? String(motorizadoId) : '', ...cambios };
    Object.entries(v).forEach(([k, x]) => x && p.set(k, x));
    router.push(`${base}?${p}`);
  };
  const flecha = 'foco-visible flex w-10 shrink-0 items-center justify-center text-tenue transition-colors hover:bg-realce hover:text-texto';
  const selectores = Number(!!comidas) + Number(!!motorizados);
  /*
    Teléfono: el día ocupa una fila entera como un solo control [‹ fecha ›] y los
    selectores van debajo en dos columnas iguales; nada queda apilado con huecos.
    Desde sm todo cabe en una fila.
  */
  return (
    <Tarjeta className="flex flex-col gap-2 p-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex h-[34px] w-full overflow-hidden rounded border border-borde bg-tarjeta focus-within:border-acento sm:w-auto">
        <button type="button" className={flecha} onClick={() => ir({ dia: sumarDias(dia, -1) })} aria-label="Día anterior">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input
          type="date"
          value={dia}
          onChange={(e) => e.target.value && ir({ dia: e.target.value })}
          aria-label="Día"
          className="min-w-0 flex-1 border-x border-borde bg-transparent px-2 text-center text-[13px] font-semibold text-texto outline-none sm:w-40 sm:flex-none"
        />
        <button type="button" className={flecha} onClick={() => ir({ dia: sumarDias(dia, 1) })} aria-label="Día siguiente">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {selectores > 0 && (
        <div className={cn('grid gap-2 sm:flex', selectores === 2 ? 'grid-cols-2' : 'grid-cols-1')}>
          {comidas && (
            <Selector value={comida ?? ''} onChange={(e) => ir({ comida: e.target.value || null })} aria-label="Comida" className="min-w-0 sm:w-44">
              <option value="">Todas las comidas</option>
              {comidas.map((c) => <option key={c} value={c}>{ETIQUETA_COMIDA[c]}</option>)}
            </Selector>
          )}
          {motorizados && (
            <Selector value={motorizadoId ?? ''} onChange={(e) => ir({ motorizado: e.target.value || null })} aria-label="Motorizado" className="min-w-0 sm:w-48">
              <option value="">Todos los motorizados</option>
              {motorizados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </Selector>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
