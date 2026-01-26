"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useTicket } from "@/lib/hooks/useTickets";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/Tickets.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

const getStatusClass = (estado: string | null): string => {
  switch (estado) {
    case "pendiente":
      return styles.statusPendiente;
    case "confirmado":
      return styles.statusConfirmado;
    case "en_progreso":
      return styles.statusEnProgreso;
    case "completado":
      return styles.statusCompletado;
    case "cancelado":
      return styles.statusCancelado;
    default:
      return styles.statusPendiente;
  }
};

const getStatusLabel = (estado: string | null): string => {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "confirmado":
      return "Confirmado";
    case "en_progreso":
      return "En Progreso";
    case "completado":
      return "Completado";
    case "cancelado":
      return "Cancelado";
    default:
      return "Pendiente";
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

const formatTime = (timeString: string): string => {
  return timeString.slice(0, 5); // HH:MM
};

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const ticketId = params?.id ? parseInt(params.id as string, 10) : null;
  const { ticket, slots, acciones, loading, error, updateTicket, updateSlot } = useTicket(ticketId);
  const [updating, setUpdating] = useState(false);

  const userRole = profile?.rol || "cliente";
  const isMember = userRole === "miembro" || userRole === "admin";

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    const { error } = await updateTicket({ estado: newStatus });
    if (error) {
      alert(error);
    }
    setUpdating(false);
  };

  const handleSlotComplete = async (slotId: number, duracionReal: number) => {
    setUpdating(true);
    const { error } = await updateSlot(slotId, {
      estado: "completado",
      duracion_real: duracionReal,
    });
    if (error) {
      alert(error);
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando ticket...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !ticket) {
    return (
      <DashboardLayout>
        <div className={styles.detailPage}>
          <Link href="/dashboard/tickets" className={styles.backButton}>
            <ArrowLeftIcon />
            Volver a tickets
          </Link>
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>Ticket no encontrado</h3>
            <p className={styles.emptyText}>
              {error || "El ticket que buscas no existe o no tienes acceso."}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate totals from acciones
  const totalFromAcciones = acciones.reduce((sum, a) => sum + (a.subtotal || 0), 0);

  return (
    <DashboardLayout>
      <div className={styles.detailPage}>
        {/* Back Button */}
        <Link href="/dashboard/tickets" className={styles.backButton}>
          <ArrowLeftIcon />
          Volver a tickets
        </Link>

        <div className={styles.detailGrid}>
          {/* Main Content */}
          <div className={styles.detailMain}>
            {/* Header Card */}
            <div className={styles.detailCard}>
              <div className={styles.detailHeader}>
                <div>
                  <h1 className={styles.detailTitle}>
                    {ticket.titulo || `Ticket #${ticket.id}`}
                  </h1>
                  <p style={{ color: "var(--text-muted)", marginTop: "var(--space-1)" }}>
                    Ticket #{ticket.id}
                  </p>
                </div>
                <span className={`${styles.ticketStatus} ${getStatusClass(ticket.estado)}`}>
                  {getStatusLabel(ticket.estado)}
                </span>
              </div>

              {ticket.detalle && (
                <div style={{ marginTop: "var(--space-4)" }}>
                  <h4 className={styles.detailCardTitle}>Descripción</h4>
                  <p className={styles.detailDescription}>{ticket.detalle}</p>
                </div>
              )}
            </div>

            {/* Slots Card */}
            {slots.length > 0 && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Horarios Programados</h4>
                <div className={styles.slotsList}>
                  {slots.map((slot) => (
                    <div key={slot.id} className={styles.slotItem}>
                      <div>
                        <div className={styles.slotDate}>{formatDate(slot.fecha)}</div>
                        <div className={styles.slotTime}>
                          {formatTime(slot.hora_inicio)} - {formatTime(slot.hora_fin)}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
                        <span className={`${styles.ticketStatus} ${getStatusClass(slot.estado)}`}>
                          {getStatusLabel(slot.estado)}
                        </span>
                        {isMember && slot.estado !== "completado" && (
                          <button
                            className={styles.secondaryButton}
                            onClick={() => {
                              const duracion = prompt("Minutos trabajados:");
                              if (duracion) {
                                handleSlotComplete(slot.id, parseFloat(duracion));
                              }
                            }}
                            disabled={updating}
                          >
                            Completar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones Card */}
            {acciones.length > 0 && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Servicios Incluidos</h4>
                <div className={styles.actionsList}>
                  {acciones.map((accion) => (
                    <div key={accion.id} className={styles.actionItem}>
                      <div>
                        <div className={styles.actionName}>
                          {accion.accion?.nombre || "Servicio"}
                        </div>
                        <div className={styles.actionHours}>
                          {accion.horas_asignadas}h × {formatCurrency(accion.costo_hora)}/h
                        </div>
                      </div>
                      <div className={styles.actionCost}>
                        {formatCurrency(accion.subtotal)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Meet Link */}
            {ticket.google_meet_link && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Reunión</h4>
                <a
                  href={ticket.google_meet_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.primaryButton}
                  style={{ display: "inline-flex" }}
                >
                  Unirse a Google Meet
                  <ExternalLinkIcon />
                </a>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className={styles.detailSidebar}>
            {/* Member Card */}
            {ticket.miembro && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Miembro Asignado</h4>
                <div className={styles.memberCard}>
                  {ticket.miembro.foto ? (
                    <img
                      src={ticket.miembro.foto}
                      alt={ticket.miembro.nombre}
                      className={styles.memberAvatar}
                    />
                  ) : (
                    <div className={styles.memberAvatar} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.25rem",
                      fontWeight: 600,
                      color: "var(--turquoise)",
                    }}>
                      {ticket.miembro.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.memberInfo}>
                    <div className={styles.memberName}>{ticket.miembro.nombre}</div>
                    <div className={styles.memberRole}>
                      {ticket.miembro.puesto || "Miembro"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Details Card */}
            <div className={styles.detailCard}>
              <h4 className={styles.detailCardTitle}>Detalles</h4>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Creado</span>
                <span className={styles.infoValue}>{formatDate(ticket.created_at)}</span>
              </div>
              {ticket.fecha_programada && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Programado</span>
                  <span className={styles.infoValue}>{formatDate(ticket.fecha_programada)}</span>
                </div>
              )}
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Horas Estimadas</span>
                <span className={styles.infoValue}>{ticket.horas_estimadas || 0}h</span>
              </div>
              {ticket.horas_reales !== null && (
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Horas Reales</span>
                  <span className={styles.infoValue}>{ticket.horas_reales}h</span>
                </div>
              )}
            </div>

            {/* Cost Card */}
            <div className={styles.detailCard}>
              <h4 className={styles.detailCardTitle}>Costos</h4>
              <div className={styles.costBreakdown}>
                {acciones.length > 0 ? (
                  <>
                    {acciones.map((accion) => (
                      <div key={accion.id} className={styles.costRow}>
                        <span style={{ color: "var(--text-muted)" }}>
                          {accion.accion?.nombre}
                        </span>
                        <span>{formatCurrency(accion.subtotal)}</span>
                      </div>
                    ))}
                    <div className={styles.costTotal}>
                      <span>Total</span>
                      <span className={styles.costTotalValue}>
                        {formatCurrency(totalFromAcciones || ticket.costo_estimado)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className={styles.costTotal}>
                    <span>Total Estimado</span>
                    <span className={styles.costTotalValue}>
                      {formatCurrency(ticket.costo_estimado)}
                    </span>
                  </div>
                )}
                {ticket.costo_real !== null && (
                  <div className={styles.costRow} style={{ marginTop: "var(--space-2)" }}>
                    <span style={{ color: "var(--text-muted)" }}>Costo Real</span>
                    <span style={{ color: "var(--turquoise)", fontWeight: 600 }}>
                      {formatCurrency(ticket.costo_real)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Card (for members) */}
            {isMember && ticket.estado !== "completado" && ticket.estado !== "cancelado" && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Acciones</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                  {ticket.estado === "pendiente" && (
                    <button
                      className={styles.primaryButton}
                      onClick={() => handleStatusChange("confirmado")}
                      disabled={updating}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      {updating ? "Actualizando..." : "Confirmar Ticket"}
                    </button>
                  )}
                  {ticket.estado === "confirmado" && (
                    <button
                      className={styles.primaryButton}
                      onClick={() => handleStatusChange("en_progreso")}
                      disabled={updating}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      {updating ? "Actualizando..." : "Iniciar Trabajo"}
                    </button>
                  )}
                  {ticket.estado === "en_progreso" && (
                    <button
                      className={styles.primaryButton}
                      onClick={() => handleStatusChange("completado")}
                      disabled={updating}
                      style={{ width: "100%", justifyContent: "center" }}
                    >
                      {updating ? "Actualizando..." : "Marcar Completado"}
                    </button>
                  )}
                  <button
                    className={styles.secondaryButton}
                    onClick={() => handleStatusChange("cancelado")}
                    disabled={updating}
                    style={{ width: "100%", justifyContent: "center" }}
                  >
                    Cancelar Ticket
                  </button>
                </div>
              </div>
            )}

            {/* Client Info (for members) */}
            {isMember && ticket.cliente && (
              <div className={styles.detailCard}>
                <h4 className={styles.detailCardTitle}>Cliente</h4>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Nombre</span>
                  <span className={styles.infoValue}>{ticket.cliente.nombre}</span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Email</span>
                  <span className={styles.infoValue}>{ticket.cliente.correo_electronico}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
