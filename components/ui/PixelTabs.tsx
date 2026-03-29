'use client';

interface Tab {
  value: string;
  label: string;
  count?: number;
}

export default function PixelTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: Tab[];
  active: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 border-b-2 border-digi-border mb-4" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={`px-3 py-2 text-[10px] whitespace-nowrap border-b-2 -mb-[2px] transition-colors ${
            active === tab.value
              ? 'border-accent text-accent-glow'
              : 'border-transparent text-digi-muted hover:text-digi-text'
          }`}
          style={{ fontFamily: "'Silkscreen', cursive" }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={`ml-1.5 px-1.5 py-0.5 text-[8px] ${
                active === tab.value
                  ? 'bg-accent/20 text-accent-glow'
                  : 'bg-digi-card text-digi-muted'
              }`}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
