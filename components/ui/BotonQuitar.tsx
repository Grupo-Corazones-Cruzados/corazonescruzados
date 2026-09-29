'use client';

import { Trash2 } from 'lucide-react';

/**
 * QUITAR UN ELEMENTO DE UNA LISTA — definición ÚNICA (Fernando, 2026-09-29).
 *
 * «En los formularios existen muchos botones × para eliminar ítems de listas… me interesa
 * cambiar la × por un tachito de basura, un botoncito con mejor diseño que quede estándar».
 *
 * Había ×, ✕ y «×» sueltos con cinco tamaños y tres rojos, y además papeleras cada una con
 * su propio relleno. La × se queda para lo que CIERRA (una ventana, un aviso, una etiqueta);
 * lo que BORRA una fila de una lista es esto.
 *
 *   · 28 px (`sm`) o 24 px (`xs`, listas muy densas). En táctil, `destino-tactil` lleva el
 *     área a 44 px sin cambiar el dibujo.
 *   · Gris en reposo; rojo, con fondo y borde suaves, al pasar — avisa de que borra sin
 *     gritarlo en cada fila.
 *   · `type="button"` SIEMPRE: dentro de un formulario, un botón sin tipo lo envía, y quitar
 *     una fila acabaría guardando el formulario entero.
 *   · `tono="oscuro"` para los paneles de cristal oscuro de Centralizado.
 *
 * `etiqueta` es obligatoria en la práctica: es lo que lee un lector de pantalla y lo que sale
 * al pasar el ratón («Quitar etapa», «Eliminar subtarea»…).
 */
export default function BotonQuitar({
  onClick, etiqueta = 'Quitar', title, disabled = false, tamano = 'sm', tono = 'claro', className = '',
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  etiqueta?: string;
  /** Texto al pasar el ratón si no es la etiqueta (p. ej. por qué está deshabilitado). */
  title?: string;
  disabled?: boolean;
  tamano?: 'xs' | 'sm';
  tono?: 'claro' | 'oscuro';
  className?: string;
}) {
  const caja = tamano === 'xs' ? 'w-6 h-6' : 'w-7 h-7';
  const icono = tamano === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  // El color «al pasar» vive en `globals.css` (`.boton-quitar`), no en clases de Tailwind: el
  // modo oscuro del panel corrige los rojos por NOMBRE de clase (`.hover\:bg-red-50`) y unas
  // `enabled:hover:*` se le escaparían. Ahí están las dos versiones, sacadas de los tokens.
  const color = tono === 'oscuro' ? 'boton-quitar boton-quitar--oscuro text-white/45' : 'boton-quitar text-digi-muted';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={title ?? etiqueta}
      className={`destino-tactil ${caja} shrink-0 inline-flex items-center justify-center rounded-md border border-transparent transition-colors focus-visible:outline-none disabled:opacity-35 disabled:cursor-not-allowed ${color} ${className}`}
    >
      <Trash2 className={icono} />
    </button>
  );
}
