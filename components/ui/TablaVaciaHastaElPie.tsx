'use client';

import type { ReactNode } from 'react';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';

/**
 * Envoltorio de una `PixelDataTable` para que su estado VACÍO o «Cargando…» también llegue al
 * pie en escritorio (Fernando, 2026-10-29: «no quiero que se sienta que el panel, su altura,
 * depende del contenido»). Con filas no hace nada: la tabla ya se mide sola hasta el pie.
 * Sin filas, la tarjeta `.pixel-card` de la tabla se estira al alto medido y centra su texto.
 *
 *   <TablaVaciaHastaElPie vacia={filas.length === 0}><PixelDataTable data={filas} … /></TablaVaciaHastaElPie>
 */
export default function TablaVaciaHastaElPie({ vacia, reserva = 0, children }: {
  vacia: boolean;
  /** Lo que va justo debajo de la tabla (p. ej. una fila de totales): el mismo `bottomReserve`. */
  reserva?: number;
  children: ReactNode;
}) {
  const { ref, style } = useAltoHastaElPie<HTMLDivElement>({ desdeAncho: 1024, minimo: 320 });
  const estirar = vacia && !!style;
  return (
    <div ref={ref} style={estirar && style ? { height: Math.max(style.height - reserva, 200) } : undefined}
      className={estirar ? 'flex flex-col [&>.pixel-card]:flex-1 [&>.pixel-card]:flex [&>.pixel-card]:flex-col [&>.pixel-card]:justify-center' : undefined}>
      {children}
    </div>
  );
}
