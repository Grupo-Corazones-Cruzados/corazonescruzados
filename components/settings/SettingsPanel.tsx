'use client';

import type { LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Shell de un panel de Configuración: **cabecera fija · cuerpo que se desplaza · pie
 * de acciones fijo**.
 *
 * ── POR QUÉ EL CUERPO SE DESPLAZA POR DENTRO (2026-08-15) ─────────────────────
 * El alto del panel ya no lo pone su contenido, sino el hueco que queda hasta el
 * pie de la aplicación (`useAltoHastaElPie` en la página). Con el alto impuesto, el
 * contenido tiene que caber por sus propios medios: de ahí `flex-1 min-h-0
 * overflow-y-auto` en el cuerpo.
 *
 * ⚠️ **`min-h-0` no es opcional.** Un hijo flex no se deja encoger por debajo de su
 * contenido, así que sin él el cuerpo se desborda y el scroll interno no aparece
 * nunca — el pie se iría fuera de la tarjeta.
 *
 * ── EL PIE ES UNA RANURA, NO PARTE DEL CUERPO ────────────────────────────────
 * `pie` se pinta FUERA del área que se desplaza (`shrink-0`), así que el botón de
 * guardar está siempre visible por muchos campos que haya. Es lo que pidió
 * Fernando: *«si hay desbordamiento interno el deslizamiento no debe afectar a los
 * botones de guardado»*.
 */
export default function SettingsPanel({
  Icon, title, subtitle, children, headerExtra, pie,
  bodyClassName = 'p-4 space-y-4', className = '',
}: {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  /** Acciones fijas al fondo (p. ej. «Guardar»). Fuera del área que se desplaza. */
  pie?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={`flex flex-col min-h-0 bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden ${className}`}>
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-digi-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-accent" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-digi-text leading-tight truncate" style={mf}>{title}</h3>
          {subtitle && <p className="text-[11px] text-digi-muted truncate" style={mf}>{subtitle}</p>}
        </div>
        {headerExtra}
      </header>

      <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>

      {pie && (
        <div className="shrink-0 border-t border-digi-border px-4 py-3 flex justify-end">{pie}</div>
      )}
    </section>
  );
}
