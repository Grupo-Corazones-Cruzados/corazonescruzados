'use client';

import React from 'react';

/**
 * Botones estándar Fluent del dashboard (`.corp`). Fuente única del estilo de botón
 * usado por los módulos rediseñados (Centralizado, Automatizaciones, Tickets, …).
 *
 * Se exportan tanto las clases (para componer: `${BTN_PRIMARY} w-full`) como el
 * componente `<Button variant icon>`.
 */
export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors disabled:opacity-50 disabled:pointer-events-none';
export const BTN_DANGER =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-300 rounded text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:pointer-events-none';

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
