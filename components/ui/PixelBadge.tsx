// Fuera del dashboard (landing/portal/juego) el badge conserva su look pixel oscuro
// vía estas clases; dentro de `.corp` el CSS lo reescribe al estilo Fluent "serio"
// (píldora neutra + punto y texto semántico). Ver `.corp .pixel-badge` en globals.css.
const VARIANTS: Record<string, string> = {
  default: 'border-digi-border text-digi-muted bg-digi-card',
  success: 'border-green-700/50 text-green-400 bg-green-900/20',
  warning: 'border-yellow-700/50 text-yellow-400 bg-yellow-900/20',
  error: 'border-red-700/50 text-red-400 bg-red-900/20',
  info: 'border-accent/50 text-accent-glow bg-accent/10',
};

export default function PixelBadge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  return (
    <span
      data-variant={variant}
      className={`pixel-badge inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium border ${VARIANTS[variant] || VARIANTS.default} ${className}`}
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {variant !== 'default' && <span aria-hidden className="pixel-badge-dot w-1.5 h-1.5 rounded-full bg-current shrink-0" />}
      {children}
    </span>
  );
}
