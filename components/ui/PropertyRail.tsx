'use client';

interface PropertyItem {
  label: string;
  value: React.ReactNode;
}

interface PropertyRailProps {
  title?: string;
  items: PropertyItem[];
  /** Extra cards/actions rendered below the properties card. */
  children?: React.ReactNode;
}

/**
 * Fluent-style property rail: a sticky side panel of key/value metadata for a
 * detail page, with optional extra cards (quick actions, etc.) below.
 */
export default function PropertyRail({ title = 'Propiedades', items, children }: PropertyRailProps) {
  return (
    <aside className="lg:sticky lg:top-4 self-start space-y-3">
      <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
        <h3
          className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h3>
        <dl className="space-y-2.5">
          {items.map((it, i) => (
            <div key={i} className="flex items-start justify-between gap-3 text-[12px]">
              <dt className="text-digi-muted shrink-0" style={{ fontFamily: 'var(--font-body)' }}>{it.label}</dt>
              <dd className="text-digi-text text-right break-words min-w-0" style={{ fontFamily: 'var(--font-body)' }}>{it.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {children}
    </aside>
  );
}
