import { create } from 'zustand';

/**
 * Estado global mínimo de la app.
 *
 * Antes guardaba además el mundo web de los agentes ("DigiMundo") y su estado de
 * carga; ese mundo se eliminó —el mundo del juego es Godot—, así que aquí solo
 * queda el medidor de memoria que pinta la barra superior.
 */

export type MemoryLevel = 'ok' | 'warn' | 'critical';

interface MemoryUsage {
  bytes: number;
  blockCount: number;
  level: MemoryLevel;
}

interface AppState {
  memoryUsage: MemoryUsage;
  updateMemoryUsage: (bytes: number, blockCount: number) => void;
}

// Umbrales (más bajos en móvil).
function getLevel(bytes: number, blockCount: number): MemoryLevel {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const byteWarn = isMobile ? 1_500_000 : 3_000_000;
  const byteCrit = isMobile ? 3_000_000 : 6_000_000;
  const blockWarn = isMobile ? 300 : 600;
  const blockCrit = isMobile ? 600 : 1200;

  if (bytes >= byteCrit || blockCount >= blockCrit) return 'critical';
  if (bytes >= byteWarn || blockCount >= blockWarn) return 'warn';
  return 'ok';
}

export const useAppStore = create<AppState>((set) => ({
  memoryUsage: { bytes: 0, blockCount: 0, level: 'ok' },
  updateMemoryUsage: (bytes, blockCount) =>
    set({ memoryUsage: { bytes, blockCount, level: getLevel(bytes, blockCount) } }),
}));
