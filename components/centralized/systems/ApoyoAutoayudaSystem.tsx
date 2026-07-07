'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';
import KnowledgeGraph from '@/components/centralized/apoyo/KnowledgeGraph';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { Plus, Trash2, X, MousePointerClick, HeartHandshake } from 'lucide-react';
import {
  NODE_TYPES, NODE_META, DIMENSIONS, DIMENSION_LABEL, nodeKey,
  type ApoyoGraph, type GraphNode, type ApoyoNodeType,
} from '@/lib/centralized/apoyo';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type CreateCtx = { type: ApoyoNodeType; situationId?: number; problemId?: number };

/**
 * Sistema "Apoyo y Autoayuda" (Global · Implementación). Grafo tipo universo de
 * Situación → Problemas → Causas, y Soluciones (reutilizables) → Problemas + Causas
 * que afectan. Lista de usuarios (izq) · grafo (centro) · detalle (der).
 */
export default function ApoyoAutoayudaSystem({ isAdmin: _isAdmin }: { system?: any; isAdmin: boolean }) {
  const [user, setUser] = useState<SelectedUser | null>(null);
  const [graph, setGraph] = useState<ApoyoGraph>({ nodes: [], edges: [] });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [createCtx, setCreateCtx] = useState<CreateCtx | null>(null);
  const [form, setForm] = useState({ title: '', description: '', dimension: '' });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<GraphNode | null>(null);

  const loadGraph = useCallback(async () => {
    if (!user) { setGraph({ nodes: [], edges: [] }); return; }
    try {
      const res = await fetch(`/api/centralized/apoyo?subject_kind=${user.kind}&subject_id=${user.id}`);
      const d = await res.json();
      setGraph(d.data || { nodes: [], edges: [] });
    } catch { setGraph({ nodes: [], edges: [] }); }
  }, [user]);

  useEffect(() => { loadGraph(); setSelectedKey(null); setCreateCtx(null); }, [loadGraph]);

  const selectedNode = useMemo(() => graph.nodes.find((n) => n.key === selectedKey) || null, [graph.nodes, selectedKey]);

  const openCreate = (ctx: CreateCtx) => { setForm({ title: '', description: '', dimension: '' }); setCreateCtx(ctx); };

  const createNode = async () => {
    if (!createCtx) return;
    if (!form.title.trim()) { toast.error('El título es requerido'); return; }
    setBusy(true);
    try {
      const body: any = { type: createCtx.type, title: form.title, description: form.description || null };
      if (createCtx.type === 'situation') { body.subject_kind = user!.kind; body.subject_id = user!.id; body.dimension = form.dimension || null; }
      if (createCtx.type === 'problem') { body.situationId = createCtx.situationId; body.dimension = form.dimension || null; }
      if (createCtx.type === 'cause') body.problemId = createCtx.problemId;
      if (createCtx.type === 'solution') body.problemId = createCtx.problemId;
      const res = await fetch('/api/centralized/apoyo/nodes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      const d = await res.json();
      toast.success(`${NODE_META[createCtx.type].label} creada`);
      setCreateCtx(null);
      await loadGraph();
      setSelectedKey(nodeKey(createCtx.type, d.id));
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusy(false); }
  };

  const deleteNode = async (n: GraphNode) => {
    setConfirmDel(null);
    try {
      const res = await fetch('/api/centralized/apoyo/nodes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: n.type, id: n.id }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success(`${NODE_META[n.type].label} eliminada`);
      if (selectedKey === n.key) setSelectedKey(null);
      await loadGraph();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const toggleSolutionCause = async (solutionId: number, causeId: number, connect: boolean) => {
    try {
      const res = await fetch('/api/centralized/apoyo/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'solution_cause', a: solutionId, b: causeId, connect }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      await loadGraph();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  // Para una solución seleccionada: causas candidatas (de sus problemas) y las afectadas.
  const solutionCauseInfo = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'solution') return null;
    const sKey = selectedNode.key;
    const probKeys = graph.edges.filter((e) => e.type === 'solution_problem' && e.source === sKey).map((e) => e.target);
    const causeKeys = new Set(graph.edges.filter((e) => e.type === 'problem_cause' && probKeys.includes(e.source)).map((e) => e.target));
    const affected = new Set(graph.edges.filter((e) => e.type === 'solution_cause' && e.source === sKey).map((e) => e.target));
    const causes = graph.nodes.filter((n) => n.type === 'cause' && causeKeys.has(n.key));
    return { causes, affected };
  }, [selectedNode, graph]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <UsersList selected={user} onSelect={setUser} className="w-full lg:w-[240px] shrink-0" />

      {!user ? (
        <div className="flex-1 min-w-0 w-full bg-digi-card border border-digi-border rounded-xl py-20 text-center">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><MousePointerClick className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un candidato o miembro</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>Verás su grafo de situaciones, problemas, causas y soluciones.</p>
        </div>
      ) : (
        <>
          {/* Grafo */}
          <div className="flex-1 min-w-0 w-full bg-digi-card border border-digi-border rounded-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-digi-border">
              <div className="flex items-center gap-2 min-w-0">
                <HeartHandshake className="w-4 h-4 text-accent shrink-0" />
                <span className="text-[13px] font-semibold text-digi-text truncate" style={mf}>Apoyo — {user.name}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* Leyenda */}
                <div className="hidden sm:flex items-center gap-2.5">
                  {NODE_TYPES.map((t) => (
                    <span key={t.key} className="inline-flex items-center gap-1 text-[11px] text-digi-muted" style={mf}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: t.color }} /> {t.plural}
                    </span>
                  ))}
                </div>
                <button onClick={() => openCreate({ type: 'situation' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-accent text-white text-[12px] font-medium rounded-md hover:bg-accent-hover transition-colors" style={mf}>
                  <Plus className="w-3.5 h-3.5" /> Situación
                </button>
              </div>
            </div>
            <KnowledgeGraph nodes={graph.nodes} edges={graph.edges} selectedKey={selectedKey} onSelect={(n) => setSelectedKey(n ? n.key : null)} />
          </div>

          {/* Panel de detalle (borde derecho) */}
          <aside className="w-full lg:w-[320px] shrink-0 bg-digi-card border border-digi-border rounded-lg overflow-hidden lg:sticky lg:top-4">
            {createCtx ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13.5px] font-semibold text-digi-text" style={df}>Nueva {NODE_META[createCtx.type].label.toLowerCase()}</h3>
                  <button onClick={() => setCreateCtx(null)} className="text-digi-muted hover:text-digi-text" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
                <input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Título"
                  className="field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                {(createCtx.type === 'situation' || createCtx.type === 'problem') && (
                  <select value={form.dimension} onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))}
                    className="field-control field-select w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value="">Dimensión (opcional)</option>
                    {DIMENSIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                  </select>
                )}
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descripción (opcional)"
                  className="field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
                <div className="flex gap-2">
                  <button onClick={() => setCreateCtx(null)} className="flex-1 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>Cancelar</button>
                  <button onClick={createNode} disabled={busy} className="flex-1 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>{busy ? '...' : 'Crear'}</button>
                </div>
              </div>
            ) : selectedNode ? (
              <div>
                <div className="flex items-start gap-2.5 p-4 border-b border-digi-border">
                  <span className="w-3 h-3 rounded-full mt-1 shrink-0" style={{ background: NODE_META[selectedNode.type].color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ ...df, color: NODE_META[selectedNode.type].color }}>{NODE_META[selectedNode.type].label}</p>
                    <h3 className="text-[14.5px] font-semibold text-digi-text leading-snug" style={mf}>{selectedNode.title}</h3>
                    {selectedNode.dimension && <p className="text-[11.5px] text-digi-muted mt-0.5" style={mf}>Dimensión: {DIMENSION_LABEL[selectedNode.dimension] || selectedNode.dimension}</p>}
                  </div>
                  <button onClick={() => setSelectedKey(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-4 space-y-3">
                  {selectedNode.description && <p className="text-[12.5px] text-digi-text leading-relaxed" style={mf}>{selectedNode.description}</p>}

                  {/* Acciones contextuales */}
                  {selectedNode.type === 'situation' && (
                    <button onClick={() => openCreate({ type: 'problem', situationId: selectedNode.id })} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-digi-border rounded text-[12.5px] font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
                      <Plus className="w-3.5 h-3.5" /> Agregar problema
                    </button>
                  )}
                  {selectedNode.type === 'problem' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => openCreate({ type: 'cause', problemId: selectedNode.id })} className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}><Plus className="w-3.5 h-3.5" /> Causa</button>
                      <button onClick={() => openCreate({ type: 'solution', problemId: selectedNode.id })} className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}><Plus className="w-3.5 h-3.5" /> Solución</button>
                    </div>
                  )}
                  {selectedNode.type === 'solution' && solutionCauseInfo && (
                    <div>
                      <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={df}>Causas que afecta</p>
                      {solutionCauseInfo.causes.length === 0 ? (
                        <p className="text-[12px] text-digi-muted" style={mf}>Sus problemas aún no tienen causas.</p>
                      ) : (
                        <div className="space-y-1">
                          {solutionCauseInfo.causes.map((c) => {
                            const on = solutionCauseInfo.affected.has(c.key);
                            return (
                              <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-digi-border bg-digi-darker cursor-pointer text-[12.5px] text-digi-text" style={mf}>
                                <input type="checkbox" checked={on} onChange={() => toggleSolutionCause(selectedNode.id, c.id, !on)} className="accent-accent" />
                                <span className="truncate">{c.title}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <button onClick={() => setConfirmDel(selectedNode)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-500/30 rounded text-[12.5px] font-medium text-red-500 hover:bg-red-50 transition-colors" style={mf}>
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar {NODE_META[selectedNode.type].label.toLowerCase()}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center">
                <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><HeartHandshake className="w-5 h-5 text-digi-muted" /></div>
                <p className="text-[12.5px] font-medium text-digi-text" style={mf}>Selecciona un elemento del grafo</p>
                <p className="text-[12px] text-digi-muted mt-1" style={mf}>Pasa el puntero o haz clic en un punto para ver su detalle y sus conexiones. Empieza creando una <span className="text-accent">Situación</span>.</p>
              </div>
            )}
          </aside>
        </>
      )}

      <PixelConfirm
        open={!!confirmDel}
        title="Eliminar elemento"
        message={confirmDel ? `¿Eliminar "${confirmDel.title}"? Se quitarán sus asociaciones.` : ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => confirmDel && deleteNode(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}
