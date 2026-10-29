'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import BotonCerrar from '@/components/ui/BotonCerrar';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * EL PANEL DE DETALLE DE LA DERECHA — definición ÚNICA (Fernando, 2026-10-29).
 *
 * Textual: *«el botón de solicitar proyecto esté siempre fijo en la parte inferior del
 * contenedor en el espacio disponible y no haya que deslizarse hacia abajo […] solo la lista
 * de requerimientos debe ser deslizable internamente, lo mismo busco para otros paneles de la
 * derecha»*.
 *
 * Tres franjas: **cabecera** fija (título, subtítulo, cerrar), **cuerpo** y **pie** fijo con
 * las acciones. El panel llega al pie de la ruta (`PanelHastaElPie`) y lo que se desplaza es
 * el cuerpo, nunca la cabecera ni los botones.
 *
 * Los hijos del cuerpo no se encogen. El que deba quedarse con el sitio que sobra —una lista
 * larga— lleva `flex-1 min-h-32 flex flex-col` y su lista `min-h-0 overflow-y-auto`: así se
 * desplaza solo ella, y si ni siquiera caben sus 8 rem, se desplaza el cuerpo entero.
 *
 *   <PanelDetalle titulo={t.title} subtitulo="Proyecto" onCerrar={cerrar} pie={<button …/>}>
 *     <Galeria …/>
 *     <div className="flex-1 min-h-32 flex flex-col"><ul className="min-h-0 overflow-y-auto">…</ul></div>
 *   </PanelDetalle>
 */
export default function PanelDetalle({
  titulo, subtitulo, icono: Icono, onCerrar, pie, children, desdeAncho = 1280, className = '',
}: {
  titulo: ReactNode;
  /** El icono del tipo de registro, en su cuadro de acento, a la izquierda del título. */
  icono?: LucideIcon;
  subtitulo?: ReactNode;
  onCerrar?: () => void;
  /** Las acciones, fijas abajo. */
  pie?: ReactNode;
  children: ReactNode;
  desdeAncho?: number;
  className?: string;
}) {
  return (
    <PanelHastaElPie
      desdeAncho={desdeAncho}
      desplazar={false}
      className={`bg-digi-card border border-digi-border rounded-lg shadow-sm flex flex-col overflow-hidden lg:sticky lg:top-4 ${className}`}
    >
      <div className="shrink-0 flex items-start gap-3 p-4 border-b border-digi-border">
        {Icono && (
          <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
            <Icono className="w-5 h-5 text-accent" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{titulo}</h3>
          {subtitulo && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{subtitulo}</p>}
        </div>
        {onCerrar && <BotonCerrar onClick={onCerrar} />}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 [&>*]:shrink-0">
        {children}
      </div>
      {pie && <div className="shrink-0 p-4 border-t border-digi-border space-y-2">{pie}</div>}
    </PanelHastaElPie>
  );
}
