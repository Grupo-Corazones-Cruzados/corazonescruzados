'use client';

import { Pencil } from 'lucide-react';

/**
 * EDITAR UN ELEMENTO DE UNA LISTA — definición ÚNICA (2026-10-07).
 *
 * El hermano de `BotonQuitar`: mismas medidas (28 px `sm` / 24 px `xs`, 44 px de área en
 * táctil con `destino-tactil`) y mismo reposo gris, pero al pasar se pone en ACENTO, no en
 * rojo — edita, no borra. Va a la IZQUIERDA de la papelera cuando están juntos.
 *
 * Abre una superficie de edición (`QuickEditDialog` / `EditPanel`): nunca edita en la fila.
 * Había lápices sueltos con cinco tamaños y rellenos distintos; los nuevos usan este.
 */
export default function BotonEditar({
  onClick, etiqueta = 'Editar', title, disabled = false, tamano = 'sm', className = '',
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  etiqueta?: string;
  /** Texto al pasar el ratón si no es la etiqueta (p. ej. por qué está deshabilitado). */
  title?: string;
  disabled?: boolean;
  tamano?: 'xs' | 'sm';
  className?: string;
}) {
  const caja = tamano === 'xs' ? 'w-6 h-6' : 'w-7 h-7';
  const icono = tamano === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={title ?? etiqueta}
      className={`destino-tactil ${caja} shrink-0 inline-flex items-center justify-center rounded-md border border-transparent text-digi-muted transition-colors enabled:hover:text-accent enabled:hover:bg-accent-light focus-visible:outline-none disabled:opacity-35 disabled:cursor-not-allowed ${className}`}
    >
      <Pencil className={icono} />
    </button>
  );
}
