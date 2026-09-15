'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Boton, Entrada, Selector, Tarjeta } from '@/componentes/ui';
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
  return (
    <Tarjeta className="flex flex-wrap items-center gap-2 p-3">
      <Boton variante="secundario" tamano="sm" icono={ChevronLeft} onClick={() => ir({ dia: sumarDias(dia, -1) })} aria-label="Día anterior" />
      <Entrada type="date" value={dia} onChange={(e) => e.target.value && ir({ dia: e.target.value })} className="w-44" />
      <Boton variante="secundario" tamano="sm" icono={ChevronRight} onClick={() => ir({ dia: sumarDias(dia, 1) })} aria-label="Día siguiente" />
      {comidas && (
        <Selector value={comida ?? ''} onChange={(e) => ir({ comida: e.target.value || null })} className="w-44">
          <option value="">Todas las comidas</option>
          {comidas.map((c) => <option key={c} value={c}>{ETIQUETA_COMIDA[c]}</option>)}
        </Selector>
      )}
      {motorizados && (
        <Selector value={motorizadoId ?? ''} onChange={(e) => ir({ motorizado: e.target.value || null })} className="w-48">
          <option value="">Todos los motorizados</option>
          {motorizados.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </Selector>
      )}
    </Tarjeta>
  );
}
