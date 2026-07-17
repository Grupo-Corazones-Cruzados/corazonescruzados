'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  FolderPlus, Pencil, Trash2, Plus, Database, GitCompareArrows, Hexagon,
  Star, AlertTriangle, Check, X, ExternalLink, ShieldCheck, Weight, Puzzle, FileText, Layers, BookOpen, Sparkles, Search, Bot, Send,
} from 'lucide-react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelModal from '@/components/ui/PixelModal';
import GdGraph, { type GdLegendFilter } from '@/components/centralized/gestion-datos/GdGraph';
import {
  GD_NODE_META, TIPO_DATO_LABEL, TIPO_LOGICA_LABEL,
  PIEZA_TIPO_LABEL, VARIABLE_TIPO_LABEL, VARIABLE_FACTOR_LABEL, VARIABLE_FACTOR_COLOR,
  type GdGraph as GdGraphT, type GdGraphNode, type GdNodeType, type TipoDato, type TipoLogica,
  type PiezaTipo, type VariableFactor,
} from '@/lib/centralized/gestion-datos';
import { APA_TIPOS, apaTipoLabel, formatApaSegments, formatApaText } from '@/lib/centralized/apa';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const GLASS = 'rounded-xl bg-black/40 backdrop-blur-md border border-white/12 shadow-lg';
const GLASS_BTN = 'inline-flex items-center justify-center gap-1.5 border border-white/15 bg-white/[0.08] hover:bg-white/[0.18] text-white/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const GLASS_INPUT = 'w-full px-2.5 py-1.5 bg-black/40 border border-white/15 rounded-md text-[13px] text-white placeholder-white/40 focus:border-accent focus:outline-none';

type Problematica = { id: number; name: string; ref: string; description: string; fuentes_count: number; codigos_count: number };
type Fuente = { id: number; problematica_id: number; tipo_dato: TipoDato; tipo_logica: TipoLogica; contenido: string; credibilidad: number; credibilidad_efectiva: number; seq: number; nomenclatura: string; referencia_id?: number | null; ref_tipo?: string | null; ref_datos?: Record<string, string> | null };
type Problema = { id: number; title: string; description: string };
type Enfrentamiento = { id: number; texto: string; nomenclatura: string; gano_seq: number; perdio_seq: number; gano_contenido: string; perdio_contenido: string };
type Evento = { id: number; titulo: string; url: string };
type Codigo = { id: number; texto: string; verificado: boolean; nomenclatura: string; unidades: any[]; eventos: Evento[] };
type Categoria = { id: number; seq: number; nombre: string; nomenclatura: string; codigos: { id: number; nomenclatura: string; verificado: boolean }[] };
type PiezaVar = { id: number; factor: VariableFactor; nombre: string; tipo_var: string; restricciones: any };
type Pieza = { id: number; tipo: PiezaTipo; estado?: string; nomenclatura: string; codigoIds: number[]; variables: PiezaVar[] };
type Situacion = { id: number; nombre: string };
type Materia = { id: number; nombre: string };
type Rompecabezas = { id: number; nombre: string; situacion_id: number | null; situacion_nombre: string | null; piezaIds: number[] };
type Subtema = { id: number; titulo: string; hipotesis: { id: number; texto: string }[]; rompecabezas: { id: number; nombre: string }[] };
type Tema = { id: number; titulo: string; prosa: string; subtemas: { id: number; titulo: string }[]; materias: { id: number; nombre: string }[]; problemas: { id: number; title: string }[] };

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
  const [piezas, setPiezas] = useState<Pieza[]>([]);
  const [rompecabezas, setRompecabezas] = useState<Rompecabezas[]>([]);
  const [subtemas, setSubtemas] = useState<Subtema[]>([]);
  const [temas, setTemas] = useState<Tema[]>([]);
  const [situaciones, setSituaciones] = useState<Situacion[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Panel de creación rápida (fuente/problema) en el panel flotante.
  const [creating, setCreating] = useState<null | 'fuente' | 'problema'>(null);
  // Guard anti doble-envío: mientras hay una mutación en curso, se bloquea otra.
  const [busy, setBusy] = useState(false);
  // Modales complejos (necesitan pickers).
  const [modal, setModal] = useState<null | 'enfrentamiento' | 'codigo' | 'categoria' | 'problematica' | 'rompecabezas' | 'subtema' | 'tema'>(null);
  const [editRomp, setEditRomp] = useState<Rompecabezas | null>(null);
  const [editSubtema, setEditSubtema] = useState<Subtema | null>(null);
  const [editTema, setEditTema] = useState<Tema | null>(null);

  // Filtro de leyenda.
  const [pinFilter, setPinFilter] = useState<GdLegendFilter>(null);
  const [hoverFilter, setHoverFilter] = useState<GdLegendFilter>(null);
  const legendFilter = hoverFilter ?? pinFilter;

  // Confirmaciones.
  const [confirmNode, setConfirmNode] = useState<GdGraphNode | null>(null);
  const [confirmProb, setConfirmProb] = useState<Problematica | null>(null);
  // Chat del agente de pesos (IA) sobre una premisa.
  const [agentPremisa, setAgentPremisa] = useState<Fuente | null>(null);

  const prob = useMemo(() => problematicas.find((p) => p.id === probId) || null, [problematicas, probId]);
  const selectedNode = useMemo(() => graph.nodes.find((n) => n.key === selectedKey) || null, [graph, selectedKey]);

  const loadProblematicas = useCallback(async () => {
    try {
      const res = await fetch(`${API}/problematicas`);
      const d = await res.json();
      setProblematicas(d.data || []);
    } catch { /* noop */ }
  }, []);

  const loadGlobals = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        fetch(`${API}/situaciones`).then((r) => r.json()),
        fetch(`${API}/materias`).then((r) => r.json()),
      ]);
      setSituaciones(s.data || []); setMaterias(m.data || []);
    } catch { /* noop */ }
  }, []);

  const loadAll = useCallback(async (id: number | null) => {
    if (!id) {
      setGraph({ nodes: [], edges: [] });
      setFuentes([]); setProblemas([]); setEnfrentamientos([]); setCodigos([]); setCategorias([]);
      setPiezas([]); setRompecabezas([]); setSubtemas([]); setTemas([]);
      return;
    }
    try {
      const [g, f, p, e, c, cat, pz, rc, st, tm] = await Promise.all([
        fetch(`${API}?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/fuentes?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/problemas?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/enfrentamientos?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/codigos?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/categorias?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/piezas?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/rompecabezas?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/subtemas?problematica_id=${id}`).then((r) => r.json()),
        fetch(`${API}/temas?problematica_id=${id}`).then((r) => r.json()),
      ]);
      setGraph(g.data || { nodes: [], edges: [] });
      setFuentes(f.data || []); setProblemas(p.data || []); setEnfrentamientos(e.data || []);
      setCodigos(c.data || []); setCategorias(cat.data || []);
      setPiezas(pz.data || []); setRompecabezas(rc.data || []); setSubtemas(st.data || []); setTemas(tm.data || []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { loadProblematicas(); loadGlobals(); }, [loadProblematicas, loadGlobals]);
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
    if (busy) return;
    if (!probForm.name.trim() || !probForm.ref.trim()) { toast.error('Nombre y referencia son requeridos'); return; }
    setBusy(true);
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
    finally { setBusy(false); }
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
  const [fuenteForm, setFuenteForm] = useState<{ id?: number; tipo_dato: TipoDato; tipo_logica: TipoLogica; contenido: string; credibilidad: number; referencia_id: number | null }>(
    { tipo_dato: 'cantidad', tipo_logica: 'premisa', contenido: '', credibilidad: 50, referencia_id: null },
  );
  const [problemaForm, setProblemaForm] = useState<{ id?: number; title: string; description: string }>({ title: '', description: '' });

  const openFuente = (f?: Fuente) => {
    setSelectedKey(null);
    setFuenteForm(f
      ? { id: f.id, tipo_dato: f.tipo_dato, tipo_logica: f.tipo_logica, contenido: f.contenido, credibilidad: f.credibilidad, referencia_id: f.referencia_id ?? null }
      : { tipo_dato: 'cantidad', tipo_logica: 'premisa', contenido: '', credibilidad: 50, referencia_id: null });
    setCreating('fuente');
  };
  const saveFuente = async () => {
    if (busy) return;
    if (!fuenteForm.contenido.trim()) { toast.error('El contenido es requerido'); return; }
    setBusy(true);
    try {
      if (fuenteForm.id) {
        await mutate(`${API}/fuentes`, 'PATCH', { id: fuenteForm.id, contenido: fuenteForm.contenido, credibilidad: fuenteForm.credibilidad, tipo_dato: fuenteForm.tipo_dato, referencia_id: fuenteForm.referencia_id });
        toast.success('Fuente actualizada');
      } else {
        await mutate(`${API}/fuentes`, 'POST', { problematica_id: probId, ...fuenteForm });
        toast.success('Fuente agregada');
      }
      setCreating(null);
      await reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const openProblema = (p?: Problema) => {
    setSelectedKey(null);
    setProblemaForm(p ? { id: p.id, title: p.title, description: p.description } : { title: '', description: '' });
    setCreating('problema');
  };
  const saveProblema = async () => {
    if (busy) return;
    if (!problemaForm.title.trim()) { toast.error('El título es requerido'); return; }
    setBusy(true);
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
    finally { setBusy(false); }
  };

  // ── Eliminar nodo ───────────────────────────────────────────────────────────
  const deleteNode = async (n: GdGraphNode, deletePesos?: boolean) => {
    const routeByType: Record<GdNodeType, string> = {
      problema: 'problemas', fuente_premisa: 'fuentes', fuente_peso: 'fuentes',
      enfrentamiento: 'enfrentamientos', codigo: 'codigos', categoria: 'categorias',
      pieza: 'piezas', rompecabezas: 'rompecabezas', subtema: 'subtemas', tema: 'temas',
      condicion: '', variable: '', // no aparecen en el grafo de Gestión de Datos
    };
    try {
      const body = n.type === 'fuente_premisa' && deletePesos ? { id: n.id, delete_pesos: true } : { id: n.id };
      await mutate(`${API}/${routeByType[n.type]}`, 'DELETE', body);
      toast.success(deletePesos ? 'Premisa y pesos eliminados' : `${GD_NODE_META[n.type].label} eliminado`);
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
    { type: 'pieza' }, { type: 'rompecabezas' }, { type: 'subtema' }, { type: 'tema' },
  ];

  // Panel derecho: registros del filtro aplicado (pinFilter) en el universo de gráficos.
  const matchesLegendFilter = (n: GdGraphNode, f: NonNullable<GdLegendFilter>) => {
    if (f.kind === 'state') { if (n.type !== 'codigo') return false; return f.value === 'verificado' ? !!n.verificado : !n.verificado; }
    return n.type === f.value;
  };
  const filteredNodes = useMemo(() => (pinFilter ? graph.nodes.filter((n) => matchesLegendFilter(n, pinFilter)) : []), [graph.nodes, pinFilter]);
  const filterLabel = pinFilter
    ? (pinFilter.kind === 'state' ? (pinFilter.value === 'verificado' ? 'Códigos verificados' : 'Códigos no verificados') : GD_NODE_META[pinFilter.value as GdNodeType].plural)
    : '';
  const filterColor = pinFilter
    ? (pinFilter.kind === 'state' ? (pinFilter.value === 'verificado' ? '#34d399' : '#6b7280') : GD_NODE_META[pinFilter.value as GdNodeType].color)
    : '#888';
  const nodeBrief = (n: GdGraphNode): string => {
    if (n.type === 'fuente_premisa' || n.type === 'fuente_peso') return fuentes.find((x) => x.id === n.id)?.contenido || '';
    if (n.type === 'problema') return (problemas.find((x) => x.id === n.id) as any)?.description || '';
    if (n.type === 'codigo') return (codigos.find((x) => x.id === n.id) as any)?.texto || '';
    if (n.type === 'enfrentamiento') return (enfrentamientos.find((x) => x.id === n.id) as any)?.texto || '';
    if (n.type === 'categoria') return (categorias.find((x) => x.id === n.id) as any)?.nombre || '';
    return n.subtitle || '';
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100dvh-130px)]">
      {/* ── Panel izquierdo: Problemáticas ── */}
      <aside className="w-full lg:w-[248px] shrink-0 max-h-[40vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
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
      <div className="flex-1 min-w-0 min-h-[70vh] lg:min-h-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
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
                <ToolBtn icon={<FileText className="w-3.5 h-3.5" />} label="Rompecabezas" color={GD_NODE_META.rompecabezas.color} onClick={() => { setEditRomp(null); setModal('rompecabezas'); }} />
                <ToolBtn icon={<Layers className="w-3.5 h-3.5" />} label="Subtema" color={GD_NODE_META.subtema.color} onClick={() => { setEditSubtema(null); setModal('subtema'); }} disabled={rompecabezas.length < 1} />
                <ToolBtn icon={<BookOpen className="w-3.5 h-3.5" />} label="Tema" color={GD_NODE_META.tema.color} onClick={() => { setEditTema(null); setModal('tema'); }} disabled={subtemas.length < 1} />
              </div>
            </div>

            {/* Grafo */}
            <div className="relative flex-1 min-h-0">
              <GdGraph
                nodes={graph.nodes}
                edges={graph.edges}
                selectedKey={selectedKey}
                centerKey={selectedKey}
                filter={legendFilter}
                fitSignal={`${probId}:${graph.nodes.length}`}
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
                <aside className={`absolute bottom-3 right-3 ${creating === 'fuente' ? 'w-[680px] max-w-[calc(100%-24px)]' : 'w-[352px]'} max-h-[calc(100%-24px)] overflow-y-auto ${GLASS} p-3`}>
                  {creating === 'fuente' ? (
                    <FuenteForm form={fuenteForm} setForm={setFuenteForm} onCancel={() => setCreating(null)} onSave={saveFuente} saving={busy} />
                  ) : creating === 'problema' ? (
                    <ProblemaForm form={problemaForm} setForm={setProblemaForm} onCancel={() => setCreating(null)} onSave={saveProblema} saving={busy} />
                  ) : selectedNode ? (
                    <NodeDetail
                      key={selectedNode.key}
                      node={selectedNode}
                      fuentes={fuentes}
                      pesos={pesos}
                      enfrentamientos={enfrentamientos}
                      codigos={codigos}
                      categorias={categorias}
                      problemas={problemas}
                      piezas={piezas}
                      rompecabezasList={rompecabezas}
                      subtemasList={subtemas}
                      temasList={temas}
                      onEditFuente={openFuente}
                      onEditProblema={openProblema}
                      onEditRomp={(r: Rompecabezas) => { setEditRomp(r); setModal('rompecabezas'); }}
                      onEditSubtema={(s: Subtema) => { setEditSubtema(s); setModal('subtema'); }}
                      onEditTema={(t: Tema) => { setEditTema(t); setModal('tema'); }}
                      onReload={reload}
                      onDelete={() => setConfirmNode(selectedNode)}
                      onClose={() => setSelectedKey(null)}
                      onOpenAgent={(f: Fuente) => setAgentPremisa(f)}
                    />
                  ) : null}
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Panel derecho: registros del filtro aplicado ── */}
      {prob && pinFilter && (
        <aside className="w-full lg:w-[268px] shrink-0 max-h-[50vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-digi-border flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: filterColor }} />
              <span className="text-[12px] font-semibold text-digi-text truncate" style={df}>{filterLabel}</span>
              <span className="text-[11px] text-digi-muted shrink-0" style={mf}>{filteredNodes.length}</span>
            </div>
            <button onClick={() => setPinFilter(null)} className="p-1 text-digi-muted hover:text-digi-text shrink-0" title="Quitar filtro"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
            {filteredNodes.length === 0 && (
              <p className="text-[12px] text-digi-muted px-2 py-4 text-center" style={mf}>Sin registros para este filtro.</p>
            )}
            {filteredNodes.map((n) => (
              <button
                key={n.key}
                onClick={() => { setSelectedKey(n.key); setCreating(null); }}
                className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors ${selectedKey === n.key ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}
              >
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ ...df, background: `${GD_NODE_META[n.type].color}22`, color: GD_NODE_META[n.type].color }}>{n.title}</span>
                {nodeBrief(n) && <p className="text-[11px] text-digi-muted mt-1 line-clamp-2" style={mf}>{nodeBrief(n)}</p>}
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-digi-border">
            <p className="text-[10.5px] text-digi-muted text-center" style={mf}>Selecciona un registro para ver su detalle completo.</p>
          </div>
        </aside>
      )}

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
              <button onClick={() => setModal(null)} disabled={busy} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
              <button onClick={saveProblematica} disabled={busy} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{busy ? 'Guardando…' : editingProb ? 'Guardar' : 'Crear'}</button>
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
      {/* ── Modal: Rompecabezas ── */}
      {modal === 'rompecabezas' && (
        <RompecabezasModal probId={probId!} piezas={piezas} situaciones={situaciones} edit={editRomp} onClose={() => { setModal(null); setEditRomp(null); }} onSaved={async () => { setModal(null); setEditRomp(null); await reload(); }} />
      )}
      {/* ── Modal: Subtema ── */}
      {modal === 'subtema' && (
        <SubtemaModal probId={probId!} rompecabezas={rompecabezas} edit={editSubtema} onClose={() => { setModal(null); setEditSubtema(null); }} onSaved={async () => { setModal(null); setEditSubtema(null); await reload(); }} />
      )}
      {/* ── Modal: Tema ── */}
      {modal === 'tema' && (
        <TemaModal probId={probId!} subtemas={subtemas} materias={materias} problemas={problemas} edit={editTema} onClose={() => { setModal(null); setEditTema(null); }} onSaved={async () => { setModal(null); setEditTema(null); await reload(); }} />
      )}

      {confirmNode?.type === 'fuente_premisa' ? (
        <PremisaDeleteConfirm
          node={confirmNode}
          pesoCount={graph.edges.filter((e) => e.kind === 'peso' && e.target === confirmNode.key).length}
          onCancel={() => setConfirmNode(null)}
          onDeleteOnly={() => { deleteNode(confirmNode, false); setConfirmNode(null); }}
          onDeleteWithPesos={() => { deleteNode(confirmNode, true); setConfirmNode(null); }}
        />
      ) : (
        <PixelConfirm
          open={!!confirmNode}
          title="Eliminar elemento"
          message={confirmNode ? `¿Eliminar ${GD_NODE_META[confirmNode.type].label.toLowerCase()} "${confirmNode.title}"? Esta acción no se puede deshacer y elimina lo que dependa de él.` : ''}
          confirmLabel="Eliminar"
          danger
          onConfirm={() => { if (confirmNode) deleteNode(confirmNode); setConfirmNode(null); }}
          onCancel={() => setConfirmNode(null)}
        />
      )}
      <PixelConfirm
        open={!!confirmProb}
        title="Eliminar problemática"
        message={confirmProb ? `¿Eliminar "${confirmProb.name}" y TODO su contenido (fuentes, códigos, categorías…)? No se puede deshacer.` : ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => { if (confirmProb) deleteProblematica(confirmProb); setConfirmProb(null); }}
        onCancel={() => setConfirmProb(null)}
      />
      {agentPremisa && (
        <PesosAgentChat premisa={agentPremisa} onClose={() => setAgentPremisa(null)} onReload={reload} />
      )}
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

// Textarea que crece en alto a medida que se escribe (sin scroll interno), con un mínimo.
function AutoTextarea({ value, onChange, className, placeholder, autoFocus, minHeight = 70 }: any) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      style={{ overflow: 'hidden', minHeight, resize: 'none' }}
    />
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

// Referencia bibliográfica APA formateada (segmentos con cursivas).
function ApaReference({ tipo, datos, className }: { tipo?: string | null; datos?: Record<string, string> | null; className?: string }) {
  const segs = formatApaSegments(tipo, datos);
  if (!segs.length) return null;
  return (
    <p className={className} style={mf}>
      {segs.map((s, i) => (s.i ? <em key={i}>{s.t}</em> : <span key={i}>{s.t}</span>))}
    </p>
  );
}

// Editor de una referencia bibliográfica (APA) sobre un borrador { ref_tipo, ref_datos }.
function ApaRefEditor({ draft, setDraft }: { draft: { ref_tipo: string; ref_datos: Record<string, string> }; setDraft: (fn: (d: any) => any) => void }) {
  const tipo = draft.ref_tipo || '';
  const datos = draft.ref_datos || {};
  const def = APA_TIPOS.find((t) => t.value === tipo);
  const setDato = (key: string, val: string) => setDraft((d) => ({ ...d, ref_datos: { ...(d.ref_datos || {}), [key]: val } }));
  const previewText = formatApaText(tipo, datos);
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const runAi = async () => {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(true);
    try {
      const res = await fetch(`${API}/fuentes/apa-extract`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: aiText }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo interpretar');
      setDraft(() => ({ ref_tipo: d.data.ref_tipo, ref_datos: d.data.ref_datos || {} }));
      toast.success('Referencia interpretada con IA');
    } catch (e: any) { toast.error(e.message); }
    finally { setAiBusy(false); }
  };
  // Buscar en Scopus e importar la referencia (autores completos vía Crossref por DOI).
  const [scoQ, setScoQ] = useState('');
  const [scoBusy, setScoBusy] = useState(false);
  const [scoRes, setScoRes] = useState<any[]>([]);
  const [usingId, setUsingId] = useState<string | null>(null);
  const searchScopus = async () => {
    if (!scoQ.trim() || scoBusy) return;
    setScoBusy(true); setScoRes([]);
    try {
      const res = await fetch(`${API}/fuentes/scopus-search?q=${encodeURIComponent(scoQ)}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Error en Scopus');
      setScoRes(d.data || []);
      if (!(d.data || []).length) toast('Sin resultados en Scopus');
    } catch (e: any) { toast.error(e.message); }
    finally { setScoBusy(false); }
  };
  const useScopusResult = async (r: any) => {
    if (usingId) return;
    setUsingId(r.scopusId);
    try {
      if (r.doi) {
        const res = await fetch(`${API}/fuentes/apa-from-doi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doi: r.doi }) });
        const d = await res.json().catch(() => ({}));
        if (res.ok && d.data) { setDraft(() => ({ ref_tipo: d.data.ref_tipo, ref_datos: d.data.ref_datos || {} })); toast.success('Referencia importada de Scopus'); setScoRes([]); return; }
      }
      setDraft(() => ({ ref_tipo: r.apa.ref_tipo, ref_datos: r.apa.ref_datos || {} }));
      toast.success('Referencia importada de Scopus');
      setScoRes([]);
    } catch (e: any) { toast.error(e.message); }
    finally { setUsingId(null); }
  };
  return (
    <div className="space-y-2.5">
      {/* Autocompletar con IA */}
      <div className="rounded-md border border-accent/30 bg-accent/[0.07] p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-accent" />
          <span className="text-[11px] font-semibold text-white/90" style={mf}>Autocompletar con IA</span>
        </div>
        <textarea
          className={`${GLASS_INPUT} resize-none`} rows={3} value={aiText}
          onChange={(e) => setAiText(e.target.value)}
          placeholder="Pega los datos del documento (portada, ficha de catálogo, cita suelta…) y la IA detectará el tipo y rellenará los campos."
        />
        <button
          onClick={runAi} disabled={aiBusy || !aiText.trim()}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed" style={mf}
        >
          <Sparkles className="w-3.5 h-3.5" />{aiBusy ? 'Interpretando…' : 'Interpretar y rellenar'}
        </button>
      </div>
      {/* Buscar en Scopus */}
      <div className="rounded-md border border-white/12 bg-white/[0.03] p-2 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span className="text-[11px] font-semibold text-white/90" style={mf}>Buscar en Scopus</span>
        </div>
        <div className="flex gap-1.5">
          <input
            className={`${GLASS_INPUT} flex-1`} value={scoQ}
            onChange={(e) => setScoQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchScopus(); } }}
            placeholder="Tema, título o autor…"
          />
          <button onClick={searchScopus} disabled={scoBusy || !scoQ.trim()} className={`${GLASS_BTN} px-2.5 py-1.5 text-[12px]`} style={mf}>{scoBusy ? '…' : 'Buscar'}</button>
        </div>
        {scoRes.length > 0 && (
          <div className="max-h-56 overflow-y-auto space-y-1 pt-0.5">
            {scoRes.map((r) => (
              <div key={r.scopusId} className="rounded bg-white/[0.04] border border-white/8 p-1.5">
                <p className="text-[11.5px] text-white/90 leading-tight" style={mf}>{r.title}</p>
                <p className="text-[10px] text-white/50 mt-0.5" style={mf}>{r.creator}{r.authorCount > 1 ? ' et al.' : ''}{r.journal ? ` · ${r.journal}` : ''}{r.year ? ` · ${r.year}` : ''}{r.citedby ? ` · ${r.citedby} citas` : ''}</p>
                <div className="flex justify-end mt-1">
                  <button onClick={() => useScopusResult(r)} disabled={!!usingId} className="text-[10.5px] text-accent hover:underline disabled:opacity-50" style={mf}>{usingId === r.scopusId ? 'Importando…' : 'Usar esta'}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Field label="Tipo de referencia (APA)">
        <select
          className={GLASS_INPUT}
          value={tipo}
          onChange={(e) => setDraft(() => ({ ref_tipo: e.target.value, ref_datos: {} }))}
        >
          <option value="">— Elige el tipo —</option>
          {APA_TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {def?.help && <p className="text-[10.5px] text-white/45 mt-1" style={mf}>{def.help}</p>}
      </Field>
      {def && def.campos.map((c) => (
        <Field key={c.key} label={`${c.label}${c.required ? ' *' : ''}`}>
          {c.kind === 'textarea' ? (
            <textarea className={`${GLASS_INPUT} resize-none`} rows={2} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} placeholder={c.placeholder} />
          ) : (
            <input className={GLASS_INPUT} value={datos[c.key] || ''} onChange={(e) => setDato(c.key, e.target.value)} placeholder={c.placeholder} inputMode={c.kind === 'year' ? 'numeric' : undefined} />
          )}
          {c.help && <p className="text-[10px] text-white/40 mt-1" style={mf}>{c.help}</p>}
        </Field>
      ))}
      {def && (
        <div className="rounded-md bg-black/40 border border-white/10 p-2">
          <p className="text-[9.5px] uppercase tracking-wide text-white/40 mb-1" style={df}>Vista previa (APA 7)</p>
          {previewText
            ? <ApaReference tipo={tipo} datos={datos} className="text-[11.5px] text-white/85 leading-relaxed" />
            : <p className="text-[11px] text-white/40 italic" style={mf}>Completa los campos para ver la referencia.</p>}
        </div>
      )}
    </div>
  );
}

function refLabel(r: any): string {
  const t = formatApaText(r.ref_tipo, r.ref_datos);
  const base = t || apaTipoLabel(r.ref_tipo) || 'Referencia';
  return base.length > 70 ? base.slice(0, 69) + '…' : base;
}

// Selector de referencia bibliográfica por ASOCIACIÓN: reutiliza referencias existentes (tabla
// gd_referencias) o crea/edita una (los cambios a una referencia afectan a TODAS las fuentes que la usan).
function ReferenciaPicker({ value, onChange }: { value: number | null; onChange: (id: number | null) => void }) {
  const [refs, setRefs] = useState<any[]>([]);
  const [mode, setMode] = useState<null | 'new' | 'edit'>(null);
  const [draft, setDraft] = useState<{ ref_tipo: string; ref_datos: Record<string, string> }>({ ref_tipo: '', ref_datos: {} });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const d = await fetch(`${API}/referencias`).then((r) => r.json()); setRefs(d.data || []); } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const selected = refs.find((r) => r.id === value) || null;

  const onSelect = (v: string) => {
    if (v === '__new__') { setDraft({ ref_tipo: '', ref_datos: {} }); setMode('new'); }
    else if (v === '') { onChange(null); setMode(null); }
    else { onChange(Number(v)); setMode(null); }
  };
  const startEdit = () => { if (selected) { setDraft({ ref_tipo: selected.ref_tipo, ref_datos: selected.ref_datos || {} }); setMode('edit'); } };
  const cancel = () => { setMode(null); setDraft({ ref_tipo: '', ref_datos: {} }); };
  const saveRef = async () => {
    if (busy) return;
    if (!draft.ref_tipo) { toast.error('Elige el tipo de referencia'); return; }
    setBusy(true);
    try {
      if (mode === 'new') {
        const d = await mutate(`${API}/referencias`, 'POST', { ref_tipo: draft.ref_tipo, ref_datos: draft.ref_datos });
        await load(); onChange(d.data.id); setMode(null);
        toast.success('Referencia creada');
      } else if (mode === 'edit' && selected) {
        await mutate(`${API}/referencias`, 'PATCH', { id: selected.id, ref_tipo: draft.ref_tipo, ref_datos: draft.ref_datos });
        await load(); setMode(null);
        toast.success('Referencia actualizada (afecta a todas las fuentes que la usan)');
      }
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 space-y-2.5">
      <Field label="Referencia bibliográfica (APA)">
        <select className={GLASS_INPUT} value={mode === 'new' ? '__new__' : (value != null ? String(value) : '')} onChange={(e) => onSelect(e.target.value)}>
          <option value="">— Sin referencia bibliográfica —</option>
          {refs.map((r) => <option key={r.id} value={r.id}>{refLabel(r)}{r.usos > 1 ? ` · usada ${r.usos}×` : ''}</option>)}
          <option value="__new__">➕ Nueva referencia…</option>
        </select>
        <p className="text-[10px] text-white/40 mt-1" style={mf}>Reutiliza una referencia existente o crea una nueva. Editar una referencia afecta a todas las fuentes que la usan.</p>
      </Field>

      {/* Referencia seleccionada (solo lectura) + editar */}
      {selected && !mode && (
        <div className="rounded-md bg-black/40 border border-white/10 p-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9.5px] uppercase tracking-wide text-white/40" style={df}>{apaTipoLabel(selected.ref_tipo)}</p>
            <button onClick={startEdit} className="text-[10.5px] text-accent hover:underline" style={mf}>Editar referencia</button>
          </div>
          <ApaReference tipo={selected.ref_tipo} datos={selected.ref_datos} className="text-[11.5px] text-white/85 leading-relaxed" />
        </div>
      )}

      {/* Editor (crear / editar) */}
      {mode && (
        <div className="rounded-md border border-white/10 bg-black/30 p-2 space-y-2.5">
          <p className="text-[10.5px] font-semibold text-white/70" style={df}>{mode === 'new' ? 'Nueva referencia' : 'Editar referencia'}{mode === 'edit' && selected?.usos > 1 ? ` · usada en ${selected.usos} fuentes` : ''}</p>
          <ApaRefEditor draft={draft} setDraft={setDraft as any} />
          <div className="flex justify-end gap-2">
            <button onClick={cancel} disabled={busy} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
            <button onClick={saveRef} disabled={busy} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{busy ? 'Guardando…' : mode === 'new' ? 'Crear y asociar' : 'Guardar cambios'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function FuenteForm({ form, setForm, onCancel, onSave, saving }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-white" style={df}>{form.id ? 'Editar fuente' : 'Nueva fuente'}</h3>
        <button onClick={onCancel} className="text-white/50 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      {/* 2 columnas: referencia bibliográfica a la IZQUIERDA · datos de la fuente a la derecha.
          Así el formulario no crece en altura (la referencia puede tener muchos campos). */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Izquierda: referencia bibliográfica (APA) — por asociación (tabla gd_referencias) */}
        <div>
          <ReferenciaPicker value={form.referencia_id ?? null} onChange={(id) => setForm((f: any) => ({ ...f, referencia_id: id }))} />
        </div>
        {/* Derecha: datos de la fuente */}
        <div className="space-y-3">
          <Field label="Tipo de dato">
            <Segmented value={form.tipo_dato} onChange={(v: TipoDato) => setForm((f: any) => ({ ...f, tipo_dato: v }))} options={[{ value: 'cantidad', label: TIPO_DATO_LABEL.cantidad }, { value: 'cualidad', label: TIPO_DATO_LABEL.cualidad }]} />
          </Field>
          {!form.id && (
            <Field label="Tipo de lógica">
              <Segmented value={form.tipo_logica} onChange={(v: TipoLogica) => setForm((f: any) => ({ ...f, tipo_logica: v }))} options={[{ value: 'premisa', label: TIPO_LOGICA_LABEL.premisa }, { value: 'peso', label: TIPO_LOGICA_LABEL.peso }]} />
              <p className="text-[10.5px] text-white/45 mt-1" style={mf}>{form.tipo_logica === 'premisa' ? 'Premisa: aporta a una verdad lógica (se codifica REF-n).' : 'Peso: altera la credibilidad de una premisa (Ref-n global).'}</p>
            </Field>
          )}
          <Field label="Contenido">
            <AutoTextarea className={GLASS_INPUT} value={form.contenido} onChange={(e: any) => setForm((f: any) => ({ ...f, contenido: e.target.value }))} placeholder="Ej. 30 de cada 100 niños ingresan a una escuela particular." autoFocus />
          </Field>
          <Field label="Nivel de confianza / credibilidad">
            <CredSlider value={form.credibilidad} onChange={(v) => setForm((f: any) => ({ ...f, credibilidad: v }))} />
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} disabled={saving} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
        <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{saving ? 'Guardando…' : form.id ? 'Guardar' : 'Agregar'}</button>
      </div>
    </div>
  );
}

function ProblemaForm({ form, setForm, onCancel, onSave, saving }: any) {
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
        <button onClick={onCancel} disabled={saving} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
        <button onClick={onSave} disabled={saving} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{saving ? 'Guardando…' : form.id ? 'Guardar' : 'Agregar'}</button>
      </div>
    </div>
  );
}

// Detalle del nodo seleccionado (por tipo).
function NodeDetail({ node, fuentes, pesos, enfrentamientos, codigos, categorias, problemas, piezas, rompecabezasList, subtemasList, temasList, onEditFuente, onEditProblema, onEditRomp, onEditSubtema, onEditTema, onReload, onDelete, onClose, onOpenAgent }: any) {
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
        {f.ref_tipo && formatApaText(f.ref_tipo, f.ref_datos) && (
          <div className="mt-3 rounded-md border border-white/10 bg-white/[0.03] p-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9.5px] uppercase tracking-wide text-white/40" style={df}>Referencia · {apaTipoLabel(f.ref_tipo)}</p>
              <button
                onClick={() => { navigator.clipboard?.writeText(formatApaText(f.ref_tipo, f.ref_datos)); toast.success('Referencia copiada'); }}
                className="text-[10.5px] text-accent hover:underline" style={mf}
              >Copiar</button>
            </div>
            <ApaReference tipo={f.ref_tipo} datos={f.ref_datos} className="text-[12px] text-white/85 leading-relaxed" />
          </div>
        )}
        {f.tipo_logica === 'premisa' && <PesosManager premisa={f} pesos={pesos} onReload={onReload} onOpenAgent={onOpenAgent} />}
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
    return <CodigoDetail c={c} premisas={fuentes.filter((x: Fuente) => x.tipo_logica === 'premisa')} enfrentamientos={enfrentamientos} onReload={onReload} onDelete={onDelete} header={header} />;
  }

  if (node.type === 'categoria') {
    const cat = categorias.find((x: Categoria) => x.id === node.id);
    if (!cat) return header;
    return <CategoriaDetail cat={cat} onReload={onReload} onDelete={onDelete} header={header} />;
  }

  if (node.type === 'pieza') {
    const pz = piezas.find((x: Pieza) => x.id === node.id) as Pieza | undefined;
    if (!pz) return header;
    return (
      <div>
        {header}
        <Meta rows={[['Tipo', PIEZA_TIPO_LABEL[pz.tipo]], ['Estado', pz.estado === 'completa' ? 'Completa' : 'Incompleta'], ['Códigos', String(pz.codigoIds.length)], ['Variables', String(pz.variables.length)]]} />
        {pz.estado !== 'completa' && (
          <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-md bg-white/[0.04] border border-white/10">
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-[11px] text-white/70" style={mf}>En construcción en Gestión de Condiciones.</span>
          </div>
        )}
        <p className="text-[10.5px] text-white/45 mt-2 mb-2" style={mf}>Las piezas provienen del sistema de metodología condiciológica (aquí son de solo lectura).</p>
        {pz.variables.length > 0 && (
          <div className="space-y-1">
            {pz.variables.map((v) => (
              <div key={v.id} className="flex items-center gap-2 text-[11px] bg-white/[0.04] rounded px-2 py-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: VARIABLE_FACTOR_COLOR[v.factor] }} />
                <span className="text-white/85 flex-1 truncate" style={mf}>{v.nombre}</span>
                <span className="text-[9.5px] text-white/50" style={mf}>{VARIABLE_FACTOR_LABEL[v.factor]} · {VARIABLE_TIPO_LABEL[(v.tipo_var as 'fija' | 'cambia')] || v.tipo_var}</span>
              </div>
            ))}
          </div>
        )}
        <DetailActions onDelete={onDelete} />
      </div>
    );
  }

  if (node.type === 'rompecabezas') {
    const rc = rompecabezasList.find((x: Rompecabezas) => x.id === node.id) as Rompecabezas | undefined;
    if (!rc) return header;
    return (
      <div>
        {header}
        <Meta rows={[['Situación', rc.situacion_nombre || '—'], ['Piezas', String(rc.piezaIds.length)]]} />
        <p className="text-[10.5px] text-white/45 mt-2" style={mf}>Expresión formada por la unión de piezas (parámetros = sus variables).</p>
        <DetailActions onEdit={() => onEditRomp(rc)} onDelete={onDelete} />
      </div>
    );
  }

  if (node.type === 'subtema') {
    const st = subtemasList.find((x: Subtema) => x.id === node.id) as Subtema | undefined;
    if (!st) return header;
    return (
      <div>
        {header}
        <p className="text-[11px] font-semibold text-white/70 mt-1 mb-1" style={df}>Rompecabezas ({st.rompecabezas.length})</p>
        <div className="space-y-1">
          {st.rompecabezas.map((r, i) => (
            <div key={r.id} className="flex items-center gap-2 text-[11px] bg-white/[0.04] rounded px-2 py-1">
              <span className="text-white/40 tabular-nums w-4" style={mf}>{i + 1}.</span>
              <span className="text-white/85 truncate" style={mf}>{r.nombre}</span>
            </div>
          ))}
          {st.rompecabezas.length === 0 && <p className="text-[11px] text-white/45" style={mf}>Sin rompecabezas.</p>}
        </div>
        {st.hipotesis.length > 0 && (
          <>
            <p className="text-[11px] font-semibold text-white/70 mt-2 mb-1" style={df}>Hipótesis</p>
            <ul className="space-y-1">
              {st.hipotesis.map((h) => (
                <li key={h.id} className="text-[11px] text-white/75 bg-white/[0.04] rounded px-2 py-1" style={mf}>• {h.texto}</li>
              ))}
            </ul>
          </>
        )}
        <DetailActions onEdit={() => onEditSubtema(st)} onDelete={onDelete} />
      </div>
    );
  }

  if (node.type === 'tema') {
    const tm = temasList.find((x: Tema) => x.id === node.id) as Tema | undefined;
    if (!tm) return header;
    return (
      <div>
        {header}
        {tm.prosa && <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto" style={mf}>{tm.prosa}</p>}
        <Meta rows={[['Subtemas', String(tm.subtemas.length)], ['Materias', tm.materias.map((m) => m.nombre).join(', ') || '—'], ['Problemas', String(tm.problemas.length)]]} />
        <p className="text-[10.5px] text-white/40 mt-2" style={mf}>La prosa describe los subtemas sin inventar lógicas; solo las hipótesis van marcadas como supuestos.</p>
        <DetailActions onEdit={() => onEditTema(tm)} onDelete={onDelete} />
      </div>
    );
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

// Confirmación de borrado de una premisa: permite eliminar solo la premisa o también sus pesos asociados.
function PremisaDeleteConfirm({ node, pesoCount, onCancel, onDeleteOnly, onDeleteWithPesos }: {
  node: GdGraphNode; pesoCount: number; onCancel: () => void; onDeleteOnly: () => void; onDeleteWithPesos: () => void;
}) {
  return (
    <PixelModal open onClose={onCancel} title="Eliminar premisa" size="sm">
      <div className="space-y-4">
        <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>
          ¿Eliminar la premisa <b>{node.title}</b>? Esta acción no se puede deshacer.{' '}
          {pesoCount > 0
            ? <>Tiene <b>{pesoCount}</b> peso{pesoCount === 1 ? '' : 's'} asociado{pesoCount === 1 ? '' : 's'}; elige si eliminarlos también o conservarlos.</>
            : 'No tiene pesos asociados.'}
        </p>
        <div className="flex flex-col gap-2">
          {pesoCount > 0 && (
            <button type="button" onClick={onDeleteWithPesos} className="dlg-btn dlg-btn--danger px-4 py-2 text-[10px] border-2 border-red-500/60 text-red-400 hover:bg-red-950/30 transition-colors" style={df}>
              Eliminar la premisa y sus {pesoCount} peso{pesoCount === 1 ? '' : 's'}
            </button>
          )}
          <button type="button" onClick={onDeleteOnly} className="dlg-btn dlg-btn--danger px-4 py-2 text-[10px] border-2 border-red-500/60 text-red-400 hover:bg-red-950/30 transition-colors" style={df}>
            Eliminar solo la premisa{pesoCount > 0 ? ' (conservar pesos)' : ''}
          </button>
          <button type="button" onClick={onCancel} className="dlg-btn px-3 py-2 text-[10px] border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors" style={df}>
            Cancelar
          </button>
        </div>
      </div>
    </PixelModal>
  );
}

// Modal "Conexión de pesos": pestaña para conectar un peso existente + pestaña de los pesos ya conectados.
function ConexionPesosModal({ premisaId, allPesos, usableP, applied, busy, initialTab = 'conectar', onConnect, onRemove, onClose }: {
  premisaId: number; allPesos: Fuente[]; usableP: Fuente[]; applied: any[]; busy: boolean; initialTab?: 'conectar' | 'conectados';
  onConnect: (id: number) => void; onRemove: (pfId: number) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<'conectar' | 'conectados'>(initialTab);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Fuente | null>(null);
  // Sugerencias de IA: pesos existentes pertinentes para la premisa.
  const [suggesting, setSuggesting] = useState(false);
  const [suggested, setSuggested] = useState<Record<number, string>>({});
  const runSuggest = async () => {
    if (suggesting) return;
    setSuggesting(true);
    try {
      const res = await fetch(`${API}/pesos-suggest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ premisa_id: premisaId }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo evaluar con IA');
      const map: Record<number, string> = {};
      (d.suggestions || []).forEach((s: any) => { map[s.id] = s.motivo; });
      setSuggested(map);
      const n = Object.keys(map).length;
      if (n > 0) toast.success(`La IA sugiere ${n} peso(s) pertinente(s)`);
      else toast(`La IA evaluó ${d.evaluados || 0} pesos: ninguno claramente pertinente.`);
    } catch (e: any) { toast.error(e.message); }
    finally { setSuggesting(false); }
  };
  const filtered = usableP
    .filter((p) => { const t = q.trim().toLowerCase(); return !t || `${p.nomenclatura} ${p.contenido}`.toLowerCase().includes(t); })
    .sort((a, b) => (suggested[b.id] ? 1 : 0) - (suggested[a.id] ? 1 : 0));
  const TabBtn = ({ id, label, count }: { id: 'conectar' | 'conectados'; label: string; count: number }) => (
    <button onClick={() => setTab(id)} className={`px-3 py-1.5 text-[12px] font-medium border-b-2 transition-colors ${tab === id ? 'border-accent text-white' : 'border-transparent text-white/50 hover:text-white/80'}`} style={mf}>
      {label} <span className="text-[10.5px] text-white/40">({count})</span>
    </button>
  );
  return (
    <FloatingWindow open onClose={onClose} title="Conexión de pesos" initialWidth={580} initialHeight={600} minWidth={400} minHeight={380}>
      <div className="flex flex-col h-full bg-[#0d0d14]">
        <div className="flex items-center gap-1 px-2 border-b border-white/10 shrink-0">
          <TabBtn id="conectar" label="Conectar peso" count={usableP.length} />
          <TabBtn id="conectados" label="Conectados" count={applied.length} />
        </div>

        {tab === 'conectar' ? (
          <>
            <div className="p-2 border-b border-white/10 shrink-0 space-y-1.5">
              <input className={GLASS_INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nomenclatura o contenido…" autoFocus />
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-white/40 px-0.5" style={mf}>{filtered.length} de {usableP.length} pesos disponibles</p>
                <button onClick={runSuggest} disabled={suggesting || usableP.length === 0} className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-white bg-accent/90 hover:bg-accent rounded-md disabled:opacity-40 disabled:cursor-not-allowed" style={mf}>
                  <Sparkles className="w-3.5 h-3.5" />{suggesting ? 'Evaluando…' : 'Sugerir con IA'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {filtered.length === 0 && <p className="text-[12px] text-white/45 text-center py-6" style={mf}>{usableP.length === 0 ? 'No hay otros pesos para conectar.' : 'Sin pesos que coincidan.'}</p>}
              {filtered.map((p) => {
                const motivo = suggested[p.id];
                return (
                  <button key={p.id} onClick={() => setSel(p)} className={`w-full text-left rounded-md px-2.5 py-2 border transition-colors ${sel?.id === p.id ? 'bg-accent/20 border-accent/40' : motivo ? 'bg-accent/[0.08] border-accent/30 hover:bg-accent/15' : 'bg-white/[0.04] border-white/8 hover:bg-white/10'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#60a5fa]" style={df}>{p.nomenclatura}</span>
                      <span className="text-[10.5px] text-white/50" style={mf}>{Math.round(p.credibilidad)}%</span>
                      {motivo && <span className="inline-flex items-center gap-0.5 text-[9.5px] font-semibold text-accent" style={df}><Sparkles className="w-2.5 h-2.5" /> IA</span>}
                      <span className="text-[10px] text-white/35 ml-auto" style={mf}>{TIPO_DATO_LABEL[p.tipo_dato]}</span>
                    </div>
                    <p className="text-[11.5px] text-white/75 mt-0.5 line-clamp-2" style={mf}>{p.contenido}</p>
                    {motivo && <p className="text-[10.5px] text-accent/90 mt-1 italic" style={mf}>✨ {motivo}</p>}
                  </button>
                );
              })}
            </div>
            {sel && (
              <div className="border-t border-white/10 p-2.5 space-y-2 max-h-[46%] overflow-y-auto shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#60a5fa]" style={df}>{sel.nomenclatura}</span>
                  <span className="text-[10.5px] text-white/50" style={mf}>Credibilidad {Math.round(sel.credibilidad)}%</span>
                </div>
                <p className="text-[12px] text-white/85 leading-relaxed" style={mf}>{sel.contenido}</p>
                {sel.ref_tipo && formatApaText(sel.ref_tipo, sel.ref_datos) && (
                  <div className="rounded-md border border-white/10 bg-white/[0.03] p-2">
                    <p className="text-[9px] uppercase tracking-wide text-white/40 mb-0.5" style={df}>Referencia · {apaTipoLabel(sel.ref_tipo)}</p>
                    <ApaReference tipo={sel.ref_tipo} datos={sel.ref_datos} className="text-[11px] text-white/70 leading-relaxed" />
                  </div>
                )}
                <div className="flex justify-end">
                  <button onClick={() => onConnect(sel.id)} disabled={busy} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{busy ? 'Conectando…' : 'Conectar este peso'}</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 min-h-0">
            {applied.length === 0 && <p className="text-[12px] text-white/45 text-center py-6" style={mf}>Aún no hay pesos conectados a esta premisa.</p>}
            {applied.map((a) => {
              const full = allPesos.find((p) => p.id === a.peso_fuente_id);
              return (
                <div key={a.id} className="rounded-md px-2.5 py-2 bg-white/[0.04] border border-white/8">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#60a5fa]" style={df}>{a.peso_nomenclatura}</span>
                    <span className="text-[10.5px] text-white/50 tabular-nums" style={mf}>{Math.round(a.cred_antes)}→{Math.round(a.cred_despues)}%</span>
                    {full && <span className="text-[10px] text-white/35" style={mf}>{TIPO_DATO_LABEL[full.tipo_dato]}</span>}
                    <button onClick={() => onRemove(a.peso_fuente_id)} disabled={busy} className="ml-auto text-white/40 hover:text-red-400 disabled:opacity-40" title="Quitar de la premisa"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <p className="text-[11.5px] text-white/80 mt-1 leading-relaxed" style={mf}>{full?.contenido || a.peso_contenido}</p>
                  {full?.ref_tipo && formatApaText(full.ref_tipo, full.ref_datos) && (
                    <p className="text-[10.5px] text-white/45 mt-1" style={mf}>{formatApaText(full.ref_tipo, full.ref_datos)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
}

function PesosManager({ premisa, pesos, onReload, onOpenAgent }: { premisa: Fuente; pesos: Fuente[]; onReload: () => void; onOpenAgent?: (p: Fuente) => void }) {
  const [applied, setApplied] = useState<any[]>([]);
  const [connectTab, setConnectTab] = useState<'conectar' | 'conectados' | null>(null);
  const [busy, setBusy] = useState(false);
  // Formulario inline para crear un peso nuevo y aplicarlo (una premisa puede tener varios pesos).
  const [showNew, setShowNew] = useState(false);
  const [nuevo, setNuevo] = useState<{ contenido: string; credibilidad: number; tipo_dato: TipoDato }>({ contenido: '', credibilidad: 50, tipo_dato: 'cantidad' });

  const load = useCallback(async () => {
    try { const d = await fetch(`${API}/pesos?premisa_id=${premisa.id}`).then((r) => r.json()); setApplied(d.data || []); }
    catch { /* noop */ }
  }, [premisa.id]);
  useEffect(() => { load(); }, [load]);

  const applyExisting = async (id: number) => {
    if (!id || busy) return;
    setBusy(true);
    try {
      await mutate(`${API}/pesos`, 'POST', { premisa_fuente_id: premisa.id, peso_fuente_id: id });
      toast.success('Peso conectado');
      await load(); await onReload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const createAndApply = async () => {
    if (busy) return;
    if (!nuevo.contenido.trim()) { toast.error('Escribe el contenido del peso'); return; }
    setBusy(true);
    try {
      const created = await mutate(`${API}/fuentes`, 'POST', { problematica_id: premisa.problematica_id, tipo_dato: nuevo.tipo_dato, tipo_logica: 'peso', contenido: nuevo.contenido, credibilidad: nuevo.credibilidad });
      await mutate(`${API}/pesos`, 'POST', { premisa_fuente_id: premisa.id, peso_fuente_id: created.data.id });
      toast.success('Peso creado y aplicado');
      setNuevo({ contenido: '', credibilidad: 50, tipo_dato: 'cantidad' });
      setShowNew(false);
      await load(); await onReload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (pfId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await mutate(`${API}/pesos`, 'DELETE', { premisa_fuente_id: premisa.id, peso_fuente_id: pfId });
      await load(); await onReload();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const usableP = pesos.filter((p) => !applied.some((a) => a.peso_fuente_id === p.id));

  return (
    <div className="mt-3 pt-2.5 border-t border-white/10">
      <p className="text-[11px] font-semibold text-white/70 mb-1.5 flex items-center gap-1.5" style={df}><Weight className="w-3.5 h-3.5 text-[#60a5fa]" /> Pesos que la refuerzan</p>
      <p className="text-[10.5px] text-white/40 mb-1.5" style={mf}>Una premisa puede tener varios pesos; cada uno aporta credibilidad (promedio). Para contradecir, enfrenta dos premisas.</p>
      {onOpenAgent && (
        <button onClick={() => onOpenAgent(premisa)} className="w-full mb-2 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-medium text-white bg-accent/90 hover:bg-accent rounded-md" style={mf}>
          <Bot className="w-3.5 h-3.5" /> Buscar pesos con IA (Scopus)
        </button>
      )}
      {applied.length === 0 && <p className="text-[11px] text-white/45 mb-2" style={mf}>Ninguno aplicado aún.</p>}
      <div className="space-y-1 mb-2">
        {applied.slice(0, 6).map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[11px] bg-white/[0.04] rounded px-2 py-1">
            <span className="font-bold text-[#60a5fa]" style={df}>{a.peso_nomenclatura}</span>
            <span className="text-white/50 truncate flex-1" style={mf}>{a.peso_contenido?.slice(0, 24)}</span>
            <span className="text-white/60 tabular-nums" style={mf}>{Math.round(a.cred_antes)}→{Math.round(a.cred_despues)}%</span>
            <button onClick={() => remove(a.peso_fuente_id)} className="text-white/40 hover:text-red-400"><X className="w-3 h-3" /></button>
          </div>
        ))}
        {applied.length > 6 && (
          <button onClick={() => setConnectTab('conectados')} className="w-full inline-flex items-center justify-center gap-1 text-[11px] text-accent hover:underline py-0.5" style={mf}>
            Ver más ({applied.length - 6}) <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
      {/* Conectar un peso existente → modal "Conexión de pesos" (pestaña Conectar) */}
      {usableP.length > 0 && (
        <button onClick={() => setConnectTab('conectar')} className={`${GLASS_BTN} w-full mb-2 px-2.5 py-1.5 text-[11.5px]`} style={mf}>
          <Search className="w-3.5 h-3.5" /> Conectar peso existente ({usableP.length})
        </button>
      )}
      {connectTab && (
        <ConexionPesosModal
          premisaId={premisa.id} allPesos={pesos} usableP={usableP} applied={applied} busy={busy} initialTab={connectTab}
          onConnect={applyExisting} onRemove={remove} onClose={() => setConnectTab(null)}
        />
      )}
      {/* Crear un peso nuevo y aplicarlo */}
      {!showNew ? (
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 text-[11px] text-accent hover:underline" style={mf}>
          <Plus className="w-3.5 h-3.5" /> Nuevo peso
        </button>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2 space-y-2">
          <Field label="Contenido del peso">
            <AutoTextarea className={GLASS_INPUT} value={nuevo.contenido} onChange={(e: any) => setNuevo((n) => ({ ...n, contenido: e.target.value }))} placeholder="La verdad que aporta este peso…" autoFocus minHeight={54} />
          </Field>
          <Field label="Tipo de dato">
            <Segmented value={nuevo.tipo_dato} onChange={(v: TipoDato) => setNuevo((n) => ({ ...n, tipo_dato: v }))} options={[{ value: 'cantidad', label: TIPO_DATO_LABEL.cantidad }, { value: 'cualidad', label: TIPO_DATO_LABEL.cualidad }]} />
          </Field>
          <Field label="Credibilidad del peso">
            <CredSlider value={nuevo.credibilidad} onChange={(v) => setNuevo((n) => ({ ...n, credibilidad: v }))} />
          </Field>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowNew(false); setNuevo({ contenido: '', credibilidad: 50, tipo_dato: 'cantidad' }); }} disabled={busy} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
            <button onClick={createAndApply} disabled={busy} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{busy ? 'Guardando…' : 'Agregar peso'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Chat con el agente IA (Claude CLI local) que genera pesos desde Scopus para una premisa.
function PesosAgentChat({ premisa, onClose, onReload }: { premisa: Fuente; onClose: () => void; onReload: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [claudeSid, setClaudeSid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sessRef = useRef<{ s: string | null; c: string | null }>({ s: null, c: null });

  const runTurn = async (message: string) => {
    if (busy) return;
    setBusy(true);
    setMessages((m) => [...m, { role: 'user', text: message }]);
    try {
      const res = await fetch(`${API}/pesos-agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ premisa_id: premisa.id, session_id: sessRef.current.s, claude_session_id: sessRef.current.c, message }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Error del agente');
      sessRef.current = { s: d.session_id, c: d.claude_session_id };
      setSessionId(d.session_id); setClaudeSid(d.claude_session_id);
      setMessages((m) => [...m, ...(d.activity || [])]);
      await onReload();
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'error', text: e.message }]);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (startedRef.current) return; startedRef.current = true;
    runTurn('Busca en Scopus datos recientes (últimos 5 años) que refuercen esta premisa y agrégalos como pesos, imitando el estilo de los pesos existentes.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages, busy]);

  const send = () => { const t = input.trim(); if (!t || busy) return; setInput(''); runTurn(t); };

  const toolIcon = (kind: string) => {
    if (kind === 'scopus_search') return <Search className="w-3 h-3 text-[#f59e0b]" />;
    if (kind === 'add_weight') return <Weight className="w-3 h-3 text-[#60a5fa]" />;
    if (kind === 'error') return <AlertTriangle className="w-3 h-3 text-red-400" />;
    return <Check className="w-3 h-3 text-emerald-400" />;
  };

  return (
    <FloatingWindow open onClose={onClose} title={`Agente de pesos · ${premisa.nomenclatura}`} initialWidth={580} initialHeight={640} minWidth={380} minHeight={360}>
      <div className="flex flex-col h-full bg-[#0d0d14]">
        <div className="px-3 py-1.5 border-b border-white/10 flex items-center gap-1.5 text-[10.5px] text-white/50" style={mf}>
          <Bot className="w-3.5 h-3.5 text-accent" /> Refuerza la premisa con pesos de Scopus (últimos 5 años). Solo trabaja sobre los pesos de esta sesión.
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
          {messages.map((m, i) => {
            if (m.role === 'user') return (
              <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-lg bg-accent/25 border border-accent/30 px-2.5 py-1.5 text-[12px] text-white" style={mf}>{m.text}</div></div>
            );
            if (m.role === 'assistant') return (
              <div key={i} className="flex justify-start"><div className="max-w-[88%] rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-[12px] text-white/90 whitespace-pre-wrap" style={mf}>{m.text}</div></div>
            );
            if (m.role === 'error') return (
              <div key={i} className="text-[11.5px] text-red-300 bg-red-500/10 border border-red-400/20 rounded px-2 py-1" style={mf}>⚠ {m.text}</div>
            );
            // tool
            return (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-white/60 pl-1" style={mf}>
                <span className="mt-0.5">{toolIcon(m.kind)}</span>
                <div><span className="text-white/75">{m.label}</span>{m.text ? <p className="text-white/45 mt-0.5">{m.text}</p> : null}</div>
              </div>
            );
          })}
          {busy && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/50" style={mf}>
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> El agente está trabajando…
            </div>
          )}
        </div>
        <div className="border-t border-white/10 p-2 flex gap-2">
          <input
            className={`${GLASS_INPUT} flex-1`} value={input} disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
            placeholder={busy ? 'Espera a que termine…' : 'Pídele más pesos o cambios (ej. "agrega 2 más sobre X")'}
          />
          <button onClick={send} disabled={busy || !input.trim()} className="px-2.5 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1" style={mf}><Send className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </FloatingWindow>
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

function CodigoDetail({ c, premisas = [], enfrentamientos = [], onReload, onDelete, header }: any) {
  const [texto, setTexto] = useState(c.texto);
  const [evTitulo, setEvTitulo] = useState('');
  const [evUrl, setEvUrl] = useState('');
  // Edición de las premisas/enfrentamientos que componen el código.
  const [editU, setEditU] = useState(false);
  const [sel, setSel] = useState<{ kind: 'premisa' | 'enfrentamiento'; id: number }[]>(c.unidadesSel || []);
  const [savingU, setSavingU] = useState(false);
  useEffect(() => { setSel(c.unidadesSel || []); setEditU(false); }, [c.id, c.unidadesSel]);
  const onU = (kind: 'premisa' | 'enfrentamiento', id: number) => sel.some((u) => u.kind === kind && u.id === id);
  const toggleU = (kind: 'premisa' | 'enfrentamiento', id: number) => setSel((s) => s.some((u) => u.kind === kind && u.id === id) ? s.filter((u) => !(u.kind === kind && u.id === id)) : [...s, { kind, id }]);
  const unitLabel = (u: { kind: string; id: number }) => u.kind === 'premisa'
    ? (premisas.find((p: Fuente) => p.id === u.id)?.nomenclatura || '?')
    : (enfrentamientos.find((e: Enfrentamiento) => e.id === u.id)?.nomenclatura || '?');
  const saveUnidades = async () => {
    if (savingU) return;
    if (sel.length < 1) { toast.error('Elige al menos una premisa'); return; }
    setSavingU(true);
    try { await mutate(`${API}/codigos`, 'PATCH', { id: c.id, unidades: sel }); toast.success('Premisas del código actualizadas'); setEditU(false); await onReload(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSavingU(false); }
  };

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
        <AutoTextarea className={GLASS_INPUT} value={texto} onChange={(e: any) => setTexto(e.target.value)} placeholder="Ej. Un adulto sin trabajo cae en desesperación el 70% de las veces por motivos económicos y presión familiar." />
      </Field>
      <div className="flex justify-end mt-1.5"><button onClick={saveTexto} className={`${GLASS_BTN} px-2.5 py-1 text-[12px]`} style={mf}><Check className="w-3 h-3" /> Guardar</button></div>

      {/* Premisas / enfrentamientos que componen el código */}
      <div className="mt-3 pt-2.5 border-t border-white/10">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold text-white/70" style={df}>Premisas del código ({(c.unidadesSel || []).length})</p>
          <button onClick={() => setEditU((v) => !v)} className="text-[10.5px] text-accent hover:underline" style={mf}>{editU ? 'Cerrar' : 'Editar'}</button>
        </div>
        {!editU ? (
          <div className="flex flex-wrap gap-1">
            {(c.unidadesSel || []).length === 0 && <span className="text-[11px] text-white/45" style={mf}>Sin premisas.</span>}
            {(c.unidadesSel || []).map((u: any, i: number) => (
              <span key={i} className={`text-[10.5px] font-bold px-1.5 py-0.5 rounded ${u.kind === 'premisa' ? 'bg-[#22d3ee]/15 text-[#22d3ee]' : 'bg-[#a855f7]/15 text-[#a855f7]'}`} style={df}>{unitLabel(u)}</span>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[10.5px] text-white/45" style={mf}>Marca las premisas (sueltas o enfrentadas) que componen este código. Cambia la nomenclatura (COD-…).</p>
            <div>
              <p className="text-[10.5px] font-semibold text-white/60 mb-1" style={df}>Premisas ({premisas.length})</p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {premisas.map((p: Fuente) => (
                  <button key={p.id} onClick={() => toggleU('premisa', p.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1 rounded text-[11px] transition-colors ${onU('premisa', p.id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${onU('premisa', p.id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{onU('premisa', p.id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
                    <span className="font-bold text-[#22d3ee]" style={df}>{p.nomenclatura}</span>
                    <span className="text-white/70 truncate">{p.contenido}</span>
                  </button>
                ))}
              </div>
            </div>
            {enfrentamientos.length > 0 && (
              <div>
                <p className="text-[10.5px] font-semibold text-white/60 mb-1" style={df}>Premisas enfrentadas ({enfrentamientos.length})</p>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {enfrentamientos.map((e: Enfrentamiento) => (
                    <button key={e.id} onClick={() => toggleU('enfrentamiento', e.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1 rounded text-[11px] transition-colors ${onU('enfrentamiento', e.id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${onU('enfrentamiento', e.id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{onU('enfrentamiento', e.id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
                      <span className="font-bold text-[#a855f7]" style={df}>{e.nomenclatura}</span>
                      <span className="text-white/70 truncate">{e.texto || '(sin texto)'}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button onClick={() => { setSel(c.unidadesSel || []); setEditU(false); }} disabled={savingU} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
              <button onClick={saveUnidades} disabled={savingU} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{savingU ? 'Guardando…' : 'Guardar premisas'}</button>
            </div>
          </div>
        )}
      </div>

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
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (kind: 'premisa' | 'enfrentamiento', id: number) => {
    setSel((s) => s.some((u) => u.kind === kind && u.id === id) ? s.filter((u) => !(u.kind === kind && u.id === id)) : [...s, { kind, id }]);
  };
  const on = (kind: 'premisa' | 'enfrentamiento', id: number) => sel.some((u) => u.kind === kind && u.id === id);
  const term = q.trim().toLowerCase();
  const fPrem = premisas.filter((p) => !term || `${p.nomenclatura} ${p.contenido}`.toLowerCase().includes(term));
  const fEnf = enfrentamientos.filter((e) => !term || `${e.nomenclatura} ${e.texto || ''}`.toLowerCase().includes(term));

  const save = async () => {
    if (busy) return;
    if (sel.length < 1) { toast.error('Elige al menos una premisa'); return; }
    setBusy(true);
    try {
      await mutate(`${API}/codigos`, 'POST', { problematica_id: probId, texto, unidades: sel });
      toast.success('Código creado (no verificado)');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); }
  };

  const Item = ({ kind, id, nomen, detalle, color }: { kind: 'premisa' | 'enfrentamiento'; id: number; nomen: string; detalle: string; color: string }) => (
    <button onClick={() => toggle(kind, id)} className={`w-full flex items-start gap-2 text-left px-2 py-1.5 rounded text-[11.5px] transition-colors ${on(kind, id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
      <span className={`w-3.5 h-3.5 mt-0.5 rounded border flex items-center justify-center shrink-0 ${on(kind, id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{on(kind, id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
      <span className="font-bold shrink-0" style={{ ...df, color }}>{nomen}</span>
      <span className="text-white/65 line-clamp-2">{detalle}</span>
    </button>
  );

  return (
    <FloatingWindow open onClose={onClose} title="Nuevo código" initialWidth={800} initialHeight={620} minWidth={560} minHeight={440}>
      <div className="flex h-full gap-3">
        {/* Izquierda: TODAS las premisas / enfrentamientos (buscador + scroll a lo alto) */}
        <div className="w-[45%] flex flex-col min-h-0 border-r border-white/10 pr-3">
          <p className="text-[11px] font-semibold text-white/70 mb-1.5" style={df}>Premisas y enfrentamientos</p>
          <input className={GLASS_INPUT} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nomenclatura o contenido…" autoFocus />
          <div className="flex-1 overflow-y-auto min-h-0 mt-2 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1 px-0.5" style={df}>Premisas ({fPrem.length})</p>
              <div className="space-y-1">
                {fPrem.map((p) => <Item key={`p${p.id}`} kind="premisa" id={p.id} nomen={p.nomenclatura} detalle={p.contenido} color="#22d3ee" />)}
                {fPrem.length === 0 && <p className="text-[11px] text-white/35 px-1" style={mf}>Sin coincidencias.</p>}
              </div>
            </div>
            {enfrentamientos.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/40 mb-1 px-0.5" style={df}>Premisas enfrentadas ({fEnf.length})</p>
                <div className="space-y-1">
                  {fEnf.map((e) => <Item key={`e${e.id}`} kind="enfrentamiento" id={e.id} nomen={e.nomenclatura} detalle={e.texto || '(sin texto)'} color="#a855f7" />)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Derecha: seleccionadas + verdad consecuente + acciones */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-0.5">
            <div>
              <p className="text-[11px] font-semibold text-white/70 mb-1.5" style={df}>Seleccionadas para el código ({sel.length})</p>
              {sel.length === 0 && <p className="text-[11px] text-white/40 bg-white/[0.03] border border-dashed border-white/10 rounded-md px-2.5 py-3 text-center" style={mf}>Elige premisas (sueltas o enfrentadas) del panel izquierdo.</p>}
              <div className="space-y-1">
                {sel.map((u) => {
                  const isP = u.kind === 'premisa';
                  const item: any = isP ? premisas.find((p) => p.id === u.id) : enfrentamientos.find((e) => e.id === u.id);
                  if (!item) return null;
                  return (
                    <div key={`${u.kind}${u.id}`} className="flex items-start gap-2 text-[11.5px] bg-white/[0.05] border border-white/10 rounded-md px-2 py-1.5">
                      <span className="font-bold shrink-0" style={{ ...df, color: isP ? '#22d3ee' : '#a855f7' }}>{item.nomenclatura}</span>
                      <span className="text-white/70 line-clamp-2 flex-1" style={mf}>{isP ? item.contenido : (item.texto || '(sin texto)')}</span>
                      <button onClick={() => toggle(u.kind, u.id)} className="text-white/40 hover:text-red-400 shrink-0" title="Quitar"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            </div>
            <Field label="Verdad consecuente (crece con el texto)">
              <AutoTextarea className={GLASS_INPUT} value={texto} onChange={(e: any) => setTexto(e.target.value)} placeholder="La interpretación lógica que surge de juntar las premisas seleccionadas…" minHeight={90} />
            </Field>
            <p className="text-[10.5px] text-white/40" style={mf}>Nace <b>no verificado</b>; se verifica con eventos de demostración en su detalle.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2 mt-2 border-t border-white/10 shrink-0">
            <button onClick={onClose} disabled={busy} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
            <button onClick={save} disabled={busy || sel.length < 1} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed" style={mf}>{busy ? 'Creando…' : 'Crear código'}</button>
          </div>
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

function RompecabezasModal({ probId, piezas, situaciones, edit, onClose, onSaved }: { probId: number; piezas: Pieza[]; situaciones: Situacion[]; edit: Rompecabezas | null; onClose: () => void; onSaved: () => void }) {
  const [nombre, setNombre] = useState(edit?.nombre || '');
  const [situacionId, setSituacionId] = useState<string>(edit?.situacion_id ? String(edit.situacion_id) : '');
  const [sel, setSel] = useState<number[]>(edit?.piezaIds || []);
  const toggle = (id: number) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const save = async () => {
    if (!nombre.trim()) { toast.error('El nombre es requerido'); return; }
    try {
      const body: any = { nombre, situacion_id: situacionId ? Number(situacionId) : null, pieza_ids: sel };
      if (edit) await mutate(`${API}/rompecabezas`, 'PATCH', { id: edit.id, ...body });
      else await mutate(`${API}/rompecabezas`, 'POST', { problematica_id: probId, ...body });
      toast.success(edit ? 'Rompecabezas actualizado' : 'Rompecabezas creado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title={edit ? 'Editar rompecabezas' : 'Nuevo rompecabezas'} initialWidth={500} initialHeight={540}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-white/60" style={mf}>Une piezas para responder a una situación; es una expresión con nombre legible (se usará luego en dinámica condiciológica).</p>
        <Field label="Nombre (manual)">
          <input className={GLASS_INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Evento laboral de Desesperación" autoFocus />
        </Field>
        <Field label="Situación">
          <select className={GLASS_INPUT} value={situacionId} onChange={(e) => setSituacionId(e.target.value)}>
            <option value="">Sin situación</option>
            {situaciones.map((s) => <option key={s.id} value={s.id} className="bg-[#181826]">{s.nombre}</option>)}
          </select>
          {situaciones.length === 0 && <p className="text-[10.5px] text-white/40 mt-1" style={mf}>Crea situaciones en “Listas”.</p>}
        </Field>
        <div>
          <p className="text-[11px] font-semibold text-white/70 mb-1" style={df}>Piezas ({piezas.length})</p>
          {piezas.length === 0 ? (
            <p className="text-[11px] text-white/45 bg-white/[0.04] rounded px-2 py-2" style={mf}>Aún no hay piezas. Las genera el sistema de metodología condiciológica (revisión/corrección de códigos). El rompecabezas quedará a la espera de piezas.</p>
          ) : (
            <div className="max-h-44 overflow-y-auto space-y-1">
              {piezas.map((p) => (
                <button key={p.id} onClick={() => toggle(p.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-[11.5px] transition-colors ${sel.includes(p.id) ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                  <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${sel.includes(p.id) ? 'bg-accent border-accent' : 'border-white/30'}`}>{sel.includes(p.id) && <Check className="w-2.5 h-2.5 text-white" />}</span>
                  <Puzzle className="w-3 h-3 text-[#14b8a6] shrink-0" />
                  <span className="font-bold text-[#14b8a6]" style={df}>{p.nomenclatura}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{edit ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </FloatingWindow>
  );
}

function SubtemaModal({ probId, rompecabezas, edit, onClose, onSaved }: { probId: number; rompecabezas: Rompecabezas[]; edit: Subtema | null; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(edit?.titulo || '');
  const [hipotesis, setHipotesis] = useState<string[]>(edit?.hipotesis.map((h) => h.texto) || ['']);
  const [sel, setSel] = useState<number[]>(edit?.rompecabezas.map((r) => r.id) || []);
  // Orden = orden de selección.
  const toggle = (id: number) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const setHip = (i: number, v: string) => setHipotesis((h) => h.map((x, j) => (j === i ? v : x)));
  const addHip = () => setHipotesis((h) => [...h, '']);
  const delHip = (i: number) => setHipotesis((h) => h.filter((_, j) => j !== i));

  const save = async () => {
    if (!titulo.trim()) { toast.error('El título es requerido'); return; }
    try {
      const body: any = { titulo, hipotesis: hipotesis.map((h) => h.trim()).filter(Boolean), rompecabezas_ids: sel };
      if (edit) await mutate(`${API}/subtemas`, 'PATCH', { id: edit.id, ...body });
      else await mutate(`${API}/subtemas`, 'POST', { problematica_id: probId, ...body });
      toast.success(edit ? 'Subtema actualizado' : 'Subtema creado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };
  return (
    <FloatingWindow open onClose={onClose} title={edit ? 'Editar subtema' : 'Nuevo subtema'} initialWidth={520} initialHeight={600}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-white/60" style={mf}>Un subtema agrupa rompecabezas en un orden para transmitir una idea; su producto son una o más hipótesis.</p>
        <Field label="Título">
          <input className={GLASS_INPUT} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. La desesperación del desempleo" autoFocus />
        </Field>
        <div>
          <p className="text-[11px] font-semibold text-white/70 mb-1" style={df}>Rompecabezas (orden = selección)</p>
          {rompecabezas.length === 0 ? (
            <p className="text-[11px] text-white/45" style={mf}>Crea rompecabezas primero.</p>
          ) : (
            <div className="max-h-36 overflow-y-auto space-y-1">
              {rompecabezas.map((r) => {
                const idx = sel.indexOf(r.id);
                return (
                  <button key={r.id} onClick={() => toggle(r.id)} className={`w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-[11.5px] transition-colors ${idx >= 0 ? 'bg-accent/25 border border-accent/40' : 'bg-white/[0.04] border border-transparent hover:bg-white/10'}`} style={mf}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[9px] ${idx >= 0 ? 'bg-accent border-accent text-white' : 'border-white/30 text-transparent'}`}>{idx >= 0 ? idx + 1 : ''}</span>
                    <FileText className="w-3 h-3 text-[#818cf8] shrink-0" />
                    <span className="text-white/85 truncate">{r.nombre}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-semibold text-white/70" style={df}>Hipótesis</p>
            <button onClick={addHip} className={`${GLASS_BTN} px-1.5 py-0.5 text-[10.5px]`} style={mf}><Plus className="w-3 h-3" /> Añadir</button>
          </div>
          <div className="space-y-1.5">
            {hipotesis.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <textarea className={`${GLASS_INPUT} resize-none flex-1`} rows={2} value={h} onChange={(e) => setHip(i, e.target.value)} placeholder={`Hipótesis ${i + 1}`} />
                {hipotesis.length > 1 && <button onClick={() => delHip(i)} className="text-white/40 hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{edit ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </FloatingWindow>
  );
}

function TemaModal({ probId, subtemas, materias, problemas, edit, onClose, onSaved }: { probId: number; subtemas: Subtema[]; materias: Materia[]; problemas: Problema[]; edit: Tema | null; onClose: () => void; onSaved: () => void }) {
  const [titulo, setTitulo] = useState(edit?.titulo || '');
  const [prosa, setProsa] = useState(edit?.prosa || '');
  const [selSub, setSelSub] = useState<number[]>(edit?.subtemas.map((s) => s.id) || []);
  const [selMat, setSelMat] = useState<number[]>(edit?.materias.map((m) => m.id) || []);
  const [selProb, setSelProb] = useState<number[]>(edit?.problemas.map((p) => p.id) || []);
  const toggle = (setter: React.Dispatch<React.SetStateAction<number[]>>) => (id: number) => setter((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const save = async () => {
    if (!titulo.trim()) { toast.error('El título es requerido'); return; }
    try {
      const body: any = { titulo, prosa, subtema_ids: selSub, materia_ids: selMat, problema_ids: selProb };
      if (edit) await mutate(`${API}/temas`, 'PATCH', { id: edit.id, ...body });
      else await mutate(`${API}/temas`, 'POST', { problematica_id: probId, ...body });
      toast.success(edit ? 'Tema actualizado' : 'Tema creado');
      onSaved();
    } catch (e: any) { toast.error(e.message); }
  };

  const Chips = ({ items, sel, onToggle, label, getName }: { items: any[]; sel: number[]; onToggle: (id: number) => void; label: string; getName: (x: any) => string }) => (
    <div>
      <p className="text-[11px] font-semibold text-white/70 mb-1" style={df}>{label} ({items.length})</p>
      {items.length === 0 ? <p className="text-[11px] text-white/45" style={mf}>Vacío.</p> : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it) => (
            <button key={it.id} onClick={() => onToggle(it.id)} className={`px-2 py-1 rounded-md text-[11px] border transition-colors ${sel.includes(it.id) ? 'bg-accent/25 border-accent/50 text-white' : 'bg-white/[0.04] border-white/12 text-white/70 hover:bg-white/10'}`} style={mf}>
              {sel.includes(it.id) && <Check className="w-2.5 h-2.5 inline mr-1" />}{getName(it)}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <FloatingWindow open onClose={onClose} title={edit ? 'Editar tema' : 'Nuevo tema'} initialWidth={560} initialHeight={640}>
      <div className="p-4 space-y-3">
        <p className="text-[11.5px] text-white/60" style={mf}>Un tema agrupa subtemas y describe la realidad en <b>prosa</b> conectando su contenido, sin inventar lógicas. Marca claramente las hipótesis como supuestos. Se asocia a materias y problemas.</p>
        <Field label="Título">
          <input className={GLASS_INPUT} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. El desempleo masculino en la cultura ecuatoriana" autoFocus />
        </Field>
        <Field label="Descripción en prosa">
          <textarea className={`${GLASS_INPUT} resize-none`} rows={6} value={prosa} onChange={(e) => setProsa(e.target.value)} placeholder="Describe y conecta todos los subtemas de forma legible. Distingue las hipótesis (p. ej. “Hipótesis: …”)." />
        </Field>
        <Chips items={subtemas} sel={selSub} onToggle={toggle(setSelSub)} label="Subtemas que agrupa" getName={(s) => s.titulo} />
        <Chips items={materias} sel={selMat} onToggle={toggle(setSelMat)} label="Materias asociadas" getName={(m) => m.nombre} />
        <Chips items={problemas} sel={selProb} onToggle={toggle(setSelProb)} label="Problemas que responde" getName={(p) => p.title} />
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className={`${GLASS_BTN} px-3 py-1.5 text-[12px]`} style={mf}>Cancelar</button>
          <button onClick={save} className="px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}>{edit ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
