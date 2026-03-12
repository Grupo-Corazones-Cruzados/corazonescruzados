"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Input, Select, Spinner, Modal } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import {
  PROJECT_STATUS_LABELS,
  PUBLIC_PROJECT_TRANSITIONS,
  BID_STATUS_LABELS,
  BID_STATUS_BADGE,
  PAYMENT_ACCOUNT,
} from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ProjectStatus, BidStatus } from "@/lib/types";
import styles from "./page.module.css";

interface ProjectDetail {
  id: number;
  client_id: number;
  title: string;
  description: string | null;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  is_private: boolean;
  share_token: string | null;
  final_cost: number | null;
  confirmed_at: string | null;
  completion_notified_at: string | null;
  review_deadline: string | null;
  penalty_applied: boolean;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  client_email: string | null;
}

interface ProjectPaymentInfo {
  id: number;
  amount: number;
  proof_url: string;
  status: string;
  confirmer_email: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Bid {
  id: number;
  member_id: number;
  member_name: string;
  member_photo_url: string | null;
  proposal: string | null;
  bid_amount: number | null;
  estimated_days: number | null;
  requirement_ids: number[];
  work_dates: string[];
  status: string;
  created_at: string;
}

interface Requirement {
  id: number;
  title: string;
  description: string | null;
  cost: number | null;
  completed_at: string | null;
}

interface ReqItem {
  id: number;
  requirement_id: number;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

interface CancelVote {
  id: number;
  member_id: number;
  member_name: string;
  member_photo_url: string | null;
  vote: "approve" | "reject";
  comment: string | null;
  created_at: string;
}

interface CancelRequest {
  id: number;
  reason: string;
  status: string;
  requester_email: string;
  resolver_email: string | null;
  created_at: string;
  resolved_at: string | null;
  votes: CancelVote[];
}

interface CancelMeta {
  total_requests: number;
  has_pending: boolean;
  max_requests: number;
  total_accepted_members: number;
}

interface AcceptedMember {
  id: number;
  bid_id: number;
  name: string;
  email: string | null;
  photo_url: string | null;
  position_name: string | null;
  bid_amount: number | null;
  estimated_days: number | null;
  proposal: string | null;
  requirement_ids: number[];
  work_dates: string[];
}

interface AssignmentInfo {
  id: number;
  requirement_id: number;
  project_id: number;
  member_id: number;
  proposed_cost: number;
  member_cost: number | null;
  status: string;
  created_at: string;
  member_name: string;
  member_photo_url: string | null;
  requirement_title: string;
}

interface MemberOption {
  id: number;
  name: string;
  photo_url: string | null;
  position_name: string | null;
}

const STATUS_BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  open: "info",
  in_progress: "warning",
  review: "warning",
  completed: "success",
  cancelled: "error",
  on_hold: "default",
  closed: "success",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [cancelRequests, setCancelRequests] = useState<CancelRequest[]>([]);
  const [acceptedMembers, setAcceptedMembers] = useState<AcceptedMember[]>([]);
  const [reqItems, setReqItems] = useState<ReqItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Status transition
  const [nextStatus, setNextStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // Requirement modal
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [savingReq, setSavingReq] = useState(false);

  // Bid modal
  const [showBidModal, setShowBidModal] = useState(false);
  const [bidMemberId, setBidMemberId] = useState("");
  const [bidProposal, setBidProposal] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidDays, setBidDays] = useState("");
  const [savingBid, setSavingBid] = useState(false);
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string }[]>([]);

  // Cancel modal
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [savingCancel, setSavingCancel] = useState(false);
  const [cancelMeta, setCancelMeta] = useState<CancelMeta>({ total_requests: 0, has_pending: false, max_requests: 3, total_accepted_members: 0 });
  const [votingCancel, setVotingCancel] = useState(false);

  // Invite modal
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedInvites, setSelectedInvites] = useState<number[]>([]);
  const [savingInvite, setSavingInvite] = useState(false);
  const inviteDropdownRef = useRef<HTMLDivElement>(null);
  const [inviteDropdownOpen, setInviteDropdownOpen] = useState(false);

  // Confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Proposal submission (invited member)
  const [myProposal, setMyProposal] = useState("");
  const [myBidAmount, setMyBidAmount] = useState("");
  const [myReqIds, setMyReqIds] = useState<number[]>([]);
  const [myWorkDates, setMyWorkDates] = useState<string[]>([]);
  const [submittingProposal, setSubmittingProposal] = useState(false);

  // AI generation state
  const [generatingAI, setGeneratingAI] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiReqId, setAiReqId] = useState<number | null>(null);
  const [aiReqTitle, setAiReqTitle] = useState("");
  const [aiUpdateText, setAiUpdateText] = useState("");

  // Completion flow
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completionAction, setCompletionAction] = useState<string | null>(null);
  const [newDeadline, setNewDeadline] = useState("");
  const [newReqText, setNewReqText] = useState("");
  const [reviewDeadline, setReviewDeadline] = useState("");
  const [savingCompletion, setSavingCompletion] = useState(false);

  // Payment flow
  const [payments, setPayments] = useState<ProjectPaymentInfo[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [proofUrl, setProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Requirement assignments
  const [assignments, setAssignments] = useState<AssignmentInfo[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignReqId, setAssignReqId] = useState<number | null>(null);
  const [assignMemberId, setAssignMemberId] = useState("");
  const [assignProposedCost, setAssignProposedCost] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);
  // Member counter-proposal
  const [counterCost, setCounterCost] = useState("");
  const [savingCounter, setSavingCounter] = useState(false);

  const isClient = user?.role === "client";
  const isMember = user?.role === "member";
  const isAdmin = user?.role === "admin";

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProject(json.data);
    } catch {
      toast("Error al cargar proyecto", "error");
      router.push("/dashboard/projects");
    }
  }, [projectId, toast, router]);

  const fetchBids = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/bids`);
      const json = await res.json();
      setBids(json.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  const fetchRequirements = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements`);
      const json = await res.json();
      setRequirements(json.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  const fetchCancelRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel`);
      const json = await res.json();
      setCancelRequests(json.data || []);
      setCancelMeta({
        total_requests: json.total_requests || 0,
        has_pending: json.has_pending || false,
        max_requests: json.max_requests || 3,
        total_accepted_members: json.total_accepted_members || 0,
      });
    } catch { /* silent */ }
  }, [projectId]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const json = await res.json();
      setAcceptedMembers(json.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  const fetchReqItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/items`);
      const json = await res.json();
      setReqItems(json.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/payment`);
      const json = await res.json();
      setPayments(json.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/assign`);
      const json = await res.json();
      setAssignments(json.data || []);
    } catch { /* silent */ }
  }, [projectId]);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      await Promise.all([
        fetchProject(),
        fetchBids(),
        fetchRequirements(),
        fetchCancelRequests(),
        fetchMembers(),
        fetchReqItems(),
        fetchPayments(),
        fetchAssignments(),
      ]);
      setLoading(false);
    }
    loadAll();
  }, [fetchProject, fetchBids, fetchRequirements, fetchCancelRequests, fetchMembers, fetchReqItems, fetchPayments, fetchAssignments]);

  // Close invite dropdown on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (inviteDropdownRef.current && !inviteDropdownRef.current.contains(e.target as Node)) {
        setInviteDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Available transitions
  const availableTransitions = project
    ? PUBLIC_PROJECT_TRANSITIONS[project.status as ProjectStatus] || []
    : [];

  // Estimated cost from accepted bids
  const estimatedCost = bids
    .filter((b) => b.status === "accepted" && b.bid_amount != null)
    .reduce((s, b) => s + (b.bid_amount || 0), 0);

  // Can confirm: has accepted bids, has requirements, not yet confirmed
  const canConfirm =
    project &&
    !project.confirmed_at &&
    acceptedMembers.length > 0 &&
    requirements.length > 0;

  // Taken requirement IDs (covered by accepted bids)
  const takenReqIds = new Set(
    bids.filter((b) => b.status === "accepted").flatMap((b) => b.requirement_ids || [])
  );
  const hasUntakenReqs = requirements.some((r) => !takenReqIds.has(r.id));

  // Can invite: private project, owner or admin, and untaken requirements exist
  const canInvite =
    project &&
    project.is_private &&
    hasUntakenReqs &&
    (isClient || isAdmin);

  // Status change
  const handleStatusChange = async () => {
    if (!nextStatus) return;
    setSavingStatus(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error();
      toast("Estado actualizado", "success");
      setNextStatus("");
      fetchProject();
    } catch {
      toast("Error al actualizar", "error");
    } finally {
      setSavingStatus(false);
    }
  };

  // Publish draft project (shared or private)
  const handlePublish = async (asPrivate: boolean) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: asPrivate ? "in_progress" : "open",
          is_private: asPrivate,
        }),
      });
      if (!res.ok) throw new Error();
      toast(
        asPrivate ? "Proyecto publicado como privado" : "Proyecto publicado como compartido",
        "success"
      );
      fetchProject();
    } catch {
      toast("Error al publicar", "error");
    } finally {
      setPublishing(false);
    }
  };

  // Toggle privacy for confirmed projects
  const handleTogglePrivacy = async (makePrivate: boolean) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_private: makePrivate }),
      });
      if (!res.ok) throw new Error();
      toast(makePrivate ? "Proyecto ahora es privado" : "Proyecto compartido", "success");
      fetchProject();
    } catch {
      toast("Error al cambiar visibilidad", "error");
    } finally {
      setPublishing(false);
    }
  };

  // Completion action
  const handleCompletionAction = async () => {
    if (!completionAction) return;
    setSavingCompletion(true);
    try {
      if (completionAction === "more_requirements") {
        if (!newDeadline) {
          toast("Debes especificar una nueva fecha fin", "error");
          return;
        }
        if (!newReqText.trim()) {
          toast("Debes describir al menos un requerimiento", "error");
          return;
        }
        // 1. Update project deadline and status
        const res = await fetch(`/api/projects/${projectId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "more_requirements", new_deadline: newDeadline }),
        });
        if (!res.ok) {
          const json = await res.json();
          toast(json.error || "Error", "error");
          return;
        }
        // 2. Create the requirement
        const reqRes = await fetch(`/api/projects/${projectId}/requirements`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newReqText.trim() }),
        });
        if (reqRes.ok) {
          const reqJson = await reqRes.json();
          // 3. Generate with AI
          if (reqJson.data?.id) {
            await fetch(`/api/projects/${projectId}/generate`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ requirement_id: reqJson.data.id, raw_text: newReqText.trim() }),
            });
          }
        }
        toast("Requerimiento creado y proyecto actualizado", "success");
        setShowCompletionModal(false);
        setCompletionAction(null);
        setNewDeadline("");
        setNewReqText("");
        fetchProject();
        fetchRequirements();
      } else if (completionAction === "confirm_completion") {
        setShowCompletionModal(false);
        setShowPaymentModal(true);
      } else if (completionAction === "request_review") {
        if (!reviewDeadline) {
          toast("Debes especificar una fecha de revisión", "error");
          return;
        }
        const res = await fetch(`/api/projects/${projectId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "request_review", review_deadline: reviewDeadline }),
        });
        if (!res.ok) {
          const json = await res.json();
          toast(json.error || "Error", "error");
          return;
        }
        toast("Proyecto en revisión", "success");
        setShowCompletionModal(false);
        setCompletionAction(null);
        setReviewDeadline("");
        fetchProject();
      }
    } catch {
      toast("Error", "error");
    } finally {
      setSavingCompletion(false);
    }
  };

  // Upload proof
  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast("Máximo 5MB", "error");
      return;
    }
    setUploadingProof(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "payments");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProofUrl(json.url);
    } catch {
      toast("Error al subir imagen", "error");
    } finally {
      setUploadingProof(false);
    }
  };

  // Submit payment
  const handleSubmitPayment = async () => {
    if (!proofUrl) {
      toast("Debes subir un comprobante de pago", "error");
      return;
    }
    setSavingPayment(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proof_url: proofUrl }),
      });
      if (!res.ok) throw new Error();
      toast("Comprobante enviado. El proyecto está completado.", "success");
      setShowPaymentModal(false);
      setProofUrl("");
      fetchProject();
      fetchPayments();
    } catch {
      toast("Error", "error");
    } finally {
      setSavingPayment(false);
    }
  };

  // Admin confirm payment
  const handleConfirmPayment = async (paymentId: number, status: "confirmed" | "rejected") => {
    try {
      const res = await fetch(`/api/projects/${projectId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId, status }),
      });
      if (!res.ok) throw new Error();
      toast(status === "confirmed" ? "Pago confirmado" : "Pago rechazado", "success");
      fetchPayments();
      fetchProject();
    } catch {
      toast("Error", "error");
    }
  };

  // Assign requirement to member
  const openAssignModal = (reqId: number) => {
    setAssignReqId(reqId);
    setAssignMemberId("");
    setAssignProposedCost("");
    setShowAssignModal(true);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignReqId || !assignMemberId || !assignProposedCost) return;
    setSavingAssign(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_id: assignReqId,
          member_id: Number(assignMemberId),
          proposed_cost: Number(assignProposedCost),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Error", "error");
        return;
      }
      toast("Asignación enviada al miembro", "success");
      setShowAssignModal(false);
      fetchAssignments();
    } catch {
      toast("Error al asignar", "error");
    } finally {
      setSavingAssign(false);
    }
  };

  // Member submits counter-proposal
  const handleSubmitCounter = async (assignmentId: number) => {
    if (!counterCost || Number(counterCost) <= 0) {
      toast("Ingresa un costo válido", "error");
      return;
    }
    setSavingCounter(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignmentId,
          action: "counter",
          member_cost: Number(counterCost),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Error", "error");
        return;
      }
      toast("Contrapropuesta enviada", "success");
      setCounterCost("");
      fetchAssignments();
    } catch {
      toast("Error", "error");
    } finally {
      setSavingCounter(false);
    }
  };

  // Creator accepts/rejects counter-proposal
  const handleResolveAssignment = async (assignmentId: number, action: "accept" | "reject") => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId, action }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Error", "error");
        return;
      }
      toast(action === "accept" ? "Asignación aceptada" : "Asignación rechazada", "success");
      fetchAssignments();
      fetchBids();
      fetchMembers();
      fetchProject();
      fetchRequirements();
    } catch {
      toast("Error", "error");
    }
  };

  // AI generation
  const openAIModal = (reqId: number, reqTitle: string) => {
    setAiReqId(reqId);
    setAiReqTitle(reqTitle);
    setAiUpdateText("");
    setShowAIModal(true);
  };

  const handleAIUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiReqId || !aiUpdateText.trim()) return;
    setGeneratingAI(true);
    setShowAIModal(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: aiReqId, raw_text: aiUpdateText }),
      });
      if (!res.ok) throw new Error();
      toast("Requerimiento actualizado con IA", "success");
      fetchRequirements();
    } catch {
      toast("Error al generar con IA", "error");
      fetchRequirements();
    } finally {
      setGeneratingAI(false);
    }
  };

  const generateRequirementAI = async (requirementId: number, rawText: string) => {
    setGeneratingAI(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: requirementId, raw_text: rawText }),
      });
      if (!res.ok) throw new Error();
      toast("Requerimiento actualizado con IA", "success");
      fetchRequirements();
    } catch {
      toast("Error al generar con IA", "error");
      fetchRequirements();
    } finally {
      setGeneratingAI(false);
    }
  };

  // Add requirement
  const handleAddReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReq(true);
    try {
      const rawText = reqTitle;
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reqTitle,
          description: reqDesc || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setShowReqModal(false);
      setReqTitle("");
      setReqDesc("");

      if (json.data?.id) {
        await generateRequirementAI(json.data.id, rawText);
      } else {
        fetchRequirements();
      }
    } catch {
      toast("Error", "error");
    } finally {
      setSavingReq(false);
    }
  };

  // Toggle requirement complete (optimistic)
  const toggleReq = async (req: Requirement) => {
    const wasCompleted = req.completed_at;
    // Optimistic update
    setRequirements((prev) =>
      prev.map((r) =>
        r.id === req.id
          ? { ...r, completed_at: wasCompleted ? null : new Date().toISOString() }
          : r
      )
    );
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_id: req.id,
          completed: !wasCompleted,
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on error
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === req.id ? { ...r, completed_at: wasCompleted } : r
        )
      );
      toast("Error", "error");
    }
  };

  // Delete requirement
  const deleteReq = async (reqId: number) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: reqId }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Error", "error");
        return;
      }
      toast("Eliminado", "success");
      fetchRequirements();
      fetchBids();
    } catch {
      toast("Error", "error");
    }
  };

  // Open bid modal
  const openBidModal = async () => {
    try {
      const res = await fetch("/api/members?per_page=200&active_only=true");
      const json = await res.json();
      setMemberOptions(
        (json.data || []).map((m: { id: number; name: string }) => ({
          value: String(m.id),
          label: m.name,
        }))
      );
    } catch { /* silent */ }
    setShowBidModal(true);
  };

  const handleAddBid = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBid(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: Number(bidMemberId),
          proposal: bidProposal,
          bid_amount: Number(bidAmount),
          estimated_days: bidDays ? Number(bidDays) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Propuesta agregada", "success");
      setShowBidModal(false);
      setBidMemberId("");
      setBidProposal("");
      setBidAmount("");
      setBidDays("");
      fetchBids();
    } catch {
      toast("Error", "error");
    } finally {
      setSavingBid(false);
    }
  };

  // Submit proposal (invited member)
  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myBid) return;
    if (myWorkDates.length === 0) {
      toast("Selecciona al menos un día de trabajo", "error");
      return;
    }
    if (myReqIds.length === 0) {
      toast("Selecciona al menos un requerimiento", "error");
      return;
    }
    setSubmittingProposal(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bid_id: myBid.id,
          proposal: myProposal,
          bid_amount: Number(myBidAmount),
          requirement_ids: myReqIds,
          work_dates: myWorkDates.sort(),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Propuesta enviada", "success");
      setMyProposal("");
      setMyBidAmount("");
      setMyReqIds([]);
      setMyWorkDates([]);
      fetchBids();
    } catch {
      toast("Error al enviar propuesta", "error");
    } finally {
      setSubmittingProposal(false);
    }
  };

  const toggleReqSelection = (reqId: number) => {
    setMyReqIds((prev) =>
      prev.includes(reqId) ? prev.filter((id) => id !== reqId) : [...prev, reqId]
    );
  };

  const toggleWorkDate = (dateStr: string) => {
    setMyWorkDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Accept/reject bid
  const handleBidAction = async (bidId: number, status: "accepted" | "rejected") => {
    try {
      await fetch(`/api/projects/${projectId}/bids`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bid_id: bidId, status }),
      });
      toast(status === "accepted" ? "Propuesta aceptada" : "Propuesta rechazada", "success");
      fetchBids();
      fetchMembers();
      fetchProject();
    } catch {
      toast("Error", "error");
    }
  };

  // Invite members
  const openInviteModal = async () => {
    try {
      const res = await fetch("/api/members?per_page=200&active_only=true");
      const json = await res.json();
      setAllMembers(
        ((json.data || []) as MemberOption[]).sort((a: MemberOption, b: MemberOption) =>
          a.name.localeCompare(b.name)
        )
      );
    } catch { /* silent */ }
    setSelectedInvites([]);
    setInviteSearch("");
    setShowInviteModal(true);
  };

  const alreadyInvitedIds = bids.map((b) => b.member_id);
  const filteredInviteMembers = allMembers.filter(
    (m) =>
      !alreadyInvitedIds.includes(m.id) &&
      !selectedInvites.includes(m.id) &&
      (m.name.toLowerCase().includes(inviteSearch.toLowerCase()) ||
        (m.position_name || "").toLowerCase().includes(inviteSearch.toLowerCase()))
  );

  const handleInvite = async () => {
    if (selectedInvites.length === 0) return;
    setSavingInvite(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_ids: selectedInvites }),
      });
      if (!res.ok) throw new Error();
      toast("Invitaciones enviadas", "success");
      setShowInviteModal(false);
      setSelectedInvites([]);
      fetchBids();
    } catch {
      toast("Error al invitar", "error");
    } finally {
      setSavingInvite(false);
    }
  };

  // Confirm project
  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Error");
      }
      toast("Proyecto confirmado", "success");
      setShowConfirmModal(false);
      fetchProject();
      fetchBids();
      fetchRequirements();
      fetchMembers();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al confirmar", "error");
    } finally {
      setConfirming(false);
    }
  };

  // Cancel request
  const handleCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCancel(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Error", "error");
        return;
      }
      toast("Solicitud de cancelación enviada", "success");
      setShowCancelModal(false);
      setCancelReason("");
      fetchCancelRequests();
    } catch {
      toast("Error", "error");
    } finally {
      setSavingCancel(false);
    }
  };

  // Vote on cancel request
  const handleCancelVote = async (requestId: number, vote: "approve" | "reject") => {
    setVotingCancel(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/cancel/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, vote }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast(json.error || "Error", "error");
        return;
      }
      toast(vote === "approve" ? "Voto: aprobar cancelación" : "Voto: rechazar cancelación", "success");
      fetchCancelRequests();
      fetchProject();
    } catch {
      toast("Error al votar", "error");
    } finally {
      setVotingCancel(false);
    }
  };

  // Resolve cancel request (admin only)
  const resolveCancel = async (requestId: number, status: "approved" | "rejected") => {
    try {
      await fetch(`/api/projects/${projectId}/cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId, status }),
      });
      toast(status === "approved" ? "Cancelación aprobada" : "Cancelación rechazada", "success");
      fetchCancelRequests();
      fetchProject();
    } catch {
      toast("Error", "error");
    }
  };

  // Delete project
  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de eliminar este proyecto?")) return;
    try {
      await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      toast("Proyecto eliminado", "success");
      router.push("/dashboard/projects");
    } catch {
      toast("Error al eliminar", "error");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
      </div>
    );
  }

  if (!project) return null;

  const totalReqCost = requirements.reduce((s, r) => s + (r.cost || 0), 0);
  const completedReqs = requirements.filter((r) => r.completed_at).length;
  const allReqsCompleted = requirements.length > 0 && completedReqs === requirements.length;

  // Only the project owner (matching client) or admin can change visibility/publish
  const isOwner = isAdmin || (isClient && project.client_email?.toLowerCase() === user?.email?.toLowerCase());

  // Current member's bid (if any)
  const myBid = isMember && user?.member_id
    ? bids.find((b) => b.member_id === user.member_id)
    : null;
  const isInvited = myBid?.status === "invited";
  const isAcceptedMember = myBid?.status === "accepted";

  // Can edit project content (add requirements, etc.)
  const canEditContent = isOwner || isAcceptedMember;
  // Requirements assigned to the current accepted member
  const myReqIdsSet = new Set(myBid?.requirement_ids || []);

  return (
    <div>
      <PageHeader
        title={`Proyecto #${project.id}`}
        description={project.title}
        action={
          <div className={styles.headerActions}>
            <Button variant="ghost" onClick={() => router.push("/dashboard/projects")}>
              Volver
            </Button>
            {!project.is_private && project.share_token && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `${window.location.origin}/p/${project.share_token}`
                  );
                  toast("Enlace copiado", "success");
                }}
              >
                Copiar enlace
              </Button>
            )}
            {isAdmin && (
              <Button variant="danger" size="sm" onClick={handleDelete}>
                Eliminar
              </Button>
            )}
          </div>
        }
      />

      <div className={styles.grid}>
        <div className={styles.main}>
          {/* Status + Description */}
          <Card>
            <div className={styles.mainContent}>
              <div className={styles.statusSection}>
                <Badge variant={STATUS_BADGE_VARIANT[project.status] || "default"}>
                  {PROJECT_STATUS_LABELS[project.status as ProjectStatus] || project.status}
                </Badge>
                {project.status === "draft" && isOwner ? (
                  <div className={styles.publishActions}>
                    <Button
                      size="sm"
                      onClick={() => handlePublish(false)}
                      isLoading={publishing}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                      Publicar compartido
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePublish(true)}
                      isLoading={publishing}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                      Publicar privado
                    </Button>
                  </div>
                ) : project.status === "open" && !project.is_private && isOwner ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePublish(true)}
                    isLoading={publishing}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    Cambiar a privado
                  </Button>
                ) : project.status === "in_progress" && project.is_private && !project.confirmed_at && isOwner ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handlePublish(false)}
                    isLoading={publishing}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Cambiar a compartido
                  </Button>
                ) : project.confirmed_at && isOwner ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleTogglePrivacy(!project.is_private)}
                    isLoading={publishing}
                  >
                    {project.is_private ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Compartir proyecto
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Hacer privado
                      </>
                    )}
                  </Button>
                ) : availableTransitions.length > 0 && isOwner ? (
                  <div className={styles.statusRow}>
                    <Select
                      options={availableTransitions.map((s) => ({
                        value: s,
                        label: PROJECT_STATUS_LABELS[s] || s,
                      }))}
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value)}
                      placeholder="Siguiente estado..."
                    />
                    <Button
                      size="sm"
                      onClick={handleStatusChange}
                      isLoading={savingStatus}
                      disabled={!nextStatus}
                    >
                      Avanzar
                    </Button>
                  </div>
                ) : null}
              </div>

              {project.description && (
                <div className={styles.section}>
                  <h3 className={styles.sectionTitle}>Descripción</h3>
                  <p className={styles.description}>{project.description}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Completion banner for owner */}
          {allReqsCompleted && project.confirmed_at && isOwner && (project.status === "in_progress" || project.status === "review") && (
            <Card>
              <div className={styles.completionBanner}>
                <div className={styles.completionIcon}>✓</div>
                <h3 className={styles.completionTitle}>Todos los requerimientos han sido completados</h3>
                <p className={styles.completionDesc}>
                  Selecciona cómo deseas proceder con este proyecto:
                </p>
                <div className={styles.completionActions}>
                  <Button size="sm" onClick={() => { setCompletionAction("more_requirements"); setShowCompletionModal(true); }}>
                    Solicitar más requerimientos
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setCompletionAction("confirm_completion"); setShowCompletionModal(true); }}>
                    Confirmar completación
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => { setCompletionAction("request_review"); setShowCompletionModal(true); }}>
                    Solicitar revisión
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Payments section */}
          {payments.length > 0 && (
            <Card>
              <h3 className={styles.cardTitle}>Pagos</h3>
              <div className={styles.cancelList}>
                {payments.map((p) => (
                  <div key={p.id} className={styles.cancelItem}>
                    <div className={styles.cancelHeader}>
                      <span>{formatCurrency(p.amount)}</span>
                      <Badge variant={p.status === "confirmed" ? "success" : p.status === "rejected" ? "error" : "warning"}>
                        {p.status === "confirmed" ? "Confirmado" : p.status === "rejected" ? "Rechazado" : "Pendiente"}
                      </Badge>
                    </div>
                    <p className={styles.cancelDate}>{formatDate(p.created_at)}</p>
                    {p.proof_url && (
                      <a href={p.proof_url} target="_blank" rel="noopener noreferrer" className={styles.proofLink}>
                        Ver comprobante
                      </a>
                    )}
                    {p.status === "pending" && isAdmin && (
                      <div className={styles.bidActions}>
                        <Button size="sm" onClick={() => handleConfirmPayment(p.id, "confirmed")}>
                          Confirmar pago
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleConfirmPayment(p.id, "rejected")}>
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Proposal form for invited member */}
          {isInvited && (
            <Card>
              <h3 className={styles.cardTitle}>Enviar Propuesta</h3>
              <p className={styles.proposalHint}>
                Has sido invitado a este proyecto. Selecciona los requerimientos que atenderás,
                elige tus días de trabajo y envía tu propuesta.
              </p>
              <form onSubmit={handleSubmitProposal} className={styles.proposalForm}>
                {/* Requirement selection */}
                {requirements.length > 0 && (
                  <div className={styles.proposalSection}>
                    <label className={styles.textareaLabel}>Requerimientos a atender *</label>
                    <div className={styles.reqSelectList}>
                      {requirements.map((req) => (
                        <label key={req.id} className={styles.reqSelectItem}>
                          <input
                            type="checkbox"
                            checked={myReqIds.includes(req.id)}
                            onChange={() => toggleReqSelection(req.id)}
                          />
                          <div className={styles.reqSelectContent}>
                            <span className={styles.reqSelectTitle}>{req.title}</span>
                            {req.description && (
                              <span className={styles.reqSelectDesc}>{req.description}</span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.textareaBlock}>
                  <label className={styles.textareaLabel}>Propuesta *</label>
                  <textarea
                    className={styles.textareaField}
                    rows={4}
                    value={myProposal}
                    onChange={(e) => setMyProposal(e.target.value)}
                    placeholder="Describe tu propuesta, experiencia relevante y cómo abordarías este proyecto..."
                    required
                  />
                </div>

                <Input
                  label="Monto (costo) *"
                  type="number"
                  step="0.01"
                  value={myBidAmount}
                  onChange={(e) => setMyBidAmount(e.target.value)}
                  required
                />

                {/* Calendar date picker */}
                <div className={styles.proposalSection}>
                  <label className={styles.textareaLabel}>Días de trabajo *</label>
                  <CalendarPicker
                    selectedDates={myWorkDates}
                    onToggleDate={toggleWorkDate}
                    minDate={todayStr}
                    maxDate={project.deadline || undefined}
                  />
                  {myWorkDates.length > 0 && (
                    <div className={styles.selectedDatesInfo}>
                      {myWorkDates.length} día{myWorkDates.length !== 1 ? "s" : ""} seleccionado{myWorkDates.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {myWorkDates.length > 0 && (
                    <div className={styles.workDateChips}>
                      {myWorkDates.sort().map((d) => (
                        <span key={d} className={styles.workDateChip}>
                          {formatDate(d)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button type="submit" isLoading={submittingProposal} style={{ width: "100%" }}>
                  Enviar propuesta
                </Button>
              </form>
            </Card>
          )}

          {/* Members */}
          {acceptedMembers.length > 0 && (
            <Card>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>
                  Miembros del Proyecto ({acceptedMembers.length})
                </h3>
              </div>
              <div className={styles.bidList}>
                {acceptedMembers.map((m) => (
                  <div key={m.id} className={styles.bidItem}>
                    <div className={styles.bidHeader}>
                      <div className={styles.bidMember}>
                        <Avatar src={m.photo_url} name={m.name} size="sm" />
                        <strong>{m.name}</strong>
                        {m.position_name && (
                          <span className={styles.memberPosition}>{m.position_name}</span>
                        )}
                      </div>
                      {m.bid_amount != null && (
                        <span className={styles.memberBidAmount}>
                          {formatCurrency(m.bid_amount)}
                        </span>
                      )}
                    </div>
                    {m.proposal && (
                      <p className={styles.bidProposal}>{m.proposal}</p>
                    )}
                    {m.requirement_ids?.length > 0 && (
                      <div className={styles.bidReqs}>
                        <span className={styles.bidReqsLabel}>Requerimientos:</span>
                        {m.requirement_ids.map((rId) => {
                          const r = requirements.find((x) => x.id === rId);
                          return r ? (
                            <span key={rId} className={styles.bidReqChip}>{r.title}</span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {m.work_dates?.length > 0 && (
                      <>
                        <div className={styles.bidMeta}>
                          <span>{m.work_dates.length} día{m.work_dates.length !== 1 ? "s" : ""} de trabajo</span>
                        </div>
                        <div className={styles.workDateChips}>
                          {m.work_dates.sort().map((d) => (
                            <span key={d} className={styles.workDateChip}>
                              {formatDate(d)}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Requirements (hidden for invited members since they select them in the proposal form) */}
          {!isInvited && <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                Requerimientos ({completedReqs}/{requirements.length})
              </h3>
              {!project.confirmed_at && isOwner && (
                <Button size="sm" variant="secondary" onClick={() => setShowReqModal(true)}>
                  Agregar
                </Button>
              )}
            </div>
            {requirements.length === 0 && !generatingAI ? (
              <p className={styles.empty}>Sin requerimientos</p>
            ) : (
              <>
                <div className={styles.reqList}>
                  {generatingAI && (
                    <div className={styles.reqItem}>
                      <div className={styles.reqGenerating}>
                        <Spinner size="sm" />
                        <span>Generando requerimiento con IA...</span>
                      </div>
                    </div>
                  )}
                  {requirements.map((req) => {
                    const isMyReq = isAcceptedMember && myReqIdsSet.has(req.id);
                    const isTerminal = ["completed", "cancelled", "closed"].includes(project.status);
                    const hasAcceptedBid = bids.some(
                      (b) => b.status === "accepted" && b.requirement_ids?.includes(req.id)
                    );
                    const canEditReq = !isTerminal && (isMyReq || (isOwner && !hasAcceptedBid));
                    const canToggleReq = !isTerminal && isMyReq;
                    const canDeleteReq = isOwner && !hasAcceptedBid && !project.confirmed_at;
                    return (
                    <div
                      key={req.id}
                      className={`${styles.reqItem} ${req.completed_at ? styles.reqDone : ""}`}
                    >
                      <div className={styles.reqContent}>
                        {canToggleReq ? (
                          <label className={styles.reqCheck}>
                            <input
                              type="checkbox"
                              checked={!!req.completed_at}
                              onChange={() => toggleReq(req)}
                            />
                            <span className={styles.reqTitle}>{req.title}</span>
                          </label>
                        ) : (
                          <div className={styles.reqCheck}>
                            <input
                              type="checkbox"
                              checked={!!req.completed_at}
                              disabled
                            />
                            <span className={styles.reqTitle}>{req.title}</span>
                          </div>
                        )}
                        {req.description && (
                          <p className={styles.reqDesc}>{req.description}</p>
                        )}
                        {(() => {
                          const bidders = bids.filter(
                            (b) =>
                              b.requirement_ids?.includes(req.id) &&
                              (b.status === "pending" || b.status === "accepted")
                          );
                          if (bidders.length === 0) return null;
                          return (
                            <div className={styles.reqBidders}>
                              {bidders.map((b) => (
                                <span key={b.id} className={styles.reqBidderAvatar} title={b.member_name}>
                                  <Avatar src={b.member_photo_url} name={b.member_name} size="xs" />
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                        <RequirementItemList
                          reqId={req.id}
                          items={reqItems.filter((i) => i.requirement_id === req.id)}
                          canEdit={isAcceptedMember && myReqIdsSet.has(req.id)}
                          projectId={projectId}
                          onUpdate={fetchReqItems}
                        />
                        {/* Requirement assignments */}
                        {(() => {
                          const reqAssignments = assignments.filter((a) => a.requirement_id === req.id);
                          if (reqAssignments.length === 0) return null;
                          return (
                            <div className={styles.assignmentList}>
                              {reqAssignments.map((a) => {
                                const isMyAssignment = isMember && user?.member_id === a.member_id;
                                return (
                                  <div key={a.id} className={styles.assignmentItem}>
                                    <div className={styles.assignmentHeader}>
                                      <Avatar src={a.member_photo_url} name={a.member_name} size="xs" />
                                      <span className={styles.assignmentName}>{a.member_name}</span>
                                      <Badge
                                        variant={
                                          a.status === "accepted" ? "success"
                                            : a.status === "rejected" ? "error"
                                            : a.status === "counter" ? "info"
                                            : "warning"
                                        }
                                        size="sm"
                                      >
                                        {a.status === "proposed" ? "Propuesta"
                                          : a.status === "counter" ? "Contrapropuesta"
                                          : a.status === "accepted" ? "Aceptada"
                                          : "Rechazada"}
                                      </Badge>
                                    </div>
                                    <div className={styles.assignmentCosts}>
                                      <span>Propuesta: {formatCurrency(a.proposed_cost)}</span>
                                      {a.member_cost != null && (
                                        <span>Costo miembro: {formatCurrency(a.member_cost)}</span>
                                      )}
                                    </div>
                                    {/* Member counter-proposal form */}
                                    {(a.status === "proposed" || a.status === "rejected") && isMyAssignment && (
                                      <div className={styles.assignmentAction}>
                                        <Input
                                          label="Tu costo"
                                          type="number"
                                          step="0.01"
                                          value={counterCost}
                                          onChange={(e) => setCounterCost(e.target.value)}
                                          placeholder="Costo final..."
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => handleSubmitCounter(a.id)}
                                          isLoading={savingCounter}
                                          disabled={!counterCost}
                                        >
                                          Enviar contrapropuesta
                                        </Button>
                                      </div>
                                    )}
                                    {/* Owner accept/reject counter */}
                                    {a.status === "counter" && isOwner && (
                                      <div className={styles.bidActions}>
                                        <Button
                                          size="sm"
                                          onClick={() => handleResolveAssignment(a.id, "accept")}
                                        >
                                          Aceptar ({formatCurrency(a.member_cost!)})
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleResolveAssignment(a.id, "reject")}
                                        >
                                          Rechazar
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                      <div className={styles.reqMeta}>
                        {project.confirmed_at && req.cost != null && (
                          <span className={styles.reqCost}>{formatCurrency(req.cost)}</span>
                        )}
                        {/* Assign button: owner, confirmed project, untaken requirement, not terminal */}
                        {isOwner && project.confirmed_at && !hasAcceptedBid && !isTerminal && acceptedMembers.length > 0 && (
                          <button
                            className={styles.assignBtn}
                            title="Asignar miembro"
                            onClick={() => openAssignModal(req.id)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                              <line x1="19" y1="8" x2="19" y2="14" />
                              <line x1="22" y1="11" x2="16" y2="11" />
                            </svg>
                          </button>
                        )}
                        {canEditReq && !generatingAI && (
                          <button
                            className={styles.aiBtn}
                            title="Editar con IA"
                            onClick={() => openAIModal(req.id, req.title)}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              <path d="m15 5 4 4" />
                            </svg>
                          </button>
                        )}
                        {canDeleteReq && (
                          <button
                            className={styles.deleteBtn}
                            onClick={() => deleteReq(req.id)}
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
                {project.confirmed_at && totalReqCost > 0 && (
                  <div className={styles.totalRow}>
                    Total: <strong>{formatCurrency(totalReqCost)}</strong>
                  </div>
                )}
              </>
            )}
          </Card>}

          {/* Bids (exclude accepted — they show in Members section) */}
          {(() => {
            const pendingBids = bids.filter((b) => b.status !== "accepted");
            return (
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Propuestas ({pendingBids.length})</h3>
              <div className={styles.bidHeaderActions}>
                {canInvite && (
                  <Button size="sm" variant="secondary" onClick={openInviteModal}>
                    Invitar miembros
                  </Button>
                )}
                {!project.confirmed_at && isAdmin && (
                  <Button size="sm" variant="secondary" onClick={openBidModal}>
                    Agregar
                  </Button>
                )}
              </div>
            </div>
            {pendingBids.length === 0 ? (
              <p className={styles.empty}>Sin propuestas</p>
            ) : (
              <div className={styles.bidList}>
                {pendingBids.map((bid) => {
                  const bidStatus = bid.status as BidStatus;
                  return (
                    <div key={bid.id} className={styles.bidItem}>
                      <div className={styles.bidHeader}>
                        <div className={styles.bidMember}>
                          <Avatar src={bid.member_photo_url} name={bid.member_name} size="sm" />
                          <strong>{bid.member_name}</strong>
                        </div>
                        <Badge variant={BID_STATUS_BADGE[bidStatus] || "default"}>
                          {BID_STATUS_LABELS[bidStatus] || bid.status}
                        </Badge>
                      </div>
                      {bid.status === "invited" ? (
                        <p className={styles.bidWaiting}>Esperando propuesta...</p>
                      ) : (
                        <>
                          {bid.proposal && (
                            <p className={styles.bidProposal}>{bid.proposal}</p>
                          )}
                          {/* Requirements covered */}
                          {bid.requirement_ids?.length > 0 && (
                            <div className={styles.bidReqs}>
                              <span className={styles.bidReqsLabel}>Requerimientos:</span>
                              {bid.requirement_ids.map((rId) => {
                                const r = requirements.find((x) => x.id === rId);
                                return r ? (
                                  <span key={rId} className={styles.bidReqChip}>{r.title}</span>
                                ) : null;
                              })}
                            </div>
                          )}
                          <div className={styles.bidMeta}>
                            {bid.bid_amount != null && (
                              <span>{formatCurrency(bid.bid_amount)}</span>
                            )}
                            {bid.work_dates?.length > 0 && (
                              <span>{bid.work_dates.length} día{bid.work_dates.length !== 1 ? "s" : ""}</span>
                            )}
                            <span>{formatDate(bid.created_at)}</span>
                          </div>
                          {/* Work dates chips */}
                          {bid.work_dates?.length > 0 && (
                            <div className={styles.workDateChips}>
                              {bid.work_dates.sort().map((d) => (
                                <span key={d} className={styles.workDateChip}>
                                  {formatDate(d)}
                                </span>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                      {bid.status === "pending" && isOwner && (
                        <div className={styles.bidActions}>
                          <Button
                            size="sm"
                            onClick={() => handleBidAction(bid.id, "accepted")}
                          >
                            Aceptar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleBidAction(bid.id, "rejected")}
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
            );
          })()}

          {/* Cancellation requests */}
          {cancelRequests.length > 0 && (
            <Card>
              <h3 className={styles.cardTitle}>Solicitudes de Cancelación</h3>
              <div className={styles.cancelList}>
                {cancelRequests.map((cr) => {
                  const myVote = isAcceptedMember && user?.member_id
                    ? cr.votes?.find((v) => v.member_id === user.member_id)
                    : null;
                  const votedCount = cr.votes?.length || 0;
                  return (
                    <div key={cr.id} className={styles.cancelItem}>
                      <div className={styles.cancelHeader}>
                        <span>{cr.requester_email}</span>
                        <Badge
                          variant={
                            cr.status === "approved"
                              ? "error"
                              : cr.status === "rejected"
                              ? "default"
                              : "warning"
                          }
                        >
                          {cr.status === "approved"
                            ? "Aprobada"
                            : cr.status === "rejected"
                            ? "Rechazada"
                            : "Pendiente"}
                        </Badge>
                      </div>
                      <p className={styles.cancelReason}>{cr.reason}</p>
                      <p className={styles.cancelDate}>{formatDate(cr.created_at)}</p>

                      {/* Vote progress */}
                      {cr.status === "pending" && cancelMeta.total_accepted_members > 0 && (
                        <div className={styles.voteProgress}>
                          <span className={styles.voteProgressLabel}>
                            Votos: {votedCount} / {cancelMeta.total_accepted_members}
                          </span>
                          <div className={styles.voteProgressBar}>
                            <div
                              className={styles.voteProgressFill}
                              style={{ width: `${(votedCount / cancelMeta.total_accepted_members) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Votes list */}
                      {cr.votes && cr.votes.length > 0 && (
                        <div className={styles.voteList}>
                          {cr.votes.map((v) => (
                            <div key={v.id} className={styles.voteItem}>
                              <Avatar
                                src={v.member_photo_url}
                                name={v.member_name}
                                size="xs"
                              />
                              <span className={styles.voteName}>{v.member_name}</span>
                              <Badge
                                variant={v.vote === "approve" ? "success" : "error"}
                                size="sm"
                              >
                                {v.vote === "approve" ? "Aprueba" : "Rechaza"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Member vote actions */}
                      {cr.status === "pending" && isAcceptedMember && !myVote && (
                        <div className={styles.bidActions}>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleCancelVote(cr.id, "approve")}
                            isLoading={votingCancel}
                          >
                            Aprobar cancelación
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelVote(cr.id, "reject")}
                            isLoading={votingCancel}
                          >
                            Rechazar
                          </Button>
                        </div>
                      )}

                      {/* Admin override (for 3+ requests exhausted or any pending) */}
                      {cr.status === "pending" && isAdmin && (
                        <div className={styles.bidActions}>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => resolveCancel(cr.id, "approved")}
                          >
                            Forzar cancelación (Admin)
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => resolveCancel(cr.id, "rejected")}
                          >
                            Rechazar (Admin)
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <h3 className={styles.cardTitle}>Detalles</h3>
            <div className={styles.detailStack}>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>{project.client_name || "—"}</span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Presupuesto</span>
                <span className={styles.detailValue}>
                  {project.budget_min && project.budget_max
                    ? `${formatCurrency(project.budget_min)} — ${formatCurrency(project.budget_max)}`
                    : project.budget_max
                    ? formatCurrency(project.budget_max)
                    : "—"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Fecha límite</span>
                <span className={styles.detailValue}>
                  {project.deadline ? formatDate(project.deadline) : "—"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Tipo</span>
                <span className={styles.detailValue}>
                  {project.is_private ? "Privado" : "Público"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Creado</span>
                <span className={styles.detailValue}>{formatDate(project.created_at)}</span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Actualizado</span>
                <span className={styles.detailValue}>{formatDate(project.updated_at)}</span>
              </div>
              {project.review_deadline && (
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Revisión hasta</span>
                  <span className={styles.detailValue}>{formatDate(project.review_deadline)}</span>
                </div>
              )}
              {project.penalty_applied && (
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Penalización</span>
                  <Badge variant="error" size="sm">10% aplicado</Badge>
                </div>
              )}
            </div>
          </Card>

          {/* Cost section */}
          {(estimatedCost > 0 || project.confirmed_at) && (
            <Card>
              <h3 className={styles.cardTitle}>Costos</h3>
              <div className={styles.detailStack}>
                {project.confirmed_at && project.final_cost != null ? (
                  <>
                    <div className={styles.detailBlock}>
                      <span className={styles.detailLabel}>Costo final</span>
                      <span className={styles.costValue}>
                        {formatCurrency(project.final_cost)}
                      </span>
                    </div>
                    <div className={styles.detailBlock}>
                      <span className={styles.detailLabel}>Confirmado</span>
                      <span className={styles.detailValue}>
                        {formatDate(project.confirmed_at)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={styles.detailBlock}>
                    <span className={styles.detailLabel}>Costo estimado</span>
                    <span className={styles.costValue}>
                      {formatCurrency(estimatedCost)}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Actions */}
          {isOwner && project.status !== "cancelled" && project.status !== "completed" && (
            <Card>
              <h3 className={styles.cardTitle}>Acciones</h3>
              <div className={styles.actionList}>
                {canConfirm && (
                  <Button
                    size="sm"
                    style={{ width: "100%" }}
                    onClick={() => setShowConfirmModal(true)}
                  >
                    Confirmar proyecto
                  </Button>
                )}
                {cancelMeta.total_requests >= cancelMeta.max_requests ? (
                  <p className={styles.cancelLimit}>
                    Se alcanzó el máximo de solicitudes de cancelación ({cancelMeta.max_requests}).
                    Solo un administrador puede cancelar este proyecto.
                  </p>
                ) : cancelMeta.has_pending ? (
                  <p className={styles.cancelLimit}>
                    Hay una solicitud de cancelación pendiente de aprobación.
                  </p>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    style={{ width: "100%" }}
                    onClick={() => setShowCancelModal(true)}
                  >
                    Solicitar cancelación ({cancelMeta.total_requests}/{cancelMeta.max_requests})
                  </Button>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Add Requirement Modal */}
      <Modal open={showReqModal} onClose={() => setShowReqModal(false)} title="Nuevo Requerimiento" size="md">
        <form onSubmit={handleAddReq} className={styles.modalForm}>
          <p className={styles.reqModalHint}>
            Plantea los requerimientos de forma global o por rol (ej. &quot;Diseño gráfico del sitio&quot;,
            &quot;Desarrollo backend&quot;) para que los aspirantes puedan identificar qué necesidad
            del proyecto van a atender con su propuesta.
          </p>
          <div className={styles.textareaBlock}>
            <label className={styles.textareaLabel}>Requerimiento *</label>
            <textarea
              className={styles.textareaField}
              rows={4}
              value={reqTitle}
              onChange={(e) => setReqTitle(e.target.value)}
              placeholder="Describe el requerimiento..."
              required
            />
          </div>
          <Button type="submit" isLoading={savingReq} style={{ width: "100%" }}>
            Agregar
          </Button>
        </form>
      </Modal>

      {/* Add Bid Modal */}
      <Modal open={showBidModal} onClose={() => setShowBidModal(false)} title="Nueva Propuesta" size="sm">
        <form onSubmit={handleAddBid} className={styles.modalForm}>
          <Select
            label="Miembro *"
            options={memberOptions}
            value={bidMemberId}
            onChange={(e) => setBidMemberId(e.target.value)}
            placeholder="Seleccionar miembro"
            required
          />
          <div className={styles.textareaBlock}>
            <label className={styles.textareaLabel}>Propuesta *</label>
            <textarea
              className={styles.textareaField}
              rows={3}
              value={bidProposal}
              onChange={(e) => setBidProposal(e.target.value)}
              required
            />
          </div>
          <div className={styles.modalRow}>
            <Input
              label="Monto *"
              type="number"
              step="0.01"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              required
            />
            <Input
              label="Días estimados"
              type="number"
              value={bidDays}
              onChange={(e) => setBidDays(e.target.value)}
            />
          </div>
          <Button type="submit" isLoading={savingBid} style={{ width: "100%" }}>
            Agregar propuesta
          </Button>
        </form>
      </Modal>

      {/* Invite Members Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invitar Miembros"
        size="md"
      >
        <div className={styles.modalForm}>
          {/* Selected members chips */}
          {selectedInvites.length > 0 && (
            <div className={styles.inviteChips}>
              {selectedInvites.map((mId) => {
                const m = allMembers.find((x) => x.id === mId);
                return (
                  <span key={mId} className={styles.inviteChip}>
                    {m?.name || `#${mId}`}
                    <button
                      type="button"
                      className={styles.chipRemove}
                      onClick={() =>
                        setSelectedInvites((prev) => prev.filter((x) => x !== mId))
                      }
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div ref={inviteDropdownRef} className={styles.inviteSearchWrap}>
            <input
              type="text"
              className={styles.inviteSearchInput}
              placeholder="Buscar miembro..."
              value={inviteSearch}
              onChange={(e) => {
                setInviteSearch(e.target.value);
                setInviteDropdownOpen(true);
              }}
              onFocus={() => setInviteDropdownOpen(true)}
            />
            {inviteDropdownOpen && filteredInviteMembers.length > 0 && (
              <div className={styles.inviteDropdown}>
                {filteredInviteMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={styles.inviteOption}
                    onClick={() => {
                      setSelectedInvites((prev) => [...prev, m.id]);
                      setInviteSearch("");
                      setInviteDropdownOpen(false);
                    }}
                  >
                    <Avatar src={m.photo_url} name={m.name} size="sm" />
                    <div className={styles.inviteOptionInfo}>
                      <span className={styles.inviteOptionName}>{m.name}</span>
                      {m.position_name && (
                        <span className={styles.inviteOptionPos}>{m.position_name}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleInvite}
            isLoading={savingInvite}
            disabled={selectedInvites.length === 0}
            style={{ width: "100%" }}
          >
            Enviar invitaciones ({selectedInvites.length})
          </Button>
        </div>
      </Modal>

      {/* Confirm Project Modal */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar Proyecto"
        size="sm"
      >
        <div className={styles.modalForm}>
          <div className={styles.confirmInfo}>
            <p>¿Confirmar el proyecto <strong>{project.title}</strong>?</p>
            <div className={styles.confirmCost}>
              <span>Costo final:</span>
              <strong>{formatCurrency(estimatedCost)}</strong>
            </div>
            <p className={styles.confirmNote}>
              Al confirmar, el costo se distribuirá entre los requerimientos y las propuestas
              pendientes/invitadas serán rechazadas.
            </p>
          </div>
          <div className={styles.confirmActions}>
            <Button
              variant="ghost"
              onClick={() => setShowConfirmModal(false)}
              style={{ flex: 1 }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              isLoading={confirming}
              style={{ flex: 1 }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Request Modal */}
      <Modal open={showCancelModal} onClose={() => setShowCancelModal(false)} title="Solicitar Cancelación" size="sm">
        <form onSubmit={handleCancelRequest} className={styles.modalForm}>
          <div className={styles.textareaBlock}>
            <label className={styles.textareaLabel}>Razón *</label>
            <textarea
              className={styles.textareaField}
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              required
              placeholder="Explica por qué deseas cancelar este proyecto..."
            />
          </div>
          <Button type="submit" variant="danger" isLoading={savingCancel} style={{ width: "100%" }}>
            Enviar solicitud
          </Button>
        </form>
      </Modal>

      {/* AI Edit Requirement Modal */}
      <Modal
        open={showAIModal}
        onClose={() => setShowAIModal(false)}
        title="Editar Requerimiento con IA"
        size="md"
      >
        <form onSubmit={handleAIUpdate} className={styles.modalForm}>
          <div className={styles.aiReqCurrent}>
            <span className={styles.aiReqLabel}>Requerimiento actual:</span>
            <span className={styles.aiReqName}>{aiReqTitle}</span>
          </div>
          <div className={styles.textareaBlock}>
            <label className={styles.textareaLabel}>¿Cómo quieres actualizar este requerimiento? *</label>
            <textarea
              className={styles.textareaField}
              rows={4}
              value={aiUpdateText}
              onChange={(e) => setAiUpdateText(e.target.value)}
              placeholder="Describe los cambios o detalles que quieres agregar al requerimiento..."
              required
            />
          </div>
          <p className={styles.reqModalHint}>
            La IA generará un nuevo título y descripción basándose en lo que escribas.
          </p>
          <Button type="submit" isLoading={generatingAI} style={{ width: "100%" }}>
            Actualizar con IA
          </Button>
        </form>
      </Modal>

      {/* Completion Options Modal */}
      <Modal
        open={showCompletionModal}
        onClose={() => { setShowCompletionModal(false); setCompletionAction(null); }}
        title={
          completionAction === "more_requirements"
            ? "Solicitar más requerimientos"
            : completionAction === "request_review"
            ? "Solicitar tiempo de revisión"
            : "Confirmar completación"
        }
        size="sm"
      >
        <div className={styles.modalForm}>
          {completionAction === "more_requirements" && (
            <>
              <p className={styles.reqModalHint}>
                Describe el nuevo requerimiento y extiende la fecha fin del proyecto.
                La IA generará el título y descripción según lo que detalles.
              </p>
              <div className={styles.textareaBlock}>
                <label className={styles.textareaLabel}>Nuevo requerimiento *</label>
                <textarea
                  className={styles.textareaField}
                  rows={4}
                  value={newReqText}
                  onChange={(e) => setNewReqText(e.target.value)}
                  placeholder="Describe el nuevo requerimiento que necesitas..."
                />
              </div>
              <Input
                label="Nueva fecha fin *"
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                min={project?.deadline
                  ? new Date(new Date(project.deadline).getTime() + 86400000).toISOString().split("T")[0]
                  : todayStr}
              />
              <Button
                isLoading={savingCompletion}
                style={{ width: "100%", marginTop: "var(--space-3)" }}
                onClick={handleCompletionAction}
                disabled={!newDeadline || !newReqText.trim()}
              >
                Crear requerimiento y actualizar
              </Button>
            </>
          )}
          {completionAction === "confirm_completion" && (
            <>
              <p className={styles.reqModalHint}>
                Para completar el proyecto debes realizar el pago a la siguiente cuenta:
              </p>
              <div className={styles.bankInfo}>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Titular</span>
                  <span className={styles.bankValue}>{PAYMENT_ACCOUNT.name}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Banco</span>
                  <span className={styles.bankValue}>{PAYMENT_ACCOUNT.bank}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Tipo</span>
                  <span className={styles.bankValue}>{PAYMENT_ACCOUNT.type}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Cuenta #</span>
                  <span className={styles.bankValue}>{PAYMENT_ACCOUNT.number}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>Email</span>
                  <span className={styles.bankValue}>{PAYMENT_ACCOUNT.email}</span>
                </div>
                <div className={styles.bankRow}>
                  <span className={styles.bankLabel}>CI</span>
                  <span className={styles.bankValue}>{PAYMENT_ACCOUNT.ci}</span>
                </div>
                {project?.final_cost != null && (
                  <div className={styles.bankRow}>
                    <span className={styles.bankLabel}>Monto</span>
                    <span className={styles.bankValueBold}>{formatCurrency(project.final_cost)}</span>
                  </div>
                )}
              </div>
              <Button
                style={{ width: "100%", marginTop: "var(--space-3)" }}
                onClick={handleCompletionAction}
              >
                Proceder al pago
              </Button>
            </>
          )}
          {completionAction === "request_review" && (
            <>
              <p className={styles.reqModalHint}>
                Establece una fecha para revisar el trabajo realizado.
                {project?.deadline && ` La fecha no puede ser posterior a ${formatDate(project.deadline)}.`}
              </p>
              <Input
                label="Fecha de revisión *"
                type="date"
                value={reviewDeadline}
                onChange={(e) => setReviewDeadline(e.target.value)}
                min={todayStr}
                max={project?.deadline || undefined}
              />
              <Button
                isLoading={savingCompletion}
                style={{ width: "100%", marginTop: "var(--space-3)" }}
                onClick={handleCompletionAction}
                disabled={!reviewDeadline}
              >
                Iniciar revisión
              </Button>
            </>
          )}
        </div>
      </Modal>

      {/* Payment Proof Modal */}
      <Modal
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Enviar comprobante de pago"
        size="sm"
      >
        <div className={styles.modalForm}>
          <div className={styles.bankInfo}>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Titular</span>
              <span className={styles.bankValue}>{PAYMENT_ACCOUNT.name}</span>
            </div>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Banco</span>
              <span className={styles.bankValue}>{PAYMENT_ACCOUNT.bank}</span>
            </div>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Cuenta</span>
              <span className={styles.bankValue}>{PAYMENT_ACCOUNT.type} # {PAYMENT_ACCOUNT.number}</span>
            </div>
            <div className={styles.bankRow}>
              <span className={styles.bankLabel}>Email</span>
              <span className={styles.bankValue}>{PAYMENT_ACCOUNT.email}</span>
            </div>
            {project?.final_cost != null && (
              <div className={styles.bankRow}>
                <span className={styles.bankLabel}>Monto</span>
                <span className={styles.bankValueBold}>{formatCurrency(project.final_cost)}</span>
              </div>
            )}
          </div>
          <div className={styles.proofUpload}>
            <label className={styles.textareaLabel}>Comprobante de pago *</label>
            {proofUrl ? (
              <div className={styles.proofPreview}>
                <img src={proofUrl} alt="Comprobante" className={styles.proofImage} />
                <Button size="sm" variant="ghost" onClick={() => setProofUrl("")}>Cambiar</Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => proofInputRef.current?.click()}
                isLoading={uploadingProof}
              >
                Subir comprobante
              </Button>
            )}
            <input
              ref={proofInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleProofUpload}
            />
          </div>
          <Button
            style={{ width: "100%", marginTop: "var(--space-3)" }}
            onClick={handleSubmitPayment}
            isLoading={savingPayment}
            disabled={!proofUrl}
          >
            Enviar comprobante
          </Button>
        </div>
      </Modal>

      {/* Assign Requirement Modal */}
      <Modal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Asignar Requerimiento"
        size="sm"
      >
        <form onSubmit={handleCreateAssignment} className={styles.modalForm}>
          <p className={styles.reqModalHint}>
            Selecciona un miembro aceptado y propón un costo para este requerimiento.
            El miembro podrá enviar su contrapropuesta de costo.
          </p>
          <Select
            label="Miembro *"
            options={acceptedMembers.map((m) => ({
              value: String(m.id),
              label: m.name,
            }))}
            value={assignMemberId}
            onChange={(e) => setAssignMemberId(e.target.value)}
            placeholder="Seleccionar miembro..."
            required
          />
          <Input
            label="Costo propuesto *"
            type="number"
            step="0.01"
            value={assignProposedCost}
            onChange={(e) => setAssignProposedCost(e.target.value)}
            placeholder="0.00"
            required
          />
          <Button
            type="submit"
            isLoading={savingAssign}
            style={{ width: "100%" }}
            disabled={!assignMemberId || !assignProposedCost}
          >
            Enviar propuesta de asignación
          </Button>
        </form>
      </Modal>
    </div>
  );
}

// ----- Requirement Item List (sub-tasks) -----

function RequirementItemList({
  reqId,
  items,
  canEdit,
  projectId,
  onUpdate,
}: {
  reqId: number;
  items: ReqItem[];
  canEdit: boolean;
  projectId: number;
  onUpdate: () => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);

  if (items.length === 0 && !canEdit) return null;

  const addItem = async () => {
    if (!newTitle.trim()) return;
    try {
      await fetch(`/api/projects/${projectId}/requirements/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: reqId, title: newTitle.trim() }),
      });
      setNewTitle("");
      onUpdate();
    } catch { /* silent */ }
  };

  const toggleItem = async (item: ReqItem) => {
    try {
      await fetch(`/api/projects/${projectId}/requirements/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: item.id, is_completed: !item.is_completed }),
      });
      onUpdate();
    } catch { /* silent */ }
  };

  const saveEdit = async (itemId: number) => {
    if (!editTitle.trim()) return;
    try {
      await fetch(`/api/projects/${projectId}/requirements/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId, title: editTitle.trim() }),
      });
      setEditingId(null);
      onUpdate();
    } catch { /* silent */ }
  };

  const removeItem = async (itemId: number) => {
    try {
      await fetch(`/api/projects/${projectId}/requirements/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_id: itemId }),
      });
      onUpdate();
    } catch { /* silent */ }
  };

  const handleDragStart = (id: number) => setDragId(id);

  const handleDrop = async (targetId: number) => {
    if (dragId === null || dragId === targetId) return;
    const ordered = items.map((i) => i.id);
    const fromIdx = ordered.indexOf(dragId);
    const toIdx = ordered.indexOf(targetId);
    ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, dragId);
    setDragId(null);
    try {
      await fetch(`/api/projects/${projectId}/requirements/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: reqId, ordered_ids: ordered }),
      });
      onUpdate();
    } catch { /* silent */ }
  };

  return (
    <div className={styles.subItems}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`${styles.subItem} ${item.is_completed ? styles.subItemDone : ""}`}
          draggable={canEdit}
          onDragStart={() => handleDragStart(item.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(item.id)}
        >
          {canEdit ? (
            <input
              type="checkbox"
              className={styles.subItemCheck}
              checked={item.is_completed}
              onChange={() => toggleItem(item)}
            />
          ) : (
            <input
              type="checkbox"
              className={styles.subItemCheck}
              checked={item.is_completed}
              disabled
            />
          )}
          {editingId === item.id && canEdit ? (
            <input
              type="text"
              className={styles.subItemEditInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => saveEdit(item.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(item.id);
                if (e.key === "Escape") setEditingId(null);
              }}
              autoFocus
            />
          ) : (
            <span
              className={styles.subItemTitle}
              onDoubleClick={() => {
                if (!canEdit) return;
                setEditingId(item.id);
                setEditTitle(item.title);
              }}
            >
              {item.title}
            </span>
          )}
          <span className={styles.subItemDates}>
            <span title="Creado">{formatDate(item.created_at)}</span>
            {item.completed_at && (
              <span className={styles.subItemCompletedDate} title="Completado">
                ✓ {formatDate(item.completed_at)}
              </span>
            )}
          </span>
          {canEdit && (
            <div className={styles.subItemActions}>
              {canEdit && dragId === null && (
                <span className={styles.subItemDrag} title="Arrastrar">⠿</span>
              )}
              <button
                className={styles.subItemDelete}
                onClick={() => removeItem(item.id)}
              >
                &times;
              </button>
            </div>
          )}
        </div>
      ))}
      {canEdit && (
        <div className={styles.subItemAdd}>
          <input
            type="text"
            className={styles.subItemInput}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Agregar sub-tarea..."
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addItem(); }
            }}
          />
          {newTitle.trim() && (
            <button className={styles.subItemAddBtn} onClick={addItem}>+</button>
          )}
        </div>
      )}
    </div>
  );
}

// ----- Calendar Picker Component -----

function CalendarPicker({
  selectedDates,
  onToggleDate,
  minDate,
  maxDate,
}: {
  selectedDates: string[];
  onToggleDate: (date: string) => void;
  minDate: string;
  maxDate?: string;
}) {
  const [viewYear, setViewYear] = useState(() => {
    const d = new Date(minDate);
    return d.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(minDate);
    return d.getMonth();
  });

  const DAYS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push(dateStr);
  }

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isDisabled = (dateStr: string) => {
    if (dateStr < minDate) return true;
    if (maxDate && dateStr > maxDate) return true;
    return false;
  };

  return (
    <div className={styles.calendar}>
      <div className={styles.calendarNav}>
        <button type="button" className={styles.calendarNavBtn} onClick={prevMonth}>
          &#8249;
        </button>
        <span className={styles.calendarTitle}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button type="button" className={styles.calendarNavBtn} onClick={nextMonth}>
          &#8250;
        </button>
      </div>
      <div className={styles.calendarGrid}>
        {DAYS.map((d) => (
          <div key={d} className={styles.calendarDayHeader}>{d}</div>
        ))}
        {cells.map((dateStr, i) => {
          if (!dateStr) {
            return <div key={`empty-${i}`} className={styles.calendarCell} />;
          }
          const disabled = isDisabled(dateStr);
          const selected = selectedDates.includes(dateStr);
          const dayNum = parseInt(dateStr.split("-")[2], 10);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={disabled}
              className={`${styles.calendarDay} ${selected ? styles.calendarDaySelected : ""} ${disabled ? styles.calendarDayDisabled : ""}`}
              onClick={() => !disabled && onToggleDate(dateStr)}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
