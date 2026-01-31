"use client";

import { useState, useEffect, useCallback } from "react";

export interface MemberAvailability {
  id: number;
  id_miembro: number;
  dia_semana: number; // 0-6
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

export interface AvailabilityException {
  id: number;
  id_miembro: number;
  fecha: string;
  tipo: "blocked" | "available";
  motivo: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
}

export interface TimeSlot {
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  disponible: boolean;
}

export interface BookedSlot {
  id: number;
  id_ticket: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
}

const DAYS_OF_WEEK = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function useMemberAvailability(miembroId: number | null) {
  const [availability, setAvailability] = useState<MemberAvailability[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!miembroId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/members/${miembroId}/availability`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar la disponibilidad");
      }

      setAvailability(data.availability || []);
      setExceptions(data.exceptions || []);
      setBookedSlots(data.bookedSlots || []);
    } catch (err: any) {
      console.error("Error fetching availability:", err?.message);
      setError("Error al cargar la disponibilidad");
    } finally {
      setLoading(false);
    }
  }, [miembroId]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Generate available time slots for a specific date
  const getAvailableSlotsForDate = useCallback(
    (dateString: string): TimeSlot[] => {
      const date = new Date(dateString + "T00:00:00");
      const dayOfWeek = date.getDay();

      // Check if there's an exception for this date
      const exception = exceptions.find((e) => e.fecha === dateString);

      if (exception?.tipo === "blocked") {
        return []; // Day is blocked
      }

      // Get regular availability for this day
      let dayAvailability = availability.filter((a) => a.dia_semana === dayOfWeek);

      // If there's an available exception with specific hours, use those instead
      if (exception?.tipo === "available" && exception.hora_inicio && exception.hora_fin) {
        dayAvailability = [
          {
            id: 0,
            id_miembro: miembroId || 0,
            dia_semana: dayOfWeek,
            hora_inicio: exception.hora_inicio,
            hora_fin: exception.hora_fin,
            activo: true,
          },
        ];
      }

      // Si no hay disponibilidad configurada para este día, no mostrar slots
      // El miembro debe configurar su disponibilidad explícitamente
      if (dayAvailability.length === 0) {
        return [];
      }

      // Generate 30-minute slots from availability
      const slots: TimeSlot[] = [];

      dayAvailability.forEach((avail) => {
        const [startHour, startMin] = avail.hora_inicio.split(":").map(Number);
        const [endHour, endMin] = avail.hora_fin.split(":").map(Number);

        let currentHour = startHour;
        let currentMin = startMin;

        while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
          const slotStart = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;

          // Next slot: 30 minutes later
          let nextMin = currentMin + 30;
          let nextHour = currentHour;
          if (nextMin >= 60) {
            nextMin -= 60;
            nextHour += 1;
          }
          if (nextHour > endHour || (nextHour === endHour && nextMin > endMin)) {
            nextHour = endHour;
            nextMin = endMin;
          }

          const slotEnd = `${String(nextHour).padStart(2, "0")}:${String(nextMin).padStart(2, "0")}`;

          // Check if slot is already booked
          const isBooked = bookedSlots.some(
            (booked) =>
              booked.fecha === dateString &&
              booked.hora_inicio <= slotStart &&
              booked.hora_fin > slotStart
          );

          // Check if slot is in the past
          const now = new Date();
          const slotDateTime = new Date(`${dateString}T${slotStart}:00`);
          const isPast = slotDateTime < now;

          slots.push({
            fecha: dateString,
            hora_inicio: slotStart,
            hora_fin: slotEnd,
            disponible: !isBooked && !isPast,
          });

          currentHour = nextHour;
          currentMin = nextMin;
        }
      });

      return slots;
    },
    [availability, exceptions, bookedSlots, miembroId]
  );

  // Check if a date has any availability
  const hasAvailabilityOnDate = useCallback(
    (dateString: string): boolean => {
      const slots = getAvailableSlotsForDate(dateString);
      return slots.some((slot) => slot.disponible);
    },
    [getAvailableSlotsForDate]
  );

  // Check if member has any availability configured
  const hasConfiguredAvailability = availability.length > 0;

  return {
    availability,
    exceptions,
    bookedSlots,
    loading,
    error,
    getAvailableSlotsForDate,
    hasAvailabilityOnDate,
    hasConfiguredAvailability,
    refetch: fetchAvailability,
    DAYS_OF_WEEK,
  };
}

export function useManageAvailability(miembroId: number | null) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveWeeklyAvailability = async (
    slots: { dia_semana: number; hora_inicio: string; hora_fin: string }[]
  ) => {
    if (!miembroId) return { error: "No member ID" };

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/members/${miembroId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al guardar la disponibilidad");
      }

      return { error: null };
    } catch (err) {
      console.error("Error saving availability:", err);
      const errorMsg = "Error al guardar la disponibilidad";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setSaving(false);
    }
  };

  const addException = async (exception: {
    fecha: string;
    tipo: "blocked" | "available";
    motivo?: string;
    hora_inicio?: string;
    hora_fin?: string;
  }) => {
    if (!miembroId) return { error: "No member ID" };

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/members/${miembroId}/availability/exceptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exception),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al agregar la excepción");
      }

      return { error: null };
    } catch (err) {
      console.error("Error adding exception:", err);
      const errorMsg = "Error al agregar la excepción";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setSaving(false);
    }
  };

  const removeException = async (exceptionId: number) => {
    if (!miembroId) return { error: "No member ID" };

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/members/${miembroId}/availability/exceptions/${exceptionId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar la excepción");
      }

      return { error: null };
    } catch (err) {
      console.error("Error removing exception:", err);
      const errorMsg = "Error al eliminar la excepción";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setSaving(false);
    }
  };

  return {
    saving,
    error,
    saveWeeklyAvailability,
    addException,
    removeException,
  };
}
