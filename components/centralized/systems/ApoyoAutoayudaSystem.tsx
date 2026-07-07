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

// El panel flota sobre el grafo oscuro: fondo transparente, con "vidrio" solo en los
// bloques de contenido para que sigan siendo legibles sin tapar el grafo.
const GLASS = 'rounded-xl bg-black/40 backdrop-blur-md border border-white/12 shadow-lg';
const GLASS_BTN = 'inline-flex items-center justify-center gap-1.5 border border-white/15 bg-white/[0.08] hover:bg-white/[0.18] text-white/90 rounded-md transition-colors';
const GLASS_INPUT = 'w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-[13px] text-white placeholder-white/40 focus:border-accent focus:outline-none';

type CreateCtx = { type: ApoyoNodeType; situationId?: number; problemId?: number };

// Marca de forma por tipo (coincide con las formas del grafo) para leyenda/indicadores.
const shapeStyle = (type: string): React.CSSProperties => {
  if (type === 'situation') return { clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)' };
  if (type === 'problem') return { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' };
  if (type === 'solution') return { borderRadius: '3px' };
  return { borderRadius: '9999px' };
};

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
    const sKey = nodeKey('solution', solutionId);
    const cKey = nodeKey('cause', causeId);
    // Optimista: refleja la arista al instante (sin refrescar todo ni reiniciar el layout).
    setGraph((g) => {
      const has = g.edges.some((e) => e.type === 'solution_cause' && e.source === sKey && e.target === cKey);
      const edges = connect
        ? (has ? g.edges : [...g.edges, { source: sKey, target: cKey, type: 'solution_cause' as const }])
        : g.edges.filter((e) => !(e.type === 'solution_cause' && e.source === sKey && e.target === cKey));
      return { ...g, edges };
    });
    try {
      const res = await fetch('/api/centralized/apoyo/links', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'solution_cause', a: solutionId, b: causeId, connect }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'Error'); await loadGraph(); }
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

  // Conexiones del nodo seleccionado, agrupadas por relación (para navegar el grafo).
  const connections = useMemo(() => {
    if (!selectedNode) return [] as { label: string; nodes: GraphNode[] }[];
    const key = selectedNode.key;
    const byKey = new Map(graph.nodes.map((n) => [n.key, n]));
    const groups: { label: string; nodes: GraphNode[] }[] = [];
    const add = (label: string, keys: string[]) => {
      const seen = new Set<string>();
      const ns = keys.filter((k) => (seen.has(k) ? false : (seen.add(k), true))).map((k) => byKey.get(k)).filter(Boolean) as GraphNode[];
      if (ns.length) groups.push({ label, nodes: ns });
    };
    const E = graph.edges;
    const t = selectedNode.type;
    if (t === 'situation') add('Problemas', E.filter((e) => e.type === 'situation_problem' && e.source === key).map((e) => e.target));
    else if (t === 'problem') {
      add('Situaciones', E.filter((e) => e.type === 'situation_problem' && e.target === key).map((e) => e.source));
      add('Causas', E.filter((e) => e.type === 'problem_cause' && e.source === key).map((e) => e.target));
      add('Soluciones', E.filter((e) => e.type === 'solution_problem' && e.target === key).map((e) => e.source));
    } else if (t === 'cause') {
      add('Problemas', E.filter((e) => e.type === 'problem_cause' && e.target === key).map((e) => e.source));
      add('Soluciones que la afectan', E.filter((e) => e.type === 'solution_cause' && e.target === key).map((e) => e.source));
    } else if (t === 'solution') {
      add('Problemas', E.filter((e) => e.type === 'solution_problem' && e.source === key).map((e) => e.target));
      add('Causas que afecta', E.filter((e) => e.type === 'solution_cause' && e.source === key).map((e) => e.target));
    }
    return groups;
  }, [selectedNode, graph]);

  return (
    <div className="flex gap-4 h-[calc(100dvh-130px)]">
      <UsersList selected={user} onSelect={setUser} className="w-[240px] shrink-0 h-full" />

      {!user ? (
        <div className="flex-1 min-w-0 h-full bg-digi-card border border-digi-border rounded-xl flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mb-3"><MousePointerClick className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un candidato o miembro</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-sm" style={mf}>Verás su grafo de situaciones, problemas, causas y soluciones.</p>
        </div>
      ) : (
        <div className="flex-1 min-w-0 h-full bg-digi-card border border-digi-border rounded-lg overflow-hidden flex flex-col">
          {/* Barra superior */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-digi-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <HeartHandshake className="w-4 h-4 text-accent shrink-0" />
              <span className="text-[13px] font-semibold text-digi-text truncate" style={mf}>Apoyo — {user.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2.5">
                {NODE_TYPES.map((t) => (
                  <span key={t.key} className="inline-flex items-center gap-1 text-[11px] text-digi-muted" style={mf}>
                    <span className="w-3 h-3 shrink-0" style={{ background: t.color, ...shapeStyle(t.key) }} /> {t.plural}
                  </span>
                ))}
              </div>
              <button onClick={() => openCreate({ type: 'situation' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-accent text-white text-[12px] font-medium rounded-md hover:bg-accent-hover transition-colors" style={mf}>
                <Plus className="w-3.5 h-3.5" /> Situación
              </button>
            </div>
          </div>

          {/* Grafo (ocupa todo el ancho y alto) + panel flotante de detalle */}
          <div className="relative flex-1 min-h-0">
            <KnowledgeGraph nodes={graph.nodes} edges={graph.edges} selectedKey={selectedKey} onSelect={(n) => setSelectedKey(n ? n.key : null)} />

            {(createCtx || selectedNode) && (
              <aside className="absolute bottom-3 right-3 w-[330px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto z-10 p-2.5 space-y-2.5">
                {createCtx ? (
                  <div className={`${GLASS} p-3.5 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13.5px] font-semibold text-white" style={df}>Nueva {NODE_META[createCtx.type].label.toLowerCase()}</h3>
                      <button onClick={() => setCreateCtx(null)} className="text-white/60 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                    </div>
                    <input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Título" className={GLASS_INPUT} style={mf} />
                    {(createCtx.type === 'situation' || createCtx.type === 'problem') && (
                      <select value={form.dimension} onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))} className={GLASS_INPUT} style={mf}>
                        <option value="" className="bg-digi-darker text-digi-text">Dimensión (opcional)</option>
                        {DIMENSIONS.map((d) => <option key={d.key} value={d.key} className="bg-digi-darker text-digi-text">{d.label}</option>)}
                      </select>
                    )}
                    <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descripción (opcional)" className={`${GLASS_INPUT} resize-none`} style={mf} />
                    <div className="flex gap-2">
                      <button onClick={() => setCreateCtx(null)} className={`${GLASS_BTN} flex-1 px-3 py-2 text-sm font-medium`} style={mf}>Cancelar</button>
                      <button onClick={createNode} disabled={busy} className="flex-1 px-3 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>{busy ? '...' : 'Crear'}</button>
                    </div>
                  </div>
                ) : selectedNode ? (
                  <>
                    {/* Cabecera */}
                    <div className={`${GLASS} p-3.5`}>
                      <div className="flex items-start gap-2.5">
                        <span className="w-3 h-3 mt-1 shrink-0" style={{ background: NODE_META[selectedNode.type].color, ...shapeStyle(selectedNode.type) }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ ...df, color: NODE_META[selectedNode.type].color }}>{NODE_META[selectedNode.type].label}</p>
                          <h3 className="text-[14.5px] font-semibold text-white leading-snug" style={mf}>{selectedNode.title}</h3>
                          {selectedNode.dimension && <p className="text-[11.5px] text-white/55 mt-0.5" style={mf}>Dimensión: {DIMENSION_LABEL[selectedNode.dimension] || selectedNode.dimension}</p>}
                        </div>
                        <button onClick={() => setSelectedKey(null)} className="text-white/60 hover:text-white shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                      </div>
                      {selectedNode.description && <p className="text-[12.5px] text-white/80 leading-relaxed mt-2.5" style={mf}>{selectedNode.description}</p>}
                    </div>

                    {/* Conexiones (navegables) */}
                    {connections.length > 0 && (
                      <div className={`${GLASS} p-3.5 space-y-2.5`}>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50" style={df}>Conexiones</p>
                        {connections.map((g) => (
                          <div key={g.label}>
                            <p className="text-[10px] uppercase tracking-wide text-white/45 mb-1.5" style={mf}>{g.label} · {g.nodes.length}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {g.nodes.map((n) => (
                                <button key={n.key} onClick={() => setSelectedKey(n.key)} title={n.title}
                                  className="inline-flex items-center gap-1.5 max-w-full px-2 py-1 rounded-full bg-white/[0.08] hover:bg-white/[0.18] border border-white/12 text-[11.5px] text-white/90 transition-colors" style={mf}>
                                  <span className="w-2.5 h-2.5 shrink-0" style={{ background: NODE_META[n.type].color, ...shapeStyle(n.type) }} />
                                  <span className="truncate max-w-[180px]">{n.title}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    <div className={`${GLASS} p-3 space-y-2`}>
                      {selectedNode.type === 'situation' && (
                        <button onClick={() => openCreate({ type: 'problem', situationId: selectedNode.id })} className={`${GLASS_BTN} w-full px-3 py-2 text-[12.5px] font-medium`} style={mf}><Plus className="w-3.5 h-3.5" /> Agregar problema</button>
                      )}
                      {selectedNode.type === 'problem' && (
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => openCreate({ type: 'cause', problemId: selectedNode.id })} className={`${GLASS_BTN} px-2 py-2 text-[12px] font-medium`} style={mf}><Plus className="w-3.5 h-3.5" /> Causa</button>
                          <button onClick={() => openCreate({ type: 'solution', problemId: selectedNode.id })} className={`${GLASS_BTN} px-2 py-2 text-[12px] font-medium`} style={mf}><Plus className="w-3.5 h-3.5" /> Solución</button>
                        </div>
                      )}
                      {selectedNode.type === 'solution' && solutionCauseInfo && (
                        <div>
                          <p className="text-[11px] font-semibold text-white/50 uppercase tracking-wide mb-1.5" style={df}>Causas que afecta</p>
                          {solutionCauseInfo.causes.length === 0 ? (
                            <p className="text-[12px] text-white/50" style={mf}>Sus problemas aún no tienen causas.</p>
                          ) : (
                            <div className="space-y-1">
                              {solutionCauseInfo.causes.map((c) => {
                                const on = solutionCauseInfo.affected.has(c.key);
                                return (
                                  <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-white/12 bg-white/[0.06] cursor-pointer text-[12.5px] text-white/90" style={mf}>
                                    <input type="checkbox" checked={on} onChange={() => toggleSolutionCause(selectedNode.id, c.id, !on)} className="accent-accent" />
                                    <span className="truncate">{c.title}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <button onClick={() => setConfirmDel(selectedNode)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-400/40 bg-red-500/15 hover:bg-red-500/25 rounded-md text-[12.5px] font-medium text-red-300 transition-colors" style={mf}>
                        <Trash2 className="w-3.5 h-3.5" /> Eliminar {NODE_META[selectedNode.type].label.toLowerCase()}
                      </button>
                    </div>
                  </>
                ) : null}
              </aside>
            )}
          </div>
        </div>
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
