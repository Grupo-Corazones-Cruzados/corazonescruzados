'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Inbox, Hexagon, ShieldCheck, Plus, X, Check, Trash2, Puzzle, ExternalLink, Beaker, Lock, CheckCircle2, RotateCcw,
} from 'lucide-react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelConfirm from '@/components/ui/PixelConfirm';
import GdGraph from '@/components/centralized/gestion-datos/GdGraph';
import { FACTORES, FACTOR_LABEL, FACTOR_COLOR, causaLabel, RESTRICCION_TIPOS, RESTRICCION_LABEL, type RestriccionTipo } from '@/lib/centralized/condiciologia';
import type { GdGraph as GdGraphT } from '@/lib/centralized/gestion-datos';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const INPUT = 'w-full px-2.5 py-1.5 bg-white border border-digi-border rounded-md text-[13px] text-digi-text placeholder-digi-muted focus:border-accent focus:outline-none';
const mono = { fontFamily: 'var(--font-mono, monospace)' } as const;

async function mutate(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Error de servidor');
  return d;
}
const API = '/api/centralized/condiciones';

type Task = { id: number; titulo: string; notas: string; estado: string; proyecto: string; codigos_count: number; pieza_id: number | null };
type CodDetalle = { id: number; nomenclatura: string; texto: string; premisas: any[]; enfrentadas: any[] };
type CondVar = { id: number; kind: string; nombre: string; factor: string; causa: string | null };
type CondEvento = { id: number; titulo: string; url: string };
type CondRestr = { id: number; tipo: RestriccionTipo; config: any };
type Condicion = { id: number; nombre: string; verificada: boolean; variables: CondVar[]; eventos: CondEvento[]; restricciones: CondRestr[] };
type Workspace = { id: number; tipo: string; estado: string; codigoIds: number[]; condiciones: Condicion[] };
type CatVar = { id: number; factor: string; causa: string; nombre: string };

export default function GestionDeCondicionesSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState<number | null>(null);
  const [tab, setTab] = useState<'datos' | 'subtareas' | 'pieza'>('datos');
  const [codigos, setCodigos] = useState<CodDetalle[]>([]);
  const [ws, setWs] = useState<Workspace | null>(null);
  const [catalogo, setCatalogo] = useState<CatVar[]>([]);
  const [selCond, setSelCond] = useState<number | null>(null);
  const [modal, setModal] = useState<null | 'catalogo' | 'variable'>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [piezaView, setPiezaView] = useState<'panel' | 'universo'>('panel');
  const [piezaGraph, setPiezaGraph] = useState<GdGraphT>({ nodes: [], edges: [] });
  const [reqs, setReqs] = useState<any[]>([]);
  const [miembrosFund, setMiembrosFund] = useState<{ id: number; name: string }[]>([]);
  const [entregableFor, setEntregableFor] = useState<number | null>(null);
  const [newReq, setNewReq] = useState({ titulo: '', descripcion: '' });

  const task = useMemo(() => tasks.find((t) => t.id === taskId) || null, [tasks, taskId]);
  const condicion = useMemo(() => ws?.condiciones.find((c) => c.id === selCond) || null, [ws, selCond]);

  const loadTasks = useCallback(async () => {
    try { const d = await fetch(`${API}/tareas`).then((r) => r.json()); setTasks(d.data || []); } catch { /* noop */ }
  }, []);
  const loadCatalogo = useCallback(async () => {
    try { const d = await fetch(`${API}/catalogo`).then((r) => r.json()); setCatalogo(d.data || []); } catch { /* noop */ }
  }, []);
  const loadCodigos = useCallback(async (id: number | null) => {
    if (!id) { setCodigos([]); return; }
    try { const d = await fetch(`${API}/tarea-codigos?task_id=${id}`).then((r) => r.json()); setCodigos(d.data || []); } catch { /* noop */ }
  }, []);
  const loadWs = useCallback(async (piezaId: number | null) => {
    if (!piezaId) { setWs(null); return; }
    try { const d = await fetch(`${API}/pieza?pieza_id=${piezaId}`).then((r) => r.json()); setWs(d.data || null); } catch { /* noop */ }
  }, []);

  const loadReqs = useCallback(async (id: number | null) => {
    if (!id) { setReqs([]); return; }
    try { const d = await fetch(`${API}/requerimientos?task_id=${id}`).then((r) => r.json()); setReqs(d.data || []); } catch { /* noop */ }
  }, []);
  const loadMiembros = useCallback(async () => {
    try { const d = await fetch(`${API}/miembros-fundamentacion`).then((r) => r.json()); setMiembrosFund(d.data || []); } catch { /* noop */ }
  }, []);

  useEffect(() => { loadTasks(); loadCatalogo(); loadMiembros(); }, [loadTasks, loadCatalogo, loadMiembros]);
  useEffect(() => { loadCodigos(taskId); loadWs(task?.pieza_id ?? null); loadReqs(taskId); setSelCond(null); }, [taskId, task?.pieza_id, loadCodigos, loadWs, loadReqs]);

  const loadGraph = useCallback(async (piezaId: number | null) => {
    if (!piezaId) { setPiezaGraph({ nodes: [], edges: [] }); return; }
    try { const d = await fetch(`${API}/pieza-grafo?pieza_id=${piezaId}`).then((r) => r.json()); setPiezaGraph(d.data || { nodes: [], edges: [] }); } catch { /* noop */ }
  }, []);
  const reloadWs = useCallback(async () => { await loadWs(task?.pieza_id ?? null); await loadGraph(task?.pieza_id ?? null); }, [loadWs, loadGraph, task?.pieza_id]);
  useEffect(() => { loadGraph(task?.pieza_id ?? null); }, [task?.pieza_id, loadGraph]);

  // ── Pieza: tipo / códigos ─────────────────────────────────────────────────
  const setTipo = async (tipo: string) => {
    if (!ws) return;
    try { await mutate(`${API}/pieza`, 'PATCH', { pieza_id: ws.id, tipo }); await reloadWs(); } catch (e: any) { toast.error(e.message); }
  };
  const toggleCodigo = async (cid: number) => {
    if (!ws) return;
    const next = ws.codigoIds.includes(cid) ? ws.codigoIds.filter((x) => x !== cid) : [...ws.codigoIds, cid];
    try { await mutate(`${API}/pieza`, 'PATCH', { pieza_id: ws.id, codigo_ids: next }); await reloadWs(); } catch (e: any) { toast.error(e.message); }
  };

  // ── Condiciones ────────────────────────────────────────────────────────────
  const [newCond, setNewCond] = useState('');
  const addCond = async () => {
    if (!ws || !newCond.trim()) return;
    try { const d = await mutate(`${API}/condiciones`, 'POST', { pieza_id: ws.id, nombre: newCond }); setNewCond(''); await reloadWs(); setSelCond(d.data.id); }
    catch (e: any) { toast.error(e.message); }
  };
  const toggleVerificada = async (c: Condicion) => {
    if (!c.verificada && c.eventos.length === 0) { toast.error('Agrega un evento de demostración para verificar la condición.'); return; }
    try { await mutate(`${API}/condiciones`, 'PATCH', { id: c.id, verificada: !c.verificada }); await reloadWs(); } catch (e: any) { toast.error(e.message); }
  };
  const delCond = async (id: number) => {
    try { await mutate(`${API}/condiciones`, 'DELETE', { id }); if (selCond === id) setSelCond(null); await reloadWs(); } catch (e: any) { toast.error(e.message); }
  };

  // ── Completar / reabrir ────────────────────────────────────────────────────
  const complete = async () => {
    if (!task) return;
    try { await mutate(`${API}/tareas`, 'PATCH', { id: task.id, action: 'complete' }); toast.success('Tarea completada — pieza lista para Gestión de Datos'); await loadTasks(); await reloadWs(); }
    catch (e: any) { toast.error(e.message); }
  };
  const reopen = async () => {
    if (!task) return;
    try { await mutate(`${API}/tareas`, 'PATCH', { id: task.id, action: 'reopen' }); toast.success('Tarea reabierta'); await loadTasks(); await reloadWs(); }
    catch (e: any) { toast.error(e.message); }
  };

  const addReq = async () => {
    if (!task || !newReq.titulo.trim()) { toast.error('Título requerido'); return; }
    try { await mutate(`${API}/requerimientos`, 'POST', { task_id: task.id, ...newReq }); setNewReq({ titulo: '', descripcion: '' }); await loadReqs(task.id); }
    catch (e: any) { toast.error(e.message); }
  };
  const delReq = async (id: number) => { if (!task) return; try { await mutate(`${API}/requerimientos`, 'DELETE', { id }); await loadReqs(task.id); } catch (e: any) { toast.error(e.message); } };
  const tomar = async (kind: 'ticket' | 'project', id: number) => {
    try { await mutate(`${API}/tomar`, 'POST', { kind, id }); toast.success(kind === 'ticket' ? 'Ticket tomado' : 'Te uniste al proyecto'); if (task) await loadReqs(task.id); }
    catch (e: any) { toast.error(e.message); }
  };

  const completed = ws?.estado === 'completa';

  return (
    <div className="flex gap-4 h-[calc(100dvh-130px)]">
      {/* ── Bandeja de tareas ── */}
      <aside className="w-[270px] shrink-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center justify-between">
          <div className="flex items-center gap-1.5"><Inbox className="w-4 h-4 text-accent" /><span className="text-[12px] font-semibold text-digi-text" style={df}>Tareas</span></div>
          <button onClick={() => setModal('catalogo')} className="text-[10.5px] text-digi-muted hover:text-accent inline-flex items-center gap-1" style={mf} title="Catálogo de variables (Dinámica)"><Beaker className="w-3.5 h-3.5" /> Variables</button>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {tasks.length === 0 && <p className="text-[12px] text-digi-muted px-2 py-4 text-center" style={mf}>Sin tareas. Se generan desde Metodología Condiciológica.</p>}
          {tasks.map((t) => (
            <div key={t.id} onClick={() => setTaskId(t.id)} className={`px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${taskId === t.id ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.estado === 'completada' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="text-[12.5px] font-medium text-digi-text truncate flex-1" style={mf}>{t.titulo}</span>
              </div>
              <p className="text-[10.5px] text-digi-muted mt-0.5 pl-3.5" style={mf}>{t.proyecto} · {t.codigos_count} códigos</p>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Detalle de tarea ── */}
      <div className="flex-1 min-w-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {!task ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3"><Inbox className="w-6 h-6 text-accent" /></div>
              <p className="text-sm font-medium text-digi-text" style={df}>Selecciona una tarea</p>
              <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>Reconoce, controla y predice los códigos para descubrir condiciones y completar la pieza.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-3 pt-2.5 border-b border-digi-border">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-digi-text truncate" style={df}>{task.titulo}</span>
                {completed && <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5"><CheckCircle2 className="w-3 h-3" /> Completada</span>}
              </div>
              <div className="flex items-center gap-1">
                {(['datos', 'subtareas', 'pieza'] as const).map((k) => (
                  <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md capitalize transition-colors border-b-2 ${tab === k ? 'border-accent text-accent' : 'border-transparent text-digi-muted hover:text-digi-text'}`} style={mf}>{k}</button>
                ))}
              </div>
            </div>

            {tab === 'datos' ? (
              <div className="flex-1 overflow-y-auto p-3">
                {task.notas && <p className="text-[12px] text-digi-text mb-3 bg-black/[0.02] border border-digi-border rounded-md p-2" style={mf}>{task.notas}</p>}
                <p className="text-[11px] font-semibold text-digi-text mb-2" style={df}>Códigos de la tarea ({codigos.length})</p>
                <div className="space-y-3">
                  {codigos.map((c) => <CodigoDetalle key={c.id} c={c} />)}
                </div>
              </div>
            ) : tab === 'subtareas' ? (
              <div className="flex-1 overflow-y-auto p-3">
                <p className="text-[11.5px] text-digi-muted mb-2" style={mf}>Cada requerimiento genera <b>tickets o proyectos reales</b> (tú eres el cliente). Solo miembros de <b>paso fundamentación</b> pueden tomarlos; su autorización de acceso se salta.</p>
                <div className="space-y-2 mb-3">
                  {reqs.map((r) => (
                    <div key={r.id} className="border border-digi-border rounded-md p-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12.5px] font-semibold text-digi-text flex-1" style={mf}>{r.titulo}</span>
                        <button onClick={() => setEntregableFor(r.id)} className="text-[10.5px] text-accent hover:underline inline-flex items-center gap-0.5"><Plus className="w-3 h-3" /> Entregable</button>
                        <button onClick={() => delReq(r.id)} className="text-digi-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      {r.descripcion && <p className="text-[11px] text-digi-muted mb-1.5" style={mf}>{r.descripcion}</p>}
                      <div className="space-y-1">
                        {r.tickets.map((t: any) => (
                          <EntregableRow key={`t${t.id}`} kind="ticket" item={t} onTomar={() => tomar('ticket', t.id)} />
                        ))}
                        {r.projects.map((p: any) => (
                          <EntregableRow key={`p${p.id}`} kind="project" item={p} onTomar={() => tomar('project', p.id)} />
                        ))}
                        {r.tickets.length === 0 && r.projects.length === 0 && <p className="text-[10.5px] text-digi-muted" style={mf}>Sin entregables. Agrega tickets o proyectos.</p>}
                      </div>
                    </div>
                  ))}
                  {reqs.length === 0 && <p className="text-[11.5px] text-digi-muted" style={mf}>Sin requerimientos aún.</p>}
                </div>
                <div className="border border-dashed border-digi-border rounded-md p-2.5">
                  <p className="text-[11px] font-semibold text-digi-text mb-1" style={df}>Nuevo requerimiento</p>
                  <input className={`${INPUT} mb-1.5`} value={newReq.titulo} onChange={(e) => setNewReq((f) => ({ ...f, titulo: e.target.value }))} placeholder="Título del requerimiento" />
                  <div className="flex gap-1.5">
                    <input className={`${INPUT} flex-1`} value={newReq.descripcion} onChange={(e) => setNewReq((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción (opcional)" />
                    <button onClick={addReq} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Agregar</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="px-3 py-1.5 border-b border-digi-border flex items-center gap-1.5">
                  {(['panel', 'universo'] as const).map((v) => (
                    <button key={v} onClick={() => setPiezaView(v)} className={`px-2.5 py-1 text-[11px] rounded-md border transition-colors capitalize ${piezaView === v ? 'bg-accent text-white border-accent' : 'border-digi-border text-digi-muted hover:text-digi-text'}`} style={mf}>{v === 'panel' ? 'Panel' : 'Universo de gráficos'}</button>
                  ))}
                  <span className="text-[10px] text-digi-muted ml-1" style={mf}>Mismos íconos que Gestión de Datos: código, pieza, condición, variable.</span>
                </div>
                {piezaView === 'universo' ? (
                  <div className="flex-1 min-h-0">
                    <GdGraph nodes={piezaGraph.nodes} edges={piezaGraph.edges} selectedKey={null} onSelect={() => {}} fitSignal={String(task.pieza_id || '')} />
                  </div>
                ) : (
              <div className="flex-1 min-h-0 flex">
                {/* Pieza + condiciones (lista) */}
                <div className="w-[300px] shrink-0 border-r border-digi-border flex flex-col">
                  <div className="p-3 border-b border-digi-border">
                    <div className="flex items-center gap-1.5 mb-2"><Puzzle className="w-4 h-4 text-teal-500" /><span className="text-[12px] font-semibold text-digi-text" style={df}>Pieza</span>{ws && <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${completed ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>{completed ? 'Completa' : 'Incompleta'}</span>}</div>
                    <div className="flex gap-1 mb-2">
                      {(['revision', 'correccion'] as const).map((tp) => (
                        <button key={tp} onClick={() => setTipo(tp)} disabled={completed} className={`flex-1 px-2 py-1 text-[11px] rounded border transition-colors disabled:opacity-50 ${ws?.tipo === tp ? 'bg-accent text-white border-accent' : 'border-digi-border text-digi-text hover:border-accent'}`} style={mf}>{tp === 'revision' ? 'Revisión' : 'Corrección'}</button>
                      ))}
                    </div>
                    <p className="text-[10px] text-digi-muted mb-1" style={mf}>Códigos que usa la pieza:</p>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {codigos.map((c) => (
                        <button key={c.id} onClick={() => toggleCodigo(c.id)} disabled={completed} className={`w-full flex items-center gap-1.5 text-left px-1.5 py-1 rounded text-[11px] disabled:opacity-60 ${ws?.codigoIds.includes(c.id) ? 'bg-accent/15' : 'hover:bg-black/[0.03]'}`} style={mf}>
                          <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${ws?.codigoIds.includes(c.id) ? 'bg-accent border-accent' : 'border-digi-border'}`}>{ws?.codigoIds.includes(c.id) && <Check className="w-2 h-2 text-white" />}</span>
                          <span className="truncate" style={mono}>{c.nomenclatura}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-digi-text" style={df}>Condiciones ({ws?.condiciones.length || 0})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto px-1.5 space-y-0.5">
                    {ws?.condiciones.map((c) => (
                      <div key={c.id} onClick={() => setSelCond(c.id)} className={`px-2 py-1.5 rounded-md cursor-pointer flex items-center gap-1.5 ${selCond === c.id ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.verificada ? 'bg-emerald-500' : 'bg-digi-muted'}`} />
                        <span className="text-[11.5px] text-digi-text truncate flex-1" style={mf}>{c.nombre}</span>
                        <span className="text-[9.5px] text-digi-muted" style={mf}>{c.variables.length}v</span>
                      </div>
                    ))}
                    {(!ws || ws.condiciones.length === 0) && <p className="text-[11px] text-digi-muted px-2 py-3" style={mf}>Sin condiciones aún.</p>}
                  </div>
                  {!completed && (
                    <div className="p-2 border-t border-digi-border flex gap-1.5">
                      <input className={`${INPUT} flex-1`} value={newCond} onChange={(e) => setNewCond(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCond(); }} placeholder="Nueva condición…" />
                      <button onClick={addCond} className="px-2 py-1.5 border border-digi-border rounded-md text-digi-text hover:border-accent hover:text-accent"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  )}
                </div>

                {/* Detalle de condición + completar */}
                <div className="flex-1 min-w-0 overflow-y-auto p-3">
                  {condicion ? (
                    <CondicionDetalle cond={condicion} catalogo={catalogo} readOnly={completed} onReload={reloadWs} onDelete={() => delCond(condicion.id)} onToggleVerificada={() => toggleVerificada(condicion)} />
                  ) : (
                    <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Selecciona o crea una condición para definir sus variables, eventos y restricciones.</p>
                  )}

                  <div className="mt-5 pt-3 border-t border-digi-border flex items-center gap-2">
                    {completed ? (
                      <button onClick={reopen} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-digi-text border border-digi-border rounded-md hover:border-accent" style={mf}><RotateCcw className="w-3.5 h-3.5" /> Reabrir tarea</button>
                    ) : (
                      <button onClick={() => setConfirmComplete(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}><CheckCircle2 className="w-3.5 h-3.5" /> Completar tarea (materializar pieza)</button>
                    )}
                    <span className="text-[10.5px] text-digi-muted" style={mf}>Al completar, las variables de las condiciones se vuelcan a la pieza y queda usable en Gestión de Datos.</span>
                  </div>
                </div>
              </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {modal === 'catalogo' && <CatalogoModal catalogo={catalogo} onClose={() => setModal(null)} onChanged={loadCatalogo} />}
      {entregableFor != null && <EntregableModal reqId={entregableFor} miembros={miembrosFund} onClose={() => setEntregableFor(null)} onSaved={async () => { setEntregableFor(null); if (task) await loadReqs(task.id); }} />}

      <PixelConfirm
        open={confirmComplete}
        title="Completar tarea"
        message="Se materializarán las variables de las condiciones en la pieza y quedará COMPLETA (usable en Gestión de Datos). Podrás reabrirla luego. ¿Continuar?"
        confirmLabel="Completar"
        onConfirm={() => { setConfirmComplete(false); complete(); }}
        onCancel={() => setConfirmComplete(false)}
      />
    </div>
  );
}

// ── Detalle de código (compacto) ──────────────────────────────────────────────
function CodigoDetalle({ c }: { c: CodDetalle }) {
  return (
    <div className="border border-digi-border rounded-md p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Hexagon className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[12.5px] font-semibold text-digi-text" style={mono}>{c.nomenclatura}</span>
      </div>
      {c.texto && <p className="text-[11.5px] text-digi-text mb-1.5" style={mf}>{c.texto}</p>}
      {c.premisas.map((p: any) => (
        <div key={p.id} className="text-[11px] text-digi-muted pl-2 border-l-2 border-digi-border mb-1" style={mf}>
          <span className="font-bold text-cyan-600" style={mono}>{p.nomenclatura}</span> ({Math.round(p.credibilidad_efectiva)}%) — {p.contenido}
          {p.pesos?.length > 0 && <span className="ml-1 text-blue-600">[{p.pesos.map((w: any) => w.peso_nomenclatura).join(', ')}]</span>}
        </div>
      ))}
      {c.enfrentadas.map((e: any) => (
        <div key={e.id} className="text-[11px] text-purple-600 pl-2 border-l-2 border-purple-200 mb-1" style={mono}>{e.nomenclatura}</div>
      ))}
    </div>
  );
}

// ── Detalle de una condición ──────────────────────────────────────────────────
function CondicionDetalle({ cond, catalogo, readOnly, onReload, onDelete, onToggleVerificada }: { cond: Condicion; catalogo: CatVar[]; readOnly: boolean; onReload: () => void; onDelete: () => void; onToggleVerificada: () => void }) {
  const [varModal, setVarModal] = useState(false);
  const [evTitulo, setEvTitulo] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [restrTipo, setRestrTipo] = useState<RestriccionTipo>('no_junto_con');
  const [restrVal, setRestrVal] = useState('');

  const delVar = async (id: number) => { try { await mutate(`${API}/variables`, 'DELETE', { id }); await onReload(); } catch (e: any) { toast.error(e.message); } };
  const addEvento = async () => { if (!evTitulo.trim()) { toast.error('Título requerido'); return; } try { await mutate(`${API}/eventos`, 'POST', { condicion_id: cond.id, titulo: evTitulo, url: evUrl }); setEvTitulo(''); setEvUrl(''); await onReload(); } catch (e: any) { toast.error(e.message); } };
  const delEvento = async (id: number) => { try { await mutate(`${API}/eventos`, 'DELETE', { id }); await onReload(); } catch (e: any) { toast.error(e.message); } };
  const addRestr = async () => {
    let config: any = {};
    if (restrTipo === 'no_junto_con') config = { variables: restrVal.split(',').map((s) => s.trim()).filter(Boolean) };
    else if (restrTipo === 'solo_categorias') config = { categorias: restrVal.split(',').map((s) => s.trim()).filter(Boolean) };
    try { await mutate(`${API}/restricciones`, 'POST', { condicion_id: cond.id, tipo: restrTipo, config }); setRestrVal(''); await onReload(); } catch (e: any) { toast.error(e.message); }
  };
  const delRestr = async (id: number) => { try { await mutate(`${API}/restricciones`, 'DELETE', { id }); await onReload(); } catch (e: any) { toast.error(e.message); } };

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[14px] font-semibold text-digi-text" style={df}>{cond.nombre}</span>
        <button onClick={onToggleVerificada} disabled={readOnly} className={`ml-auto inline-flex items-center gap-1 text-[10.5px] px-2 py-1 rounded border transition-colors disabled:opacity-50 ${cond.verificada ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'text-digi-muted border-digi-border hover:border-accent'}`} style={mf}><ShieldCheck className="w-3 h-3" /> {cond.verificada ? 'Verificada' : 'Verificar'}</button>
        {!readOnly && <button onClick={onDelete} className="text-digi-muted hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>}
      </div>

      {/* Variables */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-semibold text-digi-text" style={df}>Variables ({cond.variables.length})</span>
        {!readOnly && <button onClick={() => setVarModal(true)} className="text-[10.5px] text-accent hover:underline inline-flex items-center gap-0.5"><Plus className="w-3 h-3" /> Agregar</button>}
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        {cond.variables.map((v) => (
          <span key={v.id} className="inline-flex items-center gap-1 text-[10.5px] text-digi-text bg-black/[0.03] border rounded px-1.5 py-0.5" style={{ ...mf, borderColor: FACTOR_COLOR[v.factor as 'mental'] || '#ddd' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: FACTOR_COLOR[v.factor as 'mental'] || '#999' }} />
            {v.nombre}
            <span className="text-digi-muted">· {FACTOR_LABEL[v.factor as 'mental'] || v.factor}{v.causa ? `/${causaLabel(v.factor, v.causa)}` : ''}{v.kind === 'fija' ? ' · fija' : ''}</span>
            {!readOnly && <button onClick={() => delVar(v.id)} className="text-digi-muted hover:text-red-500"><X className="w-2.5 h-2.5" /></button>}
          </span>
        ))}
        {cond.variables.length === 0 && <span className="text-[11px] text-digi-muted" style={mf}>Sin variables.</span>}
      </div>

      {/* Restricciones */}
      <p className="text-[11px] font-semibold text-digi-text mb-1" style={df}>Restricciones</p>
      <div className="space-y-1 mb-1.5">
        {cond.restricciones.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-[10.5px] bg-black/[0.02] border border-digi-border rounded px-2 py-1" style={mf}>
            <span className="font-medium text-digi-text">{RESTRICCION_LABEL[r.tipo]}</span>
            <span className="text-digi-muted truncate flex-1">{r.config?.variables?.join(', ') || r.config?.categorias?.join(', ') || '—'}</span>
            {!readOnly && <button onClick={() => delRestr(r.id)} className="text-digi-muted hover:text-red-500"><X className="w-3 h-3" /></button>}
          </div>
        ))}
        {cond.restricciones.length === 0 && <span className="text-[11px] text-digi-muted" style={mf}>Sin restricciones.</span>}
      </div>
      {!readOnly && (
        <div className="flex items-center gap-1.5 mb-3">
          <select className={`${INPUT} w-40`} value={restrTipo} onChange={(e) => setRestrTipo(e.target.value as RestriccionTipo)}>
            {RESTRICCION_TIPOS.map((r) => <option key={r.key} value={r.key} className="bg-white">{r.label}</option>)}
          </select>
          {restrTipo !== 'aplica_mas_de_uno' && <input className={`${INPUT} flex-1`} value={restrVal} onChange={(e) => setRestrVal(e.target.value)} placeholder={restrTipo === 'no_junto_con' ? 'variables (coma)' : 'categorías (coma)'} />}
          <button onClick={addRestr} className="px-2 py-1.5 border border-digi-border rounded-md text-digi-text hover:border-accent"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Eventos */}
      <p className="text-[11px] font-semibold text-digi-text mb-1" style={df}>Eventos de demostración</p>
      <div className="space-y-1 mb-1.5">
        {cond.eventos.map((e) => (
          <div key={e.id} className="flex items-center gap-2 text-[11px] bg-black/[0.02] border border-digi-border rounded px-2 py-1">
            <span className="text-digi-text flex-1 truncate" style={mf}>{e.titulo}</span>
            {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-accent"><ExternalLink className="w-3 h-3" /></a>}
            {!readOnly && <button onClick={() => delEvento(e.id)} className="text-digi-muted hover:text-red-500"><X className="w-3 h-3" /></button>}
          </div>
        ))}
        {cond.eventos.length === 0 && <span className="text-[11px] text-digi-muted" style={mf}>Sin eventos (se requiere ≥1 para verificar).</span>}
      </div>
      {!readOnly && (
        <div className="space-y-1.5">
          <input className={INPUT} value={evTitulo} onChange={(e) => setEvTitulo(e.target.value)} placeholder="Título del evento" />
          <div className="flex gap-1.5">
            <input className={`${INPUT} flex-1`} value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="URL (video/streaming)" />
            <button onClick={addEvento} className="px-2 py-1.5 border border-digi-border rounded-md text-digi-text hover:border-accent"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      )}

      {varModal && <VariableModal condId={cond.id} catalogo={catalogo} onClose={() => setVarModal(false)} onSaved={async () => { setVarModal(false); await onReload(); }} />}
    </div>
  );
}

// ── Modal: agregar variable a una condición ───────────────────────────────────
function VariableModal({ condId, catalogo, onClose, onSaved }: { condId: number; catalogo: CatVar[]; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'fija' | 'catalogo'>('catalogo');
  const [varId, setVarId] = useState('');
  const [nombre, setNombre] = useState('');
  const [factor, setFactor] = useState('mental');
  const [causa, setCausa] = useState('');
  const causas = FACTORES.find((f) => f.key === factor)?.causas || [];

  const save = async () => {
    try {
      if (kind === 'catalogo') {
        if (!varId) { toast.error('Elige una variable del catálogo'); return; }
        await mutate(`${API}/variables`, 'POST', { condicion_id: condId, kind: 'catalogo', variable_id: Number(varId) });
      } else {
        if (!nombre.trim()) { toast.error('Nombre requerido'); return; }
        await mutate(`${API}/variables`, 'POST', { condicion_id: condId, kind: 'fija', nombre, factor, causa: causa || null });
      }
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title="Agregar variable" initialWidth={440} initialHeight={400}>
      <div className="p-4 space-y-3">
        <div className="inline-flex rounded-md border border-digi-border overflow-hidden">
          {(['catalogo', 'fija'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 text-[12px] ${kind === k ? 'bg-accent text-white' : 'text-digi-text hover:bg-black/[0.03]'}`} style={mf}>{k === 'catalogo' ? 'Del catálogo' : 'Fija'}</button>
          ))}
        </div>
        {kind === 'catalogo' ? (
          <div>
            <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Variable (Dinámica Condiciológica)</label>
            <select className={INPUT} value={varId} onChange={(e) => setVarId(e.target.value)}>
              <option value="">Elige…</option>
              {catalogo.map((v) => <option key={v.id} value={v.id} className="bg-white">{v.nombre} — {FACTOR_LABEL[v.factor as 'mental']}/{causaLabel(v.factor, v.causa)}</option>)}
            </select>
            {catalogo.length === 0 && <p className="text-[10.5px] text-digi-muted mt-1" style={mf}>El catálogo está vacío. Agrégalo desde “Variables” (arriba). Lo gestionará Dinámica Condiciológica.</p>}
          </div>
        ) : (
          <>
            <div><label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Nombre</label><input className={INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus /></div>
            <div className="flex gap-2">
              <div className="flex-1"><label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Factor</label>
                <select className={INPUT} value={factor} onChange={(e) => { setFactor(e.target.value); setCausa(''); }}>{FACTORES.map((f) => <option key={f.key} value={f.key} className="bg-white">{f.label}</option>)}</select>
              </div>
              <div className="flex-1"><label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Causa</label>
                <select className={INPUT} value={causa} onChange={(e) => setCausa(e.target.value)}><option value="">—</option>{causas.map((c) => <option key={c.key} value={c.key} className="bg-white">{c.label}</option>)}</select>
              </div>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-digi-text border border-digi-border rounded-md hover:border-accent" style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Agregar</button>
        </div>
      </div>
    </FloatingWindow>
  );
}

// ── Modal: catálogo de variables (Dinámica Condiciológica, provisional) ───────
function CatalogoModal({ catalogo, onClose, onChanged }: { catalogo: CatVar[]; onClose: () => void; onChanged: () => void }) {
  const [factor, setFactor] = useState('mental');
  const [causa, setCausa] = useState(FACTORES[0].causas[0].key);
  const [nombre, setNombre] = useState('');
  const causas = FACTORES.find((f) => f.key === factor)?.causas || [];

  const add = async () => { if (!nombre.trim()) return; try { await mutate(`${API}/catalogo`, 'POST', { factor, causa, nombre }); setNombre(''); await onChanged(); } catch (e: any) { toast.error(e.message); } };
  const del = async (id: number) => { try { await mutate(`${API}/catalogo`, 'DELETE', { id }); await onChanged(); } catch (e: any) { toast.error(e.message); } };

  return (
    <FloatingWindow open onClose={onClose} title="Catálogo de variables (Dinámica Condiciológica)" initialWidth={500} initialHeight={560}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-digi-muted" style={mf}>Provisional: aquí se listan las variables por factor→causa que usan las condiciones. A futuro las definirá el sistema Dinámica Condiciológica.</p>
        <div className="flex gap-1.5 items-end">
          <div className="flex-1"><label className="block text-[10.5px] text-digi-muted mb-0.5" style={mf}>Factor</label><select className={INPUT} value={factor} onChange={(e) => { setFactor(e.target.value); setCausa(FACTORES.find((f) => f.key === e.target.value)!.causas[0].key); }}>{FACTORES.map((f) => <option key={f.key} value={f.key} className="bg-white">{f.label}</option>)}</select></div>
          <div className="flex-1"><label className="block text-[10.5px] text-digi-muted mb-0.5" style={mf}>Causa</label><select className={INPUT} value={causa} onChange={(e) => setCausa(e.target.value)}>{causas.map((c) => <option key={c.key} value={c.key} className="bg-white">{c.label}</option>)}</select></div>
        </div>
        <div className="flex gap-1.5">
          <input className={`${INPUT} flex-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder="Nombre de la variable" />
          <button onClick={add} className="px-2 py-1.5 border border-digi-border rounded-md text-digi-text hover:border-accent"><Plus className="w-3.5 h-3.5" /></button>
        </div>
        <div className="space-y-1 max-h-72 overflow-y-auto">
          {FACTORES.map((f) => {
            const list = catalogo.filter((v) => v.factor === f.key);
            if (!list.length) return null;
            return (
              <div key={f.key}>
                <p className="text-[10px] uppercase tracking-wide mt-1.5 mb-0.5" style={{ ...df, color: f.color }}>{f.label}</p>
                {list.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 text-[11.5px] bg-black/[0.02] border border-digi-border rounded px-2 py-1">
                    <span className="text-digi-text flex-1 truncate" style={mf}>{v.nombre}</span>
                    <span className="text-[10px] text-digi-muted" style={mf}>{causaLabel(v.factor, v.causa)}</span>
                    <button onClick={() => del(v.id)} className="text-digi-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            );
          })}
          {catalogo.length === 0 && <p className="text-[11px] text-digi-muted" style={mf}>Catálogo vacío.</p>}
        </div>
      </div>
    </FloatingWindow>
  );
}

// ── Fila de entregable (ticket/proyecto) ──────────────────────────────────────
function EntregableRow({ kind, item, onTomar }: { kind: 'ticket' | 'project'; item: any; onTomar: () => void }) {
  const taken = kind === 'ticket' ? !!item.member_id : !!item.assigned_member_id;
  const href = kind === 'ticket' ? `/dashboard/tickets/${item.id}` : `/dashboard/projects/${item.id}`;
  return (
    <div className="flex items-center gap-2 text-[11.5px] bg-black/[0.02] border border-digi-border rounded px-2 py-1.5">
      <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${kind === 'ticket' ? 'bg-sky-50 text-sky-600 border border-sky-200' : 'bg-violet-50 text-violet-600 border border-violet-200'}`}>{kind === 'ticket' ? 'Ticket' : 'Proyecto'}</span>
      <span className="text-digi-text truncate flex-1" style={mf}>{item.title}</span>
      <span className="text-[10px] text-digi-muted" style={mf}>{taken ? (item.member_name || 'Asignado') : 'Público'}</span>
      <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline text-[10.5px]" style={mf}>Ver</a>
      {!taken && <button onClick={onTomar} className="text-[10.5px] text-white bg-accent hover:bg-accent/90 rounded px-1.5 py-0.5" style={mf}>{kind === 'ticket' ? 'Tomar' : 'Participar'}</button>}
    </div>
  );
}

// ── Modal: crear entregable (ticket/proyecto real) ────────────────────────────
function EntregableModal({ reqId, miembros, onClose, onSaved }: { reqId: number; miembros: { id: number; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState<'ticket' | 'project'>('ticket');
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignacion, setAsignacion] = useState<'publico' | 'miembro'>('publico');
  const [memberId, setMemberId] = useState('');

  const save = async () => {
    if (!titulo.trim()) { toast.error('Título requerido'); return; }
    if (asignacion === 'miembro' && !memberId) { toast.error('Elige un miembro de paso fundamentación'); return; }
    try {
      await mutate(`${API}/entregables`, 'POST', { requerimiento_id: reqId, kind, titulo, descripcion, member_id: asignacion === 'miembro' ? Number(memberId) : null });
      toast.success(kind === 'ticket' ? 'Ticket creado' : 'Proyecto creado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title="Nuevo entregable (ticket / proyecto)" initialWidth={480} initialHeight={460}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-digi-muted" style={mf}>Se crea real en el módulo correspondiente, contigo como cliente y marcado para paso fundamentación.</p>
        <div className="inline-flex rounded-md border border-digi-border overflow-hidden">
          {(['ticket', 'project'] as const).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`px-3 py-1.5 text-[12px] ${kind === k ? 'bg-accent text-white' : 'text-digi-text hover:bg-black/[0.03]'}`} style={mf}>{k === 'ticket' ? 'Ticket' : 'Proyecto'}</button>
          ))}
        </div>
        <div><label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Título</label><input className={INPUT} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus /></div>
        <div><label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Descripción</label><textarea className={`${INPUT} resize-none`} rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></div>
        <div>
          <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Asignación</label>
          <div className="inline-flex rounded-md border border-digi-border overflow-hidden mb-1.5">
            {(['publico', 'miembro'] as const).map((a) => (
              <button key={a} onClick={() => setAsignacion(a)} className={`px-3 py-1.5 text-[12px] ${asignacion === a ? 'bg-accent text-white' : 'text-digi-text hover:bg-black/[0.03]'}`} style={mf}>{a === 'publico' ? 'Público' : 'Asignar miembro'}</button>
            ))}
          </div>
          {asignacion === 'miembro' && (
            <select className={INPUT} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              <option value="">Miembro de paso fundamentación…</option>
              {miembros.map((m) => <option key={m.id} value={m.id} className="bg-white">{m.name}</option>)}
            </select>
          )}
          {asignacion === 'publico' && <p className="text-[10.5px] text-digi-muted" style={mf}>Queda visible; el primer miembro de paso fundamentación que lo tome lo ejecuta.</p>}
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] text-digi-text border border-digi-border rounded-md hover:border-accent" style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Crear</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
