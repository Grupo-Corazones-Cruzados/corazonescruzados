'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import DetailHeader, { HeaderChip } from '@/components/ui/DetailHeader';
import PropertyRail from '@/components/ui/PropertyRail';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import AssigneePicker from '@/components/tickets/AssigneePicker';
import { Check, DoorOpen, Play, Send, Receipt, LayoutList, ListChecks, Boxes, Image as ImageIcon, Plus, X, UserPlus, ListPlus, Crown, Users, Trash2 } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import IncidentDetailPanel from '@/components/projects/IncidentDetailPanel';
import FloatingChatWindow from '@/components/projects/FloatingChatWindow';
import TaskQueueIndicator from '@/components/projects/TaskQueueIndicator';
import ProformaChatPanel from '@/components/projects/ProformaChatPanel';
import ProformaTokenButton from '@/components/projects/ProformaTokenButton';
import VideoScriptPanel from '@/components/projects/VideoScriptPanel';
import PublicDocsPanel from '@/components/projects/PublicDocsPanel';
import SocialCopyPanel from '@/components/projects/SocialCopyPanel';
import ScriptStoryboardEditor from '@/components/projects/ScriptStoryboardEditor';
import type { StoryboardSegment } from '@/components/projects/ScriptStoryboardEditor';
import useAgentChat from '@/hooks/useAgentChat';
import { fmt2 } from '@/lib/format';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', open: 'info', in_progress: 'warning', review: 'warning',
  completed: 'success', closed: 'success', cancelled: 'error', on_hold: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador', open: 'Abierto', in_progress: 'En progreso', review: 'En revisión',
  completed: 'Completado', closed: 'Cerrado', cancelled: 'Cancelado', on_hold: 'En pausa',
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
  const [ptab, setPtab] = useState<'resumen' | 'requerimientos' | 'digimundo' | 'imagenes'>('resumen');
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [digiProjects, setDigiProjects] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState('all');

  // Project images states
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageIdx, setDeletingImageIdx] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Content (video script + video) states
  const [showScriptPanel, setShowScriptPanel] = useState(false);
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoStep, setVideoStep] = useState('');
  const [scriptAgentConfig, setScriptAgentConfig] = useState<{ agentId: string; agentName: string; projectPath: string } | null>(null);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [storyboard, setStoryboard] = useState<StoryboardSegment[] | null>(null);
  const [showPublicDocs, setShowPublicDocs] = useState(false);
  const [publicDocsToken, setPublicDocsToken] = useState<string | null>(null);
  const [showSocialCopy, setShowSocialCopy] = useState(false);
  const [hasSocialCopy, setHasSocialCopy] = useState(false);

  // Withdrawal/exit request states
  const [projectRequests, setProjectRequests] = useState<any[]>([]);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [withdrawType, setWithdrawType] = useState<'withdrawal' | 'supervised_exit'>('withdrawal');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);

  // CRUD states
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqCost, setReqCost] = useState('');
  const [savingReq, setSavingReq] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<number, string>>({});
  const [subtaskReqId, setSubtaskReqId] = useState<number | null>(null);

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

  // Proforma states
  const [showProformaChat, setShowProformaChat] = useState(false);
  const [proformaAgentConfig, setProformaAgentConfig] = useState<{ agentId: string; agentName: string; projectPath: string } | null>(null);

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
  const [completeCurrency, setCompleteCurrency] = useState('USD');
  const [completeExchangeRate, setCompleteExchangeRate] = useState('1');
  const [currencies, setCurrencies] = useState<{ code: string; symbol: string; name: string; rate: number }[]>([]);
  const [clientHistory, setClientHistory] = useState<{
    id_type: string; client_ruc: string; client_name: string;
    client_email: string; client_phone: string; client_address: string;
    last_used: string;
  }[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isMember = user?.role === 'member';
  const memberId = user?.member_id;
  const isMemberCreator = isMember && memberId && project?.assigned_member_id == memberId;
  const isOwner = isAdmin || isMemberCreator;
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantId, setNewParticipantId] = useState('');
  // ¿Me invitaron a tomar el liderazgo (responsable) de este proyecto?
  const myResponsibleInvite = !!(memberId && project?.pending_responsible && String(project.pending_responsible.member_id) === String(memberId));

  const respondResponsible = async (action: 'accept' | 'decline') => {
    try {
      const res = await fetch(`/api/projects/${id}/responsible`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success(action === 'accept' ? 'Aceptaste el liderazgo del proyecto' : 'Rechazaste la invitación');
      fetchProject();
    } catch { toast.error('Error'); }
  };

  const addParticipant = async (mid: string) => {
    if (!mid) return;
    try {
      const res = await fetch(`/api/projects/${id}/participants`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ member_id: mid }),
      });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success('Participante agregado');
      setShowAddParticipant(false); setNewParticipantId('');
      fetchProject();
    } catch { toast.error('Error'); }
  };
  const removeParticipant = async (mid: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/participants?member_id=${mid}`, { method: 'DELETE' });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      fetchProject();
    } catch { toast.error('Error'); }
  };

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

  const fetchProjectRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/requests`);
      const data = await res.json();
      setProjectRequests(data.data || []);
    } catch { /* ignore */ }
  }, [id]);

  const fetchProjectImages = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/images`);
      if (!res.ok) return;
      const { data } = await res.json();
      setProjectImages(data.images || []);
    } catch { /* ignore */ }
  }, [id]);

  const fetchContent = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/content`);
      if (!res.ok) return;
      const { data } = await res.json();
      setVideoScript(data.video_script || null);
      setVideoUrl(data.video_url || null);
      setStoryboard(data.image_metadata?.storyboard || null);
    } catch { /* ignore */ }
  }, [id]);

  const fetchPublicDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/public-docs`);
      if (!res.ok) return;
      const { data } = await res.json();
      setPublicDocsToken(data?.public_docs_token || null);
    } catch { /* ignore */ }
  }, [id]);

  const fetchSocialCopy = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/social`);
      if (!res.ok) return;
      const { data } = await res.json();
      setHasSocialCopy(!!data?.social_copy);
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { fetchProject(); fetchProjectRequests(); fetchProjectImages(); fetchContent(); fetchPublicDocs(); fetchSocialCopy(); }, [fetchProject, fetchProjectRequests, fetchProjectImages, fetchContent, fetchPublicDocs, fetchSocialCopy]);
  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/digimundo/projects').then(r => r.json()).then(d => setDigiProjects(d.data || [])).catch(() => {});
    fetch('/api/exchange-rates').then(r => r.json()).then(d => setCurrencies(d.currencies || [])).catch(() => {});
  }, [isAdmin]);

  // Carga clientes ya facturados al abrir el modal de completar (para autocompletar adquirente)
  useEffect(() => {
    if (!showCompleteModal) return;
    fetch('/api/invoices/clients-history')
      .then(r => r.json())
      .then(d => setClientHistory(d.data || []))
      .catch(() => setClientHistory([]));
  }, [showCompleteModal]);

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
    setHistoryOpen(false);
    setHistorySearch('');
    setShowCompleteModal(true);
  };

  // Autocompleta el adquirente desde un cliente ya facturado
  const applyPastClient = (c: typeof clientHistory[0]) => {
    setCompleteIdType(c.id_type);
    setCompleteClientRuc(c.client_ruc);
    setCompleteClientName(c.client_name);
    setCompleteClientEmail(c.client_email);
    setCompleteClientPhone(c.client_phone);
    setCompleteClientAddress(c.client_address);
    setHistoryOpen(false);
    setHistorySearch('');
    toast.success(`Datos de ${c.client_name} cargados`);
  };

  const filteredHistory = historySearch.trim()
    ? clientHistory.filter(c => {
        const q = historySearch.trim().toLowerCase();
        return c.client_name.toLowerCase().includes(q) || c.client_ruc.toLowerCase().includes(q);
      })
    : clientHistory;

  const handleComplete = async (skipInvoice = false) => {
    setCompleting(true);
    setCompleteStep('Completando proyecto...');
    try {
      setCompleteStep('Guardando datos del cliente...');
      await new Promise(r => setTimeout(r, 300));

      setCompleteStep(skipInvoice ? 'Finalizando proyecto...' : 'Generando factura electronica...');
      const res = await fetch(`/api/projects/${id}/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_completion',
          skip_invoice: skipInvoice,
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
          currency: completeCurrency,
          exchange_rate: Number(completeExchangeRate) || 1,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo completar el proyecto');

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
        (skipInvoice ? ' (sin factura)' : (data.invoiceId ? ' — Factura generada' : '')) +
        (!skipInvoice && sriOk ? ' y autorizada por el SRI' : '') +
        (!skipInvoice && completeSendEmail && completeClientEmail && sriOk ? ' — Enviada por correo' : '')
      );
      if (sriError && !sriOk) {
        toast.error(`SRI: ${sriError}`);
      }
      setShowCompleteModal(false);
      fetchProject();
    } catch (e: any) { toast.error(e.message || 'Error al completar'); }
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
    try {
      const res = await fetch(`/api/projects/${id}/requirements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: reqTitle, description: reqDesc, cost: reqCost ? Number(reqCost) : null }) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setReqTitle(''); setReqDesc(''); setReqCost(''); setShowReqModal(false);
      toast.success('Requerimiento agregado');
      fetchProject();
    } catch (e: any) { toast.error(e.message || 'Error al agregar requerimiento'); }
    finally { setSavingReq(false); }
  };

  const submitWithdrawRequest = async () => {
    if (!withdrawReason.trim()) return;
    setSubmittingWithdraw(true);
    try {
      const res = await fetch(`/api/projects/${id}/requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: withdrawType, reason: withdrawReason }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success(withdrawType === 'withdrawal' ? 'Solicitud de desistimiento enviada' : 'Solicitud de salida enviada');
      setShowWithdrawModal(false); setWithdrawReason('');
      fetchProjectRequests();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSubmittingWithdraw(false); }
  };

  const reviewRequest = async (requestId: number, status: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/requests`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId, status }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      toast.success('Solicitud revisada');
      fetchProjectRequests(); fetchProject();
    } catch (e: any) { toast.error(e.message || 'Error'); }
  };

  const deleteRequirement = async (reqId: number) => {
    try {
      const res = await fetch(`/api/projects/${id}/requirements`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: reqId }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || 'Error al eliminar requerimiento'); return; }
      toast.success('Requerimiento eliminado');
      fetchProject();
    } catch (e: any) { toast.error(e.message || 'Error al eliminar requerimiento'); }
  };

  const toggleReqComplete = async (reqId: number, completed: boolean) => {
    setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => r.id === reqId ? { ...r, is_completed: completed } : r) } : p);
    try {
      const res = await fetch(`/api/projects/${id}/requirements`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: reqId, completed }) });
      if (!res.ok) throw new Error('No se pudo actualizar');
    } catch (e: any) { toast.error(e.message || 'Error'); fetchProject(); }
  };

  const addSubItem = async (reqId: number) => {
    const title = newItemText[reqId]?.trim();
    if (!title) return;
    setNewItemText(prev => ({ ...prev, [reqId]: '' }));
    const tempId = -Date.now();
    setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => r.id === reqId ? { ...r, items: [...(r.items || []), { id: tempId, title, is_completed: false }] } : r) } : p);
    try {
      const res = await fetch(`/api/projects/${id}/requirements/items`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requirement_id: reqId, title }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'No se pudo agregar la sub-tarea'); }
      const d = await res.json().catch(() => ({}));
      if (d?.data) setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => r.id === reqId ? { ...r, items: (r.items || []).map((it: any) => it.id === tempId ? d.data : it) } : r) } : p);
    } catch (e: any) {
      setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => r.id === reqId ? { ...r, items: (r.items || []).filter((it: any) => it.id !== tempId) } : r) } : p);
      setNewItemText(prev => ({ ...prev, [reqId]: title }));
      toast.error(e.message || 'Error al agregar sub-tarea');
    }
  };

  const toggleSubItem = async (itemId: number, completed: boolean) => {
    setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => ({ ...r, items: (r.items || []).map((it: any) => it.id === itemId ? { ...it, is_completed: completed } : it) })) } : p);
    try {
      const res = await fetch(`/api/projects/${id}/requirements/items`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId, is_completed: completed }) });
      if (!res.ok) throw new Error('No se pudo actualizar');
    } catch (e: any) { toast.error(e.message || 'Error'); fetchProject(); }
  };

  const deleteSubItem = async (itemId: number) => {
    setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => ({ ...r, items: (r.items || []).filter((it: any) => it.id !== itemId) })) } : p);
    try {
      const res = await fetch(`/api/projects/${id}/requirements/items`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_id: itemId }) });
      if (!res.ok) throw new Error('No se pudo eliminar');
    } catch (e: any) { toast.error(e.message || 'Error'); fetchProject(); }
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

  // --- Project Images ---
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 30 - projectImages.length;
    if (remaining <= 0) { toast.error('Maximo 30 imagenes alcanzado'); return; }
    if (files.length > remaining) { toast.error(`Solo puedes subir ${remaining} imagenes mas`); return; }

    setUploadingImages(true);
    try {
      const base64Promises = Array.from(files).slice(0, remaining).map(file => {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      });
      const base64Images = await Promise.all(base64Promises);

      const res = await fetch(`/api/projects/${id}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: base64Images }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { data } = await res.json();
      setProjectImages(data.images);
      toast.success(`${base64Images.length} imagen(es) subida(s)`);
    } catch (err: any) { toast.error(err.message || 'Error al subir imagenes'); }
    finally { setUploadingImages(false); e.target.value = ''; }
  };

  const handleImageDelete = async (index: number) => {
    setDeletingImageIdx(index);
    try {
      const res = await fetch(`/api/projects/${id}/images`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      const { data } = await res.json();
      setProjectImages(data.images);
      toast.success('Imagen eliminada');
    } catch (err: any) { toast.error(err.message || 'Error al eliminar imagen'); }
    finally { setDeletingImageIdx(null); }
  };

  const openSocialCopyPanel = async () => {
    if (!project.digimundo_project_id) return;
    const digiProject = digiProjects.find((d: any) => d.id === project.digimundo_project_id);
    if (!digiProject) { toast.error('Proyecto DigiMundo no encontrado'); return; }
    try {
      const linksRes = await fetch('/api/agent-links');
      const links = await linksRes.json();
      const agentConfig = links[digiProject.agentId];
      if (!agentConfig?.projectPath) { toast.error('Configura el path del proyecto en el chat del agente primero'); return; }
      setScriptAgentConfig({ agentId: digiProject.agentId, agentName: digiProject.name, projectPath: agentConfig.projectPath });
      setShowSocialCopy(true);
    } catch { toast.error('Error cargando configuracion del agente'); }
  };

  const openPublicDocsPanel = async () => {
    if (!project.digimundo_project_id) return;
    const digiProject = digiProjects.find((d: any) => d.id === project.digimundo_project_id);
    if (!digiProject) { toast.error('Proyecto DigiMundo no encontrado'); return; }
    try {
      const linksRes = await fetch('/api/agent-links');
      const links = await linksRes.json();
      const agentConfig = links[digiProject.agentId];
      if (!agentConfig?.projectPath) { toast.error('Configura el path del proyecto en el chat del agente primero'); return; }
      setScriptAgentConfig({ agentId: digiProject.agentId, agentName: digiProject.name, projectPath: agentConfig.projectPath });
      setShowPublicDocs(true);
    } catch { toast.error('Error cargando configuracion del agente'); }
  };

  // --- Content (Script + Video) ---
  const openScriptPanel = async () => {
    if (!project.digimundo_project_id) return;
    const digiProject = digiProjects.find((d: any) => d.id === project.digimundo_project_id);
    if (!digiProject) { toast.error('Proyecto DigiMundo no encontrado'); return; }
    try {
      const linksRes = await fetch('/api/agent-links');
      const links = await linksRes.json();
      const agentConfig = links[digiProject.agentId];
      if (!agentConfig?.projectPath) { toast.error('Configura el path del proyecto en el chat del agente primero'); return; }
      setScriptAgentConfig({ agentId: digiProject.agentId, agentName: digiProject.name, projectPath: agentConfig.projectPath });
      setShowScriptPanel(true);
    } catch { toast.error('Error cargando configuracion del agente'); }
  };

  const handleGenerateVideo = async () => {
    if (!videoScript) { toast.error('Primero genera el guion'); return; }
    if (projectImages.length === 0) { toast.error('Sube imagenes al proyecto primero'); return; }
    setGeneratingVideo(true);
    setVideoStep('Analizando imagenes...');
    try {
      const res = await fetch(`/api/projects/${id}/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: videoScript, storyboard: storyboard || undefined }),
      });

      // Stream progress updates
      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.step) setVideoStep(parsed.step);
              if (parsed.video_url) setVideoUrl(parsed.video_url);
              if (parsed.error) throw new Error(parsed.error);
            } catch (e: any) { if (e.message !== 'Unexpected end of JSON input') throw e; }
          }
        }
        toast.success('Video generado exitosamente');
        fetchContent();
      }
    } catch (err: any) { toast.error(err.message || 'Error generando video'); }
    finally { setGeneratingVideo(false); setVideoStep(''); }
  };

  // --- Proforma ---
  const openProformaChat = async () => {
    if (!project.digimundo_project_id) return;
    const digiProject = digiProjects.find((d: any) => d.id === project.digimundo_project_id);
    if (!digiProject) { toast.error('Proyecto DigiMundo no encontrado'); return; }

    try {
      const linksRes = await fetch('/api/agent-links');
      const links = await linksRes.json();
      const agentConfig = links[digiProject.agentId];
      if (!agentConfig?.projectPath) { toast.error('Configura el path del proyecto en el chat del agente primero'); return; }
      setProformaAgentConfig({ agentId: digiProject.agentId, agentName: digiProject.name, projectPath: agentConfig.projectPath });
      setShowProformaChat(true);
    } catch { toast.error('Error cargando configuracion del agente'); }
  };

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando proyecto..." /></div>;
  if (!project) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-600">Proyecto no encontrado</p></div>;

  const reqs = project.requirements || [];
  const completedReqs = reqs.filter((r: any) => r.is_completed).length;
  const bids = project.bids || [];
  const incidents = project.incidents || [];
  const linkedDigiName = digiProjects.find((d: any) => d.id === project.digimundo_project_id)?.name;
  // Can add requirements: not in review/completed/cancelled; in in_progress only creator/admin
  const canAddReqs = isOwner && !['review', 'completed', 'cancelled', 'closed'].includes(project.status);
  // Has unassigned requirements (for invite/visibility controls)
  const hasUnassignedReqs = reqs.some((r: any) => !(r.assignments || []).some((a: any) => a.status === 'accepted'));
  // Can invite: only in open/in_progress and if unassigned reqs exist
  const canInvite = isOwner && ['open', 'in_progress'].includes(project.status) && hasUnassignedReqs;
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
  // Images: visible when project is not draft; editable by owner or accepted participant
  const showImages = project.status !== 'draft';
  const isAcceptedParticipant = isMember && !isOwner && bids.some((b: any) => String(b.member_id) === String(memberId) && b.status === 'accepted');
  const canEditImages = showImages && (isOwner || isAcceptedParticipant);
  const myBid = bids.find((b: any) => String(b.member_id) === String(memberId));
  const canBidNew = isMember && !isOwner && !myBid && (project.status === 'open' || (project.status === 'draft' && !project.is_private));
  const canBidInvited = isMember && !isOwner && myBid?.status === 'invited';
  const canBid = canBidNew || canBidInvited;

  const SectionRailItem = ({ active, Icon, label, count, onClick }: any) => (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
        active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
      }`}>
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
      <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count}</span>
      )}
    </button>
  );

  return (
    <div>
      {editingTitle ? (
        <div className="mb-5 flex items-center gap-2">
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
            autoFocus
            className="field-control flex-1 px-3 py-2 bg-digi-darker border-2 border-accent text-lg text-digi-text focus:outline-none"
            style={pf}
          />
          <button onClick={saveTitle} className={BTN_PRIMARY}>Guardar</button>
          <button onClick={() => setEditingTitle(false)} className={BTN_SECONDARY}>Cancelar</button>
        </div>
      ) : (
        <DetailHeader
          breadcrumb={{ label: 'Proyectos', href: '/dashboard/projects' }}
          title={project.title}
          status={
            <span className="flex items-center gap-2">
              {project.marketplace_source_id && (
                <Link href={`/dashboard/projects/${project.marketplace_source_id}`}><PixelBadge variant="info">Marketplace</PixelBadge></Link>
              )}
              {project.is_marketplace_published && <PixelBadge variant="success">En Marketplace</PixelBadge>}
              <PixelBadge variant={STATUS_V[project.status] || 'default'}>{STATUS_LABEL[project.status] || project.status}</PixelBadge>
            </span>
          }
          chips={
            <>
              {project.client_name && <HeaderChip>{project.client_name}</HeaderChip>}
              {(project.final_cost || project.budget_max) && <HeaderChip>${fmt2(Number(project.final_cost || project.budget_max))}</HeaderChip>}
              {project.deadline && <HeaderChip>Límite {new Date(project.deadline).toLocaleDateString()}</HeaderChip>}
            </>
          }
          actions={
            <>
              {project.status === 'draft' && isOwner && <button onClick={() => updateStatus('open')} className={BTN_PRIMARY}><DoorOpen className="w-4 h-4" /> Publicar</button>}
              {project.status === 'open' && isOwner && <button onClick={() => updateStatus('in_progress')} className={BTN_PRIMARY}><Play className="w-4 h-4" /> Iniciar</button>}
              {project.status === 'in_progress' && isOwner && (() => {
                const reqs = project.requirements || [];
                const allDone = reqs.length > 0 && reqs.every((r: any) => r.is_completed || r.completed_at);
                return (
                  <button onClick={() => updateStatus('review')} disabled={!allDone}
                    className={allDone ? BTN_PRIMARY : BTN_SECONDARY}
                    title={!allDone ? 'Todos los requerimientos deben estar completados' : ''}><Send className="w-4 h-4" /> Enviar a revisión</button>
                );
              })()}
              {project.status === 'review' && isAdmin && <button onClick={openCompleteModal} className={BTN_PRIMARY}><Receipt className="w-4 h-4" /> Completar y facturar</button>}
            </>
          }
          overflow={[
            ...(isOwner && !isTerminal ? [{ label: 'Editar nombre', onClick: () => { setEditTitle(project.title); setEditingTitle(true); } }] : []),
            ...(isOwner && !isTerminal ? [{ label: 'Cancelar proyecto', onClick: () => updateStatus('cancelled'), danger: true }] : []),
            ...(isAdmin ? [{ label: 'Eliminar proyecto', onClick: () => setConfirmDeleteProject(true), danger: true }] : []),
          ]}
        />
      )}

      {/* Invitación a tomar el liderazgo (responsable) del proyecto */}
      {myResponsibleInvite && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent-light p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-digi-text" style={{ fontFamily: 'var(--font-body)' }}>Te invitaron a liderar este proyecto</p>
            <p className="text-[12px] text-digi-muted" style={{ fontFamily: 'var(--font-body)' }}>Como responsable tomas la dirección del proyecto y su gestión completa. Solo la facturación queda reservada al administrador.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => respondResponsible('decline')} className={BTN_SECONDARY}>Rechazar</button>
            <button onClick={() => respondResponsible('accept')} className={BTN_PRIMARY}><Check className="w-4 h-4" /> Aceptar liderazgo</button>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Section rail */}
        <aside className="w-full lg:w-[200px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Secciones</p>
          <div className="space-y-0.5">
            <SectionRailItem active={ptab === 'resumen'} Icon={LayoutList} label="Resumen" onClick={() => setPtab('resumen')} />
            <SectionRailItem active={ptab === 'requerimientos'} Icon={ListChecks} label="Requerimientos" count={reqs.length} onClick={() => setPtab('requerimientos')} />
            <SectionRailItem active={ptab === 'digimundo'} Icon={Boxes} label="DigiMundo" onClick={() => setPtab('digimundo')} />
            <SectionRailItem active={ptab === 'imagenes'} Icon={ImageIcon} label="Imágenes" onClick={() => setPtab('imagenes')} />
          </div>
        </aside>

        {/* ====== CONTENT ====== */}
        <div className="flex-1 min-w-0 space-y-4">
          {ptab === 'resumen' && (<>
          {project.description && (
            <div className="pixel-card">
              <h3 className="text-[12px] font-semibold text-digi-text mb-2" style={pf}>Descripcion</h3>
              <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{project.description}</p>
            </div>
          )}
          </>)}

          {ptab === 'requerimientos' && (<>
          {/* Requirements */}
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[14px] font-semibold text-digi-text" style={mf}>
                Requerimientos <span className="text-digi-muted font-normal">({completedReqs}/{reqs.length})</span>
              </h3>
              <div className="flex items-center gap-3">
                {reqs.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-28 h-1.5 rounded-full bg-digi-border/60 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${reqs.length ? (completedReqs / reqs.length) * 100 : 0}%` }} /></div>
                    <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{reqs.length ? Math.round((completedReqs / reqs.length) * 100) : 0}%</span>
                  </div>
                )}
                {canAddReqs && (
                  <button onClick={() => setShowReqModal(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
                )}
              </div>
            </div>

            {reqs.length === 0 ? (
              <p className="text-[13px] text-digi-muted text-center py-6" style={mf}>Sin requerimientos aún.</p>
            ) : (
              <div className="space-y-2">
                {reqs.map((r: any) => {
                  const assignments = r.assignments || [];
                  const items = r.items || [];
                  const canEditThis = canMemberEditReq(r.id);
                  const acceptedAssignments = assignments.filter((a: any) => a.status === 'accepted');
                  return (
                    <div key={r.id} className={`rounded-lg border border-digi-border bg-white overflow-hidden`}>
                      <div className={`p-2.5 border-l-[3px] ${r.is_completed ? 'border-l-green-500' : 'border-l-accent'}`}>
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => canEditThis && toggleReqComplete(r.id, !r.is_completed)}
                            disabled={!canEditThis}
                            aria-label={r.is_completed ? 'Marcar incompleto' : 'Marcar completo'}
                            className={`mt-0.5 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${r.is_completed ? 'bg-accent border-accent text-white' : 'border-digi-border bg-white'} ${canEditThis ? 'cursor-pointer hover:border-accent' : 'cursor-default'}`}
                          >
                            {r.is_completed && <Check className="w-3 h-3" strokeWidth={3} />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] font-medium ${r.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</p>
                            {r.description && <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{r.description}</p>}
                            {acceptedAssignments.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1.5">
                                {acceptedAssignments.map((a: any) => (
                                  a.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={a.id} src={a.photo_url} alt="" title={`${a.member_name} · $${a.member_cost ?? a.proposed_cost}`} className="w-6 h-6 rounded-full border border-digi-border object-cover" />
                                  ) : (
                                    <div key={a.id} title={`${a.member_name} · $${a.member_cost ?? a.proposed_cost}`} className="w-6 h-6 rounded-full border border-accent/20 bg-accent-light flex items-center justify-center text-[11px] font-semibold text-accent" style={mf}>
                                      {(a.member_name || '?')[0].toUpperCase()}
                                    </div>
                                  )
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.cost && <span className="text-[13px] font-semibold text-accent tabular-nums" style={mf}>${r.cost}</span>}
                            {isOwner && (
                              <button onClick={() => deleteRequirement(r.id)} aria-label="Eliminar requerimiento" className="text-digi-muted/60 hover:text-red-600 transition-colors"><X className="w-4 h-4" /></button>
                            )}
                          </div>
                        </div>

                        {/* Pending assignments (proposed / counter) */}
                        {assignments.filter((a: any) => a.status !== 'accepted').length > 0 && (
                          <div className="mt-2.5 ml-[30px] space-y-1.5">
                            {assignments.filter((a: any) => a.status !== 'accepted').map((a: any) => (
                              <div key={a.id} className="flex items-center gap-2 flex-wrap rounded-md border border-digi-border bg-digi-darker px-2.5 py-1.5">
                                {a.photo_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={a.photo_url} alt="" title={a.member_name} className="w-5 h-5 rounded-full border border-digi-border object-cover" />
                                ) : (
                                  <div title={a.member_name} className="w-5 h-5 rounded-full border border-accent/20 bg-accent-light flex items-center justify-center text-[10px] font-semibold text-accent" style={mf}>{(a.member_name || '?')[0].toUpperCase()}</div>
                                )}
                                <span className="text-[12px] text-digi-text" style={mf}>{a.member_name}</span>
                                <span className="text-[11px] text-digi-muted" style={mf}>Propuesto ${a.proposed_cost}{a.member_cost != null && ` → contra $${a.member_cost}`}</span>
                                <PixelBadge variant={a.status === 'counter' ? 'warning' : a.status === 'rejected' ? 'error' : 'info'}>{a.status === 'counter' ? 'Contraoferta' : a.status === 'rejected' ? 'Rechazada' : 'Propuesta'}</PixelBadge>
                                {a.status === 'proposed' && a.member_id == memberId && (
                                  <div className="flex items-center gap-1.5 ml-auto">
                                    <input value={counterCosts[a.id] || ''} onChange={(e) => setCounterCosts(prev => ({ ...prev, [a.id]: e.target.value }))} placeholder="Tu costo" type="number"
                                      className="field-control w-20 px-2 py-1 bg-white border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                                    <button onClick={() => submitCounter(a.id)} className="text-[12px] font-medium text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent-light transition-colors" style={mf}>Enviar</button>
                                  </div>
                                )}
                                {a.status === 'counter' && isOwner && (
                                  <div className="flex gap-1.5 ml-auto">
                                    <button onClick={() => resolveAssignment(a.id, 'accept')} className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-green-600 rounded px-2 py-1 hover:bg-green-700 transition-colors" style={mf}><Check className="w-3.5 h-3.5" /> Aceptar</button>
                                    <button onClick={() => resolveAssignment(a.id, 'reject')} className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600 border border-red-300 rounded px-2 py-1 hover:bg-red-50 transition-colors" style={mf}><X className="w-3.5 h-3.5" /> Rechazar</button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Subtasks list */}
                        {items.length > 0 && (
                          <ol className="mt-2.5 ml-[30px] space-y-1">
                            {items.map((item: any, i: number) => (
                              <li key={item.id} className={`text-[12px] flex gap-1.5 ${item.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>
                                <span className="text-digi-muted shrink-0">{i + 1}.</span>
                                <span className="break-words">{item.title}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {/* Action buttons */}
                        {((isOwner && (isAdmin || project.confirmed_at || isMemberCreator)) || canEditThis) && (
                          <div className="flex flex-wrap items-center gap-2 mt-3 ml-[30px]">
                            {isOwner && (isAdmin || project.confirmed_at || isMemberCreator) && (
                              <button onClick={() => openAssignModal(r.id)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={mf}><UserPlus className="w-3.5 h-3.5" /> Asignar miembro</button>
                            )}
                            {canEditThis && (
                              <button onClick={() => setSubtaskReqId(r.id)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={mf}><ListPlus className="w-3.5 h-3.5" /> Subtareas{items.length > 0 ? ` (${items.length})` : ''}</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Equipo del proyecto: responsable + participantes (concepto project_members) */}
          {(() => {
            const team: any[] = project.project_members || [];
            const responsibleRow = project.responsible || team.find((t) => t.role === 'responsible' && t.status === 'active');
            const participants = team.filter((t) => t.status === 'active' && String(t.member_id) !== String(responsibleRow?.member_id));
            const Avatar = ({ m }: { m: any }) => m.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.photo_url} alt="" className="w-8 h-8 rounded-full border border-digi-border object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full border border-accent/20 bg-accent-light flex items-center justify-center text-[12px] font-semibold text-accent shrink-0" style={mf}>{(m.member_name || '?')[0].toUpperCase()}</div>
            );
            return (
              <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-[14px] font-semibold text-digi-text inline-flex items-center gap-1.5" style={mf}><Users className="w-4 h-4 text-accent" /> Equipo del proyecto</h3>
                  {isOwner && (
                    <button onClick={() => { setNewParticipantId(''); setShowAddParticipant(true); }} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors" style={mf}><UserPlus className="w-3.5 h-3.5" /> Agregar participante</button>
                  )}
                </div>
                {/* Responsable */}
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Responsable</p>
                  {responsibleRow ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent-light px-3 py-2">
                      <Avatar m={responsibleRow} />
                      <span className="text-[13px] font-medium text-digi-text flex-1 min-w-0 truncate" style={mf}>{responsibleRow.member_name}</span>
                      <PixelBadge variant="info"><span className="inline-flex items-center gap-1"><Crown className="w-3 h-3" /> Responsable</span></PixelBadge>
                    </div>
                  ) : project.pending_responsible ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-digi-border px-3 py-2">
                      <Avatar m={project.pending_responsible} />
                      <span className="text-[13px] font-medium text-digi-text flex-1 min-w-0 truncate" style={mf}>{project.pending_responsible.member_name}</span>
                      <PixelBadge variant="warning">Invitación pendiente</PixelBadge>
                    </div>
                  ) : (
                    <p className="text-[12px] text-digi-muted" style={mf}>Sin responsable asignado (abierto a propuestas).</p>
                  )}
                </div>
                {/* Participantes */}
                <div>
                  <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Participantes ({participants.length})</p>
                  {participants.length > 0 ? (
                    <div className="space-y-1.5">
                      {participants.map((m) => (
                        <div key={m.member_id} className="flex items-center gap-2.5 rounded-lg border border-digi-border px-3 py-1.5">
                          <Avatar m={m} />
                          <span className="text-[12.5px] text-digi-text flex-1 min-w-0 truncate" style={mf}>{m.member_name}</span>
                          {isOwner && (
                            <button onClick={() => removeParticipant(String(m.member_id))} title="Quitar" className="shrink-0 p-1.5 rounded text-digi-muted hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12px] text-digi-muted" style={mf}>Aún no hay participantes. Se suman al aceptar sus propuestas o agregándolos.</p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Propuestas (bids/postulaciones) */}
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-[14px] font-semibold text-digi-text" style={mf}>Propuestas</h3>
              <div className="flex gap-2">
                {canInvite && (
                  <button onClick={openInviteModal} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors" style={mf}><UserPlus className="w-3.5 h-3.5" /> Invitar</button>
                )}
                {canBid && (
                  <button onClick={() => setShowBidModal(true)} className={BTN_PRIMARY} style={mf}><Send className="w-4 h-4" /> Postularme</button>
                )}
              </div>
            </div>
            {bids.length > 0 ? (
              <div className="space-y-2.5">
                {bids.map((b: any) => {
                  const bidLabel = ({ pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', invited: 'Invitado', counter: 'Contraoferta' } as Record<string, string>)[b.status] || b.status;
                  return (
                    <div key={b.id} className="rounded-lg border border-digi-border p-3.5">
                      <div className="flex items-start gap-3">
                        {b.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.photo_url} alt="" className="w-9 h-9 rounded-full border border-digi-border object-cover shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full border border-accent/20 bg-accent-light flex items-center justify-center text-[13px] font-semibold text-accent shrink-0" style={mf}>{(b.member_name || '?')[0].toUpperCase()}</div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-medium text-digi-text" style={mf}>{b.member_name}</span>
                            {b.bid_amount != null && <span className="text-[13px] font-semibold text-accent tabular-nums" style={mf}>${fmt2(Number(b.bid_amount))}</span>}
                            {b.estimated_days && <span className="text-[11px] text-digi-muted" style={mf}>· {b.estimated_days}d</span>}
                            <PixelBadge variant={BID_V[b.status] || 'default'}>{bidLabel}</PixelBadge>
                            {b.requirement_ids?.length > 0 && (
                              <span tabIndex={0} className="relative group/reqs inline-flex items-center gap-1 text-[11px] text-accent bg-accent-light border border-accent/20 rounded px-1.5 py-0.5 cursor-default outline-none" style={mf}>
                                <ListChecks className="w-3 h-3" /> {b.requirement_ids.length} req.
                                <span className="absolute left-0 top-full mt-1.5 z-30 w-64 max-w-[80vw] bg-digi-card border border-digi-border rounded-lg shadow-lg p-2.5 opacity-0 invisible group-hover/reqs:opacity-100 group-hover/reqs:visible group-focus-within/reqs:opacity-100 group-focus-within/reqs:visible transition-opacity" style={mf}>
                                  <span className="block text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1">Requerimientos</span>
                                  {b.requirement_ids.map((rid: number) => {
                                    const req = reqs.find((r: any) => r.id === rid || r.id === Number(rid));
                                    return req ? <span key={rid} className="block text-[11px] text-digi-text truncate">• {req.title}</span> : null;
                                  })}
                                </span>
                              </span>
                            )}
                          </div>
                          {b.proposal && <p className="text-[12px] text-digi-muted mt-1 leading-relaxed" style={mf}>{b.proposal}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isOwner && b.status === 'pending' && (
                            <>
                              <button onClick={async () => { await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: b.id, status: 'accepted' }) }); fetchProject(); toast.success('Propuesta aceptada'); }}
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-green-600 rounded px-2.5 py-1.5 hover:bg-green-700 transition-colors" style={mf}><Check className="w-3.5 h-3.5" /> Aceptar</button>
                              <button onClick={async () => { await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: b.id, status: 'rejected' }) }); fetchProject(); }}
                                className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600 border border-red-300 rounded px-2.5 py-1.5 hover:bg-red-50 transition-colors" style={mf}><X className="w-3.5 h-3.5" /> Rechazar</button>
                            </>
                          )}
                          {b.status === 'invited' && String(b.member_id) === String(memberId) && (
                            <button onClick={() => setShowBidModal(true)} className="inline-flex items-center gap-1 text-[12px] font-medium text-accent border border-accent/40 rounded px-2.5 py-1.5 hover:bg-accent-light transition-colors" style={mf}><Send className="w-3.5 h-3.5" /> Enviar propuesta</button>
                          )}
                          {isOwner && b.status === 'invited' && String(b.member_id) !== String(memberId) && (
                            <span className="text-[11px] text-amber-700" style={mf}>Esperando</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-digi-muted text-center py-3" style={mf}>Sin participantes aún.</p>
            )}
          </div>
          </>)}

          {/* Invite Modal */}
          <PixelModal open={showInviteModal} onClose={() => setShowInviteModal(false)} title="Invitar miembros" size="md">
            <div className="space-y-3">
              <p className="text-[12px] text-digi-muted" style={mf}>Selecciona los miembros que deseas invitar a enviar una propuesta:</p>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {allMembers.filter(m => !bids.some((b: any) => String(b.member_id) === String(m.id))).map((m: any) => {
                  const checked = selectedInvites.has(m.id);
                  return (
                    <label key={m.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-accent bg-accent-light/50' : 'border-digi-border hover:border-accent/40'}`}>
                      <input type="checkbox" checked={checked}
                        onChange={() => { const next = new Set(selectedInvites); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); setSelectedInvites(next); }}
                        className="w-4 h-4 accent-[#4B2D8E]" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[13px] text-digi-text" style={mf}>{m.name}</span>
                        {m.email && <span className="text-[11px] text-digi-muted ml-2" style={mf}>{m.email}</span>}
                      </div>
                      {m.position_name && <PixelBadge variant="default">{m.position_name}</PixelBadge>}
                    </label>
                  );
                })}
                {allMembers.filter(m => !bids.some((b: any) => String(b.member_id) === String(m.id))).length === 0 && (
                  <p className="text-center text-[12px] text-digi-muted py-4" style={mf}>Todos los miembros ya fueron invitados</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
                <button onClick={() => setShowInviteModal(false)} className="pixel-btn pixel-btn-secondary text-sm">Cancelar</button>
                <button onClick={sendInvites} disabled={inviting || selectedInvites.size === 0} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50">
                  {inviting ? 'Invitando...' : `Invitar (${selectedInvites.size})`}
                </button>
              </div>
            </div>
          </PixelModal>

          {/* Bid/Postulation Modal */}
          <PixelModal open={showBidModal} onClose={() => setShowBidModal(false)} title="Enviar propuesta" size="md">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Propuesta *</label>
                <textarea value={bidProposal} onChange={e => setBidProposal(e.target.value)} rows={3}
                  placeholder="Describe tu propuesta, experiencia relevante y cómo abordarías el proyecto..."
                  className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
              </div>

              <div className="flex flex-col gap-1">
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Días estimados</label>
                <input value={bidDays} onChange={e => setBidDays(e.target.value)} type="number" placeholder="Opcional"
                  className="field-control w-full sm:w-40 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
              </div>

              {reqs.length > 0 && (
                <div>
                  <label className="field-label text-[10px] text-accent-glow opacity-70 block mb-0.5" style={df}>Requerimientos que puedes atender *</label>
                  <p className="text-[11px] text-digi-muted mb-2" style={mf}>Marca los que puedes atender e indica tu costo para cada uno.</p>
                  <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                    {reqs.map((r: any) => {
                      const selected = bidReqIds.includes(r.id);
                      const toggle = () => {
                        if (selected) { setBidReqIds(prev => prev.filter(rid => rid !== r.id)); setBidReqCosts(prev => { const next = { ...prev }; delete next[r.id]; return next; }); }
                        else setBidReqIds(prev => [...prev, r.id]);
                      };
                      return (
                        <div key={r.id} className={`rounded-lg border p-3 transition-colors ${selected ? 'border-accent bg-accent-light/40' : 'border-digi-border'}`}>
                          <div className="flex items-center gap-2.5">
                            <button type="button" onClick={toggle}
                              className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-accent border-accent text-white' : 'border-digi-border bg-white hover:border-accent'}`}>
                              {selected && <Check className="w-3 h-3" strokeWidth={3} />}
                            </button>
                            <button type="button" onClick={toggle} className="text-[13px] font-medium text-digi-text flex-1 text-left" style={mf}>{r.title}</button>
                            {r.cost && <span className="text-[11px] text-digi-muted shrink-0" style={mf}>Ref ${r.cost}</span>}
                          </div>
                          {selected && (
                            <div className="mt-2.5 ml-[30px] flex items-center gap-2 flex-wrap">
                              <span className="text-[12px] text-digi-muted" style={mf}>Tu costo ($)</span>
                              <input value={bidReqCosts[r.id] || ''} onChange={e => setBidReqCosts(prev => ({ ...prev, [r.id]: e.target.value }))} type="number" placeholder="0"
                                className="field-control w-28 px-2.5 py-1.5 bg-white border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                              {r.cost && (
                                <button onClick={() => setBidReqCosts(prev => ({ ...prev, [r.id]: String(r.cost) }))}
                                  className="text-[11px] font-medium text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent-light transition-colors" style={mf}
                                  title="Usar el costo de referencia">Usar ${r.cost}</button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {bidReqIds.length > 0 && (
                    <div className="mt-3 flex items-center justify-between rounded-lg border border-accent/30 bg-accent-light px-3 py-2">
                      <span className="text-[12px] text-digi-muted" style={mf}>Total de tu propuesta</span>
                      <span className="text-[15px] font-semibold text-accent tabular-nums" style={mf}>${fmt2(bidReqIds.reduce((sum, rid) => sum + (Number(bidReqCosts[rid]) || 0), 0))}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
                <button onClick={() => setShowBidModal(false)} className="pixel-btn pixel-btn-secondary text-sm">Cancelar</button>
                <button onClick={submitBid} disabled={submittingBid || !bidProposal.trim() || bidReqIds.length === 0} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50">
                  {submittingBid ? 'Enviando...' : 'Enviar propuesta'}
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
                  <div className="w-full h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                    <div className="h-full bg-accent animate-[progressPulse_1.5s_ease-in-out_infinite]" style={{ width: '100%' }} />
                  </div>
                  <p className="text-center text-[13px] text-digi-text" style={mf}>{completeStep}</p>
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
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] border-2 transition-all ${
                        s.done ? 'border-green-500 bg-green-50 text-green-600' : 'border-digi-border text-digi-muted animate-pulse'
                      }`} style={pf}>
                        {s.done ? '✓' : i + 1}
                      </div>
                      <span className={`text-[11px] ${s.done ? 'text-green-600' : 'text-digi-muted'}`} style={pf}>{s.label}</span>
                      {i < 3 && <div className={`w-4 h-0.5 ${s.done ? 'bg-green-500' : 'bg-digi-border'}`} />}
                    </div>
                  ))}
                </div>

                <p className="text-center text-[12px] text-digi-muted" style={mf}>No cierres esta ventana hasta que el proceso termine</p>
              </div>
            ) : (
            <div className="max-h-[80vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ─── LEFT: Adquirente + Pago ─── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-digi-border pb-1">
                    <h4 className="text-[12px] text-accent" style={pf}>Adquirente</h4>
                    <button
                      type="button"
                      onClick={() => setHistoryOpen(o => !o)}
                      className="text-[11px] px-2 py-0.5 rounded border border-accent/40 text-accent hover:bg-accent-light transition-colors"
                      style={pf}
                    >
                      {historyOpen ? 'Cerrar' : `Cliente previo${clientHistory.length ? ` (${clientHistory.length})` : ''}`}
                    </button>
                  </div>

                  {historyOpen && (
                    <div className="border border-digi-border rounded-lg bg-digi-darker p-2 space-y-2">
                      <input
                        autoFocus
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        placeholder="Buscar por nombre o RUC..."
                        className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none"
                        style={mf}
                      />
                      <div className="max-h-40 overflow-y-auto border border-digi-border/50">
                        {filteredHistory.length === 0 ? (
                          <div className="px-2 py-3 text-center text-[12px] text-digi-muted" style={pf}>
                            {clientHistory.length === 0 ? 'No hay clientes previos' : 'Sin resultados'}
                          </div>
                        ) : (
                          filteredHistory.slice(0, 50).map((c) => (
                            <button
                              key={c.client_ruc}
                              type="button"
                              onClick={() => applyPastClient(c)}
                              className="w-full text-left px-2 py-1.5 border-b border-digi-border/30 last:border-b-0 hover:bg-accent/10 transition-colors"
                            >
                              <div className="text-[12px] text-digi-text truncate" style={mf}>{c.client_name}</div>
                              <div className="text-[11px] text-digi-muted flex gap-2" style={mf}>
                                <span>{c.client_ruc}</span>
                                {c.client_email && <span className="truncate">· {c.client_email}</span>}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="text-[11px] text-digi-muted" style={pf}>
                        Elige uno para rellenar los campos, o cierra y llena manualmente.
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Tipo ID <span className="text-red-600">*</span></label>
                      <select value={completeIdType} onChange={e => {
                        const t = e.target.value;
                        setCompleteIdType(t);
                        if (t === '07') { setCompleteClientRuc('9999999999999'); setCompleteClientName('CONSUMIDOR FINAL'); }
                        else { if (completeClientRuc === '9999999999999') setCompleteClientRuc(''); if (completeClientName === 'CONSUMIDOR FINAL') setCompleteClientName(''); }
                      }} className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                        <option value="04">RUC</option><option value="05">Cedula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Identificacion <span className="text-red-600">*</span></label>
                      <input value={completeClientRuc} onChange={e => setCompleteClientRuc(e.target.value)} disabled={completeIdType === '07'}
                        placeholder={completeIdType === '04' ? '0900000000001' : '0900000000'} maxLength={completeIdType === '04' ? 13 : completeIdType === '05' ? 10 : 20}
                        className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                      {completeIdType === '04' && completeClientRuc && completeClientRuc.length !== 13 && <p className="text-[11px] text-red-600" style={mf}>13 digitos</p>}
                      {completeIdType === '05' && completeClientRuc && completeClientRuc.length !== 10 && <p className="text-[11px] text-red-600" style={mf}>10 digitos</p>}
                    </div>
                  </div>
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Razon Social <span className="text-red-600">*</span></label>
                    <input value={completeClientName} onChange={e => setCompleteClientName(e.target.value)} disabled={completeIdType === '07'}
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                  </div>
                  <div>
                    <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Direccion <span className="text-red-600">*</span></label>
                    <input value={completeClientAddress} onChange={e => setCompleteClientAddress(e.target.value)} placeholder="Direccion"
                      className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Email {completeIdType !== '07' && <span className="text-red-600">*</span>}</label>
                      <input value={completeClientEmail} onChange={e => setCompleteClientEmail(e.target.value)} type="email" placeholder="correo@ejemplo.com"
                        className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    </div>
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Telefono</label>
                      <input value={completeClientPhone} onChange={e => setCompleteClientPhone(e.target.value)} placeholder="0999999999"
                        className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    </div>
                  </div>

                  <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Forma de Pago</h4>
                  <select value={completePaymentCode} onChange={e => setCompletePaymentCode(e.target.value)}
                    className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                    <option value="01">Sin utilizacion del sistema financiero</option>
                    <option value="15">Compensacion de deudas</option>
                    <option value="16">Tarjeta de debito</option>
                    <option value="17">Dinero electronico</option>
                    <option value="18">Tarjeta prepago</option>
                    <option value="19">Tarjeta de credito</option>
                    <option value="20">Otros con utilizacion del sistema financiero</option>
                    <option value="21">Endoso de titulos</option>
                  </select>

                  {currencies.length > 0 && (
                  <>
                  <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Moneda</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Moneda</label>
                      <select value={completeCurrency} onChange={e => {
                        const code = e.target.value;
                        setCompleteCurrency(code);
                        const c = currencies.find(c => c.code === code);
                        setCompleteExchangeRate(c ? String(c.rate) : '1');
                      }} className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                        {currencies.map(c => (
                          <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-label text-[11px] text-digi-muted mb-1 block" style={pf}>Tasa (1 USD = ?)</label>
                      <input value={completeExchangeRate} onChange={e => setCompleteExchangeRate(e.target.value)}
                        type="number" min="0.0001" step="0.0001" disabled={completeCurrency === 'USD'}
                        className="w-full field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none disabled:opacity-50" style={mf} />
                    </div>
                  </div>
                  {completeCurrency !== 'USD' && (
                    <div className="px-2 py-1.5 border border-accent/30 rounded bg-accent-light text-[12px] text-accent mt-1" style={mf}>
                      Equivalente para el cliente: {(() => {
                        const t = completeItems.reduce((s, it) => {
                          const base = (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);
                          return s + base + base * ((Number(it.ivaRate) || 0) / 100);
                        }, 0);
                        const sym = currencies.find(c => c.code === completeCurrency)?.symbol || completeCurrency;
                        return `${sym} ${fmt2((t * (Number(completeExchangeRate) || 1)))} ${completeCurrency}`;
                      })()}
                      <span className="text-digi-muted"> (referencia, factura en USD)</span>
                    </div>
                  )}
                  </>
                  )}

                  <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 mt-3" style={pf}>Campos Adicionales</h4>
                  <div className="space-y-1">
                    {completeAdditionalFields.map((f, i) => (
                      <div key={i} className="flex gap-1">
                        <input value={f.name} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], name: e.target.value }; setCompleteAdditionalFields(n); }}
                          placeholder="Nombre" className="w-1/3 field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <input value={f.value} onChange={e => { const n = [...completeAdditionalFields]; n[i] = { ...n[i], value: e.target.value }; setCompleteAdditionalFields(n); }}
                          placeholder="Descripcion" className="flex-1 field-control px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                        <button onClick={() => setCompleteAdditionalFields(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-red-500/70 hover:text-red-600 text-[13px] px-1" style={pf}>X</button>
                      </div>
                    ))}
                    <button onClick={() => setCompleteAdditionalFields(prev => [...prev, { name: '', value: '' }])}
                      className="text-[12px] text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={pf}>+ Campo adicional</button>
                  </div>
                </div>

                {/* ─── RIGHT: Detalle + Totales ─── */}
                <div className="space-y-2">
                  <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5" style={pf}>Detalle</h4>
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                    {completeItems.map((item, i) => (
                      <div key={i} className="border border-digi-border rounded-lg p-2">
                        <div className="flex gap-1 mb-1">
                          <input value={item.description} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], description: e.target.value }; setCompleteItems(n); }}
                            placeholder="Descripcion" className="flex-1 px-2 py-0.5 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          <button onClick={() => setCompleteItems(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-500/70 hover:text-red-600 text-[13px] px-1" style={pf}>X</button>
                        </div>
                        <div className="grid grid-cols-4 gap-1">
                          <div>
                            <label className="text-[11px] text-digi-muted" style={pf}>Cant.</label>
                            <input value={item.quantity} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], quantity: e.target.value }; setCompleteItems(n); }}
                              type="number" min="0.01" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          </div>
                          <div>
                            <label className="text-[11px] text-digi-muted" style={pf}>P.Unit.</label>
                            <input value={item.unitPrice} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], unitPrice: e.target.value }; setCompleteItems(n); }}
                              type="number" min="0" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          </div>
                          <div>
                            <label className="text-[11px] text-digi-muted" style={pf}>IVA</label>
                            <select value={item.ivaRate} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], ivaRate: e.target.value }; setCompleteItems(n); }}
                              className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf}>
                              <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] text-digi-muted" style={pf}>Desc.</label>
                            <input value={item.discount} onChange={e => { const n = [...completeItems]; n[i] = { ...n[i], discount: e.target.value }; setCompleteItems(n); }}
                              type="number" min="0" step="0.01" className="w-full field-control px-2 py-1 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setCompleteItems(prev => [...prev, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
                    className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={pf}>+ Item</button>

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
                      <div className="border border-digi-border rounded-lg p-3 text-[12px] space-y-1" style={mf}>
                        {Object.entries(ivaByRate).map(([rate, base]) => (
                          <div key={rate} className="flex justify-between"><span className="text-digi-muted">Subtotal {rate}%:</span><span className="text-digi-text">${fmt2(base)}</span></div>
                        ))}
                        {totalDiscount > 0 && <div className="flex justify-between"><span className="text-digi-muted">Total descuento:</span><span className="text-digi-text">${fmt2(totalDiscount)}</span></div>}
                        {totalIva > 0 && <div className="flex justify-between"><span className="text-digi-muted">IVA:</span><span className="text-digi-text">${fmt2(totalIva)}</span></div>}
                        <div className="flex justify-between border-t border-digi-border pt-1"><span className="text-accent font-semibold">Total:</span><span className="text-accent font-semibold">${fmt2((subtotal + totalIva))}</span></div>
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
                  <div className="pt-3 mt-3 border-t border-digi-border space-y-2">
                    {consumidorFinalOver50 && (
                      <div className="px-3 py-2 border border-red-300 rounded bg-red-50 text-[12px] text-red-600" style={mf}>
                        El SRI requiere identificar al cliente (RUC o Cedula) en facturas mayores a $50.00. El total actual es ${fmt2(invoiceTotal)}. Cambia el tipo de identificacion.
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={completeSendEmail} onChange={e => setCompleteSendEmail(e.target.checked)} className="accent-[#4B2D8E]" />
                        <span className="text-[12px] text-digi-muted" style={mf}>Enviar por correo</span>
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setShowCompleteModal(false)} className="pixel-btn pixel-btn-secondary text-sm" style={pf}>Cancelar</button>
                        <button onClick={() => handleComplete(true)} disabled={completing} className="pixel-btn pixel-btn-secondary text-sm disabled:opacity-50" style={pf}>
                          Completar sin Facturar
                        </button>
                        <button onClick={() => handleComplete(false)} disabled={!isFormValid} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50" style={pf}>
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

          {ptab === 'resumen' && (<>
          {/* Withdrawal Requests */}
          {projectRequests.length > 0 && (
            <div className="pixel-card">
              <h3 className="text-[12px] font-semibold text-digi-text mb-3" style={pf}>Solicitudes</h3>
              <div className="space-y-2">
                {projectRequests.map((r: any) => (
                  <div key={r.id} className="p-2 border border-digi-border bg-digi-darker">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {r.photo_url ? (
                          <img src={r.photo_url} alt={r.member_name} className="w-4 h-4 rounded-full object-cover border border-digi-border" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-accent-light border border-accent/50 flex items-center justify-center">
                            <span className="text-[6px] text-accent-glow" style={pf}>{r.member_name?.charAt(0)}</span>
                          </div>
                        )}
                        <span className="text-[11px] text-digi-text" style={mf}>{r.member_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <PixelBadge variant={r.type === 'withdrawal' ? 'info' : 'warning'}>
                          {r.type === 'withdrawal' ? 'Desistimiento' : 'Salida Supervisada'}
                        </PixelBadge>
                        <PixelBadge variant={
                          r.status === 'pending' ? 'warning' : r.status === 'approved' || r.status === 'exit_no_fee' ? 'success' : r.status === 'rejected' ? 'error' : 'default'
                        }>
                          {r.status === 'pending' ? 'Pendiente' : r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : r.status === 'exit_no_fee' ? 'Sin cuota' : r.status === 'exit_with_fee' ? 'Con cuota' : r.status}
                        </PixelBadge>
                      </div>
                    </div>
                    <p className="text-[11px] text-digi-muted" style={mf}>{r.reason}</p>
                    {r.status === 'pending' && r.type === 'withdrawal' && isOwner && (
                      <div className="flex gap-1 mt-1.5">
                        <button onClick={() => reviewRequest(r.id, 'approved')} className="text-[11px] text-green-600 border border-green-300 px-2 py-0.5 hover:bg-green-50 transition-colors" style={pf}>Aprobar</button>
                        <button onClick={() => reviewRequest(r.id, 'rejected')} className="text-[11px] text-red-600 border border-red-300 px-2 py-0.5 hover:bg-red-50 transition-colors" style={pf}>Rechazar</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Participant Progress */}
          {['in_progress', 'review', 'completed'].includes(project.status) && (() => {
            const reqs = project.requirements || [];
            // Build per-member progress
            const memberMap: Record<string, { name: string; photo_url: string; total: number; completed: number }> = {};
            for (const req of reqs) {
              const assignments = req.assignments || [];
              for (const a of assignments) {
                if (a.status !== 'accepted') continue;
                if (!memberMap[a.member_id]) memberMap[a.member_id] = { name: a.member_name, photo_url: a.photo_url, total: 0, completed: 0 };
                memberMap[a.member_id].total++;
                if (req.is_completed || req.completed_at) memberMap[a.member_id].completed++;
              }
            }
            const members = Object.values(memberMap);
            if (members.length === 0) return null;
            return (
              <div className="pixel-card">
                <h3 className="text-[12px] font-semibold text-digi-text mb-3" style={pf}>Progreso del Equipo</h3>
                <div className="space-y-2">
                  {members.map((m, i) => {
                    const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-2">
                        {m.photo_url ? (
                          <img src={m.photo_url} alt={m.name} className="w-6 h-6 rounded-full object-cover border border-digi-border shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-accent-light border border-accent/50 flex items-center justify-center shrink-0">
                            <span className="text-[11px] text-accent" style={pf}>{m.name?.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[11px] text-digi-text truncate" style={mf}>{m.name}</span>
                            <span className="text-[11px] text-digi-muted shrink-0" style={mf}>{m.completed}/{m.total} ({pct}%)</span>
                          </div>
                          <div className="h-1.5 bg-digi-darker border border-digi-border overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
          </>)}

          {ptab === 'imagenes' && (<>
          {/* Project Images */}
          {showImages && (
            <div className="pixel-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-semibold text-digi-text" style={pf}>Imagenes del Proyecto ({projectImages.length}/30)</h3>
                {canEditImages && projectImages.length < 30 && (
                  <label className="text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors cursor-pointer" style={pf}>
                    {uploadingImages ? 'Subiendo...' : '+ Subir'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={uploadingImages}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {projectImages.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[11px] text-digi-muted" style={mf}>Sin imagenes aun</p>
                  {canEditImages && (
                    <label className="inline-block mt-2 px-3 py-1.5 text-[12px] text-accent border border-accent/40 hover:bg-accent/10 transition-colors cursor-pointer" style={pf}>
                      {uploadingImages ? 'Subiendo...' : 'Subir primera imagen'}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageUpload}
                        disabled={uploadingImages}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {projectImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square border border-digi-border/50 overflow-hidden bg-digi-darker">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={`Imagen ${idx + 1}`}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => setPreviewImage(img)}
                      />
                      {canEditImages && (
                        <button
                          onClick={() => handleImageDelete(idx)}
                          disabled={deletingImageIdx === idx}
                          className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded bg-red-600/90 text-white text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                          style={pf}
                          title="Eliminar imagen"
                        >
                          {deletingImageIdx === idx ? '...' : 'x'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          </>)}

          {/* Image Preview Modal (always rendered) */}
          {previewImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
              onClick={() => setPreviewImage(null)}
            >
              <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-3 -right-3 w-7 h-7 flex items-center justify-center bg-digi-card border-2 border-digi-border text-digi-muted hover:text-digi-text transition-colors z-10"
                  style={pf}
                >
                  X
                </button>
                {/* Navigation buttons */}
                {projectImages.length > 1 && (() => {
                  const currentIdx = projectImages.indexOf(previewImage);
                  return (
                    <>
                      {currentIdx > 0 && (
                        <button
                          onClick={() => setPreviewImage(projectImages[currentIdx - 1])}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-card/80 border border-digi-border text-digi-muted hover:text-digi-text transition-colors z-10"
                          style={pf}
                        >
                          &lt;
                        </button>
                      )}
                      {currentIdx < projectImages.length - 1 && (
                        <button
                          onClick={() => setPreviewImage(projectImages[currentIdx + 1])}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-digi-card/80 border border-digi-border text-digi-muted hover:text-digi-text transition-colors z-10"
                          style={pf}
                        >
                          &gt;
                        </button>
                      )}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-digi-card/80 border border-digi-border text-[11px] text-digi-muted z-10" style={mf}>
                        {currentIdx + 1} / {projectImages.length}
                      </div>
                    </>
                  );
                })()}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewImage}
                  alt="Preview"
                  className="max-w-[90vw] max-h-[90vh] object-contain border-2 border-digi-border"
                />
              </div>
            </div>
          )}

          {ptab === 'resumen' && (<>
          {/* Actions */}
          {(isOwner || isMember) && (
            <div className="pixel-card">
              <h3 className="text-[12px] font-semibold text-digi-text mb-3" style={pf}>Acciones</h3>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                {/* Participant: Desistir / Salida Supervisada */}
                {isMember && !isOwner && ['open', 'in_progress'].includes(project.status) && (() => {
                  const myReqs = projectRequests.filter((r: any) => String(r.member_id) === String(memberId));
                  const hasRejectedWithdrawal = myReqs.some((r: any) => r.type === 'withdrawal' && r.status === 'rejected');
                  const hasPendingWithdrawal = myReqs.some((r: any) => r.type === 'withdrawal' && r.status === 'pending');
                  const hasPendingSupervisedExit = myReqs.some((r: any) => r.type === 'supervised_exit' && r.status === 'pending');
                  return (
                    <>
                      {!hasPendingWithdrawal && !hasRejectedWithdrawal && (
                        <button onClick={() => { setWithdrawType('withdrawal'); setWithdrawReason(''); setShowWithdrawModal(true); }}
                          className="py-1.5 px-3 text-[11px] text-amber-700 border border-amber-300 hover:bg-amber-50 transition-colors" style={pf}>
                          Desistir
                        </button>
                      )}
                      {hasRejectedWithdrawal && !hasPendingSupervisedExit && (
                        <button onClick={() => { setWithdrawType('supervised_exit'); setWithdrawReason(''); setShowWithdrawModal(true); }}
                          className="py-1.5 px-3 text-[11px] text-red-600 border border-red-300 hover:bg-red-50 transition-colors" style={pf}>
                          Salida con Supervision
                        </button>
                      )}
                    </>
                  );
                })()}
                </div>
                <p className="text-[11px] text-digi-muted leading-relaxed" style={mf}>
                  {project.status === 'draft' && 'Publicar hara visible este proyecto para que miembros puedan postularse y trabajar en el.'}
                  {project.status === 'open' && 'Iniciar cambia el estado a En Progreso, indicando que el equipo ya esta trabajando activamente.'}
                  {project.status === 'in_progress' && 'Enviar a Revision notifica al administrador que el trabajo esta listo para ser evaluado. Todos los requerimientos deben estar completados al 100%.'}
                  {project.status === 'review' && isAdmin && 'Completar finaliza el proyecto, genera la factura y lo publica en el marketplace.'}
                  {project.status === 'completed' && 'Este proyecto ha sido completado exitosamente.'}
                  {project.status === 'cancelled' && 'Este proyecto fue cancelado.'}
                </p>
                {project.status === 'completed' && isOwner && !project.marketplace_source_id && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/projects/${id}/publish`, {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ publish: !project.is_marketplace_published }),
                        });
                        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                        toast.success(project.is_marketplace_published ? 'Despublicado del marketplace' : 'Publicado en el marketplace');
                        fetchProject();
                      } catch (e: any) { toast.error(e.message || 'Error'); }
                    }}
                    className={`pixel-btn text-sm ${project.is_marketplace_published ? 'border border-amber-300 text-amber-700 hover:bg-amber-50' : 'pixel-btn-primary'}`}
                  >
                    {project.is_marketplace_published ? 'Despublicar Marketplace' : 'Publicar en Marketplace'}
                  </button>
                )}
              </div>
            </div>
          )}
          </>)}
          {ptab === 'digimundo' && (<>
          {isAdmin && (
            <div className="pixel-card" style={{ borderColor: project.digimundo_project_id ? 'var(--color-accent)' : undefined }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-semibold text-digi-text" style={pf}>DigiMundo</h3>
                {project.digimundo_project_id && chat.citizen && (
                  <div className="flex items-center gap-1.5">
                    <TaskQueueIndicator count={chat.pendingQueue.length} items={chat.pendingQueue.map(q => ({ id: q.id, title: q.title }))} isProcessing={chat.isProcessing} />
                    {!chat.chatOpen && (
                      <button onClick={() => { chat.setChatOpen(true); chat.setChatMinimized(false); }} className="px-2 py-1 text-[11px] text-accent border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>Chat</button>
                    )}
                  </div>
                )}
              </div>
              <select value={project.digimundo_project_id || ''} onChange={(e) => linkDigimundo(e.target.value)} disabled={linking}
                className="w-full px-2 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer disabled:opacity-50 mb-2"
                style={{ ...mf, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}>
                <option value="">Sin vincular</option>
                {digiProjects.map((dp: any) => <option key={dp.id} value={dp.id}>{dp.name}</option>)}
              </select>
              {linkedDigiName && <p className="text-[11px] text-green-600" style={pf}>Vinculado a: {linkedDigiName}</p>}
            </div>
          )}

          {/* Proforma */}
          {project.digimundo_project_id && (project.has_proforma || chat.isLocalhost) && (
            <div className="pixel-card" style={{ borderColor: project.has_proforma ? 'var(--color-accent)' : undefined }}>
              <h3 className="text-[12px] font-semibold text-digi-text mb-3" style={pf}>Proforma</h3>
              {project.has_proforma ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-green-600" style={pf}>Proforma guardada</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => window.open(`/api/projects/${id}/proforma?format=pdf`, '_blank')}
                      className="flex-1 px-2 py-1.5 text-[11px] text-green-600 border border-green-700/50 hover:bg-green-50 transition-colors" style={pf}>
                      PDF
                    </button>
                    {chat.isLocalhost && (
                      <button onClick={openProformaChat}
                        className="flex-1 px-2 py-1.5 text-[11px] text-accent border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>
                        Editar / Actualizar
                      </button>
                    )}
                    <ProformaTokenButton projectId={id as string}
                      className="flex-1 px-2 py-1.5 text-[11px] text-purple-400 border border-purple-500/40 hover:bg-purple-900/20 transition-colors" />
                  </div>
                </div>
              ) : chat.isLocalhost ? (
                <div className="space-y-2">
                  <p className="text-[11px] text-digi-muted" style={mf}>Genera una proforma profesional con asistencia de IA.</p>
                  <button onClick={openProformaChat}
                    className="w-full px-2 py-2 text-[12px] text-accent border border-accent/40 hover:bg-accent/10 transition-colors" style={pf}>
                    Generar Proforma
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Content (Script + Video) - Completed projects, admin */}
          {isAdmin && project.status === 'completed' && project.digimundo_project_id && (
            <div className="pixel-card" style={{ borderColor: (videoScript || videoUrl) ? 'var(--color-accent)' : undefined }}>
              <h3 className="text-[12px] font-semibold text-digi-text mb-3" style={pf}>Contenido</h3>
              <div className="space-y-2">
                {/* Script */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-digi-muted" style={mf}>Guion</span>
                  <div className="flex gap-1">
                    {videoScript && (
                      <button
                        onClick={() => {
                          const blob = new Blob([videoScript], { type: 'text/plain' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = `guion-${project.title.replace(/\s+/g, '-').toLowerCase()}.txt`;
                          a.click(); URL.revokeObjectURL(url);
                        }}
                        className="px-2 py-0.5 text-[11px] text-green-600 border border-green-700/50 hover:bg-green-50 transition-colors"
                        style={pf}
                      >
                        Descargar
                      </button>
                    )}
                    {chat.isLocalhost && (
                      <button
                        onClick={openScriptPanel}
                        className="text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors"
                        style={pf}
                      >
                        {videoScript ? 'Regenerar' : 'Generar Guion'}
                      </button>
                    )}
                  </div>
                </div>
                {videoScript && (
                  <div className="max-h-32 overflow-y-auto px-2 py-1.5 border border-digi-border/30 bg-digi-darker">
                    <p className="text-[11px] text-digi-text whitespace-pre-wrap" style={mf}>{videoScript.slice(0, 500)}{videoScript.length > 500 ? '...' : ''}</p>
                  </div>
                )}

                {/* Storyboard */}
                {videoScript && projectImages.length > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-digi-border/30">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-digi-muted" style={mf}>Storyboard</span>
                      {storyboard && (
                        <span className="text-[11px] text-accent/60" style={mf}>
                          ({storyboard.filter(s => s.imageIndex !== null).length}/{storyboard.length} asignados)
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowStoryboard(true)}
                      className="px-2 py-0.5 text-[11px] text-purple-400 border border-purple-500/40 hover:bg-purple-900/20 transition-colors"
                      style={pf}
                    >
                      {storyboard ? 'Editar' : 'Configurar'}
                    </button>
                  </div>
                )}

                {/* Video */}
                <div className="flex items-center justify-between pt-2 border-t border-digi-border/30">
                  <span className="text-[11px] text-digi-muted" style={mf}>Video</span>
                  <div className="flex gap-1">
                    {videoUrl && (
                      <button
                        onClick={() => window.open(`/api/projects/${id}/video?download=true`, '_blank')}
                        className="px-2 py-0.5 text-[11px] text-green-600 border border-green-700/50 hover:bg-green-50 transition-colors"
                        style={pf}
                      >
                        Descargar
                      </button>
                    )}
                    {chat.isLocalhost && videoScript && (
                      <button
                        onClick={handleGenerateVideo}
                        disabled={generatingVideo || projectImages.length === 0}
                        className="text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors disabled:opacity-40"
                        style={pf}
                      >
                        {generatingVideo ? videoStep || 'Generando...' : videoUrl ? 'Regenerar Video' : 'Generar Video'}
                      </button>
                    )}
                  </div>
                </div>
                {!videoScript && !chat.isLocalhost && (
                  <p className="text-[11px] text-digi-muted text-center py-2" style={mf}>Sin contenido generado aun</p>
                )}
                {chat.isLocalhost && !videoScript && projectImages.length === 0 && (
                  <p className="text-[11px] text-amber-700/70 mt-1" style={mf}>Sube imagenes al proyecto antes de generar contenido</p>
                )}

                {/* Public Docs */}
                {chat.isLocalhost && (
                  <div className="flex items-center justify-between pt-2 border-t border-digi-border/30">
                    <span className="text-[11px] text-digi-muted" style={mf}>Docs publicas</span>
                    <div className="flex gap-1 items-center">
                      {publicDocsToken && (
                        <>
                          <span className="text-[11px] text-green-600" style={pf}>ACTIVA</span>
                          <button
                            onClick={async () => {
                              const base = process.env.NEXT_PUBLIC_BASE_URL || 'https://app.grupocc.org';
                              const url = `${base}/docs/${publicDocsToken}`;
                              try { await navigator.clipboard.writeText(url); toast.success('Enlace copiado'); }
                              catch { toast.error('No se pudo copiar'); }
                            }}
                            className="px-2 py-0.5 text-[11px] text-purple-400 border border-purple-500/40 hover:bg-purple-900/20 transition-colors"
                            style={pf}
                          >
                            Copiar
                          </button>
                        </>
                      )}
                      <button
                        onClick={openPublicDocsPanel}
                        className="text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors"
                        style={pf}
                      >
                        {publicDocsToken ? 'Gestionar' : 'Generar'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Social Copy */}
                {chat.isLocalhost && (
                  <div className="flex items-center justify-between pt-2 border-t border-digi-border/30">
                    <span className="text-[11px] text-digi-muted" style={mf}>Redes sociales</span>
                    <div className="flex gap-1 items-center">
                      {hasSocialCopy && <span className="text-[11px] text-green-600" style={pf}>LISTO</span>}
                      <button
                        onClick={openSocialCopyPanel}
                        className="text-[11px] text-accent border border-accent/40 rounded px-2 py-0.5 hover:bg-accent-light transition-colors"
                        style={pf}
                      >
                        {hasSocialCopy ? 'Ver / Regenerar' : 'Generar Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
                  <h3 className="text-[12px] font-semibold text-digi-text mb-2" style={pf}>Incidencias ({incidents.length})</h3>
                  <div className="flex gap-1 flex-wrap mb-3">
                    {['all', 'pending', 'proposal', 'approved', 'reviewing', 'completed', 'rejected'].map(s => (
                      <button key={s} onClick={() => setIncidentFilter(s)}
                        className={`px-1.5 py-0.5 text-[11px] border transition-colors ${incidentFilter === s ? 'border-accent text-accent-glow bg-accent/10' : 'border-digi-border/50 text-digi-muted hover:text-digi-text'}`} style={pf}>
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
                            <span className="text-[11px] text-digi-muted" style={mf}>{inc.clientName} &middot; {new Date(inc.createdAt).toLocaleDateString()}</span>
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
          </>)}
        </div>

        {/* ====== RIGHT (Propiedades + DigiMundo) ====== */}
        <div className="w-full lg:w-[320px] shrink-0 space-y-4">
          {/* Propiedades */}
          <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm lg:sticky lg:top-4">
            <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3" style={pf}>Propiedades</h3>
            <dl className="space-y-2.5 text-[12px]" style={mf}>
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Cliente</dt><dd className="text-digi-text text-right break-words min-w-0">{project.client_name || '-'}</dd></div>
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Miembro</dt><dd className="text-digi-text text-right break-words min-w-0">{project.assigned_member_name || '-'}</dd></div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-digi-muted shrink-0">Presupuesto</dt>
                <dd className="text-right min-w-0">
                  {editingBudget ? (
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <input value={editBudgetMin} onChange={(e) => setEditBudgetMin(e.target.value)} type="number" placeholder="Min" className="w-16 px-1 py-0.5 bg-digi-darker border border-accent text-[11px] text-digi-text focus:outline-none text-right" style={mf} />
                      <span className="text-digi-muted">-</span>
                      <input value={editBudgetMax} onChange={(e) => setEditBudgetMax(e.target.value)} type="number" placeholder="Max" className="w-16 px-1 py-0.5 bg-digi-darker border border-accent text-[11px] text-digi-text focus:outline-none text-right" style={mf} />
                      <button onClick={saveBudget} className="text-[11px] text-green-600 border border-green-300 px-1 hover:bg-green-50" style={pf}>OK</button>
                      <button onClick={() => setEditingBudget(false)} className="text-[11px] text-digi-muted border border-digi-border px-1" style={pf}>X</button>
                    </div>
                  ) : (
                    <span className={`text-digi-text ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent' : ''}`} onClick={() => { if (isOwner && !isTerminal) { setEditBudgetMin(project.budget_min || ''); setEditBudgetMax(project.budget_max || ''); setEditingBudget(true); } }}>{project.budget_min ? `$${project.budget_min}${project.budget_max ? ` - $${project.budget_max}` : ''}` : '-'}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Costo final</dt><dd className="text-digi-text text-right">{totalAcceptedCost > 0 ? `$${fmt2(totalAcceptedCost)}` : '$0.00'}</dd></div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-digi-muted shrink-0">Límite</dt>
                <dd className="text-right min-w-0">
                  {editingDeadline ? (
                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <input value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} type="date" className="px-1 py-0.5 bg-digi-darker border border-accent text-[11px] text-digi-text focus:outline-none" style={mf} />
                      <button onClick={saveDeadline} className="text-[11px] text-green-600 border border-green-300 px-1 hover:bg-green-50" style={pf}>OK</button>
                      <button onClick={() => setEditingDeadline(false)} className="text-[11px] text-digi-muted border border-digi-border px-1" style={pf}>X</button>
                    </div>
                  ) : (
                    <span className={`text-digi-text ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent' : ''}`} onClick={() => { if (isOwner && !isTerminal) { setEditDeadline(project.deadline?.split('T')[0] || ''); setEditingDeadline(true); } }}>{project.deadline ? new Date(project.deadline).toLocaleDateString() : '-'}</span>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-digi-muted shrink-0">Visibilidad</dt>
                <dd className="text-right flex items-center gap-2 justify-end flex-wrap">
                  <span className="text-digi-text">{project.is_private ? 'Privado' : 'Público'}</span>
                  {isOwner && !isTerminal && hasReqs && (
                    <button onClick={async () => { await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_private: !project.is_private }) }); toast.success(project.is_private ? 'Proyecto ahora es publico' : 'Proyecto ahora es privado'); fetchProject(); }} className="text-[11px] text-accent border border-accent/30 px-1.5 py-0.5 hover:bg-accent/10 transition-colors" style={pf}>{project.is_private ? 'Hacer público' : 'Hacer privado'}</button>
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Creado</dt><dd className="text-digi-text text-right">{new Date(project.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>

        </div>
      </div>

      {/* Subtasks Modal (centered) */}
      <PixelModal open={subtaskReqId != null} onClose={() => setSubtaskReqId(null)} title="Subtareas" size="sm">
        {(() => {
          const r = reqs.find((x: any) => x.id === subtaskReqId);
          if (!r) return null;
          const items = r.items || [];
          const canEditThis = canMemberEditReq(r.id);
          return (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Requerimiento</p>
                <p className="text-sm font-medium text-digi-text mt-0.5" style={mf}>{r.title}</p>
                {r.description && <p className="text-xs text-digi-muted mt-1" style={mf}>{r.description}</p>}
              </div>
              <div className="space-y-1">
                {items.length > 0 ? items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-2.5 group px-2 py-1.5 rounded hover:bg-[#f3f2f1]">
                    <button onClick={() => canEditThis && toggleSubItem(item.id, !item.is_completed)} disabled={!canEditThis} aria-label={item.is_completed ? 'Marcar incompleto' : 'Marcar completo'} className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${item.is_completed ? 'bg-accent border-accent text-white' : 'border-digi-border bg-white'} ${canEditThis ? 'cursor-pointer hover:border-accent' : ''}`}>
                      {item.is_completed && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                    <span className={`text-[13px] flex-1 ${item.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{item.title}</span>
                    {canEditThis && (
                      <button onClick={() => deleteSubItem(item.id)} aria-label="Eliminar subtarea" className="text-digi-muted/60 hover:text-red-600 transition-colors text-[16px] leading-none px-1 shrink-0">×</button>
                    )}
                  </div>
                )) : (
                  <p className="text-xs text-digi-muted py-2" style={mf}>Sin subtareas aún.</p>
                )}
              </div>
              {canEditThis && (
                <div className="flex gap-2 items-center border-t border-digi-border pt-3">
                  <input
                    value={newItemText[r.id] || ''}
                    onChange={(e) => setNewItemText(prev => ({ ...prev, [r.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubItem(r.id); } }}
                    placeholder="Nueva subtarea..."
                    autoFocus
                    className="field-control flex-1 px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                    style={mf}
                  />
                  <button onClick={() => addSubItem(r.id)} disabled={!(newItemText[r.id] || '').trim()} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50 shrink-0">Agregar</button>
                </div>
              )}
            </div>
          );
        })()}
      </PixelModal>

      {/* Add Requirement Modal */}
      {/* Withdraw/Exit Modal */}
      <PixelModal open={showWithdrawModal} onClose={() => !submittingWithdraw && setShowWithdrawModal(false)}
        title={withdrawType === 'withdrawal' ? 'Solicitar Desistimiento' : 'Salida con Supervision'}>
        <div className="space-y-3">
          <p className="text-[10px] text-digi-muted" style={mf}>
            {withdrawType === 'withdrawal'
              ? 'Tu solicitud sera enviada al creador del proyecto para su aprobacion.'
              : 'Tu solicitud sera enviada al administrador. Puede implicar una cuota por perjuicio.'}
          </p>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Motivo *</label>
            <textarea value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} rows={3} placeholder="Describe el motivo de tu solicitud..."
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <button onClick={submitWithdrawRequest} disabled={submittingWithdraw || !withdrawReason.trim()}
            className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {submittingWithdraw ? 'Enviando...' : 'Enviar Solicitud'}
          </button>
        </div>
      </PixelModal>

      {/* Agregar participante (responsable/admin) */}
      <PixelModal open={showAddParticipant} onClose={() => setShowAddParticipant(false)} title="Agregar participante" size="md">
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted" style={mf}>Elige un miembro para sumarlo como participante del proyecto.</p>
          <AssigneePicker value={newParticipantId} onChange={setNewParticipantId} />
          <button onClick={() => addParticipant(newParticipantId)} disabled={!newParticipantId} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            Agregar participante
          </button>
        </div>
      </PixelModal>

      <PixelModal open={showReqModal} onClose={() => setShowReqModal(false)} title="Nuevo Requerimiento">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Titulo</label>
            <input value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} placeholder="Titulo del requerimiento"
              className="w-full px-3 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Descripcion</label>
            <textarea value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} rows={3} placeholder="Descripcion detallada..."
              className="w-full px-3 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Costo ($)</label>
            <input value={reqCost} onChange={(e) => setReqCost(e.target.value)} type="number" placeholder="0.00 (opcional)"
              className="w-full px-3 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
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
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Miembro</label>
            <select
              value={assignMemberId}
              onChange={(e) => handleAssignMemberChange(e.target.value)}
              className="w-full px-2 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
              style={{ ...mf, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237B5FBF' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', paddingRight: '28px' }}
            >
              <option value="">Seleccionar miembro...</option>
              {bids.filter((b: any) => b.status === 'accepted').map((b: any) => (
                <option key={b.member_id} value={b.member_id}>{b.member_name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Costo Propuesto ($)</label>
            <input
              value={assignCost}
              onChange={(e) => setAssignCost(e.target.value)}
              type="number"
              placeholder="0.00"
              className="w-full px-3 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>
          <button onClick={submitAssignment} disabled={savingAssign || !assignMemberId || !assignCost} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {savingAssign ? '...' : 'Asignar'}
          </button>
        </div>
      </PixelModal>

      {/* Proforma Chat */}
      {showProformaChat && proformaAgentConfig && (
        <ProformaChatPanel
          projectId={id as string}
          agentId={proformaAgentConfig.agentId}
          agentName={proformaAgentConfig.agentName}
          projectPath={proformaAgentConfig.projectPath}
          clientName={project.client_name}
          clientEmail={project.client_email}
          clientPhone={project.client_phone}
          projectTitle={project.title}
          hasProforma={!!project.has_proforma}
          onClose={() => setShowProformaChat(false)}
          onSaved={() => { setShowProformaChat(false); fetchProject(); }}
        />
      )}

      {/* Video Script Panel */}
      {showScriptPanel && scriptAgentConfig && (
        <VideoScriptPanel
          projectId={id as string}
          agentId={scriptAgentConfig.agentId}
          agentName={scriptAgentConfig.agentName}
          projectPath={scriptAgentConfig.projectPath}
          projectTitle={project.title}
          projectDescription={project.description}
          projectImages={projectImages}
          existingScript={videoScript}
          onClose={() => setShowScriptPanel(false)}
          onSaved={(script: string) => { setVideoScript(script); setShowScriptPanel(false); fetchContent(); }}
        />
      )}

      {/* Social Copy Panel */}
      {showSocialCopy && scriptAgentConfig && (
        <SocialCopyPanel
          projectId={id as string}
          agentId={scriptAgentConfig.agentId}
          agentName={scriptAgentConfig.agentName}
          projectPath={scriptAgentConfig.projectPath}
          projectTitle={project.title}
          projectDescription={project.description}
          handles={{
            youtube: user?.youtube_handle,
            tiktok: user?.tiktok_handle,
            instagram: user?.instagram_handle,
            facebook: user?.facebook_handle,
          }}
          onClose={() => { setShowSocialCopy(false); fetchSocialCopy(); }}
        />
      )}

      {/* Public Docs Panel */}
      {showPublicDocs && scriptAgentConfig && (
        <PublicDocsPanel
          projectId={id as string}
          agentId={scriptAgentConfig.agentId}
          agentName={scriptAgentConfig.agentName}
          projectPath={scriptAgentConfig.projectPath}
          projectTitle={project.title}
          projectDescription={project.description}
          projectImages={projectImages}
          onClose={() => setShowPublicDocs(false)}
          onSaved={(token: string) => { setPublicDocsToken(token); }}
        />
      )}

      {/* Storyboard Editor */}
      {showStoryboard && videoScript && (
        <ScriptStoryboardEditor
          projectId={id as string}
          script={videoScript}
          projectImages={projectImages}
          existingStoryboard={storyboard}
          onClose={() => setShowStoryboard(false)}
          onSaved={(sb) => { setStoryboard(sb); setShowStoryboard(false); }}
        />
      )}

      {/* Floating Chat */}
      {chat.chatOpen && chat.citizen && (
        <FloatingChatWindow
          citizen={chat.citizen} blocks={chat.blocks} onBlocksChange={chat.onBlocksChange}
          externalMessage={chat.externalMessage} onExternalMessageConsumed={chat.onExternalMessageConsumed}
          onClose={() => chat.setChatOpen(false)} minimized={chat.chatMinimized}
          onMinimize={() => chat.setChatMinimized(true)} onRestore={() => chat.setChatMinimized(false)}
          queueCount={chat.pendingQueue.length} isLocalhost={chat.isLocalhost}
          projectName={linkedDigiName} isStreaming={chat.isStreaming} justCompleted={chat.justCompleted}
          sessionKey={`project-${id}`}
        />
      )}

      <PixelConfirm
        open={confirmDeleteProject}
        title="Eliminar proyecto"
        message="¿Estás seguro de eliminar este proyecto? Esta acción no se puede deshacer."
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={async () => {
          setConfirmDeleteProject(false);
          try {
            const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
            toast.success('Proyecto eliminado');
            window.location.href = '/dashboard/projects';
          } catch (e: any) { toast.error(e.message || 'Error al eliminar'); }
        }}
        onCancel={() => setConfirmDeleteProject(false)}
      />
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
