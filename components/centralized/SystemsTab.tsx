'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelBadge from '@/components/ui/PixelBadge';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const PISO_OPTIONS = [
  { value: 'global', label: 'Global' },
  { value: 'pilar', label: 'Pilar' },
  { value: 'controlador', label: 'Controlador' },
  { value: 'colaborador', label: 'Colaborador' },
];

const PASO_OPTIONS = [
  { value: 'fundamentacion', label: 'Fundamentación' },
  { value: 'creacion', label: 'Creación' },
  { value: 'implementacion', label: 'Implementación' },
  { value: 'gestion', label: 'Gestión' },
];

const CELL_MAP: Record<string, Record<string, string>> = {
  global:      { fundamentacion: 'Condiciología', creacion: 'Control Psicosocial', implementacion: 'Centralizado', gestion: 'Gestión Psicosocial' },
  pilar:       { fundamentacion: 'Academia',      creacion: 'Tecnología',          implementacion: 'Organización', gestion: 'Publicación' },
  controlador: { fundamentacion: 'Conocimiento',  creacion: 'Herramientas',        implementacion: 'Estrategias',  gestion: 'Soluciones' },
  colaborador: { fundamentacion: 'Investigador',  creacion: 'Desarrollador',       implementacion: 'Planificador', gestion: 'Líder' },
};

const PISO_LABEL: Record<string, string> = { global: 'Global', pilar: 'Pilar', controlador: 'Controlador', colaborador: 'Colaborador' };
const PASO_LABEL: Record<string, string> = { fundamentacion: 'Fundamentación', creacion: 'Creación', implementacion: 'Implementación', gestion: 'Gestión' };

export default function SystemsTab() {
  const [systems, setSystems] = useState<any[]>([]);
  const [filterPiso, setFilterPiso] = useState('');
  const [filterPaso, setFilterPaso] = useState('');

  // Create/Edit modal
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPiso, setFormPiso] = useState('');
  const [formPaso, setFormPaso] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSystems = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterPiso) params.set('piso', filterPiso);
    if (filterPaso) params.set('paso', filterPaso);
    try {
      const res = await fetch(`/api/centralized/systems?${params}`);
      const data = await res.json();
      setSystems(data.data || []);
    } catch { setSystems([]); }
  }, [filterPiso, filterPaso]);

  useEffect(() => { fetchSystems(); }, [fetchSystems]);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormDesc('');
    setFormPiso(filterPiso || '');
    setFormPaso(filterPaso || '');
    setModal(true);
  };

  const openEdit = (sys: any) => {
    setEditing(sys);
    setFormName(sys.name);
    setFormDesc(sys.description || '');
    setFormPiso(sys.piso);
    setFormPaso(sys.paso);
    setModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error('El nombre es requerido'); return; }
    if (!editing && (!formPiso || !formPaso)) { toast.error('Selecciona piso y paso'); return; }
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/centralized/systems/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, description: formDesc }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast.success('Sistema actualizado');
      } else {
        const res = await fetch('/api/centralized/systems', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, description: formDesc, piso: formPiso, paso: formPaso }),
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        toast.success('Sistema creado');
      }
      setModal(false);
      fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/centralized/systems/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Sistema eliminado');
      setDeleteModal(false);
      setDeleteTarget(null);
      fetchSystems();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setDeleting(false); }
  };

  const cellName = formPiso && formPaso ? CELL_MAP[formPiso]?.[formPaso] || '' : '';

  return (
    <div>
      {/* Filters + Add button */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="w-40">
          <PixelSelect label="Piso" options={PISO_OPTIONS} value={filterPiso} onChange={(e) => setFilterPiso(e.target.value)} placeholder="Todos" />
        </div>
        <div className="w-40">
          <PixelSelect label="Paso" options={PASO_OPTIONS} value={filterPaso} onChange={(e) => setFilterPaso(e.target.value)} placeholder="Todos" />
        </div>
        {filterPiso && filterPaso && CELL_MAP[filterPiso]?.[filterPaso] && (
          <div className="flex items-center gap-2 pb-1">
            <span className="text-[9px] text-digi-muted" style={pf}>Celda:</span>
            <PixelBadge variant="info">{CELL_MAP[filterPiso][filterPaso]}</PixelBadge>
          </div>
        )}
        <div className="ml-auto pb-0.5">
          <button onClick={openCreate} className="pixel-btn pixel-btn-primary text-[9px]" style={pf}>
            + Nuevo Sistema
          </button>
        </div>
      </div>

      {/* Table */}
      <PixelDataTable
        columns={[
          { key: 'id', header: 'ID', render: (r: any) => `#${r.id}`, width: '60px' },
          { key: 'name', header: 'Nombre', render: (r: any) => (
            <span className="text-[10px] text-digi-text" style={mf}>{r.name}</span>
          )},
          { key: 'cell', header: 'Celda', render: (r: any) => (
            <PixelBadge variant="info">{r.cell_name}</PixelBadge>
          ), width: '160px' },
          { key: 'piso', header: 'Piso', render: (r: any) => (
            <span className="text-[10px] text-digi-muted" style={mf}>{PISO_LABEL[r.piso] || r.piso}</span>
          ), width: '110px' },
          { key: 'paso', header: 'Paso', render: (r: any) => (
            <span className="text-[10px] text-digi-muted" style={mf}>{PASO_LABEL[r.paso] || r.paso}</span>
          ), width: '130px' },
          { key: 'status', header: 'Estado', render: (r: any) => (
            <PixelBadge variant={r.is_active ? 'success' : 'error'}>
              {r.is_active ? 'Activo' : 'Inactivo'}
            </PixelBadge>
          ), width: '90px' },
          { key: 'actions', header: '', width: '120px', render: (r: any) => (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); openEdit(r); }}
                className="text-[9px] text-accent-glow border border-accent/40 px-2 py-0.5 hover:bg-accent/10 transition-colors"
                style={pf}
              >
                Editar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); setDeleteModal(true); }}
                className="text-[9px] text-red-400 border border-red-500/30 px-2 py-0.5 hover:bg-red-900/20 transition-colors"
                style={pf}
              >
                Eliminar
              </button>
            </div>
          )},
        ]}
        data={systems}
        emptyTitle="Sin sistemas"
        emptyDesc="No hay sistemas registrados. Usa los filtros de piso y paso, luego crea un nuevo sistema."
      />

      {/* Create/Edit Modal */}
      <PixelModal open={modal} onClose={() => !saving && setModal(false)} title={editing ? 'Editar Sistema' : 'Nuevo Sistema'}>
        <div className="space-y-3">
          {!editing && (
            <>
              <PixelSelect label="Piso" options={PISO_OPTIONS} value={formPiso} onChange={(e) => setFormPiso(e.target.value)} placeholder="Seleccionar..." />
              <PixelSelect label="Paso" options={PASO_OPTIONS} value={formPaso} onChange={(e) => setFormPaso(e.target.value)} placeholder="Seleccionar..." />
              {cellName && (
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[9px] text-digi-muted" style={pf}>Celda asignada:</span>
                  <PixelBadge variant="info">{cellName}</PixelBadge>
                </div>
              )}
            </>
          )}
          {editing && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] text-digi-muted" style={pf}>Celda:</span>
              <PixelBadge variant="info">{editing.cell_name}</PixelBadge>
            </div>
          )}
          <PixelInput label="Nombre del Sistema" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ej: Sistema de Análisis" />
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripción (opcional)</label>
            <textarea
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none"
              style={mf}
              placeholder="Descripción del sistema..."
            />
          </div>
          <button onClick={handleSave} disabled={saving} className="w-full pixel-btn pixel-btn-primary text-[9px] disabled:opacity-50" style={pf}>
            {saving ? 'Guardando...' : editing ? 'Actualizar' : 'Crear Sistema'}
          </button>
        </div>
      </PixelModal>

      {/* Delete Confirm */}
      <PixelModal open={deleteModal} onClose={() => !deleting && setDeleteModal(false)} title="Confirmar Eliminación">
        <div className="space-y-3">
          <p className="text-[10px] text-digi-text" style={mf}>
            ¿Eliminar el sistema <strong className="text-accent-glow">{deleteTarget?.name}</strong>? Esto también eliminará todos los accesos asociados.
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteModal(false)} disabled={deleting} className="flex-1 pixel-btn pixel-btn-secondary text-[9px] disabled:opacity-50" style={pf}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex-1 py-2 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors disabled:opacity-50"
              style={pf}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
