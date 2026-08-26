'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import Link from 'next/link';
import DetailHeader, { HeaderChip } from '@/components/ui/DetailHeader';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import ClientPicker from '@/components/clients/ClientPicker';
import PropertyRail from '@/components/ui/PropertyRail';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import { EditPanel, QuickEditDialog, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import AssigneePicker from '@/components/tickets/AssigneePicker';
import { Check, DoorOpen, Play, Send, Receipt, LayoutList, ListChecks, Boxes, Image as ImageIcon, Plus, X, UserPlus, ListPlus, Crown, Users, Trash2, Sparkles, Share2, ChevronDown, BarChart3, Pencil } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BotonAyuda from '@/components/ui/BotonAyuda';
import BrandLoader from '@/components/ui/BrandLoader';
import IncidentsTab from '@/components/projects/IncidentsTab';
import GccBotChat from '@/components/cotizaciones/GccBotChat';
import QuoteShareButton from '@/components/cotizaciones/QuoteShareButton';
import AdditionalCostsCard from '@/components/cotizaciones/AdditionalCostsCard';
import CobrosEnEspera from '@/components/pagos/CobrosEnEspera';
import { fmt2 } from '@/lib/format';

// Dashboard es Fluent (.corp): --font-display y --font-body resuelven a Segoe UI.
const pf = { fontFamily: 'var(--font-body)' } as const;
const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  cotizacion: 'info', draft: 'default', open: 'info', in_progress: 'warning', review: 'warning',
  completed: 'success', closed: 'success', cancelled: 'error', on_hold: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  cotizacion: 'Cotización', draft: 'Borrador', open: 'Abierto', in_progress: 'En progreso', review: 'En revisión',
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
  const router = useRouter();
  const { user } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [payments, setPayments] = useState<any>(null);
  // Rail derecho como pestañas: Propiedades (default) / Observaciones (cotización).
  const [rightTab, setRightTab] = useState<'propiedades' | 'incidentes'>('propiedades');
  const [showShare, setShowShare] = useState(false);
  // Paneles de acceso rápido desde el header (Progreso / Imágenes).
  const [showProgresoModal, setShowProgresoModal] = useState(false);
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [incidentFilter, setIncidentFilter] = useState('all');

  // Project images states
  const [projectImages, setProjectImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [deletingImageIdx, setDeletingImageIdx] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Content (video script + video) states
  const [videoScript, setVideoScript] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoStep, setVideoStep] = useState('');
  const [showStoryboard, setShowStoryboard] = useState(false);
  const [storyboard, setStoryboard] = useState<any[] | null>(null);
  const [publicDocsToken, setPublicDocsToken] = useState<string | null>(null);
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
  // Talentos y plazas del requerimiento. El catálogo sale de la LISTA GLOBAL viva
  // (Admin ▸ Listas), no de una copia estática, para que refleje lo que hay hoy.
  const [reqTalents, setReqTalents] = useState<string[]>([]);
  const [reqSlots, setReqSlots] = useState('1');
  const [talentOptions, setTalentOptions] = useState<{ value: string; label: string }[]>([]);
  const [savingReq, setSavingReq] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<number, string>>({});
  const [subtaskReqId, setSubtaskReqId] = useState<number | null>(null);
  // Requerimientos desplegados (por defecto TODOS contraídos).
  const [expandedReqs, setExpandedReqs] = useState<Set<number>>(new Set());
  const toggleReqExpand = (rid: number) => setExpandedReqs((s) => { const n = new Set(s); n.has(rid) ? n.delete(rid) : n.add(rid); return n; });

  // Edición: SIEMPRE en panel derecho (formularios) o ventanita centrada (1-2 campos).
  // Nunca inline "por encima" del contenido (regla del sistema, ver Diseño.md).
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [savingDesc, setSavingDesc] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [editClient, setEditClient] = useState<{ clientId: string; clientEmail: string }>({ clientId: '', clientEmail: '' });
  const [editingBudget, setEditingBudget] = useState(false);
  const [editBudgetMin, setEditBudgetMin] = useState('');
  const [editBudgetMax, setEditBudgetMax] = useState('');
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [editDeadline, setEditDeadline] = useState('');
  // Edición de requerimientos (panel derecho) y de subtareas (ventanita centrada).
  const [editingReqId, setEditingReqId] = useState<number | null>(null);
  const [editReqData, setEditReqData] = useState<{ title: string; description: string; cost: string; talents: string[]; slots: string }>({ title: '', description: '', cost: '', talents: [], slots: '1' });
  const [savingReqEdit, setSavingReqEdit] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [savingItemEdit, setSavingItemEdit] = useState(false);
  const [savingClient, setSavingClient] = useState(false);

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
  // Facturación POR ETAPAS: se factura al entregar cada fase, no al cobrar
  // (LRTI art. 61; Rgto. Comprobantes art. 17 lit. e). `billing` trae las etapas
  // del proyecto con su importe y si ya tienen factura; aquí se eligen las que
  // entran en esta factura.
  const [billing, setBilling] = useState<any>(null);
  const [selectedStages, setSelectedStages] = useState<number[]>([]);
  // Plan de etapas: el acuerdo con el cliente («50% al empezar, 50% al entregar»).
  // No son los requerimientos, que son el trabajo interno.
  const [showStagesPanel, setShowStagesPanel] = useState(false);
  const [planDraft, setPlanDraft] = useState<{ id: number | null; name: string; amount: string; invoiceNumber: string | null }[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  // ENLACE DE PAGO (canal 3): el responsable comparte un enlace de UNA etapa, con la
  // caducidad que él elige, y sale un correo al cliente. Ver `lib/pagos/`.
  const [linkStage, setLinkStage] = useState<{ id: number; name: string; amount: number } | null>(null);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkHoras, setLinkHoras] = useState('72');
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkResult, setLinkResult] = useState<{ url: string; email: string; total: number; correoEnviado: boolean } | null>(null);
  const [completeAdditionalFields, setCompleteAdditionalFields] = useState<{ name: string; value: string }[]>([]);
  const [completeSendEmail, setCompleteSendEmail] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [completeStep, setCompleteStep] = useState('');
  const [completeCurrency, setCompleteCurrency] = useState('USD');
  const [completeExchangeRate, setCompleteExchangeRate] = useState('1');
  const [currencies, setCurrencies] = useState<{ code: string; symbol: string; name: string; rate: number }[]>([]);

  const isAdmin = user?.role === 'admin';
  // El cliente no ve el plan de etapas del admin (que es editable): ve SU lista, con el
  // botón de pagar en la que le toca. Es el canal 2 de la pasarela.
  const esCliente = user?.role === 'client';
  const isMember = user?.role === 'member';
  const memberId = user?.member_id;
  const isMemberCreator = isMember && memberId && project?.assigned_member_id == memberId;
  const isOwner = isAdmin || isMemberCreator;
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [newParticipantId, setNewParticipantId] = useState('');
  // Modales "Ver más" del panel izquierdo (equipo / propuestas completas).
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showProposalsModal, setShowProposalsModal] = useState(false);
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

  const takeByTalent = async () => {
    try {
      const res = await fetch(`/api/projects/${id}/take`, { method: 'POST' });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success('Te hiciste responsable del proyecto');
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
  const acceptBid = async (bidId: number) => {
    try {
      await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: bidId, status: 'accepted' }) });
      fetchProject(); toast.success('Propuesta aceptada');
    } catch { toast.error('Error'); }
  };
  const rejectBid = async (bidId: number) => {
    try {
      await fetch(`/api/projects/${id}/bids`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bid_id: bidId, status: 'rejected' }) });
      fetchProject();
    } catch { toast.error('Error'); }
  };


  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error();
      const { data } = await res.json();
      setProject(data);
      fetch(`/api/projects/${id}/payments`).then(r => r.json()).then(d => {
        setPayments(d.data || null);
        setBilling(d.billing || null);
      }).catch(() => {});
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
    fetch('/api/exchange-rates').then(r => r.json()).then(d => setCurrencies(d.currencies || [])).catch(() => {});
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

  // --- Guardado de los campos sueltos (se editan en ventanita centrada) ---
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
  const openCompleteModal = async () => {
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
    // Fase 2: si el cliente ya tiene cuenta de facturación, se prellena desde ahí (editable).
    if (project?.client_id) {
      try {
        const r = await fetch(`/api/billing-clients?portal_client_id=${project.client_id}`);
        const { data: bc } = await r.json();
        if (bc) {
          setCompleteIdType(bc.id_type || '07');
          setCompleteClientRuc(bc.ruc || '9999999999999');
          setCompleteClientName(bc.name || 'CONSUMIDOR FINAL');
          setCompleteClientEmail(bc.email || '');
          setCompleteClientPhone(bc.phone || '');
          setCompleteClientAddress(bc.address || '');
        }
      } catch { /* sin cuenta de facturación → se llena a mano */ }
    }
    setCompletePaymentCode('20');
    // El detalle arranca con las etapas que faltan por facturar: las que ya tienen
    // factura no vuelven a entrar (se facturaron al entregarse). Sigue siendo
    // editable, así que puedes fusionarlas en un solo concepto si lo prefieres.
    // La foto de facturación se relee AQUÍ, no se confía en el estado: puede haber
    // cambiado en otra pestaña o hace un segundo, al guardar el plan de etapas.
    let bill = billing;
    try {
      const r = await fetch(`/api/projects/${id}/payments`);
      const d = await r.json();
      if (d?.billing) { bill = d.billing; setBilling(d.billing); setPayments(d.data || null); }
    } catch { /* si falla, se usa lo que ya había */ }

    const conPlan = bill?.mode === 'etapas';
    const pendientes = conPlan
      ? (bill?.etapas || []).filter((e: any) => !e.invoiceId)
      : (bill?.stages || []).filter((e: any) => !e.invoiceId);
    setSelectedStages(pendientes.map((e: any) => e.id));
    setCompleteItems(
      pendientes.length > 0
        ? pendientes.map((e: any) => conPlan ? etapaToItem(e) : stageToItem(e))
        : [{ description: `Servicios: ${project.title}`, quantity: '1', unitPrice: String(Number(project.final_cost) || 0), ivaRate: '0', discount: '0' }]
    );
    setCompleteAdditionalFields([]);
    setCompleteSendEmail(true);
    setShowCompleteModal(true);
  };

  /** Una ETAPA del plan se convierte en línea de la factura. */
  const etapaToItem = (e: any) => ({
    description: `${e.name} — ${project?.title || ''}`.trim(),
    quantity: '1',
    unitPrice: String(Number(e.amount) || 0),
    ivaRate: '0',
    discount: '0',
  });

  /** Un requerimiento se convierte en línea de la factura con su importe facturable. */
  const stageToItem = (e: any) => ({
    description: e.title + (e.description ? ` - ${e.description}` : ''),
    quantity: '1',
    unitPrice: String(Number(e.amount) || 0),
    ivaRate: '0',
    discount: '0',
  });

  /** Abre el panel del plan con lo que ya haya definido (o dos etapas en blanco). */
  const openStagesPanel = () => {
    const etapas = billing?.etapas || [];
    setPlanDraft(etapas.length > 0
      ? etapas.map((e: any) => ({ id: e.id, name: e.name, amount: String(e.amount), invoiceNumber: e.invoiceNumber }))
      : [{ id: null, name: 'Etapa 1', amount: '', invoiceNumber: null },
         { id: null, name: 'Etapa 2', amount: '', invoiceNumber: null }]);
    setShowStagesPanel(true);
  };

  /** La última etapa recoge el resto de la base; se recalcula en cada cambio. */
  const planBase = Number(billing?.baseTotal || 0);
  const planRestante = (() => {
    const anteriores = planDraft.slice(0, -1).reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return Math.max(0, Math.round((planBase - anteriores) * 100) / 100);
  })();

  /** Refleja el plan recién guardado sin esperar al refresco del proyecto. */
  const aplicarPlan = (etapas: any[]) => {
    setBilling((b: any) => b ? {
      ...b,
      etapas,
      mode: etapas.length > 0 ? 'etapas' : 'requerimientos',
      stagesTotal: etapas.length > 0
        ? etapas.reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
        : b.stages.reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
      invoiced: etapas.length > 0
        ? etapas.filter((e: any) => e.invoiceId).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
        : b.stages.filter((e: any) => e.invoiceId).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
      billable: etapas.length > 0
        ? etapas.filter((e: any) => !e.invoiceId).reduce((s: number, e: any) => s + Number(e.amount || 0), 0)
        : b.stages.filter((e: any) => !e.invoiceId).reduce((s: number, e: any) => s + Number(e.amount || 0), 0),
    } : b);
  };

  const savePlan = async () => {
    const limpio = planDraft.filter(e => e.name.trim());
    if (limpio.length < 2) { toast.error('Define al menos dos etapas'); return; }
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/projects/${id}/stages`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stages: limpio.map(e => ({ id: e.id, name: e.name.trim(), amount: Number(e.amount) || 0 })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el plan');
      // Se aplica ya con lo que devuelve el guardado: si se esperara al refresco, abrir
      // el modal de facturar justo después todavía ofrecía requerimientos.
      aplicarPlan(data.data || []);
      toast.success('Etapas guardadas');
      setShowStagesPanel(false);
      fetchProject();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingPlan(false); }
  };

  /**
   * Abre la ventanita de compartir el enlace de pago de una etapa.
   * El correo se prerrellena con el del cliente del proyecto, como pidió Fernando; si el
   * proyecto no tiene cliente asociado, se escribe a mano.
   */
  const abrirEnlacePago = (e: any) => {
    setLinkStage({ id: Number(e.id), name: e.name, amount: Number(e.amount) || 0 });
    setLinkEmail(project?.client_email || completeClientEmail || '');
    setLinkHoras('72');
    setLinkResult(null);
  };

  const compartirEnlacePago = async () => {
    if (!linkStage) return;
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}/payment-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: linkStage.id, email: linkEmail.trim(), horas: Number(linkHoras) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo generar el enlace');
      // El enlace se enseña SIEMPRE, aunque el correo falle: ya es válido y el responsable
      // puede copiarlo y mandarlo por donde quiera.
      setLinkResult({
        url: data.url, email: data.email,
        total: Number(data.importes?.total || 0),
        correoEnviado: Boolean(data.correoEnviado),
      });
      toast[data.correoEnviado ? 'success' : 'warning'](
        data.correoEnviado ? `Enlace enviado a ${data.email}` : 'Enlace creado, pero el correo no salió: cópialo y envíalo tú',
      );
    } catch (e: any) { toast.error(e.message); }
    finally { setLinkSaving(false); }
  };

  const borrarPlan = async () => {
    setSavingPlan(true);
    try {
      const res = await fetch(`/api/projects/${id}/stages`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stages: [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo quitar el plan');
      aplicarPlan([]);
      toast.success('Plan de etapas eliminado — el proyecto vuelve a facturarse por requerimientos');
      setShowStagesPanel(false);
      fetchProject();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingPlan(false); }
  };

  /** Marca/desmarca una etapa y rehace el detalle con las que queden elegidas. */
  const toggleStage = (stageId: number) => {
    const next = selectedStages.includes(stageId)
      ? selectedStages.filter(x => x !== stageId)
      : [...selectedStages, stageId];
    setSelectedStages(next);
    const conPlan = billing?.mode === 'etapas';
    const fuente = conPlan ? (billing?.etapas || []) : (billing?.stages || []);
    const elegidas = fuente.filter((e: any) => next.includes(e.id));
    setCompleteItems(elegidas.map((e: any) => conPlan ? etapaToItem(e) : stageToItem(e)));
  };

  const handleComplete = async (skipInvoice = false) => {
    if (!skipInvoice && completeItems.length === 0) {
      toast.error('Elige al menos una etapa para facturar');
      return;
    }
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
          requirement_ids: skipInvoice || billing?.mode === 'etapas' ? [] : selectedStages,
          stage_ids: skipInvoice || billing?.mode !== 'etapas' ? [] : selectedStages,
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


  // Catálogo de talentos: se pide una sola vez, al abrir por primera vez el panel de
  // alta o el de edición de un requerimiento (ambos ofrecen el campo Talentos).
  useEffect(() => {
    if ((!showReqModal && editingReqId == null) || talentOptions.length) return;
    fetch('/api/centralized/encuadre/listas?list=talentos')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const opts = (j?.data || []).map((o: any) => ({ value: o.label, label: o.label }));
        if (opts.length) setTalentOptions(opts);
      })
      .catch(() => {});
  }, [showReqModal, editingReqId, talentOptions.length]);

  const addRequirement = async () => {
    if (!reqTitle.trim()) return;
    if (reqTalents.length === 0) { toast.error('Elige al menos un talento para el requerimiento.'); return; }
    setSavingReq(true);
    try {
      const res = await fetch(`/api/projects/${id}/requirements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: reqTitle, description: reqDesc, cost: reqCost ? Number(reqCost) : null,
          talents: reqTalents, slots: Number(reqSlots) || 1,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setReqTitle(''); setReqDesc(''); setReqCost(''); setReqTalents([]); setReqSlots('1'); setShowReqModal(false);
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

  const startEditReq = (r: any) => {
    setEditingReqId(r.id);
    setEditReqData({
      title: r.title || '',
      description: r.description || '',
      cost: r.cost != null ? String(r.cost) : '',
      talents: Array.isArray(r.talents) ? r.talents : [],
      // `slots` sin definir (requerimientos que vienen del agente de cotizaciones) → 1.
      slots: r.slots != null ? String(r.slots) : '1',
    });
  };
  const saveReqEdit = async () => {
    if (editingReqId == null) return;
    const reqId = editingReqId;
    const title = editReqData.title.trim();
    if (!title) { toast.error('El título no puede quedar vacío'); return; }
    const costStr = editReqData.cost.trim();
    const cost = costStr === '' ? null : Number(costStr);
    if (cost != null && !Number.isFinite(cost)) { toast.error('El costo no es válido'); return; }
    if (editReqData.talents.length === 0) { toast.error('Elige al menos un talento para el requerimiento.'); return; }
    const slots = Math.max(1, Math.round(Number(editReqData.slots) || 1));
    const description = editReqData.description.trim() || null;
    const talents = editReqData.talents;
    setSavingReqEdit(true);
    try {
      const res = await fetch(`/api/projects/${id}/requirements`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_id: reqId, title, description, cost, talents, slots }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo actualizar');
      setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => r.id === reqId ? { ...r, title, description, cost, talents, slots } : r) } : p);
      setEditingReqId(null);
      toast.success('Requerimiento actualizado');
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingReqEdit(false); }
  };

  const startEditItem = (item: any) => { setEditingItemId(item.id); setEditItemText(item.title || ''); };
  const saveItemEdit = async () => {
    if (editingItemId == null) return;
    const itemId = editingItemId;
    const title = editItemText.trim();
    if (!title) { toast.error('La subtarea no puede quedar vacía'); return; }
    setSavingItemEdit(true);
    try {
      const res = await fetch(`/api/projects/${id}/requirements/items`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, title }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'No se pudo actualizar'); }
      setProject((p: any) => p ? { ...p, requirements: (p.requirements || []).map((r: any) => ({ ...r, items: (r.items || []).map((it: any) => it.id === itemId ? { ...it, title } : it) })) } : p);
      setEditingItemId(null);
    } catch (e: any) { toast.error(e.message || 'Error'); fetchProject(); }
    finally { setSavingItemEdit(false); }
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



  // --- Content (Script + Video) ---

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

  if (loading) return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando proyecto..." /></div>;
  if (!project) return <div className="pixel-card text-center py-12"><p className="pixel-heading text-sm text-red-600">Proyecto no encontrado</p></div>;

  const reqs = project.requirements || [];
  const completedReqs = reqs.filter((r: any) => r.is_completed).length;
  const bids = project.bids || [];
  const incidents = project.incidents || [];
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
  // Editar texto/costo de un requerimiento: dueño y en un estado que la API permite.
  const canEditReqText = isOwner && !['review', 'completed', 'cancelled', 'closed'].includes(project.status);
  const hasReqs = reqs.length > 0;
  // Images: visible when project is not draft; editable by owner or accepted participant
  // En 'cotizacion' se ocultan las imágenes del proyecto (aún no aprobado por el cliente).
  const showImages = project.status !== 'draft' && project.status !== 'cotizacion';
  const isAcceptedParticipant = isMember && !isOwner && bids.some((b: any) => String(b.member_id) === String(memberId) && b.status === 'accepted');
  const canEditImages = showImages && (isOwner || isAcceptedParticipant);
  const myBid = bids.find((b: any) => String(b.member_id) === String(memberId));
  const canBidNew = isMember && !isOwner && !myBid && (project.status === 'open' || (project.status === 'draft' && !project.is_private));
  const canBidInvited = isMember && !isOwner && myBid?.status === 'invited';
  const canBid = canBidNew || canBidInvited;

  // ── Equipo del proyecto (responsable + participantes) para el panel izquierdo ──
  const teamRows: any[] = project.project_members || [];
  const acceptedBidders = bids.filter((b: any) => b.status === 'accepted');
  let responsibleRow: any = project.responsible || teamRows.find((t) => t.role === 'responsible' && t.status === 'active');
  // Si no hay responsable formal ni invitación pendiente pero hay una propuesta ACEPTADA,
  // ese postulante ES el responsable (así se registraron los proyectos hasta ahora).
  if (!responsibleRow && !project.pending_responsible && acceptedBidders.length > 0) {
    const b = acceptedBidders[0];
    responsibleRow = { member_id: b.member_id, member_name: b.member_name, photo_url: b.photo_url, role: 'responsible', status: 'active' };
  }
  const responsibleId = String(responsibleRow?.member_id ?? '');
  const participantMap = new Map<string, any>();
  for (const t of teamRows) {
    if (t.status === 'active' && String(t.member_id) !== responsibleId) participantMap.set(String(t.member_id), t);
  }
  for (const b of acceptedBidders) {
    const mid = String(b.member_id);
    if (mid === responsibleId || participantMap.has(mid)) continue;
    participantMap.set(mid, { member_id: b.member_id, member_name: b.member_name, photo_url: b.photo_url, role: 'participant', status: 'active' });
  }
  const participants = Array.from(participantMap.values());
  const pendingBids = bids.filter((b: any) => b.status !== 'accepted');

  // Descarga TXT del proyecto (descripción, propiedades, requerimientos, costos adicionales, equipo).
  const downloadProjectTxt = () => {
    const p = project;
    const money = (n: any) => `$${Number(n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const rule = '----------------------------------------';
    const drule = '========================================';
    const L: string[] = [];
    const line = (s = '') => L.push(s);

    line(`PROYECTO: ${p.title || ''}`);
    line(drule);
    line('');
    line('PROPIEDADES');
    line(rule);
    line(`Estado: ${STATUS_LABEL[p.status] || p.status}`);
    if (p.client_name || p.client_email) line(`Cliente: ${p.client_name || ''}${p.client_email ? ` <${p.client_email}>` : ''}`);
    line(`Responsable: ${responsibleRow?.member_name || p.pending_responsible?.member_name || p.assigned_member_name || '—'}`);
    const costRef = p.final_cost || p.budget_max || p.budget_min;
    if (costRef) line(`Costo / Presupuesto: ${money(costRef)}`);
    if (p.deadline) line(`Entrega estimada: ${new Date(p.deadline).toLocaleDateString('es-EC')}`);
    line(`Visibilidad: ${p.is_private ? 'Privado' : 'Público'}`);
    if (p.service_name || p.service?.name) line(`Servicio: ${p.service_name || p.service?.name}`);
    if (p.created_at) line(`Creado: ${new Date(p.created_at).toLocaleDateString('es-EC')}`);
    line('');

    line('DESCRIPCIÓN');
    line(rule);
    line(p.description ? String(p.description) : '—');
    line('');

    const rlist: any[] = p.requirements || [];
    line(`REQUERIMIENTOS (${rlist.length})`);
    line(rule);
    if (!rlist.length) line('—');
    let reqSubtotal = 0;
    rlist.forEach((r: any, i: number) => {
      reqSubtotal += Number(r.cost || 0);
      const done = r.is_completed || r.completed_at ? '  [Completado]' : '';
      line(`${i + 1}. ${r.title}${r.cost ? '  —  ' + money(r.cost) : ''}${done}`);
      if (r.description) line(`   ${String(r.description).replace(/\n/g, '\n   ')}`);
      const items: any[] = r.items || [];
      if (items.length) {
        line('   Subtareas:');
        items.forEach((it: any) => line(`     [${it.is_completed ? 'x' : ' '}] ${it.title}`));
      }
      const acc = (r.assignments || []).filter((a: any) => a.status === 'accepted');
      if (acc.length) {
        line('   Asignados:');
        acc.forEach((a: any) => line(`     - ${a.member_name}${(a.member_cost ?? a.proposed_cost) != null ? ` (${money(a.member_cost ?? a.proposed_cost)})` : ''}`));
      }
      line('');
    });

    const adds: any[] = p.additional_costs || [];
    line(`COSTOS ADICIONALES (${adds.length})`);
    line(rule);
    if (!adds.length) line('—');
    let addSubtotal = 0;
    adds.forEach((c: any) => {
      addSubtotal += Number(c.amount || 0);
      line(`- ${c.label}: ${money(c.amount)}`);
      if (c.description) line(`  ${c.description}`);
    });
    line('');

    line('TOTALES');
    line(rule);
    if (rlist.length) line(`Subtotal requerimientos: ${money(reqSubtotal)}`);
    if (adds.length) line(`Costos adicionales: ${money(addSubtotal)}`);
    line(`TOTAL: ${money(reqSubtotal + addSubtotal)}`);
    line('');

    line('EQUIPO');
    line(rule);
    line(`Responsable: ${responsibleRow?.member_name || p.pending_responsible?.member_name || p.assigned_member_name || '—'}`);
    line(`Participantes (${participants.length}):`);
    if (participants.length) participants.forEach((t: any) => line(`  - ${t.member_name}`));
    else line('  —');
    line('');
    line(drule);
    line(`Generado el ${new Date().toLocaleString('es-EC')} · GCC World`);

    const blob = new Blob([L.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (p.title || 'proyecto').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_').slice(0, 50) || 'proyecto';
    a.href = url; a.download = `Proyecto-${safe}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  const BID_LABEL: Record<string, string> = { pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', invited: 'Invitado', counter: 'Contraoferta' };

  const renderAvatar = (m: any, size: 'sm' | 'md' = 'md') => m.photo_url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={m.photo_url} alt="" className={`${size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'} rounded-full border border-digi-border object-cover shrink-0`} />
  ) : (
    <div className={`${size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-[12px]'} rounded-full border border-accent/20 bg-accent-light flex items-center justify-center font-semibold text-accent shrink-0`} style={mf}>{(m.member_name || '?')[0].toUpperCase()}</div>
  );

  // Fila de responsable/participante (usada en panel y modal de equipo).
  const renderTeamResponsible = () => (
    responsibleRow ? (
      <div className="flex items-center gap-2.5 rounded-lg border border-accent/30 bg-accent-light px-3 py-2">
        {renderAvatar(responsibleRow)}
        <span className="text-[13px] font-medium text-digi-text flex-1 min-w-0 truncate" style={mf}>{responsibleRow.member_name}</span>
        <PixelBadge variant="info"><span className="inline-flex items-center gap-1"><Crown className="w-3 h-3" /> Responsable</span></PixelBadge>
      </div>
    ) : project.pending_responsible ? (
      <div className="flex items-center gap-2.5 rounded-lg border border-digi-border px-3 py-2">
        {renderAvatar(project.pending_responsible)}
        <span className="text-[13px] font-medium text-digi-text flex-1 min-w-0 truncate" style={mf}>{project.pending_responsible.member_name}</span>
        <PixelBadge variant="warning">Invitación pendiente</PixelBadge>
      </div>
    ) : (
      <p className="text-[12px] text-digi-muted" style={mf}>Sin responsable asignado (abierto a propuestas).</p>
    )
  );
  const renderParticipantRow = (m: any) => (
    <div key={m.member_id} className="flex items-center gap-2.5 rounded-lg border border-digi-border px-3 py-1.5">
      {renderAvatar(m)}
      <span className="text-[12.5px] text-digi-text flex-1 min-w-0 truncate" style={mf}>{m.member_name}</span>
      {isOwner && (
        <button onClick={() => removeParticipant(String(m.member_id))} title="Quitar" className="shrink-0 p-1.5 rounded text-digi-muted hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
      )}
    </div>
  );

  // Propuesta compacta (panel izquierdo).
  const renderProposalCompact = (b: any) => (
    <div key={b.id} className="rounded-lg border border-digi-border px-2.5 py-2">
      <div className="flex items-center gap-2">
        {renderAvatar(b, 'sm')}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[12.5px] font-medium text-digi-text truncate" style={mf}>{b.member_name}</span>
            {b.bid_amount != null && <span className="text-[12px] font-semibold text-accent tabular-nums" style={mf}>${fmt2(Number(b.bid_amount))}</span>}
          </div>
        </div>
        <PixelBadge variant={BID_V[b.status] || 'default'}>{BID_LABEL[b.status] || b.status}</PixelBadge>
      </div>
      {isOwner && b.status === 'pending' && (
        <div className="flex gap-1.5 mt-2">
          <button onClick={() => acceptBid(b.id)} className="flex-1 inline-flex items-center justify-center gap-1 text-[11.5px] font-medium text-white bg-green-600 rounded px-2 py-1 hover:bg-green-700 transition-colors" style={mf}><Check className="w-3 h-3" /> Aceptar</button>
          <button onClick={() => rejectBid(b.id)} className="flex-1 inline-flex items-center justify-center gap-1 text-[11.5px] font-medium text-red-600 border border-red-300 rounded px-2 py-1 hover:bg-red-50 transition-colors" style={mf}><X className="w-3 h-3" /> Rechazar</button>
        </div>
      )}
      {b.status === 'invited' && String(b.member_id) === String(memberId) && (
        <button onClick={() => setShowBidModal(true)} className="w-full mt-2 inline-flex items-center justify-center gap-1 text-[11.5px] font-medium text-accent border border-accent/40 rounded px-2 py-1 hover:bg-accent-light transition-colors" style={mf}><Send className="w-3 h-3" /> Enviar propuesta</button>
      )}
    </div>
  );

  // Propuesta completa (modal "Ver más").
  const renderProposalFull = (b: any) => (
    <div key={b.id} className="rounded-lg border border-digi-border p-3.5">
      <div className="flex items-start gap-3">
        {renderAvatar(b, 'md')}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-medium text-digi-text" style={mf}>{b.member_name}</span>
            {b.bid_amount != null && <span className="text-[13px] font-semibold text-accent tabular-nums" style={mf}>${fmt2(Number(b.bid_amount))}</span>}
            {b.estimated_days && <span className="text-[11px] text-digi-muted" style={mf}>· {b.estimated_days}d</span>}
            <PixelBadge variant={BID_V[b.status] || 'default'}>{BID_LABEL[b.status] || b.status}</PixelBadge>
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
              <button onClick={() => acceptBid(b.id)} className="inline-flex items-center gap-1 text-[12px] font-medium text-white bg-green-600 rounded px-2.5 py-1.5 hover:bg-green-700 transition-colors" style={mf}><Check className="w-3.5 h-3.5" /> Aceptar</button>
              <button onClick={() => rejectBid(b.id)} className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600 border border-red-300 rounded px-2.5 py-1.5 hover:bg-red-50 transition-colors" style={mf}><X className="w-3.5 h-3.5" /> Rechazar</button>
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

  return (
    <div>
      {/* El nombre se edita en una ventanita centrada (un campo), no sustituyendo la cabecera. */}
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
              {/* Accesos rápidos reformulados como botones del header */}
              {['in_progress', 'review', 'completed'].includes(project.status) && reqs.length > 0 && (
                <button onClick={() => setShowProgresoModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-digi-border text-digi-text text-sm font-medium rounded hover:border-accent hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
                  <BarChart3 className="w-4 h-4" /> Progreso {reqs.length ? `${Math.round((completedReqs / reqs.length) * 100)}%` : ''}
                </button>
              )}
              {showImages && (
                <button onClick={() => setShowImagesModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-digi-border text-digi-text text-sm font-medium rounded hover:border-accent hover:text-accent transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
                  <ImageIcon className="w-4 h-4" /> Imágenes{projectImages.length > 0 ? ` (${projectImages.length})` : ''}
                </button>
              )}
            </>
          }
          overflow={[
            // Descargar TXT del proyecto: disponible desde 'borrador' para arriba (no en cotización).
            ...(project.status !== 'cotizacion' ? [{ label: 'Descargar TXT', onClick: downloadProjectTxt }] : []),
            ...(isOwner && !isTerminal ? [{ label: 'Editar nombre', onClick: () => { setEditTitle(project.title); setEditingTitle(true); } }] : []),
            // Participación del miembro (antes en la tarjeta "Acciones")
            ...(isMember && !isOwner && ['open', 'in_progress'].includes(project.status) && !projectRequests.some((r: any) => String(r.member_id) === String(memberId) && r.type === 'withdrawal' && ['pending', 'rejected'].includes(r.status))
              ? [{ label: 'Desistir del proyecto', onClick: () => { setWithdrawType('withdrawal'); setWithdrawReason(''); setShowWithdrawModal(true); } }] : []),
            ...(isMember && !isOwner && ['open', 'in_progress'].includes(project.status) && projectRequests.some((r: any) => String(r.member_id) === String(memberId) && r.type === 'withdrawal' && r.status === 'rejected') && !projectRequests.some((r: any) => String(r.member_id) === String(memberId) && r.type === 'supervised_exit' && r.status === 'pending')
              ? [{ label: 'Solicitar salida supervisada', onClick: () => { setWithdrawType('supervised_exit'); setWithdrawReason(''); setShowWithdrawModal(true); }, danger: true }] : []),
            // Marketplace (proyecto completado)
            ...(project.status === 'completed' && isOwner && !project.marketplace_source_id
              ? [{ label: project.is_marketplace_published ? 'Despublicar del Marketplace' : 'Publicar en Marketplace', onClick: async () => {
                  try {
                    const res = await fetch(`/api/projects/${id}/publish`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ publish: !project.is_marketplace_published }) });
                    if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                    toast.success(project.is_marketplace_published ? 'Despublicado del marketplace' : 'Publicado en el marketplace'); fetchProject();
                  } catch (e: any) { toast.error(e.message || 'Error'); }
                } }] : []),
            ...(isOwner && !isTerminal ? [{ label: 'Cancelar proyecto', onClick: () => updateStatus('cancelled'), danger: true }] : []),
            ...(isAdmin ? [{ label: 'Eliminar proyecto', onClick: () => setConfirmDeleteProject(true), danger: true }] : []),
          ]}
          trailing={project.status === 'cotizacion' && isOwner ? (
            <button onClick={() => setShowShare(true)} className="inline-flex items-center gap-1.5 px-3 py-2 border border-accent text-accent text-sm font-medium rounded hover:bg-accent-light transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
              <Share2 className="w-4 h-4" /> Compartir acceso
            </button>
          ) : undefined}
      />

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

      {project.open_for_talent && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent-light p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <DoorOpen className="w-4 h-4 text-accent" />
            <p className="text-[13px] font-semibold text-digi-text" style={{ fontFamily: 'var(--font-body)' }}>Abierto por talento</p>
          </div>
          <p className="text-[12px] text-digi-muted mb-2" style={{ fontFamily: 'var(--font-body)' }}>Un miembro con al menos uno de los talentos requeridos puede hacerse responsable de inmediato; luego podrá tomar requerimientos o abrir el proyecto a propuestas.</p>
          {(project.required_talents || []).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mb-2">
              <Sparkles className="w-3.5 h-3.5 text-digi-muted shrink-0" />
              {(project.required_talents || []).map((t: string) => (
                <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded bg-black/[0.05] text-digi-text" style={{ fontFamily: 'var(--font-body)' }}>{t}</span>
              ))}
            </div>
          )}
          {!isOwner && !!memberId && (
            <button onClick={takeByTalent} className={BTN_PRIMARY}><Crown className="w-4 h-4" /> Hacerme responsable</button>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ====== IZQUIERDA: Equipo + Propuestas ====== */}
        <aside className="w-full lg:w-[280px] shrink-0 space-y-4 order-2 lg:order-1">
          {/* Equipo del proyecto (compacto: responsable + hasta 5 participantes) */}
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-[13px] font-semibold text-digi-text inline-flex items-center gap-1.5" style={mf}><Users className="w-4 h-4 text-accent" /> Equipo</h3>
              {isOwner && (
                <button onClick={() => { setNewParticipantId(''); setShowAddParticipant(true); }} title="Agregar participante" className="shrink-0 p-1.5 rounded text-digi-muted border border-digi-border hover:border-accent hover:text-accent transition-colors"><UserPlus className="w-3.5 h-3.5" /></button>
              )}
            </div>
            <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Responsable</p>
            <div className="mb-3">{renderTeamResponsible()}</div>
            <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Participantes ({participants.length})</p>
            {participants.length > 0 ? (
              <div className="space-y-1.5">{participants.slice(0, 5).map(renderParticipantRow)}</div>
            ) : (
              <p className="text-[11.5px] text-digi-muted" style={mf}>Aún no hay participantes. Se suman al aceptar sus propuestas o agregándolos.</p>
            )}
            {participants.length > 5 && (
              <button onClick={() => setShowTeamModal(true)} className="w-full mt-2.5 text-[12px] font-medium text-accent border border-accent/40 rounded px-2.5 py-1.5 hover:bg-accent-light transition-colors" style={mf}>Ver más ({participants.length})</button>
            )}
          </div>

          {/* Propuestas (compacto: hasta 5 pendientes) */}
          <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-[13px] font-semibold text-digi-text" style={mf}>Propuestas ({pendingBids.length})</h3>
              <div className="flex gap-1.5">
                {canInvite && (
                  <button onClick={openInviteModal} title="Invitar" className="shrink-0 p-1.5 rounded text-digi-muted border border-digi-border hover:border-accent hover:text-accent transition-colors"><UserPlus className="w-3.5 h-3.5" /></button>
                )}
                {canBid && (
                  <button onClick={() => setShowBidModal(true)} title="Postularme" className="shrink-0 p-1.5 rounded text-white bg-accent hover:bg-accent-hover transition-colors"><Send className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
            {pendingBids.length > 0 ? (
              <div className="space-y-1.5">{pendingBids.slice(0, 5).map(renderProposalCompact)}</div>
            ) : (
              <p className="text-[11.5px] text-digi-muted text-center py-2" style={mf}>No hay propuestas pendientes.</p>
            )}
            {pendingBids.length > 5 && (
              <button onClick={() => setShowProposalsModal(true)} className="w-full mt-2.5 text-[12px] font-medium text-accent border border-accent/40 rounded px-2.5 py-1.5 hover:bg-accent-light transition-colors" style={mf}>Ver más ({pendingBids.length})</button>
            )}
          </div>
        </aside>

        {/* ====== PRINCIPAL: Requerimientos (la Descripción se movió al rail derecho) ====== */}
        <div className="flex-1 min-w-0 space-y-4 order-1 lg:order-2">

          {(<>
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
                  const pendingAssignments = assignments.filter((a: any) => a.status !== 'accepted');
                  const expanded = expandedReqs.has(r.id);
                  const canManageThis = isOwner && (isAdmin || project.confirmed_at || isMemberCreator);
                  return (
                    <div key={r.id} className={`rounded-lg border border-digi-border bg-white overflow-hidden`}>
                      <div className={`p-2.5 border-l-[3px] ${r.is_completed ? 'border-l-green-500' : 'border-l-accent'}`}>
                        {/* La edición NUNCA es inline: el lápiz abre el panel lateral derecho. */}
                        <div className={`flex items-start gap-3 ${editingReqId === r.id ? 'opacity-60' : ''}`}>
                          <button
                            onClick={() => canEditThis && toggleReqComplete(r.id, !r.is_completed)}
                            disabled={!canEditThis}
                            aria-label={r.is_completed ? 'Marcar incompleto' : 'Marcar completo'}
                            className={`mt-0.5 w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${r.is_completed ? 'bg-accent border-accent text-white' : 'border-digi-border bg-white'} ${canEditThis ? 'cursor-pointer hover:border-accent' : 'cursor-default'}`}
                          >
                            {r.is_completed && <Check className="w-3 h-3" strokeWidth={3} />}
                          </button>
                          <button onClick={() => toggleReqExpand(r.id)} className="min-w-0 flex-1 text-left">
                            <p className={`text-[13px] font-medium ${r.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</p>
                            {r.description && <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{r.description}</p>}
                            {/* Talentos que pide el requerimiento y cuántas plazas ofrece:
                                es lo que hace que el proyecto salga en el filtro por talento. */}
                            {(r.talents?.length > 0 || r.slots == null || r.slots > 1) && (
                              <p className="flex flex-wrap items-center gap-1 mt-1">
                                {(r.talents || []).map((t: string) => (
                                  <span key={t} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-accent-light text-accent border border-accent/20" style={mf}>{t}</span>
                                ))}
                                {r.slots == null ? (
                                  // El agente de cotizaciones no define plazas: se avisa para que se pongan.
                                  <span className="text-[10.5px] text-amber-700" style={mf}>· plazas sin definir</span>
                                ) : r.slots > 1 ? (
                                  <span className="text-[10.5px] text-digi-muted" style={mf}>· {r.slots} plazas</span>
                                ) : null}
                              </p>
                            )}
                            {!expanded && (items.length > 0 || acceptedAssignments.length > 0 || pendingAssignments.length > 0) && (
                              <p className="text-[11px] text-digi-muted/80 mt-0.5" style={mf}>
                                {[items.length > 0 ? `${items.length} subtarea${items.length !== 1 ? 's' : ''}` : '', acceptedAssignments.length > 0 ? `${acceptedAssignments.length} asignado${acceptedAssignments.length !== 1 ? 's' : ''}` : '', pendingAssignments.length > 0 ? `${pendingAssignments.length} pendiente${pendingAssignments.length !== 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </button>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.cost && <span className="text-[13px] font-semibold text-accent tabular-nums" style={mf}>${r.cost}</span>}
                            {canEditReqText && (
                              <button onClick={() => startEditReq(r)} aria-label="Editar requerimiento" title="Editar" className="text-digi-muted/60 hover:text-accent transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                            )}
                            {isOwner && (
                              <button onClick={() => deleteRequirement(r.id)} aria-label="Eliminar requerimiento" className="text-digi-muted/60 hover:text-red-600 transition-colors"><X className="w-4 h-4" /></button>
                            )}
                            <button onClick={() => toggleReqExpand(r.id)} aria-label={expanded ? 'Contraer' : 'Ver detalle'} title={expanded ? 'Contraer' : 'Ver detalle'}
                              className="text-digi-muted hover:text-accent transition-colors">
                              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Detalle desplegable: botones + miembros + subtareas */}
                        {expanded && (<>
                        {/* Botones de acción (solo al desplegar) */}
                        {(canManageThis || canEditThis) && (
                          <div className="flex flex-wrap items-center gap-2 mt-2.5 ml-[30px]">
                            {canManageThis && (
                              <button onClick={() => openAssignModal(r.id)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={mf}><UserPlus className="w-3.5 h-3.5" /> Asignar miembro</button>
                            )}
                            {canEditThis && (
                              <button onClick={() => setSubtaskReqId(r.id)} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1 hover:border-accent hover:text-accent transition-colors" style={mf}><ListPlus className="w-3.5 h-3.5" /> Subtareas{items.length > 0 ? ` (${items.length})` : ''}</button>
                            )}
                          </div>
                        )}

                        {acceptedAssignments.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2.5 ml-[30px]">
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

                        {/* Pending assignments (proposed / counter) */}
                        {pendingAssignments.length > 0 && (
                          <div className="mt-2.5 ml-[30px] space-y-1.5">
                            {pendingAssignments.map((a: any) => (
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
                        {acceptedAssignments.length === 0 && pendingAssignments.length === 0 && items.length === 0 && (
                          <p className="text-[11.5px] text-digi-muted mt-2.5 ml-[30px]" style={mf}>Sin subtareas ni miembros asignados aún.</p>
                        )}
                        </>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          </>)}

          {/* Modal "Ver más" — Equipo completo */}
          <PixelModal open={showTeamModal} onClose={() => setShowTeamModal(false)} title="Equipo del proyecto" size="md">
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Responsable</p>
                {renderTeamResponsible()}
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide" style={mf}>Participantes ({participants.length})</p>
                  {isOwner && (
                    <button onClick={() => { setNewParticipantId(''); setShowAddParticipant(true); }} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors" style={mf}><UserPlus className="w-3.5 h-3.5" /> Agregar participante</button>
                  )}
                </div>
                {participants.length > 0 ? (
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">{participants.map(renderParticipantRow)}</div>
                ) : (
                  <p className="text-[12px] text-digi-muted" style={mf}>Aún no hay participantes.</p>
                )}
              </div>
            </div>
          </PixelModal>

          {/* Modal "Ver más" — Propuestas completas */}
          <PixelModal open={showProposalsModal} onClose={() => setShowProposalsModal(false)} title="Propuestas" size="lg">
            <div className="space-y-3">
              <div className="flex items-center justify-end gap-2">
                {canInvite && (
                  <button onClick={openInviteModal} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-digi-text border border-digi-border rounded px-2.5 py-1.5 hover:border-accent hover:text-accent transition-colors" style={mf}><UserPlus className="w-3.5 h-3.5" /> Invitar</button>
                )}
                {canBid && (
                  <button onClick={() => setShowBidModal(true)} className={BTN_PRIMARY} style={mf}><Send className="w-4 h-4" /> Postularme</button>
                )}
              </div>
              {pendingBids.length > 0 ? (
                <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">{pendingBids.map(renderProposalFull)}</div>
              ) : (
                <p className="text-[12px] text-digi-muted text-center py-3" style={mf}>No hay propuestas pendientes.</p>
              )}
            </div>
          </PixelModal>

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
              {/* Qué se factura. Si el proyecto tiene PLAN DE ETAPAS se ofrece solo eso
                  —el acuerdo con el cliente—; si no, el detalle por requerimientos.
                  El comprobante se emite al cumplirse cada fase (LRTI art. 61; Rgto.
                  Comprobantes art. 17 lit. e) y cada tramo se factura una sola vez. */}
              {billing && (() => {
                const conPlan = billing.mode === 'etapas';
                const filas: any[] = conPlan ? (billing.etapas || []) : (billing.stages || []);
                if (filas.length === 0) return null;
                return (
                  <div className="mb-3">
                    <div className="flex items-center justify-between border-b border-digi-border pb-1.5 mb-2">
                      <div className="flex items-center gap-1">
                        <h4 className="text-[12px] font-semibold text-digi-text" style={pf}>
                          {conPlan ? 'Etapas a facturar' : 'Requerimientos a facturar'}
                        </h4>
                        <BotonAyuda titulo={conPlan ? 'Etapas a facturar' : 'Requerimientos a facturar'}>
                          {conPlan
                            ? <>Se factura por las etapas acordadas con el cliente. Las ya facturadas no vuelven a entrar; para corregir una, anula antes su factura.</>
                            : <>Se factura al entregar cada requerimiento. Los ya facturados no vuelven a entrar, y el detalle de abajo sigue siendo editable.</>}
                          {Number(billing.invoicedLegacy) > 0 && (
                            <p className="mt-2">
                              <strong>Ojo:</strong> este proyecto ya tiene ${fmt2(Number(billing.invoicedLegacy))} facturados
                              en comprobantes anteriores a la facturación por etapas. Revísalos antes de emitir para no
                              cobrar dos veces lo mismo.
                            </p>
                          )}
                        </BotonAyuda>
                      </div>
                      <span className="text-[11px] text-digi-muted" style={pf}>
                        Facturado ${fmt2(billing.invoiced)} · Por facturar ${fmt2(billing.billable)}
                      </span>
                    </div>
                    <div className="border border-digi-border rounded-lg divide-y divide-digi-border/60 max-h-48 overflow-y-auto">
                      {filas.map((e: any) => {
                        const facturada = !!e.invoiceId;
                        return (
                          <label key={e.id} className={`flex items-center gap-2 px-2 py-1.5 text-[12px] ${facturada ? 'opacity-60' : 'cursor-pointer hover:bg-accent/5'}`} style={pf}>
                            <input type="checkbox" disabled={facturada} checked={selectedStages.includes(e.id)}
                              onChange={() => toggleStage(e.id)} className="accent-[#4B2D8E]" />
                            <span className="flex-1 min-w-0 truncate text-digi-text">{conPlan ? e.name : e.title}</span>
                            {facturada ? (
                              <span className="text-[11px] text-digi-muted shrink-0">Facturada · {e.invoiceNumber}</span>
                            ) : !conPlan && e.deliveredAt ? (
                              <span className="text-[11px] text-green-600 shrink-0">Entregada</span>
                            ) : !conPlan ? (
                              <span className="text-[11px] text-amber-600 shrink-0">Sin entregar</span>
                            ) : null}
                            <span className="tabular-nums text-digi-text shrink-0">${fmt2(Number(e.amount))}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* ─── LEFT: Adquirente + Pago ─── */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-b border-digi-border pb-1">
                    <h4 className="text-[12px] text-accent" style={pf}>Adquirente</h4>
                    <span className="text-[10.5px] text-digi-muted" style={pf}>Datos del cliente del proyecto</span>
                  </div>
                  <p className="text-[10.5px] text-digi-muted" style={pf}>Se prellenan desde la cuenta de facturación del cliente. Al facturar, los cambios se guardan para las próximas facturas.</p>
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

          {(<>
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

        </div>

        {/* ====== DERECHA: pestañas Propiedades / Incidentes ====== */}
        <div className="w-full lg:w-[360px] shrink-0 space-y-4 order-3">
          <div className="flex gap-1 bg-digi-card border border-digi-border rounded-lg p-1">
            <button onClick={() => setRightTab('propiedades')} className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${rightTab === 'propiedades' ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>Propiedades</button>
            <button onClick={() => setRightTab('incidentes')} className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${rightTab === 'incidentes' ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>Incidentes</button>
          </div>

          {rightTab === 'incidentes' && (
            <IncidentsTab projectId={id as string} canManage={!!isOwner} />
          )}

          {rightTab === 'propiedades' && (<>
          {/* Propiedades */}
          <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
            <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3" style={pf}>Propiedades</h3>
            <dl className="space-y-2.5 text-[12px]" style={mf}>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-digi-muted shrink-0">Cliente</dt>
                <dd className="text-right min-w-0">
                  {/* Se edita en una ventanita centrada (un solo campo), nunca aquí encima. */}
                  <span className={`text-digi-text break-words ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent' : ''}`}
                    onClick={() => { if (isOwner && !isTerminal) { setEditClient({ clientId: project.client_id ? String(project.client_id) : '', clientEmail: '' }); setEditingClient(true); } }}>
                    {project.client_name || '-'}
                  </span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Miembro</dt><dd className="text-digi-text text-right break-words min-w-0">{project.assigned_member_name || '-'}</dd></div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-digi-muted shrink-0">Presupuesto</dt>
                <dd className="text-right min-w-0">
                  <span className={`text-digi-text ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent' : ''}`} onClick={() => { if (isOwner && !isTerminal) { setEditBudgetMin(project.budget_min || ''); setEditBudgetMax(project.budget_max || ''); setEditingBudget(true); } }}>{project.budget_min ? `$${project.budget_min}${project.budget_max ? ` - $${project.budget_max}` : ''}` : '-'}</span>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Costo final</dt><dd className="text-digi-text text-right">{totalAcceptedCost > 0 ? `$${fmt2(totalAcceptedCost)}` : '$0.00'}</dd></div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-digi-muted shrink-0">Límite</dt>
                <dd className="text-right min-w-0">
                  <span className={`text-digi-text ${isOwner && !isTerminal ? 'cursor-pointer hover:text-accent' : ''}`} onClick={() => { if (isOwner && !isTerminal) { setEditDeadline(project.deadline?.split('T')[0] || ''); setEditingDeadline(true); } }}>{project.deadline ? new Date(project.deadline).toLocaleDateString() : '-'}</span>
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
              {project.status === 'cotizacion' && project.quote_client_budget != null && (
                <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Presup. cliente</dt><dd className="text-accent font-semibold text-right tabular-nums">${fmt2(Number(project.quote_client_budget))}</dd></div>
              )}
              <div className="flex items-start justify-between gap-3"><dt className="text-digi-muted shrink-0">Creado</dt><dd className="text-digi-text text-right">{new Date(project.created_at).toLocaleDateString()}</dd></div>
            </dl>
          </div>

          {/* Descripción del proyecto (bajo Propiedades) — se edita en panel derecho */}
          {(project.description || (isOwner && !isTerminal)) && (
            <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={pf}>Descripción</h3>
                {isOwner && !isTerminal && (
                  <button onClick={() => { setEditDesc(project.description || ''); setEditingDesc(true); }} className="text-[11px] text-accent border border-accent/30 px-1.5 py-0.5 rounded hover:bg-accent/10 transition-colors" style={pf}>Editar</button>
                )}
              </div>
              <p className="text-xs text-digi-text leading-relaxed whitespace-pre-wrap" style={mf}>{project.description || <span className="text-digi-muted">Sin descripción. Pulsa “Editar” para agregar una.</span>}</p>
            </div>
          )}

          {/* Costos adicionales (servicios de proveedores externos) */}
          {(project.status === 'cotizacion' || (project.additional_costs || []).length > 0) && (
            <AdditionalCostsCard projectId={project.id} costs={project.additional_costs || []} canEdit={!!(isOwner && !isTerminal)} onSaved={fetchProject} />
          )}

          {/* Pagos por transferencia que esperan que alguien los confirme. Va ANTES de la
              tarjeta de Pagos porque es lo único de este panel que pide una acción hoy. */}
          <CobrosEnEspera tipo="project" id={String(id)} alConfirmar={fetchProject} />

          {/* Pagos (facturado vs pendiente) */}
          {/* La tarjeta aparece también cuando el proyecto tiene etapas o cobros aunque
              `final_cost` sea 0 (pasa mientras no hay asignaciones aceptadas). */}
          {payments && (Number(payments.total) > 0 || (payments.invoices || []).length > 0
            || Number(billing?.stagesTotal || 0) > 0) && (() => {
            const baseTotal = Number(payments.total) > 0 ? Number(payments.total) : Number(billing?.stagesTotal || 0);
            const pct = baseTotal > 0 ? Math.min(100, (Number(billing?.invoiced || payments.invoiced) / baseTotal) * 100) : 0;
            return (
              <div className="pixel-card">
                <h3 className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-3" style={pf}>Pagos</h3>
                <div className="space-y-1 text-[12px]" style={mf}>
                  <div className="flex justify-between"><span className="text-digi-muted">Total</span><span className="text-digi-text tabular-nums">${fmt2(baseTotal)}</span></div>
                  <div className="flex justify-between"><span className="text-digi-muted">Facturado</span><span className="text-green-600 tabular-nums">${fmt2(Number(billing?.invoiced ?? payments.invoiced))}</span></div>
                  <div className="flex justify-between"><span className="text-digi-muted">Por facturar</span><span className={`tabular-nums ${Number(billing?.billable ?? payments.pending) > 0 ? 'text-amber-600' : 'text-digi-text'}`}>${fmt2(Number(billing?.billable ?? payments.pending))}</span></div>
                </div>
                <div className="h-1.5 rounded-full bg-digi-darker border border-digi-border overflow-hidden my-2"><div className="h-full bg-green-500" style={{ width: `${pct}%` }} /></div>
                {(payments.invoices || []).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-digi-border space-y-0.5">
                    {payments.invoices.map((inv: any) => (
                      <button key={inv.id} onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="w-full flex items-center justify-between gap-2 text-[11.5px] hover:bg-black/[0.03] rounded px-1.5 py-1 transition-colors" style={mf}>
                        <span className="min-w-0 truncate text-digi-text">{inv.invoice_number || `#${inv.id}`}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={`tabular-nums ${inv.status === 'cancelled' ? 'line-through text-digi-muted' : 'text-digi-text'}`}>${fmt2(inv.total)}</span>
                          {inv.status === 'cancelled' ? <span className="text-[9px] text-red-500">anulada</span> : inv.sri_status === 'authorized' ? <span className="text-[9px] text-green-600">SRI</span> : null}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* CANAL 2 — el CLIENTE paga su etapa desde aquí (2026-08-26).
                    Ve solo lo que le incumbe: qué tramos hay, cuáles están pagados y cuál
                    le toca. Nada del reparto interno, igual que en la página pública. */}
                {esCliente && (billing?.etapas || []).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-digi-border space-y-1">
                    <span className="text-[11px] text-digi-muted" style={pf}>Etapas del proyecto</span>
                    {(billing.etapas || []).map((e: any) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 text-[11.5px] px-1.5 py-1" style={mf}>
                        <span className="min-w-0 truncate text-digi-text">{e.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="tabular-nums text-digi-text">${fmt2(Number(e.amount))}</span>
                          {e.invoiceId
                            ? <span className="text-[9px] text-green-600">pagada</span>
                            : (
                              <button
                                onClick={() => router.push(`/pagar/cobro?tipo=project&id=${id}&etapa=${e.id}`)}
                                className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-[10.5px] font-semibold text-white hover:opacity-90 transition-opacity">
                                Pagar
                              </button>
                            )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* ETAPAS DE FACTURACIÓN: el acuerdo con el cliente («50% al empezar,
                    50% al entregar»). No son los requerimientos, que son trabajo interno.
                    Con plan definido, el proyecto se factura SOLO por etapas. */}
                {isAdmin && (
                  <div className="mt-2 pt-2 border-t border-digi-border">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-digi-muted" style={pf}>Etapas de facturación</span>
                      <button onClick={openStagesPanel} className="text-[11px] text-accent hover:underline" style={pf}>
                        {(billing?.etapas || []).length > 0 ? 'Editar' : 'Definir'}
                      </button>
                    </div>
                    {(billing?.etapas || []).length === 0 ? (
                      <p className="text-[10.5px] text-digi-muted" style={pf}>
                        Sin etapas: se factura con el detalle de requerimientos.
                      </p>
                    ) : (
                      (billing.etapas || []).map((e: any) => (
                        <div key={e.id} className="flex items-center justify-between gap-2 text-[11.5px] px-1.5 py-1" style={mf}>
                          <span className="min-w-0 truncate text-digi-text">{e.name}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="tabular-nums text-digi-text">${fmt2(Number(e.amount))}</span>
                            {e.invoiceId
                              ? <span className="text-[9px] text-green-600" title={`Facturada en ${e.invoiceNumber}`}>facturada</span>
                              : <span className="text-[9px] text-amber-600">pendiente</span>}
                            {/* Compartir el enlace de pago de ESTA etapa (canal 3). Solo en
                                las que aún no tienen comprobante: una etapa ya facturada no
                                se cobra otra vez. */}
                            {!e.invoiceId && (
                              <button onClick={() => abrirEnlacePago(e)} title="Compartir enlace de pago"
                                className="text-accent hover:opacity-70 transition-opacity">
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}

              </div>
            );
          })()}

          </>)}


        </div>
      </div>

      {/* Ventanita: ENLACE DE PAGO de una etapa (canal 3).
          Son DOS campos —correo y duración—, así que va en ventanita centrada y no en
          panel lateral, según la regla de «DÓNDE SE EDITA». */}
      <QuickEditDialog
        open={!!linkStage}
        title={linkResult ? 'Enlace de pago listo' : `Cobrar «${linkStage?.name || ''}»`}
        onClose={() => !linkSaving && setLinkStage(null)}
        onSave={linkResult ? () => setLinkStage(null) : compartirEnlacePago}
        saving={linkSaving}
        canSave={linkResult ? true : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(linkEmail.trim()) && Number(linkHoras) > 0}
        saveLabel={linkResult ? 'Listo' : 'Generar y enviar'}
      >
        {linkResult ? (
          <div className="space-y-3">
            <p className="text-[12.5px] text-digi-text" style={mf}>
              {linkResult.correoEnviado
                ? <>Le enviamos a <strong>{linkResult.email}</strong> un correo con el enlace para pagar <strong>${fmt2(linkResult.total)}</strong>.</>
                : <>El enlace está listo, pero <strong>el correo no salió</strong>. Cópialo y envíaselo tú.</>}
            </p>
            <EditField label="Enlace" hint="Cualquiera con este enlace ve el detalle del proyecto y puede pagar la etapa. No lo publiques.">
              <input readOnly className={EDIT_INPUT} value={linkResult.url}
                onFocus={(ev) => ev.currentTarget.select()} />
            </EditField>
            <button type="button" className={BTN_SECONDARY}
              onClick={() => { navigator.clipboard.writeText(linkResult.url); toast.success('Enlace copiado'); }}>
              Copiar enlace
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-digi-muted" style={mf}>
              Se cobrarán <strong className="text-digi-text">${fmt2(linkStage?.amount || 0)}</strong> más los
              gastos de procesamiento, que paga el cliente. La factura se emite sola en cuanto el pago se confirme.
            </p>
            <EditField label="Correo del cliente" hint="Es a donde llega el enlace.">
              <input type="email" className={EDIT_INPUT} value={linkEmail}
                onChange={(ev) => setLinkEmail(ev.target.value)} placeholder="cliente@empresa.com" />
            </EditField>
            {/* «el usuario miembro responsable del proyecto define el tiempo máximo de
                duración del token» — Fernando, 2026-08-25. */}
            <EditField label="El enlace caduca en" hint="Pasado ese tiempo deja de servir y hay que generar otro.">
              <select className={EDIT_INPUT} value={linkHoras} onChange={(ev) => setLinkHoras(ev.target.value)}>
                <option value="24">24 horas</option>
                <option value="72">3 días</option>
                <option value="168">7 días</option>
                <option value="360">15 días</option>
                <option value="720">30 días</option>
              </select>
            </EditField>
          </div>
        )}
      </QuickEditDialog>

      {/* Panel: ETAPAS DE FACTURACIÓN. Formulario con lista → panel lateral derecho
          (regla del sistema). La última etapa recoge el resto y no se escribe. */}
      <EditPanel
        open={showStagesPanel}
        title="Etapas de facturación"
        onClose={() => !savingPlan && setShowStagesPanel(false)}
        onSave={savePlan}
        saving={savingPlan}
        canSave={planDraft.filter(e => e.name.trim()).length >= 2}
        saveLabel="Guardar etapas"
        danger={(billing?.etapas || []).length > 0 && !(billing?.etapas || []).some((e: any) => e.invoiceId)
          ? { label: 'Quitar plan de etapas', onClick: borrarPlan } : undefined}
      >
        <EditField label="Total del proyecto" hint={
          <>Es la base sobre la que se reparten las etapas: el costo final del proyecto y, mientras no
          esté sincronizado, la suma de sus requerimientos. La última etapa siempre recoge lo que
          quede para llegar a este total.</>
        }>
          <div className={`${EDIT_INPUT} flex items-center justify-between opacity-70`}>
            <span>Base de reparto</span>
            <span className="tabular-nums">${fmt2(planBase)}</span>
          </div>
        </EditField>

        <div className="space-y-2">
          {planDraft.map((e, i) => {
            const esUltima = i === planDraft.length - 1;
            const facturada = !!e.invoiceNumber;
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 min-w-0">
                  <label className="text-[11px] text-digi-muted mb-1 block" style={pf}>Etapa {i + 1}</label>
                  <input value={e.name} disabled={facturada}
                    onChange={ev => { const n = [...planDraft]; n[i] = { ...n[i], name: ev.target.value }; setPlanDraft(n); }}
                    placeholder={`Etapa ${i + 1}`} className={EDIT_INPUT} />
                </div>
                <div className="w-28 shrink-0">
                  <label className="text-[11px] text-digi-muted mb-1 block" style={pf}>
                    {esUltima && !facturada ? 'Resto' : 'Importe'}
                  </label>
                  <input
                    value={esUltima && !facturada ? String(planRestante) : e.amount}
                    disabled={esUltima || facturada}
                    onChange={ev => { const n = [...planDraft]; n[i] = { ...n[i], amount: ev.target.value }; setPlanDraft(n); }}
                    type="number" min="0" step="0.01" placeholder="0.00"
                    className={`${EDIT_INPUT} tabular-nums ${esUltima || facturada ? 'opacity-60' : ''}`} />
                </div>
                <button type="button" disabled={facturada || planDraft.length <= 2}
                  onClick={() => setPlanDraft(planDraft.filter((_, idx) => idx !== i))}
                  className="mb-1.5 text-red-500/70 hover:text-red-600 disabled:opacity-30 disabled:hover:text-red-500/70 shrink-0"
                  title={facturada ? 'Ya facturada' : 'Quitar etapa'}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          <button type="button"
            onClick={() => setPlanDraft([...planDraft, { id: null, name: `Etapa ${planDraft.length + 1}`, amount: '', invoiceNumber: null }])}
            className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={pf}>
            <Plus className="w-3.5 h-3.5" /> Añadir etapa
          </button>
        </div>

      </EditPanel>

      {/* Panel: Progreso del equipo (se abre desde el header) */}
      <PixelModal open={showProgresoModal} onClose={() => setShowProgresoModal(false)} title="Progreso del equipo" size="md">
        {(() => {
          const rqs = project.requirements || [];
          const memberMap: Record<string, { name: string; photo_url: string; total: number; completed: number }> = {};
          for (const req of rqs) {
            for (const a of (req.assignments || [])) {
              if (a.status !== 'accepted') continue;
              if (!memberMap[a.member_id]) memberMap[a.member_id] = { name: a.member_name, photo_url: a.photo_url, total: 0, completed: 0 };
              memberMap[a.member_id].total++;
              if (req.is_completed || req.completed_at) memberMap[a.member_id].completed++;
            }
          }
          const members = Object.values(memberMap);
          const overallPct = reqs.length ? Math.round((completedReqs / reqs.length) * 100) : 0;
          return (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-[12px] mb-1" style={mf}><span className="text-digi-muted">Requerimientos completados</span><span className="text-digi-text tabular-nums">{completedReqs}/{reqs.length} ({overallPct}%)</span></div>
                <div className="h-2 rounded-full bg-digi-border/60 overflow-hidden"><div className={`h-full rounded-full transition-all ${overallPct === 100 ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${overallPct}%` }} /></div>
              </div>
              {members.length > 0 ? (
                <div>
                  <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-2" style={mf}>Por miembro</p>
                  <div className="space-y-2.5">
                    {members.map((m, i) => {
                      const pct = m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-2.5">
                          {m.photo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={m.photo_url} alt={m.name} className="w-7 h-7 rounded-full object-cover border border-digi-border shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/40 flex items-center justify-center shrink-0"><span className="text-[12px] text-accent" style={mf}>{m.name?.charAt(0)}</span></div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5"><span className="text-[12px] text-digi-text truncate" style={mf}>{m.name}</span><span className="text-[11px] text-digi-muted shrink-0" style={mf}>{m.completed}/{m.total} ({pct}%)</span></div>
                            <div className="h-1.5 rounded-full bg-digi-border/60 overflow-hidden"><div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${pct}%` }} /></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-digi-muted" style={mf}>Aún no hay miembros con requerimientos asignados.</p>
              )}
            </div>
          );
        })()}
      </PixelModal>

      {/* Panel: Imágenes del proyecto (se abre desde el header) */}
      <PixelModal open={showImagesModal} onClose={() => setShowImagesModal(false)} title={`Imágenes del proyecto (${projectImages.length}/30)`} size="md">
        <div className="space-y-3">
          {canEditImages && projectImages.length < 30 && (
            <label className="inline-flex items-center gap-1.5 text-[12px] text-accent border border-accent/40 rounded px-3 py-1.5 hover:bg-accent-light transition-colors cursor-pointer" style={mf}>
              <Plus className="w-4 h-4" /> {uploadingImages ? 'Subiendo…' : 'Subir imágenes'}
              <input type="file" accept="image/*" multiple onChange={handleImageUpload} disabled={uploadingImages} className="hidden" />
            </label>
          )}
          {projectImages.length === 0 ? (
            <p className="text-[12px] text-digi-muted text-center py-6" style={mf}>Sin imágenes aún.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {projectImages.map((img, idx) => (
                <div key={idx} className="relative group aspect-square border border-digi-border/50 overflow-hidden bg-digi-darker rounded">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt={`Imagen ${idx + 1}`} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setPreviewImage(img)} />
                  {canEditImages && (
                    <button onClick={() => handleImageDelete(idx)} disabled={deletingImageIdx === idx} title="Eliminar imagen"
                      className="absolute top-0.5 right-0.5 w-5 h-5 flex items-center justify-center rounded bg-red-600/90 text-white text-[11px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700">
                      {deletingImageIdx === idx ? '…' : '✕'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </PixelModal>

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
                    <button onClick={() => canEditThis && toggleSubItem(item.id, !item.is_completed)} disabled={!canEditThis || editingItemId === item.id} aria-label={item.is_completed ? 'Marcar incompleto' : 'Marcar completo'} className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${item.is_completed ? 'bg-accent border-accent text-white' : 'border-digi-border bg-white'} ${canEditThis && editingItemId !== item.id ? 'cursor-pointer hover:border-accent' : ''}`}>
                      {item.is_completed && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                    {/* La subtarea se edita en una ventanita centrada (un campo), no aquí encima. */}
                    <span className={`text-[13px] flex-1 break-words ${item.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{item.title}</span>
                    {canEditThis && (
                      <>
                        <button onClick={() => startEditItem(item)} aria-label="Editar subtarea" title="Editar" className="text-digi-muted/50 hover:text-accent transition-colors opacity-0 group-hover:opacity-100 shrink-0"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteSubItem(item.id)} aria-label="Eliminar subtarea" className="text-digi-muted/60 hover:text-red-600 transition-colors text-[16px] leading-none px-1 shrink-0">×</button>
                      </>
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

          {/* Talentos: OBLIGATORIO. Es lo que permite encontrar el proyecto desde el
              filtro por talentos del Marketplace y de Proyectos. */}
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Talentos requeridos *</label>
            <MultiSelectSearch
              options={talentOptions}
              selected={reqTalents}
              onChange={setReqTalents}
              placeholder="Busca el talento que necesita este requerimiento…"
            />
            <span className="text-[11px] text-digi-muted" style={mf}>
              Con esto el requerimiento aparece a quien busque por ese talento.
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-digi-text opacity-70" style={pf}>Plazas</label>
            <input value={reqSlots} onChange={(e) => setReqSlots(e.target.value)} type="number" min={1} placeholder="1"
              className="w-full px-3 py-2 field-control bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none" style={mf} />
            <span className="text-[11px] text-digi-muted" style={mf}>Cuántas personas se necesitan para este requerimiento.</span>
          </div>

          <button onClick={addRequirement} disabled={savingReq || !reqTitle.trim() || reqTalents.length === 0} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
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

      {/* Cotización: chat GCC Bot junto a los botones de chat (a su izquierda, mismo tamaño). */}
      {project.status === 'cotizacion' && <GccBotChat projectId={project.id} onChanged={fetchProject} side="dock" />}
      {/* Modal de compartir acceso (se abre desde el header). */}
      {project.status === 'cotizacion' && isOwner && <QuoteShareButton projectId={project.id} open={showShare} onClose={() => setShowShare(false)} />}

      {/* ============================================================================
          EDICIÓN — nunca inline. Formularios → panel lateral derecho (`EditPanel`);
          uno o dos campos sueltos → ventanita centrada (`QuickEditDialog`).
          ============================================================================ */}

      {/* Requerimiento (formulario) — panel lateral derecho */}
      <EditPanel
        open={editingReqId != null}
        title="Editar requerimiento"
        onClose={() => setEditingReqId(null)}
        onSave={saveReqEdit}
        saving={savingReqEdit}
        canSave={!!editReqData.title.trim() && editReqData.talents.length > 0}
      >
        <EditField label="Título">
          <input value={editReqData.title} onChange={(e) => setEditReqData((d) => ({ ...d, title: e.target.value }))}
            autoFocus placeholder="Título del requerimiento" className={EDIT_INPUT} style={mf} />
        </EditField>
        <EditField label="Descripción">
          <textarea value={editReqData.description} onChange={(e) => setEditReqData((d) => ({ ...d, description: e.target.value }))}
            rows={4} placeholder="Descripción detallada… (opcional)" className={`${EDIT_INPUT} resize-y`} style={mf} />
        </EditField>
        <EditField label="Costo ($)">
          <input value={editReqData.cost} onChange={(e) => setEditReqData((d) => ({ ...d, cost: e.target.value }))}
            type="number" placeholder="0.00 (opcional)" className={`${EDIT_INPUT} tabular-nums`} style={mf} />
        </EditField>
        <EditField label="Talentos requeridos *" hint="Con esto el requerimiento aparece a quien busque por ese talento.">
          <MultiSelectSearch
            options={talentOptions}
            selected={editReqData.talents}
            onChange={(v: string[]) => setEditReqData((d) => ({ ...d, talents: v }))}
            placeholder="Busca el talento que necesita este requerimiento…"
          />
        </EditField>
        <EditField label="Plazas" hint="Cuántas personas se necesitan para este requerimiento.">
          <input value={editReqData.slots} onChange={(e) => setEditReqData((d) => ({ ...d, slots: e.target.value }))}
            type="number" min={1} placeholder="1" className={`${EDIT_INPUT} tabular-nums`} style={mf} />
        </EditField>
      </EditPanel>

      {/* Descripción del proyecto (campo rico) — panel lateral derecho */}
      <EditPanel
        open={editingDesc}
        title="Editar descripción"
        onClose={() => setEditingDesc(false)}
        saving={savingDesc}
        onSave={async () => {
          setSavingDesc(true);
          try {
            const res = await fetch(`/api/projects/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: editDesc }) });
            if (!res.ok) throw new Error((await res.json()).error || 'Error');
            setEditingDesc(false); await fetchProject(); toast.success('Descripción actualizada');
          } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
          finally { setSavingDesc(false); }
        }}
      >
        <EditField label="Descripción del proyecto">
          <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={12} placeholder="Descripción del proyecto…"
            className={`${EDIT_INPUT} resize-y`} style={mf} />
        </EditField>
      </EditPanel>

      {/* Nombre del proyecto (un campo) — ventanita centrada */}
      <QuickEditDialog
        open={editingTitle}
        title="Editar nombre"
        onClose={() => setEditingTitle(false)}
        onSave={saveTitle}
        canSave={!!editTitle.trim()}
      >
        <EditField label="Nombre del proyecto">
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus className={EDIT_INPUT} style={mf} />
        </EditField>
      </QuickEditDialog>

      {/* Cliente (un campo) — ventanita centrada */}
      <QuickEditDialog
        open={editingClient}
        title="Cambiar cliente"
        onClose={() => setEditingClient(false)}
        saving={savingClient}
        canSave={!!(editClient.clientId || editClient.clientEmail)}
        onSave={async () => {
          setSavingClient(true);
          try {
            await saveField(editClient.clientId ? { client_id: Number(editClient.clientId) } : { client_email: editClient.clientEmail });
            setEditingClient(false); toast.success('Cliente actualizado');
          } catch (e: any) { toast.error(e.message || 'Error al guardar'); }
          finally { setSavingClient(false); }
        }}
      >
        {/* Alto mínimo para que el desplegable del buscador quepa sin recortarse. */}
        <div className="min-h-[260px]">
          <EditField label="Cliente" hint="Si el correo no tiene cuenta, se registra y se le invita a crearla.">
            <ClientPicker clientId={editClient.clientId} clientEmail={editClient.clientEmail} onChange={setEditClient} label="" />
          </EditField>
        </div>
      </QuickEditDialog>

      {/* Presupuesto (dos campos) — ventanita centrada */}
      <QuickEditDialog
        open={editingBudget}
        title="Editar presupuesto"
        onClose={() => setEditingBudget(false)}
        onSave={saveBudget}
      >
        <div className="grid grid-cols-2 gap-3">
          <EditField label="Mínimo ($)">
            <input value={editBudgetMin} onChange={(e) => setEditBudgetMin(e.target.value)} type="number" placeholder="0.00" autoFocus className={`${EDIT_INPUT} tabular-nums`} style={mf} />
          </EditField>
          <EditField label="Máximo ($)">
            <input value={editBudgetMax} onChange={(e) => setEditBudgetMax(e.target.value)} type="number" placeholder="0.00" className={`${EDIT_INPUT} tabular-nums`} style={mf} />
          </EditField>
        </div>
      </QuickEditDialog>

      {/* Fecha límite (un campo) — ventanita centrada */}
      <QuickEditDialog
        open={editingDeadline}
        title="Editar fecha límite"
        onClose={() => setEditingDeadline(false)}
        onSave={saveDeadline}
      >
        <EditField label="Fecha límite" hint="Déjala vacía para quitar el límite.">
          <input value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} type="date" autoFocus className={EDIT_INPUT} style={mf} />
        </EditField>
      </QuickEditDialog>

      {/* Subtarea (un campo) — ventanita centrada, sobre el panel de Subtareas */}
      <QuickEditDialog
        open={editingItemId != null}
        title="Editar subtarea"
        onClose={() => setEditingItemId(null)}
        onSave={saveItemEdit}
        saving={savingItemEdit}
        canSave={!!editItemText.trim()}
      >
        <EditField label="Subtarea">
          <input value={editItemText} onChange={(e) => setEditItemText(e.target.value)} autoFocus className={EDIT_INPUT} style={mf} />
        </EditField>
      </QuickEditDialog>
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
