import { create } from 'zustand';
import type { WorldConfig } from '@/types/world';

export type MemoryLevel = 'ok' | 'warn' | 'critical';

interface MemoryUsage {
  bytes: number;
  blockCount: number;
  level: MemoryLevel;
}

interface AppState {
  world: WorldConfig | null;
  loading: boolean;
  error: string | null;
  serverOnline: boolean;
  memoryUsage: MemoryUsage;

  fetchWorld: () => Promise<void>;
  setWorld: (world: WorldConfig) => void;
  fetchServerStatus: () => Promise<void>;
  updateMemoryUsage: (bytes: number, blockCount: number) => void;
}

// Thresholds (lower on mobile)
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
  world: null,
  loading: false,
  error: null,
  serverOnline: false,
  memoryUsage: { bytes: 0, blockCount: 0, level: 'ok' },

  fetchServerStatus: async () => {
    try {
      const res = await fetch('/api/server-status');
      set({ serverOnline: res.ok });
    } catch {
      set({ serverOnline: false });
    }
  },

  fetchWorld: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/world');
      if (!res.ok) throw new Error('Failed to fetch world');
      const world = await res.json();
      set({ world, loading: false });
    } catch (e: any) {
      set({ error: e.message, loading: false });
    }
  },

  setWorld: (world) => set({ world }),

  updateMemoryUsage: (bytes, blockCount) =>
    set({ memoryUsage: { bytes, blockCount, level: getLevel(bytes, blockCount) } }),
}));
