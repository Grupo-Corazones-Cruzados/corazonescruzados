'use client';

import { useRouter } from 'next/navigation';
import { PasoDia, Selector, Tarjeta } from '@/componentes/ui';
import { cn } from '@/lib/utils';
import { ETIQUETA_COMIDA } from '@/lib/catalogo';
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
  const selectores = Number(!!comidas) + Number(!!motorizados);
  /*
    Teléfono: el día ocupa una fila entera como un solo control [‹ fecha ›] y los
    selectores van debajo en dos columnas iguales; nada queda apilado con huecos.
    Desde sm todo cabe en una fila.
  */
  return (
    <Tarjeta className="flex flex-col gap-2 p-2 sm:flex-row sm:flex-wrap sm:items-center">
      <PasoDia dia={dia} alCambiar={(d) => ir({ dia: d })} />
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
