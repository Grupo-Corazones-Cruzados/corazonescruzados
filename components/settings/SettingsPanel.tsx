'use client';

import type { LucideIcon } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Shell reusable de un panel de Configuración: ancho uniforme, alto completo del carril,
 * cabecera fija y cuerpo con scroll vertical interno. Lo usan Perfil, CV, Disponibilidad y
 * Portafolio para quedar como columnas deslizables (una sola definición del contenedor).
 */
export default function SettingsPanel({
  Icon, title, subtitle, children, headerExtra, bodyClassName = 'p-4 space-y-4', className = '',
}: {
  Icon: LucideIcon;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section className={`w-[400px] shrink-0 h-full flex flex-col bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden ${className}`}>
      <header className="flex items-center gap-2.5 px-4 py-3 border-b border-digi-border shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent-light flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-accent" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[14px] font-semibold text-digi-text leading-tight truncate" style={mf}>{title}</h3>
          {subtitle && <p className="text-[11px] text-digi-muted truncate" style={mf}>{subtitle}</p>}
        </div>
        {headerExtra}
      </header>
      <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>
    </section>
  );
}
