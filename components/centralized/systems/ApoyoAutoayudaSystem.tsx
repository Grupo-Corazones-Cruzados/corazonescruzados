'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import UsersList, { type SelectedUser } from '@/components/centralized/UsersList';
import KnowledgeGraph from '@/components/centralized/apoyo/KnowledgeGraph';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { Plus, Trash2, X, MousePointerClick, HeartHandshake, CheckCircle2 } from 'lucide-react';
import {
  NODE_TYPES, NODE_META, DIMENSIONS, DIMENSION_LABEL, DIMENSION_COLOR, nodeKey,
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

// Cascada de eliminación en cliente (espeja la del backend, orphan-aware): devuelve las
// keys de nodos que deben quitarse al borrar `node`. Sirve para reflejarlo al instante.
function cascadeKeys(node: GraphNode, edges: { source: string; target: string; type: string }[]): Set<string> {
  const remove = new Set<string>();
  if (node.type === 'cause' || node.type === 'solution' || node.type === 'alternative') { remove.add(node.key); return remove; }

  const problems = new Set<string>();
  if (node.type === 'problem') problems.add(node.key);
  else if (node.type === 'situation') {
    remove.add(node.key);
    for (const e of edges) {
      if (e.type === 'situation_problem' && e.source === node.key) {
        const pk = e.target;
        const otherSit = edges.some((x) => x.type === 'situation_problem' && x.target === pk && x.source !== node.key);
        if (!otherSit) problems.add(pk);
      }
    }
  }

  for (const pk of problems) {
    remove.add(pk);
    for (const e of edges) {
      if (e.type === 'problem_cause' && e.source === pk) {
        const ck = e.target;
        const other = edges.some((x) => x.type === 'problem_cause' && x.target === ck && x.source !== pk && !problems.has(x.source));
        if (!other) remove.add(ck);
      }
      if (e.type === 'solution_problem' && e.target === pk) {
        const sk = e.source;
        const other = edges.some((x) => x.type === 'solution_problem' && x.source === sk && x.target !== pk && !problems.has(x.target));
        if (!other) remove.add(sk);
      }
    }
  }
  return remove;
}

// Marca de forma por tipo (coincide con las formas del grafo) para leyenda/indicadores.
const shapeStyle = (type: string): React.CSSProperties => {
  if (type === 'situation') return { clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)' };
  if (type === 'problem') return { clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' };
  if (type === 'alternative') return { clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' };
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
  // Filtro de leyenda: `pin` = fijado con clic; `hover` = vista previa al pasar el puntero.
  // El efectivo prioriza el hover para que apuntar previsualice sin desfijar lo elegido.
  type LegendFilter = { kind: 'type' | 'dimension'; value: string };
  const [pinFilter, setPinFilter] = useState<LegendFilter | null>(null);
  const [hoverFilter, setHoverFilter] = useState<LegendFilter | null>(null);
  const filter = hoverFilter ?? pinFilter;
  const isPinned = (f: LegendFilter) => pinFilter?.kind === f.kind && pinFilter?.value === f.value;
  const togglePin = (f: LegendFilter) => setPinFilter((p) => (p && p.kind === f.kind && p.value === f.value ? null : f));

  const loadGraph = useCallback(async () => {
    if (!user) { setGraph({ nodes: [], edges: [] }); return; }
    try {
      const res = await fetch(`/api/centralized/apoyo?subject_kind=${user.kind}&subject_id=${user.id}`);
      const d = await res.json();
      setGraph(d.data || { nodes: [], edges: [] });
    } catch { setGraph({ nodes: [], edges: [] }); }
  }, [user]);

  useEffect(() => { loadGraph(); setSelectedKey(null); setCreateCtx(null); setPinFilter(null); setHoverFilter(null); }, [loadGraph]);

  const selectedNode = useMemo(() => graph.nodes.find((n) => n.key === selectedKey) || null, [graph.nodes, selectedKey]);

  const openCreate = (ctx: CreateCtx) => { setForm({ title: '', description: '', dimension: '' }); setCreateCtx(ctx); };

  const createNode = async () => {
    if (!createCtx) return;
    if (!form.title.trim()) { toast.error('El título es requerido'); return; }
    if (createCtx.type === 'problem' && !form.dimension) { toast.error('La dimensión es requerida'); return; }
    setBusy(true);
    try {
      const body: any = { type: createCtx.type, title: form.title, description: form.description || null };
      if (createCtx.type === 'situation') { body.subject_kind = user!.kind; body.subject_id = user!.id; }
      if (createCtx.type === 'problem') { body.situationId = createCtx.situationId; body.dimension = form.dimension; }
      if (createCtx.type === 'cause') body.problemId = createCtx.problemId;
      if (createCtx.type === 'solution' || createCtx.type === 'alternative') body.problemId = createCtx.problemId;
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
    // Optimista: quita al instante el nodo y su cascada (nodos + aristas).
    const removeSet = cascadeKeys(n, graph.edges);
    setGraph((g) => ({
      nodes: g.nodes.filter((x) => !removeSet.has(x.key)),
      edges: g.edges.filter((e) => !removeSet.has(e.source) && !removeSet.has(e.target)),
    }));
    if (selectedKey && removeSet.has(selectedKey)) setSelectedKey(null);
    toast.success(`${NODE_META[n.type].label} eliminada`);
    try {
      const res = await fetch('/api/centralized/apoyo/nodes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: n.type, id: n.id }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
    } catch (e: any) { toast.error(e.message || 'No se pudo eliminar; recargando'); await loadGraph(); }
  };

  // Convierte una alternativa (idea propuesta) en solución (comprobada). Conserva sus
  // enlaces; solo cambia el tipo/estado. Al recargar, el nodo pasa a verde/cuadrado.
  const convertToSolution = async (n: GraphNode) => {
    setBusy(true);
    try {
      const res = await fetch('/api/centralized/apoyo/nodes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id, status: 'solution' }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success('Alternativa convertida en solución');
      await loadGraph();
      setSelectedKey(nodeKey('solution', n.id));
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusy(false); }
  };

  // `solutionType` es el tipo real del nodo (solution|alternative): ambos comparten la
  // tabla, pero su key en el grafo depende del tipo, así que hay que usar el correcto.
  const toggleSolutionCause = async (solutionType: ApoyoNodeType, solutionId: number, causeId: number, connect: boolean) => {
    const sKey = nodeKey(solutionType, solutionId);
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
    if (!selectedNode || (selectedNode.type !== 'solution' && selectedNode.type !== 'alternative')) return null;
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
      add('Alternativas y soluciones', E.filter((e) => e.type === 'solution_problem' && e.target === key).map((e) => e.source));
    } else if (t === 'cause') {
      add('Problemas', E.filter((e) => e.type === 'problem_cause' && e.target === key).map((e) => e.source));
      add('Alternativas/soluciones que la afectan', E.filter((e) => e.type === 'solution_cause' && e.target === key).map((e) => e.source));
    } else if (t === 'solution' || t === 'alternative') {
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
              <button onClick={() => openCreate({ type: 'situation' })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-accent text-white text-[12px] font-medium rounded-md hover:bg-accent-hover transition-colors" style={mf}>
                <Plus className="w-3.5 h-3.5" /> Situación
              </button>
            </div>
          </div>

          {/* Grafo (ocupa todo el ancho y alto) + panel flotante de detalle */}
          <div className="relative flex-1 min-h-0">
            <KnowledgeGraph nodes={graph.nodes} edges={graph.edges} selectedKey={selectedKey} filter={filter} fitSignal={`${user.kind}:${user.id}`} onSelect={(n) => setSelectedKey(n ? n.key : null)} />

            {/* Leyenda-filtros: galería vertical flotante en el borde izquierdo del universo.
                Pasar el puntero previsualiza; clic fija/quita. */}
            <div className={`${GLASS} absolute top-3 left-3 z-10 w-[150px] max-h-[calc(100%-24px)] overflow-y-auto p-1.5`}>
              <p className="px-1.5 pt-1 pb-1 text-[9.5px] font-semibold uppercase tracking-wide text-white/40" style={df}>Tipos</p>
              {NODE_TYPES.map((t) => {
                const f = { kind: 'type' as const, value: t.key };
                return (
                  <button key={t.key} type="button"
                    onMouseEnter={() => setHoverFilter(f)} onMouseLeave={() => setHoverFilter(null)}
                    onClick={() => togglePin(f)}
                    className={`w-full inline-flex items-center gap-2 text-[11.5px] rounded-md px-2 py-1.5 transition-colors ${isPinned(f) ? 'bg-white/12 text-white ring-1 ring-inset ring-white/25' : 'text-white/70 hover:bg-white/[0.08]'}`}
                    style={mf} title={`Mostrar solo ${t.plural.toLowerCase()}`}>
                    <span className="w-3 h-3 shrink-0" style={{ background: t.color, ...shapeStyle(t.key) }} /> {t.plural}
                  </button>
                );
              })}
              <div className="my-1 mx-1.5 h-px bg-white/12" />
              <p className="px-1.5 pb-1 text-[9.5px] font-semibold uppercase tracking-wide text-white/40" style={df}>Dimensiones</p>
              {DIMENSIONS.map((d) => {
                const f = { kind: 'dimension' as const, value: d.key };
                return (
                  <button key={d.key} type="button"
                    onMouseEnter={() => setHoverFilter(f)} onMouseLeave={() => setHoverFilter(null)}
                    onClick={() => togglePin(f)}
                    className={`w-full inline-flex items-center gap-2 text-[11.5px] rounded-md px-2 py-1.5 transition-colors ${isPinned(f) ? 'bg-white/12 text-white ring-1 ring-inset ring-white/25' : 'text-white/70 hover:bg-white/[0.08]'}`}
                    style={mf} title={`Mostrar solo problemas de dimensión ${d.label}`}>
                    <span className="w-2.5 h-2.5 shrink-0 rounded-full ring-1 ring-black/50" style={{ background: d.color }} /> {d.label}
                  </button>
                );
              })}
            </div>

            {(createCtx || selectedNode) && (
              <aside className="absolute bottom-3 right-3 w-[330px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto z-10 p-2.5 space-y-2.5">
                {createCtx ? (
                  <div className={`${GLASS} p-3.5 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13.5px] font-semibold text-white" style={df}>Nueva {NODE_META[createCtx.type].label.toLowerCase()}</h3>
                      <button onClick={() => setCreateCtx(null)} className="text-white/60 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                    </div>
                    <input autoFocus value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Título" className={GLASS_INPUT} style={mf} />
                    {createCtx.type === 'problem' && (
                      <select value={form.dimension} onChange={(e) => setForm((f) => ({ ...f, dimension: e.target.value }))} className={GLASS_INPUT} style={mf}>
                        <option value="" className="bg-digi-darker text-digi-text">Dimensión (requerida)</option>
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
                          {selectedNode.dimension && (
                            <p className="inline-flex items-center gap-1.5 text-[11.5px] text-white/55 mt-0.5" style={mf}>
                              <span className="w-2.5 h-2.5 shrink-0 rounded-full ring-1 ring-black/50" style={{ background: DIMENSION_COLOR[selectedNode.dimension] || '#888' }} />
                              Dimensión: {DIMENSION_LABEL[selectedNode.dimension] || selectedNode.dimension}
                            </p>
                          )}
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
                          <button onClick={() => openCreate({ type: 'alternative', problemId: selectedNode.id })} className={`${GLASS_BTN} px-2 py-2 text-[12px] font-medium`} style={mf}><Plus className="w-3.5 h-3.5" /> Alternativa</button>
                        </div>
                      )}
                      {(selectedNode.type === 'solution' || selectedNode.type === 'alternative') && solutionCauseInfo && (
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
                                    <input type="checkbox" checked={on} onChange={() => toggleSolutionCause(selectedNode.type, selectedNode.id, c.id, !on)} className="accent-accent" />
                                    <span className="truncate">{c.title}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {selectedNode.type === 'alternative' && (
                        <button onClick={() => convertToSolution(selectedNode)} disabled={busy} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 rounded-md text-[12.5px] font-medium text-emerald-300 transition-colors disabled:opacity-50" style={mf}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Convertir en solución
                        </button>
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
