'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, CheckCircle, XCircle, ClipboardList, ChevronDown, ChevronUp, GripHorizontal } from 'lucide-react';
import type { Incident, IncidentStatus } from '@/types/incidents';

const STATUS_ICON: Record<IncidentStatus, { icon: typeof Clock; color: string; glow: string }> = {
  pending:   { icon: Clock,       color: '#facc15', glow: '#facc1580' },
  approved:  { icon: CheckCircle, color: '#60a5fa', glow: '#60a5fa80' },
  rejected:  { icon: XCircle,     color: '#f87171', glow: '#f8717180' },
  completed: { icon: CheckCircle, color: '#4ade80', glow: '#4ade8080' },
};

const STATUS_LABEL: Record<IncidentStatus, string> = {
  pending: 'PND',
  approved: 'APR',
  rejected: 'REJ',
  completed: 'DON',
};

// Default positions per orientation
const DEFAULT_POS = { portrait: { x: -1, y: 52 }, landscape: { x: 8, y: 8 } };

interface Props {
  onOpenTasksModal: () => void;
}

export default function FloatingTasksWidget({ onOpenTasksModal }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);

  // Restore persisted state after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem('gcc-tasks-collapsed') === 'true');
      const saved = localStorage.getItem('gcc-tasks-pos');
      if (saved) {
        const pos = JSON.parse(saved);
        if (pos.x >= 0 && pos.y >= 0 && pos.x < window.innerWidth - 40 && pos.y < window.innerHeight - 40) {
          setDragPos(pos);
        }
      }
    } catch { /* use defaults */ }
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('gcc-tasks-collapsed', String(next));
      return next;
    });
  }, []);

  // ── Drag handlers ──
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    const widget = widgetRef.current;
    if (!widget) return;

    const rect = widget.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      moved: false,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;

    d.moved = true;
    setIsDragging(true);

    // Position relative to the canvas container (parent)
    const parent = widgetRef.current?.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();

    setDragPos({
      x: Math.max(0, Math.min(e.clientX - d.offsetX - parentRect.left, parentRect.width - 60)),
      y: Math.max(0, Math.min(e.clientY - d.offsetY - parentRect.top, parentRect.height - 40)),
    });
  }, []);

  const handlePointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);

    if (d?.moved) {
      // Save dragged position
      setDragPos(pos => {
        if (pos) {
          try { localStorage.setItem('gcc-tasks-pos', JSON.stringify(pos)); } catch { /* */ }
        }
        return pos;
      });
    }
  }, []);

  const resetPosition = useCallback(() => {
    setDragPos(null);
    localStorage.removeItem('gcc-tasks-pos');
  }, []);

  // ── Data ──
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/incidents');
      const data: Incident[] = await res.json();
      const sorted = data
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setIncidents(sorted);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const pendingCount = incidents.filter(i => i.status === 'pending').length;

  // Position style: dragged or responsive default
  const positionStyle: React.CSSProperties = dragPos
    ? { position: 'absolute', left: dragPos.x, top: dragPos.y }
    : {};

  const positionClass = dragPos
    ? 'absolute z-10 pointer-events-auto'
    : [
        'absolute z-10 pointer-events-auto',
        'top-[72px] left-1/2 -translate-x-1/2',
        'landscape:top-2 landscape:left-2 landscape:translate-x-0',
      ].join(' ');

  return (
    <div ref={widgetRef} className={positionClass} style={positionStyle}>
      {/* Header: drag handle + toggle + collapse */}
      <div
        className="flex items-center gap-0.5 select-none"
        style={{
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: collapsed ? '6px' : '6px 6px 0 0',
        }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="flex items-center px-1.5 py-2 touch-none"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
          <GripHorizontal size={12} className="text-white/25" />
        </div>

        {/* Toggle collapse */}
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-1.5 pr-2.5 py-1.5 flex-1 min-w-0"
        >
          <ClipboardList size={12} className="text-digi-green shrink-0" />
          <span
            className="text-[9px] tracking-[1.5px] uppercase text-white/70"
            style={{ fontFamily: 'Silkscreen, cursive' }}
          >
            Tareas
          </span>
          {pendingCount > 0 && (
            <span className="text-[8px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 leading-none">
              {pendingCount}
            </span>
          )}
          {collapsed ? (
            <ChevronDown size={10} className="text-white/40 ml-auto" />
          ) : (
            <ChevronUp size={10} className="text-white/40 ml-auto" />
          )}
        </button>
      </div>

      {/* Expanded task list */}
      {!collapsed && (
        <div
          className="w-[220px] select-none"
          style={{
            background: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            borderRadius: '0 0 6px 6px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderTop: 'none',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          }}
        >
          {/* Task list */}
          <div className="px-2 py-1.5 space-y-0.5">
            {loading ? (
              <div className="py-3 text-center">
                <span className="text-white/30 text-[9px] animate-pulse" style={{ fontFamily: 'Silkscreen, cursive' }}>
                  Cargando...
                </span>
              </div>
            ) : incidents.length === 0 ? (
              <div className="py-3 text-center">
                <span className="text-white/30 text-[9px]" style={{ fontFamily: 'Silkscreen, cursive' }}>
                  Sin tareas
                </span>
              </div>
            ) : (
              incidents.map((inc) => {
                const cfg = STATUS_ICON[inc.status];
                const Icon = cfg.icon;
                return (
                  <div
                    key={inc.id}
                    className="flex items-center gap-2 px-1.5 py-1.5 rounded transition-colors hover:bg-white/5 cursor-default"
                  >
                    <Icon
                      size={12}
                      style={{
                        color: cfg.color,
                        filter: `drop-shadow(0 0 3px ${cfg.glow})`,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      className="text-white/70 text-[9px] leading-tight flex-1 min-w-0 truncate"
                      style={{ fontFamily: 'Silkscreen, cursive' }}
                      title={inc.title}
                    >
                      {inc.title}
                    </span>
                    <span
                      className="text-[7px] shrink-0 px-1 py-0.5 rounded"
                      style={{
                        fontFamily: 'Silkscreen, cursive',
                        color: cfg.color,
                        background: `${cfg.color}15`,
                        textShadow: `0 0 4px ${cfg.glow}`,
                      }}
                    >
                      {STATUS_LABEL[inc.status]}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)' }} />
          <div className="flex items-center">
            <button
              onClick={onOpenTasksModal}
              className="flex-1 px-3 py-1.5 text-left hover:bg-white/5 transition-colors rounded-bl-[5px]"
            >
              <span className="text-white/30 text-[7px] tracking-wider" style={{ fontFamily: 'Silkscreen, cursive' }}>
                &#9650; Ver todas
              </span>
            </button>
            {dragPos && (
              <button
                onClick={resetPosition}
                className="px-2 py-1.5 text-white/20 hover:text-white/50 transition-colors rounded-br-[5px] hover:bg-white/5"
                title="Volver a posición original"
              >
                <span className="text-[7px]" style={{ fontFamily: 'Silkscreen, cursive' }}>↺</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
