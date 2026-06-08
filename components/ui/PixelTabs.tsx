'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal } from 'lucide-react';

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
  /** Drop the container's own bottom border / margin (for use inside a toolbar row). */
  flush?: boolean;
}

const MORE_BTN_PX = 44; // space reserved for the "⋯" overflow button
const GAP_PX = 4;

export default function PixelTabs({ tabs, active, onChange, flush = false }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [menuOpen, setMenuOpen] = useState(false);

  // Measure tab widths and compute how many fit; the rest collapse into the menu.
  useEffect(() => {
    const compute = () => {
      const root = rootRef.current;
      const measure = measureRef.current;
      if (!root || !measure) return;
      const available = root.clientWidth;
      const items = Array.from(measure.children) as HTMLElement[];
      if (items.length === 0) return;

      const widths = items.map((el) => el.offsetWidth + GAP_PX);
      const total = widths.reduce((s, w) => s + w, 0) - GAP_PX;
      if (total <= available) {
        setVisibleCount(items.length);
        return;
      }
      let used = MORE_BTN_PX; // reserve room for the overflow button
      let count = 0;
      for (let i = 0; i < widths.length; i++) {
        if (used + widths[i] <= available) {
          used += widths[i];
          count++;
        } else break;
      }
      setVisibleCount(Math.max(1, count));
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (rootRef.current) ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, [tabs]);

  // Close the overflow menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const visible = tabs.slice(0, visibleCount);
  const hidden = tabs.slice(visibleCount);
  const activeHidden = hidden.some((t) => t.value === active);

  const tabClass = (isActive: boolean) =>
    `pivot-tab px-3 py-2 text-[10px] whitespace-nowrap border-b-2 -mb-[2px] transition-colors ${
      isActive ? 'is-active border-accent text-accent-glow' : 'border-transparent text-digi-muted hover:text-digi-text'
    }`;

  const countPill = (t: Tab, isActive: boolean) =>
    t.count !== undefined && (
      <span
        className={`pivot-count ml-1.5 px-1.5 py-0.5 text-[8px] ${
          isActive ? 'bg-accent/20 text-accent-glow' : 'bg-digi-card text-digi-muted'
        }`}
      >
        {t.count}
      </span>
    );

  return (
    <div ref={rootRef} className="relative w-full">
      {/* Hidden measurement layer — all tabs at natural width, clipped so it can't
          add page overflow. offsetWidth is still readable while clipped/hidden. */}
      <div
        aria-hidden
        className="absolute top-0 left-0 overflow-hidden pointer-events-none"
        style={{ height: 0, width: '100%', visibility: 'hidden' }}
      >
        <div ref={measureRef} className="pivot flex gap-1" style={{ width: 'max-content' }}>
          {tabs.map((t) => (
            <span key={t.value} className={tabClass(false)} style={{ fontFamily: 'var(--font-display)' }}>
              {t.label}
              {countPill(t, false)}
            </span>
          ))}
        </div>
      </div>

      {/* Visible tabs + overflow button */}
      <div
        className={`pivot flex gap-1 overflow-hidden ${
          flush ? 'pivot--flush' : 'pb-1 border-b-2 border-digi-border mb-4'
        }`}
        role="tablist"
      >
        {visible.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={active === tab.value}
            onClick={() => onChange(tab.value)}
            className={tabClass(active === tab.value)}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {tab.label}
            {countPill(tab, active === tab.value)}
          </button>
        ))}

        {hidden.length > 0 && (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Más pestañas"
            aria-expanded={menuOpen}
            className={`pivot-tab pivot-more px-2 py-2 shrink-0 flex items-center border-b-2 -mb-[2px] transition-colors ${
              activeHidden ? 'is-active border-accent text-accent-glow' : 'border-transparent text-digi-muted hover:text-digi-text'
            }`}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Overflow dropdown — the tabs that didn't fit, shown below */}
      {menuOpen && hidden.length > 0 && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-44 bg-digi-card border border-digi-border shadow-lg rounded py-1">
          {hidden.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                onChange(t.value);
                setMenuOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[11px] flex items-center justify-between gap-3 hover:bg-accent/10 transition-colors ${
                active === t.value ? 'text-accent-glow' : 'text-digi-text'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span className="truncate">{t.label}</span>
              {t.count !== undefined && <span className="text-[9px] text-digi-muted shrink-0">{t.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
