'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/lib/store';
import type { MemoryLevel } from '@/lib/store';
import { Circle, RefreshCw, Menu, HardDrive } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

const LEVEL_COLORS: Record<MemoryLevel, { dot: string; text: string; bg: string }> = {
  ok:       { dot: 'fill-emerald-500 text-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  warn:     { dot: 'fill-yellow-500 text-yellow-500',   text: 'text-yellow-400',  bg: 'bg-yellow-500/10' },
  critical: { dot: 'fill-red-500 text-red-500',         text: 'text-red-400',     bg: 'bg-red-500/10' },
};

export default function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { serverOnline, fetchServerStatus, memoryUsage } = useAppStore();
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    fetchServerStatus();
    const interval = setInterval(fetchServerStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchServerStatus]);

  const { bytes, blockCount, level } = memoryUsage;
  const colors = LEVEL_COLORS[level];
  const showIndicator = blockCount > 0;

  return (
    <header className="h-10 md:h-12 bg-digi-dark border-b border-digi-border flex items-center justify-between px-3 md:px-4 shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="md:hidden p-1 text-digi-muted">
          <Menu size={18} />
        </button>
        <span className="font-pixel text-[9px] md:text-[10px] text-digi-muted uppercase truncate">
          DigiMundo
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Memory usage indicator */}
        {showIndicator && (
          <button
            onClick={() => setShowDetail(!showDetail)}
            className={`relative flex items-center gap-1 px-1.5 py-0.5 rounded ${colors.bg} transition-colors duration-300`}
            title={`Memoria: ${formatBytes(bytes)} · ${blockCount} bloques`}
          >
            <HardDrive size={9} className={colors.text} />
            <span className={`text-[9px] font-mono ${colors.text} transition-colors duration-300`}>
              {formatBytes(bytes)}
            </span>
            {level === 'critical' && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        )}

        {/* Memory detail tooltip */}
        {showDetail && showIndicator && (
          <div className="absolute top-10 md:top-12 right-3 md:right-4 z-50 bg-digi-card border border-digi-border rounded-lg shadow-lg p-2.5 min-w-[180px]">
            <div className="text-[9px] font-mono text-digi-muted uppercase mb-1.5">Uso de memoria</div>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-digi-muted">Estimado</span>
                <span className={colors.text}>{formatBytes(bytes)}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-digi-muted">Bloques</span>
                <span className={colors.text}>{blockCount}</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-digi-muted">Estado</span>
                <span className={colors.text}>
                  {level === 'ok' ? 'Normal' : level === 'warn' ? 'Elevado' : 'Crítico'}
                </span>
              </div>
              {/* Usage bar */}
              <div className="mt-1.5">
                <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      level === 'ok' ? 'bg-emerald-500' : level === 'warn' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (bytes / (typeof window !== 'undefined' && window.innerWidth < 768 ? 3_000_000 : 6_000_000)) * 100)}%` }}
                  />
                </div>
              </div>
              {level !== 'ok' && (
                <p className={`text-[8px] mt-1 ${colors.text}`}>
                  {level === 'warn'
                    ? 'Limpia chats para mejorar rendimiento'
                    : 'Rendimiento degradado — limpia chats'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Server status */}
        <div className="flex items-center gap-1.5 text-[10px] md:text-xs font-mono">
          <Circle size={6} className={serverOnline ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'} />
          <span className={`hidden sm:inline ${serverOnline ? 'text-green-400' : 'text-red-400'}`}>
            {serverOnline ? 'Online' : 'Offline'}
          </span>
        </div>
        <button onClick={fetchServerStatus} className="p-1 rounded hover:bg-white/5 text-digi-muted">
          <RefreshCw size={12} />
        </button>
      </div>
    </header>
  );
}
