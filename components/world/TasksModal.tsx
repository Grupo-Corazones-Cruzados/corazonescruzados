'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Loader2, Check, Ban, Eye, Edit3, Save, AlertTriangle, Send,
  ImagePlus, Trash2, Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Incident, IncidentStatus, IncidentSeverity } from '@/types/incidents';

const STATUS_CFG: Record<IncidentStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: 'Pendiente',   color: 'text-yellow-400', bg: 'bg-yellow-400/15 border-yellow-400/30', icon: Clock },
  approved:  { label: 'Aprobada',    color: 'text-blue-400',   bg: 'bg-blue-400/15 border-blue-400/30',     icon: CheckCircle },
  rejected:  { label: 'Rechazada',   color: 'text-red-400',    bg: 'bg-red-400/15 border-red-400/30',       icon: XCircle },
  reviewing: { label: 'En revisión', color: 'text-purple-400', bg: 'bg-purple-400/15 border-purple-400/30', icon: Eye },
  completed: { label: 'Completada',  color: 'text-green-400',  bg: 'bg-green-400/15 border-green-400/30',   icon: CheckCircle },
};

const SEVERITY_CFG: Record<IncidentSeverity, { label: string; color: string; bg: string }> = {
  low:      { label: 'Baja',    color: 'text-blue-300',   bg: 'bg-blue-400/15 border-blue-400/30' },
  medium:   { label: 'Media',   color: 'text-yellow-400', bg: 'bg-yellow-400/15 border-yellow-400/30' },
  high:     { label: 'Alta',    color: 'text-orange-400', bg: 'bg-orange-400/15 border-orange-400/30' },
  critical: { label: 'Critica', color: 'text-red-400',    bg: 'bg-red-400/15 border-red-400/30' },
};

const PAGE_SIZE = 5;

interface Props {
  open: boolean;
  onClose: () => void;
  activeAgentId: string | null;
  agentProjectMap: Record<string, string>; // agentId → projectStructureId
  onSendToAgent?: (agentId: string, message: string, images: string[]) => void;
  initialTaskId?: string | null;
}

export default function TasksModal({ open, onClose, activeAgentId, agentProjectMap, onSendToAgent, initialTaskId }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageIdx, setDeletingImageIdx] = useState<number | null>(null);

  // Images are NOT loaded by default — user must click to view them
  const [loadedImages, setLoadedImages] = useState<string[]>([]);
  const [imagesVisible, setImagesVisible] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);

  const activeProjectId = activeAgentId ? agentProjectMap[activeAgentId] : null;

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    const url = initialTaskId
      ? '/api/incidents'
      : activeProjectId
        ? `/api/incidents?projectId=${activeProjectId}`
        : '/api/incidents';
    const res = await fetch(url);
    const data = await res.json();
    setIncidents(data);
    setLoading(false);
    return data as Incident[];
  }, [activeProjectId, initialTaskId]);

  const fetchFullIncident = useCallback(async (id: string) => {
    const res = await fetch(`/api/incidents/${id}`);
    if (!res.ok) return null;
    return (await res.json()) as Incident;
  }, []);

  // Open detail WITHOUT loading images
  const openDetail = useCallback((inc: Incident) => {
    setDetail(inc);
    setLoadedImages([]);
    setImagesVisible(false);
  }, []);

  // Load images on demand when user clicks
  const showImages = useCallback(async () => {
    if (!detail) return;
    setLoadingImages(true);
    const full = await fetchFullIncident(detail.id);
    if (full) {
      setLoadedImages(full.images || []);
      setDetail(full);
    }
    setImagesVisible(true);
    setLoadingImages(false);
  }, [detail, fetchFullIncident]);

  useEffect(() => {
    if (open) {
      fetchIncidents().then(data => {
        if (initialTaskId) {
          const task = data.find((i: Incident) => i.id === initialTaskId);
          if (task) {
            openDetail(task);
            return;
          }
        }
        setDetail(null);
      });
      setPage(0);
      setImagesVisible(false);
      setLoadedImages([]);
    }
  }, [open, fetchIncidents, initialTaskId, openDetail]);

  const sendToAgent = (inc: Incident, statusLabel: string) => {
    if (!onSendToAgent) return;
    const agentId = Object.entries(agentProjectMap).find(
      ([, pId]) => pId === inc.projectId,
    )?.[0];
    if (agentId) {
      const msg = `**Incidencia ${statusLabel}: ${inc.title}**\n\n${inc.description}`;
      onSendToAgent(agentId, msg, inc.images || []);
    }
  };

  const updateStatus = async (id: string, status: IncidentStatus) => {
    setUpdating(true);
    await fetch('/api/incidents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });

    if (status === 'approved' || status === 'rejected') {
      const fullInc = await fetchFullIncident(id);
      if (fullInc) {
        const statusLabel = status === 'approved' ? 'aprobada' : 'rechazada';
        sendToAgent(fullInc, statusLabel);
      }
    }

    await fetchIncidents();
    setUpdating(false);
    setDetail(null);
    onClose();
  };

  const changeStatus = async (id: string, status: IncidentStatus) => {
    setUpdating(true);
    await fetch('/api/incidents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await fetchIncidents();
    if (detail?.id === id) setDetail(prev => prev ? { ...prev, status } : null);
    setUpdating(false);
  };

  const resendToAgent = async (inc: Incident) => {
    // Need full images for agent
    let fullInc = inc;
    if (!inc.images || inc.images.length === 0) {
      const fetched = await fetchFullIncident(inc.id);
      if (fetched) fullInc = fetched;
    }
    sendToAgent(fullInc, 'reenvío');
    setDetail(null);
    onClose();
  };

  const addImages = async (files: FileList) => {
    if (!detail || files.length === 0) return;
    setUploadingImages(true);
    const form = new FormData();
    Array.from(files).forEach(f => form.append('images', f));
    try {
      const res = await fetch(`/api/incidents/${detail.id}/images`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        setLoadedImages(updated.images || []);
        await fetchIncidents();
      }
    } finally {
      setUploadingImages(false);
    }
  };

  const removeImage = async (imageIndex: number) => {
    if (!detail) return;
    setDeletingImageIdx(imageIndex);
    try {
      const res = await fetch(`/api/incidents/${detail.id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageIndex }),
      });
      if (res.ok) {
        const updated = await res.json();
        setDetail(updated);
        setLoadedImages(updated.images || []);
        await fetchIncidents();
      }
    } finally {
      setDeletingImageIdx(null);
    }
  };

  const saveEdit = async () => {
    if (!detail) return;
    setUpdating(true);
    await fetch('/api/incidents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detail.id, title: editTitle, description: editDesc }),
    });
    setDetail({ ...detail, title: editTitle, description: editDesc });
    setEditing(false);
    setUpdating(false);
    await fetchIncidents();
  };

  if (!open) return null;

  const totalPages = Math.ceil(incidents.length / PAGE_SIZE);
  const pageIncidents = incidents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Image count: from imageCount field (list) or images array (full)
  const detailImageCount = detail
    ? (detail.imageCount ?? detail.images?.length ?? 0)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative w-[95vw] max-w-lg max-h-[85vh] flex flex-col bg-[#0d1117] border-2 border-[#30363d] rounded-lg shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)' }}
      >
        {/* title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            {detail && (
              <button onClick={() => { setDetail(null); setEditing(false); setImagesVisible(false); setLoadedImages([]); }} className="text-[#484f58] hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
            )}
            <h3 className="text-sm font-bold tracking-wide" style={{ fontFamily: 'Silkscreen, cursive' }}>
              {detail ? 'Detalle' : 'Tareas'}
            </h3>
            {!detail && activeProjectId && (
              <span className="text-[10px] text-[#484f58] font-mono">filtro: {activeAgentId}</span>
            )}
            {!detail && !activeProjectId && (
              <span className="text-[10px] text-[#484f58] font-mono">global</span>
            )}
          </div>
          <button onClick={onClose} className="text-[#484f58] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#484f58]">
              <Loader2 size={18} className="animate-spin mr-2" /> Cargando...
            </div>
          ) : detail ? (
            /* ─── DETAIL VIEW ─── */
            <div className="p-4 space-y-4">
              {/* status + severity + actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const cfg = STATUS_CFG[detail.status];
                  const Icon = cfg.icon;
                  const sevCfg = SEVERITY_CFG[(detail.severity as IncidentSeverity) || 'medium'];
                  return (
                    <>
                      <span className={cn('flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium', cfg.bg, cfg.color)}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                      <span className={cn('px-2 py-1 rounded border text-[11px] font-medium', sevCfg.bg, sevCfg.color)}>
                        {sevCfg.label}
                      </span>
                    </>
                  );
                })()}
                <span className="text-[10px] text-[#484f58] font-mono ml-auto">
                  {detail.clientName} — {new Date(detail.createdAt).toLocaleDateString()}
                </span>
              </div>

              {/* title + desc */}
              {editing ? (
                <div className="space-y-2">
                  <input
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full bg-[#1a1a1a] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none"
                  />
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={5}
                    className="w-full bg-[#1a1a1a] border border-[#30363d] rounded px-3 py-2 text-sm text-white outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveEdit}
                      disabled={updating}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
                    >
                      {updating ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-3 py-1.5 text-xs text-[#484f58] hover:text-white"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-semibold">{detail.title}</h4>
                    <button
                      onClick={() => { setEditing(true); setEditTitle(detail.title); setEditDesc(detail.description); }}
                      className="text-[#484f58] hover:text-white transition-colors shrink-0"
                    >
                      <Edit3 size={13} />
                    </button>
                  </div>
                  <p className="text-sm text-[#c9d1d9] whitespace-pre-wrap leading-relaxed">{detail.description}</p>
                </>
              )}

              {/* images section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-[#484f58] font-mono uppercase">
                    Imagenes adjuntas {detailImageCount > 0 && `(${detailImageCount})`}
                  </p>
                  <label className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded border text-[10px] cursor-pointer transition-colors',
                    'bg-[#1a1a1a] border-[#30363d] text-[#8b949e] hover:text-white hover:border-white/30',
                    uploadingImages && 'opacity-50 pointer-events-none',
                  )}>
                    {uploadingImages ? <Loader2 size={10} className="animate-spin" /> : <ImagePlus size={10} />}
                    Agregar
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      className="hidden"
                      onChange={e => { if (e.target.files) addImages(e.target.files); e.target.value = ''; }}
                    />
                  </label>
                </div>

                {detailImageCount === 0 && !imagesVisible && (
                  <p className="text-[10px] text-[#484f58] italic">Sin imágenes adjuntas</p>
                )}

                {/* Placeholder: images not yet loaded */}
                {detailImageCount > 0 && !imagesVisible && (
                  <button
                    onClick={showImages}
                    disabled={loadingImages}
                    className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-[#1a1a1a] border border-[#30363d] rounded hover:bg-white/5 hover:border-white/20 transition-colors"
                  >
                    {loadingImages ? (
                      <Loader2 size={14} className="animate-spin text-[#484f58]" />
                    ) : (
                      <ImageIcon size={14} className="text-[#484f58]" />
                    )}
                    <span className="text-[11px] text-[#8b949e]">
                      {loadingImages ? 'Cargando imágenes...' : `Ver ${detailImageCount} ${detailImageCount === 1 ? 'imagen' : 'imágenes'}`}
                    </span>
                  </button>
                )}

                {/* Loaded images */}
                {imagesVisible && loadedImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {loadedImages.map((img, i) => (
                      <div key={i} className="relative group">
                        <a href={`${img}`} target="_blank" rel="noopener noreferrer">
                          <img
                            src={`${img}`}
                            alt=""
                            className="w-28 h-28 object-cover rounded border border-[#30363d] hover:border-white/40 transition-colors"
                          />
                        </a>
                        <button
                          onClick={() => removeImage(i)}
                          disabled={deletingImageIdx === i}
                          className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-red-500/90 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 disabled:opacity-50"
                          title="Eliminar imagen"
                        >
                          {deletingImageIdx === i
                            ? <Loader2 size={10} className="animate-spin" />
                            : <Trash2 size={10} />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* action buttons */}
              {detail.status === 'pending' && (
                <div className="flex gap-2 pt-2 border-t border-[#30363d]">
                  <button
                    onClick={() => updateStatus(detail.id, 'approved')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-500/25 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} /> Aprobar y enviar al agente
                  </button>
                  <button
                    onClick={() => updateStatus(detail.id, 'rejected')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/25 disabled:opacity-50 transition-colors"
                  >
                    <Ban size={14} /> Rechazar
                  </button>
                </div>
              )}
              {(detail.status === 'approved' || detail.status === 'rejected') && (
                <div className="flex gap-2 pt-2 border-t border-[#30363d]">
                  <button
                    onClick={() => resendToAgent(detail)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/15 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-500/25 transition-colors"
                  >
                    <Send size={14} /> Reenviar
                  </button>
                  <button
                    onClick={() => changeStatus(detail.id, 'reviewing')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-500/15 border border-purple-500/30 rounded text-xs text-purple-400 hover:bg-purple-500/25 disabled:opacity-50 transition-colors"
                  >
                    <Eye size={14} /> En revisión
                  </button>
                  <button
                    onClick={() => changeStatus(detail.id, 'completed')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-500/25 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} /> Completada
                  </button>
                </div>
              )}
              {detail.status === 'reviewing' && (
                <div className="flex gap-2 pt-2 border-t border-[#30363d]">
                  <button
                    onClick={() => resendToAgent(detail)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/15 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-500/25 transition-colors"
                  >
                    <Send size={14} /> Reenviar
                  </button>
                  <button
                    onClick={() => changeStatus(detail.id, 'completed')}
                    disabled={updating}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-500/25 disabled:opacity-50 transition-colors"
                  >
                    <Check size={14} /> Completada
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ─── LIST VIEW ─── */
            <div className="p-2">
              {incidents.length === 0 ? (
                <div className="text-center py-10 text-[#484f58] text-sm">
                  Sin tareas {activeProjectId ? 'para este proyecto' : ''}
                </div>
              ) : (
                <div className="space-y-1">
                  {pageIncidents.map(inc => {
                    const cfg = STATUS_CFG[inc.status];
                    const Icon = cfg.icon;
                    const sevCfg = SEVERITY_CFG[(inc.severity as IncidentSeverity) || 'medium'];
                    const imgCount = inc.imageCount ?? inc.images?.length ?? 0;
                    return (
                      <div
                        key={inc.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDetail(inc)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openDetail(inc); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-white/5 transition-colors text-left group cursor-pointer"
                      >
                        <Icon size={14} className={cfg.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate group-hover:text-white transition-colors">{inc.title}</p>
                          <p className="text-[10px] text-[#484f58] font-mono">{inc.clientName} — {new Date(inc.createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-medium shrink-0', sevCfg.bg, sevCfg.color)}>
                          {sevCfg.label}
                        </span>
                        {imgCount > 0 && (
                          <span className="text-[9px] text-[#484f58] shrink-0">{imgCount} img</span>
                        )}
                        {inc.status === 'pending' && (
                          <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={e => { e.stopPropagation(); updateStatus(inc.id, 'approved'); }}
                              className="p-1 rounded bg-green-500/15 text-green-400 hover:bg-green-500/30"
                              title="Aprobar"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); updateStatus(inc.id, 'rejected'); }}
                              className="p-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/30"
                              title="Rechazar"
                            >
                              <Ban size={12} />
                            </button>
                          </div>
                        )}
                        <Eye size={12} className="text-[#484f58] group-hover:text-white shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* pagination footer (list only) */}
        {!detail && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-t border-[#30363d] shrink-0">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded text-[#484f58] hover:text-white disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[10px] text-[#484f58] font-mono">
              {page + 1} / {totalPages} ({incidents.length} tareas)
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded text-[#484f58] hover:text-white disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
