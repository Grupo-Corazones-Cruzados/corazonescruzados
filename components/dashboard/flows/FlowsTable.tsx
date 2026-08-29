'use client';

/**
 * FlowsTable — módulo de Automatizaciones (flujos). Extraída de Admin → "Flujos".
 * Usa el patrón "Explorador Azure" (rail por tipo + lista + panel de detalle),
 * el mismo estándar Fluent `.corp` del módulo Centralizado. No recibe props.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import PixelDataTable from '@/components/ui/PixelDataTable';
import FilterRail from '@/components/ui/FilterRail';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import BrandLoader from '@/components/ui/BrandLoader';
import {
  Workflow, Mail, MessageCircle, Sparkles, Puzzle, Search, Plus,
  Settings2, Pencil, Trash2, Play, Pause, X, ArrowRight,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const FLOW_TYPES: Record<string, { label: string; Icon: any }> = {
  email: { label: 'Email Masivo', Icon: Mail },
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle },
  ai_agent: { label: 'Agente IA', Icon: Sparkles },
  custom: { label: 'Personalizado', Icon: Puzzle },
};
const TYPE_ORDER = ['email', 'whatsapp', 'ai_agent', 'custom'];

const FLOW_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', active: 'success', paused: 'warning', archived: 'error',
};
const FLOW_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', active: 'Activo', paused: 'Pausado', archived: 'Archivado',
};

/**
 * Las clases de AGENTE IA. `type` distingue email de WhatsApp de agente; dentro de
 * «agente» hace falta una segunda palabra, porque un chatbot que atiende clientes y un
 * generador de presupuestos comparten motor y no se parecen en nada más.
 *
 * Añadir una clase nueva es añadir una línea aquí; lo que no encaje se enseña tal cual,
 * que es mejor que esconderlo.
 */
const CATEGORIAS_AGENTE: Record<string, string> = {
  whatsapp_business: 'WhatsApp Business',
  presupuestos: 'Presupuestos',
};

interface Flow {
  id: number;
  name: string;
  type: string;
  /** Clase de agente IA. NULL en los flujos que no lo son. */
  category?: string | null;
  description: string;
  status: string;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function FlowsTable() {
  const router = useRouter();
  const { user } = useAuth();

  /**
   * ⇒ QUÉ PUEDE HACER UN CLIENTE CON UN FLUJO SUYO.
   *
   * Un cliente entra aquí porque le hemos dado acceso a SU agente, y solo ve ese (lo
   * filtra el servidor en `filtroDeFlujos`). Dentro puede **usarlo** entero: configurarlo,
   * su bandeja, sus plantillas, su estudio, y encenderlo o apagarlo — es su número y sus
   * conversaciones.
   *
   * Lo que no es suyo es el flujo COMO OBJETO: crear, renombrar, cambiar de tipo o
   * borrarlo es de GCC, que se lo montó. Así que esos botones ni se le enseñan.
   *
   * ⚠️ Esconderlos NO es la seguridad —esa está en `PUT`/`DELETE`, que comprueban
   * `flujoAdministrable`—. Es no ofrecer lo que va a fallar al pulsarlo: un botón que
   * responde 403 es peor que un botón que no está.
   */
  const puedeAdministrarFlujos = user?.role === 'admin' || user?.role === 'member';
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);

  // Overview navigation
  const [scopeType, setScopeType] = useState('all');   // rail selection
  const [statusFilter, setStatusFilter] = useState('all'); // command-bar filter
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Flow | null>(null); // detail panel

  // Create / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', type: 'email', description: '' });
  const [confirmDelete, setConfirmDelete] = useState<Flow | null>(null);

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/flows');
      const data = await res.json();
      setFlows(data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  // Keep the detail panel in sync with the freshest data.
  useEffect(() => {
    if (!selected) return;
    const fresh = flows.find((f) => f.id === selected.id);
    setSelected(fresh ?? null);
  }, [flows]); // eslint-disable-line react-hooks/exhaustive-deps

  const countByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of flows) m[f.type] = (m[f.type] || 0) + 1;
    return m;
  }, [flows]);

  const visibleFlows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flows.filter((f) => {
      if (scopeType !== 'all' && f.type !== scopeType) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (q && !(`${f.name} ${f.description || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [flows, scopeType, statusFilter, search]);

  /* ── CRUD ────────────────────────────────────────────────────────────── */
  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: scopeType !== 'all' ? scopeType : 'email', description: '' });
    setFormError('');
    setModalOpen(true);
  };
  const openEdit = (flow: Flow) => {
    setEditing(flow);
    setForm({ name: flow.name, type: flow.type, description: flow.description || '' });
    setFormError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('El nombre es requerido'); return; }
    setSaving(true); setFormError('');
    try {
      const url = editing ? `/api/admin/flows/${editing.id}` : '/api/admin/flows';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setFormError((await res.json()).error || 'Error al guardar'); return; }
      setModalOpen(false);
      fetchFlows();
    } catch { setFormError('Error de conexión'); }
    finally { setSaving(false); }
  };

  const handleToggleStatus = async (flow: Flow) => {
    const nextStatus = flow.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/admin/flows/${flow.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchFlows();
  };

  const handleDelete = async (flow: Flow) => {
    setConfirmDelete(null);
    try {
      await fetch(`/api/admin/flows/${flow.id}`, { method: 'DELETE' });
      if (selected?.id === flow.id) setSelected(null);
      fetchFlows();
    } catch { /* ignore */ }
  };

  /**
   * Elegir una fila. En pantalla ancha el panel ya está al lado y no hay nada que hacer;
   * en pantalla estrecha queda debajo de una tabla que ocupa toda la altura, así que se
   * trae a la vista. Sin esto, pulsar una fila no produce ningún efecto visible y parece
   * que la aplicación no responde.
   *
   * ⛔ ESTE `useRef` VA AQUÍ ARRIBA, Y NO ES UN CAPRICHO DE ORDEN. Estaba más abajo, detrás
   * del `if (loading) return …`. Mientras cargaba, React no lo veía; al llegar los datos,
   * de repente sí — y un componente que ejecuta más hooks que en el render anterior es un
   * error fatal de React, no un aviso. La pantalla entera se caía **justo al terminar de
   * cargar**, que es lo que la hacía parecer un problema de red o de despliegue.
   *
   * La regla: **todos los hooks antes del primer `return`.** Siempre.
   */
  const panelRef = useRef<HTMLElement | null>(null);
  const elegir = useCallback((f: Flow) => {
    setSelected(f);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      // En el siguiente fotograma: antes, el panel todavía no está pintado.
      requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }
  }, []);

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando flujos..." /></div>;


  const detailType = selected ? (FLOW_TYPES[selected.type] || FLOW_TYPES.custom) : null;


  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: tipos ── */}
        <FilterRail
          title="Tipos de flujo"
          sections={[
            { items: [{ value: 'all', label: 'Todos', Icon: Workflow, count: flows.length }] },
            { items: TYPE_ORDER.map((t) => ({ value: t, label: FLOW_TYPES[t].label, Icon: FLOW_TYPES[t].Icon, count: countByType[t] || 0 })) },
          ]}
          value={scopeType}
          onChange={setScopeType}
        />

        {/* ── Right region: command bar + (list · detail) ── */}
        <div className="flex-1 min-w-0 w-full">
          {/* Command bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar flujo..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field-control field-select appearance-none px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none sm:w-48"
              style={mf}
            >
              <option value="all">Todos los estados</option>
              {Object.entries(FLOW_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {/* Crear flujos es de GCC. El cliente entra a los suyos, no monta nuevos. */}
            {puedeAdministrarFlujos && (
              <button onClick={openCreate}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors shrink-0"
                style={mf}>
                <Plus className="w-4 h-4" /> Nuevo flujo
              </button>
            )}
          </div>

          {/* list · detail */}
          {/* ⚠️ EL PANEL DE DETALLE SE ESCONDÍA, Y NO ERA UN FALLO DE PERMISOS (2026-08-28).
              Peter Tours abría Automatizaciones, pulsaba su flujo y a la derecha no salía
              nada — ni el panel ni el botón «Configurar»—, así que no podía entrar a su
              propio agente.

              La causa: el panel solo se colocaba al lado a partir de `xl` (1.280 px). Su
              portátil es de 1.366 físicos, pero **Windows al 125 % deja ~1.093 px reales**
              al navegador, así que la rejilla caía a una columna y el panel se iba DEBAJO
              de la tabla — que ocupa toda la altura, o sea fuera de la pantalla.

              Nosotros no lo veíamos nunca: en un portátil sin escalado hay sito de sobra.
              Por eso el corte baja a `lg` (1.024) y, por debajo de eso, el panel se trae a
              la vista solo al elegir una fila. */}
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                data={visibleFlows}
                onRowClick={(f: Flow) => elegir(f)}
                emptyTitle="Sin flujos"
                emptyDesc={puedeAdministrarFlujos ? 'Crea tu primer flujo con "Nuevo flujo".' : 'Todavía no tienes ningún flujo asignado.'}
                columns={[
                  { key: 'name', header: 'Nombre', render: (f: Flow) => {
                    const t = FLOW_TYPES[f.type] || FLOW_TYPES.custom;
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-md bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
                          <t.Icon className="w-4 h-4 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <span className={`block text-[13px] font-medium truncate ${selected?.id === f.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{f.name}</span>
                          {f.description && <span className="block text-[11px] text-digi-muted truncate max-w-[280px]" style={mf}>{f.description}</span>}
                        </div>
                      </div>
                    );
                  } },
                  { key: 'type', header: 'Tipo', width: '160px', hideOnMobile: true, render: (f: Flow) => (
                    <span className="text-[12px] text-digi-text" style={mf}>
                      {(FLOW_TYPES[f.type] || FLOW_TYPES.custom).label}
                      {/* La clase del agente, debajo y en gris: quien busca un flujo mira
                          el nombre; la clase solo hace falta para distinguir dos agentes
                          del mismo cliente. */}
                      {f.category && (
                        <span className="block text-[11px] text-digi-muted">
                          {CATEGORIAS_AGENTE[f.category] || f.category}
                        </span>
                      )}
                    </span>
                  ) },
                  { key: 'status', header: 'Estado', width: '110px', render: (f: Flow) => (
                    <PixelBadge variant={FLOW_STATUS_V[f.status] || 'default'}>{FLOW_STATUS_LABELS[f.status] || f.status}</PixelBadge>
                  ) },
                  { key: 'date', header: 'Creado', width: '110px', hideOnMobile: true, render: (f: Flow) => (
                    <span className="text-[12px] text-digi-muted" style={mf}>{new Date(f.created_at).toLocaleDateString('es-EC')}</span>
                  ) },
                ]}
              />
            </div>

            {/* ── Detail panel ── */}
            <aside ref={panelRef} className="w-full lg:w-[300px]">
              {selected && detailType ? (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                      <detailType.Icon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.name}</h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{detailType.label}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 space-y-2.5">
                    {selected.description && (
                      <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>{selected.description}</p>
                    )}
                    {[
                      ['Tipo', selected.category
                        ? `${detailType.label} · ${CATEGORIAS_AGENTE[selected.category] || selected.category}`
                        : detailType.label],
                      ['Estado', FLOW_STATUS_LABELS[selected.status] || selected.status],
                      ['Creado', selected.created_at ? new Date(selected.created_at).toLocaleDateString('es-EC') : '—'],
                      ['Actualizado', selected.updated_at ? new Date(selected.updated_at).toLocaleDateString('es-EC') : '—'],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-digi-muted" style={mf}>{k}</span>
                        <span className="text-digi-text text-right" style={mf}>{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-4 pt-0 space-y-2">
                    <button
                      onClick={() => router.push(`/dashboard/automatizaciones/${selected.id}`)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors"
                      style={mf}
                    >
                      <Settings2 className="w-4 h-4" /> Configurar <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      {puedeAdministrarFlujos && (
                        <button onClick={() => openEdit(selected)}
                          className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
                          <Pencil className="w-3.5 h-3.5" /> Editar
                        </button>
                      )}
                      {/* Activar y pausar SÍ es del cliente: es su agente. Ocupa la fila
                          entera cuando no hay «Editar» al lado, para no dejar un hueco. */}
                      <button onClick={() => handleToggleStatus(selected)}
                        className={`${puedeAdministrarFlujos ? '' : 'col-span-2 '}inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors`} style={mf}>
                        {selected.status === 'active' ? <><Pause className="w-3.5 h-3.5" /> Pausar</> : <><Play className="w-3.5 h-3.5" /> Activar</>}
                      </button>
                      {puedeAdministrarFlujos && (
                        <button onClick={() => setConfirmDelete(selected)}
                          className="col-span-2 inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-red-500/30 rounded text-[12px] text-red-500 hover:bg-red-50 transition-colors" style={mf}>
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <Workflow className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un flujo para ver sus detalles y acciones.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      <PixelConfirm
        open={confirmDelete !== null}
        title="Eliminar flujo"
        message={`¿Eliminar "${confirmDelete?.name ?? ''}"? Se borran también sus campañas, listas de contactos y contactos. No se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Create / edit modal */}
      <PixelModal open={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editing ? 'Editar flujo' : 'Nuevo flujo'}>
        <div className="space-y-3">
          <PixelInput label="Nombre" value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Nombre del flujo" />
          <PixelSelect label="Tipo" value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
            options={TYPE_ORDER.map((t) => ({ value: t, label: FLOW_TYPES[t].label }))} />
          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Descripción (opcional)</label>
            <textarea value={form.description} rows={3}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Descripción del flujo..."
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          {formError && <p className="text-[12px] text-red-500" style={mf}>{formError}</p>}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setModalOpen(false)} className="pixel-btn pixel-btn-secondary text-sm flex-1" style={mf}>Cancelar</button>
            <button onClick={handleSave} disabled={saving} className="pixel-btn pixel-btn-primary text-sm flex-1 disabled:opacity-50" style={mf}>
              {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
