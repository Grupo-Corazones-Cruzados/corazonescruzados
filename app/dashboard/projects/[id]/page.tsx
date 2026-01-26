"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useProject, useSubmitBid, ProjectBid, ProjectRequirement } from "@/lib/hooks/useProjects";
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

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "publicado":
      return styles.statusPublicado;
    case "asignado":
      return styles.statusAsignado;
    case "en_progreso":
      return styles.statusEnProgreso;
    case "completado":
      return styles.statusCompletado;
    default:
      return styles.statusPublicado;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "publicado":
      return "Publicado";
    case "asignado":
      return "Asignado";
    case "en_progreso":
      return "En Progreso";
    case "completado":
      return "Completado";
    default:
      return estado;
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
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

export default function ProjectDetailPage() {
  const params = useParams();
  const { profile } = useAuth();
  const projectId = params?.id ? parseInt(params.id as string, 10) : null;
  const {
    project,
    bids,
    requirements,
    loading,
    error,
    updateProject,
    acceptBid,
    addRequirement,
    updateRequirement,
  } = useProject(projectId);
  const { submitBid, loading: submittingBid } = useSubmitBid();

  const userRole = profile?.rol || "cliente";
  const userMiembroId = profile?.id_miembro;

  // Check if current user already submitted a bid
  const userBid = bids.find((b) => b.id_miembro === userMiembroId);
  const isProjectOwner = userRole === "cliente"; // Simplified check
  const isAssignedMember = project?.id_miembro_asignado === userMiembroId;

  // Bid form state
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPropuesta, setBidPropuesta] = useState("");
  const [bidPrecio, setBidPrecio] = useState("");
  const [bidTiempo, setBidTiempo] = useState("");

  // Requirement form state
  const [showReqForm, setShowReqForm] = useState(false);
  const [reqTitulo, setReqTitulo] = useState("");
  const [reqDescripcion, setReqDescripcion] = useState("");
  const [reqCosto, setReqCosto] = useState("");

  const [updating, setUpdating] = useState(false);

  const handleSubmitBid = async () => {
    if (!userMiembroId || !projectId) return;

    const result = await submitBid({
      id_project: projectId,
      id_miembro: userMiembroId,
      propuesta: bidPropuesta,
      precio_ofertado: parseFloat(bidPrecio) || 0,
      tiempo_estimado_dias: bidTiempo ? parseInt(bidTiempo) : undefined,
    });

    if (!result.error) {
      setShowBidForm(false);
      setBidPropuesta("");
      setBidPrecio("");
      setBidTiempo("");
      window.location.reload(); // Simple refresh
    } else {
      alert(result.error);
    }
  };

  const handleAcceptBid = async (bidId: number) => {
    setUpdating(true);
    const result = await acceptBid(bidId);
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
    });

    if (!result.error) {
      setShowReqForm(false);
      setReqTitulo("");
      setReqDescripcion("");
      setReqCosto("");
    } else {
      alert(result.error);
    }
  };

  const handleToggleRequirement = async (req: ProjectRequirement) => {
    await updateRequirement(req.id, { completado: !req.completado });
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    await updateProject({ estado: newStatus });
    setUpdating(false);
  };

  // Calculate progress
  const completedReqs = requirements.filter((r) => r.completado).length;
  const totalReqs = requirements.length;
  const progress = totalReqs > 0 ? Math.round((completedReqs / totalReqs) * 100) : 0;
  const totalCost = requirements.reduce((sum, r) => sum + (r.costo || 0), 0);

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
          <Link href="/dashboard/projects" className={ticketStyles.backButton}>
            <ArrowLeftIcon />
            Volver a proyectos
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
        <Link href="/dashboard/projects" className={ticketStyles.backButton}>
          <ArrowLeftIcon />
          Volver a proyectos
        </Link>

        <div className={styles.detailGrid}>
          {/* Main Content */}
          <div className={styles.detailMain}>
            {/* Header Card */}
            <div className={styles.detailCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h1 className={styles.detailTitle}>{project.titulo}</h1>
                  <span className={`${styles.projectStatus} ${getStatusClass(project.estado)}`}>
                    {getStatusLabel(project.estado)}
                  </span>
                </div>
              </div>

              {project.descripcion && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <h4 className={styles.detailCardTitle}>Descripción</h4>
                  <p className={styles.detailDescription}>{project.descripcion}</p>
                </div>
              )}
            </div>

            {/* Requirements Card (for assigned member) */}
            {(isAssignedMember || isProjectOwner) && project.estado !== "publicado" && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Requerimientos</h4>

                {totalReqs > 0 && (
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
                      className={`${styles.requirementItem} ${req.completado ? styles.requirementCompleted : ""}`}
                    >
                      <button
                        className={styles.requirementCheckbox}
                        onClick={() => isAssignedMember && handleToggleRequirement(req)}
                        disabled={!isAssignedMember}
                      >
                        {req.completado && <CheckIcon />}
                      </button>
                      <div className={styles.requirementContent}>
                        <div className={styles.requirementTitle}>{req.titulo}</div>
                        {req.descripcion && (
                          <div className={styles.requirementDesc}>{req.descripcion}</div>
                        )}
                      </div>
                      {req.costo && (
                        <span className={styles.requirementCost}>{formatCurrency(req.costo)}</span>
                      )}
                    </div>
                  ))}
                </div>

                {isAssignedMember && (
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
                            onClick={() => setShowReqForm(false)}
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

            {/* Bids Card (for project owner) */}
            {isProjectOwner && project.estado === "publicado" && (
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
                              {bid.miembro?.nombre?.charAt(0).toUpperCase()}
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
                            {bid.estado}
                          </span>
                        </div>

                        <p className={styles.bidProposal}>{bid.propuesta}</p>

                        <div className={styles.bidDetails}>
                          <span className={styles.bidPrice}>{formatCurrency(bid.precio_ofertado)}</span>
                          {bid.tiempo_estimado_dias && (
                            <span className={styles.bidTime}>{bid.tiempo_estimado_dias} días</span>
                          )}
                        </div>

                        {bid.estado === "pendiente" && (
                          <div className={styles.bidActions}>
                            <button
                              className={ticketStyles.primaryButton}
                              onClick={() => handleAcceptBid(bid.id)}
                              disabled={updating}
                            >
                              Aceptar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bid Form (for members) */}
            {userRole === "miembro" && project.estado === "publicado" && !userBid && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Enviar Postulación</h4>

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

            {/* Show user's bid */}
            {userBid && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Tu Postulación</h4>
                <div className={styles.bidCard}>
                  <p className={styles.bidProposal}>{userBid.propuesta}</p>
                  <div className={styles.bidDetails}>
                    <span className={styles.bidPrice}>{formatCurrency(userBid.precio_ofertado)}</span>
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

            {/* Client Card */}
            {project.cliente && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Cliente</h4>
                <div className={ticketStyles.infoRow}>
                  <span className={ticketStyles.infoLabel}>Nombre</span>
                  <span className={ticketStyles.infoValue}>{project.cliente.nombre}</span>
                </div>
              </div>
            )}

            {/* Assigned Member Card */}
            {project.miembro_asignado && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Miembro Asignado</h4>
                <div className={ticketStyles.memberCard}>
                  {project.miembro_asignado.foto ? (
                    <img
                      src={project.miembro_asignado.foto}
                      alt=""
                      className={ticketStyles.memberAvatar}
                    />
                  ) : (
                    <div className={ticketStyles.memberAvatar} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "var(--turquoise)",
                    }}>
                      {project.miembro_asignado.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={ticketStyles.memberInfo}>
                    <div className={ticketStyles.memberName}>{project.miembro_asignado.nombre}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions (for assigned member) */}
            {isAssignedMember && project.estado !== "completado" && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Acciones</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {project.estado === "asignado" && (
                    <button
                      className={ticketStyles.primaryButton}
                      onClick={() => handleStatusChange("en_progreso")}
                      disabled={updating}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      Iniciar Proyecto
                    </button>
                  )}
                  {project.estado === "en_progreso" && (
                    <button
                      className={ticketStyles.primaryButton}
                      onClick={() => handleStatusChange("completado")}
                      disabled={updating}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      Marcar Completado
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
