"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import {
  usePackageDetail,
  usePackageSessions,
  useAvailableSlots,
  PackageSession,
} from "@/lib/hooks/usePackages";
import styles from "@/app/styles/Packages.module.css";

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "pendiente": return styles.statusPendiente;
    case "aprobado": return styles.statusAprobado;
    case "en_espera": return styles.statusEnEspera;
    case "en_progreso": return styles.statusEnProgreso;
    case "completado": return styles.statusCompletado;
    case "rechazado": return styles.statusRechazado;
    case "cancelado": return styles.statusCancelado;
    default: return styles.statusPendiente;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "pendiente": return "Pendiente";
    case "aprobado": return "Aprobado";
    case "en_espera": return "En Espera";
    case "en_progreso": return "En Progreso";
    case "completado": return "Completado";
    case "rechazado": return "Rechazado";
    case "cancelado": return "Cancelado";
    case "programada": return "Programada";
    case "completada": return "Completada";
    case "no_asistio": return "No Asistio";
    default: return estado;
  }
};

const getSessionStatusClass = (estado: string): string => {
  switch (estado) {
    case "programada": return styles.sessionProgramada;
    case "completada": return styles.sessionCompletada;
    case "cancelada": return styles.sessionCancelada;
    case "no_asistio": return styles.sessionNoAsistio;
    default: return styles.sessionProgramada;
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const formatShortDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
};

const DAYS_OF_WEEK = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

export default function PackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params.id ? parseInt(params.id as string) : null;

  const { purchase, sessions, availability, loading, error, refetch } = usePackageDetail(purchaseId, "client");
  const { scheduleSession, updateSession, loading: sessionLoading } = usePackageSessions(purchaseId);
  const { slots, horasDisponibles, fetchSlots, loading: slotsLoading } = useAvailableSlots(purchaseId);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedStartTime, setSelectedStartTime] = useState("");
  const [selectedEndTime, setSelectedEndTime] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  const progress = purchase
    ? (Number(purchase.horas_consumidas) / Number(purchase.horas_totales)) * 100
    : 0;

  const canSchedule = purchase && (purchase.estado === "aprobado" || purchase.estado === "en_progreso");

  const handleScheduleSession = async () => {
    if (!selectedDate || !selectedStartTime || !selectedEndTime) {
      alert("Por favor selecciona fecha y horario");
      return;
    }

    const result = await scheduleSession({
      fecha: selectedDate,
      hora_inicio: selectedStartTime,
      hora_fin: selectedEndTime,
      notas: sessionNotes || undefined,
    });

    if (result.error) {
      alert(result.error);
    } else {
      setShowScheduleModal(false);
      setSelectedDate("");
      setSelectedStartTime("");
      setSelectedEndTime("");
      setSessionNotes("");
      refetch();
    }
  };

  const handleAcceptChange = async (sessionId: number) => {
    const result = await updateSession(sessionId, "accept_change");
    if (result.error) {
      alert(result.error);
    } else {
      refetch();
    }
  };

  const handleRejectChange = async (sessionId: number) => {
    const result = await updateSession(sessionId, "reject_change");
    if (result.error) {
      alert(result.error);
    } else {
      refetch();
    }
  };

  const handleCancelSession = async (sessionId: number) => {
    if (!confirm("¿Estas seguro de cancelar esta sesion?")) return;

    const result = await updateSession(sessionId, "cancel");
    if (result.error) {
      alert(result.error);
    } else {
      refetch();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando paquete...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !purchase) {
    return (
      <DashboardLayout>
        <div className={styles.emptyState}>
          <p style={{ color: "var(--primary-red)" }}>{error || "Paquete no encontrado"}</p>
          <Link href="/dashboard/mis-paquetes" className={styles.secondaryButton}>
            Volver a mis paquetes
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.detailPage}>
        <Link href="/dashboard/mis-paquetes" className={styles.backButton}>
          <ArrowLeftIcon />
          Volver a mis paquetes
        </Link>

        <div className={styles.detailGrid}>
          {/* Main content */}
          <div className={styles.detailMain}>
            {/* Package Info Card */}
            <div className={styles.detailCard}>
              <div className={styles.detailHeader}>
                <div>
                  <h1 className={styles.detailTitle}>{purchase.paquete.nombre}</h1>
                  <p className={styles.packageId}>Paquete #{purchase.id}</p>
                </div>
                <span className={`${styles.packageStatus} ${getStatusClass(purchase.estado)}`}>
                  {getStatusLabel(purchase.estado)}
                </span>
              </div>

              {purchase.paquete.descripcion && (
                <p className={styles.detailDescription}>{purchase.paquete.descripcion}</p>
              )}

              {/* Progress */}
              <div className={styles.progressSection}>
                <div className={styles.progressHeader}>
                  <span>Horas utilizadas</span>
                  <span className={styles.progressValue}>
                    {Number(purchase.horas_consumidas).toFixed(1)} / {purchase.horas_totales}h
                  </span>
                </div>
                <div className={styles.progressBarLarge}>
                  <div className={styles.progressFillLarge} style={{ width: `${Math.min(progress, 100)}%` }} />
                </div>
                <div className={styles.progressFooter}>
                  <span>{Number(purchase.horas_restantes).toFixed(1)}h restantes</span>
                </div>
              </div>

              {/* Member Info */}
              {purchase.miembro && (
                <div className={styles.memberSection}>
                  <h3 className={styles.sectionTitle}>Miembro asignado</h3>
                  <div className={styles.memberCard}>
                    {purchase.miembro.foto ? (
                      <img src={purchase.miembro.foto} alt={purchase.miembro.nombre} className={styles.memberAvatar} />
                    ) : (
                      <div className={styles.memberAvatarPlaceholder}>
                        {purchase.miembro.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{purchase.miembro.nombre}</div>
                      <div className={styles.memberRole}>{purchase.miembro.puesto || "Miembro"}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reason if rejected or on hold */}
              {purchase.estado === "rechazado" && purchase.motivo_rechazo && (
                <div className={styles.reasonBox}>
                  <h4>Motivo de rechazo:</h4>
                  <p>{purchase.motivo_rechazo}</p>
                </div>
              )}
              {purchase.estado === "en_espera" && purchase.motivo_espera && (
                <div className={styles.reasonBox}>
                  <h4>Motivo de espera:</h4>
                  <p>{purchase.motivo_espera}</p>
                </div>
              )}

              {/* Client notes */}
              {purchase.notas_cliente && (
                <div className={styles.notesSection}>
                  <h4>Tus notas:</h4>
                  <p>{purchase.notas_cliente}</p>
                </div>
              )}
            </div>

            {/* Availability Section */}
            {canSchedule && availability.length > 0 && (
              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Disponibilidad del miembro</h3>
                <div className={styles.availabilityGrid}>
                  {availability.map((slot) => (
                    <div key={slot.id} className={styles.availabilitySlot}>
                      <span className={styles.availabilityDay}>{DAYS_OF_WEEK[slot.dia_semana]}</span>
                      <span className={styles.availabilityTime}>
                        {slot.hora_inicio.slice(0, 5)} - {slot.hora_fin.slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions List */}
            <div className={styles.detailCard}>
              <div className={styles.sessionHeader}>
                <h3 className={styles.sectionTitle}>Sesiones</h3>
                {canSchedule && (
                  <button className={styles.scheduleButton} onClick={() => setShowScheduleModal(true)}>
                    <CalendarIcon />
                    Agendar Sesion
                  </button>
                )}
              </div>

              {sessions.length === 0 ? (
                <p className={styles.noSessions}>No hay sesiones programadas</p>
              ) : (
                <div className={styles.sessionsList}>
                  {sessions.map((session) => (
                    <div key={session.id} className={styles.sessionCard}>
                      <div className={styles.sessionMain}>
                        <div className={styles.sessionDate}>
                          <CalendarIcon />
                          {formatDate(session.fecha)}
                        </div>
                        <div className={styles.sessionTime}>
                          <ClockIcon />
                          {session.hora_inicio.slice(0, 5)} - {session.hora_fin.slice(0, 5)}
                          <span className={styles.sessionDuration}>({session.duracion_horas}h)</span>
                        </div>
                      </div>
                      <div className={styles.sessionActions}>
                        <span className={`${styles.sessionStatus} ${getSessionStatusClass(session.estado)}`}>
                          {getStatusLabel(session.estado)}
                        </span>

                        {/* Date change request */}
                        {session.cambio_solicitado && session.estado === "programada" && (
                          <div className={styles.changeRequest}>
                            <p className={styles.changeRequestText}>
                              El miembro solicita cambiar a: {formatShortDate(session.nueva_fecha_propuesta!)} {session.nueva_hora_propuesta?.slice(0, 5)}
                            </p>
                            <p className={styles.changeRequestReason}>Motivo: {session.motivo_cambio}</p>
                            <div className={styles.changeRequestButtons}>
                              <button
                                className={styles.acceptButton}
                                onClick={() => handleAcceptChange(session.id)}
                                disabled={sessionLoading}
                              >
                                <CheckIcon /> Aceptar
                              </button>
                              <button
                                className={styles.rejectButton}
                                onClick={() => handleRejectChange(session.id)}
                                disabled={sessionLoading}
                              >
                                Rechazar
                              </button>
                            </div>
                          </div>
                        )}

                        {session.estado === "programada" && !session.cambio_solicitado && (
                          <button
                            className={styles.cancelSessionButton}
                            onClick={() => handleCancelSession(session.id)}
                            disabled={sessionLoading}
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.detailSidebar}>
            {/* Quick Stats */}
            <div className={styles.sidebarCard}>
              <h3 className={styles.sidebarTitle}>Resumen</h3>
              <div className={styles.sidebarStats}>
                <div className={styles.sidebarStat}>
                  <span className={styles.sidebarStatLabel}>Horas contratadas</span>
                  <span className={styles.sidebarStatValue}>{purchase.horas_totales}h</span>
                </div>
                <div className={styles.sidebarStat}>
                  <span className={styles.sidebarStatLabel}>Horas utilizadas</span>
                  <span className={styles.sidebarStatValue}>{Number(purchase.horas_consumidas).toFixed(1)}h</span>
                </div>
                <div className={styles.sidebarStat}>
                  <span className={styles.sidebarStatLabel}>Horas restantes</span>
                  <span className={styles.sidebarStatValueHighlight}>{Number(purchase.horas_restantes).toFixed(1)}h</span>
                </div>
                <div className={styles.sidebarStat}>
                  <span className={styles.sidebarStatLabel}>Sesiones</span>
                  <span className={styles.sidebarStatValue}>{sessions.length}</span>
                </div>
              </div>
            </div>

            {/* Completion Report */}
            {purchase.estado === "completado" && purchase.reporte_cierre && (
              <div className={styles.sidebarCard}>
                <h3 className={styles.sidebarTitle}>Reporte de cierre</h3>
                <p className={styles.reportText}>{purchase.reporte_cierre}</p>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className={styles.modalOverlay} onClick={() => setShowScheduleModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Agendar Sesion</h2>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fecha</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={styles.formInput}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {selectedDate && (
                <>
                  {slotsLoading ? (
                    <p className={styles.loadingText}>Cargando horarios...</p>
                  ) : slots.length === 0 ? (
                    <p className={styles.noSlotsText}>No hay disponibilidad para este dia</p>
                  ) : (
                    <>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Hora de inicio</label>
                        <select
                          value={selectedStartTime}
                          onChange={(e) => {
                            setSelectedStartTime(e.target.value);
                            setSelectedEndTime("");
                          }}
                          className={styles.formSelect}
                        >
                          <option value="">Selecciona hora de inicio</option>
                          {slots
                            .filter((s) => s.disponible)
                            .map((slot) => (
                              <option key={slot.hora_inicio} value={slot.hora_inicio}>
                                {slot.hora_inicio}
                              </option>
                            ))}
                        </select>
                      </div>

                      {selectedStartTime && (
                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Hora de fin</label>
                          <select
                            value={selectedEndTime}
                            onChange={(e) => setSelectedEndTime(e.target.value)}
                            className={styles.formSelect}
                          >
                            <option value="">Selecciona hora de fin</option>
                            {slots
                              .filter((s) => s.disponible && s.hora_inicio >= selectedStartTime)
                              .map((slot) => (
                                <option key={slot.hora_fin} value={slot.hora_fin}>
                                  {slot.hora_fin}
                                </option>
                              ))}
                          </select>
                        </div>
                      )}

                      <p className={styles.availableHoursText}>
                        Horas disponibles: {horasDisponibles.toFixed(1)}h
                      </p>
                    </>
                  )}
                </>
              )}

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Notas (opcional)</label>
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  className={styles.formTextarea}
                  placeholder="Agrega informacion relevante para esta sesion..."
                  rows={3}
                />
              </div>

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => setShowScheduleModal(false)}>
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleScheduleSession}
                  disabled={sessionLoading || !selectedDate || !selectedStartTime || !selectedEndTime}
                >
                  {sessionLoading ? "Agendando..." : "Agendar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
