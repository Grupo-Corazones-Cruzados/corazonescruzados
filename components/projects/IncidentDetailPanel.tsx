'use client';

import { useState, useEffect } from 'react';
import PixelBadge from '@/components/ui/PixelBadge';
import BrandLoader from '@/components/ui/BrandLoader';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const SEV_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  low: 'default', medium: 'warning', high: 'error', critical: 'error',
};
const INC_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', proposal: 'default', approved: 'info', reviewing: 'info', completed: 'success', rejected: 'error',
};
const SEVERITIES = ['low', 'medium', 'high', 'critical'];

interface IncidentDetailPanelProps {
  incidentId: string;
  onClose: () => void;
  onApprove: (incident: { id: string; title: string; description: string; images: string[] }) => void;
  onReject: (incidentId: string) => void;
  onStatusChange: () => void;
  isLocalhost: boolean;
}

export default function IncidentDetailPanel({ incidentId, onClose, onApprove, onReject, onStatusChange, isLocalhost }: IncidentDetailPanelProps) {
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSeverity, setEditSeverity] = useState('medium');
  const [editClient, setEditClient] = useState('');

  useEffect(() => {
    setLoading(true);
    setEditing(false);
    fetch(`/api/incidents/${incidentId}`)
      .then(r => r.json())
      .then(data => {
        setIncident(data);
        setEditTitle(data.title || '');
        setEditDesc(data.description || '');
        setEditSeverity(data.severity || 'medium');
        setEditClient(data.clientName || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [incidentId]);

  const handleSave = async () => {
    if (!incident) return;
    setUpdating(true);
    try {
      await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: incident.id,
          title: editTitle,
          description: editDesc,
          severity: editSeverity,
          clientName: editClient,
        }),
      });
      setIncident({ ...incident, title: editTitle, description: editDesc, severity: editSeverity, clientName: editClient });
      setEditing(false);
    } catch {} finally {
      setUpdating(false);
    }
  };

  const handleSetStatus = async (newStatus: string) => {
    if (!incident) return;
    setUpdating(true);
    try {
      const res = await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incident.id, status: newStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Status update failed:', err);
        return;
      }
      setIncident({ ...incident, status: newStatus });
      onStatusChange();
    } catch (e) {
      console.error('Status update error:', e);
    } finally {
      setUpdating(false);
    }
  };

  const handleApprove = async () => {
    if (!incident) return;
    setUpdating(true);
    try {
      await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incident.id, status: 'approved' }),
      });
      onApprove({
        id: incident.id,
        title: incident.title,
        description: incident.description,
        images: incident.images || [],
      });
    } catch {} finally {
      setUpdating(false);
    }
  };

  const handleReject = async () => {
    if (!incident) return;
    setUpdating(true);
    try {
      await fetch('/api/incidents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incident.id, status: 'rejected' }),
      });
      onReject(incident.id);
    } catch {} finally {
      setUpdating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><BrandLoader size="sm" /></div>;
  if (!incident) return <p className="text-xs text-red-400" style={pf}>Incidencia no encontrada</p>;

  const images = incident.images || [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-[9px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>
          &lt; Volver a lista
        </button>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-[8px] text-digi-muted border border-digi-border px-2 py-0.5 hover:border-accent hover:text-accent-glow transition-colors"
            style={pf}
          >
            Editar
          </button>
        )}
      </div>

      {editing ? (
        /* ─── EDIT MODE ─── */
        <div className="space-y-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-accent-glow opacity-70" style={pf}>Titulo</label>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-accent-glow opacity-70" style={pf}>Descripcion</label>
            <textarea
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              rows={4}
              className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none"
              style={mf}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-accent-glow opacity-70" style={pf}>Cliente</label>
            <input
              value={editClient}
              onChange={(e) => setEditClient(e.target.value)}
              className="w-full px-2 py-1.5 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[9px] text-accent-glow opacity-70" style={pf}>Severidad</label>
            <div className="flex gap-1">
              {SEVERITIES.map(s => (
                <button
                  key={s}
                  onClick={() => setEditSeverity(s)}
                  className={`flex-1 py-1 text-[8px] border transition-colors ${
                    editSeverity === s
                      ? 'border-accent text-accent-glow bg-accent/10'
                      : 'border-digi-border text-digi-muted'
                  }`}
                  style={pf}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={updating || !editTitle.trim()}
              className="flex-1 py-1.5 text-[9px] text-accent-glow border-2 border-accent/40 bg-accent/10 hover:bg-accent/20 disabled:opacity-40 transition-colors"
              style={pf}
            >
              {updating ? '...' : 'Guardar'}
            </button>
            <button
              onClick={() => {
                setEditTitle(incident.title);
                setEditDesc(incident.description);
                setEditSeverity(incident.severity);
                setEditClient(incident.clientName);
                setEditing(false);
              }}
              className="flex-1 py-1.5 text-[9px] text-digi-muted border-2 border-digi-border hover:border-digi-muted transition-colors"
              style={pf}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* ─── VIEW MODE ─── */
        <>
          <div>
            <h4 className="text-xs text-white mb-1.5" style={pf}>{incident.title}</h4>
            <div className="flex gap-1.5 flex-wrap">
              <PixelBadge variant={SEV_V[incident.severity] || 'default'}>{incident.severity}</PixelBadge>
              <PixelBadge variant={INC_V[incident.status] || 'default'}>{incident.status}</PixelBadge>
            </div>
          </div>

          <div className="text-[9px] text-digi-muted" style={mf}>
            {incident.clientName} &middot; {new Date(incident.createdAt).toLocaleDateString()}
          </div>

          <div className="px-2 py-2 bg-digi-darker border border-digi-border/50">
            <p className="text-[10px] text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{incident.description}</p>
          </div>

          {images.length > 0 && (
            <div>
              <p className="text-[9px] text-accent-glow mb-1.5" style={pf}>Imagenes ({images.length})</p>
              <div className="grid grid-cols-2 gap-1.5">
                {images.map((img: string, i: number) => (
                  <img
                    key={i}
                    src={img}
                    alt={`Imagen ${i + 1}`}
                    className="w-full border border-digi-border cursor-pointer hover:border-accent transition-colors"
                    style={{ maxHeight: 120, objectFit: 'cover' }}
                    onClick={() => setPreviewImg(img)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {incident.status !== 'completed' && (
            <div className="space-y-2 pt-1">
              {/* Primary actions */}
              <div className="flex gap-2">
                {(incident.status === 'pending' || incident.status === 'proposal') && (
                  <button
                    onClick={handleApprove}
                    disabled={updating || !isLocalhost}
                    className="flex-1 py-2 text-[9px] text-green-400 border-2 border-green-500/40 bg-green-900/10 hover:bg-green-900/20 disabled:opacity-40 transition-colors"
                    style={pf}
                    title={!isLocalhost ? 'Solo disponible en localhost' : undefined}
                  >
                    {updating ? '...' : 'Aprobar y Enviar'}
                  </button>
                )}
                {incident.status !== 'pending' && incident.status !== 'proposal' && incident.status !== 'rejected' && (
                  <button
                    onClick={handleApprove}
                    disabled={updating || !isLocalhost}
                    className="flex-1 py-2 text-[9px] text-accent-glow border-2 border-accent/40 bg-accent/10 hover:bg-accent/20 disabled:opacity-40 transition-colors"
                    style={pf}
                  >
                    {updating ? '...' : 'Reenviar al Agente'}
                  </button>
                )}
                {incident.status === 'pending' && (
                  <button
                    onClick={handleReject}
                    disabled={updating}
                    className="flex-1 py-2 text-[9px] text-red-400 border-2 border-red-500/40 bg-red-900/10 hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                    style={pf}
                  >
                    {updating ? '...' : 'Rechazar'}
                  </button>
                )}
              </div>

              {/* Secondary: status changes */}
              <div className="flex gap-1.5 flex-wrap">
                {incident.status !== 'proposal' && (
                  <button
                    onClick={() => handleSetStatus('proposal')}
                    disabled={updating}
                    className="px-2 py-1 text-[8px] text-digi-muted border border-digi-border hover:border-digi-muted hover:text-digi-text disabled:opacity-40 transition-colors"
                    style={pf}
                  >
                    Propuesta
                  </button>
                )}
                {incident.status !== 'pending' && (
                  <button
                    onClick={() => handleSetStatus('pending')}
                    disabled={updating}
                    className="px-2 py-1 text-[8px] text-yellow-400/70 border border-yellow-500/30 hover:border-yellow-500/50 disabled:opacity-40 transition-colors"
                    style={pf}
                  >
                    Pendiente
                  </button>
                )}
                {incident.status !== 'reviewing' && incident.status !== 'pending' && incident.status !== 'proposal' && (
                  <button
                    onClick={() => handleSetStatus('reviewing')}
                    disabled={updating}
                    className="px-2 py-1 text-[8px] text-accent-glow/70 border border-accent/30 hover:border-accent/50 disabled:opacity-40 transition-colors"
                    style={pf}
                  >
                    En Revision
                  </button>
                )}
                {incident.status !== 'completed' && (
                  <button
                    onClick={() => handleSetStatus('completed')}
                    disabled={updating}
                    className="px-2 py-1 text-[8px] text-green-400/70 border border-green-500/30 hover:border-green-500/50 disabled:opacity-40 transition-colors"
                    style={pf}
                  >
                    Completada
                  </button>
                )}
              </div>

              {!isLocalhost && (incident.status === 'pending' || incident.status === 'proposal') && (
                <p className="text-[8px] text-red-400/60" style={pf}>
                  Aprobar y enviar solo disponible en localhost
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Image preview modal */}
      {previewImg && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 cursor-pointer"
          onClick={() => setPreviewImg(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImg}
              alt="Preview"
              className="max-w-full max-h-[85vh] object-contain border-2 border-digi-border"
            />
            <button
              onClick={() => setPreviewImg(null)}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-digi-darker/90 border border-digi-border text-digi-muted hover:text-white transition-colors"
              style={pf}
            >
              X
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
