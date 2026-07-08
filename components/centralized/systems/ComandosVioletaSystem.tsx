'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PolicyGraph from '@/components/centralized/comandos/PolicyGraph';
import GenerateTasksModal from '@/components/centralized/comandos/GenerateTasksModal';
import {
  POLICY_META, FUNCTION_ACTIONS, FUNCTION_LABEL, FUNCTION_SHORT, BLOCKABLE_MODULES,
  summarizeFunction, policyKey,
  type PolicyGraph as PolicyGraphT, type PolicyGraphNode, type FunctionType, type TaskProgram, type Category,
} from '@/lib/centralized/comandos';
import {
  Plus, Trash2, X, MousePointerClick, Sparkles, FolderPlus, MessageSquareText, Ban, ListChecks, Power, Pencil, Check,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const GLASS = 'rounded-xl bg-black/40 backdrop-blur-md border border-white/12 shadow-lg';
const GLASS_BTN = 'inline-flex items-center justify-center gap-1.5 border border-white/15 bg-white/[0.08] hover:bg-white/[0.18] text-white/90 rounded-md transition-colors';
const GLASS_INPUT = 'w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-[13px] text-white placeholder-white/40 focus:border-accent focus:outline-none';

const FUNC_ICON: Record<FunctionType, any> = { permanent_message: MessageSquareText, block_modules: Ban, generate_tasks: ListChecks };

// Marca de forma para la leyenda (coincide con el grafo): política = estrella, función = pentágono.
const shapeStyle = (type: string): React.CSSProperties =>
  type === 'policy'
    ? { clipPath: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)' }
    : { clipPath: 'polygon(50% 0%, 98% 35%, 79% 91%, 21% 91%, 2% 35%)' };

type FuncForm = { policyId: number; editingId: number | null; type: FunctionType; message: string; modules: string[]; tasks: TaskProgram[] };

/**
 * Sistema "Comandos Violeta" (Global · Creación). Panel de CATEGORÍAS (izq) → grafo de
 * POLÍTICAS de la categoría (centro; política = estrella, función = pentágono) → panel de
 * detalle (der). Cada política se activa/desactiva y contiene funciones (mensaje
 * permanente, bloqueo de módulos, generar tareas). Autoría; la aplicación al activar es
 * una iteración futura.
 */
export default function ComandosVioletaSystem({ isAdmin: _isAdmin }: { system?: any; isAdmin: boolean }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [graph, setGraph] = useState<PolicyGraphT>({ nodes: [], edges: [] });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [policyName, setPolicyName] = useState('');
  const [funcForm, setFuncForm] = useState<FuncForm | null>(null);
  const [tasksModal, setTasksModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<PolicyGraphNode | null>(null);

  const category = useMemo(() => categories.find((c) => c.id === categoryId) || null, [categories, categoryId]);
  const selectedNode = useMemo(() => graph.nodes.find((n) => n.key === selectedKey) || null, [graph.nodes, selectedKey]);

  const loadCategories = useCallback(async () => {
    try { const res = await fetch('/api/centralized/comandos/categories'); const d = await res.json(); setCategories(d.data || []); }
    catch { /* noop */ }
  }, []);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  const loadGraph = useCallback(async () => {
    if (!categoryId) { setGraph({ nodes: [], edges: [] }); return; }
    try { const res = await fetch(`/api/centralized/comandos?category_id=${categoryId}`); const d = await res.json(); setGraph(d.data || { nodes: [], edges: [] }); }
    catch { setGraph({ nodes: [], edges: [] }); }
  }, [categoryId]);
  useEffect(() => { loadGraph(); setSelectedKey(null); setCreatingPolicy(false); setFuncForm(null); }, [loadGraph]);

  /* ── Categorías ── */
  const createCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      const res = await fetch('/api/centralized/comandos/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCategory }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const d = await res.json();
      setNewCategory('');
      await loadCategories();
      setCategoryId(d.data.id);
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  /* ── Políticas ── */
  const createPolicy = async () => {
    if (!categoryId || !policyName.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/centralized/comandos/policies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category_id: categoryId, name: policyName }) });
      if (!res.ok) throw new Error((await res.json()).error);
      const d = await res.json();
      toast.success('Política creada');
      setCreatingPolicy(false); setPolicyName('');
      await loadGraph(); await loadCategories();
      setSelectedKey(policyKey('policy', d.data.id));
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusy(false); }
  };

  const togglePolicy = async (n: PolicyGraphNode) => {
    const next = !n.active;
    setGraph((g) => ({ ...g, nodes: g.nodes.map((x) => (x.key === n.key ? { ...x, active: next } : x)) }));
    try {
      const res = await fetch('/api/centralized/comandos/policies', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id, active: next }) });
      if (!res.ok) throw new Error();
      toast.success(next ? 'Política activada' : 'Política desactivada');
    } catch { toast.error('No se pudo cambiar el estado'); loadGraph(); }
  };

  const deleteNode = async (n: PolicyGraphNode) => {
    setConfirmDel(null);
    const isPolicy = n.type === 'policy';
    const url = isPolicy ? '/api/centralized/comandos/policies' : '/api/centralized/comandos/functions';
    // Optimista.
    setGraph((g) => {
      if (isPolicy) {
        const funcs = g.edges.filter((e) => e.source === n.key).map((e) => e.target);
        const drop = new Set([n.key, ...funcs]);
        return { nodes: g.nodes.filter((x) => !drop.has(x.key)), edges: g.edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)) };
      }
      return { nodes: g.nodes.filter((x) => x.key !== n.key), edges: g.edges.filter((e) => e.source !== n.key && e.target !== n.key) };
    });
    if (selectedKey === n.key) setSelectedKey(null);
    toast.success(`${POLICY_META[n.type].label} eliminada`);
    try {
      const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) });
      if (!res.ok) throw new Error();
      loadCategories();
    } catch { toast.error('No se pudo eliminar; recargando'); loadGraph(); }
  };

  /* ── Funciones ── */
  const openCreateFunction = (policyId: number) => setFuncForm({ policyId, editingId: null, type: 'permanent_message', message: '', modules: [], tasks: [] });

  const openEditFunction = async (fnNode: PolicyGraphNode) => {
    const policyEdge = graph.edges.find((e) => e.target === fnNode.key);
    const policyId = policyEdge ? Number(policyEdge.source.split(':')[1]) : 0;
    try {
      const res = await fetch(`/api/centralized/comandos/functions?id=${fnNode.id}`);
      const d = await res.json();
      const cfg = d.data?.config || {};
      const type = (d.data?.type || 'permanent_message') as FunctionType;
      setFuncForm({ policyId, editingId: fnNode.id, type, message: cfg.message || '', modules: cfg.modules || [], tasks: cfg.tasks || [] });
    } catch { toast.error('No se pudo cargar la función'); }
  };

  const saveFunction = async () => {
    if (!funcForm) return;
    const { type } = funcForm;
    const config = type === 'permanent_message' ? { message: funcForm.message.trim() }
      : type === 'block_modules' ? { modules: funcForm.modules }
        : { tasks: funcForm.tasks };
    if (type === 'permanent_message' && !funcForm.message.trim()) { toast.error('Escribe el mensaje'); return; }
    if (type === 'block_modules' && funcForm.modules.length === 0) { toast.error('Selecciona al menos un módulo'); return; }
    if (type === 'generate_tasks' && funcForm.tasks.length === 0) { toast.error('Agrega al menos una tarea'); return; }
    setBusy(true);
    try {
      if (funcForm.editingId) {
        const res = await fetch('/api/centralized/comandos/functions', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: funcForm.editingId, config }) });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Función actualizada');
      } else {
        const res = await fetch('/api/centralized/comandos/functions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ policy_id: funcForm.policyId, type, config }) });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Función creada');
      }
      const backToPolicy = policyKey('policy', funcForm.policyId);
      setFuncForm(null);
      await loadGraph();
      setSelectedKey(backToPolicy);
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusy(false); }
  };

  // Funciones de la política seleccionada (para navegar).
  const policyFunctions = useMemo(() => {
    if (!selectedNode || selectedNode.type !== 'policy') return [] as PolicyGraphNode[];
    const keys = graph.edges.filter((e) => e.source === selectedNode.key).map((e) => e.target);
    return graph.nodes.filter((n) => keys.includes(n.key));
  }, [selectedNode, graph]);

  return (
    <div className="flex gap-4 h-[calc(100dvh-130px)]">
      {/* ── Categorías ── */}
      <aside className="w-[240px] shrink-0 h-full bg-digi-card border border-digi-border rounded-lg overflow-hidden flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-digi-dark border-b border-digi-border shrink-0">
          <Sparkles className="w-4 h-4 text-accent shrink-0" />
          <span className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={df}>Categorías</span>
          <span className="ml-auto text-[10px] text-digi-muted tabular-nums">{categories.length}</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-digi-border/50">
          {categories.length === 0 ? (
            <p className="px-3 py-4 text-[12px] text-digi-muted text-center" style={mf}>Sin categorías. Crea la primera abajo.</p>
          ) : categories.map((c) => {
            const active = c.id === categoryId;
            return (
              <button key={c.id} onClick={() => setCategoryId(c.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 border-l-2 transition-colors ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}>
                <span className={`flex-1 min-w-0 text-[12.5px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{c.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full tabular-nums bg-black/[0.05] text-digi-muted">{c.policy_count ?? 0}</span>
              </button>
            );
          })}
        </div>
        <div className="p-2 border-t border-digi-border shrink-0 flex items-center gap-1.5">
          <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCategory()} placeholder="Nueva categoría…"
            className="field-control flex-1 min-w-0 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[12.5px] text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          <button onClick={createCategory} disabled={!newCategory.trim()} title="Crear categoría"
            className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40"><FolderPlus className="w-4 h-4" /></button>
        </div>
      </aside>

      {/* ── Grafo de políticas ── */}
      {!category ? (
        <div className="flex-1 min-w-0 h-full bg-digi-card border border-digi-border rounded-xl flex flex-col items-center justify-center text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mb-3"><MousePointerClick className="w-6 h-6 text-digi-muted" /></div>
          <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona o crea una categoría</p>
          <p className="text-[12px] text-digi-muted mt-1 max-w-sm" style={mf}>Verás sus políticas como un grafo; cada política contiene funciones que actúan en la app.</p>
        </div>
      ) : (
        <div className="flex-1 min-w-0 h-full bg-digi-card border border-digi-border rounded-lg overflow-hidden flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-b border-digi-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <span className="text-[13px] font-semibold text-digi-text truncate" style={mf}>Comandos — {category.name}</span>
            </div>
            <button onClick={() => { setCreatingPolicy(true); setSelectedKey(null); setFuncForm(null); setPolicyName(''); }} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-accent text-white text-[12px] font-medium rounded-md hover:bg-accent-hover transition-colors" style={mf}>
              <Plus className="w-3.5 h-3.5" /> Política
            </button>
          </div>

          <div className="relative flex-1 min-h-0">
            <PolicyGraph nodes={graph.nodes} edges={graph.edges} selectedKey={selectedKey} fitSignal={String(categoryId)} onSelect={(n) => { setSelectedKey(n ? n.key : null); setCreatingPolicy(false); setFuncForm(null); }} />

            {/* Leyenda */}
            <div className={`${GLASS} absolute top-3 left-3 z-10 w-[140px] p-1.5`}>
              <p className="px-1.5 pt-1 pb-1 text-[9.5px] font-semibold uppercase tracking-wide text-white/40" style={df}>Tipos</p>
              {(['policy', 'function'] as const).map((t) => (
                <div key={t} className="w-full inline-flex items-center gap-2 text-[11.5px] rounded-md px-2 py-1.5 text-white/70" style={mf}>
                  <span className="w-3 h-3 shrink-0" style={{ background: POLICY_META[t].color, ...shapeStyle(t) }} /> {POLICY_META[t].plural}
                </div>
              ))}
            </div>

            {/* Panel flotante */}
            {(creatingPolicy || funcForm || selectedNode) && (
              <aside className="absolute bottom-3 right-3 w-[340px] max-w-[calc(100%-24px)] max-h-[calc(100%-24px)] overflow-y-auto z-10 p-2.5 space-y-2.5">
                {/* Crear política */}
                {creatingPolicy ? (
                  <div className={`${GLASS} p-3.5 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13.5px] font-semibold text-white" style={df}>Nueva política</h3>
                      <button onClick={() => setCreatingPolicy(false)} className="text-white/60 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                    </div>
                    <input autoFocus value={policyName} onChange={(e) => setPolicyName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createPolicy()} placeholder="Nombre de la política" className={GLASS_INPUT} style={mf} />
                    <div className="flex gap-2">
                      <button onClick={() => setCreatingPolicy(false)} className={`${GLASS_BTN} flex-1 px-3 py-2 text-sm font-medium`} style={mf}>Cancelar</button>
                      <button onClick={createPolicy} disabled={busy || !policyName.trim()} className="flex-1 px-3 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>{busy ? '...' : 'Crear'}</button>
                    </div>
                  </div>
                ) : funcForm ? (
                  /* Crear/editar función */
                  <div className={`${GLASS} p-3.5 space-y-3`}>
                    <div className="flex items-center justify-between">
                      <h3 className="text-[13.5px] font-semibold text-white" style={df}>{funcForm.editingId ? 'Editar función' : 'Nueva función'}</h3>
                      <button onClick={() => setFuncForm(null)} className="text-white/60 hover:text-white" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                    </div>
                    <div>
                      <label className="text-[10.5px] font-semibold uppercase tracking-wide text-white/50" style={df}>Acción</label>
                      <select value={funcForm.type} onChange={(e) => setFuncForm((f) => f && ({ ...f, type: e.target.value as FunctionType }))} className={`${GLASS_INPUT} mt-1`} style={mf} disabled={!!funcForm.editingId}>
                        {FUNCTION_ACTIONS.map((a) => <option key={a.key} value={a.key} className="bg-digi-darker text-digi-text">{a.label}</option>)}
                      </select>
                    </div>

                    {funcForm.type === 'permanent_message' && (
                      <div>
                        <label className="text-[10.5px] font-semibold uppercase tracking-wide text-white/50" style={df}>Mensaje a mostrar</label>
                        <textarea autoFocus value={funcForm.message} onChange={(e) => setFuncForm((f) => f && ({ ...f, message: e.target.value }))} rows={3} placeholder="Se mostrará como header permanente en el dashboard…" className={`${GLASS_INPUT} mt-1 resize-none`} style={mf} />
                      </div>
                    )}

                    {funcForm.type === 'block_modules' && (
                      <div>
                        <label className="text-[10.5px] font-semibold uppercase tracking-wide text-white/50 mb-1.5 block" style={df}>Módulos a bloquear (excepto admin)</label>
                        <div className="flex flex-wrap gap-1.5">
                          {BLOCKABLE_MODULES.map((m) => {
                            const on = funcForm.modules.includes(m.path);
                            return (
                              <button key={m.path} type="button"
                                onClick={() => setFuncForm((f) => f && ({ ...f, modules: on ? f.modules.filter((x) => x !== m.path) : [...f.modules, m.path] }))}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${on ? 'bg-accent text-white border-accent' : 'border-white/20 text-white/80 hover:bg-white/[0.12]'}`} style={mf}>
                                {on && <Check className="w-3 h-3" />} {m.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {funcForm.type === 'generate_tasks' && (
                      <button onClick={() => setTasksModal(true)} className={`${GLASS_BTN} w-full px-3 py-2 text-[12.5px] font-medium`} style={mf}>
                        <ListChecks className="w-3.5 h-3.5" /> Configurar tareas ({funcForm.tasks.length})
                      </button>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setFuncForm(null)} className={`${GLASS_BTN} flex-1 px-3 py-2 text-sm font-medium`} style={mf}>Cancelar</button>
                      <button onClick={saveFunction} disabled={busy} className="flex-1 px-3 py-2 bg-accent text-white text-sm font-medium rounded-md hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>{busy ? '...' : 'Guardar'}</button>
                    </div>
                  </div>
                ) : selectedNode ? (
                  <>
                    {/* Cabecera del nodo */}
                    <div className={`${GLASS} p-3.5`}>
                      <div className="flex items-start gap-2.5">
                        <span className="w-3 h-3 mt-1 shrink-0" style={{ background: selectedNode.type === 'policy' && !selectedNode.active ? '#6b7280' : POLICY_META[selectedNode.type].color, ...shapeStyle(selectedNode.type) }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ ...df, color: POLICY_META[selectedNode.type].color }}>
                            {selectedNode.type === 'policy' ? 'Política' : FUNCTION_SHORT[selectedNode.functionType!]}
                          </p>
                          <h3 className="text-[14.5px] font-semibold text-white leading-snug" style={mf}>{selectedNode.title}</h3>
                        </div>
                        <button onClick={() => setSelectedKey(null)} className="text-white/60 hover:text-white shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                      </div>
                    </div>

                    {/* Política: toggle + funciones + acciones */}
                    {selectedNode.type === 'policy' && (
                      <>
                        <div className={`${GLASS} p-3 flex items-center gap-2.5`}>
                          <Power className={`w-4 h-4 shrink-0 ${selectedNode.active ? 'text-emerald-400' : 'text-white/40'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-white" style={mf}>{selectedNode.active ? 'Activa' : 'Inactiva'}</p>
                            <p className="text-[10.5px] text-white/50" style={mf}>Al activar, sus funciones actuarán en la app.</p>
                          </div>
                          <button role="switch" aria-checked={!!selectedNode.active} onClick={() => togglePolicy(selectedNode)}
                            className={`relative w-10 h-5.5 rounded-full shrink-0 transition-colors ${selectedNode.active ? 'bg-emerald-500' : 'bg-white/20'}`} title={selectedNode.active ? 'Desactivar' : 'Activar'} style={{ height: 22 }}>
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform" style={{ transform: selectedNode.active ? 'translateX(18px)' : 'none' }} />
                          </button>
                        </div>

                        <div className={`${GLASS} p-3.5 space-y-2`}>
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50" style={df}>Funciones · {policyFunctions.length}</p>
                            <button onClick={() => openCreateFunction(selectedNode.id)} className={`${GLASS_BTN} px-2 py-1 text-[11.5px] font-medium`} style={mf}><Plus className="w-3.5 h-3.5" /> Función</button>
                          </div>
                          {policyFunctions.length === 0 ? (
                            <p className="text-[12px] text-white/50" style={mf}>Sin funciones. Agrega la primera.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {policyFunctions.map((f) => {
                                const Icon = FUNC_ICON[f.functionType!];
                                return (
                                  <button key={f.key} onClick={() => setSelectedKey(f.key)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.14] border border-white/12 text-left transition-colors" style={mf}>
                                    <Icon className="w-3.5 h-3.5 text-white/70 shrink-0" />
                                    <span className="text-[12px] text-white/90 truncate">{f.title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className={`${GLASS} p-3`}>
                          <button onClick={() => setConfirmDel(selectedNode)} className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-400/40 bg-red-500/15 hover:bg-red-500/25 rounded-md text-[12.5px] font-medium text-red-300 transition-colors" style={mf}>
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar política
                          </button>
                        </div>
                      </>
                    )}

                    {/* Función: resumen + editar/eliminar */}
                    {selectedNode.type === 'function' && (
                      <div className={`${GLASS} p-3.5 space-y-3`}>
                        <div>
                          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-white/50" style={df}>{FUNCTION_LABEL[selectedNode.functionType!]}</p>
                          <p className="text-[12.5px] text-white/85 mt-1" style={mf}><FunctionSummary node={selectedNode} /></p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button onClick={() => openEditFunction(selectedNode)} className={`${GLASS_BTN} px-3 py-2 text-[12.5px] font-medium`} style={mf}><Pencil className="w-3.5 h-3.5" /> Editar</button>
                          <button onClick={() => setConfirmDel(selectedNode)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-red-400/40 bg-red-500/15 hover:bg-red-500/25 rounded-md text-[12.5px] font-medium text-red-300 transition-colors" style={mf}><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </aside>
            )}
          </div>
        </div>
      )}

      {funcForm && (
        <GenerateTasksModal open={tasksModal} initialTasks={funcForm.tasks} onClose={() => setTasksModal(false)} onSave={(tasks) => setFuncForm((f) => f && ({ ...f, tasks }))} />
      )}

      <PixelConfirm
        open={!!confirmDel}
        title="Eliminar elemento"
        message={confirmDel ? `¿Eliminar "${confirmDel.title}"?${confirmDel.type === 'policy' ? ' Se eliminarán también sus funciones.' : ''}` : ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => confirmDel && deleteNode(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

/** Resumen de la función seleccionada — carga su config del backend para mostrarla. */
function FunctionSummary({ node }: { node: PolicyGraphNode }) {
  const [text, setText] = useState('Cargando…');
  useEffect(() => {
    let ok = true;
    fetch(`/api/centralized/comandos/functions?id=${node.id}`)
      .then((r) => r.json())
      .then((d) => { if (ok) setText(summarizeFunction(node.functionType!, d.data?.config || {})); })
      .catch(() => { if (ok) setText('—'); });
    return () => { ok = false; };
  }, [node.id, node.functionType]);
  return <>{text}</>;
}
