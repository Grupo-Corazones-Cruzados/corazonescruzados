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

  // Invite states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [selectedInvites, setSelectedInvites] = useState<Set<number>>(new Set());
  const [inviting, setInviting] = useState(false);

  // Bid/Postulation states
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidProposal, setBidProposal] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [bidDays, setBidDays] = useState('');
  const [bidReqIds, setBidReqIds] = useState<number[]>([]);
  const [bidReqCosts, setBidReqCosts] = useState<Record<number, string>>({});
  const [submittingBid, setSubmittingBid] = useState(false);

  // Complete + Invoice states
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeIdType, setCompleteIdType] = useState('07');
  const [completeClientName, setCompleteClientName] = useState('');
  const [completeClientRuc, setCompleteClientRuc] = useState('');
  const [completeClientEmail, setCompleteClientEmail] = useState('');
  const [completeClientPhone, setCompleteClientPhone] = useState('');
  const [completeClientAddress, setCompleteClientAddress] = useState('');
  const [completePaymentCode, setCompletePaymentCode] = useState('20');
  const [completeItems, setCompleteItems] = useState<{ description: string; quantity: string; unitPrice: string; ivaRate: string; discount: string }[]>([]);
  const [completeAdditionalFields, setCompleteAdditionalFields] = useState<{ name: string; value: string }[]>([]);
  const [completeSendEmail, setCompleteSendEmail] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completeStep, setCompleteStep] = useState('');

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

  // --- Invite members ---
  const openInviteModal = async () => {
    try {
      const res = await fetch('/api/members/list');
      const data = await res.json();
      setAllMembers(data.data || []);
    } catch { /* */ }
    setSelectedInvites(new Set());
    setShowInviteModal(true);
  };

  const sendInvites = async () => {
    if (selectedInvites.size === 0) return;
    setInviting(true);
    try {
      await fetch(`/api/projects/${id}/invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_ids: Array.from(selectedInvites) }),
      });
      toast.success(`${selectedInvites.size} miembros invitados`);
      setShowInviteModal(false);
      fetchProject();
    } catch { toast.error('Error al invitar'); }
    finally { setInviting(false); }
  };

  // --- Submit bid/postulation ---
  const submitBid = async () => {
    if (!bidProposal.trim()) { toast.error('Escribe una propuesta'); return; }
    if (bidReqIds.length === 0) { toast.error('Selecciona al menos un requerimiento'); return; }

    // Calculate total from per-requirement costs
    const totalBid = bidReqIds.reduce((sum, rid) => sum + (Number(bidReqCosts[rid]) || 0), 0);

    setSubmittingBid(true);
    try {
      // Build requirement_costs map {reqId: cost}
      const reqCostsMap: Record<string, number> = {};
      bidReqIds.forEach(rid => { reqCostsMap[String(rid)] = Number(bidReqCosts[rid]) || 0; });

      if (myBid?.status === 'invited') {
        // Update existing invited bid with proposal
        await fetch(`/api/projects/${id}/bids`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bid_id: myBid.id,
            proposal: bidProposal.trim(),
            bid_amount: totalBid || null,
            requirement_ids: bidReqIds,
            requirement_costs: reqCostsMap,
            work_dates: [],
          }),
        });
      } else {
        // Create new bid
        await fetch(`/api/projects/${id}/bids`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: memberId,
            proposal: bidProposal.trim(),
            bid_amount: totalBid || null,
            estimated_days: bidDays ? Number(bidDays) : null,
            requirement_ids: bidReqIds,
            requirement_costs: reqCostsMap,
            status: 'pending',
          }),
        });
      }
      toast.success('Propuesta enviada');
      setShowBidModal(false);
      setBidProposal(''); setBidAmount(''); setBidDays(''); setBidReqIds([]); setBidReqCosts({});
      fetchProject();
    } catch { toast.error('Error al enviar propuesta'); }
    finally { setSubmittingBid(false); }
  };

  // --- Complete project with invoice ---
  const openCompleteModal = () => {
    const ruc = project?.client_ruc || '';
    setCompleteClientName(project?.client_name || '');
    setCompleteClientRuc(ruc);
    setCompleteClientEmail(project?.client_email || '');
    setCompleteClientPhone(project?.client_phone || '');
    setCompleteClientAddress(project?.client_address || '');
    if (ruc.length === 13 && ruc.endsWith('001')) setCompleteIdType('04');
    else if (ruc.length === 10) setCompleteIdType('05');
    else if (ruc.length > 0) setCompleteIdType('06');
    else setCompleteIdType('07');
    setCompletePaymentCode('20');
    // Pre-load items from requirements
    const reqItems = reqs.map((r: any) => {
      const acceptedCost = (r.assignments || [])
        .filter((a: any) => a.status === 'accepted')
        .reduce((s: number, a: any) => s + Number(a.member_cost ?? a.proposed_cost ?? 0), 0);
      return {
        description: r.title + (r.description ? ` - ${r.description}` : ''),
        quantity: '1',
        unitPrice: String(acceptedCost || Number(r.cost) || 0),
        ivaRate: '0',
        discount: '0',
      };
    });
    setCompleteItems(reqItems.length > 0 ? reqItems : [{ description: `Servicios: ${project.title}`, quantity: '1', unitPrice: String(Number(project.final_cost) || 0), ivaRate: '0', discount: '0' }]);
    setCompleteAdditionalFields([]);
    setCompleteSendEmail(true);
    setShowCompleteModal(true);
  };

  const handleComplete = async () => {
    setCompleting(true);
    setCompleteStep('Completando proyecto...');
    try {
      setCompleteStep('Guardando datos del cliente...');
      await new Promise(r => setTimeout(r, 300));

      setCompleteStep('Generando factura electronica...');
      const res = await fetch(`/api/projects/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_completion',
          send_email: completeSendEmail,
          client_id_type: completeIdType,
          client_name: completeClientName,
          client_ruc: completeClientRuc,
          client_email: completeClientEmail,
          client_phone: completeClientPhone,
          client_address: completeClientAddress,
          payment_code: completePaymentCode,
          invoice_items: completeItems.map(it => ({
            description: it.description,
            quantity: Number(it.quantity) || 1,
            unitPrice: Number(it.unitPrice) || 0,
            ivaRate: Number(it.ivaRate) || 0,
            discount: Number(it.discount) || 0,
          })),
          additional_fields: completeAdditionalFields.filter(f => f.name.trim() && f.value.trim()),
        }),
      });
      const data = await res.json();

      const sriOk = data.sriResult?.authorized;
      const sriError = data.sriResult?.error;

      if (data.invoiceId && sriOk) {
        setCompleteStep('Factura autorizada por el SRI');
      } else if (data.invoiceId && sriError) {
        setCompleteStep(`Factura generada — SRI: ${sriError}`);
      }

      await new Promise(r => setTimeout(r, 500));
      setCompleteStep('Proceso completado');
      await new Promise(r => setTimeout(r, 800));

      toast.success(
        'Proyecto completado' +
        (data.invoiceId ? ' — Factura generada' : '') +
        (sriOk ? ' y autorizada por el SRI' : '') +
        (completeSendEmail && completeClientEmail && sriOk ? ' — Enviada por correo' : '')
      );
      if (sriError && !sriOk) {
        toast.error(`SRI: ${sriError}`);
      }
      setShowCompleteModal(false);
      fetchProject();
    } catch { toast.error('Error al completar'); }
    finally { setCompleting(false); setCompleteStep(''); }
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
    // Pre-fill cost from requirement's reference cost
    const req = reqs.find((r: any) => r.id === reqId);
    setAssignCost(req?.cost ? String(req.cost) : '');
    setShowAssignModal(true);
  };

  // When member is selected in assign modal, try to use their bid cost for this requirement
  const handleAssignMemberChange = (mId: string) => {
    setAssignMemberId(mId);
    if (!mId || !assignReqId) return;
    const bid = bids.find((b: any) => String(b.member_id) === mId && b.status === 'accepted');
    if (bid?.requirement_ids?.includes(assignReqId) || bid?.requirement_ids?.includes(Number(assignReqId))) {
      // Member proposed for this requirement — use their bid amount proportionally or the req reference cost
      const req = reqs.find((r: any) => r.id === assignReqId);
      if (req?.cost) setAssignCost(String(req.cost));
    }
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
  const canEditReqs = isOwner; // owner can always edit all
  // Check if current member is assigned (accepted) to a specific requirement
  const canMemberEditReq = (reqId: number) => {
    if (isOwner) return true;
    if (!isMember || !memberId) return false;
    const req = reqs.find((r: any) => r.id === reqId);
    if (!req) return false;
    return (req.assignments || []).some((a: any) => String(a.member_id) === String(memberId) && a.status === 'accepted');
  };
  // Total cost = sum of accepted assignment costs (member_cost if negotiated, else proposed_cost)
  const totalAcceptedCost = reqs.reduce((sum: number, r: any) => {
    const accepted = (r.assignments || []).filter((a: any) => a.status === 'accepted');
    return sum + accepted.reduce((s: number, a: any) => s + Number(a.member_cost ?? a.proposed_cost ?? 0), 0);
  }, 0);
  const isTerminal = ['completed', 'closed', 'cancelled'].includes(project.status);
  const hasReqs = reqs.length > 0;
  const myBid = bids.find((b: any) => String(b.member_id) === String(memberId));
  const canBidNew = isMember && !isOwner && !myBid && (project.status === 'open' || (project.status === 'draft' && !project.is_private));
  const canBidInvited = isMember && !isOwner && myBid?.status === 'invited';
  const canBid = canBidNew || canBidInvited;
  const canInvite = isOwner && !isTerminal;

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
                  const canEditThis = canMemberEditReq(r.id);
                  const assignedMemberName = assignments.find((a: any) => a.status === 'accepted')?.member_name;
                  return (
                    <div key={r.id} className="px-2.5 py-2 border border-digi-border/50">
                      <div className="flex items-start gap-2">
                        <button
                          onClick={() => canEditThis && toggleReqComplete(r.id, !r.is_completed)}
                          className={`text-[10px] mt-0.5 ${r.is_completed ? 'text-green-400' : 'text-digi-muted'} ${canEditThis ? 'cursor-pointer hover:text-accent-glow' : ''}`}
                          style={pf}
                          disabled={!canEditThis}
                        >
                          {r.is_completed ? '[x]' : '[ ]'}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs ${r.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</p>
                          {r.description && <p className="text-[10px] text-digi-muted mt-0.5" style={mf}>{r.description}</p>}
                          {(() => {
                            const acceptedAssignments = assignments.filter((a: any) => a.status === 'accepted');
                            if (acceptedAssignments.length === 0) return null;
                            return (
                              <div className="flex items-center gap-1 mt-1">
                                {acceptedAssignments.map((a: any) => (
                                  <div key={a.id} className="relative group/avatar">
                                    {a.photo_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={a.photo_url} alt="" className="w-5 h-5 rounded-full border border-accent/50 object-cover" />
                                    ) : (
                                      <div className="w-5 h-5 rounded-full border border-accent/50 bg-accent/20 flex items-center justify-center text-[7px] text-accent-glow" style={pf}>
                                        {(a.member_name || '?')[0].toUpperCase()}
                                      </div>
                                    )}
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-digi-card border border-digi-border text-[8px] text-white whitespace-nowrap opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none z-10" style={mf}>
                                      {a.member_name}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {r.cost && <span className="text-[9px] text-accent-glow" style={mf}>${r.cost}</span>}
                          {isOwner && (
                            <button onClick={() => deleteRequirement(r.id)} className="text-[8px] text-red-400/50 hover:text-red-400 transition-colors" style={pf}>x</button>
                          )}
                        </div>
                      </div>

                      {/* Assignments + assign button */}
                      <div className="mt-1.5 ml-5 space-y-1">
                        {assignments.map((a: any) => (
                          <div key={a.id} className="flex items-center gap-1.5 flex-wrap px-1.5 py-1 border border-accent/20 bg-accent/5">
                            <div className="relative group/asgn">
                              {a.photo_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={a.photo_url} alt="" className="w-5 h-5 rounded-full border border-accent/50 object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full border border-accent/50 bg-accent/20 flex items-center justify-center text-[7px] text-accent-glow" style={pf}>
                                  {(a.member_name || '?')[0].toUpperCase()}
                                </div>
                              )}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-digi-card border border-digi-border text-[8px] text-white whitespace-nowrap opacity-0 group-hover/asgn:opacity-100 transition-opacity pointer-events-none z-10" style={mf}>
                                {a.member_name}
                              </div>
                            </div>
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

                        {/* Assign button (owner only) */}
                        {isOwner && (isAdmin || project.confirmed_at || isMemberCreator) && (
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
                                onClick={() => canEditThis && toggleSubItem(item.id, !item.is_completed)}
                                className={`text-[8px] ${item.is_completed ? 'text-green-400' : 'text-digi-muted'}`}
                                style={pf}
                                disabled={!canEditThis}
                              >
                                {item.is_completed ? '[x]' : '[ ]'}
                              </button>
                              <span className={`text-[9px] flex-1 ${item.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{item.title}</span>
                              {canEditThis && (
                                <button onClick={() => deleteSubItem(item.id)} className="text-[7px] text-red-400/0 group-hover:text-red-400/60 hover:!text-red-400 transition-colors" style={pf}>x</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add sub-item input */}
                      {canEditThis && (
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
          <div className="pixel-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] text-accent-glow" style={pf}>Participantes</h3>
              <div className="flex gap-1">
                {canInvite && (
                  <button onClick={openInviteModal} className="text-[8px] text-accent-glow border border-accent/50 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>
                    + Invitar
                  </button>
                )}
                {canBid && (
                  <button onClick={() => setShowBidModal(true)} className="text-[8px] text-green-400 border border-green-500/30 px-2 py-0.5 hover:bg-green-900/20 transition-colors" style={pf}>
                    Postularse
                  </button>
                )}
              </div>
            </div>
            {bids.length > 0 ? (
              <div className="space-y-2">
                {bids.map((b: any) => (
                  <div key={b.id} className="px-2 py-1.5 border border-digi-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {b.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.photo_url} alt="" className="w-6 h-6 rounded-full border border-accent/50 object-cover shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-accent/50 bg-accent/20 flex items-center justify-center text-[8px] text-accent-glow shrink-0" style={pf}>
                            {(b.member_name || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-digi-text" style={mf}>{b.member_name}</span>
                        {b.bid_amount != null && <span className="text-[9px] text-accent-glow ml-2" style={mf}>${Number(b.bid_amount).toFixed(2)}</span>}
                        {b.estimated_days && <span className="text-[9px] text-digi-muted ml-1" style={mf}>({b.estimated_days}d)</span>}
                      </div>
                    <div className="flex items-center gap-1.5 ml-2">
                      <PixelBadge variant={BID_V[b.status] || 'default'}>{b.status}</PixelBadge>
                      {isOwner && b.status === 'pending' && (
                        <>
                          <button onClick={async () => { await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: b.id, status: 'accepted' }) }); fetchProject(); toast.success('Aceptado'); }} className="text-[7px] text-green-400 border border-green-500/30 px-1 hover:bg-green-900/20" style={pf}>OK</button>
                          <button onClick={async () => { await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: b.id, status: 'rejected' }) }); fetchProject(); }} className="text-[7px] text-red-400 border border-red-500/30 px-1 hover:bg-red-900/20" style={pf}>NO</button>
                        </>
                      )}
                      {b.status === 'invited' && String(b.member_id) === String(memberId) && (
                        <button onClick={() => setShowBidModal(true)} className="text-[7px] text-accent-glow border border-accent/30 px-1.5 hover:bg-accent/10 transition-colors" style={pf}>
                          Enviar Propuesta
                        </button>
                      )}
                      {isOwner && b.status === 'invited' && String(b.member_id) !== String(memberId) && (
                        <span className="text-[7px] text-yellow-400" style={pf}>Esperando</span>
                      )}
                    </div>
                    </div>
                    {/* Proposal details */}
                    {b.proposal && (
                      <div className="mt-1.5 pt-1.5 border-t border-digi-border/30">
                        <p className="text-[9px] text-digi-muted" style={mf}>{b.proposal}</p>
                        {b.requirement_ids?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[8px] text-digi-muted" style={pf}>Reqs:</span>
                            {b.requirement_ids.map((rid: number) => {
                              const req = reqs.find((r: any) => r.id === rid || r.id === Number(rid));
                              return req ? (
                                <span key={rid} className="text-[8px] text-accent-glow border border-accent/20 px-1" style={mf}>{req.title}</span>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[9px] text-digi-muted text-center py-2" style={mf}>Sin participantes aun</p>
            )}
          </div>

          {/* Invite Modal */}
          <PixelModal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invitar Miembros" size="md">
            <div className="space-y-3">
              <p className="text-[9px] text-digi-muted" style={mf}>Selecciona los miembros que deseas invitar a enviar una propuesta:</p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {allMembers.filter(m => !bids.some((b: any) => String(b.member_id) === String(m.id))).map((m: any) => (
                  <label key={m.id} className="flex items-center gap-2 px-3 py-2 border border-digi-border/50 cursor-pointer hover:bg-accent/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedInvites.has(m.id)}
                      onChange={() => {
                        const next = new Set(selectedInvites);
                        if (next.has(m.id)) next.delete(m.id); else next.add(m.id);
                        setSelectedInvites(next);
                      }}
                      className="accent-[#4B2D8E]"
                    />
                    <div className="flex-1">
                      <span className="text-xs text-digi-text" style={mf}>{m.name}</span>
                      {m.email && <span className="text-[9px] text-digi-muted ml-2" style={mf}>{m.email}</span>}
                    </div>
                    {m.position_name && <PixelBadge variant="default">{m.position_name}</PixelBadge>}
                  </label>
                ))}
                {allMembers.filter(m => !bids.some((b: any) => String(b.member_id) === String(m.id))).length === 0 && (
                  <p className="text-center text-[9px] text-digi-muted py-4" style={mf}>Todos los miembros ya fueron invitados</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
                <button onClick={() => setShowInviteModal(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
                <button onClick={sendInvites} disabled={inviting || selectedInvites.size === 0} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                  {inviting ? 'Invitando...' : `Invitar (${selectedInvites.size})`}
                </button>
              </div>
            </div>
          </PixelModal>

          {/* Bid/Postulation Modal */}
          <PixelModal open={showBidModal} onClose={() => setShowBidModal(false)} title="Enviar Propuesta" size="md">
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Propuesta <span className="text-red-400">*</span></label>
                <textarea value={bidProposal} onChange={e => setBidProposal(e.target.value)} rows={3}
                  placeholder="Describe tu propuesta, experiencia relevante y como abordarias el proyecto..."
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
              </div>

              <div>
                <label className="block text-[9px] text-digi-muted mb-1" style={pf}>Dias estimados</label>
                <input value={bidDays} onChange={e => setBidDays(e.target.value)} type="number" placeholder="Opcional"
                  className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>

              {reqs.length > 0 && (
                <div>
                  <label className="block text-[9px] text-digi-muted mb-1" style={pf}>
                    Requerimientos que puedes atender <span className="text-red-400">*</span>
                  </label>
                  <p className="text-[8px] text-digi-muted mb-2" style={mf}>Selecciona y especifica tu costo para cada uno</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {reqs.map((r: any) => {
                      const selected = bidReqIds.includes(r.id);
                      return (
                        <div key={r.id} className={`border px-3 py-2 transition-colors ${selected ? 'border-accent bg-accent/5' : 'border-digi-border/50'}`}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                if (selected) {
                                  setBidReqIds(prev => prev.filter(rid => rid !== r.id));
                                  setBidReqCosts(prev => { const next = { ...prev }; delete next[r.id]; return next; });
                                } else {
                                  setBidReqIds(prev => [...prev, r.id]);
                                }
                              }}
                              className="accent-[#4B2D8E]"
                            />
                            <span className="text-xs text-digi-text flex-1" style={mf}>{r.title}</span>
                            {r.cost && <span className="text-[9px] text-digi-muted" style={mf}>Ref: ${r.cost}</span>}
                          </label>
                          {selected && (
                            <div className="mt-1.5 ml-6 flex items-center gap-2">
                              <span className="text-[8px] text-digi-muted" style={pf}>Tu costo ($):</span>
                              <input
                                value={bidReqCosts[r.id] || ''}
                                onChange={e => setBidReqCosts(prev => ({ ...prev, [r.id]: e.target.value }))}
                                type="number"
                                placeholder="0"
                                className="w-24 px-2 py-1 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf}
                              />
                              {r.cost && (
                                <button
                                  onClick={() => setBidReqCosts(prev => ({ ...prev, [r.id]: String(r.cost) }))}
                                  className="text-[7px] text-accent-glow border border-accent/30 px-1.5 py-0.5 hover:bg-accent/10 transition-colors"
                                  style={pf}
                                  title="Usar el costo propuesto por el creador"
                                >
                                  Usar ${r.cost}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {bidReqIds.length > 0 && (
                    <div className="mt-2 flex justify-end">
                      <span className="text-[9px] text-accent-glow" style={pf}>
                        Total: ${bidReqIds.reduce((sum, rid) => sum + (Number(bidReqCosts[rid]) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t-2 border-digi-border">
                <button onClick={() => setShowBidModal(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
                <button onClick={submitBid} disabled={submittingBid || !bidProposal.trim() || bidReqIds.length === 0} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                  {submittingBid ? 'Enviando...' : 'Enviar Propuesta'}
                </button>
              </div>
            </div>
          </PixelModal>

          {/* Complete + Invoice Modal */}
          <PixelModal open={showCompleteModal} onClose={() => !completing && setShowCompleteModal(false)} title="Completar Proyecto y Generar Factura" size="lg">
            {completing ? (
              <div className="py-8 space-y-6">
                {/* Progress bar */}
                <div className="space-y-3">
                  <div className="w-full h-1.5 bg-digi-border overflow-hidden">
                    <div className="h-full bg-accent animate-[progressPulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
                  </div>
                  <p className="text-center text-xs text-accent-glow" style={mf}>{completeStep}</p>
                </div>

                {/* Steps visual */}
                <div className="flex items-center justify-center gap-3">
                  {[
                    { label: 'Cliente', done: completeStep !== 'Guardando datos del cliente...' && completeStep !== 'Completando proyecto...' },
                    { label: 'Factura', done: completeStep.includes('autorizada') || completeStep.includes('Proceso completado') },
                    { label: 'SRI', done: completeStep.includes('autorizada') || completeStep.includes('Proceso completado') },
                    { label: 'Email', done: completeStep === 'Proceso completado' },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className={`w-6 h-6 flex items-center justify-center text-[8px] border-2 transition-all ${
                        s.done ? 'border-green-500 bg-green-900/20 text-green-400' : 'border-digi-border text-digi-muted animate-pulse'
                      }`} style={pf}>
                        {s.done ? '✓' : i + 1}
                      </div>
                      <span className={`text-[8px] ${s.done ? 'text-green-400' : 'text-digi-muted'}`} style={pf}>{s.label}</span>
                      {i < 3 && <div className={`w-4 h-0.5 ${s.done ? 'bg-green-500' : 'bg-digi-border'}`} />}
                    </div>
                  ))}
                </div>

                <p className="text-center text-[8px] text-digi-muted" style={mf}>No cierres esta ventana hasta que el proceso termine</p>
              </div>
            ) : (
            <div className="max-h-[80vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ─── LEFT: Adquirente + Pago ─── */}
                <div className="space-y-2">
                  <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1" style={pf}>Adquirente</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Tipo ID <span className="text-red-400">*</span></label>
                      <select value={completeIdType} onChange={e => {
                        const t = e.target.value;
                        setCompleteIdType(t);
                        if (t === '07') { setCompleteClientRuc('9999999999999'); setCompleteClientName('CONSUMIDOR FINAL'); }
                        else { if (completeClientRuc === '9999999999999') setCompleteClientRuc(''); if (completeClientName === 'CONSUMIDOR FINAL') setCompleteClientName(''); }
                      }} className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                        <option value="04">RUC</option><option value="05">Cedula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Identificacion <span className="text-red-400">*</span></label>
                      <input value={completeClientRuc} onChange={e => setCompleteClientRuc(e.target.value)} disabled={completeIdType === '07'}
                        placeholder={completeIdType === '04' ? '0900000000001' : '0900000000'} maxLength={completeIdType === '04' ? 13 : completeIdType === '05' ? 10 : 20}
                        className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                      {completeIdType === '04' && completeClientRuc && completeClientRuc.length !== 13 && <p className="text-[7px] text-red-400" style={mf}>13 digitos</p>}
                      {completeIdType === '05' && completeClientRuc && completeClientRuc.length !== 10 && <p className="text-[7px] text-red-400" style={mf}>10 digitos</p>}
                    </div>
                  </div>
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Razon Social <span className="text-red-400">*</span></label>
                    <input value={completeClientName} onChange={e => setCompleteClientName(e.target.value)} disabled={completeIdType === '07'}
                      className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                  </div>
                  <div>
                    <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Direccion <span className="text-red-400">*</span></label>
                    <input value={completeClientAddress} onChange={e => setCompleteClientAddress(e.target.value)} placeholder="Direccion"
                      className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Email {completeIdType !== '07' && <span className="text-red-400">*</span>}</label>
                      <input value={completeClientEmail} onChange={e => setCompleteClientEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
                        className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    </div>
                    <div>
                      <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Telefono</label>
                      <input value={completeClientPhone} onChange={e => setCompleteClientPhone(e.target.value)} placeholder="0999999999"
                        className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    </div>
                  </div>

                  <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Forma de Pago</h4>
                  <select value={completePaymentCode} onChange={e => setCompletePaymentCode(e.target.value)}
                    className="w-full px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value="01">Sin utilizacion del sistema financiero</option>
                    <option value="15">Compensacion de deudas</option>
                    <option value="16">Tarjeta de debito</option>
                    <option value="17">Dinero electronico</option>
                    <option value="18">Tarjeta prepago</option>
                    <option value="19">Tarjeta de credito</option>
                    <option value="20">Otros con utilizacion del sistema financiero</option>
                    <option value="21">Endoso de titulos</option>
                  </select>

                  <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1 mt-3" style={pf}>Campos Adicionales</h4>
                  <div className="space-y-1">
                    {completeAdditionalFields.map((f, i) => (
                      <div key={i} className="flex gap-1">
                        <input value={f.name} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setCompleteAdditionalFields(n); }}
                          placeholder="Nombre" className="w-1/3 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <input value={f.value} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setCompleteAdditionalFields(n); }}
                          placeholder="Descripcion" className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <button onClick={() => setCompleteAdditionalFields(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-400/60 hover:text-red-400 text-[8px] px-1" style={pf}>X</button>
                      </div>
                    ))}
                    <button onClick={() => setCompleteAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                      className="text-[8px] text-digi-muted border border-digi-border px-2 py-0.5 hover:text-accent-glow hover:border-accent/30 transition-colors" style={pf}>+ Campo adicional</button>
                  </div>
                </div>

                {/* ─── RIGHT: Detalle + Totales ─── */}
                <div className="space-y-2">
                  <h4 className="text-[9px] text-accent-glow border-b border-digi-border pb-1" style={pf}>Detalle</h4>
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                    {completeItems.map((item, i) => (
                      <div key={i} className="border border-digi-border/50 p-1.5">
                        <div className="flex gap-1 mb-1">
                          <input value={item.description} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], description: e.target.value }; setCompleteItems(n); }}
                            placeholder="Descripcion" className="flex-1 px-2 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          <button onClick={() => setCompleteItems(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400/60 hover:text-red-400 text-[7px] px-1" style={pf}>X</button>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <div>
                            <label className="text-[7px] text-digi-muted" style={pf}>Cant.</label>
                            <input value={item.quantity} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], quantity: e.target.value }; setCompleteItems(n); }}
                              type="number" min="0.01" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          </div>
                          <div>
                            <label className="text-[7px] text-digi-muted" style={pf}>P.Unit.</label>
                            <input value={item.unitPrice} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setCompleteItems(n); }}
                              type="number" min="0" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          </div>
                          <div>
                            <label className="text-[7px] text-digi-muted" style={pf}>IVA</label>
                            <select value={item.ivaRate} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], ivaRate: e.target.value }; setCompleteItems(n); }}
                              className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                              <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[7px] text-digi-muted" style={pf}>Desc.</label>
                            <input value={item.discount} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], discount: e.target.value }; setCompleteItems(n); }}
                              type="number" min="0" step="0.01" className="w-full px-1 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setCompleteItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
                    className="text-[8px] text-accent-glow border border-accent/30 px-2 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>+ Item</button>

                  {/* Totales */}
                  {(() => {
                    const subtotal = completeItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0), 0);
                    const totalDiscount = completeItems.reduce((s, it) => s + (Number(it.discount) || 0), 0);
                    const ivaByRate: Record<string, number> = {};
                    completeItems.forEach(it => {
                      const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                      const rate = it.ivaRate || '0';
                      ivaByRate[rate] = (ivaByRate[rate] || 0) + base;
                    });
                    const totalIva = completeItems.reduce((s, it) => {
                      const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                      return s + base * ((Number(it.ivaRate) || 0) / 100);
                    }, 0);
                    return (
                      <div className="border-2 border-digi-border p-2 text-[9px] space-y-0.5" style={mf}>
                        {Object.entries(ivaByRate).map(([rate, base]) => (
                          <div key={rate} className="flex justify-between"><span className="text-digi-muted">Subtotal {rate}%:</span><span className="text-white">${base.toFixed(2)}</span></div>
                        ))}
                        {totalDiscount > 0 && <div className="flex justify-between"><span className="text-digi-muted">Total descuento:</span><span className="text-white">${totalDiscount.toFixed(2)}</span></div>}
                        {totalIva > 0 && <div className="flex justify-between"><span className="text-digi-muted">IVA:</span><span className="text-white">${totalIva.toFixed(2)}</span></div>}
                        <div className="flex justify-between border-t border-digi-border pt-1"><span className="text-accent-glow font-bold">Total:</span><span className="text-accent-glow font-bold">${(subtotal + totalIva).toFixed(2)}</span></div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ─── Footer ─── */}
              {(() => {
                const invoiceTotal = completeItems.reduce((s, it) => {
                  const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                  return s + base + base * ((Number(it.ivaRate) || 0) / 100);
                }, 0);
                const consumidorFinalOver50 = completeIdType === '07' && invoiceTotal > 50;
                const isFormValid = !completing && completeClientName.trim() && completeClientRuc.trim() && completeClientAddress.trim() && (completeIdType === '07' || completeClientEmail.trim()) && completeItems.length > 0 && !(completeIdType === '04' && completeClientRuc.length !== 13) && !(completeIdType === '05' && completeClientRuc.length !== 10) && !consumidorFinalOver50;
                return (
                  <div className="pt-3 mt-3 border-t-2 border-digi-border space-y-2">
                    {consumidorFinalOver50 && (
                      <div className="px-3 py-2 border border-red-700/50 bg-red-900/10 text-[9px] text-red-400" style={mf}>
                        El SRI requiere identificar al cliente (RUC o Cedula) en facturas mayores a $50.00. El total actual es ${invoiceTotal.toFixed(2)}. Cambia el tipo de identificacion.
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={completeSendEmail} onChange={e => setCompleteSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                        <span className="text-[9px] text-digi-muted" style={mf}>Enviar por correo</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>Cancelar</button>
                        <button onClick={handleComplete} disabled={!isFormValid} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
                          Completar y Facturar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            )}
          </PixelModal>

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
                {project.status === 'review' && isAdmin && <button onClick={openCompleteModal} className="pixel-btn pixel-btn-primary text-[9px]">Completar</button>}
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
              onChange={(e) => handleAssignMemberChange(e.target.value)}
              className="w-full px-2 py-2 bg-digi-darker border-2 border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
              style={{ ...mf, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
            >
              <option value="">Seleccionar miembro...</option>
              {bids.filter((b: any) => b.status === 'accepted').map((b: any) => (
                <option key={b.member_id} value={b.member_id}>{b.member_name}</option>
              ))}
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
