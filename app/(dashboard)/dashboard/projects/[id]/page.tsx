'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import BrandLoader from '@/components/ui/BrandLoader';
import IncidentDetailPanel from '@/components/projects/IncidentDetailPanel';
import FloatingChatWindow from '@/components/projects/FloatingChatWindow';
import TaskQueueIndicator from '@/components/projects/TaskQueueIndicator';
import useAgentChat from '@/hooks/useAgentChat';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', open: 'info', in_progress: 'warning', review: 'warning',
  completed: 'success', closed: 'success', cancelled: 'error', on_hold: 'default',
};
const SEV_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  low: 'default', medium: 'warning', high: 'error', critical: 'error',
};
const INC_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', proposal: 'default', approved: 'info', reviewing: 'info', completed: 'success', rejected: 'error',
};
const BID_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  invited: 'warning', pending: 'info', accepted: 'success', rejected: 'error',
};

export default function ProjectDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [digiProjects, setDigiProjects] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState('all');

  // CRUD states
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqCost, setReqCost] = useState('');
  const [savingReq, setSavingReq] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<number, string>>({});

  // Inline edit states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);
  const [editBudgetMin, setEditBudgetMin] = useState('');
  const [editBudgetMax, setEditBudgetMax] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');

  // Assignment states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignReqId, setAssignReqId] = useState<number | null>(null);
  const [assignMemberId, setAssignMemberId] = useState('');
  const [assignCost, setAssignCost] = useState('');
  const [savingAssign, setSavingAssign] = useState(false);
  const [acceptedMembers, setAcceptedMembers] = useState<any[]>([]);
  const [counterCosts, setCounterCosts] = useState<Record<number, string>>({});

  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';
  const memberId = user?.member_id;
  const isMemberCreator = isMember && memberId && project?.assigned_member_id == memberId;
  const isOwner = isAdmin || isMemberCreator;

  const chat = useAgentChat({ digimundoProjectId: project?.digimundo_project_id || null, digiProjects });

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setProject(data);
    } catch { toast.error('Error al cargar proyecto'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchProject(); }, [fetchProject]);
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/digimundo/projects').then(r => r.json()).then(d => setDigiProjects(d.data || [])).catch(() => {});
  }, [isAdmin]);

  // Fetch members for assignment dropdown (accepted + all active)
  useEffect(() => {
    if (!id || !project) return;
    Promise.all([
      fetch(`/api/projects/${id}/members`).then(r => r.json()),
      fetch('/api/members/list').then(r => r.json()),
    ]).then(([accepted, all]) => {
      const acceptedIds = new Set((accepted.data || []).map((m: any) => String(m.id)));
      const allMembers = (all.data || []).map((m: any) => ({
        ...m,
        isAccepted: acceptedIds.has(String(m.id)),
      }));
      setAcceptedMembers(allMembers);
    }).catch(() => {});
  }, [id, project]);

  // --- Inline save helpers ---
  const saveField = async (fields: Record<string, any>) => {
    await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
    fetchProject();
  };

  const saveTitle = async () => {
    if (!editTitle.trim()) return;
    await saveField({ title: editTitle });
    setEditingTitle(false);
    toast.success('Titulo actualizado');
  };

  const saveBudget = async () => {
    await saveField({ budget_min: editBudgetMin ? Number(editBudgetMin) : null, budget_max: editBudgetMax ? Number(editBudgetMax) : null });
    setEditingBudget(false);
    toast.success('Presupuesto actualizado');
  };

  const saveDeadline = async () => {
    await saveField({ deadline: editDeadline || null });
    setEditingDeadline(false);
    toast.success('Limite actualizado');
  };

  // --- Actions ---
  const updateStatus = async (status: string) => {
    await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    toast.success('Estado actualizado');
    fetchProject();
  };

  const linkDigimundo = async (digiId: string) => {
    setLinking(true);
    await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ digimundo_project_id: digiId || null }) });
    toast.success(digiId ? 'Vinculado' : 'Desvinculado');
    fetchProject();
    setLinking(false);
  };

  const addRequirement = async () => {
    if (!reqTitle.trim()) return;
    setSavingReq(true);
    await fetch(`/api/projects/${id}/requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: reqTitle, description: reqDesc, cost: reqCost ? Number(reqCost) : null }) });
    setReqTitle(''); setReqDesc(''); setReqCost(''); setShowReqModal(false); setSavingReq(false);
    toast.success('Requerimiento agregado');
    fetchProject();
  };

  const deleteRequirement = async (reqId: number) => {
    await fetch(`/api/projects/${id}/requirements`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: reqId }) });
    toast.success('Requerimiento eliminado');
    fetchProject();
  };

  const toggleReqComplete = async (reqId: number, completed: boolean) => {
    await fetch(`/api/projects/${id}/requirements`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: reqId, completed }) });
    fetchProject();
  };

  const addSubItem = async (reqId: number) => {
    const title = newItemText[reqId]?.trim();
    if (!title) return;
    await fetch(`/api/projects/${id}/requirements/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: reqId, title }) });
    setNewItemText(prev => ({ ...prev, [reqId]: '' }));
    fetchProject();
  };

  const toggleSubItem = async (itemId: number, completed: boolean) => {
    await fetch(`/api/projects/${id}/requirements/items`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, is_completed: completed }) });
    fetchProject();
  };

  const deleteSubItem = async (itemId: number) => {
    await fetch(`/api/projects/${id}/requirements/items`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId }) });
    fetchProject();
  };

  const openAssignModal = (reqId: number) => {
    setAssignReqId(reqId);
    setAssignMemberId('');
    setAssignCost('');
    setShowAssignModal(true);
  };

  const submitAssignment = async () => {
    if (!assignReqId || !assignMemberId || !assignCost) return;
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/projects/${id}/requirements/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_id: assignReqId, member_id: Number(assignMemberId), proposed_cost: Number(assignCost) }),
      });
      if (!res.ok) { const err = await res.json(); toast.error(err.error || 'Error'); return; }
      toast.success('Miembro asignado');
      setShowAssignModal(false);
      fetchProject();
    } catch { toast.error('Error'); }
    finally { setSavingAssign(false); }
  };

  const submitCounter = async (assignmentId: number) => {
    const cost = counterCosts[assignmentId];
    if (!cost) return;
    await fetch(`/api/projects/${id}/requirements/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId, action: 'counter', member_cost: Number(cost) }),
    });
    toast.success('Contra-propuesta enviada');
    setCounterCosts(prev => ({ ...prev, [assignmentId]: '' }));
    fetchProject();
  };

  const resolveAssignment = async (assignmentId: number, action: 'accept' | 'reject') => {
    await fetch(`/api/projects/${id}/requirements/assign`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignment_id: assignmentId, action }),
    });
    toast.success(action === 'accept' ? 'Aceptado' : 'Rechazado');
    fetchProject();
  };

  const handleApproveIncident = (incident: { id: string; title: string; description: string; images: string[] }) => {
    chat.enqueueIncident(incident);
    if (!chat.chatOpen) { chat.setChatOpen(true); chat.setChatMinimized(false); }
    toast.success(`Incidencia aprobada y enviada`);
    setSelectedIncidentId(null);
    fetchProject();
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando proyecto..." /></div>;
  if (!project) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-400">Proyecto no encontrado</p></div>;

  const reqs = project.requirements || [];
  const completedReqs = reqs.filter((r: any) => r.is_completed).length;
  const bids = project.bids || [];
  const incidents = project.incidents || [];
  const linkedDigiName = digiProjects.find((d: any) => d.id === project.digimundo_project_id)?.name;
  const canEditReqs = isOwner || bids.some((b: any) => b.member_id == memberId && b.status === 'accepted');
  // Total cost = sum of accepted assignment costs (member_cost if negotiated, else proposed_cost)
  const totalAcceptedCost = reqs.reduce((sum: number, r: any) => {
    const accepted = (r.assignments || []).filter((a: any) => a.status === 'accepted');
    return sum + accepted.reduce((s: number, a: any) => s + Number(a.member_cost ?? a.proposed_cost ?? 0), 0);
  }, 0);
  const isTerminal = ['completed', 'closed', 'cancelled'].includes(project.status);
  const hasReqs = reqs.length > 0;

  return (
    <div>
      <div className="mb-4">
        <Link href="/dashboard/projects" className="text-[10px] text-accent-glow opacity-60 hover:opacity-100" style={pf}>&lt; Volver a proyectos</Link>
      </div>

      {/* Editable title */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                autoFocus
                className="flex-1 px-2 py-1 bg-digi-darker border-2 border-accent text-lg text-white focus:outline-none"
                style={pf}
              />
              <button onClick={saveTitle} className="text-[8px] text-green-400 border border-green-500/30 px-1.5 py-0.5 hover:bg-green-900/20" style={pf}>OK</button>
              <button onClick={() => setEditingTitle(false)} className="text-[8px] text-digi-muted border border-digi-border px-1.5 py-0.5" style={pf}>X</button>
            </div>
          ) : (
            <h1
              className="pixel-heading text-lg text-white cursor-pointer hover:text-accent-glow transition-colors"
              onClick={() => { if (isOwner && !isTerminal) { setEditTitle(project.title); setEditingTitle(true); } }}
              title={isOwner && !isTerminal ? 'Click para editar' : undefined}
            >
              {project.title}
            </h1>
          )}
        </div>
        <PixelBadge variant={STATUS_V[project.status] || 'default'}>{project.status}</PixelBadge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ====== LEFT ====== */}
        <div className="lg:col-span-2 space-y-4">
          {project.description && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Descripcion</h3>
              <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{project.description}</p>
            </div>
          )}

          {/* Requirements */}
          <div className="pixel-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] text-accent-glow" style={pf}>Requerimientos ({completedReqs}/{reqs.length})</h3>
              <div className="flex items-center gap-2">
                {reqs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-digi-border"><div className="h-full bg-accent transition-all" style={{ width: `${reqs.length ? (completedReqs / reqs.length) * 100 : 0}%` }} /></div>
                    <span className="text-[9px] text-digi-muted" style={mf}>{reqs.length ? Math.round((completedReqs / reqs.length) * 100) : 0}%</span>
                  </div>
                )}
                {canEditReqs && (
                  <button onClick={() => setShowReqModal(true)} className="px-2 py-0.5 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>+ Agregar</button>
                )}
              </div>
            </div>

            {reqs.length === 0 ? (
              <p className="text-xs text-digi-muted" style={mf}>Sin requerimientos aun</p>
            ) : (
              <div className="space-y-2">
                {reqs.map((r: any) => {
                  const assignments = r.assignments || [];
                  const items = r.items || [];
                  return (
                    <div key={r.id} className="px-2.5 py-2 border border-digi-border/50">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => canEditReqs && toggleReqComplete(r.id, !r.is_completed)}
                          className={`text-[10px] mt-0.5 ${r.is_completed ? 'text-green-400' : 'text-digi-muted'} ${canEditReqs ? 'cursor-pointer hover:text-accent-glow' : ''}`}
                          style={pf}
                          disabled={!canEditReqs}
                        >
                          {r.is_completed ? '[x]' : '[ ]'}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs ${r.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</p>
                          {r.description && <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>{r.description}</p>}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.cost && <span className="text-[9px] text-accent-glow" style={mf}>${r.cost}</span>}
                          {canEditReqs && (
                            <button onClick={() => deleteRequirement(r.id)} className="text-[8px] text-red-400/50 hover:text-red-400 transition-colors" style={pf}>x</button>
                          )}
                        </div>
                      </div>

                      {/* Assignments + assign button */}
                      <div className="mt-1.5 ml-5 space-y-1">
                        {assignments.map((a: any) => (
                          <div key={a.id} className="flex items-center gap-1.5 flex-wrap px-1.5 py-1 border border-accent/20 bg-accent/5">
                            <span className="text-[8px] text-accent-glow" style={pf}>{a.member_name}</span>
                            <span className="text-[8px] text-digi-muted" style={mf}>
                              Propuesto: ${a.proposed_cost}
                              {a.member_cost != null && ` → Contra: $${a.member_cost}`}
                            </span>
                            <PixelBadge variant={a.status === 'accepted' ? 'success' : a.status === 'counter' ? 'warning' : a.status === 'rejected' ? 'error' : 'default'}>{a.status}</PixelBadge>

                            {/* Member can submit counter */}
                            {a.status === 'proposed' && a.member_id == memberId && (
                              <div className="flex items-center gap-1">
                                <input
                                  value={counterCosts[a.id] || ''}
                                  onChange={(e) => setCounterCosts(prev => ({ ...prev, [a.id]: e.target.value }))}
                                  placeholder="Tu costo"
                                  type="number"
                                  className="w-16 px-1 py-0.5 bg-digi-darker border border-digi-border text-[8px] text-digi-text focus:border-accent focus:outline-none"
                                  style={mf}
                                />
                                <button onClick={() => submitCounter(a.id)} className="text-[7px] text-accent-glow border border-accent/30 px-1 hover:bg-accent/10" style={pf}>Enviar</button>
                              </div>
                            )}

                            {/* Owner can accept/reject counter */}
                            {a.status === 'counter' && isOwner && (
                              <div className="flex gap-1">
                                <button onClick={() => resolveAssignment(a.id, 'accept')} className="text-[7px] text-green-400 border border-green-500/30 px-1 hover:bg-green-900/20" style={pf}>OK</button>
                                <button onClick={() => resolveAssignment(a.id, 'reject')} className="text-[7px] text-red-400 border border-red-500/30 px-1 hover:bg-red-900/20" style={pf}>NO</button>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Assign button (owner only, confirmed project) */}
                        {isOwner && (project.confirmed_at || isMemberCreator) && (
                          <button onClick={() => openAssignModal(r.id)} className="text-[8px] text-digi-muted hover:text-accent-glow border border-digi-border/30 hover:border-accent/30 px-1.5 py-0.5 transition-colors" style={pf}>
                            + Asignar miembro
                          </button>
                        )}
                      </div>

                      {/* Sub-items */}
                      {items.length > 0 && (
                        <div className="mt-1.5 ml-5 space-y-0.5">
                          {items.map((item: any) => (
                            <div key={item.id} className="flex items-center gap-1.5 group">
                              <button
                                onClick={() => canEditReqs && toggleSubItem(item.id, !item.is_completed)}
                                className={`text-[8px] ${item.is_completed ? 'text-green-400' : 'text-digi-muted'}`}
                                style={pf}
                                disabled={!canEditReqs}
                              >
                                {item.is_completed ? '[x]' : '[ ]'}
                              </button>
                              <span className={`text-[9px] flex-1 ${item.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{item.title}</span>
                              {canEditReqs && (
                                <button onClick={() => deleteSubItem(item.id)} className="text-[7px] text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 transition-colors" style={pf}>x</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add sub-item input */}
                      {canEditReqs && (
                        <div className="mt-1.5 ml-5 flex gap-1">
                          <input
                            value={newItemText[r.id] || ''}
                            onChange={(e) => setNewItemText(prev => ({ ...prev, [r.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && addSubItem(r.id)}
                            placeholder="+ sub-tarea..."
                            className="flex-1 px-1.5 py-0.5 bg-transparent border-b border-digi-border/30 text-[9px] text-digi-text placeholder:text-digi-muted/30 focus:border-accent/50 focus:outline-none"
                            style={mf}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Participants */}
          {bids.length > 0 && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Participantes</h3>
              <div className="space-y-2">
                {bids.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between px-2 py-1.5 border border-digi-border/50">
                    <div>
                      <span className="text-xs text-digi-text" style={mf}>{b.member_name}</span>
                      {b.bid_amount && <span className="text-[9px] text-digi-muted ml-2" style={mf}>${b.bid_amount}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PixelBadge variant={BID_V[b.status] || 'default'}>{b.status}</PixelBadge>
                      {isOwner && b.status === 'pending' && (
                        <>
                          <button onClick={async () => { await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: b.id, status: 'accepted' }) }); fetchProject(); toast.success('Aceptado'); }} className="text-[7px] text-green-400 border border-green-500/30 px-1 hover:bg-green-900/20" style={pf}>OK</button>
                          <button onClick={async () => { await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: b.id, status: 'rejected' }) }); fetchProject(); }} className="text-[7px] text-red-400 border border-red-500/30 px-1 hover:bg-red-900/20" style={pf}>NO</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div className="pixel-card">
            <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Detalles</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]" style={mf}>
              <DetailRow label="Cliente" value={project.client_name || '-'} />
              <DetailRow label="Miembro" value={project.assigned_member_name || '-'} />
              {/* Editable Budget */}
              <div className="flex justify-between py-1 border-b border-digi-border/30">
                <span className="text-digi-muted">Presupuesto</span>
                {editingBudget ? (
                  <div className="flex items-center gap-1">
                    <input value={editBudgetMin} onChange={(e) => setEditBudgetMin(e.target.value)} type="number" placeholder="Min"
                      className="w-14 px-1 py-0.5 bg-digi-darker border border-accent text-[9px] text-digi-text focus:outline-none text-right" style={mf} />
                    <span className="text-digi-muted">-</span>
                    <input value={editBudgetMax} onChange={(e) => setEditBudgetMax(e.target.value)} type="number" placeholder="Max"
                      className="w-14 px-1 py-0.5 bg-digi-darker border border-accent text-[9px] text-digi-text focus:outline-none text-right" style={mf} />
                    <button onClick={saveBudget} className="text-[7px] text-green-400 border border-green-500/30 px-1 hover:bg-green-900/20" style={pf}>OK</button>
                    <button onClick={() => setEditingBudget(false)} className="text-[7px] text-digi-muted border border-digi-border px-1" style={pf}>X</button>
                  </div>
                ) : (
                  <span
                    className={`text-digi-text text-right ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent-glow' : ''}`}
                    onClick={() => { if (isOwner && !isTerminal) { setEditBudgetMin(project.budget_min || ''); setEditBudgetMax(project.budget_max || ''); setEditingBudget(true); } }}
                  >
                    {project.budget_min ? `$${project.budget_min}${project.budget_max ? ` - $${project.budget_max}` : ''}` : '-'}
                  </span>
                )}
              </div>
              <DetailRow label="Costo Final" value={totalAcceptedCost > 0 ? `$${totalAcceptedCost.toFixed(2)}` : '$0.00'} />
              {/* Editable Deadline */}
              <div className="flex justify-between py-1 border-b border-digi-border/30">
                <span className="text-digi-muted">Limite</span>
                {editingDeadline ? (
                  <div className="flex items-center gap-1">
                    <input value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} type="date"
                      className="px-1 py-0.5 bg-digi-darker border border-accent text-[9px] text-digi-text focus:outline-none" style={mf} />
                    <button onClick={saveDeadline} className="text-[7px] text-green-400 border border-green-500/30 px-1 hover:bg-green-900/20" style={pf}>OK</button>
                    <button onClick={() => setEditingDeadline(false)} className="text-[7px] text-digi-muted border border-digi-border px-1" style={pf}>X</button>
                  </div>
                ) : (
                  <span
                    className={`text-digi-text text-right ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent-glow' : ''}`}
                    onClick={() => { if (isOwner && !isTerminal) { setEditDeadline(project.deadline?.split('T')[0] || ''); setEditingDeadline(true); } }}
                  >
                    {project.deadline ? new Date(project.deadline).toLocaleDateString() : '-'}
                  </span>
                )}
              </div>
              <DetailRow label="Creado" value={new Date(project.created_at).toLocaleDateString()} />
              <div className="flex justify-between py-1 border-b border-digi-border/30 col-span-2">
                <span className="text-digi-muted">Visibilidad</span>
                <div className="flex items-center gap-2">
                  <span className="text-digi-text">{project.is_private ? 'Privado' : 'Publico'}</span>
                  {isOwner && !isTerminal && hasReqs && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/projects/${id}`, {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ is_private: !project.is_private }),
                        });
                        toast.success(project.is_private ? 'Proyecto ahora es publico' : 'Proyecto ahora es privado');
                        fetchProject();
                      }}
                      className="text-[7px] text-accent-glow border border-accent/30 px-1.5 py-0.5 hover:bg-accent/10 transition-colors"
                      style={pf}
                    >
                      {project.is_private ? 'Hacer Publico' : 'Hacer Privado'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          {(isOwner || isMember) && (
            <div className="pixel-card">
              <h3 className="text-[10px] text-accent-glow mb-3" style={pf}>Acciones</h3>
              <div className="flex flex-wrap gap-2">
                {project.status === 'draft' && <button onClick={() => updateStatus('open')} className="pixel-btn pixel-btn-primary text-[9px]">Publicar</button>}
                {project.status === 'open' && <button onClick={() => updateStatus('in_progress')} className="pixel-btn pixel-btn-primary text-[9px]">Iniciar</button>}
                {project.status === 'in_progress' && <button onClick={() => updateStatus('review')} className="pixel-btn pixel-btn-primary text-[9px]">Enviar a Revision</button>}
                {project.status === 'review' && isAdmin && <button onClick={() => updateStatus('completed')} className="pixel-btn pixel-btn-primary text-[9px]">Completar</button>}
                {!['completed', 'closed', 'cancelled'].includes(project.status) && (
                  <button onClick={() => updateStatus('cancelled')} className="py-1.5 px-3 text-[9px] text-red-400 border border-red-500/30 hover:bg-red-900/20 transition-colors" style={pf}>Cancelar</button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ====== RIGHT ====== */}
        <div className="space-y-4">
          {isAdmin && (
            <div className="pixel-card" style={{ borderColor: project.digimundo_project_id ? 'var(--color-accent)' : undefined }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] text-accent-glow" style={pf}>DigiMundo</h3>
                {project.digimundo_project_id && chat.citizen && (
                  <div className="flex items-center gap-1.5">
                    <TaskQueueIndicator count={chat.pendingQueue.length} items={chat.pendingQueue.map(q => ({ id: q.id, title: q.title }))} isProcessing={chat.isProcessing} />
                    {!chat.chatOpen && (
                      <button onClick={() => { chat.setChatOpen(true); chat.setChatMinimized(false); }} className="px-2 py-1 text-[8px] text-accent-glow border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>Chat</button>
                    )}
                  </div>
                )}
              </div>
              <select value={project.digimundo_project_id || ''} onChange={(e) => linkDigimundo(e.target.value)} disabled={linking}
                className="w-full px-2 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer disabled:opacity-50 mb-2"
                style={{ ...mf, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}>
                <option value="">Sin vincular</option>
                {digiProjects.map((dp: any) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
              </select>
              {linkedDigiName && <p className="text-[9px] text-green-400" style={pf}>Vinculado a: {linkedDigiName}</p>}
            </div>
          )}

          {/* Incidents */}
          {project.digimundo_project_id && (
            <div className="pixel-card">
              {selectedIncidentId ? (
                <IncidentDetailPanel
                  incidentId={selectedIncidentId}
                  onClose={() => setSelectedIncidentId(null)}
                  onApprove={handleApproveIncident}
                  onReject={() => { setSelectedIncidentId(null); fetchProject(); toast.info('Rechazada'); }}
                  onStatusChange={fetchProject}
                  isLocalhost={chat.isLocalhost}
                />
              ) : (
                <>
                  <h3 className="text-[10px] text-accent-glow mb-2" style={pf}>Incidencias ({incidents.length})</h3>
                  <div className="flex gap-1 flex-wrap mb-3">
                    {['all', 'pending', 'proposal', 'approved', 'reviewing', 'completed', 'rejected'].map(s => (
                      <button key={s} onClick={() => setIncidentFilter(s)}
                        className={`px-1.5 py-0.5 text-[7px] border transition-colors ${incidentFilter === s ? 'border-accent text-accent-glow bg-accent/10' : 'border-digi-border/50 text-digi-muted hover:text-digi-text'}`} style={pf}>
                        {s === 'all' ? 'Todos' : s}
                      </button>
                    ))}
                  </div>
                  {incidents.length === 0 ? (
                    <p className="text-[10px] text-digi-muted" style={mf}>Sin incidencias</p>
                  ) : (
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {incidents.filter((inc: any) => incidentFilter === 'all' || inc.status === incidentFilter).map((inc: any) => (
                        <div key={inc.id} className="px-2.5 py-2 border border-digi-border/50 hover:border-accent/30 cursor-pointer transition-colors" onClick={() => setSelectedIncidentId(inc.id)}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-[10px] text-digi-text leading-snug" style={mf}>{inc.title}</p>
                            <PixelBadge variant={SEV_V[inc.severity] || 'default'}>{inc.severity}</PixelBadge>
                          </div>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[8px] text-digi-muted" style={mf}>{inc.clientName} &middot; {new Date(inc.createdAt).toLocaleDateString()}</span>
                            <PixelBadge variant={INC_STATUS_V[inc.status] || 'default'}>{inc.status}</PixelBadge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Requirement Modal */}
      <PixelModal open={showReqModal} onClose={() => setShowReqModal(false)} title="Nuevo Requerimiento">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Titulo</label>
            <input value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} placeholder="Titulo del requerimiento"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripcion</label>
            <textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={3} placeholder="Descripcion detallada..."
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Costo ($)</label>
            <input value={reqCost} onChange={(e) => setReqCost(e.target.value)} type="number" placeholder="0.00 (opcional)"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <button onClick={addRequirement} disabled={savingReq || !reqTitle.trim()} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {savingReq ? '...' : 'Agregar'}
          </button>
        </div>
      </PixelModal>

      {/* Assign Member Modal */}
      <PixelModal open={showAssignModal} onClose={() => setShowAssignModal(false)} title="Asignar Miembro" size="sm">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Miembro</label>
            <select
              value={assignMemberId}
              onChange={(e) => setAssignMemberId(e.target.value)}
              className="w-full px-2 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
              style={{ ...mf, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
            >
              <option value="">Seleccionar miembro...</option>
              {acceptedMembers.filter((m: any) => m.isAccepted).length > 0 && (
                <optgroup label="En el proyecto">
                  {acceptedMembers.filter((m: any) => m.isAccepted).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
              {acceptedMembers.filter((m: any) => !m.isAccepted).length > 0 && (
                <optgroup label="Otros miembros">
                  {acceptedMembers.filter((m: any) => !m.isAccepted).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Costo Propuesto ($)</label>
            <input
              value={assignCost}
              onChange={(e) => setAssignCost(e.target.value)}
              type="number"
              placeholder="0.00"
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>
          <button onClick={submitAssignment} disabled={savingAssign || !assignMemberId || !assignCost} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {savingAssign ? '...' : 'Asignar'}
          </button>
        </div>
      </PixelModal>

      {/* Floating Chat */}
      {chat.chatOpen && chat.citizen && (
        <FloatingChatWindow
          citizen={chat.citizen} blocks={chat.blocks} onBlocksChange={chat.onBlocksChange}
          externalMessage={chat.externalMessage} onExternalMessageConsumed={chat.onExternalMessageConsumed}
          onClose={() => chat.setChatOpen(false)} minimized={chat.chatMinimized}
          onMinimize={() => chat.setChatMinimized(true)} onRestore={() => chat.setChatMinimized(false)}
          queueCount={chat.pendingQueue.length} isLocalhost={chat.isLocalhost}
          projectName={linkedDigiName} isStreaming={chat.isStreaming} justCompleted={chat.justCompleted}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-digi-border/30 last:border-0">
      <span className="text-digi-muted">{label}</span>
      <span className="text-digi-text text-right">{value}</span>
    </div>
  );
}
