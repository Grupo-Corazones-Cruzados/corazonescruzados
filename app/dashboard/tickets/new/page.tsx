"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import CalendarPicker from "@/app/components/calendar/CalendarPicker";
import { useCreateTicket } from "@/lib/hooks/useTickets";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/NewTicket.module.css";

interface Miembro {
  id: number;
  nombre: string;
  puesto: string | null;
  foto: string | null;
  costo: number | null;
}

interface Accion {
  id: number;
  nombre: string;
}

interface SelectedSlot {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
}

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const STEPS = [
  { id: 1, label: "Miembro" },
  { id: 2, label: "Horarios" },
  { id: 3, label: "Servicios" },
  { id: 4, label: "Detalles" },
  { id: 5, label: "Confirmar" },
];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const formatHours = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const formatSlotDate = (dateString: string): string => {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

export default function NewTicketPage() {
  const router = useRouter();
  const { profile, isAuthenticated } = useAuth();
  const { createTicket, loading: creating } = useCreateTicket();

  const [currentStep, setCurrentStep] = useState(1);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdTicketId, setCreatedTicketId] = useState<number | null>(null);

  // Form state
  const [selectedMiembro, setSelectedMiembro] = useState<Miembro | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [selectedAcciones, setSelectedAcciones] = useState<number[]>([]);
  const [hoursPerAction, setHoursPerAction] = useState<Record<number, number>>({});
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");

  // Load initial data (members and client)
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) return;

      try {
        const [membersRes, clientRes] = await Promise.all([
          fetch("/api/members"),
          fetch("/api/my-client"),
        ]);

        const membersData = await membersRes.json();
        const clientData = await clientRes.json();

        if (membersRes.ok && membersData.members) {
          setMiembros(membersData.members);
        }

        if (clientRes.ok && clientData.clientId) {
          setClienteId(clientData.clientId);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isAuthenticated, profile]);

  // Load actions when a member is selected
  useEffect(() => {
    if (!selectedMiembro) {
      setAcciones([]);
      return;
    }

    const loadActions = async () => {
      try {
        const res = await fetch(`/api/actions?miembro=${selectedMiembro.id}`);
        const data = await res.json();
        if (res.ok && data.actions) {
          setAcciones(data.actions);
        }
      } catch (error) {
        console.error("Error loading actions:", error);
      }
    };

    // Reset selected actions when member changes
    setSelectedAcciones([]);
    setHoursPerAction({});
    loadActions();
  }, [selectedMiembro]);

  // Calculate total hours from selected time slots
  const totalSlotHours = selectedSlots.reduce((total, slot) => {
    const [startH, startM] = slot.hora_inicio.split(":").map(Number);
    const [endH, endM] = slot.hora_fin.split(":").map(Number);
    const duration = (endH * 60 + endM - (startH * 60 + startM)) / 60;
    return total + duration;
  }, 0);

  // Auto-distribute slot hours equally among selected actions
  useEffect(() => {
    if (selectedAcciones.length === 0 || totalSlotHours === 0) {
      setHoursPerAction({});
      return;
    }
    const hoursEach = Math.round((totalSlotHours / selectedAcciones.length) * 100) / 100;
    const newHours: Record<number, number> = {};
    selectedAcciones.forEach((id) => {
      newHours[id] = hoursEach;
    });
    setHoursPerAction(newHours);
  }, [selectedAcciones, totalSlotHours]);

  // Calculate quote
  const calculateQuote = () => {
    if (!selectedMiembro) return { hours: 0, total: 0 };

    const hourlyRate = selectedMiembro.costo || 0;
    const total = totalSlotHours * hourlyRate;

    return { hours: totalSlotHours, total };
  };

  const quote = calculateQuote();

  // Step validation
  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedMiembro !== null;
      case 2:
        return selectedSlots.length > 0;
      case 3:
        return selectedAcciones.length > 0;
      case 4:
        return titulo.trim().length > 0;
      case 5:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAccionToggle = (accionId: number) => {
    if (selectedAcciones.includes(accionId)) {
      setSelectedAcciones(selectedAcciones.filter((id) => id !== accionId));
    } else {
      setSelectedAcciones([...selectedAcciones, accionId]);
    }
  };

  const handleSubmit = async () => {
    if (!clienteId || !selectedMiembro) return;

    const ticketAcciones = selectedAcciones.map((accionId) => ({
      id_accion: accionId,
      horas_asignadas: hoursPerAction[accionId] || 1,
      costo_hora: selectedMiembro.costo || 0,
    }));

    const result = await createTicket({
      id_cliente: clienteId,
      id_miembro: selectedMiembro.id,
      titulo,
      detalle,
      horas_estimadas: quote.hours,
      costo_estimado: quote.total,
      fecha_programada: selectedSlots.length > 0 ? `${selectedSlots[0].fecha}T${selectedSlots[0].hora_inicio}:00` : undefined,
      slots: selectedSlots,
      acciones: ticketAcciones,
    });

    if (result.data && !result.error) {
      setSuccess(true);
      setCreatedTicketId(result.data.id);
    } else {
      alert(result.error || "Error al crear el ticket");
    }
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (success) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <CheckIcon />
            </div>
            <h2 className={styles.successTitle}>Ticket Creado</h2>
            <p className={styles.successText}>
              Tu ticket ha sido creado exitosamente. El miembro asignado revisará tu solicitud pronto.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <Link
                href={`/dashboard/tickets/${createdTicketId}`}
                className={styles.nextButton}
              >
                Ver Ticket
              </Link>
              <Link
                href="/dashboard/tickets"
                className={styles.prevButton}
              >
                Ir a Tickets
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Back Button */}
        <Link href="/dashboard/tickets" className={styles.backButton}>
          <ArrowLeftIcon />
          Volver a tickets
        </Link>

        <h1 className={styles.pageTitle}>Nuevo Ticket</h1>
        <p className={styles.pageSubtitle}>
          Reserva una cita con un miembro de nuestro equipo
        </p>

        {/* Progress Bar */}
        <div className={styles.progressBar}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div
                  className={`${styles.progressConnector} ${
                    currentStep > step.id - 1 ? styles.progressConnectorActive : ""
                  }`}
                />
              )}
              <div
                className={`${styles.progressStep} ${
                  currentStep === step.id ? styles.stepActive : ""
                } ${currentStep > step.id ? styles.stepCompleted : ""}`}
              >
                <div className={styles.stepNumber}>
                  {currentStep > step.id ? <CheckIcon /> : step.id}
                </div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className={styles.stepContent}>
          {/* Step 1: Select Member */}
          {currentStep === 1 && (
            <div>
              <h2 className={styles.sectionTitle}>Selecciona un Miembro</h2>
              <div className={styles.membersGrid}>
                {miembros.map((miembro) => (
                  <button
                    key={miembro.id}
                    className={`${styles.memberCard} ${
                      selectedMiembro?.id === miembro.id ? styles.memberCardSelected : ""
                    }`}
                    onClick={() => setSelectedMiembro(miembro)}
                  >
                    {miembro.foto ? (
                      <img
                        src={miembro.foto}
                        alt={miembro.nombre}
                        className={styles.memberAvatar}
                      />
                    ) : (
                      <div className={styles.memberAvatarPlaceholder}>
                        {miembro.nombre.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className={styles.memberInfo}>
                      <div className={styles.memberName}>{miembro.nombre}</div>
                      <div className={styles.memberRole}>{miembro.puesto || "Miembro"}</div>
                      {miembro.costo && (
                        <div className={styles.memberRate}>
                          {formatCurrency(miembro.costo)}/hora
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Select Time Slots */}
          {currentStep === 2 && (
            <div>
              <h2 className={styles.sectionTitle}>Selecciona Horarios</h2>
              <CalendarPicker
                miembroId={selectedMiembro?.id || null}
                selectedSlots={selectedSlots}
                onSlotsChange={setSelectedSlots}
                maxSlots={5}
              />
            </div>
          )}

          {/* Step 3: Select Services */}
          {currentStep === 3 && (
            <div>
              <h2 className={styles.sectionTitle}>Selecciona Servicios</h2>
              <div className={styles.actionsGrid}>
                {acciones.map((accion) => (
                  <button
                    key={accion.id}
                    className={`${styles.actionCard} ${
                      selectedAcciones.includes(accion.id) ? styles.actionCardSelected : ""
                    }`}
                    onClick={() => handleAccionToggle(accion.id)}
                  >
                    <span className={styles.actionName}>
                      <span className={styles.actionCheckmark}>✓ </span>
                      {accion.nombre}
                    </span>
                  </button>
                ))}
              </div>

              {selectedAcciones.length > 0 && (
                <div className={styles.hoursInputGroup}>
                  <p style={{ marginBottom: "var(--space-3)", color: "var(--text-secondary)" }}>
                    Horas asignadas según horarios seleccionados ({formatHours(totalSlotHours)} total):
                  </p>
                  {selectedAcciones.map((accionId) => {
                    const accion = acciones.find((a) => a.id === accionId);
                    return (
                      <div key={accionId} className={styles.hoursRow}>
                        <span className={styles.hoursLabel}>{accion?.nombre}</span>
                        <span className={styles.hoursValue}>{formatHours(hoursPerAction[accionId] || 0)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Quote Summary */}
              {selectedAcciones.length > 0 && (
                <div className={styles.quoteSummary}>
                  <h3 className={styles.quoteTitle}>Cotización Estimada</h3>
                  <div className={styles.quoteRow}>
                    <span className={styles.quoteLabel}>Horas totales</span>
                    <span className={styles.quoteValue}>{formatHours(quote.hours)}</span>
                  </div>
                  <div className={styles.quoteRow}>
                    <span className={styles.quoteLabel}>Tarifa por hora</span>
                    <span className={styles.quoteValue}>
                      {formatCurrency(selectedMiembro?.costo || 0)}
                    </span>
                  </div>
                  <div className={styles.quoteTotal}>
                    <span>Total Estimado</span>
                    <span className={styles.quoteTotalValue}>{formatCurrency(quote.total)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Details */}
          {currentStep === 4 && (
            <div>
              <h2 className={styles.sectionTitle}>Detalles del Ticket</h2>
              <div className={styles.formSection}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Título *</label>
                  <input
                    type="text"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    placeholder="Ej: Consultoría de diseño web"
                    className={styles.formInput}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Descripción (opcional)</label>
                  <textarea
                    value={detalle}
                    onChange={(e) => setDetalle(e.target.value)}
                    placeholder="Describe lo que necesitas..."
                    className={styles.formTextarea}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 5 && (
            <div>
              <h2 className={styles.sectionTitle}>Confirmar Reserva</h2>
              <div className={styles.confirmationCard}>
                <div className={styles.confirmationSection}>
                  <div className={styles.confirmationLabel}>Miembro</div>
                  <div className={styles.confirmationValue}>
                    {selectedMiembro?.nombre} - {selectedMiembro?.puesto || "Miembro"}
                  </div>
                </div>

                <div className={styles.confirmationSection}>
                  <div className={styles.confirmationLabel}>Horarios</div>
                  <div className={styles.slotsList}>
                    {selectedSlots.map((slot, index) => (
                      <div key={index} className={styles.slotItem}>
                        {formatSlotDate(slot.fecha)} - {slot.hora_inicio} a {slot.hora_fin}
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.confirmationSection}>
                  <div className={styles.confirmationLabel}>Servicios</div>
                  <div className={styles.confirmationValue}>
                    {selectedAcciones.map((id) => {
                      const accion = acciones.find((a) => a.id === id);
                      return (
                        <div key={id}>
                          {accion?.nombre} - {formatHours(hoursPerAction[id] || 0)}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.confirmationSection}>
                  <div className={styles.confirmationLabel}>Título</div>
                  <div className={styles.confirmationValue}>{titulo}</div>
                </div>

                {detalle && (
                  <div className={styles.confirmationSection}>
                    <div className={styles.confirmationLabel}>Descripción</div>
                    <div className={styles.confirmationValue}>{detalle}</div>
                  </div>
                )}

                <div className={styles.quoteSummary} style={{ marginTop: "var(--space-4)" }}>
                  <div className={styles.quoteTotal}>
                    <span>Total a Pagar</span>
                    <span className={styles.quoteTotalValue}>{formatCurrency(quote.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className={styles.navigationButtons}>
          {currentStep > 1 ? (
            <button className={styles.prevButton} onClick={handlePrev}>
              <ArrowLeftIcon />
              Anterior
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              className={styles.nextButton}
              onClick={handleNext}
              disabled={!canProceed()}
            >
              Siguiente
              <ArrowRightIcon />
            </button>
          ) : (
            <button
              className={styles.nextButton}
              onClick={handleSubmit}
              disabled={creating || !canProceed()}
            >
              {creating ? "Creando..." : "Confirmar Reserva"}
              <CheckIcon />
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
