'use client';

import { X } from 'lucide-react';

/**
 * CERRAR UNA VENTANA O UN PANEL — definición ÚNICA (Fernando, 2026-09-29: «que sigan siendo X
 * pero con un estilo de icono o botón más diseñado»).
 *
 * Había una «X» en texto con la tipografía pixel, ✕ en línea con estilos en `style`, e iconos
 * sueltos sin caja, cada uno de un tamaño. Ahora es un botón cuadrado con un fondo gris muy
 * suave SIEMPRE visible —se lee como botón, no como una letra— que se intensifica al pasar y
 * encoge un poco al pulsar. El color vive en `globals.css` (`.boton-cerrar`), sacado de los
 * tokens, así que sigue solo al modo oscuro. En táctil, `destino-tactil` da 44 px de área.
 *
 *   · `tamano`: `md` 32 px (ventanas y paneles) · `sm` 28 px (burbujas, tarjetas).
 *   · `tono="oscuro"`: sobre fondo oscuro o de color (cristal de Centralizado, cabecera del
 *     chat, ventanas de acceso de la portada).
 *
 * La × de QUITAR un elemento de una lista NO es esta: es `BotonQuitar` (papelera).
 */
export default function BotonCerrar({
  onClick, etiqueta = 'Cerrar', tamano = 'md', tono = 'claro', disabled = false, className = '', ...resto
}: {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  etiqueta?: string;
  tamano?: 'sm' | 'md';
  tono?: 'claro' | 'oscuro';
  disabled?: boolean;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'className' | 'disabled' | 'type'>) {
  const caja = tamano === 'sm' ? 'w-7 h-7' : 'w-8 h-8';
  const icono = tamano === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={`boton-cerrar ${tono === 'oscuro' ? 'boton-cerrar--oscuro' : ''} destino-tactil ${caja} shrink-0 inline-flex items-center justify-center rounded-lg border border-transparent transition-[background-color,color,transform] duration-150 active:scale-[0.94] focus-visible:outline-none disabled:opacity-40 disabled:pointer-events-none ${className}`}
      {...resto}
    >
      <X className={icono} strokeWidth={2.25} />
    </button>
  );
}
