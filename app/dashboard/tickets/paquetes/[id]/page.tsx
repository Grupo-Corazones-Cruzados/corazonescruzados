"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useSolicitudDetail, useConfirmCompletion, useAddAsignacion, PaqueteAsignacion } from "@/lib/hooks/usePaqueteSolicitudes";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/PaqueteSolicitudes.module.css";

interface Miembro {
  id: number;
  nombre: string;
  puesto: string | null;
  foto: string | null;
}

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

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" y2="12" />
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
  const { isAuthenticated } = useAuth();
  const solicitudId = params.id ? parseInt(params.id as string) : null;
  const { solicitud, asignaciones, loading, error, refetch } = useSolicitudDetail(solicitudId);
  const { confirmCompletion, loading: confirming } = useConfirmCompletion();
  const { addAsignacion, loading: addingAsignacion } = useAddAsignacion();

  const [confirmModal, setConfirmModal] = useState<PaqueteAsignacion | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loadingMiembros, setLoadingMiembros] = useState(false);

  // Add member form state
  const [selectedMiembroId, setSelectedMiembroId] = useState<number | null>(null);
  const [newHoras, setNewHoras] = useState<number>(1);
  const [newTarea, setNewTarea] = useState("");
  const [newDias, setNewDias] = useState<number[]>([]);

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

  const fetchMiembros = async () => {
    setLoadingMiembros(true);
    try {
      const res = await fetch("/api/miembros-public");
      const data = await res.json();
      if (res.ok && data.members) {
        setMiembros(data.members);
      }
    } catch (err) {
      console.error("Error loading members:", err);
    } finally {
      setLoadingMiembros(false);
    }
  };

  const handleOpenAddModal = () => {
    fetchMiembros();
    setSelectedMiembroId(null);
    setNewHoras(1);
    setNewTarea("");
    setNewDias([]);
    setShowAddModal(true);
  };

  const handleAddMember = async () => {
    if (!solicitudId || !selectedMiembroId) return;
    const result = await addAsignacion(solicitudId, {
      id_miembro: selectedMiembroId,
      horas_asignadas: newHoras,
      descripcion_tarea: newTarea || undefined,
      dias_semana: newDias.length > 0 ? newDias : undefined,
    });
    if (result.error) {
      alert(result.error);
    } else {
      setShowAddModal(false);
      refetch();
    }
  };

  const toggleDay = (day: number) => {
    setNewDias((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
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
  const totalAsignadas = asignaciones
    .filter((a) => a.estado !== "rechazado")
    .reduce((sum, a) => sum + Number(a.horas_asignadas || 0), 0);
  const horasDisponibles = Math.max(0, Number(solicitud.horas_totales) - totalAsignadas);
  const progress = Number(solicitud.horas_totales) > 0
    ? (totalConsumidas / Number(solicitud.horas_totales)) * 100
    : 0;
  const costoBase = Number(solicitud.horas_totales) * Number(solicitud.costo_hora);
  const costoFinal = costoBase * (1 - Number(solicitud.descuento) / 100);
  const canAddMember = horasDisponibles > 0 && !["completado", "cancelado"].includes(solicitud.estado);

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
          {canAddMember && (
            <button className={styles.primaryButton} onClick={handleOpenAddModal}>
              <PlusIcon /> Agregar Miembro
            </button>
          )}
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
                            <CheckIcon /> Confirmar Completación
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
                <span className={styles.detailLabel}>Horas asignadas</span>
                <span className={styles.detailValue}>{totalAsignadas}h</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Horas consumidas</span>
                <span className={styles.detailValue}>{totalConsumidas.toFixed(1)}h</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Horas disponibles</span>
                <span className={styles.detailValue} style={{ color: horasDisponibles > 0 ? "var(--turquoise)" : "var(--text-muted)" }}>
                  {horasDisponibles}h
                </span>
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
              <h3 className={styles.modalTitle}>Confirmar Completación</h3>
              <p className={styles.modalText}>
                Confirmas que {confirmModal.miembro?.nombre} ha completado satisfactoriamente su trabajo de {Number(confirmModal.horas_asignadas)}h?
                Esta acción no se puede deshacer.
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

        {/* Add Member Modal */}
        {showAddModal && (
          <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Agregar Miembro</h3>
              <p className={styles.modalText}>
                Horas disponibles: {horasDisponibles}h
              </p>

              {loadingMiembros ? (
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Cargando miembros...</p>
              ) : (
                <>
                  <div style={{ marginBottom: "var(--space-3)" }}>
                    <label className={styles.formLabel} style={{ display: "block", marginBottom: "var(--space-2)" }}>Miembro</label>
                    <select
                      className={styles.formInput}
                      value={selectedMiembroId || ""}
                      onChange={(e) => setSelectedMiembroId(e.target.value ? parseInt(e.target.value) : null)}
                      style={{ width: "100%", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.9rem" }}
                    >
                      <option value="">Seleccionar miembro...</option>
                      {miembros
                        .filter((m) => !asignaciones.some((a) => a.miembro?.id === m.id && a.estado !== "rechazado"))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nombre}{m.puesto ? ` - ${m.puesto}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: "var(--space-3)" }}>
                    <label className={styles.formLabel} style={{ display: "block", marginBottom: "var(--space-2)" }}>Horas</label>
                    <input
                      type="number"
                      min={1}
                      max={horasDisponibles}
                      value={newHoras}
                      onChange={(e) => setNewHoras(Math.min(parseInt(e.target.value) || 1, horasDisponibles))}
                      style={{ width: "100%", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: "0.9rem" }}
                    />
                  </div>

                  <div style={{ marginBottom: "var(--space-3)" }}>
                    <label className={styles.formLabel} style={{ display: "block", marginBottom: "var(--space-2)" }}>Tarea (opcional)</label>
                    <textarea
                      value={newTarea}
                      onChange={(e) => setNewTarea(e.target.value)}
                      className={styles.formTextarea}
                      placeholder="Describe la tarea..."
                      rows={3}
                    />
                  </div>

                  <div style={{ marginBottom: "var(--space-3)" }}>
                    <label className={styles.formLabel} style={{ display: "block", marginBottom: "var(--space-2)" }}>Dias de trabajo (opcional)</label>
                    <div className={styles.daysBadges}>
                      {DAYS.map((day, i) => (
                        <span
                          key={i}
                          className={`${styles.dayBadge} ${newDias.includes(i) ? styles.dayBadgeSelected : ""}`}
                          onClick={() => toggleDay(i)}
                          style={{ cursor: "pointer" }}
                        >
                          {day}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.modalActions}>
                <button className={styles.cancelButton} onClick={() => setShowAddModal(false)}>Cancelar</button>
                <button
                  className={styles.confirmButton}
                  onClick={handleAddMember}
                  disabled={addingAsignacion || !selectedMiembroId || newHoras <= 0}
                >
                  {addingAsignacion ? "Agregando..." : "Agregar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
