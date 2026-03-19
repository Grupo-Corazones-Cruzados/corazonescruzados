'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronDown, Clock, Check, AlertCircle } from 'lucide-react';

interface DigimonFeedData {
  agentId: string;
  digimonName: string;
  foodSchedule: { meals: [string, string, string] };
  lastFedDates: string[];
}

interface FeedingScheduleModalProps {
  open: boolean;
  onClose: () => void;
}

interface MealEntry {
  agentId: string;
  name: string;
  mealIndex: number;
  mealLabel: string;
  time: string;
  timeMinutes: number;
  fed: boolean;
  active: boolean;   // within 3h window
  passed: boolean;    // window already closed
}

const MEAL_LABELS = ['Desayuno', 'Almuerzo', 'Cena'];
const MEAL_ICONS = ['🌅', '☀️', '🌙'];

export default function FeedingScheduleModal({ open, onClose }: FeedingScheduleModalProps) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/digimon-data');
      const data: Record<string, DigimonFeedData> = await res.json();

      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const todayStr = now.toISOString().split('T')[0];

      const entries: MealEntry[] = [];

      for (const [agentId, d] of Object.entries(data)) {
        if (!d.foodSchedule?.meals) continue;
        d.foodSchedule.meals.forEach((time, idx) => {
          const [h, m] = time.split(':').map(Number);
          const timeMinutes = h * 60 + m;
          const diff = nowMinutes - timeMinutes;
          const fedKey = `${todayStr}_${idx}`;

          entries.push({
            agentId,
            name: d.digimonName,
            mealIndex: idx,
            mealLabel: MEAL_LABELS[idx],
            time,
            timeMinutes,
            fed: d.lastFedDates?.includes(fedKey) ?? false,
            active: diff >= 0 && diff < 180,
            passed: diff >= 180,
          });
        });
      }

      // Sort: active first, then by time ascending
      entries.sort((a, b) => {
        // Fed meals go to the bottom
        if (a.fed !== b.fed) return a.fed ? 1 : -1;
        // Active meals go to the top
        if (a.active !== b.active) return a.active ? -1 : 1;
        // Passed meals go after upcoming
        if (a.passed !== b.passed) return a.passed ? 1 : -1;
        // By time
        return a.timeMinutes - b.timeMinutes;
      });

      setMeals(entries);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      loadData();
      // Refresh every 60 seconds
      const interval = setInterval(loadData, 60000);
      return () => clearInterval(interval);
    }
  }, [open, loadData]);

  if (!open) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const visibleMeals = showAll ? meals : meals.slice(0, 5);

  const nextMeal = meals.find(m => !m.fed && !m.passed);
  const nextInMinutes = nextMeal ? nextMeal.timeMinutes - nowMinutes : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-[95vw] max-w-md max-h-[85vh] flex flex-col bg-[#0d1117] border-2 border-[#30363d] rounded-lg shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-base">🍖</span>
            <h2 className="text-sm font-bold text-white" style={{ fontFamily: 'Silkscreen, monospace' }}>
              Horarios de Comida
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {nextMeal && nextInMinutes !== null && (
              <span className="text-[10px] text-amber-400 font-mono">
                {nextInMinutes > 0
                  ? `Proxima en ${Math.floor(nextInMinutes / 60)}h ${nextInMinutes % 60}m`
                  : nextMeal.active ? '¡Ahora!' : ''}
              </span>
            )}
            <button onClick={onClose} className="text-[#8b949e] hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-1.5">
          {loading ? (
            <div className="text-center py-8 text-[#8b949e] text-sm animate-pulse">Cargando...</div>
          ) : meals.length === 0 ? (
            <div className="text-center py-8 text-[#8b949e] text-sm">No hay digimon registrados</div>
          ) : (
            <>
              {visibleMeals.map((m, i) => (
                <div
                  key={`${m.agentId}-${m.mealIndex}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                    m.fed
                      ? 'bg-green-400/5 border-green-400/15 opacity-50'
                      : m.active
                        ? 'bg-amber-400/10 border-amber-400/30 shadow-[0_0_8px_rgba(251,191,36,0.15)]'
                        : m.passed
                          ? 'bg-red-400/5 border-red-400/15 opacity-40'
                          : 'bg-[#161b22] border-[#30363d]'
                  }`}
                >
                  {/* Meal icon */}
                  <span className="text-lg shrink-0">{MEAL_ICONS[m.mealIndex]}</span>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white" style={{ fontFamily: 'Silkscreen, monospace' }}>
                        {m.name}
                      </span>
                      <span className="text-[9px] text-[#8b949e] font-mono">{m.mealLabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock size={10} className="text-[#8b949e]" />
                      <span className="text-[11px] font-mono text-[#8b949e]">{m.time}</span>
                      {m.active && !m.fed && (
                        <span className="text-[9px] text-amber-400 font-bold animate-pulse ml-1">ACTIVA</span>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="shrink-0">
                    {m.fed ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold bg-green-400/15 border-green-400/30 text-green-400">
                        <Check size={10} />
                        FED
                      </div>
                    ) : m.active ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold bg-amber-400/15 border-amber-400/30 text-amber-400 animate-pulse">
                        <AlertCircle size={10} />
                        DAR
                      </div>
                    ) : m.passed ? (
                      <div className="flex items-center gap-1 px-2 py-1 rounded border text-[10px] font-bold bg-red-400/10 border-red-400/20 text-red-400/60">
                        MISS
                      </div>
                    ) : (
                      <div className="px-2 py-1 rounded border text-[10px] font-mono bg-[#1a1a1a] border-[#30363d] text-[#8b949e]">
                        {(() => {
                          const diff = m.timeMinutes - nowMinutes;
                          if (diff <= 0) return 'pronto';
                          const h = Math.floor(diff / 60);
                          const min = diff % 60;
                          return h > 0 ? `${h}h ${min}m` : `${min}m`;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Show all button */}
              {!showAll && meals.length > 5 && (
                <button
                  onClick={() => setShowAll(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-lg border border-[#30363d] bg-[#161b22] text-[#8b949e] text-xs hover:text-white hover:border-[#484f58] transition-colors"
                  style={{ fontFamily: 'Silkscreen, monospace' }}
                >
                  <ChevronDown size={12} />
                  Ver todas ({meals.length - 5} mas)
                </button>
              )}
              {showAll && meals.length > 5 && (
                <button
                  onClick={() => setShowAll(false)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 mt-2 rounded-lg border border-[#30363d] bg-[#161b22] text-[#8b949e] text-xs hover:text-white hover:border-[#484f58] transition-colors"
                  style={{ fontFamily: 'Silkscreen, monospace' }}
                >
                  Mostrar menos
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-2 bg-[#161b22] border-t border-[#30363d] shrink-0">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-green-400">
              {meals.filter(m => m.fed).length}/{meals.length} alimentados hoy
            </span>
            <span className="text-[#8b949e]">
              {meals.filter(m => m.active && !m.fed).length} pendientes ahora
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
