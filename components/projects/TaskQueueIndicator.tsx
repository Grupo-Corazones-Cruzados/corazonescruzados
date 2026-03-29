'use client';

import { useState } from 'react';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;

export default function TaskQueueIndicator({
  count,
  items,
  isProcessing,
}: {
  count: number;
  items: { id: string; title: string }[];
  isProcessing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (count === 0 && !isProcessing) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`px-2 py-1 text-[8px] border transition-colors ${
          isProcessing
            ? 'border-green-500/50 text-green-400 bg-green-900/20 animate-pulse'
            : 'border-yellow-500/50 text-yellow-400 bg-yellow-900/20'
        }`}
        style={pf}
      >
        {isProcessing ? 'Enviando...' : `Cola: ${count}`}
      </button>

      {expanded && items.length > 0 && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-digi-card border-2 border-digi-border p-2 z-10">
          <p className="text-[8px] text-accent-glow mb-1" style={pf}>En cola:</p>
          {items.map((item, i) => (
            <p key={item.id} className="text-[9px] text-digi-muted truncate" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              {i + 1}. {item.title}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
