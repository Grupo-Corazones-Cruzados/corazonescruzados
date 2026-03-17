'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Clock, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Loader2, Filter, Eye, Edit3, Save, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Incident, IncidentStatus } from '@/types/incidents';

const STATUS_CFG: Record<IncidentStatus, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending:   { label: 'Pendiente',  color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/30', icon: Clock },
  approved:  { label: 'Aprobada',   color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/30',     icon: CheckCircle },
  rejected:  { label: 'Rechazada',  color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30',       icon: XCircle },
  completed: { label: 'Completada', color: 'text-green-400',  bg: 'bg-green-400/10 border-green-400/30',   icon: CheckCircle },
};

interface ProjectInfo { id: string; name: string; agentId: string }

export default function TasksPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [detail, setDetail] = useState<Incident | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [incRes, projRes] = await Promise.all([
      fetch('/api/incidents').then(r => r.json()),
      fetch('/api/project-structures').then(r => r.json()),
    ]);
    setIncidents(incRes);
    setProjects(projRes.map((p: any) => ({ id: p.id, name: p.name, agentId: p.agentId })));
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (id: string, status: IncidentStatus) => {
    setSaving(true);
    await fetch('/api/incidents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    await fetchData();
    if (detail?.id === id) setDetail(prev => prev ? { ...prev, status } : null);
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!detail) return;
    setSaving(true);
    await fetch('/api/incidents', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: detail.id, title: editTitle, description: editDesc }),
    });
    setDetail({ ...detail, title: editTitle, description: editDesc });
    setEditing(false);
    setSaving(false);
    await fetchData();
  };

  const filtered = incidents.filter(i => {
    if (filterProject && i.projectId !== filterProject) return false;
    if (filterStatus && i.status !== filterStatus) return false;
    return true;
  });

  const projectName = (projectId: string) =>
    projects.find(p => p.id === projectId)?.name || projectId;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#737373]">
        <Loader2 size={18} className="animate-spin mr-2" /> Cargando...
      </div>
    );
  }

  // ─── Detail view ───
  if (detail) {
    const cfg = STATUS_CFG[detail.status];
    const Icon = cfg.icon;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => { setDetail(null); setEditing(false); }}
          className="text-xs text-[#737373] hover:text-white flex items-center gap-1"
        >
          <ChevronDown size={12} className="rotate-90" /> Volver a la lista
        </button>

        <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-5 space-y-4">
          {/* status */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('flex items-center gap-1 px-2 py-1 rounded border text-[11px] font-medium', cfg.bg, cfg.color)}>
              <Icon size={12} /> {cfg.label}
            </span>
            <span className="text-[10px] text-[#737373] font-mono">
              {projectName(detail.projectId)}
            </span>
            <span className="text-[10px] text-[#737373] font-mono ml-auto">
              {detail.clientName} — {new Date(detail.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* content */}
          {editing ? (
            <div className="space-y-2">
              <input
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none"
              />
              <textarea
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                rows={5}
                className="w-full bg-[#111] border border-[#2a2a2a] rounded px-3 py-2 text-sm text-white outline-none resize-none"
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 border border-blue-500/30 rounded text-xs text-blue-400 hover:bg-blue-500/30 disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar
                </button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-[#737373] hover:text-white">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold">{detail.title}</h3>
                <button onClick={() => { setEditing(true); setEditTitle(detail.title); setEditDesc(detail.description); }}
                  className="text-[#737373] hover:text-white shrink-0">
                  <Edit3 size={14} />
                </button>
              </div>
              <p className="text-sm text-[#c9d1d9] whitespace-pre-wrap leading-relaxed">{detail.description}</p>
            </>
          )}

          {/* images */}
          {detail.images.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] text-[#737373] font-mono uppercase">Imagenes adjuntas</p>
              <div className="flex flex-wrap gap-2">
                {detail.images.map((img, i) => (
                  <a key={i} href={`${img}`} target="_blank" rel="noopener noreferrer">
                    <img src={`${img}`} alt="" className="w-28 h-28 object-cover rounded border border-[#2a2a2a] hover:border-white/40 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* actions */}
          {detail.status === 'pending' && (
            <div className="flex gap-2 pt-3 border-t border-[#2a2a2a]">
              <button onClick={() => updateStatus(detail.id, 'approved')} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded text-xs text-green-400 hover:bg-green-500/25 disabled:opacity-50">
                <CheckCircle size={14} /> Aprobar
              </button>
              <button onClick={() => updateStatus(detail.id, 'rejected')} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/15 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/25 disabled:opacity-50">
                <XCircle size={14} /> Rechazar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── List view ───
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={{ fontFamily: 'Silkscreen, cursive' }}>Incidencias</h2>
        <p className="text-sm text-[#737373] mt-1">Todas las incidencias de los proyectos</p>
      </div>

      {/* filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-[#737373]" />
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white outline-none"
        >
          <option value="">Todos los proyectos</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1a1a1a] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white outline-none"
        >
          <option value="">Todos los estados</option>
          <option value="pending">Pendiente</option>
          <option value="approved">Aprobada</option>
          <option value="rejected">Rechazada</option>
          <option value="completed">Completada</option>
        </select>
        <span className="text-[10px] text-[#737373] ml-auto">{filtered.length} resultados</span>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-[#737373] text-sm">
          No hay incidencias {filterProject || filterStatus ? 'con estos filtros' : ''}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(inc => {
            const cfg = STATUS_CFG[inc.status];
            const Icon = cfg.icon;
            return (
              <button
                key={inc.id}
                onClick={() => setDetail(inc)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg hover:bg-white/5 transition-colors text-left group"
              >
                <Icon size={14} className={cfg.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate group-hover:text-white transition-colors">{inc.title}</p>
                  <p className="text-[10px] text-[#737373] font-mono mt-0.5">
                    {projectName(inc.projectId)} — {inc.clientName} — {new Date(inc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {inc.images.length > 0 && (
                  <span className="text-[9px] text-[#737373] shrink-0">{inc.images.length} img</span>
                )}
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', cfg.bg, cfg.color)}>
                  {cfg.label}
                </span>
                <Eye size={12} className="text-[#737373] group-hover:text-white shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
