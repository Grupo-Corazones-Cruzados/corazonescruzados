"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";

// =====================================================
// INTERFACES
// =====================================================

export interface PaqueteSolicitud {
  id: number;
  created_at: string;
  updated_at: string;
  id_cliente: string;
  horas_totales: number;
  horas_asignadas: number;
  costo_hora: number;
  descuento: number;
  id_paquete_tier: number | null;
  estado: string;
  notas_cliente: string | null;
  fecha_completado: string | null;
  tier_nombre?: string;
  asignaciones?: PaqueteAsignacion[];
  asignaciones_count?: number;
}

export interface PaqueteAsignacion {
  id: number;
  created_at: string;
  updated_at: string;
  id_solicitud: number;
  id_miembro: number;
  horas_asignadas: number;
  horas_consumidas: number;
  descripcion_tarea: string | null;
  dias_semana: number[];
  estado: string;
  fecha_respuesta: string | null;
  motivo_rechazo: string | null;
  fecha_pre_confirmacion: string | null;
  fecha_completado: string | null;
  miembro?: {
    id: number;
    nombre: string;
    foto: string | null;
    puesto: string | null;
  };
  cliente?: {
    id: string;
    nombre: string;
    correo_electronico: string;
  };
  solicitud?: PaqueteSolicitud;
  avances_count?: number;
}

export interface PaqueteAvance {
  id: number;
  created_at: string;
  id_asignacion: number;
  autor_tipo: "miembro" | "cliente";
  id_autor: string;
  contenido: string;
  imagenes: string[];
  horas_reportadas: number;
  es_pre_confirmacion: boolean;
  autor_nombre?: string;
  autor_foto?: string;
}

export interface SolicitudStats {
  total: number;
  pendientes: number;
  en_progreso: number;
  completados: number;
}

// =====================================================
// TIER HELPER
// =====================================================

export function calculateTier(horas: number): { descuento: number; tierName: string; tierId: number | null } {
  if (horas >= 50) {
    return { descuento: 20, tierName: "Premium", tierId: 3 };
  } else if (horas >= 25) {
    return { descuento: 10, tierName: "Profesional", tierId: 2 };
  } else {
    return { descuento: 0, tierName: "Basico", tierId: 1 };
  }
}

// =====================================================
// HOOKS - CLIENTE
// =====================================================

export function useClientSolicitudes() {
  const { isAuthenticated } = useAuth();
  const [solicitudes, setSolicitudes] = useState<PaqueteSolicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SolicitudStats>({
    total: 0,
    pendientes: 0,
    en_progreso: 0,
    completados: 0,
  });

  const fetchSolicitudes = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/client/paquete-solicitudes");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar las solicitudes");
      }

      setSolicitudes(data.solicitudes || []);
      setStats(data.stats || { total: 0, pendientes: 0, en_progreso: 0, completados: 0 });
    } catch (err: any) {
      console.error("Error fetching solicitudes:", err?.message);
      setError("Error al cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  return { solicitudes, loading, error, stats, refetch: fetchSolicitudes };
}

export function useCreateSolicitud() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSolicitud = async (data: {
    horas_totales: number;
    notas_cliente?: string;
    asignaciones: {
      id_miembro: number;
      horas_asignadas: number;
      descripcion_tarea?: string;
      dias_semana?: number[];
    }[];
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/client/paquete-solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear la solicitud");
      }

      return { data: result.solicitud, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al crear la solicitud";
      setError(errorMsg);
      return { data: null, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return { createSolicitud, loading, error };
}

export function useSolicitudDetail(id: number | null) {
  const { isAuthenticated } = useAuth();
  const [solicitud, setSolicitud] = useState<PaqueteSolicitud | null>(null);
  const [asignaciones, setAsignaciones] = useState<PaqueteAsignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!isAuthenticated || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/client/paquete-solicitudes/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar la solicitud");
      }

      setSolicitud(data.solicitud);
      setAsignaciones(data.asignaciones || []);
    } catch (err: any) {
      console.error("Error fetching solicitud detail:", err?.message);
      setError("Error al cargar la solicitud");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { solicitud, asignaciones, loading, error, refetch: fetchDetail };
}

// =====================================================
// HOOKS - MIEMBRO
// =====================================================

export function useMemberAsignaciones() {
  const { isAuthenticated } = useAuth();
  const [asignaciones, setAsignaciones] = useState<PaqueteAsignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SolicitudStats>({
    total: 0,
    pendientes: 0,
    en_progreso: 0,
    completados: 0,
  });

  const fetchAsignaciones = useCallback(async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/member/paquete-asignaciones");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar las asignaciones");
      }

      setAsignaciones(data.asignaciones || []);
      setStats(data.stats || { total: 0, pendientes: 0, en_progreso: 0, completados: 0 });
    } catch (err: any) {
      console.error("Error fetching asignaciones:", err?.message);
      setError("Error al cargar las asignaciones");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchAsignaciones();
  }, [fetchAsignaciones]);

  const respondToAsignacion = async (
    asignacionId: number,
    estado: "aprobado" | "rechazado",
    motivo?: string
  ) => {
    try {
      const response = await fetch(`/api/member/paquete-asignaciones/${asignacionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, motivo }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al responder");
      }

      await fetchAsignaciones();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Error al responder" };
    }
  };

  return { asignaciones, loading, error, stats, refetch: fetchAsignaciones, respondToAsignacion };
}

export function useMemberAsignacionDetail(id: number | null) {
  const { isAuthenticated } = useAuth();
  const [asignacion, setAsignacion] = useState<PaqueteAsignacion | null>(null);
  const [avances, setAvances] = useState<PaqueteAvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!isAuthenticated || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/paquete-asignaciones/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar la asignacion");
      }

      setAsignacion(data.asignacion);
      setAvances(data.avances || []);
    } catch (err: any) {
      console.error("Error fetching asignacion detail:", err?.message);
      setError("Error al cargar la asignacion");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return { asignacion, avances, loading, error, refetch: fetchDetail };
}

// =====================================================
// HOOKS - AVANCES (shared)
// =====================================================

export function useAvances(asignacionId: number | null, role: "client" | "member") {
  const { isAuthenticated } = useAuth();
  const [avances, setAvances] = useState<PaqueteAvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchAvances = useCallback(async () => {
    if (!isAuthenticated || !asignacionId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = role === "member"
        ? `/api/member/paquete-asignaciones/${asignacionId}`
        : `/api/client/paquete-solicitudes/0/asignaciones/${asignacionId}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar avances");
      }

      setAvances(data.avances || []);
    } catch (err: any) {
      console.error("Error fetching avances:", err?.message);
      setError("Error al cargar avances");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, asignacionId, role]);

  useEffect(() => {
    fetchAvances();
  }, [fetchAvances]);

  const addAvance = async (data: {
    contenido: string;
    horas_reportadas?: number;
    imagenes?: string[];
  }) => {
    if (!asignacionId) return { error: "Sin ID de asignacion" };

    setSubmitting(true);

    try {
      const endpoint = role === "member"
        ? `/api/member/paquete-asignaciones/${asignacionId}/avances`
        : `/api/client/paquete-solicitudes/0/asignaciones/${asignacionId}/avances`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al agregar avance");
      }

      await fetchAvances();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Error al agregar avance" };
    } finally {
      setSubmitting(false);
    }
  };

  return { avances, loading, error, submitting, refetch: fetchAvances, addAvance };
}

// =====================================================
// HOOKS - PRE-CONFIRM & CONFIRM
// =====================================================

export function usePreConfirm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preConfirm = async (asignacionId: number, contenido?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/paquete-asignaciones/${asignacionId}/pre-confirmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al pre-confirmar");
      }

      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al pre-confirmar";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return { preConfirm, loading, error };
}

export function useConfirmCompletion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmCompletion = async (solicitudId: number, asignacionId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/client/paquete-solicitudes/${solicitudId}/asignaciones/${asignacionId}/confirmar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al confirmar completación");
      }

      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al confirmar completación";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return { confirmCompletion, loading, error };
}

export function useAddAsignacion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addAsignacion = async (
    solicitudId: number,
    data: {
      id_miembro: number;
      horas_asignadas: number;
      descripcion_tarea?: string;
      dias_semana?: number[];
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/client/paquete-solicitudes/${solicitudId}/asignaciones`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al agregar asignación");
      }

      return { data: result.asignacion, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al agregar asignación";
      setError(errorMsg);
      return { data: null, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return { addAsignacion, loading, error };
}
