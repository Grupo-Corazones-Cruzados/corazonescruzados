'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import {
  Layers, Plus, Trash2, Search, Sparkles, Gem, MapPin, BookOpen, Zap, Target, Gauge,
  Map as MapIcon, Brain, Shapes, X, ChevronRight,
} from 'lucide-react';

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
type Opcion = { id: number; label: string; key?: string };

const LIST_ICON: Record<string, typeof Layers> = {
  talentos: Sparkles, valores: Gem, situaciones: MapPin, materias: BookOpen,
  acciones: Zap, intenciones: Target, estados: Gauge, lugares: MapIcon, procesos_mentales: Brain, moldes: Shapes,
};

/**
 * Editor de las LISTAS GLOBALES del proyecto (talentos, valores, materias, situaciones…).
 * Vive en el sistema Encuadre Condiciológico y se reusa tal cual en Admin ▸ Listas: una
 * sola definición, así cualquier mejora aparece en los dos sitios.
 *
 * Estructura: **rail de listas · opciones en UNA columna (orden alfabético) · panel de
 * detalle a la derecha** para editar la opción elegida — el mismo patrón de Tickets y
 * Proyectos.
 *
 * `fill` = el alto lo pone el contenedor (lo usa Admin, que mide el espacio disponible);
 * sin él mantiene su alto propio, pensado para la página del sistema.
 */
export default function EncuadreCondiciologicoSystem({
  isAdmin,
  fill = false,
}: { system?: any; isAdmin?: boolean; fill?: boolean }) {
  const [listas, setListas] = useState<Lista[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [loadingOpts, setLoadingOpts] = useState(false);

  // Opción abierta en el panel de detalle + borrador de su nombre.
  const [selOpt, setSelOpt] = useState<Opcion | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

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
  useEffect(() => { loadOpciones(sel); setQ(''); setNuevo(''); setSelOpt(null); }, [sel, loadOpciones]);

  const open = (o: Opcion) => { setSelOpt(o); setDraft(o.label); };

  const add = async () => {
    if (!sel || !nuevo.trim()) return;
    try {
      const d = await mutate(API, 'POST', { list: sel, value: nuevo });
      setNuevo('');
      await loadOpciones(sel);
      await loadListas();
      if (d?.data) open(d.data);          // deja lista la recién creada para editarla
    } catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    if (!sel || !selOpt) return;
    const value = draft.trim();
    if (!value) return toast.error('El nombre es requerido.');
    if (value === selOpt.label) return;
    setSaving(true);
    try {
      const d = await mutate(API, 'PATCH', { list: sel, id: selOpt.id, value });
      setSelOpt(d.data);
      setDraft(d.data.label);
      await loadOpciones(sel);
      toast.success('Opción actualizada.');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const del = async () => {
    if (!sel || !selOpt) return;
    setConfirmDel(false);
    try {
      await mutate(API, 'DELETE', { list: sel, id: selOpt.id });
      setSelOpt(null);
      await loadOpciones(sel);
      await loadListas();
      toast.success('Opción eliminada.');
    } catch (e: any) { toast.error(e.message); }
  };

  // El orden alfabético ascendente lo da el servidor (ORDER BY LOWER(...) ASC).
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? opciones.filter((o) => o.label.toLowerCase().includes(s)) : opciones;
  }, [opciones, q]);

  return (
    <div className={`flex flex-col lg:flex-row gap-4 ${fill ? 'h-full' : 'lg:h-[calc(100dvh-130px)]'}`}>
      {/* ── Rail de listas ── */}
      <aside className="w-full lg:w-[240px] shrink-0 max-h-[45vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
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
          <p className="text-[10px] text-digi-muted leading-snug" style={mf}>Listas compartidas por todos los sistemas del proyecto.</p>
        </div>
      </aside>

      {/* ── Opciones de la lista (una sola columna) ── */}
      <div className="flex-1 min-w-0 min-h-[55vh] lg:min-h-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {!selLista ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-digi-muted" style={mf}>Selecciona una lista.</p>
          </div>
        ) : (
          <>
            {/* Barra: buscador + alta */}
            <div className="px-3 py-2 border-b border-digi-border flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[150px]">
                <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input className={`${INPUT} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" />
              </div>
              <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
                <input
                  className={`${INPUT} flex-1`}
                  value={nuevo}
                  onChange={(e) => setNuevo(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder={`Agregar a ${selLista.label.toLowerCase()}…`}
                />
                <button onClick={add} disabled={!nuevo.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-40 rounded-md shrink-0" style={mf}>
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </div>
            </div>

            {/* Filas: UNA columna, orden alfabético ascendente */}
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {loadingOpts ? (
                <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Cargando…</p>
              ) : filtered.length === 0 ? (
                <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>{q ? 'Sin coincidencias.' : 'Lista vacía.'}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filtered.map((o) => {
                    const active = selOpt?.id === o.id;
                    return (
                      <button
                        key={o.id}
                        onClick={() => open(o)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-left transition-colors ${
                          active ? 'bg-accent-light border-accent/40' : 'bg-black/[0.02] border-digi-border hover:border-accent/40'
                        }`}
                      >
                        <span className={`text-[12px] flex-1 truncate ${active ? 'text-accent font-medium' : 'text-digi-text'}`} style={mf}>{o.label}</span>
                        <ChevronRight className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-accent' : 'text-digi-muted/50'}`} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Panel de detalle: editar la opción elegida ── */}
      <aside className="w-full lg:w-[320px] shrink-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {!selOpt ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-10">
            <div className="w-10 h-10 rounded-lg bg-accent-light flex items-center justify-center mb-2.5">
              <Layers className="w-5 h-5 text-accent" />
            </div>
            <p className="text-[12.5px] font-semibold text-digi-text" style={mf}>Sin selección</p>
            <p className="text-[11.5px] text-digi-muted mt-1" style={mf}>
              Elige una opción de la lista para editarla.
            </p>
          </div>
        ) : (
          <>
            <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2">
              <span className="text-[12px] font-semibold text-digi-text flex-1 truncate" style={df}>Detalle</span>
              <button
                onClick={() => setSelOpt(null)}
                title="Cerrar" aria-label="Cerrar"
                className="w-7 h-7 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.04] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-digi-text" style={mf} htmlFor="opt-nombre">Nombre</label>
                <input
                  id="opt-nombre"
                  className={INPUT}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
                />
              </div>

              <dl className="space-y-2 pt-1 border-t border-digi-border">
                <div className="flex items-start justify-between gap-3 text-[11.5px] pt-2">
                  <dt className="text-digi-muted" style={mf}>Lista</dt>
                  <dd className="text-digi-text text-right" style={mf}>{selLista?.label}</dd>
                </div>
                <div className="flex items-start justify-between gap-3 text-[11.5px]">
                  <dt className="text-digi-muted" style={mf}>Id</dt>
                  <dd className="text-digi-text text-right tabular-nums" style={mf}>{selOpt.id}</dd>
                </div>
                {selOpt.key !== undefined && (
                  <div className="flex items-start justify-between gap-3 text-[11.5px]">
                    <dt className="text-digi-muted shrink-0" style={mf}>Clave</dt>
                    <dd className="text-digi-text text-right break-all min-w-0" style={mf}>{selOpt.key}</dd>
                  </div>
                )}
              </dl>

              {selOpt.key !== undefined && (
                <p className="text-[10.5px] text-digi-muted leading-snug" style={mf}>
                  La clave no cambia al renombrar: es lo que referencian los otros sistemas.
                </p>
              )}
            </div>

            <div className="p-2.5 border-t border-digi-border flex items-center justify-between gap-2">
              <button
                onClick={() => setConfirmDel(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                style={mf}
              >
                <Trash2 className="w-3.5 h-3.5" /> Eliminar
              </button>
              <button
                onClick={save}
                disabled={saving || !draft.trim() || draft.trim() === selOpt.label}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-40 rounded-md"
                style={mf}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </aside>

      <PixelConfirm
        open={confirmDel}
        message={`¿Eliminar "${selOpt?.label ?? ''}" de ${selLista?.label ?? 'la lista'}?`}
        confirmLabel="Eliminar"
        danger
        onConfirm={del}
        onCancel={() => setConfirmDel(false)}
      />
    </div>
  );
}
