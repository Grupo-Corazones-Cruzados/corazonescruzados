'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, MoreHorizontal } from 'lucide-react';

interface OverflowItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface DetailHeaderProps {
  breadcrumb: { label: string; href: string };
  title: string;
  status?: React.ReactNode;
  /** Inline meta chips next to the status. */
  chips?: React.ReactNode;
  /** Command-bar buttons (primary / secondary actions). */
  actions?: React.ReactNode;
  /** Extra actions collapsed under a "⋯" menu. */
  overflow?: OverflowItem[];
}

/**
 * Fluent/M365-style detail header: breadcrumb + title + status/chips on the left,
 * a command bar (actions + overflow menu) on the right, and a divider below.
 */
export default function DetailHeader({ breadcrumb, title, status, chips, actions, overflow }: DetailHeaderProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasOverflow = !!overflow && overflow.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="mb-5">
      <Link
        href={breadcrumb.href}
        className="inline-flex items-center gap-0.5 text-[11px] text-digi-muted hover:text-accent transition-colors mb-2"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ChevronRight className="w-3.5 h-3.5 rotate-180" />
        {breadcrumb.label}
      </Link>

      <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b border-digi-border">
        <div className="min-w-0">
          <h1 className="page-title pixel-heading text-digi-text truncate">{title}</h1>
          {(status || chips) && (
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {status}
              {chips}
            </div>
          )}
        </div>

        {(actions || hasOverflow) && (
          <div className="flex flex-wrap items-center gap-2 justify-end" ref={ref}>
            {actions}
            {hasOverflow && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpen((o) => !o)}
                  aria-label="Más acciones"
                  aria-expanded={open}
                  className={`w-9 h-9 flex items-center justify-center border rounded transition-colors ${open ? 'border-accent/40 bg-accent-light text-accent' : 'border-digi-border text-digi-muted hover:bg-accent/10 hover:text-accent hover:border-accent/40'}`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {open && (
                  <div className="absolute right-0 top-full mt-1.5 z-30 min-w-48 bg-digi-card border border-digi-border shadow-lg rounded-lg p-1">
                    {overflow!.map((it, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => { it.onClick(); setOpen(false); }}
                        className={`w-full text-left px-2.5 py-1.5 text-[12px] rounded-md transition-colors ${it.danger ? 'text-red-500 hover:bg-red-500/10' : 'text-digi-text hover:bg-accent/10'}`}
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Small meta chip for the header (cliente, costo, fecha…). */
export function HeaderChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-digi-muted bg-[#f3f2f1] border border-digi-border px-2 py-0.5 rounded"
      style={{ fontFamily: 'var(--font-body)' }}
    >
      {children}
    </span>
  );
}
