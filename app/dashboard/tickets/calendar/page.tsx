"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/Calendar.module.css";
import ticketStyles from "@/app/styles/Tickets.module.css";

interface CalendarEvent {
  id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  ticket: {
    id: number;
    titulo: string | null;
    cliente?: {
      nombre: string;
    };
    miembro?: {
      nombre: string;
    };
  };
}

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

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

const getStatusColor = (estado: string): string => {
  switch (estado) {
    case "pendiente":
      return "#fbbf24";
    case "confirmado":
      return "#3b82f6";
    case "en_progreso":
      return "#00ced1";
    case "completado":
      return "#22c55e";
    case "cancelado":
      return "#ef4444";
    default:
      return "#6b7280";
  }
};

export default function CalendarPage() {
  const router = useRouter();
  const { profile, isAuthenticated } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const userRole = profile?.rol || "cliente";
  const userMiembroId = profile?.id_miembro;

  useEffect(() => {
    const fetchEvents = async () => {
      if (!isAuthenticated) return;

      setLoading(true);

      try {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const startDate = firstDay.toISOString().split("T")[0];
        const endDate = lastDay.toISOString().split("T")[0];

        const response = await fetch(`/api/calendar?startDate=${startDate}&endDate=${endDate}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Error fetching events");
        }

        // Transform events
        const transformedEvents: CalendarEvent[] = (data.events || [])
          .filter((e: any) => e.ticket !== null)
          .map((e: any) => ({
            id: e.id,
            fecha: e.fecha,
            hora_inicio: e.hora_inicio,
            hora_fin: e.hora_fin,
            estado: e.estado,
            ticket: e.ticket,
          }));

        setEvents(transformedEvents);
      } catch (error: any) {
        console.error("Error fetching events:", error?.message || JSON.stringify(error));
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [isAuthenticated, currentDate, userRole, userMiembroId]);

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

  // Get events for a specific date
  const getEventsForDate = (dateString: string) => {
    return events.filter((e) => e.fecha === dateString);
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    setSelectedDate(null);
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatTime = (time: string) => time.slice(0, 5);

  return (
    <DashboardLayout>
      <div className={ticketStyles.page}>
        {/* Header */}
        <div className={ticketStyles.pageHeader}>
          <div>
            <h1 className={ticketStyles.pageTitle}>Calendario</h1>
            <p className={ticketStyles.pageSubtitle}>
              Vista de citas y horarios programados
            </p>
          </div>
          {userRole === "cliente" && (
            <Link href="/dashboard/tickets/new" className={ticketStyles.primaryButton}>
              Nueva Reserva
            </Link>
          )}
        </div>

        <div className={styles.calendarPage}>
          {/* Calendar */}
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

              {loading ? (
                <div style={{ padding: "var(--space-8)", textAlign: "center" }}>
                  <p style={{ color: "var(--text-muted)" }}>Cargando eventos...</p>
                </div>
              ) : (
                <div className={styles.days}>
                  {calendarData.days.map((day, index) => {
                    if (!day.dateString) {
                      return <div key={`empty-${index}`} className={`${styles.day} ${styles.dayEmpty}`} />;
                    }

                    const date = new Date(day.dateString + "T00:00:00");
                    const isToday = date.toDateString() === today.toDateString();
                    const isSelected = selectedDate === day.dateString;
                    const dayEvents = getEventsForDate(day.dateString);
                    const hasEvents = dayEvents.length > 0;

                    return (
                      <button
                        key={day.dateString}
                        className={`${styles.day}
                          ${isToday ? styles.dayToday : ""}
                          ${isSelected ? styles.daySelected : ""}
                          ${hasEvents ? styles.dayHasAvailability : ""}`}
                        onClick={() => setSelectedDate(day.dateString)}
                        aria-label={`${date.getDate()} de ${calendarData.monthName}`}
                        aria-selected={isSelected}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Selected Date Events */}
          <div>
            <div className={styles.calendarContainer}>
              <div className={styles.calendarHeader}>
                <h3 className={styles.calendarTitle}>
                  {selectedDate
                    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "long",
                      })
                    : "Selecciona una fecha"}
                </h3>
              </div>

              <div style={{ padding: "var(--space-4)" }}>
                {!selectedDate ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "var(--space-6)" }}>
                    Haz clic en un día para ver los eventos
                  </p>
                ) : selectedDateEvents.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "var(--space-6)" }}>
                    No hay eventos para este día
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
                    {selectedDateEvents.map((event) => (
                      <div
                        key={event.id}
                        style={{
                          padding: "var(--space-3)",
                          background: "var(--surface-2)",
                          borderRadius: "var(--radius-md)",
                          borderLeft: `3px solid ${getStatusColor(event.estado)}`,
                          cursor: "pointer",
                        }}
                        onClick={() => router.push(`/dashboard/tickets/${event.ticket.id}`)}
                      >
                        <div style={{
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          marginBottom: "var(--space-1)",
                        }}>
                          {event.ticket.titulo || `Ticket #${event.ticket.id}`}
                        </div>
                        <div style={{
                          fontSize: "0.85rem",
                          color: "var(--text-muted)",
                        }}>
                          {formatTime(event.hora_inicio)} - {formatTime(event.hora_fin)}
                        </div>
                        {event.ticket.cliente && (
                          <div style={{
                            fontSize: "0.85rem",
                            color: "var(--text-secondary)",
                            marginTop: "var(--space-1)",
                          }}>
                            Cliente: {event.ticket.cliente.nombre}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
