"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useSolicitudDetail, useConfirmCompletion, PaqueteAsignacion } from "@/lib/hooks/usePaqueteSolicitudes";
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
    borrador: styles.statusBorrador,
    pendiente: styles.statusPendiente,
    parcial: styles.statusParcial,
    aprobado: styles.statusAprobado,
    en_progreso: styles.statusEnProgreso,
    pre_confirmado: styles.statusPreConfirmado,
    completado: styles.statusCompletado,
    rechazado: styles.statusRechazado,
    cancelado: styles.statusCancelado,
  };
  return map[estado] || styles.statusPendiente;
};

const getStatusLabel = (estado: string): string => {
  const map: Record<string, string> = {
    borrador: "Borrador",
    pendiente: "Pendiente",
    parcial: "Parcial",
    aprobado: "Aprobado",
    en_progreso: "En Progreso",
    pre_confirmado: "Pre-Confirmado",
    completado: "Completado",
    rechazado: "Rechazado",
    cancelado: "Cancelado",
  };
  return map[estado] || estado;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

export default function SolicitudDetailPage() {
  const params = useParams();
  const router = useRouter();
  const solicitudId = params.id ? parseInt(params.id as string) : null;
  const { solicitud, asignaciones, loading, error, refetch } = useSolicitudDetail(solicitudId);
  const { confirmCompletion, loading: confirming } = useConfirmCompletion();

  const [confirmModal, setConfirmModal] = useState<PaqueteAsignacion | null>(null);

  const handleConfirm = async (asignacion: PaqueteAsignacion) => {
    if (!solicitudId) return;
    const result = await confirmCompletion(solicitudId, asignacion.id);
    if (result.error) {
      alert(result.error);
    } else {
      setConfirmModal(null);
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

  if (error || !solicitud) {
    return (
      <DashboardLayout>
        <div className={styles.emptyState}>
          <p style={{ color: "var(--primary-red)" }}>{error || "Solicitud no encontrada"}</p>
          <Link href="/dashboard/tickets/paquetes" className={styles.secondaryButton}>Volver</Link>
        </div>
      </DashboardLayout>
    );
  }

  const totalConsumidas = asignaciones.reduce((sum, a) => sum + Number(a.horas_consumidas || 0), 0);
  const progress = Number(solicitud.horas_totales) > 0
    ? (totalConsumidas / Number(solicitud.horas_totales)) * 100
    : 0;
  const costoBase = Number(solicitud.horas_totales) * Number(solicitud.costo_hora);
  const costoFinal = costoBase * (1 - Number(solicitud.descuento) / 100);

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <Link href="/dashboard/tickets/paquetes" className={styles.backButton}>
          <ArrowLeftIcon /> Volver a paquetes
        </Link>

        <div className={styles.pageHeader}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
              <h1 className={styles.pageTitle}>Paquete #{solicitud.id}</h1>
              <span className={`${styles.statusBadge} ${getStatusClass(solicitud.estado)}`}>
                {getStatusLabel(solicitud.estado)}
              </span>
            </div>
            <p className={styles.pageSubtitle}>
              {Number(solicitud.horas_totales)}h - {solicitud.tier_nombre || "Paquete"} - Creado {formatDate(solicitud.created_at)}
            </p>
          </div>
        </div>

        <div className={styles.detailLayout}>
          {/* Main content */}
          <div className={styles.detailMain}>
            {/* Solicitud Info */}
            {solicitud.notas_cliente && (
              <div className={styles.detailCard}>
                <h3 className={styles.detailCardTitle}>Notas</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>{solicitud.notas_cliente}</p>
              </div>
            )}

            {/* Asignaciones */}
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Asignaciones ({asignaciones.length})</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                {asignaciones.map((asig) => {
                  const asigProgress = Number(asig.horas_asignadas) > 0
                    ? (Number(asig.horas_consumidas) / Number(asig.horas_asignadas)) * 100
                    : 0;
                  return (
                    <div
                      key={asig.id}
                      className={styles.allocationCard}
                      onClick={() => router.push(`/dashboard/tickets/paquetes/${solicitud.id}/asignacion/${asig.id}`)}
                    >
                      <div className={styles.allocationHeader}>
                        <div className={styles.allocationMember}>
                          {asig.miembro?.foto ? (
                            <img src={asig.miembro.foto} alt={asig.miembro.nombre} className={styles.allocationMemberAvatar} />
                          ) : (
                            <div className={styles.allocationMemberAvatarPlaceholder}>
                              {asig.miembro?.nombre?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div className={styles.allocationMemberInfo}>
                            <div className={styles.allocationMemberName}>{asig.miembro?.nombre}</div>
                            <div className={styles.allocationMemberRole}>{asig.miembro?.puesto || "Miembro"}</div>
                          </div>
                        </div>
                        <span className={`${styles.statusBadge} ${getStatusClass(asig.estado)}`}>
                          {getStatusLabel(asig.estado)}
                        </span>
                      </div>

                      {asig.descripcion_tarea && (
                        <div className={styles.allocationBody}>
                          <p className={styles.allocationTask}>{asig.descripcion_tarea}</p>
                        </div>
                      )}

                      {asig.dias_semana && (asig.dias_semana as number[]).length > 0 && (
                        <div className={styles.daysBadges} style={{ marginBottom: "var(--space-3)" }}>
                          {(asig.dias_semana as number[]).map((d) => (
                            <span key={d} className={`${styles.dayBadge} ${styles.dayBadgeSelected}`} style={{ cursor: "default" }}>
                              {DAYS[d]}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill} style={{ width: `${Math.min(asigProgress, 100)}%` }} />
                        </div>
                        <span className={styles.progressText}>
                          {Number(asig.horas_consumidas).toFixed(1)} / {Number(asig.horas_asignadas)}h
                        </span>
                      </div>

                      <div className={styles.allocationFooter}>
                        <span className={styles.allocationAvances}>{asig.avances_count || 0} avances</span>
                        {asig.estado === "pre_confirmado" && (
                          <button
                            className={styles.confirmButton}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmModal(asig);
                            }}
                          >
                            <CheckIcon /> Confirmar Completacion
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.detailSidebar}>
            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Resumen</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Horas totales</span>
                <span className={styles.detailValue}>{Number(solicitud.horas_totales)}h</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Horas consumidas</span>
                <span className={styles.detailValue}>{totalConsumidas.toFixed(1)}h</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Progreso</span>
                <span className={styles.detailValue}>{Math.round(progress)}%</span>
              </div>

              <div style={{ margin: "var(--space-3) 0" }}>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
              </div>

              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Costo/hora</span>
                <span className={styles.detailValue}>{formatCurrency(Number(solicitud.costo_hora))}</span>
              </div>
              {Number(solicitud.descuento) > 0 && (
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Descuento</span>
                  <span className={styles.discountBadge}>{solicitud.descuento}%</span>
                </div>
              )}
              <div className={styles.detailRow} style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-3)", marginTop: "var(--space-2)" }}>
                <span className={styles.detailLabel}>Total</span>
                <span className={styles.detailValue} style={{ color: "var(--turquoise)", fontSize: "1.1rem" }}>
                  {formatCurrency(costoFinal)}
                </span>
              </div>
            </div>

            <div className={styles.detailCard}>
              <h3 className={styles.detailCardTitle}>Estadisticas</h3>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Miembros</span>
                <span className={styles.detailValue}>{asignaciones.length}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Aprobados</span>
                <span className={styles.detailValue}>
                  {asignaciones.filter((a) => !["pendiente", "rechazado"].includes(a.estado)).length}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Completados</span>
                <span className={styles.detailValue}>
                  {asignaciones.filter((a) => a.estado === "completado").length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirm Modal */}
        {confirmModal && (
          <div className={styles.modalOverlay} onClick={() => setConfirmModal(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Confirmar Completacion</h3>
              <p className={styles.modalText}>
                Confirmas que {confirmModal.miembro?.nombre} ha completado satisfactoriamente su trabajo de {Number(confirmModal.horas_asignadas)}h?
                Esta accion no se puede deshacer.
              </p>
              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => setConfirmModal(null)}>Cancelar</button>
                <button
                  className={styles.confirmButton}
                  onClick={() => handleConfirm(confirmModal)}
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
