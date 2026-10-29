'use client';

import type { ReactNode } from 'react';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';

/**
 * UN PANEL QUE LLEGA HASTA EL PIE — definición ÚNICA (Fernando, 2026-10-29: «su altura siempre,
 * sin excepción aunque sean pocas opciones, se base en el espacio disponible […] no quiero que
 * se sienta que la altura del panel depende del contenido»).
 *
 * En escritorio (desde `desdeAncho`, por defecto `lg`) mide el hueco real hasta el pie de la
 * ruta y lo ocupa entero; lo que no quepa se desplaza DENTRO del panel. En el teléfono los
 * paneles van apilados y miden lo que su contenido. Es lo mismo que hace el raíl de filtros
 * (`FilterRail`) y la tabla (`PixelDataTable`), para que las tres columnas terminen a la vez.
 *
 *   <PanelHastaElPie className="bg-digi-card border border-digi-border rounded-lg">…</PanelHastaElPie>
 */
export default function PanelHastaElPie({
  children, className = '', desdeAncho = 1024, minimo = 320, desplazar = true,
}: {
  children: ReactNode;
  className?: string;
  desdeAncho?: number;
  minimo?: number;
  /** `false` si el panel ya trae su propia zona con desplazamiento dentro. */
  desplazar?: boolean;
}) {
  const { ref, style } = useAltoHastaElPie<HTMLDivElement>({ desdeAncho, minimo });
  return (
    <div ref={ref} style={style} className={`${style && desplazar ? 'overflow-y-auto' : ''} ${className}`}>
      {children}
    </div>
  );
}
