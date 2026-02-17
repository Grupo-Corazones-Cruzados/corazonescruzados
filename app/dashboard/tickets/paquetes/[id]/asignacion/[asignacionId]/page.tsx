"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useConfirmCompletion, PaqueteAsignacion, PaqueteAvance } from "@/lib/hooks/usePaqueteSolicitudes";
import { useAuth } from "@/lib/AuthProvider";
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

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
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

export default function AsignacionDetailClientPage() {
  const params = useParams();
  const { isAuthenticated } = useAuth();
  const solicitudId = params.id ? parseInt(params.id as string) : null;
  const asignacionId = params.asignacionId ? parseInt(params.asignacionId as string) : null;

  const { confirmCompletion, loading: confirming } = useConfirmCompletion();

  const [asignacion, setAsignacion] = useState<PaqueteAsignacion | null>(null);
  const [avances, setAvances] = useState<PaqueteAvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !asignacionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/client/paquete-solicitudes/${solicitudId}/asignaciones/${asignacionId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAsignacion(data.asignacion);
      setAvances(data.avances || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, solicitudId, asignacionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddComment = async () => {
    if (!comentario.trim() || !asignacionId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/client/paquete-solicitudes/${solicitudId}/asignaciones/${asignacionId}/avances`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: comentario }),
      });
      if (res.ok) {
        setComentario("");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async () => {
    if (!solicitudId || !asignacionId) return;
    const result = await confirmCompletion(solicitudId, asignacionId);
    if (result.error) {
      alert(result.error);
    } else {
      setConfirmModal(false);
      fetchData();
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
          <Link href={`/dashboard/tickets/paquetes/${solicitudId}`} className={styles.secondaryButton}>Volver</Link>
        </div>
      </DashboardLayout>
    );
  }

  const progress = Number(asignacion.horas_asignadas) > 0
    ? (Number(asignacion.horas_consumidas) / Number(asignacion.horas_asignadas)) * 100
    : 0;

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <Link href={`/dashboard/tickets/paquetes/${solicitudId}`} className={styles.backButton}>
          <ArrowLeftIcon /> Volver al paquete
        </Link>

        <div className={styles.pageHeader}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
              <h1 className={styles.pageTitle}>Asignacion #{asignacion.id}</h1>
              <span className={`${styles.statusBadge} ${getStatusClass(asignacion.estado)}`}>
                {getStatusLabel(asignacion.estado)}
              </span>
            </div>
            <p className={styles.pageSubtitle}>{asignacion.miembro?.nombre} - {Number(asignacion.horas_asignadas)}h</p>
          </div>
          {asignacion.estado === "pre_confirmado" && (
            <button className={styles.confirmButton} onClick={() => setConfirmModal(true)}>
              <CheckIcon /> Confirmar Completación
            </button>
          )}
        </div>

        <div className={styles.detailLayout}>
          {/* Main */}
          <div className={styles.detailMain}>
            {/* Task info */}
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

            {/* Comment form */}
            {!["completado", "rechazado"].includes(asignacion.estado) && (
              <div className={styles.avanceForm}>
                <h3 className={styles.avanceFormTitle}>Agregar Comentario</h3>
                <textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  className={styles.formTextarea}
                  placeholder="Escribe un comentario..."
                  rows={3}
                />
                <div className={styles.avanceFormRow}>
                  <button
                    className={styles.primaryButton}
                    onClick={handleAddComment}
                    disabled={submitting || !comentario.trim()}
                  >
                    {submitting ? "Enviando..." : "Enviar Comentario"}
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

            {asignacion.miembro && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Miembro</h3>
                <div className={styles.sidebarMember}>
                  {asignacion.miembro.foto ? (
                    <img src={asignacion.miembro.foto} alt={asignacion.miembro.nombre} className={styles.sidebarMemberAvatar} />
                  ) : (
                    <div className={styles.sidebarMemberAvatarPlaceholder}>
                      {asignacion.miembro.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.sidebarMemberInfo}>
                    <div className={styles.sidebarMemberName}>{asignacion.miembro.nombre}</div>
                    <div className={styles.sidebarMemberRole}>{asignacion.miembro.puesto || "Miembro"}</div>
                  </div>
                </div>
              </div>
            )}

            {asignacion.solicitud && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Paquete</h3>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Costo/hora</span>
                  <span className={styles.detailValue}>{formatCurrency(Number(asignacion.solicitud.costo_hora || 10))}</span>
                </div>
                {Number(asignacion.solicitud.descuento || 0) > 0 && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Descuento</span>
                    <span className={styles.discountBadge}>{asignacion.solicitud.descuento}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Confirm Modal */}
        {confirmModal && (
          <div className={styles.modalOverlay} onClick={() => setConfirmModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Confirmar Completación</h3>
              <p className={styles.modalText}>
                Confirmas que {asignacion.miembro?.nombre} ha completado satisfactoriamente su trabajo?
                Esta accion no se puede deshacer.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => setConfirmModal(false)}>Cancelar</button>
                <button
                  className={styles.confirmButton}
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? "Confirmando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
