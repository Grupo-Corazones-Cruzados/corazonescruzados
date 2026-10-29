'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PanelDetalle from '@/components/ui/PanelDetalle';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import ShareAccessModal from '@/components/centralized/ShareAccessModal';
import {
  Layers, Globe, Landmark, ClipboardList, Wrench, Boxes, Users, Plus,
  Share2, Pencil, Trash2, ArrowRight, X,
} from 'lucide-react';
import {
  PISOS, PASOS, PISO_LABEL, PASO_LABEL, CELL_MAP, systemPath,
} from '@/lib/centralized/systems';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import BarraLista from '@/components/ui/BarraLista';

const mf = { fontFamily: 'var(--font-body)' } as const;

const PISO_ICONS: Record<string, any> = {
  global: Globe, pilar: Landmark, controlador: ClipboardList, colaborador: Wrench,
};

export default function CentralizedPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const router = useRouter();

  const [allSystems, setAllSystems] = useState<any[]>([]);

  const [scopePiso, setScopePiso] = useState<string>('all');
  const [pasoFilter, setPasoFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  // Por debajo de `xl` el detalle se abre ENCIMA, no bajo la lista (Fernando, 2026-10-23). Se
  // decide qué se MONTA: un <dialog> montado y escondido deja inerte toda la página.
  const enTelefono = !useConsultaMedia(PANTALLA_XL);

  // System editor modal (create / edit)
  const [sysModal, setSysModal] = useState(false);
  const [editingSys, setEditingSys] = useState<any>(null);
  const [formPiso, setFormPiso] = useState('global');
  const [formPaso, setFormPaso] = useState('fundamentacion');
  const [sysName, setSysName] = useState('');
  const [sysDesc, setSysDesc] = useState('');
  const [savingSys, setSavingSys] = useState(false);

  // Share access modal
  const [shareOpen, setShareOpen] = useState(false);
  const [shareSystem, setShareSystem] = useState<any>(null);

  const fetchSystems = useCallback(async () => {
    try {
      const res = await fetch('/api/centralized/systems');
      const data = await res.json();
      setAllSystems(data.data || []);
    } catch { setAllSystems([]); }
  }, []);

  useEffect(() => { fetchSystems(); }, [fetchSystems]);

  // Keep the detail panel in sync with the freshest data.
  useEffect(() => {
    if (!selected) return;
    const fresh = allSystems.find((s) => s.id === selected.id);
    if (fresh && fresh !== selected) setSelected(fresh);
    if (!fresh) setSelected(null);
  }, [allSystems]); // eslint-disable-line react-hooks/exhaustive-deps

  const countByPiso = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of allSystems) m[s.piso] = (m[s.piso] || 0) + 1;
    return m;
  }, [allSystems]);

  const visibleSystems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSystems.filter((s) => {
      if (scopePiso !== 'all' && s.piso !== scopePiso) return false;
      if (pasoFilter && s.paso !== pasoFilter) return false;
      if (q && !(`${s.name} ${s.description || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allSystems, scopePiso, pasoFilter, search]);

  const openSystem = (s: any) => router.push(systemPath({ piso: s.piso, paso: s.paso, slug: s.slug }));

  /* ── System CRUD ─────────────────────────────────────────────────────── */
  const openNewSystem = () => {
    setEditingSys(null);
    setFormPiso(scopePiso !== 'all' ? scopePiso : 'global');
    setFormPaso(pasoFilter || 'fundamentacion');
    setSysName(''); setSysDesc('');
    setSysModal(true);
  };
  const openEditSystem = (sys: any) => {
    setEditingSys(sys);
    setFormPiso(sys.piso); setFormPaso(sys.paso);
    setSysName(sys.name); setSysDesc(sys.description || '');
    setSysModal(true);
  };

  const handleSaveSys = async () => {
    if (!sysName.trim()) { toast.error('El nombre es requerido'); return; }
    setSavingSys(true);
    try {
      if (editingSys) {
        const res = await fetch(`/api/centralized/systems/${editingSys.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sysName, description: sysDesc }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Sistema actualizado');
      } else {
        const res = await fetch('/api/centralized/systems', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sysName, description: sysDesc, piso: formPiso, paso: formPaso }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success('Sistema creado');
      }
      setSysModal(false);
      await fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingSys(false); }
  };

  const handleDeleteSys = async (sys: any) => {
    if (!window.confirm(`¿Eliminar el sistema "${sys.name}"? Se revocarán todos sus accesos.`)) return;
    try {
      const res = await fetch(`/api/centralized/systems/${sys.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Sistema eliminado');
      if (selected?.id === sys.id) setSelected(null);
      await fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const handleToggleActive = async (sys: any) => {
    try {
      const res = await fetch(`/api/centralized/systems/${sys.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !sys.is_active }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(sys.is_active ? 'Sistema desactivado' : 'Sistema activado');
      await fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const openShare = (sys: any) => { setShareSystem(sys); setShareOpen(true); };

  if (!user?.member_id && user?.role !== 'admin') {
    return (
      <div className="bg-digi-card border border-digi-border rounded-xl text-center py-12">
        <p className="text-sm text-digi-muted" style={mf}>Solo disponible para miembros</p>
      </div>
    );
  }

  /* ── Rail item ───────────────────────────────────────────────────────── */

  /** Detalle del sistema elegido, una sola vez: columna en escritorio (`PanelDetalle`, con las
   *  acciones en su pie fijo) y panel encima en teléfono (`cuerpoSistema`, todo seguido). */
  const datosSistema = !selected ? null : (
  <div className="space-y-2.5">
    {selected.description && (
      <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>{selected.description}</p>
    )}
    {[
      ['Piso', PISO_LABEL[selected.piso] || selected.piso],
      ['Paso', PASO_LABEL[selected.paso] || selected.paso],
      ['Acceso', `${selected.access_count ?? 0} miembro(s)`],
      ['Estado', selected.is_active ? 'Activo' : 'Inactivo'],
      ['Creado', selected.created_at ? new Date(selected.created_at).toLocaleDateString('es-EC') : '—'],
    ].map(([k, v]) => (
      <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-digi-muted" style={mf}>{k}</span>
        <span className="text-digi-text text-right" style={mf}>{v}</span>
      </div>
    ))}
    <p className="text-[10.5px] text-digi-muted/80 pt-1 break-all" style={mf}>{systemPath({ piso: selected.piso, paso: selected.paso, slug: selected.slug })}</p>
  </div>
  );
  const accionesSistema = !selected ? null : (
  <>
    <button
      onClick={() => openSystem(selected)}
      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors"
      style={mf}
    >
      Abrir sistema <ArrowRight className="w-4 h-4" />
    </button>
    {isAdmin && (
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openShare(selected)}
          className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
          <Share2 className="w-3.5 h-3.5" /> Compartir
        </button>
        <button onClick={() => openEditSystem(selected)}
          className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
          <Pencil className="w-3.5 h-3.5" /> Editar
        </button>
        <button onClick={() => handleToggleActive(selected)}
          className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
          {selected.is_active ? 'Desactivar' : 'Activar'}
        </button>
        <button onClick={() => handleDeleteSys(selected)}
          className="inline-flex items-center justify-center gap-1.5 px-2 py-2 border border-red-500/30 rounded text-[12px] text-red-500 hover:bg-red-50 transition-colors" style={mf}>
          <Trash2 className="w-3.5 h-3.5" /> Eliminar
        </button>
      </div>
    )}
  </>
  );
  const cuerpoSistema = !selected ? null : (
  <div className="space-y-4">
    {datosSistema}
    <div className="space-y-2">{accionesSistema}</div>
  </div>
  );

  return (
    <div>
      <PageHeader title="Proyecto Centralizado" description="Modelo 4P — sistemas fundamentales del grupo" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: Pisos ── */}
        <FilterRail
          title="Estructura 4P"
          sections={[
            { items: [{ value: 'all', label: 'Todos los sistemas', Icon: Layers, count: allSystems.length }] },
            { title: 'Pisos', items: PISOS.map((p) => ({ value: p.key, label: p.label, Icon: PISO_ICONS[p.key], hint: p.hint, count: countByPiso[p.key] || 0 })) },
          ]}
          value={scopePiso}
          onChange={setScopePiso}
        />

        {/* ── Right region: command bar + (list · detail) ── */}
        <div className="flex-1 min-w-0 w-full">
          {/* list · detail */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
            <div className="min-w-0">
              {/* ⇒ EL PANEL DE DETALLE EMPIEZA ARRIBA (Fernando, 2026-10-29): la barra va dentro de
                  la columna de la lista. */}
              {/* Buscador y «Nuevo sistema» arriba; el filtro de paso, debajo (BarraLista). */}
              <BarraLista
                busqueda={search}
                onBusqueda={setSearch}
                placeholder="Buscar sistema..."
                acciones={isAdmin ? [{ label: 'Nuevo sistema', icon: Plus, onClick: openNewSystem, tipo: 'primaria' }] : []}
                filtros={
                  <select
                    value={pasoFilter}
                    onChange={(e) => setPasoFilter(e.target.value)}
                    className="field-control field-select appearance-none w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
                    style={mf}
                  >
                    <option value="">Todos los pasos</option>
                    {PASOS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                }
              />
              {/* Vacía o cargando, también hasta el pie (Fernando, 2026-10-29). */}
              <TablaVaciaHastaElPie vacia={visibleSystems.length === 0}>
              <PixelDataTable
                data={visibleSystems}
                onRowClick={(s: any) => setSelected(s)}
                emptyTitle="Sin sistemas"
                emptyDesc={isAdmin ? 'Crea el primer sistema con "Nuevo sistema".' : 'Aún no hay sistemas en este ámbito.'}
                columns={[
                  { key: 'name', header: 'Sistema', render: (s: any) => (
                    <div className="flex items-center gap-2.5">
                      {/* Sin el punto verde/gris sobre el icono: lo normal es estar activo, y un
                          punto en cada fila no decía nada. Solo el sistema INACTIVO lo dice, en
                          texto, junto al nombre — como en Catering (Fernando, 2026-10-23). */}
                      <div className="w-8 h-8 rounded-md bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
                        <Boxes className="w-4 h-4 text-accent" />
                      </div>
                      <div className="min-w-0">
                        <span className="flex items-baseline gap-2 min-w-0">
                          <button onClick={(e) => { e.stopPropagation(); openSystem(s); }}
                            className={`block min-w-0 text-[13px] font-medium truncate text-left hover:text-accent transition-colors ${selected?.id === s.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>
                            {s.name}
                          </button>
                          {!s.is_active && <span className="shrink-0 text-[11px] text-digi-muted" style={mf}>Inactivo</span>}
                        </span>
                        {s.description && <span className="block text-[11px] text-digi-muted truncate max-w-[280px]" style={mf}>{s.description}</span>}
                      </div>
                    </div>
                  ) },
                  { key: 'piso', header: 'Piso', width: '120px', render: (s: any) => (
                    <span className="text-[12px] text-digi-text" style={mf}>{PISO_LABEL[s.piso] || s.piso}</span>
                  ) },
                  { key: 'paso', header: 'Paso', width: '130px', render: (s: any) => (
                    <span className="text-[12px] text-digi-muted" style={mf}>{PASO_LABEL[s.paso] || s.paso}</span>
                  ) },
                  { key: 'access', header: 'Acceso', width: '90px', render: (s: any) => (
                    <span className="inline-flex items-center gap-1 text-[12px] text-digi-muted" style={mf}>
                      <Users className="w-3.5 h-3.5" /> {s.access_count ?? 0}
                    </span>
                  ) },
                ]}
              />
              </TablaVaciaHastaElPie>
            </div>

            {/* ── Detail panel ── */}
            {/* La columna solo en escritorio; por debajo, el panel que se abre encima (abajo). */}
            {!enTelefono && (
            <aside className="w-full xl:w-[300px]">
              {selected ? (
                /* Tres franjas (Fernando, 2026-10-29): cabecera y acciones fijas. Ver `PanelDetalle`. */
                <PanelDetalle icono={Boxes} titulo={selected.name} subtitulo={selected.cell_name} onCerrar={() => setSelected(null)} pie={accionesSistema}>
                  {datosSistema}
                </PanelDetalle>
              ) : (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col justify-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <Boxes className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un sistema para ver sus detalles y acciones.</p>
                </PanelHastaElPie>
              )}
            </aside>
            )}
          </div>
        </div>
      </div>

      {/* El detalle en teléfono y tableta. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal open={!!selected} onClose={() => setSelected(null)} title={selected?.name || 'Sistema'} size="md">
          {cuerpoSistema}
        </PixelModal>
      )}

      {/* System editor modal */}
      <PixelModal open={sysModal} onClose={() => !savingSys && setSysModal(false)}
        title={editingSys ? 'Editar sistema' : 'Nuevo sistema'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <PixelSelect label="Piso" value={formPiso} disabled={!!editingSys}
              onChange={(e) => setFormPiso(e.target.value)}
              options={PISOS.map((p) => ({ value: p.key, label: p.label }))} />
            <PixelSelect label="Paso" value={formPaso} disabled={!!editingSys}
              onChange={(e) => setFormPaso(e.target.value)}
              options={PASOS.map((p) => ({ value: p.key, label: p.label }))} />
          </div>
          <p className="text-[11px] text-digi-muted" style={mf}>
            Celda: <span className="text-digi-text font-medium">{CELL_MAP[formPiso]?.[formPaso] || '—'}</span>
          </p>
          <PixelInput label="Nombre" value={sysName} onChange={(e) => setSysName(e.target.value)} placeholder="Nombre del sistema" />
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium text-digi-muted" style={mf}>Descripción (opcional)</label>
            <textarea value={sysDesc} onChange={(e) => setSysDesc(e.target.value)} rows={2}
              className="field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none resize-none"
              style={mf} placeholder="Descripción..." />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setSysModal(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>Cancelar</button>
            <button onClick={handleSaveSys} disabled={savingSys}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
              {savingSys ? '...' : editingSys ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </PixelModal>

      <ShareAccessModal system={shareSystem} open={shareOpen} onClose={() => setShareOpen(false)} onChanged={fetchSystems} />
    </div>
  );
}
