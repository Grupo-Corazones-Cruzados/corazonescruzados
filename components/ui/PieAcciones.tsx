'use client';

import type { ReactNode } from 'react';
import BotonEliminar from '@/components/ui/BotonEliminar';

/**
 * LOS BOTONES DEL PIE DE UN PANEL — definición ÚNICA (Fernando, 2026-10-31, sobre el panel de
 * Pensamientos: «este panel tiene un buen diseño de botones, me gustaría dejarlo marcado como
 * regla»).
 *
 * UNA sola fila:
 *   · a la IZQUIERDA, sola, la papelera (`BotonEliminar`, sin texto);
 *   · a la DERECHA, los demás: primero los secundarios y al final, el último a la derecha, el
 *     principal (`BTN_PRIMARY`) — Publicar · Editar, Cancelar · Guardar.
 *
 * Nada a todo el ancho ni apilado en filas: el principal a todo el ancho con «Eliminar …»
 * debajo (como estaba Clientes) se lee como dos zonas y empuja el borrar al sitio del pulgar.
 * Si las acciones no caben en una fila, las de menos uso van a un `MenuMas` (⋯) junto a la
 * papelera, no a una segunda fila.
 *
 * Va en `pie` de `PanelDetalle` o de `PixelModal`, así queda fija abajo.
 *
 *   <PanelDetalle … pie={<PieAcciones onEliminar={borrar} etiquetaEliminar="Eliminar cliente">
 *     <button className={BTN_PRIMARY} onClick={guardar}>Guardar cambios</button>
 *   </PieAcciones>}>
 */
export default function PieAcciones({
  onEliminar, etiquetaEliminar = 'Eliminar', eliminarDeshabilitado = false, izquierda, children,
}: {
  /** Sin él no hay papelera (p. ej. quien no puede borrar). */
  onEliminar?: () => void;
  etiquetaEliminar?: string;
  eliminarDeshabilitado?: boolean;
  /** Lo que va junto a la papelera: el `MenuMas` de las acciones de menos uso. */
  izquierda?: ReactNode;
  /** Secundarios y, el último, el principal. */
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      {onEliminar && <BotonEliminar onClick={onEliminar} etiqueta={etiquetaEliminar} disabled={eliminarDeshabilitado} className="!w-auto shrink-0" />}
      {izquierda}
      <div className="flex-1" />
      {children}
    </div>
  );
}
