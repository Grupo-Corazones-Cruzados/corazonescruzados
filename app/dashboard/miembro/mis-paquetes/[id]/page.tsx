"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import {
  usePackageDetail,
  usePackageSessions,
  usePackageAvailability,
  useClosePackage,
  useMemberPackages,
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

const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
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

const DAYS_OF_WEEK = ["Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"];

export default function MemberPackageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params.id ? parseInt(params.id as string) : null;

  const { purchase, sessions, loading, error, refetch } = usePackageDetail(purchaseId, "member");
  const { respondToPackage } = useMemberPackages();
  const { updateSession, loading: sessionLoading } = usePackageSessions(purchaseId);
  const { availability, setAvailabilitySlots, deleteSlot, loading: availabilityLoading } = usePackageAvailability(purchaseId);
  const { closePackage, loading: closeLoading } = useClosePackage();

  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showRespondModal, setShowRespondModal] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<number | null>(null);

  // Availability form
  const [newSlots, setNewSlots] = useState<{ dia_semana: number; hora_inicio: string; hora_fin: string }[]>([]);
  const [selectedDay, setSelectedDay] = useState(1);
  const [slotStart, setSlotStart] = useState("09:00");
  const [slotEnd, setSlotEnd] = useState("17:00");

  // Response form
  const [responseAction, setResponseAction] = useState<"aprobado" | "rechazado" | "en_espera">("aprobado");
  const [responseMotivo, setResponseMotivo] = useState("");

  // Change request form
  const [changeMotivo, setChangeMotivo] = useState("");
  const [changeFecha, setChangeFecha] = useState("");
  const [changeHora, setChangeHora] = useState("");

  // Close report
  const [closeReport, setCloseReport] = useState("");

  // Session notes
  const [sessionNotes, setSessionNotes] = useState("");

  const progress = purchase
    ? (Number(purchase.horas_consumidas) / Number(purchase.horas_totales)) * 100
    : 0;

  const canManage = purchase && (purchase.estado === "aprobado" || purchase.estado === "en_progreso");
  const isPending = purchase?.estado === "pendiente" || purchase?.estado === "en_espera";

  const handleAddSlot = () => {
    setNewSlots([...newSlots, { dia_semana: selectedDay, hora_inicio: slotStart, hora_fin: slotEnd }]);
  };

  const handleRemoveNewSlot = (index: number) => {
    setNewSlots(newSlots.filter((_, i) => i !== index));
  };

  const handleSaveAvailability = async () => {
    if (newSlots.length === 0 && availability.length === 0) {
      alert("Agrega al menos un horario");
      return;
    }

    const allSlots = [...availability.map(a => ({
      dia_semana: a.dia_semana,
      hora_inicio: a.hora_inicio,
      hora_fin: a.hora_fin,
    })), ...newSlots];

    const result = await setAvailabilitySlots(allSlots);
    if (result.error) {
      alert(result.error);
    } else {
      setShowAvailabilityModal(false);
      setNewSlots([]);
      refetch();
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!confirm("¿Eliminar este horario?")) return;
    const result = await deleteSlot(slotId);
    if (result.error) {
      alert(result.error);
    }
  };

  const handleRespond = async () => {
    if (!purchaseId) return;

    const result = await respondToPackage(purchaseId, responseAction, responseMotivo || undefined);
    if (result.error) {
      alert(result.error);
    } else {
      setShowRespondModal(false);
      setResponseMotivo("");
      refetch();
    }
  };

  const handleCompleteSession = async (sessionId: number) => {
    const result = await updateSession(sessionId, "complete", { notas: sessionNotes });
    if (result.error) {
      alert(result.error);
    } else {
      setSessionNotes("");
      refetch();
    }
  };

  const handleNoShow = async (sessionId: number) => {
    const result = await updateSession(sessionId, "no_show");
    if (result.error) {
      alert(result.error);
    } else {
      refetch();
    }
  };

  const handleRequestChange = async () => {
    if (!selectedSession || !changeMotivo || !changeFecha || !changeHora) {
      alert("Completa todos los campos");
      return;
    }

    const result = await updateSession(selectedSession, "request_change", {
      motivo_cambio: changeMotivo,
      nueva_fecha: changeFecha,
      nueva_hora: changeHora,
    });

    if (result.error) {
      alert(result.error);
    } else {
      setShowChangeModal(false);
      setSelectedSession(null);
      setChangeMotivo("");
      setChangeFecha("");
      setChangeHora("");
      refetch();
    }
  };

  const handleClosePackage = async () => {
    if (!purchaseId) return;

    const result = await closePackage(purchaseId, closeReport);
    if (result.error) {
      alert(result.error);
    } else {
      setShowCloseModal(false);
      router.push("/dashboard/miembro/mis-paquetes");
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
          <Link href="/dashboard/miembro/mis-paquetes" className={styles.secondaryButton}>
            Volver a mis paquetes
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.detailPage}>
        <Link href="/dashboard/miembro/mis-paquetes" className={styles.backButton}>
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
              </div>

              {/* Client Info */}
              {purchase.cliente && (
                <div className={styles.clientSection}>
                  <h3 className={styles.sectionTitle}>Cliente</h3>
                  <div className={styles.clientInfo}>
                    <div className={styles.clientName}>{purchase.cliente.nombre}</div>
                    <div className={styles.clientEmail}>{purchase.cliente.correo_electronico}</div>
                  </div>
                </div>
              )}

              {/* Client notes */}
              {purchase.notas_cliente && (
                <div className={styles.notesSection}>
                  <h4>Notas del cliente:</h4>
                  <p>{purchase.notas_cliente}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className={styles.actionButtons}>
                {isPending && (
                  <button className={styles.primaryButton} onClick={() => setShowRespondModal(true)}>
                    Responder Solicitud
                  </button>
                )}
                {canManage && (
                  <>
                    <button className={styles.secondaryButton} onClick={() => setShowAvailabilityModal(true)}>
                      Configurar Disponibilidad
                    </button>
                    <button className={styles.closeButton} onClick={() => setShowCloseModal(true)}>
                      Cerrar Paquete
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Availability Section */}
            {canManage && (
              <div className={styles.detailCard}>
                <h3 className={styles.sectionTitle}>Tu disponibilidad para este paquete</h3>
                {availability.length === 0 ? (
                  <p className={styles.noAvailability}>
                    No has configurado disponibilidad. El cliente no podra agendar sesiones.
                  </p>
                ) : (
                  <div className={styles.availabilityGrid}>
                    {availability.map((slot) => (
                      <div key={slot.id} className={styles.availabilitySlotEditable}>
                        <div>
                          <span className={styles.availabilityDay}>{DAYS_OF_WEEK[slot.dia_semana]}</span>
                          <span className={styles.availabilityTime}>
                            {slot.hora_inicio.slice(0, 5)} - {slot.hora_fin.slice(0, 5)}
                          </span>
                        </div>
                        <button
                          className={styles.deleteSlotButton}
                          onClick={() => handleDeleteSlot(slot.id)}
                          disabled={availabilityLoading}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className={styles.addSlotButton} onClick={() => setShowAvailabilityModal(true)}>
                  <PlusIcon /> Agregar horario
                </button>
              </div>
            )}

            {/* Sessions List */}
            <div className={styles.detailCard}>
              <h3 className={styles.sectionTitle}>Sesiones</h3>

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

                      <span className={`${styles.sessionStatus} ${getSessionStatusClass(session.estado)}`}>
                        {getStatusLabel(session.estado)}
                      </span>

                      {/* Session actions for member */}
                      {session.estado === "programada" && !session.cambio_solicitado && (
                        <div className={styles.sessionActions}>
                          <button
                            className={styles.completeButton}
                            onClick={() => handleCompleteSession(session.id)}
                            disabled={sessionLoading}
                          >
                            <CheckIcon /> Completar
                          </button>
                          <button
                            className={styles.changeButton}
                            onClick={() => {
                              setSelectedSession(session.id);
                              setShowChangeModal(true);
                            }}
                            disabled={sessionLoading}
                          >
                            Cambiar fecha
                          </button>
                          <button
                            className={styles.noShowButton}
                            onClick={() => handleNoShow(session.id)}
                            disabled={sessionLoading}
                          >
                            No asistio
                          </button>
                        </div>
                      )}

                      {session.cambio_solicitado && (
                        <div className={styles.pendingChange}>
                          Esperando respuesta del cliente sobre el cambio de fecha
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className={styles.detailSidebar}>
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
                  <span className={styles.sidebarStatLabel}>Sesiones totales</span>
                  <span className={styles.sidebarStatValue}>{sessions.length}</span>
                </div>
                <div className={styles.sidebarStat}>
                  <span className={styles.sidebarStatLabel}>Completadas</span>
                  <span className={styles.sidebarStatValue}>
                    {sessions.filter((s) => s.estado === "completada").length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Respond Modal */}
        {showRespondModal && (
          <div className={styles.modalOverlay} onClick={() => setShowRespondModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Responder a la solicitud</h2>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Accion</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="aprobado"
                      checked={responseAction === "aprobado"}
                      onChange={() => setResponseAction("aprobado")}
                    />
                    Aprobar
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="rechazado"
                      checked={responseAction === "rechazado"}
                      onChange={() => setResponseAction("rechazado")}
                    />
                    Rechazar
                  </label>
                  <label className={styles.radioLabel}>
                    <input
                      type="radio"
                      value="en_espera"
                      checked={responseAction === "en_espera"}
                      onChange={() => setResponseAction("en_espera")}
                    />
                    En Espera
                  </label>
                </div>
              </div>

              {(responseAction === "rechazado" || responseAction === "en_espera") && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {responseAction === "rechazado" ? "Motivo del rechazo" : "Motivo de espera"}
                  </label>
                  <textarea
                    value={responseMotivo}
                    onChange={(e) => setResponseMotivo(e.target.value)}
                    className={styles.formTextarea}
                    rows={3}
                  />
                </div>
              )}

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => setShowRespondModal(false)}>
                  Cancelar
                </button>
                <button className={styles.primaryButton} onClick={handleRespond}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Availability Modal */}
        {showAvailabilityModal && (
          <div className={styles.modalOverlay} onClick={() => setShowAvailabilityModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Configurar Disponibilidad</h2>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Dia</label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(parseInt(e.target.value))}
                    className={styles.formSelect}
                  >
                    {DAYS_OF_WEEK.map((day, index) => (
                      <option key={index} value={index}>{day}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hora inicio</label>
                  <input
                    type="time"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className={styles.formInput}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Hora fin</label>
                  <input
                    type="time"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className={styles.formInput}
                  />
                </div>
                <button className={styles.addButton} onClick={handleAddSlot}>
                  <PlusIcon />
                </button>
              </div>

              {newSlots.length > 0 && (
                <div className={styles.newSlotsList}>
                  <h4>Nuevos horarios a agregar:</h4>
                  {newSlots.map((slot, index) => (
                    <div key={index} className={styles.newSlotItem}>
                      <span>{DAYS_OF_WEEK[slot.dia_semana]} {slot.hora_inicio} - {slot.hora_fin}</span>
                      <button onClick={() => handleRemoveNewSlot(index)}>
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => { setShowAvailabilityModal(false); setNewSlots([]); }}>
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleSaveAvailability}
                  disabled={availabilityLoading}
                >
                  {availabilityLoading ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Request Modal */}
        {showChangeModal && (
          <div className={styles.modalOverlay} onClick={() => setShowChangeModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Solicitar cambio de fecha</h2>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Motivo del cambio</label>
                <textarea
                  value={changeMotivo}
                  onChange={(e) => setChangeMotivo(e.target.value)}
                  className={styles.formTextarea}
                  rows={3}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nueva fecha propuesta</label>
                <input
                  type="date"
                  value={changeFecha}
                  onChange={(e) => setChangeFecha(e.target.value)}
                  className={styles.formInput}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Nueva hora propuesta</label>
                <input
                  type="time"
                  value={changeHora}
                  onChange={(e) => setChangeHora(e.target.value)}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => setShowChangeModal(false)}>
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleRequestChange}
                  disabled={sessionLoading}
                >
                  Enviar solicitud
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Package Modal */}
        {showCloseModal && (
          <div className={styles.modalOverlay} onClick={() => setShowCloseModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Cerrar Paquete</h2>
              <p className={styles.modalDescription}>
                Esto marcara el paquete como completado y enviara un reporte al cliente.
              </p>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reporte de cierre (opcional)</label>
                <textarea
                  value={closeReport}
                  onChange={(e) => setCloseReport(e.target.value)}
                  className={styles.formTextarea}
                  placeholder="Describe el trabajo realizado, logros, recomendaciones..."
                  rows={5}
                />
              </div>

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} onClick={() => setShowCloseModal(false)}>
                  Cancelar
                </button>
                <button
                  className={styles.closeButton}
                  onClick={handleClosePackage}
                  disabled={closeLoading}
                >
                  {closeLoading ? "Cerrando..." : "Cerrar Paquete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
