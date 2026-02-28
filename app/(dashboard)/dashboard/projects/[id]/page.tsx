"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/layout/PageHeader";
import { Button, Badge, Card, Input, Select, Spinner, Modal } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { PROJECT_STATUS_LABELS, PUBLIC_PROJECT_TRANSITIONS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/types";
import styles from "./page.module.css";

interface ProjectDetail {
  id: number;
  client_id: number;
  assigned_member_id: number | null;
  title: string;
  description: string | null;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  is_private: boolean;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  client_email: string | null;
  member_name: string | null;
  member_email: string | null;
}

interface Bid {
  id: number;
  member_id: number;
  member_name: string;
  proposal: string;
  bid_amount: number;
  estimated_days: number | null;
  status: string;
  created_at: string;
}

interface Requirement {
  id: number;
  title: string;
  description: string | null;
  cost: number | null;
  is_completed: boolean;
  completed_at: string | null;
}

interface CancelRequest {
  id: number;
  reason: string;
  status: string;
  requester_email: string;
  resolver_email: string | null;
  created_at: string;
  resolved_at: string | null;
}

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  published: "info",
  planned: "info",
  started: "info",
  in_progress: "warning",
  in_development: "warning",
  in_testing: "warning",
  completed: "success",
  partially_completed: "warning",
  not_completed: "error",
  cancelled: "error",
  cancelled_no_agreement: "error",
  cancelled_no_budget: "error",
  unpaid: "error",
  not_completed_by_member: "error",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const projectId = Number(params.id);

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [cancelRequests, setCancelRequests] = useState<CancelRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Status transition
  const [nextStatus, setNextStatus] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  // Requirement modal
  const [showReqModal, setShowReqModal] = useState(false);
  const [reqTitle, setReqTitle] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqCost, setReqCost] = useState("");
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
      ]);
      setLoading(false);
    }
    loadAll();
  }, [fetchProject, fetchBids, fetchRequirements, fetchCancelRequests]);

  // Available transitions
  const availableTransitions = project
    ? PUBLIC_PROJECT_TRANSITIONS[project.status as ProjectStatus] || []
    : [];

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

  // Add requirement
  const handleAddReq = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingReq(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: reqTitle,
          description: reqDesc || undefined,
          cost: reqCost ? Number(reqCost) : undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Requerimiento agregado", "success");
      setShowReqModal(false);
      setReqTitle("");
      setReqDesc("");
      setReqCost("");
      fetchRequirements();
    } catch {
      toast("Error", "error");
    } finally {
      setSavingReq(false);
    }
  };

  // Toggle requirement complete
  const toggleReq = async (req: Requirement) => {
    try {
      await fetch(`/api/projects/${projectId}/requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_id: req.id,
          is_completed: !req.is_completed,
        }),
      });
      fetchRequirements();
    } catch {
      toast("Error", "error");
    }
  };

  // Delete requirement
  const deleteReq = async (reqId: number) => {
    try {
      await fetch(`/api/projects/${projectId}/requirements`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirement_id: reqId }),
      });
      toast("Eliminado", "success");
      fetchRequirements();
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
      fetchProject();
    } catch {
      toast("Error", "error");
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
      if (!res.ok) throw new Error();
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

  // Resolve cancel request
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
  const completedReqs = requirements.filter((r) => r.is_completed).length;

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
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Eliminar
            </Button>
          </div>
        }
      />

      <div className={styles.grid}>
        <div className={styles.main}>
          {/* Status + transitions */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Estado</h3>
              <Badge variant={BADGE_VARIANT[project.status] || "default"}>
                {PROJECT_STATUS_LABELS[project.status as ProjectStatus] || project.status}
              </Badge>
            </div>
            {availableTransitions.length > 0 && (
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
            )}
          </Card>

          {/* Description */}
          {project.description && (
            <Card>
              <h3 className={styles.cardTitle}>Descripción</h3>
              <p className={styles.description}>{project.description}</p>
            </Card>
          )}

          {/* Requirements */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>
                Requerimientos ({completedReqs}/{requirements.length})
              </h3>
              <Button size="sm" variant="secondary" onClick={() => setShowReqModal(true)}>
                Agregar
              </Button>
            </div>
            {requirements.length === 0 ? (
              <p className={styles.empty}>Sin requerimientos</p>
            ) : (
              <>
                <div className={styles.reqList}>
                  {requirements.map((req) => (
                    <div
                      key={req.id}
                      className={`${styles.reqItem} ${req.is_completed ? styles.reqDone : ""}`}
                    >
                      <label className={styles.reqCheck}>
                        <input
                          type="checkbox"
                          checked={req.is_completed}
                          onChange={() => toggleReq(req)}
                        />
                        <span className={styles.reqTitle}>{req.title}</span>
                      </label>
                      <div className={styles.reqMeta}>
                        {req.cost != null && (
                          <span className={styles.reqCost}>{formatCurrency(req.cost)}</span>
                        )}
                        <button
                          className={styles.deleteBtn}
                          onClick={() => deleteReq(req.id)}
                        >
                          &times;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {totalReqCost > 0 && (
                  <div className={styles.totalRow}>
                    Total: <strong>{formatCurrency(totalReqCost)}</strong>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Bids */}
          <Card>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Propuestas ({bids.length})</h3>
              <Button size="sm" variant="secondary" onClick={openBidModal}>
                Agregar
              </Button>
            </div>
            {bids.length === 0 ? (
              <p className={styles.empty}>Sin propuestas</p>
            ) : (
              <div className={styles.bidList}>
                {bids.map((bid) => (
                  <div key={bid.id} className={styles.bidItem}>
                    <div className={styles.bidHeader}>
                      <strong>{bid.member_name}</strong>
                      <Badge
                        variant={
                          bid.status === "accepted"
                            ? "success"
                            : bid.status === "rejected"
                            ? "error"
                            : "warning"
                        }
                      >
                        {bid.status === "accepted"
                          ? "Aceptada"
                          : bid.status === "rejected"
                          ? "Rechazada"
                          : "Pendiente"}
                      </Badge>
                    </div>
                    <p className={styles.bidProposal}>{bid.proposal}</p>
                    <div className={styles.bidMeta}>
                      <span>{formatCurrency(bid.bid_amount)}</span>
                      {bid.estimated_days && <span>{bid.estimated_days} días</span>}
                      <span>{formatDate(bid.created_at)}</span>
                    </div>
                    {bid.status === "pending" && (
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
                ))}
              </div>
            )}
          </Card>

          {/* Cancellation requests */}
          {cancelRequests.length > 0 && (
            <Card>
              <h3 className={styles.cardTitle}>Solicitudes de Cancelación</h3>
              <div className={styles.cancelList}>
                {cancelRequests.map((cr) => (
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
                    {cr.status === "pending" && (
                      <div className={styles.bidActions}>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => resolveCancel(cr.id, "approved")}
                        >
                          Aprobar cancelación
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => resolveCancel(cr.id, "rejected")}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card>
            <h3 className={styles.cardTitle}>Detalles</h3>
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>{project.client_name || "—"}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Miembro</span>
                <span className={styles.detailValue}>
                  {project.member_name || "Sin asignar"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Presupuesto</span>
                <span className={styles.detailValue}>
                  {project.budget_min && project.budget_max
                    ? `${formatCurrency(project.budget_min)} — ${formatCurrency(project.budget_max)}`
                    : project.budget_max
                    ? formatCurrency(project.budget_max)
                    : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Fecha límite</span>
                <span className={styles.detailValue}>
                  {project.deadline ? formatDate(project.deadline) : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Tipo</span>
                <span className={styles.detailValue}>
                  {project.is_private ? "Privado" : "Público"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Creado</span>
                <span className={styles.detailValue}>{formatDate(project.created_at)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Actualizado</span>
                <span className={styles.detailValue}>{formatDate(project.updated_at)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h3 className={styles.cardTitle}>Acciones</h3>
            <div className={styles.actionList}>
              <Button
                variant="secondary"
                size="sm"
                style={{ width: "100%" }}
                onClick={() => setShowCancelModal(true)}
              >
                Solicitar cancelación
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Add Requirement Modal */}
      <Modal open={showReqModal} onClose={() => setShowReqModal(false)} title="Nuevo Requerimiento" size="sm">
        <form onSubmit={handleAddReq} className={styles.modalForm}>
          <Input
            label="Título *"
            value={reqTitle}
            onChange={(e) => setReqTitle(e.target.value)}
            required
          />
          <Input
            label="Descripción"
            value={reqDesc}
            onChange={(e) => setReqDesc(e.target.value)}
          />
          <Input
            label="Costo"
            type="number"
            step="0.01"
            value={reqCost}
            onChange={(e) => setReqCost(e.target.value)}
          />
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
    </div>
  );
}
