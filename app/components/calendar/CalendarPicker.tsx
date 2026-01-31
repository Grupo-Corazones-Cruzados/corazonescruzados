"use client";

import React, { useState, useMemo } from "react";
import { useMemberAvailability, TimeSlot } from "@/lib/hooks/useCalendar";
import styles from "@/app/styles/Calendar.module.css";

interface CalendarPickerProps {
  miembroId: number | null;
  selectedSlots: { fecha: string; hora_inicio: string; hora_fin: string }[];
  onSlotsChange: (slots: { fecha: string; hora_inicio: string; hora_fin: string }[]) => void;
  maxSlots?: number;
}

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

export default function CalendarPicker({
  miembroId,
  selectedSlots,
  onSlotsChange,
  maxSlots = 10,
}: CalendarPickerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { getAvailableSlotsForDate, hasAvailabilityOnDate, hasConfiguredAvailability, loading } = useMemberAvailability(miembroId);

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDay = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: { date: Date; dateString: string }[] = [];

    // Add empty days for padding
    for (let i = 0; i < startDay; i++) {
      days.push({ date: new Date(0), dateString: "" });
    }

    // Add actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateString = date.toISOString().split("T")[0];
      days.push({ date, dateString });
    }

    return { days, monthName: MONTHS[month], year };
  }, [currentDate]);

  // Get available time slots for selected date
  const timeSlots = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableSlotsForDate(selectedDate);
  }, [selectedDate, getAvailableSlotsForDate]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleDateClick = (dateString: string) => {
    if (!dateString) return;

    const date = new Date(dateString + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return; // Can't select past dates

    setSelectedDate(dateString);
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (!slot.disponible) return;

    const slotKey = `${slot.fecha}-${slot.hora_inicio}`;
    const existingIndex = selectedSlots.findIndex(
      (s) => `${s.fecha}-${s.hora_inicio}` === slotKey
    );

    if (existingIndex >= 0) {
      // Remove slot
      const newSlots = [...selectedSlots];
      newSlots.splice(existingIndex, 1);
      onSlotsChange(newSlots);
    } else if (selectedSlots.length < maxSlots) {
      // Add slot
      onSlotsChange([
        ...selectedSlots,
        {
          fecha: slot.fecha,
          hora_inicio: slot.hora_inicio,
          hora_fin: slot.hora_fin,
        },
      ]);
    }
  };

  const removeSlot = (index: number) => {
    const newSlots = [...selectedSlots];
    newSlots.splice(index, 1);
    onSlotsChange(newSlots);
  };

  const isSlotSelected = (slot: TimeSlot) => {
    return selectedSlots.some(
      (s) => s.fecha === slot.fecha && s.hora_inicio === slot.hora_inicio
    );
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatSlotDate = (dateString: string) => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  if (loading) {
    return (
      <div className={styles.calendarContainer}>
        <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)" }}>Cargando disponibilidad...</p>
        </div>
      </div>
    );
  }

  if (!hasConfiguredAvailability && miembroId) {
    return (
      <div className={styles.calendarContainer}>
        <div style={{
          padding: "var(--space-6)",
          textAlign: "center",
          background: "rgba(251, 191, 36, 0.1)",
          borderRadius: "var(--radius-md)",
          border: "1px solid rgba(251, 191, 36, 0.3)"
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" style={{ margin: "0 auto var(--space-3)" }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ color: "#fbbf24", fontWeight: 600, marginBottom: "var(--space-2)" }}>
            Sin disponibilidad configurada
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Este miembro aún no ha configurado sus horarios de disponibilidad.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.calendarContainer}>
        {/* Header */}
        <div className={styles.calendarHeader}>
          <h3 className={styles.calendarTitle}>
            {calendarData.monthName} {calendarData.year}
          </h3>
          <div className={styles.calendarNav}>
            <button className={styles.navButton} onClick={goToPreviousMonth} aria-label="Mes anterior">
              <ChevronLeftIcon />
            </button>
            <button className={styles.navButton} onClick={goToNextMonth} aria-label="Mes siguiente">
              <ChevronRightIcon />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className={styles.calendarGrid}>
          <div className={styles.weekdays}>
            {WEEKDAYS.map((day) => (
              <div key={day} className={styles.weekday}>
                {day}
              </div>
            ))}
          </div>

          <div className={styles.days}>
            {calendarData.days.map((day, index) => {
              if (!day.dateString) {
                return <div key={`empty-${index}`} className={`${styles.day} ${styles.dayEmpty}`} />;
              }

              const date = new Date(day.dateString + "T00:00:00");
              const isToday = date.toDateString() === today.toDateString();
              const isPast = date < today;
              const isSelected = selectedDate === day.dateString;
              const hasAvailability = !isPast && hasAvailabilityOnDate(day.dateString);

              return (
                <button
                  key={day.dateString}
                  className={`${styles.day}
                    ${isToday ? styles.dayToday : ""}
                    ${isPast ? styles.dayDisabled : ""}
                    ${isSelected ? styles.daySelected : ""}
                    ${hasAvailability ? styles.dayHasAvailability : ""}`}
                  onClick={() => handleDateClick(day.dateString)}
                  disabled={isPast}
                  aria-label={`${date.getDate()} de ${calendarData.monthName}`}
                  aria-selected={isSelected}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div className={styles.calendarGrid}>
            <div className={styles.timeSlotsContainer}>
              <div className={styles.timeSlotsHeader}>
                <h4 className={styles.timeSlotsTitle}>Horarios Disponibles</h4>
                <span className={styles.timeSlotsDate}>{formatSlotDate(selectedDate)}</span>
              </div>

              {timeSlots.length === 0 ? (
                <div className={styles.noSlots}>
                  No hay horarios disponibles para esta fecha
                </div>
              ) : (
                <div className={styles.timeSlotsGrid}>
                  {timeSlots.map((slot) => (
                    <button
                      key={`${slot.fecha}-${slot.hora_inicio}`}
                      className={`${styles.timeSlot}
                        ${isSlotSelected(slot) ? styles.timeSlotSelected : ""}
                        ${!slot.disponible ? styles.timeSlotDisabled : ""}`}
                      onClick={() => handleSlotClick(slot)}
                      disabled={!slot.disponible}
                    >
                      {slot.hora_inicio}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Selected Slots Summary */}
      {selectedSlots.length > 0 && (
        <div className={styles.selectedSlots}>
          <h4 className={styles.selectedSlotsTitle}>
            Horarios Seleccionados ({selectedSlots.length}/{maxSlots})
          </h4>
          <div className={styles.selectedSlotsList}>
            {selectedSlots
              .sort((a, b) => {
                if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
                return a.hora_inicio.localeCompare(b.hora_inicio);
              })
              .map((slot, index) => (
                <div key={`${slot.fecha}-${slot.hora_inicio}`} className={styles.selectedSlotItem}>
                  <span className={styles.selectedSlotInfo}>
                    {formatSlotDate(slot.fecha)} - {slot.hora_inicio} a {slot.hora_fin}
                  </span>
                  <button
                    className={styles.removeSlotButton}
                    onClick={() => removeSlot(index)}
                    aria-label="Eliminar horario"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
