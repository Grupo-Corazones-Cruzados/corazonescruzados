'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Layers, Plus, Trash2, Search, Sparkles, Gem, MapPin, BookOpen } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const INPUT = 'w-full px-2.5 py-1.5 bg-white border border-digi-border rounded-md text-[13px] text-digi-text placeholder-digi-muted focus:border-accent focus:outline-none';

async function mutate(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Error de servidor');
  return d;
}
const API = '/api/centralized/encuadre/listas';

type Lista = { key: string; label: string; count: number };
type Opcion = { id: number; label: string };

const LIST_ICON: Record<string, typeof Layers> = {
  talentos: Sparkles, valores: Gem, situaciones: MapPin, materias: BookOpen,
};

export default function EncuadreCondiciologicoSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [loadingOpts, setLoadingOpts] = useState(false);

  const selLista = useMemo(() => listas.find((l) => l.key === sel) || null, [listas, sel]);

  const loadListas = useCallback(async () => {
    try { const d = await fetch(API).then((r) => r.json()); setListas(d.data || []); if (!sel && d.data?.[0]) setSel(d.data[0].key); }
    catch { /* noop */ }
  }, [sel]);
  const loadOpciones = useCallback(async (key: string | null) => {
    if (!key) { setOpciones([]); return; }
    setLoadingOpts(true);
    try { const d = await fetch(`${API}?list=${key}`).then((r) => r.json()); setOpciones(d.data || []); }
    catch { setOpciones([]); }
    setLoadingOpts(false);
  }, []);

  useEffect(() => { loadListas(); }, [loadListas]);
  useEffect(() => { loadOpciones(sel); setQ(''); setNuevo(''); }, [sel, loadOpciones]);

  const add = async () => {
    if (!sel || !nuevo.trim()) return;
    try { await mutate(API, 'POST', { list: sel, value: nuevo }); setNuevo(''); await loadOpciones(sel); await loadListas(); }
    catch (e: any) { toast.error(e.message); }
  };
  const del = async (id: number) => {
    if (!sel) return;
    try { await mutate(API, 'DELETE', { list: sel, id }); await loadOpciones(sel); await loadListas(); }
    catch (e: any) { toast.error(e.message); }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? opciones.filter((o) => o.label.toLowerCase().includes(s)) : opciones;
  }, [opciones, q]);

  return (
    <div className="flex gap-4 h-[calc(100dvh-130px)]">
      {/* ── Panel de listas ── */}
      <aside className="w-[240px] shrink-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-accent" />
          <span className="text-[12px] font-semibold text-digi-text" style={df}>Listas globales</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {listas.map((l) => {
            const Ico = LIST_ICON[l.key] || Layers;
            return (
              <button key={l.key} onClick={() => setSel(l.key)} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${sel === l.key ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}>
                <Ico className={`w-4 h-4 shrink-0 ${sel === l.key ? 'text-accent' : 'text-digi-muted'}`} />
                <span className="text-[12.5px] font-medium text-digi-text flex-1" style={mf}>{l.label}</span>
                <span className="text-[10.5px] text-digi-muted tabular-nums" style={mf}>{l.count}</span>
              </button>
            );
          })}
        </div>
        <div className="p-2.5 border-t border-digi-border">
          <p className="text-[10px] text-digi-muted leading-snug" style={mf}>Listas compartidas por todos los sistemas. Se editan solo aquí.</p>
        </div>
      </aside>

      {/* ── Opciones de la lista ── */}
      <div className="flex-1 min-w-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {!selLista ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-digi-muted" style={mf}>Selecciona una lista.</p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2">
              <span className="text-[13px] font-semibold text-digi-text" style={df}>{selLista.label}</span>
              <span className="text-[11px] text-digi-muted" style={mf}>· {selLista.count} opciones</span>
              <div className="ml-auto relative w-56 max-w-[50%]">
                <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className={`${INPUT} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar…" />
              </div>
            </div>

            {/* Agregar */}
            <div className="px-3 py-2 border-b border-digi-border flex gap-1.5">
              <input className={`${INPUT} flex-1`} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={`Agregar a ${selLista.label.toLowerCase()}…`} />
              <button onClick={add} disabled={!nuevo.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-40 rounded-md" style={mf}>
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            {/* Opciones (orden ascendente) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {loadingOpts ? (
                <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Cargando…</p>
              ) : filtered.length === 0 ? (
                <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>{q ? 'Sin coincidencias.' : 'Lista vacía.'}</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                  {filtered.map((o) => (
                    <div key={o.id} className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/[0.02] border border-digi-border hover:border-accent/40 transition-colors">
                      <span className="text-[12px] text-digi-text flex-1 truncate" style={mf}>{o.label}</span>
                      <button onClick={() => del(o.id)} className="text-digi-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Eliminar">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
