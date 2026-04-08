'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
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

interface AccessTabProps {
  isAdmin: boolean;
}

export default function AccessTab({ isAdmin }: AccessTabProps) {
  const [access, setAccess] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [filterMember, setFilterMember] = useState('');

  // Assign modal
  const [assignModal, setAssignModal] = useState(false);
  const [assignMember, setAssignMember] = useState('');
  const [assignPiso, setAssignPiso] = useState('');
  const [assignPaso, setAssignPaso] = useState('');
  const [availableSystems, setAvailableSystems] = useState<any[]>([]);
  const [selectedSystems, setSelectedSystems] = useState<number[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Revoke modal
  const [revokeModal, setRevokeModal] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<any>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchAccess = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterMember) params.set('member_id', filterMember);
    try {
      const res = await fetch(`/api/centralized/access?${params}`);
      const data = await res.json();
      setAccess(data.data || []);
    } catch { setAccess([]); }
  }, [filterMember]);

  const fetchMembers = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/admin/team');
      const data = await res.json();
      setMembers((data.data || []).filter((m: any) => m.is_active));
    } catch { setMembers([]); }
  }, [isAdmin]);

  useEffect(() => { fetchAccess(); }, [fetchAccess]);
  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // Load systems when piso+paso change in assign modal
  useEffect(() => {
    if (!assignPiso || !assignPaso) { setAvailableSystems([]); return; }
    (async () => {
      try {
        const res = await fetch(`/api/centralized/systems?piso=${assignPiso}&paso=${assignPaso}`);
        const data = await res.json();
        setAvailableSystems(data.data || []);
      } catch { setAvailableSystems([]); }
    })();
  }, [assignPiso, assignPaso]);

  const openAssign = () => {
    setAssignMember('');
    setAssignPiso('');
    setAssignPaso('');
    setSelectedSystems([]);
    setAvailableSystems([]);
    setAssignModal(true);
  };

  const toggleSystem = (id: number) => {
    setSelectedSystems((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };

  const handleAssign = async () => {
    if (!assignMember) { toast.error('Selecciona un miembro'); return; }
    if (!selectedSystems.length) { toast.error('Selecciona al menos un sistema'); return; }
    setAssigning(true);
    try {
      const res = await fetch('/api/centralized/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: Number(assignMember), system_ids: selectedSystems }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const data = await res.json();
      toast.success(`${data.count} acceso(s) asignado(s)`);
      setAssignModal(false);
      fetchAccess();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setAssigning(false); }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await fetch('/api/centralized/access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_id: revokeTarget.id }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Acceso revocado');
      setRevokeModal(false);
      setRevokeTarget(null);
      fetchAccess();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setRevoking(false); }
  };

  const cellName = assignPiso && assignPaso ? CELL_MAP[assignPiso]?.[assignPaso] || '' : '';
  const memberOptions = members.map((m) => ({ value: String(m.id), label: m.name }));

  return (
    <div>
      {/* Admin toolbar */}
      {isAdmin && (
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="w-48">
            <PixelSelect label="Filtrar por Miembro" options={memberOptions} value={filterMember} onChange={(e) => setFilterMember(e.target.value)} placeholder="Todos" />
          </div>
          <div className="ml-auto pb-0.5">
            <button onClick={openAssign} className="pixel-btn pixel-btn-primary text-[9px]" style={pf}>
              + Asignar Acceso
            </button>
          </div>
        </div>
      )}

      {/* Access table */}
      <PixelDataTable
        columns={[
          ...(isAdmin ? [{ key: 'member', header: 'Miembro', render: (r: any) => (
            <div className="flex items-center gap-1.5">
              {r.photo_url ? (
                <img src={r.photo_url} alt={r.member_name} className="w-5 h-5 rounded-full object-cover border border-digi-border" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-accent/30 border border-accent/50 flex items-center justify-center">
                  <span className="text-[7px] text-accent-glow" style={pf}>{r.member_name?.charAt(0)}</span>
                </div>
              )}
              <span className="text-[10px] text-digi-text" style={mf}>{r.member_name}</span>
            </div>
          ), width: '150px' }] : []),
          { key: 'piso', header: 'Piso', render: (r: any) => (
            <PixelBadge variant="default">{PISO_LABEL[r.piso] || r.piso}</PixelBadge>
          ), width: '110px' },
          { key: 'paso', header: 'Paso', render: (r: any) => (
            <PixelBadge variant="default">{PASO_LABEL[r.paso] || r.paso}</PixelBadge>
          ), width: '130px' },
          { key: 'cell', header: 'Celda', render: (r: any) => (
            <PixelBadge variant="info">{r.cell_name}</PixelBadge>
          ), width: '160px' },
          { key: 'system', header: 'Sistema', render: (r: any) => (
            <span className="text-[10px] text-digi-text" style={mf}>{r.system_name}</span>
          )},
          { key: 'date', header: 'Fecha', render: (r: any) => (
            <span className="text-[10px] text-digi-muted" style={mf}>
              {new Date(r.created_at).toLocaleDateString('es-EC')}
            </span>
          ), width: '100px' },
          ...(isAdmin ? [{ key: 'actions', header: '', width: '80px', render: (r: any) => (
            <button
              onClick={(e) => { e.stopPropagation(); setRevokeTarget(r); setRevokeModal(true); }}
              className="text-[9px] text-red-400 border border-red-500/30 px-2 py-0.5 hover:bg-red-900/20 transition-colors"
              style={pf}
            >
              Revocar
            </button>
          )}] : []),
        ]}
        data={access}
        emptyTitle="Sin accesos"
        emptyDesc={isAdmin ? 'No hay accesos asignados. Usa el botón para asignar acceso a un miembro.' : 'No tienes accesos asignados aún.'}
      />

      {/* Assign Access Modal */}
      <PixelModal open={assignModal} onClose={() => !assigning && setAssignModal(false)} title="Asignar Acceso">
        <div className="space-y-3">
          <PixelSelect label="Miembro" options={memberOptions} value={assignMember} onChange={(e) => setAssignMember(e.target.value)} placeholder="Seleccionar miembro..." />
          <PixelSelect label="Piso (Rol)" options={PISO_OPTIONS} value={assignPiso} onChange={(e) => { setAssignPiso(e.target.value); setSelectedSystems([]); }} placeholder="Seleccionar piso..." />
          <PixelSelect label="Paso (Rol)" options={PASO_OPTIONS} value={assignPaso} onChange={(e) => { setAssignPaso(e.target.value); setSelectedSystems([]); }} placeholder="Seleccionar paso..." />

          {cellName && (
            <div className="flex items-center gap-2 px-1">
              <span className="text-[9px] text-digi-muted" style={pf}>Celda:</span>
              <PixelBadge variant="info">{cellName}</PixelBadge>
            </div>
          )}

          {assignPiso && assignPaso && (
            <div>
              <label className="text-[10px] text-accent-glow opacity-70 block mb-2" style={pf}>
                Sistemas disponibles
              </label>
              {availableSystems.length === 0 ? (
                <p className="text-[10px] text-digi-muted px-2 py-3 border border-digi-border/30 bg-digi-darker text-center" style={mf}>
                  No hay sistemas registrados para esta celda.
                </p>
              ) : (
                <div className="border border-digi-border/50 bg-digi-darker max-h-48 overflow-y-auto">
                  {availableSystems.map((sys: any) => (
                    <label
                      key={sys.id}
                      className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent/5 transition-colors border-b border-digi-border/20 last:border-b-0 ${
                        selectedSystems.includes(sys.id) ? 'bg-accent/10' : ''
                      }`}
                    >
                      <div
                        className={`w-4 h-4 border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          selectedSystems.includes(sys.id) ? 'border-accent bg-accent/30' : 'border-digi-border'
                        }`}
                      >
                        {selectedSystems.includes(sys.id) && (
                          <span className="text-[8px] text-accent-glow" style={pf}>✓</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-digi-text block" style={mf}>{sys.name}</span>
                        {sys.description && (
                          <span className="text-[9px] text-digi-muted block truncate" style={mf}>{sys.description}</span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={selectedSystems.includes(sys.id)}
                        onChange={() => toggleSystem(sys.id)}
                        className="sr-only"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleAssign}
            disabled={assigning || !assignMember || !selectedSystems.length}
            className="w-full pixel-btn pixel-btn-primary text-[9px] disabled:opacity-50"
            style={pf}
          >
            {assigning ? 'Asignando...' : `Asignar ${selectedSystems.length > 0 ? `(${selectedSystems.length})` : ''}`}
          </button>
        </div>
      </PixelModal>

      {/* Revoke Confirm */}
      <PixelModal open={revokeModal} onClose={() => !revoking && setRevokeModal(false)} title="Revocar Acceso">
        <div className="space-y-3">
          <p className="text-[10px] text-digi-text" style={mf}>
            ¿Revocar acceso al sistema <strong className="text-accent-glow">{revokeTarget?.system_name}</strong>
            {revokeTarget?.member_name && <> de <strong className="text-accent-glow">{revokeTarget.member_name}</strong></>}?
          </p>
          <div className="flex gap-2">
            <button onClick={() => setRevokeModal(false)} disabled={revoking} className="flex-1 pixel-btn pixel-btn-secondary text-[9px] disabled:opacity-50" style={pf}>
              Cancelar
            </button>
            <button onClick={handleRevoke} disabled={revoking}
              className="flex-1 py-2 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors disabled:opacity-50"
              style={pf}
            >
              {revoking ? 'Revocando...' : 'Revocar'}
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}
