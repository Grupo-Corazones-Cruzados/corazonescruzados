'use client';

import { Trash2 } from 'lucide-react';
import { BTN_DANGER } from '@/components/ui/Button';

/**
 * ELIMINAR EL REGISTRO ENTERO — definición ÚNICA (Fernando, 2026-10-31: «el botón de eliminar
 * prefiero que siempre sea un botón con el icono sin texto»).
 *
 * Es el botón rojo de los pies de panel y de las barras de acciones: borde rojo y papelera,
 * SIN texto, del mismo alto que sus vecinos (`BTN_PRIMARY` / `BTN_SECONDARY`). Había
 * «Eliminar», «Eliminar cliente», «Eliminar suscripción»… cada uno con su tamaño y su rojo.
 *
 * El nombre va en `title` y `aria-label` («Eliminar cliente»): un icono sin nombre no se sabe
 * qué hace. Para QUITAR una fila de una lista dentro de un formulario está `BotonQuitar`.
 *
 * En un pie, va a la IZQUIERDA y separado del resto: ver `PieAcciones`.
 */
export default function BotonEliminar({
  onClick, etiqueta = 'Eliminar', title, disabled = false, className = '',
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  etiqueta?: string;
  /** Texto al pasar el ratón si no es la etiqueta (p. ej. por qué está deshabilitado). */
  title?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={title ?? etiqueta}
      className={`${BTN_DANGER} shrink-0 min-w-11 sm:min-w-0 ${className}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}
