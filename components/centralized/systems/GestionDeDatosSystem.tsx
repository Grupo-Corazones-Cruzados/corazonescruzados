'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  FolderPlus, Pencil, Trash2, Plus, Database, GitCompareArrows, Hexagon,
  Star, AlertTriangle, Check, X, ExternalLink, ShieldCheck, Weight,
} from 'lucide-react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelConfirm from '@/components/ui/PixelConfirm';
import GdGraph, { type GdLegendFilter } from '@/components/centralized/gestion-datos/GdGraph';
import {
  GD_NODE_META, TIPO_DATO_LABEL, TIPO_LOGICA_LABEL, PESO_MODO_LABEL,
  type GdGraph as GdGraphT, type GdGraphNode, type GdNodeType, type TipoDato, type TipoLogica, type PesoModo,
} from '@/lib/centralized/gestion-datos';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const GLASS = 'rounded-xl bg-black/40 backdrop-blur-md border border-white/12 shadow-lg';
const GLASS_BTN = 'inline-flex items-center justify-center gap-1.5 border border-white/15 bg-white/[0.08] hover:bg-white/[0.18] text-white/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const GLASS_INPUT = 'w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-[13px] text-white placeholder-white/40 focus:border-accent focus:outline-none';

type Problematica = { id: number; name: string; ref: string; description: string; fuentes_count: number; codigos_count: number };
type Fuente = { id: number; tipo_dato: TipoDato; tipo_logica: TipoLogica; contenido: string; credibilidad: number; credibilidad_efectiva: number; seq: number; nomenclatura: string };
type Problema = { id: number; title: string; description: string };
type Enfrentamiento = { id: number; texto: string; nomenclatura: string; gano_seq: number; perdio_seq: number; gano_contenido: string; perdio_contenido: string };
type Evento = { id: number; titulo: string; url: string };
type Codigo = { id: number; texto: string; verificado: boolean; nomenclatura: string; unidades: any[]; eventos: Evento[] };
type Categoria = { id: number; seq: number; nombre: string; nomenclatura: string; codigos: { id: number; nomenclatura: string; verificado: boolean }[] };

async function mutate(url: string, method: string, body?: any) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Error de servidor');
  return d;
}

const API = '/api/centralized/gestion-datos';

export default function GestionDeDatosSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [problematicas, setProblematicas] = useState<Problematica[]>([]);
  const [probId, setProbId] = useState<number | null>(null);
  const [graph, setGraph] = useState<GdGraphT>({ nodes: [], edges: [] });
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [enfrentamientos, setEnfrentamientos] = useState<Enfrentamiento[]>([]);
  const [codigos, setCodigos] = useState<Codigo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Panel de creación rápida (fuente/problema) en el panel flotante.
  const [creating, setCreating] = useState<null | 'fuente' | 'problema'>(null);
  // Modales complejos (necesitan pickers).
  const [modal, setModal] = useState<null | 'enfrentamiento' | 'codigo' | 'categoria' | 'problematica'>(null);

  // Filtro de leyenda.
  const [pinFilter, setPinFilter] = useState<GdLegendFilter>(null);
  const [hoverFilter, setHoverFilter] = useState<GdLegendFilter>(null);
  const legendFilter = hoverFilter ?? pinFilter;

  // Confirmaciones.
  const [confirmNode, setConfirmNode] = useState<GdGraphNode | null>(null);
  const [confirmProb, setConfirmProb] = useState<Problematica | null>(null);

  const prob = useMemo(() => problematicas.find((p) => p.id === probId) || null, [problematicas, probId]);
  const selectedNode = useMemo(() => graph.nodes.find((n) => n.key === selectedKey) || null, [graph, selectedKey]);

  const loadProblematicas = useCallback(async () => {
    try {
      const res = await fetch(`${API}/problematicas`);
      const d = await res.json();
      setProblematicas(d.data || []);
    } catch { /* noop */ }
  }, []);

  const loadAll = useCallback(async (id: number | null) => {
    if (!id) {
      setGraph({ nodes: [], edges: [] });
      setFuentes([]); setProblemas([]); setEnfrentamientos([]); setCodigos([]); setCategorias([]);
      return;
    }
    try {
      const [g, f, p, e, c, cat] = await Promise.all([
        fetch(`${API}?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/fuentes?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/problemas?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/enfrentamientos?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/codigos?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/categorias?problematica_id=${id}`).then((r) => r.json()),
      ]);
      setGraph(g.data || { nodes: [], edges: [] });
      setFuentes(f.data || []); setProblemas(p.data || []); setEnfrentamientos(e.data || []);
      setCodigos(c.data || []); setCategorias(cat.data || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadProblematicas(); }, [loadProblematicas]);
  useEffect(() => { loadAll(probId); setSelectedKey(null); setCreating(null); }, [probId, loadAll]);

  const reload = useCallback(() => loadAll(probId), [loadAll, probId]);

  // ── Problemáticas ───────────────────────────────────────────────────────────
  const [probForm, setProbForm] = useState({ name: '', ref: '', description: '' });
  const [editingProb, setEditingProb] = useState<Problematica | null>(null);

  const openProbModal = (p?: Problematica) => {
    setEditingProb(p || null);
    setProbForm(p ? { name: p.name, ref: p.ref, description: p.description } : { name: '', ref: '', description: '' });
    setModal('problematica');
  };
  const saveProblematica = async () => {
    if (!probForm.name.trim() || !probForm.ref.trim()) { toast.error('Nombre y referencia son requeridos'); return; }
    try {
      if (editingProb) {
        await mutate(`${API}/problematicas`, 'PATCH', { id: editingProb.id, ...probForm });
        toast.success('Problemática actualizada');
      } else {
        const d = await mutate(`${API}/problematicas`, 'POST', probForm);
        toast.success('Problemática creada');
        setProbId(d.data.id);
      }
      setModal(null);
      await loadProblematicas();
    } catch (e: any) { toast.error(e.message); }
  };
  const deleteProblematica = async (p: Problematica) => {
    try {
      await mutate(`${API}/problematicas`, 'DELETE', { id: p.id });
      toast.success('Problemática eliminada');
      if (probId === p.id) setProbId(null);
      await loadProblematicas();
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Crear fuente / problema (panel) ─────────────────────────────────────────
  const [fuenteForm, setFuenteForm] = useState<{ id?: number; tipo_dato: TipoDato; tipo_logica: TipoLogica; contenido: string; credibilidad: number }>(
    { tipo_dato: 'cantidad', tipo_logica: 'premisa', contenido: '', credibilidad: 50 },
  );
  const [problemaForm, setProblemaForm] = useState<{ id?: number; title: string; description: string }>({ title: '', description: '' });

  const openFuente = (f?: Fuente) => {
    setSelectedKey(null);
    setFuenteForm(f ? { id: f.id, tipo_dato: f.tipo_dato, tipo_logica: f.tipo_logica, contenido: f.contenido, credibilidad: f.credibilidad } : { tipo_dato: 'cantidad', tipo_logica: 'premisa', contenido: '', credibilidad: 50 });
    setCreating('fuente');
  };
  const saveFuente = async () => {
    if (!fuenteForm.contenido.trim()) { toast.error('El contenido es requerido'); return; }
    try {
      if (fuenteForm.id) {
        await mutate(`${API}/fuentes`, 'PATCH', { id: fuenteForm.id, contenido: fuenteForm.contenido, credibilidad: fuenteForm.credibilidad });
        toast.success('Fuente actualizada');
      } else {
        await mutate(`${API}/fuentes`, 'POST', { problematica_id: probId, ...fuenteForm });
        toast.success('Fuente agregada');
      }
      setCreating(null);
      await reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const openProblema = (p?: Problema) => {
    setSelectedKey(null);
    setProblemaForm(p ? { id: p.id, title: p.title, description: p.description } : { title: '', description: '' });
    setCreating('problema');
  };
  const saveProblema = async () => {
    if (!problemaForm.title.trim()) { toast.error('El título es requerido'); return; }
    try {
      if (problemaForm.id) {
        await mutate(`${API}/problemas`, 'PATCH', { id: problemaForm.id, title: problemaForm.title, description: problemaForm.description });
        toast.success('Problema actualizado');
      } else {
        await mutate(`${API}/problemas`, 'POST', { problematica_id: probId, ...problemaForm });
        toast.success('Problema agregado');
      }
      setCreating(null);
      await reload();
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Eliminar nodo ───────────────────────────────────────────────────────────
  const deleteNode = async (n: GdGraphNode) => {
    const routeByType: Record<GdNodeType, string> = {
      problema: 'problemas', fuente_premisa: 'fuentes', fuente_peso: 'fuentes',
      enfrentamiento: 'enfrentamientos', codigo: 'codigos', categoria: 'categorias',
    };
    try {
      await mutate(`${API}/${routeByType[n.type]}`, 'DELETE', { id: n.id });
      toast.success(`${GD_NODE_META[n.type].label} eliminado`);
      setSelectedKey(null);
      await reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const premisas = useMemo(() => fuentes.filter((f) => f.tipo_logica === 'premisa'), [fuentes]);
  const pesos = useMemo(() => fuentes.filter((f) => f.tipo_logica === 'peso'), [fuentes]);
  const codigosVerificados = useMemo(() => codigos.filter((c) => c.verificado), [codigos]);

  // ── Leyenda ─────────────────────────────────────────────────────────────────
  const isPinned = (f: NonNullable<GdLegendFilter>) => pinFilter?.kind === f.kind && pinFilter?.value === f.value;
  const togglePin = (f: NonNullable<GdLegendFilter>) => setPinFilter((p) => (p && p.kind === f.kind && p.value === f.value ? null : f));

  const legendTypes: { type: GdNodeType }[] = [
    { type: 'problema' }, { type: 'fuente_premisa' }, { type: 'fuente_peso' },
    { type: 'enfrentamiento' }, { type: 'codigo' }, { type: 'categoria' },
  ];

  return (
    <div className="flex gap-4 h-[calc(100dvh-130px)]">
      {/* ── Panel izquierdo: Problemáticas ── */}
      <aside className="w-[248px] shrink-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold text-digi-text" style={df}>Problemáticas</span>
          </div>
          <span className="text-[11px] text-digi-muted" style={mf}>{problematicas.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {problematicas.length === 0 && (
            <p className="text-[12px] text-digi-muted px-2 py-4 text-center" style={mf}>Crea la primera problemática para empezar.</p>
          )}
          {problematicas.map((p) => (
            <div
              key={p.id}
              onClick={() => setProbId(p.id)}
              className={`group px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${probId === p.id ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent shrink-0" style={df}>{p.ref}</span>
                <span className="text-[12.5px] font-medium text-digi-text truncate flex-1" style={mf}>{p.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); openProbModal(p); }} className="p-1 text-digi-muted hover:text-accent" title="Editar"><Pencil className="w-3 h-3" /></button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmProb(p); }} className="p-1 text-digi-muted hover:text-red-500" title="Eliminar"><Trash2 className="w-3 h-3" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 pl-0.5">
                <span className="text-[10.5px] text-digi-muted" style={mf}>{p.fuentes_count} fuentes · {p.codigos_count} códigos</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-digi-border">
          <button onClick={() => openProbModal()} className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md py-2 transition-colors" style={mf}>
            <FolderPlus className="w-3.5 h-3.5" /> Nueva problemática
          </button>
        </div>
      </aside>

      {/* ── Centro: grafo + toolbar ── */}
      <div className="flex-1 min-w-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {!prob ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-3">
                <Database className="w-6 h-6 text-accent" />
              </div>
              <p className="text-sm font-medium text-digi-text" style={df}>Selecciona o crea una problemática</p>
              <p className="text-[12px] text-digi-muted mt-1 max-w-sm mx-auto" style={mf}>
                Cada problemática es una carpeta con su referencia (≤4 letras). Dentro registras fuentes y problemas, y desarrollas la clasificación condiciológica.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="px-3 py-2 border-b border-digi-border flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent" style={df}>{prob.ref}</span>
              <span className="text-[13px] font-semibold text-digi-text truncate" style={df}>{prob.name}</span>
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <ToolBtn icon={<Database className="w-3.5 h-3.5" />} label="Fuente" color={GD_NODE_META.fuente_premisa.color} onClick={() => openFuente()} />
                <ToolBtn icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Problema" color={GD_NODE_META.problema.color} onClick={() => openProblema()} />
                <ToolBtn icon={<GitCompareArrows className="w-3.5 h-3.5" />} label="Enfrentar" color={GD_NODE_META.enfrentamiento.color} onClick={() => setModal('enfrentamiento')} disabled={premisas.length < 2} />
                <ToolBtn icon={<Hexagon className="w-3.5 h-3.5" />} label="Código" color={GD_NODE_META.codigo.color} onClick={() => setModal('codigo')} disabled={premisas.length + enfrentamientos.length < 1} />
                <ToolBtn icon={<Star className="w-3.5 h-3.5" />} label="Categoría" color={GD_NODE_META.categoria.color} onClick={() => setModal('categoria')} disabled={codigosVerificados.length < 1} />
              </div>
            </div>

            {/* Grafo */}
            <div className="relative flex-1 min-h-0">
              <GdGraph
                nodes={graph.nodes}
                edges={graph.edges}
                selectedKey={selectedKey}
                filter={legendFilter}
                fitSignal={String(probId)}
                onSelect={(n) => { setSelectedKey(n?.key ?? null); setCreating(null); }}
              />

              {/* Leyenda-filtro */}
              <div className={`absolute top-2.5 left-2.5 z-10 ${GLASS} p-2 max-w-[190px]`}>
                <p className="text-[9.5px] uppercase tracking-wide text-white/50 mb-1.5 px-0.5" style={df}>Tipos</p>
                <div className="grid grid-cols-1 gap-0.5">
                  {legendTypes.map(({ type }) => {
                    const f = { kind: 'type' as const, value: type };
                    return (
                      <button
                        key={type}
                        onMouseEnter={() => setHoverFilter(f)}
                        onMouseLeave={() => setHoverFilter(null)}
                        onClick={() => togglePin(f)}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-colors ${isPinned(f) ? 'bg-white/20' : 'hover:bg-white/10'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: GD_NODE_META[type].color }} />
                        <span className="text-[11px] text-white/85" style={mf}>{GD_NODE_META[type].plural}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[9.5px] uppercase tracking-wide text-white/50 mt-2 mb-1.5 px-0.5" style={df}>Códigos</p>
                <div className="grid grid-cols-1 gap-0.5">
                  {[{ value: 'verificado', label: 'Verificados' }, { value: 'no_verificado', label: 'No verificados' }].map((it) => {
                    const f = { kind: 'state' as const, value: it.value };
                    return (
                      <button
                        key={it.value}
                        onMouseEnter={() => setHoverFilter(f)}
                        onMouseLeave={() => setHoverFilter(null)}
                        onClick={() => togglePin(f)}
                        className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-colors ${isPinned(f) ? 'bg-white/20' : 'hover:bg-white/10'}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: it.value === 'verificado' ? '#34d399' : '#6b7280' }} />
                        <span className="text-[11px] text-white/85" style={mf}>{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Panel flotante de detalle / creación */}
              {(creating || selectedNode) && (
                <aside className={`absolute bottom-3 right-3 w-[352px] max-h-[calc(100%-24px)] overflow-y-auto ${GLASS} p-3`}>
                  {creating === 'fuente' ? (
                    <FuenteForm form={fuenteForm} setForm={setFuenteForm} onCancel={() => setCreating(null)} onSave={saveFuente} />
                  ) : creating === 'problema' ? (
                    <ProblemaForm form={problemaForm} setForm={setProblemaForm} onCancel={() => setCreating(null)} onSave={saveProblema} />
                  ) : selectedNode ? (
                    <NodeDetail
                      node={selectedNode}
                      fuentes={fuentes}
                      pesos={pesos}
                      enfrentamientos={enfrentamientos}
                      codigos={codigos}
                      categorias={categorias}
                      problemas={problemas}
                      onEditFuente={openFuente}
                      onEditProblema={openProblema}
                      onReload={reload}
                      onDelete={() => setConfirmNode(selectedNode)}
                      onClose={() => setSelectedKey(null)}
                    />
                  ) : null}
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: Problemática ── */}
      {modal === 'problematica' && (
        <FloatingWindow open onClose={() => setModal(null)} title={editingProb ? 'Editar problemática' : 'Nueva problemática'} initialWidth={460} initialHeight={420}>
          <div className="p-4 space-y-3">
            <Field label="Nombre">
              <input className={GLASS_INPUT} value={probForm.name} onChange={(e) => setProbForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ej. Desempleo y desesperación" autoFocus />
            </Field>
            <Field label="Referencia (≤4 letras)">
              <input className={`${GLASS_INPUT} uppercase`} value={probForm.ref} maxLength={4} onChange={(e) => setProbForm((f) => ({ ...f, ref: e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) }))} placeholder="NROF" />
              <p className="text-[10.5px] text-white/45 mt-1" style={mf}>Cada fuente premisa será {probForm.ref || 'REF'}-1, {probForm.ref || 'REF'}-2… y los códigos COD-{probForm.ref || 'REF'}-1/2.</p>
            </Field>
            <Field label="Descripción (opcional)">
              <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={probForm.description} onChange={(e) => setProbForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setModal(null)} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
              <button onClick={saveProblematica} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{editingProb ? 'Guardar' : 'Crear'}</button>
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* ── Modal: Enfrentamiento ── */}
      {modal === 'enfrentamiento' && (
        <EnfrentamientoModal probId={probId!} premisas={premisas} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await reload(); }} />
      )}
      {/* ── Modal: Código ── */}
      {modal === 'codigo' && (
        <CodigoModal probId={probId!} premisas={premisas} enfrentamientos={enfrentamientos} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await reload(); }} />
      )}
      {/* ── Modal: Categoría ── */}
      {modal === 'categoria' && (
        <CategoriaModal probId={probId!} codigosVerificados={codigosVerificados} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await reload(); }} />
      )}

      <PixelConfirm
        open={!!confirmNode}
        title="Eliminar elemento"
        message={confirmNode ? `¿Eliminar ${GD_NODE_META[confirmNode.type].label.toLowerCase()} "${confirmNode.title}"? Esta acción no se puede deshacer y elimina lo que dependa de él.` : ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { if (confirmNode) deleteNode(confirmNode); setConfirmNode(null); }}
        onCancel={() => setConfirmNode(null)}
      />
      <PixelConfirm
        open={!!confirmProb}
        title="Eliminar problemática"
        message={confirmProb ? `¿Eliminar "${confirmProb.name}" y TODO su contenido (fuentes, códigos, categorías…)? No se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { if (confirmProb) deleteProblematica(confirmProb); setConfirmProb(null); }}
        onCancel={() => setConfirmProb(null)}
      />
    </div>
  );
}

// ── Subcomponentes ──────────────────────────────────────────────────────────
function ToolBtn({ icon, label, color, onClick, disabled }: { icon: React.ReactNode; label: string; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded-md px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-digi-border disabled:hover:text-digi-text"
      style={mf}
      title={disabled ? 'Requiere elementos previos' : label}
    >
      <span style={{ color }}>{icon}</span> {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-white/70 mb-1" style={mf}>{label}</label>
      {children}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-md border border-white/15 overflow-hidden">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 text-[12px] transition-colors ${value === o.value ? 'bg-accent text-white' : 'bg-white/[0.04] text-white/70 hover:bg-white/10'}`}
          style={mf}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CredSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[#22d3ee]" />
      <span className="text-[13px] font-semibold text-white w-10 text-right tabular-nums" style={mf}>{value}%</span>
    </div>
  );
}

function FuenteForm({ form, setForm, onCancel, onSave }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white" style={df}>{form.id ? 'Editar fuente' : 'Nueva fuente'}</h3>
        <button onClick={onCancel} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      {!form.id && (
        <>
          <Field label="Tipo de dato">
            <Segmented value={form.tipo_dato} onChange={(v: TipoDato) => setForm((f: any) => ({ ...f, tipo_dato: v }))} options={[{ value: 'cantidad', label: TIPO_DATO_LABEL.cantidad }, { value: 'cualidad', label: TIPO_DATO_LABEL.cualidad }]} />
          </Field>
          <Field label="Tipo de lógica">
            <Segmented value={form.tipo_logica} onChange={(v: TipoLogica) => setForm((f: any) => ({ ...f, tipo_logica: v }))} options={[{ value: 'premisa', label: TIPO_LOGICA_LABEL.premisa }, { value: 'peso', label: TIPO_LOGICA_LABEL.peso }]} />
            <p className="text-[10.5px] text-white/45 mt-1" style={mf}>{form.tipo_logica === 'premisa' ? 'Premisa: aporta a una verdad lógica (se codifica REF-n).' : 'Peso: altera la credibilidad de una premisa (Ref-n global).'}</p>
          </Field>
        </>
      )}
      <Field label="Contenido (la verdad que dice la fuente)">
        <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={form.contenido} onChange={(e) => setForm((f: any) => ({ ...f, contenido: e.target.value }))} placeholder="Ej. 30 de cada 100 niños ingresan a una escuela particular." autoFocus />
      </Field>
      <Field label="Nivel de confianza / credibilidad">
        <CredSlider value={form.credibilidad} onChange={(v) => setForm((f: any) => ({ ...f, credibilidad: v }))} />
      </Field>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
        <button onClick={onSave} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{form.id ? 'Guardar' : 'Agregar'}</button>
      </div>
    </div>
  );
}

function ProblemaForm({ form, setForm, onCancel, onSave }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white" style={df}>{form.id ? 'Editar problema' : 'Nuevo problema'}</h3>
        <button onClick={onCancel} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <Field label="Título del problema">
        <input className={GLASS_INPUT} value={form.title} onChange={(e) => setForm((f: any) => ({ ...f, title: e.target.value }))} placeholder="Ej. Deserción escolar temprana" autoFocus />
      </Field>
      <Field label="Descripción (opcional)">
        <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={form.description} onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))} />
      </Field>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
        <button onClick={onSave} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{form.id ? 'Guardar' : 'Agregar'}</button>
      </div>
    </div>
  );
}

// Detalle del nodo seleccionado (por tipo).
function NodeDetail({ node, fuentes, pesos, enfrentamientos, codigos, categorias, problemas, onEditFuente, onEditProblema, onReload, onDelete, onClose }: any) {
  const meta = GD_NODE_META[node.type as GdNodeType];
  const header = (
    <div className="flex items-start justify-between gap-2 mb-2">
      <div className="min-w-0">
        <span className="text-[9.5px] uppercase tracking-wide font-bold" style={{ ...df, color: meta.color }}>{meta.label}</span>
        <p className="text-[13.5px] font-semibold text-white leading-tight break-words" style={df}>{node.title}</p>
      </div>
      <button onClick={onClose} className="text-white/50 hover:text-white shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );

  if (node.type === 'fuente_premisa' || node.type === 'fuente_peso') {
    const f = fuentes.find((x: Fuente) => x.id === node.id) as Fuente | undefined;
    if (!f) return header;
    return (
      <div>
        {header}
        <Meta rows={[['Tipo de dato', TIPO_DATO_LABEL[f.tipo_dato]], ['Tipo de lógica', TIPO_LOGICA_LABEL[f.tipo_logica]], ['Credibilidad base', `${Math.round(f.credibilidad)}%`], ...(f.tipo_logica === 'premisa' ? [['Credibilidad efectiva', `${Math.round(f.credibilidad_efectiva)}%`] as [string, string]] : [])]} />
        <p className="text-[12px] text-white/80 mt-2 leading-relaxed" style={mf}>{f.contenido}</p>
        {f.tipo_logica === 'premisa' && <PesosManager premisa={f} pesos={pesos} onReload={onReload} />}
        <DetailActions onEdit={() => onEditFuente(f)} onDelete={onDelete} />
      </div>
    );
  }

  if (node.type === 'problema') {
    const p = problemas.find((x: Problema) => x.id === node.id);
    if (!p) return header;
    return (
      <div>
        {header}
        {p.description && <p className="text-[12px] text-white/80 leading-relaxed" style={mf}>{p.description}</p>}
        <p className="text-[10.5px] text-white/45 mt-2" style={mf}>Los problemas se asocian a temas en una fase posterior de la clasificación.</p>
        <DetailActions onEdit={() => onEditProblema(p)} onDelete={onDelete} />
      </div>
    );
  }

  if (node.type === 'enfrentamiento') {
    const e = enfrentamientos.find((x: Enfrentamiento) => x.id === node.id);
    if (!e) return header;
    return <EnfrentamientoDetail e={e} onReload={onReload} onDelete={onDelete} header={header} />;
  }

  if (node.type === 'codigo') {
    const c = codigos.find((x: Codigo) => x.id === node.id);
    if (!c) return header;
    return <CodigoDetail c={c} onReload={onReload} onDelete={onDelete} header={header} />;
  }

  if (node.type === 'categoria') {
    const cat = categorias.find((x: Categoria) => x.id === node.id);
    if (!cat) return header;
    return <CategoriaDetail cat={cat} onReload={onReload} onDelete={onDelete} header={header} />;
  }

  return header;
}

function Meta({ rows }: { rows: [string, string][] }) {
  return (
    <div className="space-y-1 mt-1">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-white/50" style={mf}>{k}</span>
          <span className="text-[11.5px] text-white/90 font-medium" style={mf}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function DetailActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-2 mt-3 pt-2.5 border-t border-white/10">
      {onEdit && <button onClick={onEdit} className={`${GLASS_BTN} px-2.5 py-1.5 text-[12px]`} style={mf}><Pencil className="w-3 h-3" /> Editar</button>}
      <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-300 border border-red-400/30 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors" style={mf}><Trash2 className="w-3 h-3" /> Eliminar</button>
    </div>
  );
}

function PesosManager({ premisa, pesos, onReload }: { premisa: Fuente; pesos: Fuente[]; onReload: () => void }) {
  const [applied, setApplied] = useState<any[]>([]);
  const [pesoId, setPesoId] = useState<string>('');
  const [modo, setModo] = useState<PesoModo>('apoyo');

  const load = useCallback(async () => {
    try { const d = await fetch(`${API}/pesos?premisa_id=${premisa.id}`).then((r) => r.json()); setApplied(d.data || []); }
    catch { /* noop */ }
  }, [premisa.id]);
  useEffect(() => { load(); }, [load]);

  const apply = async () => {
    if (!pesoId) { toast.error('Elige una fuente peso'); return; }
    try {
      await mutate(`${API}/pesos`, 'POST', { premisa_fuente_id: premisa.id, peso_fuente_id: Number(pesoId), modo });
      toast.success('Peso aplicado');
      setPesoId('');
      await load(); await onReload();
    } catch (e: any) { toast.error(e.message); }
  };
  const remove = async (pfId: number) => {
    try {
      await mutate(`${API}/pesos`, 'DELETE', { premisa_fuente_id: premisa.id, peso_fuente_id: pfId });
      await load(); await onReload();
    } catch (e: any) { toast.error(e.message); }
  };

  const usableP = pesos.filter((p) => !applied.some((a) => a.peso_fuente_id === p.id));

  return (
    <div className="mt-3 pt-2.5 border-t border-white/10">
      <p className="text-[11px] font-semibold text-white/70 mb-1.5 flex items-center gap-1.5" style={df}><Weight className="w-3.5 h-3.5 text-[#60a5fa]" /> Pesos aplicados</p>
      {applied.length === 0 && <p className="text-[11px] text-white/45 mb-2" style={mf}>Ninguno. La credibilidad se altera al aplicar fuentes de tipo peso.</p>}
      <div className="space-y-1 mb-2">
        {applied.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[11px] bg-white/[0.04] rounded px-2 py-1">
            <span className="font-bold text-[#60a5fa]" style={df}>{a.peso_nomenclatura}</span>
            <span className={`px-1 rounded text-[9.5px] ${a.modo === 'apoyo' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`} style={mf}>{PESO_MODO_LABEL[a.modo as PesoModo]}</span>
            <span className="text-white/60 tabular-nums ml-auto" style={mf}>{Math.round(a.cred_antes)}→{Math.round(a.cred_despues)}%</span>
            <button onClick={() => remove(a.peso_fuente_id)} className="text-white/40 hover:text-red-400"><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
      {usableP.length > 0 ? (
        <div className="flex items-center gap-1.5">
          <select className={`${GLASS_INPUT} flex-1`} value={pesoId} onChange={(e) => setPesoId(e.target.value)}>
            <option value="">Fuente peso…</option>
            {usableP.map((p) => <option key={p.id} value={p.id} className="bg-[#181826]">{p.nomenclatura} · {p.contenido.slice(0, 30)}</option>)}
          </select>
          <select className={`${GLASS_INPUT} w-24`} value={modo} onChange={(e) => setModo(e.target.value as PesoModo)}>
            <option value="apoyo" className="bg-[#181826]">Apoya</option>
            <option value="contradice" className="bg-[#181826]">Contradice</option>
          </select>
          <button onClick={apply} className={`${GLASS_BTN} px-2 py-1.5`} title="Aplicar"><Plus className="w-3.5 h-3.5" /></button>
        </div>
      ) : (
        <p className="text-[10.5px] text-white/40" style={mf}>Crea fuentes de tipo peso para aportar/contradecir credibilidad.</p>
      )}
    </div>
  );
}

function EnfrentamientoDetail({ e, onReload, onDelete, header }: any) {
  const [texto, setTexto] = useState(e.texto);
  const save = async () => {
    try { await mutate(`${API}/enfrentamientos`, 'PATCH', { id: e.id, texto }); toast.success('Guardado'); await onReload(); }
    catch (err: any) { toast.error(err.message); }
  };
  return (
    <div>
      {header}
      <Meta rows={[['Ganó (más creíble)', `#${e.gano_seq}`], ['Perdió', `#${e.perdio_seq}`]]} />
      <p className="text-[11px] text-white/55 mt-2 mb-1" style={mf}>Ganadora: {e.gano_contenido}</p>
      <p className="text-[11px] text-white/40 mb-2" style={mf}>Perdedora: {e.perdio_contenido}</p>
      <Field label="Premisa combinada (texto manual)">
        <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={texto} onChange={(ev) => setTexto(ev.target.value)} placeholder="Escribe la premisa que junta la verdad de ambas según su credibilidad." />
      </Field>
      <div className="flex justify-end mt-1.5"><button onClick={save} className={`${GLASS_BTN} px-2.5 py-1 text-[12px]`} style={mf}><Check className="w-3 h-3" /> Guardar texto</button></div>
      <DetailActions onDelete={onDelete} />
    </div>
  );
}

function CodigoDetail({ c, onReload, onDelete, header }: any) {
  const [texto, setTexto] = useState(c.texto);
  const [evTitulo, setEvTitulo] = useState('');
  const [evUrl, setEvUrl] = useState('');

  const saveTexto = async () => {
    try { await mutate(`${API}/codigos`, 'PATCH', { id: c.id, texto }); toast.success('Guardado'); await onReload(); }
    catch (e: any) { toast.error(e.message); }
  };
  const toggleVerificado = async () => {
    if (!c.verificado && (c.eventos?.length ?? 0) === 0) { toast.error('Agrega al menos un evento de demostración para verificar.'); return; }
    try { await mutate(`${API}/codigos`, 'PATCH', { id: c.id, verificado: !c.verificado }); toast.success(!c.verificado ? 'Código verificado' : 'Marcado como no verificado'); await onReload(); }
    catch (e: any) { toast.error(e.message); }
  };
  const addEvento = async () => {
    if (!evTitulo.trim()) { toast.error('El título del evento es requerido'); return; }
    try { await mutate(`${API}/codigos/eventos`, 'POST', { codigo_id: c.id, titulo: evTitulo, url: evUrl }); setEvTitulo(''); setEvUrl(''); await onReload(); }
    catch (e: any) { toast.error(e.message); }
  };
  const delEvento = async (id: number) => {
    try { await mutate(`${API}/codigos/eventos`, 'DELETE', { id }); await onReload(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      {header}
      <div className={`flex items-center gap-2 mb-2 px-2 py-1.5 rounded-md ${c.verificado ? 'bg-emerald-500/15 border border-emerald-400/25' : 'bg-white/[0.04] border border-white/10'}`}>
        <ShieldCheck className={`w-4 h-4 ${c.verificado ? 'text-emerald-400' : 'text-white/40'}`} />
        <span className="text-[12px] text-white/85 flex-1" style={mf}>{c.verificado ? 'Verificado' : 'No verificado'}</span>
        <button onClick={toggleVerificado} className={`${GLASS_BTN} px-2 py-1 text-[11px]`} style={mf}>{c.verificado ? 'Desmarcar' : 'Verificar'}</button>
      </div>
      <Field label="Verdad consecuente (texto del código)">
        <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej. Un adulto sin trabajo cae en desesperación el 70% de las veces por motivos económicos y presión familiar." />
      </Field>
      <div className="flex justify-end mt-1.5"><button onClick={saveTexto} className={`${GLASS_BTN} px-2.5 py-1 text-[12px]`} style={mf}><Check className="w-3 h-3" /> Guardar</button></div>

      <div className="mt-3 pt-2.5 border-t border-white/10">
        <p className="text-[11px] font-semibold text-white/70 mb-1.5" style={df}>Eventos de demostración</p>
        <div className="space-y-1 mb-2">
          {(c.eventos || []).map((ev: Evento) => (
            <div key={ev.id} className="flex items-center gap-2 text-[11px] bg-white/[0.04] rounded px-2 py-1">
              <span className="text-white/85 flex-1 truncate" style={mf}>{ev.titulo}</span>
              {ev.url && <a href={ev.url} target="_blank" rel="noreferrer" className="text-accent hover:underline"><ExternalLink className="w-3 h-3" /></a>}
              <button onClick={() => delEvento(ev.id)} className="text-white/40 hover:text-red-400"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {(c.eventos || []).length === 0 && <p className="text-[11px] text-white/45" style={mf}>Sin eventos. Se necesita demostración empírica (video/streaming) para verificar.</p>}
        </div>
        <div className="space-y-1.5">
          <input className={GLASS_INPUT} value={evTitulo} onChange={(e) => setEvTitulo(e.target.value)} placeholder="Título del evento" />
          <div className="flex gap-1.5">
            <input className={`${GLASS_INPUT} flex-1`} value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="URL (video grabado o streaming)" />
            <button onClick={addEvento} className={`${GLASS_BTN} px-2 py-1.5`} title="Agregar evento"><Plus className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>
      <DetailActions onDelete={onDelete} />
    </div>
  );
}

function CategoriaDetail({ cat, onReload, onDelete, header }: any) {
  const [nombre, setNombre] = useState(cat.nombre);
  const save = async () => {
    try { await mutate(`${API}/categorias`, 'PATCH', { id: cat.id, nombre }); toast.success('Guardado'); await onReload(); }
    catch (e: any) { toast.error(e.message); }
  };
  const removeCodigo = async (codigoId: number) => {
    try { await mutate(`${API}/categorias`, 'PATCH', { id: cat.id, action: 'remove_codigo', codigo_id: codigoId }); await onReload(); }
    catch (e: any) { toast.error(e.message); }
  };
  return (
    <div>
      {header}
      <Field label="Nombre de la categoría">
        <div className="flex gap-1.5">
          <input className={`${GLASS_INPUT} flex-1`} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Opcional" />
          <button onClick={save} className={`${GLASS_BTN} px-2 py-1.5`} title="Guardar"><Check className="w-3.5 h-3.5" /></button>
        </div>
      </Field>
      <p className="text-[11px] font-semibold text-white/70 mt-3 mb-1.5" style={df}>Códigos agrupados</p>
      <div className="space-y-1">
        {cat.codigos.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 text-[11px] bg-white/[0.04] rounded px-2 py-1">
            <Hexagon className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="text-white/85 flex-1 truncate font-mono" style={{ fontFamily: 'var(--font-mono, monospace)' }}>{c.nomenclatura}</span>
            <button onClick={() => removeCodigo(c.id)} className="text-white/40 hover:text-red-400"><X className="w-3 h-3" /></button>
          </div>
        ))}
        {cat.codigos.length === 0 && <p className="text-[11px] text-white/45" style={mf}>Sin códigos.</p>}
      </div>
      <DetailActions onDelete={onDelete} />
    </div>
  );
}

// ── Modales complejos ─────────────────────────────────────────────────────────
function EnfrentamientoModal({ probId, premisas, onClose, onSaved }: { probId: number; premisas: Fuente[]; onClose: () => void; onSaved: () => void }) {
  const [aId, setAId] = useState<string>('');
  const [bId, setBId] = useState<string>('');
  const [texto, setTexto] = useState('');
  const a = premisas.find((p) => String(p.id) === aId);
  const b = premisas.find((p) => String(p.id) === bId);

  const save = async () => {
    if (!aId || !bId || aId === bId) { toast.error('Elige dos premisas distintas'); return; }
    try {
      await mutate(`${API}/enfrentamientos`, 'POST', { problematica_id: probId, fuente_a_id: Number(aId), fuente_b_id: Number(bId), texto });
      toast.success('Enfrentamiento creado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title="Enfrentar dos premisas" initialWidth={480} initialHeight={520}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-white/60" style={mf}>Dos premisas se enfrentan; la de mayor credibilidad gana. Se fusionan en una sola premisa (texto manual). Nomenclatura: REF-ganó.perdió.</p>
        <Field label="Premisa A"><PremSelect value={aId} onChange={setAId} premisas={premisas} /></Field>
        <Field label="Premisa B"><PremSelect value={bId} onChange={setBId} premisas={premisas} /></Field>
        {a && b && (
          <p className="text-[11px] text-white/70 bg-white/[0.04] rounded px-2 py-1.5" style={mf}>
            Ganará <b className="text-emerald-300">{(a.credibilidad_efectiva >= b.credibilidad_efectiva ? a : b).nomenclatura}</b> ({Math.round(Math.max(a.credibilidad_efectiva, b.credibilidad_efectiva))}%) sobre <span className="text-red-300">{(a.credibilidad_efectiva >= b.credibilidad_efectiva ? b : a).nomenclatura}</span>.
          </p>
        )}
        <Field label="Premisa combinada">
          <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Junta la verdad de la más creíble con la de la menos creíble." />
        </Field>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Crear</button>
        </div>
      </div>
    </FloatingWindow>
  );
}

function PremSelect({ value, onChange, premisas }: { value: string; onChange: (v: string) => void; premisas: Fuente[] }) {
  return (
    <select className={GLASS_INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Elige una premisa…</option>
      {premisas.map((p) => <option key={p.id} value={p.id} className="bg-[#181826]">{p.nomenclatura} ({Math.round(p.credibilidad_efectiva)}%) · {p.contenido.slice(0, 40)}</option>)}
    </select>
  );
}

function CodigoModal({ probId, premisas, enfrentamientos, onClose, onSaved }: { probId: number; premisas: Fuente[]; enfrentamientos: Enfrentamiento[]; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<{ kind: 'premisa' | 'enfrentamiento'; id: number }[]>([]);
  const [texto, setTexto] = useState('');

  const toggle = (kind: 'premisa' | 'enfrentamiento', id: number) => {
    setSel((s) => s.some((u) => u.kind === kind && u.id === id) ? s.filter((u) => !(u.kind === kind && u.id === id)) : [...s, { kind, id }]);
  };
  const on = (kind: 'premisa' | 'enfrentamiento', id: number) => sel.some((u) => u.kind === kind && u.id === id);

  const save = async () => {
    if (sel.length < 1) { toast.error('Elige al menos una premisa'); return; }
    try {
      await mutate(`${API}/codigos`, 'POST', { problematica_id: probId, texto, unidades: sel });
      toast.success('Código creado (no verificado)');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title="Nuevo código" initialWidth={520} initialHeight={600}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-white/60" style={mf}>Junta varias premisas (sueltas o enfrentadas) en una verdad consecuente. Nace <b>no verificado</b>; se verifica con eventos de demostración.</p>
        <div>
          <p className="text-[11px] font-semibold text-white/70 mb-1" style={df}>Premisas ({premisas.length})</p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {premisas.map((p) => (
              <button key={p.id} onClick={() => toggle('premisa', p.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-[11.5px] transition-colors ${on('premisa', p.id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on('premisa', p.id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{on('premisa', p.id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
                <span className="font-bold text-[#22d3ee]" style={df}>{p.nomenclatura}</span>
                <span className="text-white/70 truncate">{p.contenido}</span>
              </button>
            ))}
          </div>
        </div>
        {enfrentamientos.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-white/70 mb-1" style={df}>Premisas enfrentadas ({enfrentamientos.length})</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {enfrentamientos.map((e) => (
                <button key={e.id} onClick={() => toggle('enfrentamiento', e.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-[11.5px] transition-colors ${on('enfrentamiento', e.id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on('enfrentamiento', e.id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{on('enfrentamiento', e.id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
                  <span className="font-bold text-[#a855f7]" style={df}>{e.nomenclatura}</span>
                  <span className="text-white/70 truncate">{e.texto || '(sin texto)'}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        <Field label="Verdad consecuente (texto)">
          <textarea className={`${GLASS_INPUT} resize-none`} rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="La interpretación lógica de las premisas juntas." />
        </Field>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Crear código</button>
        </div>
      </div>
    </FloatingWindow>
  );
}

function CategoriaModal({ probId, codigosVerificados, onClose, onSaved }: { probId: number; codigosVerificados: Codigo[]; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState('');
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (id: number) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const save = async () => {
    if (sel.length < 1) { toast.error('Elige al menos un código verificado'); return; }
    try {
      await mutate(`${API}/categorias`, 'POST', { problematica_id: probId, nombre, codigo_ids: sel });
      toast.success('Categoría creada');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title="Nueva categoría" initialWidth={500} initialHeight={520}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-white/60" style={mf}>Agrupa <b>códigos verificados</b>. Nomenclatura: CAT-n-COD-…</p>
        <Field label="Nombre (opcional)">
          <input className={GLASS_INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Desesperación laboral" />
        </Field>
        <div>
          <p className="text-[11px] font-semibold text-white/70 mb-1" style={df}>Códigos verificados ({codigosVerificados.length})</p>
          <div className="max-h-56 overflow-y-auto space-y-1">
            {codigosVerificados.map((c) => (
              <button key={c.id} onClick={() => toggle(c.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-[11.5px] transition-colors ${sel.includes(c.id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel.includes(c.id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{sel.includes(c.id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
                <Hexagon className="w-3 h-3 text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-300" style={df}>{c.nomenclatura}</span>
                <span className="text-white/70 truncate">{c.texto}</span>
              </button>
            ))}
            {codigosVerificados.length === 0 && <p className="text-[11px] text-white/45" style={mf}>No hay códigos verificados aún.</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>Crear categoría</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
