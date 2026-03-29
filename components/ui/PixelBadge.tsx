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
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] border ${VARIANTS[variant] || VARIANTS.default} ${className}`}
      style={{ fontFamily: "'Silkscreen', cursive" }}
    >
      {children}
    </span>
  );
}
