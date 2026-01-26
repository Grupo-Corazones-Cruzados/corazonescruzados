"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";

export interface Ticket {
  id: number;
  created_at: string;
  id_cliente: number;
  id_accion: number | null;
  id_miembro: number | null;
  titulo: string | null;
  detalle: string | null;
  estado: string | null;
  fecha_fin: string | null;
  fecha_programada: string | null;
  consumo: number | null;
  horas_estimadas: number | null;
  horas_reales: number | null;
  costo_estimado: number | null;
  costo_real: number | null;
  google_event_id: string | null;
  google_meet_link: string | null;
  cliente?: {
    id: number;
    nombre: string;
    correo_electronico: string;
  };
  miembro?: {
    id: number;
    nombre: string;
    foto: string | null;
    puesto: string | null;
    costo: number | null;
  };
  accion?: {
    id: number;
    nombre: string;
  };
}

export interface TicketSlot {
  id: number;
  created_at: string;
  id_ticket: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  duracion_real: number | null;
  notas: string | null;
}

export interface TicketAccion {
  id: number;
  created_at: string;
  id_ticket: number;
  id_accion: number;
  horas_asignadas: number;
  costo_hora: number;
  subtotal: number;
  accion?: {
    id: number;
    nombre: string;
  };
}

export interface TicketFilters {
  search: string;
  estado: string;
  miembro: number | null;
}

export interface TicketStats {
  total: number;
  pendientes: number;
  enProgreso: number;
  completados: number;
}

export function useTickets() {
  const { isAuthenticated } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TicketStats>({
    total: 0,
    pendientes: 0,
    enProgreso: 0,
    completados: 0,
  });

  const fetchTickets = useCallback(async (filters?: TicketFilters) => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.search) params.append("search", filters.search);
      if (filters?.estado && filters.estado !== "todos") params.append("estado", filters.estado);
      if (filters?.miembro) params.append("miembro", filters.miembro.toString());

      const response = await fetch(`/api/tickets?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar los tickets");
      }

      setTickets(data.tickets || []);
      setStats(data.stats || {
        total: 0,
        pendientes: 0,
        enProgreso: 0,
        completados: 0,
      });
    } catch (err: any) {
      console.error("Error fetching tickets:", err?.message);
      setError("Error al cargar los tickets");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return {
    tickets,
    loading,
    error,
    stats,
    refetch: fetchTickets,
  };
}

export function useTicket(id: number | null) {
  const { isAuthenticated } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [slots, setSlots] = useState<TicketSlot[]>([]);
  const [acciones, setAcciones] = useState<TicketAccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!isAuthenticated || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tickets/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar el ticket");
      }

      setTicket(data.ticket);
      setSlots(data.slots || []);
      setAcciones(data.acciones || []);
    } catch (err) {
      console.error("Error fetching ticket:", err);
      setError("Error al cargar el ticket");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const updateTicket = async (updates: Partial<Ticket>) => {
    if (!id) return { error: "No ticket ID" };

    try {
      const response = await fetch(`/api/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar el ticket");
      }

      await fetchTicket();
      return { error: null };
    } catch (err) {
      console.error("Error updating ticket:", err);
      return { error: "Error al actualizar el ticket" };
    }
  };

  const updateSlot = async (slotId: number, updates: Partial<TicketSlot>) => {
    if (!id) return { error: "No ticket ID" };

    try {
      const response = await fetch(`/api/tickets/${id}/slots`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slotId, ...updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar el slot");
      }

      await fetchTicket();
      return { error: null };
    } catch (err) {
      console.error("Error updating slot:", err);
      return { error: "Error al actualizar el slot" };
    }
  };

  return {
    ticket,
    slots,
    acciones,
    loading,
    error,
    refetch: fetchTicket,
    updateTicket,
    updateSlot,
  };
}

export function useCreateTicket() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTicket = async (data: {
    id_cliente: number;
    id_miembro: number;
    titulo: string;
    detalle?: string;
    horas_estimadas: number;
    costo_estimado: number;
    fecha_programada?: string;
    slots?: { fecha: string; hora_inicio: string; hora_fin: string }[];
    acciones?: { id_accion: number; horas_asignadas: number; costo_hora: number }[];
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el ticket");
      }

      return { data: result.ticket, error: null };
    } catch (err) {
      console.error("Error creating ticket:", err);
      const errorMessage = "Error al crear el ticket";
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createTicket,
    loading,
    error,
  };
}
