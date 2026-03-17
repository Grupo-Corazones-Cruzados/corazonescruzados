'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  X, Clock, CheckCircle, XCircle, ChevronLeft, ChevronRight,
  Loader2, Check, Ban, Eye, Edit3, Save, AlertTriangle, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Incident, IncidentStatus } from '@/types/incidents';

const STATUS_CFG: Record<IncidentStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: 'Pendiente',  color: 'text-yellow-400', bg: 'bg-yellow-400/15 border-yellow-400/30', icon: Clock },
  approved:  { label: 'Aprobada',   color: 'text-blue-400',   bg: 'bg-blue-400/15 border-blue-400/30',     icon: CheckCircle },
  rejected:  { label: 'Rechazada',  color: 'text-red-400',    bg: 'bg-red-400/15 border-red-400/30',       icon: XCircle },
  completed: { label: 'Completada', color: 'text-green-400',  bg: 'bg-green-400/15 border-green-400/30',   icon: CheckCircle },
};

const PAGE_SIZE = 5;

interface Props {
  open: boolean;
  onClose: () => void;
  activeAgentId: string | null;
  agentProjectMap: Record<string, string>; // agentId → projectStructureId
  onSendToAgent?: (agentId: string, message: string, images: string[]) => void;
}

export default function TasksModal({ open, onClose, activeAgentId, agentProjectMap, onSendToAgent }: Props) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState<Incident | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [updating, setUpdating] = useState(false);

  const activeProjectId = activeAgentId ? agentProjectMap[activeAgentId] : null;

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    const url = activeProjectId
      ? `/api/incidents?projectId=${activeProjectId}`
      : '/api/incidents';
    const res = await fetch(url);
    const data = await res.json();
    setIncidents(data);
    setLoading(false);
  }, [activeProjectId]);

  useEffect(() => {
    if (open) {
      fetchIncidents();
      setPage(0);
      setDetail(null);
    }
  }, [open, fetchIncidents]);

  const updateStatus = async (id: string, status: IncidentStatus) => {
    setUpdating(true);
    const res = await fetch('/api/incidents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const updated = await res.json();

    // If approved, send to agent
    if (status === 'approved' && onSendToAgent) {
      const inc = incidents.find(i => i.id === id) || updated;
      // Find which agent owns this project
      const agentId = Object.entries(agentProjectMap).find(
        ([, pId]) => pId === inc.projectId,
      )?.[0];
      if (agentId) {
        const msg = `**Incidencia aprobada: ${inc.title}**\n\n${inc.description}`;
        onSendToAgent(agentId, msg, inc.images);
      }
    }

    await fetchIncidents();
    if (detail?.id === id) setDetail({ ...detail, status });
    setUpdating(false);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* modal frame — videogame style */}
      <div className="relative w-[95vw] max-w-lg max-h-[85vh] flex flex-col bg-[#0d1117] border-2 border-[#30363d] rounded-lg shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 0 30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)' }}
      >
        {/* title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#161b22] border-b border-[#30363d] shrink-0">
          <div className="flex items-center gap-2">
            {detail && (
              <button onClick={() => { setDetail(null); setEditing(false); }} className="text-[#484f58] hover:text-white transition-colors">
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
              {/* status + actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const cfg = STATUS_CFG[detail.status];
                  const Icon = cfg.icon;
                  return (
                    <span className={cn('flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium', cfg.bg, cfg.color)}>
                      <Icon size={12} /> {cfg.label}
                    </span>
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

              {/* images */}
              {detail.images.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-[#484f58] font-mono uppercase">Imagenes adjuntas</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.images.map((img, i) => (
                      <a key={i} href={`/api/incidents/uploads?file=${img}`} target="_blank" rel="noopener noreferrer">
                        <img
                          src={`/api/incidents/uploads?file=${img}`}
                          alt=""
                          className="w-28 h-28 object-cover rounded border border-[#30363d] hover:border-white/40 transition-colors"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

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
                    return (
                      <button
                        key={inc.id}
                        onClick={() => setDetail(inc)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded hover:bg-white/5 transition-colors text-left group"
                      >
                        <Icon size={14} className={cfg.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate group-hover:text-white transition-colors">{inc.title}</p>
                          <p className="text-[10px] text-[#484f58] font-mono">{inc.clientName} — {new Date(inc.createdAt).toLocaleDateString()}</p>
                        </div>
                        {inc.images.length > 0 && (
                          <span className="text-[9px] text-[#484f58] shrink-0">{inc.images.length} img</span>
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
                      </button>
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
