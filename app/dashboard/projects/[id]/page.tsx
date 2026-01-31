"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useProject, useSubmitBid, ProjectBid, ProjectRequirement, AcceptedMember } from "@/lib/hooks/useProjects";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";
import styles from "@/app/styles/Projects.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "publicado": return styles.statusPublicado;
    case "asignado": return styles.statusAsignado;
    case "planificado": return styles.statusPlanificado;
    case "en_progreso": return styles.statusEnProgreso;
    case "completado": return styles.statusCompletado;
    case "completado_parcial": return styles.statusCompletadoParcial;
    case "no_completado": return styles.statusNoCompletado;
    case "cancelado_sin_acuerdo": return styles.statusCancelado;
    case "cancelado_sin_presupuesto": return styles.statusCancelado;
    case "no_pagado": return styles.statusNoPagado;
    case "no_completado_por_miembro": return styles.statusNoCompletado;
    default: return styles.statusPublicado;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "publicado": return "Publicado";
    case "asignado": return "Asignado";
    case "planificado": return "Planificado";
    case "en_progreso": return "En Progreso";
    case "completado": return "Completado";
    case "completado_parcial": return "Completado Parcial";
    case "no_completado": return "No Completado";
    case "cancelado_sin_acuerdo": return "Cancelado - Sin Acuerdo";
    case "cancelado_sin_presupuesto": return "Cancelado - Sin Presupuesto";
    case "no_pagado": return "No Pagado";
    case "no_completado_por_miembro": return "No Completado por Miembro";
    default: return estado;
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

function ProjectDetailPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const projectId = params?.id ? parseInt(params.id as string, 10) : null;
  const backUrl = searchParams.get("from") === "miembro" ? "/dashboard/miembro/proyectos" : "/dashboard/projects";
  const backLabel = searchParams.get("from") === "miembro" ? "Volver a mis proyectos" : "Volver a proyectos";
  const {
    project,
    bids,
    requirements,
    acceptedMembers,
    loading,
    error,
    updateProject,
    acceptBid,
    resendBid,
    confirmParticipation,
    planifyProject,
    startProject,
    completeProject,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    republishProject,
    closeConvocatoria,
    finishWork,
  } = useProject(projectId);
  const { submitBid, loading: submittingBid } = useSubmitBid();

  const userRole = profile?.rol || "cliente";
  const userMiembroId = profile?.id_miembro;

  // Check if current user already submitted a bid
  const userBid = bids.find((b) => b.id_miembro === userMiembroId);
  const isClientOwner = userRole === "cliente";

  // Check if current member is the owner of this member project
  const isMemberOwner = project?.tipo_proyecto === "miembro" && project?.id_miembro_propietario === userMiembroId;

  // Project owner is either client (for client projects) or member (for member projects)
  const isProjectOwner = (project?.tipo_proyecto === "cliente" && isClientOwner) || isMemberOwner;

  // Check if current member has an accepted bid (is part of the team)
  const userAcceptedBid = userBid?.estado === "aceptada" ? userBid : null;
  const isTeamMember = !!userAcceptedBid;

  // Bid form state
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPropuesta, setBidPropuesta] = useState("");
  const [bidPrecio, setBidPrecio] = useState("");
  const [bidTiempo, setBidTiempo] = useState("");
  const [bidImages, setBidImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Accept bid modal state
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptBidId, setAcceptBidId] = useState<number | null>(null);
  const [acceptMonto, setAcceptMonto] = useState("");

  // Resend bid modal state (when member rejected)
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendBidId, setResendBidId] = useState<number | null>(null);
  const [resendMonto, setResendMonto] = useState("");

  // Requirement form state
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqTitulo, setReqTitulo] = useState("");
  const [reqDescripcion, setReqDescripcion] = useState("");
  const [reqCosto, setReqCosto] = useState("");

  // Edit requirement state
  const [editingReq, setEditingReq] = useState<number | null>(null);
  const [editReqTitulo, setEditReqTitulo] = useState("");
  const [editReqDescripcion, setEditReqDescripcion] = useState("");
  const [editReqCosto, setEditReqCosto] = useState("");
  const [editReqEsAdicional, setEditReqEsAdicional] = useState(false);

  // es_adicional for new requirement
  const [reqEsAdicional, setReqEsAdicional] = useState(false);

  // Close project state
  const [showClosePanel, setShowClosePanel] = useState(false);
  const [closeEstado, setCloseEstado] = useState("");
  const [closeJustificacion, setCloseJustificacion] = useState("");

  // Republish state
  const [showRepublishForm, setShowRepublishForm] = useState(false);
  const [republishTitulo, setRepublishTitulo] = useState("");
  const [republishDescripcion, setRepublishDescripcion] = useState("");

  const [updating, setUpdating] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || bidImages.length >= 5) return;

    setUploadingImage(true);
    try {
      const localUrl = URL.createObjectURL(file);
      setBidImages((prev) => [...prev, localUrl]);
      if (!window.__bidImageFiles) window.__bidImageFiles = [];
      window.__bidImageFiles.push(file);
    } catch {
      alert("Error al cargar imagen");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleRemoveImage = (index: number) => {
    setBidImages((prev) => prev.filter((_, i) => i !== index));
    if (window.__bidImageFiles) {
      window.__bidImageFiles.splice(index, 1);
    }
  };

  const handleSubmitBid = async () => {
    if (!userMiembroId || !projectId) return;

    let imageUrls: string[] = [];

    const result = await submitBid({
      id_project: projectId,
      id_miembro: userMiembroId,
      propuesta: bidPropuesta,
      precio_ofertado: parseFloat(bidPrecio) || 0,
      tiempo_estimado_dias: bidTiempo ? parseInt(bidTiempo) : undefined,
      imagenes: imageUrls,
    });

    if (!result.error && result.data) {
      if (window.__bidImageFiles && window.__bidImageFiles.length > 0) {
        for (const file of window.__bidImageFiles) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("bidId", result.data.id.toString());
          await fetch("/api/upload/bid-image", { method: "POST", body: formData });
        }
        window.__bidImageFiles = [];
      }

      setShowBidForm(false);
      setBidPropuesta("");
      setBidPrecio("");
      setBidTiempo("");
      setBidImages([]);
      window.location.reload();
    } else {
      alert(result.error);
    }
  };

  const handleOpenAcceptModal = (bid: ProjectBid) => {
    setAcceptBidId(bid.id);
    setAcceptMonto(bid.precio_ofertado.toString());
    setShowAcceptModal(true);
  };

  const handleConfirmAccept = async () => {
    if (!acceptBidId || !acceptMonto) return;
    setUpdating(true);
    const result = await acceptBid(acceptBidId, parseFloat(acceptMonto));
    if (result.error) {
      alert(result.error);
    }
    setShowAcceptModal(false);
    setAcceptBidId(null);
    setAcceptMonto("");
    setUpdating(false);
  };

  const handleOpenResendModal = (bid: ProjectBid) => {
    setResendBidId(bid.id);
    setResendMonto(bid.monto_acordado?.toString() || bid.precio_ofertado.toString());
    setShowResendModal(true);
  };

  const handleConfirmResend = async () => {
    if (!resendBidId || !resendMonto) return;
    setUpdating(true);
    const result = await resendBid(resendBidId, parseFloat(resendMonto));
    if (result.error) {
      alert(result.error);
    }
    setShowResendModal(false);
    setResendBidId(null);
    setResendMonto("");
    setUpdating(false);
  };

  const handleConfirmParticipation = async (action: "confirm" | "cancel") => {
    setUpdating(true);
    const result = await confirmParticipation(action);
    if (result.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  const handlePlanifyProject = async () => {
    setUpdating(true);
    const result = await planifyProject();
    if (result.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  const handleStartProject = async () => {
    setUpdating(true);
    const result = await startProject();
    if (result.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  const handleAddRequirement = async () => {
    const result = await addRequirement({
      titulo: reqTitulo,
      descripcion: reqDescripcion || undefined,
      costo: reqCosto ? parseFloat(reqCosto) : undefined,
      es_adicional: reqEsAdicional,
    });

    if (!result.error) {
      setShowReqForm(false);
      setReqTitulo("");
      setReqDescripcion("");
      setReqCosto("");
      setReqEsAdicional(false);
    } else {
      alert(result.error);
    }
  };

  const handleToggleRequirement = async (req: ProjectRequirement) => {
    await updateRequirement(req.id, { completado: !req.completado });
  };

  const handleStartEditReq = (req: ProjectRequirement) => {
    setEditingReq(req.id);
    setEditReqTitulo(req.titulo);
    setEditReqDescripcion(req.descripcion || "");
    setEditReqCosto(req.costo?.toString() || "");
    setEditReqEsAdicional(req.es_adicional);
  };

  const handleSaveEditReq = async () => {
    if (!editingReq) return;
    const result = await updateRequirement(editingReq, {
      titulo: editReqTitulo,
      descripcion: editReqDescripcion || undefined,
      costo: editReqCosto ? parseFloat(editReqCosto) : undefined,
      es_adicional: editReqEsAdicional,
    } as any);
    if (!result.error) {
      setEditingReq(null);
    } else {
      alert(result.error);
    }
  };

  const handleDeleteRequirement = async (reqId: number) => {
    if (!confirm("¿Estás seguro de eliminar este requerimiento?")) return;
    const result = await deleteRequirement(reqId);
    if (result.error) {
      alert(result.error);
    }
  };

  const handleCloseProject = async () => {
    if (!closeEstado) return;
    setUpdating(true);
    const result = await completeProject(closeEstado, closeJustificacion || undefined);
    if (result.error) {
      alert(result.error);
    } else {
      setShowClosePanel(false);
      setCloseEstado("");
      setCloseJustificacion("");
    }
    setUpdating(false);
  };

  const handleRepublish = async () => {
    if (!republishTitulo) return;
    setUpdating(true);
    const result = await republishProject(republishTitulo, republishDescripcion);
    if (result.error) {
      alert(result.error);
    } else {
      setShowRepublishForm(false);
      setRepublishTitulo("");
      setRepublishDescripcion("");
    }
    setUpdating(false);
  };

  const handleCloseConvocatoria = async () => {
    setUpdating(true);
    const result = await closeConvocatoria();
    if (result.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  const handleFinishWork = async () => {
    if (!userMiembroId) return;
    setUpdating(true);
    try {
      const result = await finishWork(userMiembroId);
      if (result.error) {
        alert("Error: " + result.error);
      } else if (result.proyecto_completado) {
        alert("El proyecto ha sido completado automáticamente. Todos los miembros finalizaron su trabajo.");
      }
    } catch (err: any) {
      alert("Error: " + (err?.message || "Error inesperado"));
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleVisibility = async () => {
    if (!project || !isMemberOwner) return;
    setUpdating(true);
    const newVisibility = project.visibilidad === "privado" ? "publico" : "privado";
    const result = await updateProject({ visibilidad: newVisibility } as any);
    if (result.error) {
      alert(result.error);
    }
    setUpdating(false);
  };

  // Check if requirement can be edited by current user
  const canEditRequirement = (req: ProjectRequirement) => {
    // Admin can always edit
    if (userRole === "admin") return true;
    // Team members (miembros) can only edit in planificado state
    if ((isTeamMember || isMemberOwner) && project?.estado === "planificado") return true;
    // Clients can edit their own requirements, but NOT when project is en_progreso
    if (userRole === "cliente" && req.creado_por === "cliente" && project?.estado !== "en_progreso") return true;
    return false;
  };

  const canDeleteRequirement = userRole === "miembro" || userRole === "admin";

  // Calculate progress
  const completedReqs = requirements.filter((r) => r.completado).length;
  const totalReqs = requirements.length;
  const progress = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0;
  const totalCost = requirements.reduce((sum, r) => sum + (r.costo || 0), 0);

  // Total monto acordado across all accepted members
  const totalMontoAcordado = acceptedMembers.reduce((sum, m) => sum + (m.monto_acordado || 0), 0);

  // Is the project in a terminal/closed state
  const isClosedState = [
    "completado", "completado_parcial", "no_completado",
    "cancelado_sin_acuerdo", "cancelado_sin_presupuesto",
    "no_pagado", "no_completado_por_miembro"
  ].includes(project?.estado || "");

  // Can add requirements (team member, member owner, or client owner in publicado, planificado, or en_progreso)
  const canManageRequirements = (isTeamMember || isProjectOwner || isMemberOwner) &&
    ["publicado", "planificado", "en_progreso"].includes(project?.estado || "");

  // Can toggle completado (only in en_progreso, team members or member owner)
  const canToggleCompletado = (isTeamMember || isMemberOwner) && project?.estado === "en_progreso";

  // Check if all accepted members have confirmed
  const allMembersConfirmed = acceptedMembers.length > 0 &&
    acceptedMembers.every((m) => m.confirmado_por_miembro === true);

  // Check if current member already finished their work
  const currentMemberAccepted = acceptedMembers.find(
    (m) => m.miembro.id == userMiembroId
  );
  const hasFinishedWork = currentMemberAccepted?.trabajo_finalizado === true;

  if (loading) {
    return (
      <DashboardLayout>
        <div className={ticketStyles.loadingState}>
          <div className={ticketStyles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando proyecto...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !project) {
    return (
      <DashboardLayout>
        <div className={styles.detailPage}>
          <Link href={backUrl} className={ticketStyles.backButton}>
            <ArrowLeftIcon />
            {backLabel}
          </Link>
          <div className={ticketStyles.emptyState}>
            <h3 className={ticketStyles.emptyTitle}>Proyecto no encontrado</h3>
            <p className={ticketStyles.emptyText}>
              {error || "El proyecto que buscas no existe o no tienes acceso."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.detailPage}>
        {/* Back Button */}
        <Link href={backUrl} className={ticketStyles.backButton}>
          <ArrowLeftIcon />
          {backLabel}
        </Link>

        {/* Confirmation Banner (for member with accepted bid, not yet confirmed) */}
        {userAcceptedBid && !userAcceptedBid.confirmado_por_miembro && (
          <div className={styles.confirmationBanner}>
            <div className={styles.confirmationContent}>
              <h3 className={styles.confirmationTitle}>Confirma tu Participación</h3>
              <p className={styles.confirmationText}>
                Has sido seleccionado para este proyecto.
                {userAcceptedBid.monto_acordado && (
                  <> Monto acordado: <strong>{formatCurrency(userAcceptedBid.monto_acordado)}</strong>.</>
                )}
                {" "}Si no estás de acuerdo con el monto, puedes rechazar la oferta.
              </p>
              <div className={styles.confirmationActions}>
                <button
                  className={ticketStyles.primaryButton}
                  onClick={() => handleConfirmParticipation("confirm")}
                  disabled={updating}
                >
                  Confirmar Participación
                </button>
                <button
                  className={styles.rejectButton}
                  onClick={() => handleConfirmParticipation("cancel")}
                  disabled={updating}
                >
                  Rechazar Oferta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Accept Bid Modal */}
        {showAcceptModal && (
          <div className={styles.modalOverlay} onClick={() => setShowAcceptModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Aceptar Postulación</h3>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Monto Acordado *</label>
                <input
                  type="number"
                  value={acceptMonto}
                  onChange={(e) => setAcceptMonto(e.target.value)}
                  className={styles.formInput}
                  placeholder="0.00"
                  step="0.01"
                />
                <span className={styles.formHint}>
                  Puedes ajustar el monto antes de confirmar. El miembro podrá aceptar o rechazar esta oferta.
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                <button
                  className={ticketStyles.primaryButton}
                  onClick={handleConfirmAccept}
                  disabled={updating || !acceptMonto}
                >
                  {updating ? "Aceptando..." : "Confirmar Aceptación"}
                </button>
                <button
                  className={ticketStyles.secondaryButton}
                  onClick={() => setShowAcceptModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Resend Bid Modal */}
        {showResendModal && (
          <div className={styles.modalOverlay} onClick={() => setShowResendModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Reenviar Oferta</h3>
              <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
                El miembro rechazó la oferta anterior. Puedes ajustar el monto y reenviar.
              </p>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nuevo Monto *</label>
                <input
                  type="number"
                  value={resendMonto}
                  onChange={(e) => setResendMonto(e.target.value)}
                  className={styles.formInput}
                  placeholder="0.00"
                  step="0.01"
                />
                <span className={styles.formHint}>
                  El miembro recibirá la nueva oferta y podrá aceptarla o rechazarla.
                </span>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
                <button
                  className={ticketStyles.primaryButton}
                  onClick={handleConfirmResend}
                  disabled={updating || !resendMonto}
                >
                  {updating ? "Enviando..." : "Reenviar Oferta"}
                </button>
                <button
                  className={ticketStyles.secondaryButton}
                  onClick={() => setShowResendModal(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.detailGrid}>
          {/* Main Content */}
          <div className={styles.detailMain}>
            {/* Header Card */}
            <div className={styles.detailCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h1 className={styles.detailTitle}>{project.titulo}</h1>
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center", marginTop: "var(--space-2)" }}>
                    <span className={`${styles.projectStatus} ${getStatusClass(project.estado)}`}>
                      {getStatusLabel(project.estado)}
                    </span>
                    {project.republicado && (
                      <span className={styles.republishedBadge}>Convocatoria Abierta</span>
                    )}
                    {/* Show visibility badge for member projects */}
                    {project.tipo_proyecto === "miembro" && (
                      <span className={`${styles.visibilityBadge} ${project.visibilidad === "privado" ? styles.visibilityPrivado : styles.visibilityPublico}`}>
                        {project.visibilidad === "privado" ? <><LockIcon /> Privado</> : <><GlobeIcon /> Publico</>}
                      </span>
                    )}
                    {/* Show owner badge if member owns this project */}
                    {isMemberOwner && (
                      <span className={styles.ownerBadge}>Mi Proyecto</span>
                    )}
                  </div>
                </div>
              </div>

              {project.descripcion && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <h4 className={styles.detailCardTitle}>Descripción</h4>
                  <p className={styles.detailDescription}>{project.descripcion}</p>
                </div>
              )}

              {/* Show justificacion_cierre if closed */}
              {isClosedState && project.justificacion_cierre && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <h4 className={styles.detailCardTitle}>Justificación de Cierre</h4>
                  <p className={styles.detailDescription}>{project.justificacion_cierre}</p>
                  {project.cerrado_por && (
                    <span className={styles.creadoPorBadge} style={{ marginTop: "var(--space-2)" }}>
                      Cerrado por: {project.cerrado_por === "cliente" ? "Cliente" : "Miembro"}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons for Client */}
              {isProjectOwner && !isClosedState && (
                <div style={{ marginTop: "var(--space-4)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  {/* Planificar: when publicado and there are accepted members, all confirmed */}
                  {project.estado === "publicado" && acceptedMembers.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                      <button
                        className={ticketStyles.primaryButton}
                        onClick={handlePlanifyProject}
                        disabled={updating || !allMembersConfirmed}
                      >
                        {updating ? "Procesando..." : "Planificar Proyecto"}
                      </button>
                      {!allMembersConfirmed && (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          Todos los miembros deben confirmar su participación
                        </span>
                      )}
                    </div>
                  )}
                  {/* Iniciar: when planificado */}
                  {project.estado === "planificado" && (
                    <button
                      className={ticketStyles.primaryButton}
                      onClick={handleStartProject}
                      disabled={updating}
                    >
                      {updating ? "Procesando..." : "Iniciar Proyecto"}
                    </button>
                  )}
                  {/* Republicar: when en_progreso */}
                  {project.estado === "en_progreso" && !project.republicado && (
                    <button
                      className={ticketStyles.secondaryButton}
                      onClick={() => {
                        setRepublishTitulo(project.titulo);
                        setRepublishDescripcion(project.descripcion || "");
                        setShowRepublishForm(true);
                      }}
                      disabled={updating}
                    >
                      Republicar Proyecto
                    </button>
                  )}
                  {/* Cerrar Convocatoria: when republicado */}
                  {project.estado === "en_progreso" && project.republicado && (
                    <button
                      className={styles.rejectButton}
                      onClick={handleCloseConvocatoria}
                      disabled={updating}
                    >
                      {updating ? "Procesando..." : "Cerrar Convocatoria"}
                    </button>
                  )}
                </div>
              )}

              {/* Republish Form */}
              {showRepublishForm && (
                <div className={styles.republishForm}>
                  <h4 className={styles.detailCardTitle}>Republicar Proyecto</h4>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Título *</label>
                    <input
                      type="text"
                      value={republishTitulo}
                      onChange={(e) => setRepublishTitulo(e.target.value)}
                      className={styles.formInput}
                      placeholder="Título del proyecto"
                    />
                  </div>
                  <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
                    <label className={styles.formLabel}>Descripción</label>
                    <textarea
                      value={republishDescripcion}
                      onChange={(e) => setRepublishDescripcion(e.target.value)}
                      className={styles.bidFormTextarea}
                      placeholder="Descripción actualizada del proyecto"
                      style={{ minHeight: "80px" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                    <button
                      className={ticketStyles.primaryButton}
                      onClick={handleRepublish}
                      disabled={updating || !republishTitulo}
                    >
                      {updating ? "Procesando..." : "Republicar"}
                    </button>
                    <button
                      className={ticketStyles.secondaryButton}
                      onClick={() => setShowRepublishForm(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Requirements Card - visible for team members, owner, or any member viewing publicado projects */}
            {(
              ((isTeamMember || isProjectOwner) && ["publicado", "planificado", "en_progreso"].includes(project.estado)) ||
              ((userRole === "miembro" || userRole === "admin") && project.estado === "publicado")
            ) && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Requerimientos</h4>

                {/* Progress bar - only for team members and project owner */}
                {(isTeamMember || isProjectOwner) && totalReqs > 0 && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressLabel}>
                      <span>Progreso</span>
                      <span>{completedReqs}/{totalReqs} completados ({progress}%)</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                <div className={styles.requirementsList}>
                  {requirements.map((req) => (
                    <div
                      key={req.id}
                      className={`${styles.requirementItem} ${(isTeamMember || isProjectOwner) && req.completado ? styles.requirementCompleted : ""}`}
                    >
                      {/* Edit form - only for team members */}
                      {(isTeamMember || isProjectOwner) && editingReq === req.id ? (
                        <div style={{ flex: 1 }}>
                          <div className={styles.formRow}>
                            <div className={styles.formGroup}>
                              <input
                                type="text"
                                value={editReqTitulo}
                                onChange={(e) => setEditReqTitulo(e.target.value)}
                                className={styles.formInput}
                                placeholder="Título"
                              />
                            </div>
                            <div className={styles.formGroup} style={{ maxWidth: "120px" }}>
                              <input
                                type="number"
                                value={editReqCosto}
                                onChange={(e) => setEditReqCosto(e.target.value)}
                                className={styles.formInput}
                                placeholder="Costo"
                              />
                            </div>
                          </div>
                          <input
                            type="text"
                            value={editReqDescripcion}
                            onChange={(e) => setEditReqDescripcion(e.target.value)}
                            className={styles.formInput}
                            placeholder="Descripción"
                            style={{ marginBottom: "var(--space-2)" }}
                          />
                          <div className={styles.checkboxRow}>
                            <input
                              type="checkbox"
                              id="editEsAdicional"
                              checked={editReqEsAdicional}
                              onChange={(e) => setEditReqEsAdicional(e.target.checked)}
                            />
                            <label htmlFor="editEsAdicional">Es requerimiento adicional</label>
                          </div>
                          <div style={{ display: "flex", gap: "var(--space-2)" }}>
                            <button className={ticketStyles.primaryButton} onClick={handleSaveEditReq} style={{ fontSize: "0.8rem", padding: "4px 12px" }}>
                              Guardar
                            </button>
                            <button className={ticketStyles.secondaryButton} onClick={() => setEditingReq(null)} style={{ fontSize: "0.8rem", padding: "4px 12px" }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (isTeamMember || isProjectOwner) ? (
                        /* Full view for team members and project owner */
                        <>
                          <button
                            className={`${styles.reqToggleBtn} ${req.completado ? styles.reqToggleDone : ""}`}
                            onClick={() => canToggleCompletado && handleToggleRequirement(req)}
                            disabled={!canToggleCompletado}
                            title={req.completado ? "Marcar como pendiente" : canToggleCompletado ? "Marcar como completado" : "Solo disponible en progreso"}
                          >
                            {req.completado ? (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="currentColor" />
                                <path d="M9.5 12.5l2 2 3.5-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : (
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M9.5 12.5l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
                              </svg>
                            )}
                          </button>
                          <div className={styles.requirementContent}>
                            <div className={styles.requirementTitle}>
                              {req.titulo}
                              <span className={`${styles.reqTypeBadge} ${req.es_adicional ? styles.reqTypeAdicional : styles.reqTypeInicial}`}>
                                {req.es_adicional ? "Adicional" : "Inicial"}
                              </span>
                            </div>
                            {req.descripcion && (
                              <div className={styles.requirementDesc}>{req.descripcion}</div>
                            )}
                            <div className={styles.reqMetaRow}>
                              {/* Creador */}
                              {req.creador ? (
                                <span className={styles.reqCreadorInfo} title={`Creado por ${req.creador.nombre}`}>
                                  {req.creador.foto ? (
                                    <img src={req.creador.foto} alt="" className={styles.reqCreadorAvatar} />
                                  ) : (
                                    <span className={styles.reqCreadorPlaceholder}>
                                      {req.creador.nombre?.charAt(0)?.toUpperCase() || "?"}
                                    </span>
                                  )}
                                  <span className={styles.reqCreadorName}>{req.creador.nombre}</span>
                                  <span className={styles.creadoPorBadge}>
                                    {req.creador.tipo === "cliente" ? "Cliente" : "Miembro"}
                                  </span>
                                </span>
                              ) : (
                                <span className={styles.creadoPorBadge}>
                                  {req.creado_por === "cliente" ? "Cliente" : "Miembro"}
                                </span>
                              )}
                              {/* Completado por */}
                              {req.completado && req.miembro_completado && (
                                <span className={styles.reqCompletadoPorInfo} title={`Completado por ${req.miembro_completado.nombre}`}>
                                  <span style={{ color: "var(--text-muted)", marginRight: "4px" }}>Completado:</span>
                                  {req.miembro_completado.foto ? (
                                    <img src={req.miembro_completado.foto} alt="" className={styles.reqCompletadoPorAvatar} />
                                  ) : (
                                    <span className={styles.reqCompletadoPorPlaceholder}>
                                      {req.miembro_completado.nombre?.charAt(0)?.toUpperCase() || "?"}
                                    </span>
                                  )}
                                  {req.miembro_completado.nombre}
                                </span>
                              )}
                            </div>
                          </div>
                          {req.costo != null && req.costo > 0 && (
                            <span className={styles.requirementCost}>{formatCurrency(req.costo)}</span>
                          )}
                          {!isClosedState && (
                            <div className={styles.requirementActions}>
                              {canEditRequirement(req) && (
                                <button
                                  className={styles.reqActionBtn}
                                  onClick={() => handleStartEditReq(req)}
                                  title="Editar"
                                >
                                  <EditIcon />
                                </button>
                              )}
                              {canDeleteRequirement && (
                                <button
                                  className={`${styles.reqActionBtn} ${styles.reqActionBtnDanger}`}
                                  onClick={() => handleDeleteRequirement(req.id)}
                                  title="Eliminar"
                                >
                                  <TrashIcon />
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Read-only view for members viewing to apply */
                        <div className={styles.requirementContent} style={{ marginLeft: 0 }}>
                          <div className={styles.requirementTitle}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ marginRight: "8px", flexShrink: 0 }}>
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            {req.titulo}
                          </div>
                          {req.descripcion && (
                            <div className={styles.requirementDesc}>{req.descripcion}</div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add requirement form */}
                {canManageRequirements && !isClosedState && (
                  <>
                    {!showReqForm ? (
                      <button
                        className={ticketStyles.secondaryButton}
                        onClick={() => setShowReqForm(true)}
                        style={{ marginTop: "var(--space-4)" }}
                      >
                        + Agregar Requerimiento
                      </button>
                    ) : (
                      <div className={styles.addRequirementForm}>
                        <div className={styles.formRow}>
                          <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Título *</label>
                            <input
                              type="text"
                              value={reqTitulo}
                              onChange={(e) => setReqTitulo(e.target.value)}
                              className={styles.formInput}
                              placeholder="Nombre del requerimiento"
                            />
                          </div>
                          <div className={styles.formGroup} style={{ maxWidth: "150px" }}>
                            <label className={styles.formLabel}>Costo</label>
                            <input
                              type="number"
                              value={reqCosto}
                              onChange={(e) => setReqCosto(e.target.value)}
                              className={styles.formInput}
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Descripción</label>
                          <input
                            type="text"
                            value={reqDescripcion}
                            onChange={(e) => setReqDescripcion(e.target.value)}
                            className={styles.formInput}
                            placeholder="Descripción opcional"
                          />
                        </div>
                        <div className={styles.checkboxRow}>
                          <input
                            type="checkbox"
                            id="reqEsAdicional"
                            checked={reqEsAdicional}
                            onChange={(e) => setReqEsAdicional(e.target.checked)}
                          />
                          <label htmlFor="reqEsAdicional">Es requerimiento adicional</label>
                        </div>
                        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                          <button
                            className={ticketStyles.primaryButton}
                            onClick={handleAddRequirement}
                            disabled={!reqTitulo}
                          >
                            Agregar
                          </button>
                          <button
                            className={ticketStyles.secondaryButton}
                            onClick={() => { setShowReqForm(false); setReqEsAdicional(false); }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Bids Card (for project owner while publicado or en_progreso+republicado) */}
            {isProjectOwner && (project.estado === "publicado" || (project.estado === "en_progreso" && project.republicado)) && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Postulaciones ({bids.length})</h4>

                {bids.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "var(--space-4)" }}>
                    Aún no hay postulaciones para este proyecto
                  </p>
                ) : (
                  <div className={styles.bidsList}>
                    {bids.map((bid) => (
                      <div key={bid.id} className={styles.bidCard}>
                        <div className={styles.bidHeader}>
                          {bid.miembro?.foto ? (
                            <img src={bid.miembro.foto} alt="" className={styles.bidAvatarImg} />
                          ) : (
                            <div className={styles.bidAvatar}>
                              {bid.miembro?.nombre?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div className={styles.bidInfo}>
                            <div className={styles.bidMemberName}>{bid.miembro?.nombre}</div>
                            <div className={styles.bidMemberRole}>{bid.miembro?.puesto || "Miembro"}</div>
                          </div>
                          <span className={`${styles.bidStatus} ${
                            bid.estado === "pendiente" ? styles.bidPendiente :
                            bid.estado === "aceptada" ? styles.bidAceptada : styles.bidRechazada
                          }`}>
                            {bid.estado === "aceptada" && bid.confirmado_por_miembro
                              ? "confirmada"
                              : bid.estado === "aceptada" && bid.confirmado_por_miembro === false
                              ? "rechazada por miembro"
                              : bid.estado}
                          </span>
                        </div>

                        <p className={styles.bidProposal}>{bid.propuesta}</p>

                        {/* Bid Images Gallery */}
                        {bid.imagenes && bid.imagenes.length > 0 && (
                          <div className={styles.bidGallery}>
                            {bid.imagenes.map((img, i) => (
                              <a key={i} href={img} target="_blank" rel="noopener noreferrer" className={styles.bidThumbnail}>
                                <img src={img} alt={`Imagen ${i + 1}`} />
                              </a>
                            ))}
                          </div>
                        )}

                        <div className={styles.bidDetails}>
                          <span className={styles.bidPrice}>{formatCurrency(bid.precio_ofertado)}</span>
                          {bid.monto_acordado && (
                            <span className={styles.bidAgreedAmount}>
                              Monto acordado: {formatCurrency(bid.monto_acordado)}
                            </span>
                          )}
                          {bid.tiempo_estimado_dias && (
                            <span className={styles.bidTime}>{bid.tiempo_estimado_dias} días</span>
                          )}
                        </div>

                        {bid.estado === "pendiente" && (
                          <div className={styles.bidActions}>
                            <button
                              className={ticketStyles.primaryButton}
                              onClick={() => handleOpenAcceptModal(bid)}
                              disabled={updating}
                            >
                              Aceptar
                            </button>
                          </div>
                        )}

                        {/* Resend button - when member rejected the offer */}
                        {bid.estado === "rechazada" && bid.confirmado_por_miembro === false && (
                          <div className={styles.bidActions}>
                            <button
                              className={ticketStyles.primaryButton}
                              onClick={() => handleOpenResendModal(bid)}
                              disabled={updating}
                            >
                              Reenviar Oferta
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bid Form (for members on publicado or en_progreso+republicado projects who haven't bid yet) */}
            {userRole === "miembro" && (project.estado === "publicado" || (project.estado === "en_progreso" && project.republicado)) && !userBid && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Enviar Postulación</h4>

                {acceptedMembers.length > 0 && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "var(--space-3)" }}>
                    Ya hay {acceptedMembers.length} miembro(s) aceptado(s) en este proyecto. Aún puedes postularte.
                  </p>
                )}

                {!showBidForm ? (
                  <button
                    className={ticketStyles.primaryButton}
                    onClick={() => setShowBidForm(true)}
                  >
                    Postularme
                  </button>
                ) : (
                  <div className={styles.bidForm}>
                    <textarea
                      value={bidPropuesta}
                      onChange={(e) => setBidPropuesta(e.target.value)}
                      className={styles.bidFormTextarea}
                      placeholder="Describe tu propuesta y por qué eres el candidato ideal..."
                    />

                    <div className={styles.bidFormRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Precio Ofertado *</label>
                        <input
                          type="number"
                          value={bidPrecio}
                          onChange={(e) => setBidPrecio(e.target.value)}
                          className={styles.formInput}
                          placeholder="0.00"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tiempo Estimado (días)</label>
                        <input
                          type="number"
                          value={bidTiempo}
                          onChange={(e) => setBidTiempo(e.target.value)}
                          className={styles.formInput}
                          placeholder="Ej: 30"
                        />
                      </div>
                    </div>

                    {/* Image Upload Area */}
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Imágenes (máx. 5)</label>
                      <div className={styles.imageUploadArea}>
                        {bidImages.map((img, i) => (
                          <div key={i} className={styles.imagePreview}>
                            <img src={img} alt={`Preview ${i + 1}`} />
                            <button
                              className={styles.imageRemoveBtn}
                              onClick={() => handleRemoveImage(i)}
                              type="button"
                            >
                              <XIcon />
                            </button>
                          </div>
                        ))}
                        {bidImages.length < 5 && (
                          <label className={styles.imageAddBtn}>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              onChange={handleImageUpload}
                              style={{ display: "none" }}
                              disabled={uploadingImage}
                            />
                            {uploadingImage ? "..." : "+"}
                          </label>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button
                        className={ticketStyles.primaryButton}
                        onClick={handleSubmitBid}
                        disabled={submittingBid || !bidPropuesta || !bidPrecio}
                      >
                        {submittingBid ? "Enviando..." : "Enviar Postulación"}
                      </button>
                      <button
                        className={ticketStyles.secondaryButton}
                        onClick={() => setShowBidForm(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Show user's bid (for members who already bid) */}
            {userBid && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Tu Postulación</h4>
                <div className={styles.bidCard}>
                  <p className={styles.bidProposal}>{userBid.propuesta}</p>

                  {userBid.imagenes && userBid.imagenes.length > 0 && (
                    <div className={styles.bidGallery}>
                      {userBid.imagenes.map((img, i) => (
                        <a key={i} href={img} target="_blank" rel="noopener noreferrer" className={styles.bidThumbnail}>
                          <img src={img} alt={`Imagen ${i + 1}`} />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className={styles.bidDetails}>
                    <span className={styles.bidPrice}>{formatCurrency(userBid.precio_ofertado)}</span>
                    {userBid.monto_acordado && (
                      <span className={styles.bidAgreedAmount}>
                        Monto acordado: {formatCurrency(userBid.monto_acordado)}
                      </span>
                    )}
                    <span className={`${styles.bidStatus} ${
                      userBid.estado === "pendiente" ? styles.bidPendiente :
                      userBid.estado === "aceptada" ? styles.bidAceptada : styles.bidRechazada
                    }`}>
                      {userBid.estado}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Finish Work + Report Problem - for team member (en_progreso) */}
            {isTeamMember && project.estado === "en_progreso" && (
              <>
                {/* Marcar trabajo finalizado */}
                <div className={styles.detailCard}>
                  <h4 className={styles.detailCardTitle}>Mi Trabajo</h4>
                  <button
                    className={`${styles.finishWorkBtn} ${hasFinishedWork ? styles.finishWorkBtnDone : ""}`}
                    onClick={handleFinishWork}
                    disabled={updating}
                  >
                    {hasFinishedWork ? (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path d="M9 11l-4 4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 15h10a4 4 0 0 0 0-8h-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M9 12.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    <span>
                      {updating
                        ? "Procesando..."
                        : hasFinishedWork
                          ? "Desmarcar trabajo finalizado"
                          : "Marcar trabajo como finalizado"}
                    </span>
                    {hasFinishedWork && currentMemberAccepted?.fecha_trabajo_finalizado ? (
                      <span className={styles.finishWorkHint}>
                        Finalizado el {formatDate(currentMemberAccepted.fecha_trabajo_finalizado)}
                      </span>
                    ) : (
                      <span className={styles.finishWorkHint}>
                        Cuando todos los miembros lo hagan, el proyecto se completa automáticamente
                      </span>
                    )}
                  </button>
                </div>

                {/* Reportar problema */}
                <div className={styles.detailCard}>
                  <h4 className={styles.detailCardTitle}>Reportar Problema</h4>
                  {!showClosePanel ? (
                    <button
                      className={ticketStyles.secondaryButton}
                      onClick={() => setShowClosePanel(true)}
                    >
                      Reportar Problema
                    </button>
                  ) : (
                    <div className={styles.closePanelForm}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Tipo de Problema *</label>
                        <select
                          value={closeEstado}
                          onChange={(e) => setCloseEstado(e.target.value)}
                          className={styles.formInput}
                        >
                          <option value="">Seleccionar...</option>
                          <option value="completado_parcial">Completado Parcial</option>
                          <option value="no_completado">No Completado</option>
                          <option value="cancelado_sin_acuerdo">Cancelado - Sin Acuerdo</option>
                          <option value="cancelado_sin_presupuesto">Cancelado - Sin Presupuesto</option>
                          <option value="no_pagado">No Pagado (Bloquea al cliente)</option>
                        </select>
                      </div>
                      {["no_completado", "cancelado_sin_acuerdo", "cancelado_sin_presupuesto", "no_pagado"].includes(closeEstado) && (
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Justificación *</label>
                          <textarea
                            value={closeJustificacion}
                            onChange={(e) => setCloseJustificacion(e.target.value)}
                            className={styles.bidFormTextarea}
                            placeholder="Describe la razón..."
                            style={{ minHeight: "80px" }}
                          />
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                        <button
                          className={closeEstado === "no_pagado" ? styles.dangerButton : ticketStyles.primaryButton}
                          onClick={handleCloseProject}
                          disabled={updating || !closeEstado || (["no_completado", "cancelado_sin_acuerdo", "cancelado_sin_presupuesto", "no_pagado"].includes(closeEstado) && !closeJustificacion)}
                        >
                          {updating ? "Procesando..." : "Confirmar"}
                        </button>
                        <button
                          className={ticketStyles.secondaryButton}
                          onClick={() => { setShowClosePanel(false); setCloseEstado(""); setCloseJustificacion(""); }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Close Project Panel - for client (report member) */}
            {isProjectOwner && project.estado === "en_progreso" && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Reportar Problema</h4>
                {!showClosePanel ? (
                  <button
                    className={styles.rejectButton}
                    onClick={() => { setShowClosePanel(true); setCloseEstado("no_completado_por_miembro"); }}
                  >
                    Reportar: Miembro no cumplió
                  </button>
                ) : (
                  <div className={styles.closePanelForm}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Justificación *</label>
                      <textarea
                        value={closeJustificacion}
                        onChange={(e) => setCloseJustificacion(e.target.value)}
                        className={styles.bidFormTextarea}
                        placeholder="Describe lo que sucedió..."
                        style={{ minHeight: "80px" }}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                      <button
                        className={styles.dangerButton}
                        onClick={handleCloseProject}
                        disabled={updating || !closeJustificacion}
                      >
                        {updating ? "Procesando..." : "Enviar Reporte"}
                      </button>
                      <button
                        className={ticketStyles.secondaryButton}
                        onClick={() => { setShowClosePanel(false); setCloseEstado(""); setCloseJustificacion(""); }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className={styles.detailSidebar}>
            {/* Budget Card */}
            <div className={styles.detailCard}>
              <h4 className={styles.detailCardTitle}>Presupuesto</h4>
              <div className={ticketStyles.infoRow}>
                <span className={ticketStyles.infoLabel}>Mínimo</span>
                <span className={ticketStyles.infoValue}>
                  {project.presupuesto_min ? formatCurrency(project.presupuesto_min) : "No especificado"}
                </span>
              </div>
              <div className={ticketStyles.infoRow}>
                <span className={ticketStyles.infoLabel}>Máximo</span>
                <span className={ticketStyles.infoValue}>
                  {project.presupuesto_max ? formatCurrency(project.presupuesto_max) : "No especificado"}
                </span>
              </div>
              {totalMontoAcordado > 0 && (
                <div className={ticketStyles.infoRow}>
                  <span className={ticketStyles.infoLabel}>Total Acordado</span>
                  <span style={{ color: "var(--turquoise)", fontWeight: 700 }}>
                    {formatCurrency(totalMontoAcordado)}
                  </span>
                </div>
              )}
              {totalCost > 0 && (
                <div className={ticketStyles.infoRow}>
                  <span className={ticketStyles.infoLabel}>Costo Actual</span>
                  <span style={{ color: "var(--turquoise)", fontWeight: 600 }}>
                    {formatCurrency(totalCost)}
                  </span>
                </div>
              )}
            </div>

            {/* Details Card */}
            <div className={styles.detailCard}>
              <h4 className={styles.detailCardTitle}>Detalles</h4>
              <div className={ticketStyles.infoRow}>
                <span className={ticketStyles.infoLabel}>Creado</span>
                <span className={ticketStyles.infoValue}>{formatDate(project.created_at)}</span>
              </div>
              {project.fecha_limite && (
                <div className={ticketStyles.infoRow}>
                  <span className={ticketStyles.infoLabel}>Fecha Límite</span>
                  <span className={ticketStyles.infoValue}>{formatDate(project.fecha_limite)}</span>
                </div>
              )}
              <div className={ticketStyles.infoRow}>
                <span className={ticketStyles.infoLabel}>Postulaciones</span>
                <span className={ticketStyles.infoValue}>{bids.length}</span>
              </div>
            </div>

            {/* Member Owner Card (for member projects) */}
            {project.tipo_proyecto === "miembro" && project.miembro_propietario && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Propietario</h4>
                <div className={styles.ownerCard}>
                  {project.miembro_propietario.foto ? (
                    <img src={project.miembro_propietario.foto} alt="" className={styles.ownerAvatar} />
                  ) : (
                    <div className={styles.ownerAvatarPlaceholder}>
                      {project.miembro_propietario.nombre?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div>
                    <div className={styles.ownerName}>{project.miembro_propietario.nombre}</div>
                    {project.miembro_propietario.puesto && (
                      <div className={styles.ownerRole}>{project.miembro_propietario.puesto}</div>
                    )}
                  </div>
                </div>
                {/* Visibility toggle for member owner */}
                {isMemberOwner && !isClosedState && (
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <button
                      className={styles.visibilityToggleBtn}
                      onClick={handleToggleVisibility}
                      disabled={updating}
                    >
                      {project.visibilidad === "privado" ? (
                        <><GlobeIcon /> Hacer Publico</>
                      ) : (
                        <><LockIcon /> Hacer Privado</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Client Card */}
            {project.cliente && project.cliente.id && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Cliente</h4>
                <div className={ticketStyles.infoRow}>
                  <span className={ticketStyles.infoLabel}>Nombre</span>
                  <span className={ticketStyles.infoValue}>{project.cliente.nombre}</span>
                </div>
              </div>
            )}

            {/* Team / Accepted Members Card */}
            {acceptedMembers.length > 0 && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>
                  Equipo ({acceptedMembers.length})
                </h4>
                <div className={styles.teamList}>
                  {acceptedMembers.map((member) => (
                    <div key={member.bid_id} className={styles.teamMember}>
                      <div className={styles.teamMemberInfo}>
                        {member.miembro.foto ? (
                          <img src={member.miembro.foto} alt="" className={styles.teamMemberAvatar} />
                        ) : (
                          <div className={styles.teamMemberAvatarPlaceholder}>
                            {member.miembro.nombre?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                        )}
                        <div>
                          <div className={styles.teamMemberName}>{member.miembro.nombre}</div>
                          {member.miembro.puesto && (
                            <div className={styles.teamMemberRole}>{member.miembro.puesto}</div>
                          )}
                        </div>
                      </div>
                      <div className={styles.teamMemberMeta}>
                        {member.monto_acordado && (
                          <span className={styles.teamMemberMonto}>
                            {formatCurrency(member.monto_acordado)}
                          </span>
                        )}
                        <span className={`${styles.teamMemberStatus} ${
                          member.confirmado_por_miembro === true ? styles.teamStatusConfirmed :
                          member.confirmado_por_miembro === false ? styles.teamStatusRejected :
                          styles.teamStatusPending
                        }`}>
                          {member.confirmado_por_miembro === true
                            ? "Confirmado"
                            : member.confirmado_por_miembro === false
                            ? "Rechazó"
                            : "Pendiente"}
                        </span>
                      </div>
                      {project.estado === "en_progreso" && member.confirmado_por_miembro === true && (
                        <div className={`${styles.teamWorkStatus} ${member.trabajo_finalizado ? styles.teamWorkFinished : styles.teamWorkInProgress}`}>
                          {member.trabajo_finalizado ? (
                            <><CheckIcon /> Trabajo finalizado</>
                          ) : (
                            <>En progreso</>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function ProjectDetailPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px"
          }}>
            <div style={{
              width: "32px",
              height: "32px",
              border: "3px solid rgba(255,255,255,0.1)",
              borderTopColor: "var(--turquoise)",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }} />
          </div>
        </DashboardLayout>
      }
    >
      <ProjectDetailPageContent />
    </Suspense>
  );
}

// Extend window for temporary file storage
declare global {
  interface Window {
    __bidImageFiles?: File[];
  }
}
