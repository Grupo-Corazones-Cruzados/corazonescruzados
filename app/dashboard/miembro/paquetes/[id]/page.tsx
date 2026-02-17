"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useMemberAsignacionDetail, usePreConfirm } from "@/lib/hooks/usePaqueteSolicitudes";
import styles from "@/app/styles/PaqueteSolicitudes.module.css";

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  const map: Record<string, string> = {
    pendiente: styles.statusPendiente,
    aprobado: styles.statusAprobado,
    en_progreso: styles.statusEnProgreso,
    pre_confirmado: styles.statusPreConfirmado,
    completado: styles.statusCompletado,
    rechazado: styles.statusRechazado,
  };
  return map[estado] || styles.statusPendiente;
};

const getStatusLabel = (estado: string): string => {
  const map: Record<string, string> = {
    pendiente: "Pendiente",
    aprobado: "Aprobado",
    en_progreso: "En Progreso",
    pre_confirmado: "Pre-Confirmado",
    completado: "Completado",
    rechazado: "Rechazado",
  };
  return map[estado] || estado;
};

const formatDateTime = (dateString: string): string => {
  return new Date(dateString).toLocaleString("es-ES", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export default function MiembroAsignacionDetailPage() {
  const params = useParams();
  const asignacionId = params.id ? parseInt(params.id as string) : null;
  const { asignacion, avances, loading, error, refetch } = useMemberAsignacionDetail(asignacionId);
  const { preConfirm, loading: preConfirming } = usePreConfirm();

  const [contenido, setContenido] = useState("");
  const [horasReportadas, setHorasReportadas] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Modals
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPreConfirmModal, setShowPreConfirmModal] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [preConfirmNote, setPreConfirmNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const handleAddAvance = async () => {
    if (!contenido.trim() || !asignacionId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/member/paquete-asignaciones/${asignacionId}/avances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido, horas_reportadas: horasReportadas }),
      });
      if (res.ok) {
        setContenido("");
        setHorasReportadas(0);
        refetch();
      } else {
        const data = await res.json();
        alert(data.error || "Error al agregar avance");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (estado: "aprobado" | "rechazado") => {
    if (!asignacionId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/member/paquete-asignaciones/${asignacionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, motivo: estado === "rechazado" ? motivo : undefined }),
      });
      if (res.ok) {
        setShowApproveModal(false);
        setShowRejectModal(false);
        setMotivo("");
        refetch();
      } else {
        const data = await res.json();
        alert(data.error || "Error");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePreConfirm = async () => {
    if (!asignacionId) return;
    const result = await preConfirm(asignacionId, preConfirmNote || undefined);
    if (result.error) {
      alert(result.error);
    } else {
      setShowPreConfirmModal(false);
      setPreConfirmNote("");
      refetch();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !asignacion) {
    return (
      <DashboardLayout>
        <div className={styles.emptyState}>
          <p style={{ color: "var(--primary-red)" }}>{error || "No encontrado"}</p>
          <Link href="/dashboard/miembro/paquetes" className={styles.secondaryButton}>Volver</Link>
        </div>
      </DashboardLayout>
    );
  }

  const progress = Number(asignacion.horas_asignadas) > 0
    ? (Number(asignacion.horas_consumidas) / Number(asignacion.horas_asignadas)) * 100
    : 0;
  const beneficio = Number(asignacion.horas_asignadas) * 10;
  const canAddAvance = ["aprobado", "en_progreso"].includes(asignacion.estado);
  const canPreConfirm = ["aprobado", "en_progreso"].includes(asignacion.estado);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <Link href="/dashboard/miembro/paquetes" className={styles.backButton}>
          <ArrowLeftIcon /> Volver a paquetes
        </Link>

        <div className={styles.pageHeader}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
              <h1 className={styles.pageTitle}>Asignacion #{asignacion.id}</h1>
              <span className={`${styles.statusBadge} ${getStatusClass(asignacion.estado)}`}>
                {getStatusLabel(asignacion.estado)}
              </span>
            </div>
            <p className={styles.pageSubtitle}>
              {asignacion.cliente?.nombre} - {Number(asignacion.horas_asignadas)}h
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            {asignacion.estado === "pendiente" && (
              <>
                <button className={styles.approveButton} onClick={() => setShowApproveModal(true)}>
                  <CheckIcon /> Aprobar
                </button>
                <button className={styles.rejectButton} onClick={() => setShowRejectModal(true)}>
                  <XIcon /> Rechazar
                </button>
              </>
            )}
            {canPreConfirm && (
              <button className={styles.confirmButton} onClick={() => setShowPreConfirmModal(true)}>
                <CheckIcon /> Pre-Confirmar
              </button>
            )}
          </div>
        </div>

        <div className={styles.detailLayout}>
          {/* Main */}
          <div className={styles.detailMain}>
            {asignacion.descripcion_tarea && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Tarea</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                  {asignacion.descripcion_tarea}
                </p>
              </div>
            )}

            {asignacion.dias_semana && (asignacion.dias_semana as number[]).length > 0 && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Dias de Trabajo</h3>
                <div className={styles.daysBadges}>
                  {(asignacion.dias_semana as number[]).map((d) => (
                    <span key={d} className={`${styles.dayBadge} ${styles.dayBadgeSelected}`} style={{ cursor: "default" }}>
                      {DAYS[d]}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {asignacion.solicitud?.notas_cliente && (
              <div className={styles.clientNotes}>
                <strong>Notas del cliente:</strong> {asignacion.solicitud.notas_cliente}
              </div>
            )}

            {/* Avances Timeline */}
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Avances ({avances.length})</h3>
              {avances.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Aun no hay avances registrados.</p>
              ) : (
                <div className={styles.avancesTimeline}>
                  {avances.map((avance) => (
                    <div key={avance.id} className={styles.avanceItem}>
                      {avance.autor_foto ? (
                        <img src={avance.autor_foto} alt="" className={styles.avanceAvatar} />
                      ) : (
                        <div className={styles.avanceAvatarPlaceholder}>
                          {avance.autor_nombre?.charAt(0)?.toUpperCase() || (avance.autor_tipo === "cliente" ? "C" : "M")}
                        </div>
                      )}
                      <div className={`${styles.avanceContent} ${avance.es_pre_confirmacion ? styles.avancePreConfirmation : ""}`}>
                        <div className={styles.avanceHeader}>
                          <span className={styles.avanceAuthor}>
                            {avance.autor_nombre || (avance.autor_tipo === "cliente" ? "Cliente" : "Miembro")}
                          </span>
                          <span className={styles.avanceDate}>{formatDateTime(avance.created_at)}</span>
                        </div>
                        <p className={styles.avanceText}>{avance.contenido}</p>
                        {Number(avance.horas_reportadas) > 0 && (
                          <div className={styles.avanceHours}>
                            <ClockIcon /> {Number(avance.horas_reportadas).toFixed(1)}h reportadas
                          </div>
                        )}
                        {avance.imagenes && avance.imagenes.length > 0 && (
                          <div className={styles.avanceImages}>
                            {avance.imagenes.map((img, i) => (
                              <img key={i} src={img} alt="" className={styles.avanceImage} />
                            ))}
                          </div>
                        )}
                        {avance.es_pre_confirmacion && (
                          <span className={`${styles.statusBadge} ${styles.statusPreConfirmado}`} style={{ marginTop: "var(--space-2)", display: "inline-block" }}>
                            Pre-Confirmación
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add avance form */}
            {canAddAvance && (
              <div className={styles.avanceForm}>
                <h3 className={styles.avanceFormTitle}>Agregar Avance</h3>
                <textarea
                  value={contenido}
                  onChange={(e) => setContenido(e.target.value)}
                  className={styles.formTextarea}
                  placeholder="Describe tu avance..."
                  rows={4}
                />
                <div className={styles.avanceFormRow}>
                  <div className={styles.avanceFormHours}>
                    <label className={styles.avanceFormHoursLabel}>Horas</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={horasReportadas || ""}
                      onChange={(e) => setHorasReportadas(parseFloat(e.target.value) || 0)}
                      className={styles.avanceFormHoursInput}
                      placeholder="0"
                    />
                  </div>
                  <button
                    className={styles.primaryButton}
                    onClick={handleAddAvance}
                    disabled={submitting || !contenido.trim()}
                  >
                    {submitting ? "Enviando..." : "Enviar Avance"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className={styles.detailSidebar}>
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Horas</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Asignadas</span>
                <span className={styles.detailValue}>{Number(asignacion.horas_asignadas)}h</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Consumidas</span>
                <span className={styles.detailValue}>{Number(asignacion.horas_consumidas).toFixed(1)}h</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Restantes</span>
                <span className={styles.detailValue}>
                  {Math.max(0, Number(asignacion.horas_asignadas) - Number(asignacion.horas_consumidas)).toFixed(1)}h
                </span>
              </div>
              <div style={{ margin: "var(--space-3) 0" }}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              </div>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Beneficio Economico</h3>
              <div style={{ textAlign: "center", padding: "var(--space-3) 0" }}>
                <span className={styles.benefitBadge} style={{ fontSize: "1.25rem", padding: "var(--space-2) var(--space-4)" }}>
                  {formatCurrency(beneficio)}
                </span>
                <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "var(--space-2)" }}>
                  {Number(asignacion.horas_asignadas)}h x $10/h
                </p>
              </div>
            </div>

            {asignacion.cliente && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Cliente</h3>
                <div className={styles.sidebarMember}>
                  <div className={styles.sidebarMemberAvatarPlaceholder}>
                    {asignacion.cliente.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.sidebarMemberInfo}>
                    <div className={styles.sidebarMemberName}>{asignacion.cliente.nombre}</div>
                    <div className={styles.sidebarMemberRole}>{asignacion.cliente.correo_electronico}</div>
                  </div>
                </div>
              </div>
            )}

            {asignacion.solicitud && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Solicitud</h3>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Horas totales</span>
                  <span className={styles.detailValue}>{Number(asignacion.solicitud.horas_totales)}h</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Costo/hora</span>
                  <span className={styles.detailValue}>{formatCurrency(Number(asignacion.solicitud.costo_hora || 10))}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Approve Modal */}
        {showApproveModal && (
          <div className={styles.modalOverlay} onClick={() => setShowApproveModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Aprobar Asignacion</h3>
              <p className={styles.modalText}>
                Confirmas que aceptas esta asignacion de {Number(asignacion.horas_asignadas)}h?
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => setShowApproveModal(false)}>Cancelar</button>
                <button
                  className={styles.confirmButton}
                  onClick={() => handleRespond("aprobado")}
                  disabled={actionLoading}
                >
                  {actionLoading ? "Aprobando..." : "Aprobar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {showRejectModal && (
          <div className={styles.modalOverlay} onClick={() => setShowRejectModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Rechazar Asignacion</h3>
              <p className={styles.modalText}>Indica el motivo del rechazo.</p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={styles.formTextarea}
                placeholder="Motivo del rechazo..."
                rows={3}
              />
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => { setShowRejectModal(false); setMotivo(""); }}>Cancelar</button>
                <button
                  className={styles.dangerButton}
                  onClick={() => handleRespond("rechazado")}
                  disabled={actionLoading || !motivo.trim()}
                >
                  {actionLoading ? "Rechazando..." : "Rechazar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Pre-Confirm Modal */}
        {showPreConfirmModal && (
          <div className={styles.modalOverlay} onClick={() => setShowPreConfirmModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Pre-Confirmar Completación</h3>
              <p className={styles.modalText}>
                Al pre-confirmar, las horas restantes se consumiran automaticamente y el cliente debera confirmar la completación.
                Horas restantes: {Math.max(0, Number(asignacion.horas_asignadas) - Number(asignacion.horas_consumidas)).toFixed(1)}h
              </p>
              <textarea
                value={preConfirmNote}
                onChange={(e) => setPreConfirmNote(e.target.value)}
                className={styles.formTextarea}
                placeholder="Nota de completación (opcional)..."
                rows={3}
              />
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => { setShowPreConfirmModal(false); setPreConfirmNote(""); }}>Cancelar</button>
                <button
                  className={styles.confirmButton}
                  onClick={handlePreConfirm}
                  disabled={preConfirming}
                >
                  {preConfirming ? "Pre-Confirmando..." : "Pre-Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
