'use client';

import React from 'react';

/**
 * Botones estándar Fluent del dashboard (`.corp`). Fuente única del estilo de botón
 * usado por los módulos rediseñados (Centralizado, Automatizaciones, Tickets, …).
 *
 * Se exportan tanto las clases (para componer: `${BTN_PRIMARY} w-full`) como el
 * componente `<Button variant icon>`.
 */
/**
 * ⭐ `min-h-11 sm:min-h-0` — EL DESTINO TÁCTIL, EN LA FUENTE (2026-09-22).
 *
 * Estas tres constantes son los botones del panel: las usan **57 archivos**. Con `py-2`
 * medían **38 px**, por debajo de los 44 que necesita un pulgar, así que cada pantalla que
 * se pasaba a teléfono tenía que ir añadiéndoles `h-11 sm:h-auto` a mano, una por una.
 *
 * Puesto aquí, **todo el panel gana el destino táctil de golpe**. Es `min-h` y no `h` para
 * no pisar a quien ya traiga su propia altura, y `sm:min-h-0` devuelve la altura de
 * siempre en escritorio, donde hay puntero y 38 px sobran.
 */
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const BTN_DANGER =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-11 sm:min-h-0 border border-red-300 rounded text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:pointer-events-none';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

const VARIANT: Record<ButtonVariant, string> = {
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  danger: BTN_DANGER,
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Icono a la izquierda del texto (p. ej. un icono de lucide-react). */
  icon?: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  icon,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button className={`${VARIANT[variant]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
}
