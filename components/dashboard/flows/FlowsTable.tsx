'use client';

/**
 * FlowsTable — tabla de Automatizaciones (flujos). Extraída del módulo Admin →
 * pestaña "Flujos" a un componente autocontenido para usarse como módulo propio
 * (/dashboard/automatizaciones). No recibe props.
 */

import { useEffect, useState, useCallback } from 'react';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';
import FlowSidePanel from '@/components/dashboard/flows/FlowSidePanel';
import WhatsAppFlowPanel from '@/components/dashboard/flows/WhatsAppFlowPanel';
import ChatbotFlowPanel from '@/components/dashboard/flows/ChatbotFlowPanel';

const pf = { fontFamily: 'var(--font-display)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;

const FLOW_TYPES: Record<string, { label: string; color: string }> = {
  email: { label: 'Email Masivo', color: 'text-blue-400' },
  whatsapp: { label: 'WhatsApp', color: 'text-green-400' },
  chatbot: { label: 'Chatbot', color: 'text-yellow-400' },
  ai_agent: { label: 'Agente IA', color: 'text-purple-400' },
  custom: { label: 'Personalizado', color: 'text-digi-muted' },
};

const FLOW_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', active: 'success', paused: 'warning', archived: 'error',
};

const FLOW_STATUS_LABELS: Record<string, string> = {
  draft: 'Borrador', active: 'Activo', paused: 'Pausado', archived: 'Archivado',
};

interface Flow {
  id: number;
  name: string;
  type: string;
  description: string;
  status: string;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export default function FlowsTable() {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState<Flow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);

  const [form, setForm] = useState({ name: '', type: 'email', description: '' });

  const fetchFlows = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/flows');
      const data = await res.json();
      setFlows(data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlows(); }, [fetchFlows]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', type: 'email', description: '' });
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
    setSaving(true);
    setFormError('');
    try {
      const url = editing ? `/api/admin/flows/${editing.id}` : '/api/admin/flows';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error || 'Error al guardar');
        return;
      }
      setModalOpen(false);
      fetchFlows();
    } catch {
      setFormError('Error de conexion');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (flow: Flow) => {
    const nextStatus = flow.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/admin/flows/${flow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchFlows();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/flows/${confirmDelete.id}`, { method: 'DELETE' });
      setConfirmDelete(null);
      fetchFlows();
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><BrandLoader size="md" label="Cargando flujos..." /></div>;

  let filtered = flows;
  if (filterType !== 'all') filtered = filtered.filter(f => f.type === filterType);
  if (filterStatus !== 'all') filtered = filtered.filter(f => f.status === filterStatus);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Type filter */}
        <div className="flex gap-1">
          {[{ value: 'all', label: 'Todos' }, ...Object.entries(FLOW_TYPES).map(([v, t]) => ({ value: v, label: t.label }))].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              className={`px-2 py-1 text-[9px] border transition-colors ${
                filterType === opt.value ? 'border-accent text-accent-glow bg-accent/10' : 'border-digi-border text-digi-muted'
              }`}
              style={pf}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
          style={{
            ...mf,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            paddingRight: '28px',
          }}
        >
          <option value="all">Todos los estados</option>
          {Object.entries(FLOW_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {/* Create button */}
        <button onClick={openCreate} className="ml-auto pixel-btn-primary px-3 py-1.5 text-[9px]" style={pf}>
          + Nuevo Flujo
        </button>
      </div>

      {/* Table */}
      <PixelDataTable
        columns={[
          { key: 'name', header: 'Nombre', render: (f: Flow) => (
            <span className="text-digi-text font-medium">{f.name}</span>
          )},
          { key: 'type', header: 'Tipo', render: (f: Flow) => {
            const t = FLOW_TYPES[f.type] || FLOW_TYPES.custom;
            return <span className={t.color}>{t.label}</span>;
          }},
          { key: 'description', header: 'Descripcion', render: (f: Flow) => (
            <span className="text-digi-muted truncate max-w-[200px] inline-block">{f.description || '-'}</span>
          )},
          { key: 'status', header: 'Estado', render: (f: Flow) => (
            <PixelBadge variant={FLOW_STATUS_V[f.status] || 'default'}>
              {FLOW_STATUS_LABELS[f.status] || f.status}
            </PixelBadge>
          )},
          { key: 'date', header: 'Creado', render: (f: Flow) => new Date(f.created_at).toLocaleDateString() },
          { key: 'actions', header: '', width: '120px', render: (f: Flow) => (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => handleToggleStatus(f)}
                className={`px-2 py-0.5 text-[8px] border transition-colors ${
                  f.status === 'active'
                    ? 'border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/20'
                    : 'border-green-700/50 text-green-400 hover:bg-green-900/20'
                }`}
                style={pf}
                title={f.status === 'active' ? 'Pausar' : 'Activar'}
              >
                {f.status === 'active' ? 'Pausar' : 'Activar'}
              </button>
              <button
                onClick={() => openEdit(f)}
                className="px-2 py-0.5 text-[8px] border border-accent/50 text-accent-glow hover:bg-accent/10 transition-colors"
                style={pf}
              >
                Editar
              </button>
              <button
                onClick={() => setConfirmDelete(f)}
                className="px-2 py-0.5 text-[8px] border border-red-700/50 text-red-400 hover:bg-red-900/20 transition-colors"
                style={pf}
              >
                X
              </button>
            </div>
          )},
        ]}
        data={filtered}
        onRowClick={(f) => setSelectedFlow(f)}
        emptyTitle="Sin flujos"
        emptyDesc="Crea tu primer flujo de automatizacion."
      />

      {/* Side Panel */}
      {selectedFlow && selectedFlow.type === 'whatsapp' && (
        <WhatsAppFlowPanel flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}
      {selectedFlow && selectedFlow.type === 'chatbot' && (
        <ChatbotFlowPanel flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}
      {selectedFlow && selectedFlow.type !== 'whatsapp' && selectedFlow.type !== 'chatbot' && (
        <FlowSidePanel flow={selectedFlow} onClose={() => setSelectedFlow(null)} />
      )}

      {/* Create/Edit Modal */}
      <PixelModal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Flujo' : 'Nuevo Flujo'}>
        <div className="space-y-4">
          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Nombre</label>
            <input
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del flujo"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>

          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Tipo</label>
            <select
              value={form.type}
              onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
              style={{
                ...mf,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                paddingRight: '28px',
              }}
            >
              {Object.entries(FLOW_TYPES).map(([v, t]) => (
                <option key={v} value={v}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Descripcion</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descripcion del flujo..."
              rows={3}
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none"
              style={mf}
            />
          </div>

          {formError && <p className="text-xs text-red-400" style={mf}>{formError}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-digi-text transition-colors" style={pf}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} className="pixel-btn-primary px-4 py-2 text-[9px]" style={pf}>
              {saving ? 'Guardando...' : editing ? 'Guardar' : 'Crear'}
            </button>
          </div>
        </div>
      </PixelModal>

      {/* Delete Confirmation Modal */}
      <PixelModal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar Flujo" size="sm">
        <div className="space-y-4">
          <p className="text-xs text-digi-muted" style={mf}>
            Estas seguro de eliminar <span className="text-digi-text">{confirmDelete?.name}</span>? Esta accion no se puede deshacer.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
            <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:border-digi-muted hover:text-digi-text transition-colors" style={pf}>
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-[9px] border-2 border-red-700 bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
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
