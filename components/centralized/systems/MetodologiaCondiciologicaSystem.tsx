'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FolderPlus, Pencil, Trash2, Plus, Check, X, FlaskConical, Hexagon, Send, List, ShieldCheck, ClipboardList,
} from 'lucide-react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { METODOLOGIA_PASOS, type MetodologiaPaso } from '@/lib/centralized/condiciologia';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const INPUT = 'w-full px-2.5 py-1.5 bg-white border border-digi-border rounded-md text-[13px] text-digi-text placeholder-digi-muted focus:border-accent focus:outline-none';

type Proyecto = { id: number; name: string; purpose: string; tasks_count: number };
type ReconCodigo = { id: number; nomenclatura: string; texto: string; problematica_ref: string; problematica_name: string };
type Tarea = { id: number; titulo: string; notas: string; estado: string; codigoIds: number[]; piezaId: number | null };
type Peso = { peso_nomenclatura: string; peso_contenido: string; peso_credibilidad: number };
type Premisa = { id: number; nomenclatura: string; contenido: string; credibilidad: number; credibilidad_efectiva: number; pesos: Peso[] };
type Enfrentada = { id: number; nomenclatura: string; texto: string; gano_seq: number; gano_contenido: string; perdio_seq: number; perdio_contenido: string };
type CodigoDetalle = { id: number; nomenclatura: string; texto: string; verificado: boolean; premisas: Premisa[]; enfrentadas: Enfrentada[] };

async function mutate(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Error de servidor');
  return d;
}
const API = '/api/centralized/metodologia';
const GD = '/api/centralized/gestion-datos';

export default function MetodologiaCondiciologicaSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [proyId, setProyId] = useState<number | null>(null);
  const [tab, setTab] = useState<MetodologiaPaso>('reconocer');

  const [codigos, setCodigos] = useState<ReconCodigo[]>([]);
  const [sel, setSel] = useState<number[]>([]);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CodigoDetalle | null>(null);
  const [tareas, setTareas] = useState<Tarea[]>([]);

  const [modal, setModal] = useState<null | 'proyecto' | 'tarea' | 'listas'>(null);
  const [editProy, setEditProy] = useState<Proyecto | null>(null);
  const [confirmProy, setConfirmProy] = useState<Proyecto | null>(null);

  const proy = useMemo(() => proyectos.find((p) => p.id === proyId) || null, [proyectos, proyId]);

  const loadProyectos = useCallback(async () => {
    try { const d = await fetch(`${API}/proyectos`).then((r) => r.json()); setProyectos(d.data || []); } catch { /* noop */ }
  }, []);
  const loadCodigos = useCallback(async () => {
    try { const d = await fetch(`${API}/reconocer`).then((r) => r.json()); setCodigos(d.data || []); } catch { /* noop */ }
  }, []);
  const loadTareas = useCallback(async (id: number | null) => {
    if (!id) { setTareas([]); return; }
    try { const d = await fetch(`${API}/tareas?research_project_id=${id}`).then((r) => r.json()); setTareas(d.data || []); } catch { /* noop */ }
  }, []);

  useEffect(() => { loadProyectos(); loadCodigos(); }, [loadProyectos, loadCodigos]);
  useEffect(() => { loadTareas(proyId); setSel([]); setDetailId(null); }, [proyId, loadTareas]);
  useEffect(() => {
    if (!detailId) { setDetail(null); return; }
    let ok = true;
    fetch(`${API}/codigo?id=${detailId}`).then((r) => r.json()).then((d) => { if (ok) setDetail(d.data || null); }).catch(() => {});
    return () => { ok = false; };
  }, [detailId]);

  // ── Proyectos ───────────────────────────────────────────────────────────────
  const [proyForm, setProyForm] = useState({ name: '', purpose: '' });
  const openProy = (p?: Proyecto) => { setEditProy(p || null); setProyForm(p ? { name: p.name, purpose: p.purpose } : { name: '', purpose: '' }); setModal('proyecto'); };
  const saveProy = async () => {
    if (!proyForm.name.trim()) { toast.error('El nombre es requerido'); return; }
    try {
      if (editProy) { await mutate(`${API}/proyectos`, 'PATCH', { id: editProy.id, ...proyForm }); toast.success('Proyecto actualizado'); }
      else { const d = await mutate(`${API}/proyectos`, 'POST', proyForm); toast.success('Proyecto creado'); setProyId(d.data.id); }
      setModal(null); await loadProyectos();
    } catch (e: any) { toast.error(e.message); }
  };
  const delProy = async (p: Proyecto) => {
    try { await mutate(`${API}/proyectos`, 'DELETE', { id: p.id }); toast.success('Proyecto eliminado'); if (proyId === p.id) setProyId(null); await loadProyectos(); }
    catch (e: any) { toast.error(e.message); }
  };

  // ── Generar tarea ─────────────────────────────────────────────────────────
  const [tareaForm, setTareaForm] = useState({ titulo: '', notas: '' });
  const openTarea = () => {
    if (!sel.length) { toast.error('Selecciona al menos un código'); return; }
    setTareaForm({ titulo: '', notas: '' }); setModal('tarea');
  };
  const saveTarea = async () => {
    if (!tareaForm.titulo.trim()) { toast.error('El título es requerido'); return; }
    try {
      await mutate(`${API}/tareas`, 'POST', { research_project_id: proyId, titulo: tareaForm.titulo, notas: tareaForm.notas, codigo_ids: sel });
      toast.success('Tarea generada — pieza creada (incompleta) en Gestión de Datos');
      setModal(null); setSel([]); await loadTareas(proyId);
    } catch (e: any) { toast.error(e.message); }
  };
  const delTarea = async (id: number) => {
    try { await mutate(`${API}/tareas`, 'DELETE', { id }); await loadTareas(proyId); } catch (e: any) { toast.error(e.message); }
  };

  const toggle = (id: number) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  // Agrupa códigos por problemática.
  const grupos = useMemo(() => {
    const m = new Map<string, ReconCodigo[]>();
    for (const c of codigos) { const k = c.problematica_ref; if (!m.has(k)) m.set(k, []); m.get(k)!.push(c); }
    return Array.from(m.entries());
  }, [codigos]);

  return (
    <div className="flex gap-4 h-[calc(100dvh-130px)]">
      {/* ── Panel izquierdo: Proyectos de investigación ── */}
      <aside className="w-[260px] shrink-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FlaskConical className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold text-digi-text" style={df}>Proyectos de investigación</span>
          </div>
          <span className="text-[11px] text-digi-muted" style={mf}>{proyectos.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {proyectos.length === 0 && <p className="text-[12px] text-digi-muted px-2 py-4 text-center" style={mf}>Crea el primer proyecto de investigación.</p>}
          {proyectos.map((p) => (
            <div key={p.id} onClick={() => setProyId(p.id)} className={`group px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${proyId === p.id ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}>
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium text-digi-text truncate flex-1" style={mf}>{p.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); openProy(p); }} className="p-1 text-digi-muted hover:text-accent"><Pencil className="w-3 h-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmProy(p); }} className="p-1 text-digi-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              {p.purpose && <p className="text-[10.5px] text-digi-muted mt-0.5 line-clamp-2" style={mf}>{p.purpose}</p>}
              <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>{p.tasks_count} tareas</p>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-digi-border space-y-1.5">
          <button onClick={() => openProy()} className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md py-2 transition-colors" style={mf}>
            <FolderPlus className="w-3.5 h-3.5" /> Nuevo proyecto
          </button>
          <button onClick={() => setModal('listas')} className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] text-digi-text border border-digi-border rounded-md py-1.5 hover:border-accent hover:text-accent transition-colors" style={mf}>
            <List className="w-3.5 h-3.5" /> Listas globales
          </button>
        </div>
      </aside>

      {/* ── Centro: pestañas de la metodología ── */}
      <div className="flex-1 min-w-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {!proy ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3"><FlaskConical className="w-6 h-6 text-accent" /></div>
              <p className="text-sm font-medium text-digi-text" style={df}>Selecciona o crea un proyecto de investigación</p>
              <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>Cada proyecto tiene una finalidad productiva. Desde sus 6 pasos leerás los códigos verificados y generarás tareas para obtener piezas.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cabecera + pestañas */}
            <div className="px-3 pt-2.5 border-b border-digi-border">
              <div className="flex items-center gap-2 mb-2">
                <FlaskConical className="w-4 h-4 text-accent" />
                <span className="text-[13px] font-semibold text-digi-text truncate" style={df}>{proy.name}</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto">
                {METODOLOGIA_PASOS.map((p) => (
                  <button key={p.key} onClick={() => setTab(p.key)} className={`px-3 py-1.5 text-[12px] font-medium rounded-t-md whitespace-nowrap transition-colors border-b-2 ${tab === p.key ? 'border-accent text-accent' : 'border-transparent text-digi-muted hover:text-digi-text'}`} style={mf}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {tab === 'reconocer' ? (
              <div className="flex-1 min-h-0 flex">
                {/* Lista de códigos verificados */}
                <div className="w-[280px] shrink-0 border-r border-digi-border flex flex-col">
                  <div className="px-3 py-2 border-b border-digi-border flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-digi-text" style={df}>Códigos verificados</span>
                    <span className="text-[10.5px] text-digi-muted" style={mf}>{sel.length} sel.</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-1.5">
                    {codigos.length === 0 && <p className="text-[11px] text-digi-muted px-2 py-4 text-center" style={mf}>No hay códigos verificados aún (créalos y verifícalos en Gestión de Datos).</p>}
                    {grupos.map(([ref, list]) => (
                      <div key={ref} className="mb-2">
                        <p className="text-[9.5px] uppercase tracking-wide text-digi-muted px-1.5 mb-1" style={df}>{ref}</p>
                        {list.map((c) => (
                          <div key={c.id} className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer ${detailId === c.id ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`} onClick={() => setDetailId(c.id)}>
                            <button onClick={(e) => { e.stopPropagation(); toggle(c.id); }} className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel.includes(c.id) ? 'bg-accent border-accent' : 'border-digi-border'}`}>{sel.includes(c.id) && <Check className="w-2.5 h-2.5 text-white" />}</button>
                            <Hexagon className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="text-[11.5px] text-digi-text truncate font-mono" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{c.nomenclatura}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="p-2 border-t border-digi-border">
                    <button onClick={openTarea} disabled={!sel.length} className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed rounded-md py-2 transition-colors" style={mf}>
                      <Send className="w-3.5 h-3.5" /> Generar tarea ({sel.length})
                    </button>
                  </div>
                </div>

                {/* Detalle del código + tareas del proyecto */}
                <div className="flex-1 min-w-0 overflow-y-auto p-3">
                  {detail ? (
                    <CodigoDetalleView detail={detail} />
                  ) : (
                    <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Selecciona un código para ver su detalle (premisas, pesos y enfrentamientos).</p>
                  )}

                  {/* Tareas generadas del proyecto */}
                  <div className="mt-5 pt-3 border-t border-digi-border">
                    <div className="flex items-center gap-1.5 mb-2">
                      <ClipboardList className="w-3.5 h-3.5 text-digi-muted" />
                      <span className="text-[11px] font-semibold text-digi-text" style={df}>Tareas generadas ({tareas.length})</span>
                      <span className="text-[10px] text-digi-muted ml-1" style={mf}>→ van a Gestión de Condiciones</span>
                    </div>
                    <div className="space-y-1">
                      {tareas.length === 0 && <p className="text-[11px] text-digi-muted" style={mf}>Aún no generaste tareas para este proyecto.</p>}
                      {tareas.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-[11.5px] bg-black/[0.02] border border-digi-border rounded-md px-2.5 py-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.estado === 'completada' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <span className="text-digi-text font-medium truncate flex-1" style={mf}>{t.titulo}</span>
                          <span className="text-[10px] text-digi-muted" style={mf}>{t.codigoIds.length} códigos</span>
                          <button onClick={() => delTarea(t.id)} className="text-digi-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[12px] text-digi-muted text-center max-w-sm px-6" style={mf}>
                  El paso <b className="text-digi-text">{METODOLOGIA_PASOS.find((p) => p.key === tab)?.label}</b> se definirá a continuación. Por ahora está desarrollado el paso <b className="text-accent">Reconocer</b>.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal: Proyecto ── */}
      {modal === 'proyecto' && (
        <FloatingWindow open onClose={() => setModal(null)} title={editProy ? 'Editar proyecto' : 'Nuevo proyecto de investigación'} initialWidth={480} initialHeight={400}>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Nombre</label>
              <input className={INPUT} value={proyForm.name} onChange={(e) => setProyForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej. Deserción escolar en zonas rurales" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Finalidad productiva</label>
              <textarea className={`${INPUT} resize-none`} rows={4} value={proyForm.purpose} onChange={(e) => setProyForm((f) => ({ ...f, purpose: e.target.value }))} placeholder="¿Cuál es el resultado/salida productiva de esta investigación? (p. ej. un plan, un edificio, una infraestructura…)" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 text-[12px] text-digi-text border border-digi-border rounded-md hover:border-accent" style={mf}>Cancelar</button>
              <button onClick={saveProy} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{editProy ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* ── Modal: Generar tarea ── */}
      {modal === 'tarea' && (
        <FloatingWindow open onClose={() => setModal(null)} title="Generar tarea" initialWidth={480} initialHeight={420}>
          <div className="p-4 space-y-3">
            <p className="text-[11.5px] text-digi-muted" style={mf}>Se creará una tarea con <b className="text-digi-text">{sel.length} código(s)</b> asociada al proyecto <b className="text-digi-text">{proy?.name}</b>. Irá a Gestión de Condiciones y se pre-creará una pieza (incompleta) en Gestión de Datos.</p>
            <div>
              <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Título</label>
              <input className={INPUT} value={tareaForm.titulo} onChange={(e) => setTareaForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ej. Investigar condiciones del código COD-NROF-1/23" autoFocus />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Notas / observaciones</label>
              <textarea className={`${INPUT} resize-none`} rows={4} value={tareaForm.notas} onChange={(e) => setTareaForm((f) => ({ ...f, notas: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className="px-3 py-1.5 text-[12px] text-digi-text border border-digi-border rounded-md hover:border-accent" style={mf}>Cancelar</button>
              <button onClick={saveTarea} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Generar</button>
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* ── Modal: Listas globales ── */}
      {modal === 'listas' && <ListasModal onClose={() => setModal(null)} />}

      <PixelConfirm
        open={!!confirmProy}
        title="Eliminar proyecto"
        message={confirmProy ? `¿Eliminar "${confirmProy.name}" y sus tareas? No se puede deshacer.` : ''}
        confirmLabel="Eliminar" danger
        onConfirm={() => { if (confirmProy) delProy(confirmProy); setConfirmProy(null); }}
        onCancel={() => setConfirmProy(null)}
      />
    </div>
  );
}

// ── Detalle de un código (Reconocer) ──────────────────────────────────────────
function CodigoDetalleView({ detail }: { detail: CodigoDetalle }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Hexagon className="w-4 h-4 text-emerald-500" />
        <span className="text-[14px] font-semibold text-digi-text font-mono" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{detail.nomenclatura}</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5"><ShieldCheck className="w-3 h-3" /> Verificado</span>
      </div>
      {detail.texto && <p className="text-[12.5px] text-digi-text leading-relaxed mb-3" style={mf}>{detail.texto}</p>}

      <p className="text-[11px] font-semibold text-digi-text mb-1.5" style={df}>Premisas asociadas ({detail.premisas.length})</p>
      <div className="space-y-2 mb-3">
        {detail.premisas.map((p) => (
          <div key={p.id} className="border border-digi-border rounded-md p-2">
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] font-bold text-cyan-600 font-mono" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{p.nomenclatura}</span>
              <span className="text-[10.5px] text-digi-muted ml-auto tabular-nums" style={mf}>{Math.round(p.credibilidad_efectiva)}%</span>
            </div>
            <p className="text-[11.5px] text-digi-text mt-1 leading-snug" style={mf}>{p.contenido}</p>
            {p.pesos.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {p.pesos.map((w, i) => (
                  <span key={i} className="group relative inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 cursor-default font-mono" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
                    {w.peso_nomenclatura}
                    <span className="pointer-events-none absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 w-48 p-2 rounded-md bg-digi-text text-white text-[10.5px] leading-snug shadow-lg" style={mf}>
                      <b>{w.peso_nomenclatura}</b> ({Math.round(w.peso_credibilidad)}%)<br />{w.peso_contenido}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {detail.enfrentadas.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-digi-text mb-1.5" style={df}>Premisas de enfrentamiento ({detail.enfrentadas.length})</p>
          <div className="space-y-2">
            {detail.enfrentadas.map((e) => (
              <div key={e.id} className="border border-digi-border rounded-md p-2">
                <span className="text-[11.5px] font-bold text-purple-600 font-mono" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{e.nomenclatura}</span>
                {e.texto && <p className="text-[11.5px] text-digi-text mt-1 leading-snug" style={mf}>{e.texto}</p>}
                <p className="text-[10.5px] text-digi-muted mt-1" style={mf}>Ganó #{e.gano_seq}: {e.gano_contenido}</p>
                <p className="text-[10.5px] text-digi-muted" style={mf}>Perdió #{e.perdio_seq}: {e.perdio_contenido}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Listas globales (situaciones + materias) — espacio ÚNICO de edición ───────
function ListasModal({ onClose }: { onClose: () => void }) {
  return (
    <FloatingWindow open onClose={onClose} title="Listas globales" initialWidth={480} initialHeight={560}>
      <div className="p-4 space-y-4">
        <p className="text-[11.5px] text-digi-muted" style={mf}>Espacio único de edición de las listas globales del sistema. Las <b>situaciones</b> clasifican rompecabezas; las <b>materias</b> se asocian a los temas (Gestión de Datos).</p>
        <EditableList title="Situaciones" endpoint="situaciones" />
        <EditableList title="Materias" endpoint="materias" />
        <p className="text-[10.5px] text-digi-muted italic" style={mf}>Talentos y valores se migrarán aquí más adelante (hoy son listas fijas del sistema).</p>
      </div>
    </FloatingWindow>
  );
}

function EditableList({ title, endpoint }: { title: string; endpoint: string }) {
  const [items, setItems] = useState<{ id: number; nombre: string }[]>([]);
  const [nuevo, setNuevo] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState('');
  const load = useCallback(async () => {
    try { const d = await fetch(`${GD}/${endpoint}`).then((r) => r.json()); setItems(d.data || []); } catch { /* noop */ }
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const add = async () => { if (!nuevo.trim()) return; try { await mutate(`${GD}/${endpoint}`, 'POST', { nombre: nuevo }); setNuevo(''); await load(); } catch (e: any) { toast.error(e.message); } };
  const saveEdit = async () => { if (editId == null) return; try { await mutate(`${GD}/${endpoint}`, 'PATCH', { id: editId, nombre: editVal }); setEditId(null); await load(); } catch (e: any) { toast.error(e.message); } };
  const del = async (id: number) => { try { await mutate(`${GD}/${endpoint}`, 'DELETE', { id }); await load(); } catch (e: any) { toast.error(e.message); } };

  return (
    <div>
      <p className="text-[11px] font-semibold text-digi-text mb-1.5" style={df}>{title} ({items.length})</p>
      <div className="space-y-1 mb-2 max-h-40 overflow-y-auto">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-2 text-[11.5px] bg-black/[0.02] border border-digi-border rounded px-2 py-1">
            {editId === it.id ? (
              <>
                <input className={`${INPUT} flex-1 py-0.5`} value={editVal} autoFocus onChange={(e) => setEditVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null); }} />
                <button onClick={saveEdit} className="text-emerald-600 hover:text-emerald-500"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditId(null)} className="text-digi-muted hover:text-digi-text"><X className="w-3.5 h-3.5" /></button>
              </>
            ) : (
              <>
                <span className="text-digi-text flex-1 truncate" style={mf}>{it.nombre}</span>
                <button onClick={() => { setEditId(it.id); setEditVal(it.nombre); }} className="text-digi-muted hover:text-accent"><Pencil className="w-3 h-3" /></button>
                <button onClick={() => del(it.id)} className="text-digi-muted hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
              </>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-[11px] text-digi-muted" style={mf}>Vacío.</p>}
      </div>
      <div className="flex gap-1.5">
        <input className={`${INPUT} flex-1`} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} placeholder={`Nueva ${title.slice(0, -2).toLowerCase()}…`} />
        <button onClick={add} className="px-2 py-1.5 border border-digi-border rounded-md text-digi-text hover:border-accent hover:text-accent" title="Agregar"><Plus className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
