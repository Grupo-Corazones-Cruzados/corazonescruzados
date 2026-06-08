'use client';

import PixelTabs from './PixelTabs';

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface ModuleToolbarProps {
  /** Tabs (pivot). Collapse/scroll horizontally when they don't fit. */
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  /** Search box. Rendered only when onSearchChange is provided. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Right-aligned action (e.g. "+ Nuevo …" button). */
  action?: React.ReactNode;
}

/**
 * Single-row module toolbar (Azure/SharePoint command-bar style): tabs on the
 * left (scrollable when they overflow), search + primary action on the right.
 *
 * On phone/tablet (< lg, where the sidebar hamburger is visible) the tabs row is
 * lifted up to sit at the same height as the fixed hamburger button — with left
 * padding so it doesn't overlap it — and the search + action drop to a second row.
 */
export default function ModuleToolbar({
  tabs,
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  searchPlaceholder = 'Buscar...',
  action,
}: ModuleToolbarProps) {
  const hasControls = onSearchChange || action;
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3 mb-4 pb-2 border-b border-digi-border -mt-12 lg:mt-0">
      {/* Tabs — on mobile they sit on the hamburger row (pl-12 clears the button) */}
      <div className="flex-1 min-w-0 flex items-center min-h-10 lg:min-h-0 pl-12 lg:pl-0">
        {tabs && activeTab !== undefined && onTabChange && (
          <PixelTabs flush tabs={tabs} active={activeTab} onChange={onTabChange} />
        )}
      </div>

      {/* Search + action — second row on mobile, right side on desktop */}
      {hasControls && (
        <div className="flex items-center gap-3 shrink-0">
          {onSearchChange && (
            <input
              value={search ?? ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="field-control flex-1 lg:flex-none lg:w-56 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
    </div>
  );
}
