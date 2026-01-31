"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import { useMemberAvailability, useManageAvailability } from "@/lib/hooks/useCalendar";
import styles from "@/app/styles/Calendar.module.css";
import ticketStyles from "@/app/styles/Tickets.module.css";

const DAYS_OF_WEEK = [
  { id: 0, name: "Domingo" },
  { id: 1, name: "Lunes" },
  { id: 2, name: "Martes" },
  { id: 3, name: "Miércoles" },
  { id: 4, name: "Jueves" },
  { id: 5, name: "Viernes" },
  { id: 6, name: "Sábado" },
];

interface DaySchedule {
  enabled: boolean;
  hora_inicio: string;
  hora_fin: string;
}

type WeeklySchedule = Record<number, DaySchedule>;

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export default function AvailabilitySettingsPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const userRole = profile?.rol || "cliente";
  const miembroId = profile?.id_miembro || null;

  const { availability, exceptions, loading, refetch } = useMemberAvailability(miembroId);
  const { saving, saveWeeklyAvailability, addException, removeException } = useManageAvailability(miembroId);

  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Exception form state
  const [newExceptionDate, setNewExceptionDate] = useState("");
  const [newExceptionType, setNewExceptionType] = useState<"blocked" | "available">("blocked");
  const [newExceptionMotivo, setNewExceptionMotivo] = useState("");

  // Initialize schedule from database
  useEffect(() => {
    if (!loading) {
      const schedule: WeeklySchedule = {};

      DAYS_OF_WEEK.forEach((day) => {
        const dayAvailability = availability.find((a) => a.dia_semana === day.id);
        schedule[day.id] = {
          enabled: !!dayAvailability,
          hora_inicio: dayAvailability?.hora_inicio || "09:00",
          hora_fin: dayAvailability?.hora_fin || "18:00",
        };
      });

      setWeeklySchedule(schedule);
    }
  }, [availability, loading]);

  // Redirect if not a member
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      if (userRole !== "miembro" && userRole !== "admin") {
        router.push("/dashboard");
      }
    }
  }, [authLoading, isAuthenticated, userRole, router]);

  const handleDayToggle = (dayId: number) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        enabled: !prev[dayId]?.enabled,
      },
    }));
    setHasChanges(true);
  };

  const handleTimeChange = (dayId: number, field: "hora_inicio" | "hora_fin", value: string) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSaveSchedule = async () => {
    const slots = Object.entries(weeklySchedule)
      .filter(([, schedule]) => schedule.enabled)
      .map(([dayId, schedule]) => ({
        dia_semana: parseInt(dayId),
        hora_inicio: schedule.hora_inicio,
        hora_fin: schedule.hora_fin,
      }));

    const result = await saveWeeklyAvailability(slots);

    if (!result.error) {
      setHasChanges(false);
      refetch();
      alert("Disponibilidad guardada correctamente");
    } else {
      alert(result.error);
    }
  };

  const handleAddException = async () => {
    if (!newExceptionDate) {
      alert("Selecciona una fecha");
      return;
    }

    const result = await addException({
      fecha: newExceptionDate,
      tipo: newExceptionType,
      motivo: newExceptionMotivo || undefined,
    });

    if (!result.error) {
      setNewExceptionDate("");
      setNewExceptionMotivo("");
      refetch();
    } else {
      alert(result.error);
    }
  };

  const handleRemoveException = async (exceptionId: number) => {
    const result = await removeException(exceptionId);
    if (!result.error) {
      refetch();
    } else {
      alert(result.error);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className={ticketStyles.loadingState}>
          <div className={ticketStyles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando configuración...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (userRole !== "miembro" && userRole !== "admin") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className={ticketStyles.page}>
        {/* Header */}
        <div className={ticketStyles.pageHeader}>
          <div>
            <h1 className={ticketStyles.pageTitle}>Disponibilidad</h1>
            <p className={ticketStyles.pageSubtitle}>
              Configura tus horarios de disponibilidad para citas
            </p>
          </div>
          {hasChanges && (
            <button
              className={ticketStyles.primaryButton}
              onClick={handleSaveSchedule}
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          )}
        </div>

        {/* Weekly Schedule */}
        <section className={styles.availabilitySection}>
          <h2 className={styles.availabilitySectionTitle}>Horario Semanal</h2>

          {availability.length === 0 && (
            <div style={{
              padding: "var(--space-4)",
              marginBottom: "var(--space-4)",
              background: "rgba(59, 130, 246, 0.1)",
              borderRadius: "var(--radius-md)",
              border: "1px solid rgba(59, 130, 246, 0.3)"
            }}>
              <p style={{ color: "var(--primary)", fontSize: "0.9rem", margin: 0 }}>
                Aún no has configurado tu disponibilidad. Activa los días en que estés disponible
                y establece tus horarios. Recuerda guardar los cambios.
              </p>
            </div>
          )}

          <div className={styles.weeklySchedule}>
            {DAYS_OF_WEEK.map((day) => {
              const schedule = weeklySchedule[day.id] || { enabled: false, hora_inicio: "09:00", hora_fin: "18:00" };

              return (
                <div key={day.id} className={styles.dayRow}>
                  <span className={styles.dayLabel}>{day.name}</span>

                  <div className={styles.dayToggle}>
                    <button
                      type="button"
                      className={`${styles.toggleSwitch} ${schedule.enabled ? styles.active : ""}`}
                      onClick={() => handleDayToggle(day.id)}
                      aria-pressed={schedule.enabled}
                      aria-label={`${schedule.enabled ? "Desactivar" : "Activar"} ${day.name}`}
                    >
                      <span className={styles.toggleKnob} />
                    </button>
                  </div>

                  {schedule.enabled && (
                    <div className={styles.dayTimes}>
                      <input
                        type="time"
                        value={schedule.hora_inicio}
                        onChange={(e) => handleTimeChange(day.id, "hora_inicio", e.target.value)}
                        className={styles.timeInput}
                      />
                      <span className={styles.timeSeparator}>a</span>
                      <input
                        type="time"
                        value={schedule.hora_fin}
                        onChange={(e) => handleTimeChange(day.id, "hora_fin", e.target.value)}
                        className={styles.timeInput}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Exceptions */}
        <section className={styles.availabilitySection}>
          <h2 className={styles.availabilitySectionTitle}>Excepciones</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
            Bloquea días específicos o agrega disponibilidad extra
          </p>

          {/* Add Exception Form */}
          <div className={styles.addExceptionForm}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fecha</label>
              <input
                type="date"
                value={newExceptionDate}
                onChange={(e) => setNewExceptionDate(e.target.value)}
                className={styles.formInput}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Tipo</label>
              <select
                value={newExceptionType}
                onChange={(e) => setNewExceptionType(e.target.value as "blocked" | "available")}
                className={styles.formSelect}
              >
                <option value="blocked">Bloqueado</option>
                <option value="available">Disponible Extra</option>
              </select>
            </div>

            <div className={styles.formGroup} style={{ flex: 1 }}>
              <label className={styles.formLabel}>Motivo (opcional)</label>
              <input
                type="text"
                value={newExceptionMotivo}
                onChange={(e) => setNewExceptionMotivo(e.target.value)}
                placeholder="Ej: Vacaciones"
                className={styles.formInput}
              />
            </div>

            <div className={styles.formGroup} style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                className={ticketStyles.primaryButton}
                onClick={handleAddException}
                disabled={saving}
              >
                Agregar
              </button>
            </div>
          </div>

          {/* Exceptions List */}
          {exceptions.length > 0 && (
            <div className={styles.exceptionsList}>
              {exceptions
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((exception) => (
                  <div key={exception.id} className={styles.exceptionItem}>
                    <div className={styles.exceptionInfo}>
                      <span className={styles.exceptionDate}>{formatDate(exception.fecha)}</span>
                      <span
                        className={`${styles.exceptionType} ${
                          exception.tipo === "blocked" ? styles.exceptionBlocked : styles.exceptionAvailable
                        }`}
                      >
                        {exception.tipo === "blocked" ? "Bloqueado" : "Disponible"}
                      </span>
                      {exception.motivo && (
                        <span className={styles.exceptionMotivo}>{exception.motivo}</span>
                      )}
                    </div>
                    <button
                      className={styles.removeSlotButton}
                      onClick={() => handleRemoveException(exception.id)}
                      aria-label="Eliminar excepción"
                    >
                      <XIcon />
                    </button>
                  </div>
                ))}
            </div>
          )}

          {exceptions.length === 0 && (
            <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "var(--space-4)" }}>
              No hay excepciones configuradas
            </p>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
