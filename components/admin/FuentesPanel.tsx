'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import Button from '@/components/ui/Button';
import FuentesGraph, { type GraphRelation } from '@/components/admin/FuentesGraph';
import {
  buildFuentesTree, filterTree, allNodeIds, type TreeNode, type NodeKind,
} from '@/lib/admin/fuentes-tree';
import {
  Database, Search, Plus, Trash2, ChevronLeft, ChevronRight, Table2, KeyRound, Lock,
  Boxes, Network, GitBranch, Folder, ChevronsDownUp, ChevronsUpDown, Orbit, Rows3,
  type LucideIcon,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const nf = new Intl.NumberFormat('es-ES');

const labelCls = 'field-label text-[12px] font-semibold text-digi-text';
const inputCls =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors';

interface TableInfo { name: string; rows: number; }
interface ColumnInfo {
  name: string; dataType: string; udt: string; nullable: boolean;
  hasDefault: boolean; generated: boolean; maxLength: number | null; isPrimaryKey: boolean;
}
type Row = Record<string, unknown>;

const PAGE_SIZE = 50;

/** Columnas cuyo valor NO se muestra en la tabla (se ve solo al abrir el registro). */
const SENSITIVE = /(password|secret|token|hash|api_key|apikey)/i;

/** Icono y etiqueta de cada tipo de carpeta del árbol (la tabla usa `Table2`). */
const KIND: Record<NodeKind, { Icon: LucideIcon; label: string; className: string }> = {
  module:    { Icon: Boxes,     label: 'Módulo',      className: 'text-accent' },
  system:    { Icon: Network,   label: 'Sistema',     className: 'text-accent' },
  subsystem: { Icon: GitBranch, label: 'Subsistema',  className: 'text-digi-muted' },
  group:     { Icon: Folder,    label: 'Otras',       className: 'text-digi-muted' },
};

/** ¿El campo se edita con textarea? (textos largos, JSON y arreglos). */
const isLong = (c: ColumnInfo) =>
  c.udt.startsWith('_') || c.udt === 'json' || c.udt === 'jsonb' || (c.udt === 'text' && !c.isPrimaryKey);

/** Valor de una celda, listo para mostrar. */
function cellText(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Valor de un campo del formulario a partir del registro (para editar). */
function fieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

/**
 * Panel "Fuentes" — explorador de las tablas de la base para el administrador.
 * Rail izquierdo con las tablas · tabla de registros al centro · el registro
 * seleccionado se edita en un PANEL DERECHO con overlay (estándar de formularios).
 *
 * Es una herramienta de último recurso: el trabajo diario se hace desde los módulos.
 * Toda la validación (tabla, columnas, tipos) vive en el servidor (`lib/admin/fuentes.ts`).
 */
export default function FuentesPanel() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loadingTables, setLoadingTables] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);

  // Formulario del registro (panel derecho). `mode` distingue alta de edición.
  const [form, setForm] = useState<{ mode: 'create' | 'edit'; values: Record<string, string>; row: Row | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);

  const editable = primaryKey.length > 0;

  /* ── Tablas ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/admin/fuentes')
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || 'Error');
        setTables(j.data || []);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoadingTables(false));
  }, []);

  /* ── Registros de la tabla elegida ──────────────────────────────────── */
  const loadRows = useCallback(async (table: string, p: number, q: string) => {
    setLoadingRows(true);
    try {
      const qs = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), search: q });
      const res = await fetch(`/api/admin/fuentes/${encodeURIComponent(table)}?${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setColumns(j.data.columns || []);
      setPrimaryKey(j.data.primaryKey || []);
      setRows(j.data.rows || []);
      setTotal(j.data.total || 0);
    } catch (e: any) {
      toast.error(e.message);
      setRows([]);
      setColumns([]);
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadRows(selected, page, search);
  }, [selected, page, search, loadRows]);

  const pickTable = (name: string) => {
    setSelected(name);
    setPage(1);
    setSearch('');
    setForm(null);
  };

  const refresh = () => selected && loadRows(selected, page, search);

  /* ── Formulario ─────────────────────────────────────────────────────── */
  const openCreate = () => {
    const values: Record<string, string> = {};
    columns.forEach((c) => { if (!c.generated) values[c.name] = ''; });
    setForm({ mode: 'create', values, row: null });
  };

  const openEdit = (row: Row) => {
    const values: Record<string, string> = {};
    columns.forEach((c) => { values[c.name] = fieldValue(row[c.name]); });
    setForm({ mode: 'edit', values, row });
  };

  /** Clave primaria del registro, tal como la espera el servidor. */
  const pkOf = (row: Row) => Object.fromEntries(primaryKey.map((k) => [k, row[k]]));

  const save = async () => {
    if (!form || !selected) return;
    setSaving(true);
    try {
      const isCreate = form.mode === 'create';
      // En edición no se manda la clave primaria (no se modifica: identifica la fila).
      const values: Record<string, string> = {};
      columns.forEach((c) => {
        if (c.generated) return;
        if (!isCreate && c.isPrimaryKey) return;
        if (form.values[c.name] === undefined) return;
        values[c.name] = form.values[c.name];
      });

      const res = await fetch(`/api/admin/fuentes/${encodeURIComponent(selected)}`, {
        method: isCreate ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isCreate ? { values } : { pk: pkOf(form.row!), values }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');

      toast.success(isCreate ? 'Registro creado.' : 'Registro guardado.');
      setForm(null);
      refresh();
      if (isCreate) setTables((ts) => ts.map((t) => (t.name === selected ? { ...t, rows: t.rows + 1 } : t)));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (row: Row) => {
    if (!selected) return;
    setConfirm({
      text: '¿Eliminar este registro? La acción no se puede deshacer.',
      onOk: async () => {
        setConfirm(null);
        try {
          const res = await fetch(`/api/admin/fuentes/${encodeURIComponent(selected)}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pk: pkOf(row) }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || 'Error');
          toast.success('Registro eliminado.');
          setForm(null);
          refresh();
          setTables((ts) => ts.map((t) => (t.name === selected ? { ...t, rows: Math.max(0, t.rows - 1) } : t)));
        } catch (e: any) {
          toast.error(e.message);
        }
      },
    });
  };

  /* ── Árbol de carpetas del rail ─────────────────────────────────────── */
  const tree = useMemo(() => buildFuentesTree(tables), [tables]);
  const shownTree = useMemo(() => filterTree(tree, tableFilter), [tree, tableFilter]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Al buscar se despliega todo lo que casa (si no, los resultados quedan escondidos).
  const searching = tableFilter.trim().length > 0;
  const isOpen = (id: string) => searching || expanded.has(id);
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const expandAll = () => setExpanded(new Set(allNodeIds(tree)));
  const collapseAll = () => setExpanded(new Set());

  // El rail (y la columna de contenido) ocupan todo el alto disponible: desde su borde
  // superior hasta la barra de ruta fija del dashboard, que hay que descontar o el
  // contenido queda por debajo y se corta. Se recalcula al redimensionar.
  const railRef = useRef<HTMLElement>(null);
  const [railH, setRailH] = useState<number>();
  useEffect(() => {
    const compute = () => {
      const el = railRef.current;
      if (!el) return;
      const bar = document.querySelector('nav[aria-label="Ruta"]');
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      const h = Math.max(window.innerHeight - el.getBoundingClientRect().top - barH - 12, 280);
      setRailH((prev) => (prev === undefined || Math.abs(prev - h) > 1 ? h : prev));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [loadingTables]);

  /* ── Vista: tabla o universo de relaciones ──────────────────────────── */
  const [view, setView] = useState<'table' | 'universe'>('table');
  const [relations, setRelations] = useState<GraphRelation[] | null>(null);
  const [loadingRel, setLoadingRel] = useState(false);

  // Las relaciones se piden una sola vez, y solo al abrir el universo (la vista de
  // tabla no las necesita).
  useEffect(() => {
    if (view !== 'universe' || relations || loadingRel) return;
    setLoadingRel(true);
    fetch('/api/admin/fuentes?relations=1')
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) throw new Error(j.error || 'Error');
        setRelations(j.data.relations || []);
      })
      .catch((e: Error) => toast.error(e.message))
      .finally(() => setLoadingRel(false));
  }, [view, relations, loadingRel]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Una carpeta del árbol y todo lo que cuelga de ella. */
  const renderNode = (node: TreeNode, depth: number) => {
    const open = isOpen(node.id);
    const { Icon, label, className } = KIND[node.kind];
    return (
      <div key={node.id}>
        <button
          onClick={() => toggle(node.id)}
          title={`${label}${node.hint ? ` · ${node.hint}` : ''} · ${node.tableCount} ${node.tableCount === 1 ? 'tabla' : 'tablas'}`}
          className="w-full flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-digi-text hover:bg-black/[0.04] transition-colors"
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          <ChevronRight className={`w-3 h-3 shrink-0 text-digi-muted transition-transform ${open ? 'rotate-90' : ''}`} />
          <Icon className={`w-3.5 h-3.5 shrink-0 ${className}`} />
          <span className="text-[12px] font-medium truncate flex-1" style={mf}>{node.name}</span>
          <span className="text-[10.5px] text-digi-muted shrink-0" style={mf}>{node.tableCount}</span>
        </button>

        {open && (
          <>
            {node.children.map((c) => renderNode(c, depth + 1))}
            {node.tables.map((t) => {
              const active = selected === t.name;
              return (
                <button
                  key={t.name}
                  onClick={() => pickTable(t.name)}
                  title={`Tabla · ${nf.format(t.rows)} ${t.rows === 1 ? 'fila' : 'filas'}`}
                  className={`w-full flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors ${
                    active ? 'bg-accent-light text-accent border-l-2 border-accent' : 'text-digi-muted hover:bg-black/[0.04] hover:text-digi-text'
                  }`}
                  style={{ paddingLeft: 6 + (depth + 1) * 12 + 18 }}
                >
                  <Table2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[12px] font-medium truncate flex-1" style={mf}>{t.name}</span>
                  <span className="text-[10.5px] text-digi-muted shrink-0" style={mf}>{nf.format(t.rows)}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
      {/* ── Rail: tablas ───────────────────────────────────────────────── */}
      <aside
        ref={railRef}
        className="bg-digi-card border border-digi-border rounded-lg overflow-hidden flex flex-col"
        style={{ height: railH }}
      >
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2 shrink-0">
          <Database className="w-4 h-4 text-accent" />
          <span className="text-[12px] font-semibold text-digi-text" style={mf}>Tablas</span>
          <span className="text-[11px] text-digi-muted" style={mf}>{tables.length}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              onClick={expandAll}
              title="Desplegar todo" aria-label="Desplegar todo"
              className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-accent-light transition-colors"
            >
              <ChevronsUpDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={collapseAll}
              title="Contraer todo" aria-label="Contraer todo"
              className="w-6 h-6 flex items-center justify-center rounded text-digi-muted hover:text-accent hover:bg-accent-light transition-colors"
            >
              <ChevronsDownUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-2 border-b border-digi-border shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              placeholder="Buscar tabla o carpeta..."
              className={`${inputCls} pl-8 py-1.5 text-[12px]`}
              style={mf}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5">
          {loadingTables ? (
            <div className="py-8 flex justify-center"><BrandLoader size="sm" /></div>
          ) : !shownTree.length ? (
            <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Sin coincidencias.</p>
          ) : (
            shownTree.map((n) => renderNode(n, 0))
          )}
        </div>

        {/* Leyenda: qué significa cada icono del árbol */}
        <div className="border-t border-digi-border px-2.5 py-2 flex flex-wrap gap-x-3 gap-y-1 shrink-0">
          {(Object.keys(KIND) as NodeKind[]).map((k) => {
            const { Icon, label, className } = KIND[k];
            return (
              <span key={k} className="inline-flex items-center gap-1 text-[10.5px] text-digi-muted" style={mf}>
                <Icon className={`w-3 h-3 ${className}`} />{label}
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1 text-[10.5px] text-digi-muted" style={mf}>
            <Table2 className="w-3 h-3" />Tabla
          </span>
        </div>
      </aside>

      {/* ── Centro: registros de la tabla o universo de relaciones ─────── */}
      <div className="min-w-0 flex flex-col" style={{ height: railH }}>
        {/* Command bar — el selector de vista va siempre a la derecha */}
        <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
          {view === 'table' && selected ? (
            <>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder={`Buscar en ${selected}...`}
                  className={`${inputCls} pl-8`}
                  style={mf}
                />
              </div>
              <span className="text-[12px] text-digi-muted" style={mf}>
                {nf.format(total)} {total === 1 ? 'registro' : 'registros'}
              </span>
              <Button onClick={openCreate} icon={<Plus className="w-4 h-4" />} disabled={!columns.length}>
                Nuevo registro
              </Button>
            </>
          ) : (
            <div className="flex-1 min-w-[160px]">
              {view === 'universe' && (
                <p className="text-[12px] text-digi-muted" style={mf}>
                  {selected
                    ? `${selected} · resaltando sus relaciones y su carpeta`
                    : 'Elige una tabla en el panel izquierdo para viajar hasta ella.'}
                </p>
              )}
            </div>
          )}

          {/* Selector de vista (segmentado Fluent) */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-md border border-digi-border bg-digi-card shrink-0">
            {([
              { v: 'table', label: 'Tabla', Icon: Rows3 },
              { v: 'universe', label: 'Universo', Icon: Orbit },
            ] as const).map(({ v, label, Icon }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                title={v === 'universe' ? 'Ver el esquema como grafo de relaciones' : 'Ver los registros de la tabla'}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium transition-colors ${
                  view === v ? 'bg-accent text-white' : 'text-digi-muted hover:text-digi-text hover:bg-black/[0.04]'
                }`}
                style={mf}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === 'universe' ? (
          loadingRel || !relations ? (
            <div className="flex-1 flex items-center justify-center bg-digi-card border border-digi-border rounded-lg">
              <BrandLoader size="md" label="Trazando el universo..." />
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <FuentesGraph
                tree={tree}
                relations={relations}
                selectedTable={selected}
                onSelectTable={pickTable}
              />
            </div>
          )
        ) : !selected ? (
          <div className="bg-digi-card border border-digi-border rounded-lg text-center py-20">
            <div className="w-11 h-11 rounded-lg bg-accent-light flex items-center justify-center mx-auto mb-3">
              <Database className="w-5 h-5 text-accent" />
            </div>
            <p className="text-[13px] font-semibold text-digi-text" style={mf}>Elige una tabla</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>
              Selecciona una tabla del panel izquierdo para ver sus registros.
            </p>
          </div>
        ) : (
          <>
            {!editable && !!columns.length && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-md bg-amber-50 border border-amber-300">
                <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <p className="text-[12px] text-amber-700" style={mf}>
                  Esta tabla no tiene clave primaria: solo se puede consultar (no editar ni eliminar).
                </p>
              </div>
            )}

            {/* Tabla */}
            <div className="data-table bg-digi-card border border-digi-border rounded-lg overflow-hidden flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-auto">
                {loadingRows ? (
                  <div className="py-16 flex justify-center"><BrandLoader size="md" label="Cargando registros..." /></div>
                ) : !rows.length ? (
                  <div className="py-16 text-center">
                    <p className="text-[13px] font-semibold text-digi-text" style={mf}>Sin registros</p>
                    <p className="text-[12px] text-digi-muted mt-1" style={mf}>
                      {search ? 'Ninguno coincide con la búsqueda.' : 'Esta tabla está vacía.'}
                    </p>
                  </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead className="sticky top-0 z-10 bg-digi-card">
                      <tr className="border-b border-digi-border">
                        {columns.map((c) => (
                          <th key={c.name} className="dt-th text-left whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              {c.isPrimaryKey && <KeyRound className="w-3 h-3 text-accent" />}
                              {c.name}
                            </span>
                          </th>
                        ))}
                        <th className="dt-th w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr
                          key={i}
                          onClick={() => openEdit(row)}
                          className="dt-row border-b border-digi-border/50 cursor-pointer transition-colors"
                        >
                          {columns.map((c) => {
                            const masked = SENSITIVE.test(c.name) && row[c.name] != null;
                            const text = masked ? '••••••••' : cellText(row[c.name]);
                            return (
                              <td key={c.name} className="dt-td whitespace-nowrap max-w-[280px] truncate" title={masked ? undefined : text}>
                                <span className={row[c.name] === null ? 'text-digi-muted/60' : 'text-digi-text'} style={mf}>
                                  {text.length > 90 ? `${text.slice(0, 90)}…` : text}
                                </span>
                              </td>
                            );
                          })}
                          <td className="dt-td text-right">
                            {editable && (
                              <button
                                onClick={(e) => { e.stopPropagation(); remove(row); }}
                                title="Eliminar registro"
                                aria-label="Eliminar registro"
                                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 mt-3 shrink-0">
                <span className="text-[12px] text-digi-muted" style={mf}>Página {page} de {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-md border border-digi-border text-digi-muted hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  aria-label="Página siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Panel derecho: el registro ─────────────────────────────────── */}
      {form && (
        <PixelModal
          open
          onClose={() => !saving && setForm(null)}
          title={form.mode === 'create' ? `Nuevo registro · ${selected}` : `Registro · ${selected}`}
          size="md"
          busy={saving}
        >
          <div className="space-y-3.5">
            {columns.map((c) => {
              const readOnly = c.generated || (form.mode === 'edit' && c.isPrimaryKey);
              const hint = [
                c.dataType,
                c.isPrimaryKey ? 'clave primaria' : null,
                !c.nullable && !c.hasDefault ? 'obligatorio' : null,
                c.udt.startsWith('_') ? 'un valor por línea' : null,
                c.udt === 'json' || c.udt === 'jsonb' ? 'JSON' : null,
                readOnly ? 'lo asigna la base' : null,
              ].filter(Boolean).join(' · ');

              return (
                <div key={c.name} className="flex flex-col gap-1">
                  <label className={labelCls} style={mf} htmlFor={`f-${c.name}`}>
                    <span className="inline-flex items-center gap-1">
                      {c.isPrimaryKey && <KeyRound className="w-3 h-3 text-accent" />}
                      {c.name}
                    </span>
                  </label>

                  {readOnly ? (
                    <p className="text-[12.5px] text-digi-muted px-3 py-2 rounded border border-dashed border-digi-border break-all" style={mf}>
                      {form.mode === 'create' ? '(lo asigna la base de datos)' : fieldValue(form.row?.[c.name]) || '—'}
                    </p>
                  ) : c.udt === 'bool' ? (
                    <select
                      id={`f-${c.name}`}
                      value={form.values[c.name] ?? ''}
                      onChange={(e) => setForm({ ...form, values: { ...form.values, [c.name]: e.target.value } })}
                      className={`${inputCls} field-select appearance-none cursor-pointer`}
                      style={mf}
                    >
                      <option value="">{c.nullable ? '(vacío)' : '(sin valor)'}</option>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : isLong(c) ? (
                    <textarea
                      id={`f-${c.name}`}
                      value={form.values[c.name] ?? ''}
                      onChange={(e) => setForm({ ...form, values: { ...form.values, [c.name]: e.target.value } })}
                      rows={c.udt === 'jsonb' || c.udt === 'json' ? 5 : 3}
                      className={`${inputCls} resize-y font-[inherit]`}
                      style={mf}
                    />
                  ) : (
                    <input
                      id={`f-${c.name}`}
                      value={form.values[c.name] ?? ''}
                      onChange={(e) => setForm({ ...form, values: { ...form.values, [c.name]: e.target.value } })}
                      maxLength={c.maxLength ?? undefined}
                      className={inputCls}
                      style={mf}
                    />
                  )}

                  <span className="text-[11px] text-digi-muted" style={mf}>{hint}</span>
                </div>
              );
            })}

            {/* Acciones: secundaria y destructiva a la izquierda, primaria a la derecha */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-digi-border">
              {form.mode === 'edit' && editable ? (
                <Button variant="danger" icon={<Trash2 className="w-4 h-4" />} onClick={() => remove(form.row!)} disabled={saving}>
                  Eliminar
                </Button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button onClick={save} disabled={saving || (form.mode === 'edit' && !editable)}>
                  {saving ? 'Guardando...' : form.mode === 'create' ? 'Crear' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </PixelModal>
      )}

      <PixelConfirm
        open={!!confirm}
        message={confirm?.text || ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => confirm?.onOk()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
