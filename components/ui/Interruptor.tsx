'use client';

/**
 * INTERRUPTOR (switch) — definición ÚNICA del control de encender/apagar.
 *
 * Existía suelto dentro de `AvailabilityPanel` (los días de la semana) y hacía falta
 * otra vez para decidir qué datos salen al CV público. Copiarlo habría sido la
 * segunda definición del mismo control: se extrae, y quien lo cambie lo cambia en
 * los dos sitios.
 *
 * Es un `<button role="switch">` y no un `<input type=checkbox>` disfrazado porque
 * lo que se pinta es una pastilla que se desliza: el checkbox habría que ocultarlo y
 * volver a inventarle el foco. Con `role`+`aria-checked` un lector de pantalla lo
 * anuncia igual y el foco es el del botón, que ya funciona.
 */
export default function Interruptor({
  activo,
  onChange,
  disabled = false,
  etiqueta,
  className = '',
}: {
  activo: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  /** Etiqueta accesible. Obligatoria si el control no va dentro de un `<label>`. */
  etiqueta?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled}
      onClick={() => onChange(!activo)}
      className={`relative w-9 h-5 rounded-full shrink-0 transition-colors disabled:opacity-50
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1
        ${activo ? 'bg-accent' : 'bg-digi-border'} ${className}`}
    >
      <span
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow-sm transition-transform"
        style={{ background: '#fff', transform: activo ? 'translateX(16px)' : 'none' }}
      />
    </button>
  );
}
