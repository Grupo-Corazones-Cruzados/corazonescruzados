"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";

export interface PackagePurchase {
  id: number;
  id_cliente: string; // UUID
  id_miembro: number;
  id_paquete: number;
  estado: string;
  horas_totales: number;
  horas_consumidas: number;
  horas_restantes: number;
  fecha_respuesta: string | null;
  motivo_rechazo: string | null;
  motivo_espera: string | null;
  notas_cliente: string | null;
  created_at: string;
  updated_at: string;
  fecha_cierre: string | null;
  reporte_cierre: string | null;
  paquete: {
    id: number;
    nombre: string;
    horas: number;
    descripcion: string | null;
    contenido?: string | null;
  };
  miembro?: {
    id: number;
    nombre: string;
    foto: string | null;
    puesto: string | null;
    costo?: number | null;
  };
  cliente?: {
    id: string; // UUID
    nombre: string;
    correo_electronico: string;
  };
}

export interface PackageSession {
  id: number;
  id_purchase: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  duracion_horas: number;
  estado: string;
  notas_miembro: string | null;
  notas_cliente: string | null;
  fecha_completada: string | null;
  cambio_solicitado: boolean;
  motivo_cambio: string | null;
  nueva_fecha_propuesta: string | null;
  nueva_hora_propuesta: string | null;
  created_at: string;
}

export interface PackageAvailability {
  id: number;
  id_purchase: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
  activo: boolean;
}

export interface PackageStats {
  total: number;
  pendientes: number;
  activos: number;
  completados: number;
}

export interface PackageFilters {
  estado: string;
  miembro?: number | null;
  cliente?: string | null; // UUID
}

// Hook for client packages
export function useClientPackages() {
  const { isAuthenticated } = useAuth();
  const [purchases, setPurchases] = useState<PackagePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PackageStats>({
    total: 0,
    pendientes: 0,
    activos: 0,
    completados: 0,
  });

  const fetchPackages = useCallback(async (filters?: PackageFilters) => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.estado && filters.estado !== "todos") {
        params.append("estado", filters.estado);
      }
      if (filters?.miembro) {
        params.append("miembro", filters.miembro.toString());
      }

      const response = await fetch(`/api/client/packages?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar los paquetes");
      }

      setPurchases(data.purchases || []);
      setStats(data.stats || {
        total: 0,
        pendientes: 0,
        activos: 0,
        completados: 0,
      });
    } catch (err: any) {
      console.error("Error fetching packages:", err?.message);
      setError("Error al cargar los paquetes");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  return {
    purchases,
    loading,
    error,
    stats,
    refetch: fetchPackages,
  };
}

// Hook for member packages
export function useMemberPackages() {
  const { isAuthenticated } = useAuth();
  const [purchases, setPurchases] = useState<PackagePurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<PackageStats>({
    total: 0,
    pendientes: 0,
    activos: 0,
    completados: 0,
  });

  const fetchPackages = useCallback(async (filters?: PackageFilters) => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.estado && filters.estado !== "todos") {
        params.append("estado", filters.estado);
      }
      if (filters?.cliente) {
        params.append("cliente", filters.cliente.toString());
      }

      const response = await fetch(`/api/member/packages?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar los paquetes");
      }

      setPurchases(data.purchases || []);
      setStats(data.stats || {
        total: 0,
        pendientes: 0,
        activos: 0,
        completados: 0,
      });
    } catch (err: any) {
      console.error("Error fetching packages:", err?.message);
      setError("Error al cargar los paquetes");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const respondToPackage = async (
    purchaseId: number,
    estado: "aprobado" | "rechazado" | "en_espera",
    motivo?: string
  ) => {
    try {
      const response = await fetch(`/api/member/packages/${purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, motivo }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al responder");
      }

      await fetchPackages();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Error al responder" };
    }
  };

  return {
    purchases,
    loading,
    error,
    stats,
    refetch: fetchPackages,
    respondToPackage,
  };
}

// Hook for single package detail
export function usePackageDetail(id: number | null, role: "client" | "member") {
  const { isAuthenticated } = useAuth();
  const [purchase, setPurchase] = useState<PackagePurchase | null>(null);
  const [sessions, setSessions] = useState<PackageSession[]>([]);
  const [availability, setAvailability] = useState<PackageAvailability[]>([]);
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
      const endpoint = role === "client"
        ? `/api/client/packages/${id}`
        : `/api/member/packages/${id}`;

      const response = await fetch(endpoint);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar el paquete");
      }

      setPurchase(data.purchase);
      setSessions(data.sessions || []);
      setAvailability(data.availability || []);
    } catch (err: any) {
      console.error("Error fetching package detail:", err?.message);
      setError("Error al cargar el paquete");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, id, role]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  return {
    purchase,
    sessions,
    availability,
    loading,
    error,
    refetch: fetchDetail,
  };
}

// Hook for scheduling sessions
export function usePackageSessions(purchaseId: number | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scheduleSession = async (data: {
    fecha: string;
    hora_inicio: string;
    hora_fin: string;
    notas?: string;
  }) => {
    if (!purchaseId) return { error: "No purchase ID" };

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/packages/${purchaseId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al agendar la sesion");
      }

      return { data: result.session, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al agendar la sesion";
      setError(errorMsg);
      return { data: null, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const updateSession = async (
    sessionId: number,
    action: string,
    data?: Record<string, any>
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/packages/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar la sesion");
      }

      return { data: result, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al actualizar la sesion";
      setError(errorMsg);
      return { data: null, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async (sessionId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/packages/sessions/${sessionId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al cancelar la sesion");
      }

      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al cancelar la sesion";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    scheduleSession,
    updateSession,
    cancelSession,
  };
}

// Hook for available slots
export function useAvailableSlots(purchaseId: number | null) {
  const [slots, setSlots] = useState<{ hora_inicio: string; hora_fin: string; disponible: boolean }[]>([]);
  const [horasDisponibles, setHorasDisponibles] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlots = useCallback(async (fecha: string) => {
    if (!purchaseId || !fecha) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/packages/${purchaseId}/available-slots?fecha=${fecha}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar slots");
      }

      setSlots(data.slots || []);
      setHorasDisponibles(data.horasDisponibles || 0);
    } catch (err: any) {
      console.error("Error fetching slots:", err?.message);
      setError("Error al cargar slots disponibles");
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  return {
    slots,
    horasDisponibles,
    loading,
    error,
    fetchSlots,
  };
}

// Hook for package purchase
export function usePurchasePackage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const purchasePackage = async (data: {
    id_miembro: number;
    id_paquete: number;
    notas?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/packages/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al comprar el paquete");
      }

      return { data: result.purchase, error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al comprar el paquete";
      setError(errorMsg);
      return { data: null, error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    purchasePackage,
    loading,
    error,
  };
}

// Hook for package availability management (member)
export function usePackageAvailability(purchaseId: number | null) {
  const [availability, setAvailability] = useState<PackageAvailability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailability = useCallback(async () => {
    if (!purchaseId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/packages/${purchaseId}/availability`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar disponibilidad");
      }

      setAvailability(data.availability || []);
    } catch (err: any) {
      console.error("Error fetching availability:", err?.message);
      setError("Error al cargar disponibilidad");
    } finally {
      setLoading(false);
    }
  }, [purchaseId]);

  const setAvailabilitySlots = async (
    slots: { dia_semana: number; hora_inicio: string; hora_fin: string; activo?: boolean }[]
  ) => {
    if (!purchaseId) return { error: "No purchase ID" };

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/packages/${purchaseId}/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al guardar disponibilidad");
      }

      setAvailability(data.availability || []);
      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al guardar disponibilidad";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  const deleteSlot = async (slotId: number) => {
    if (!purchaseId) return { error: "No purchase ID" };

    try {
      const response = await fetch(
        `/api/member/packages/${purchaseId}/availability?slotId=${slotId}`,
        { method: "DELETE" }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar slot");
      }

      await fetchAvailability();
      return { error: null };
    } catch (err: any) {
      return { error: err.message || "Error al eliminar slot" };
    }
  };

  useEffect(() => {
    if (purchaseId) {
      fetchAvailability();
    }
  }, [purchaseId, fetchAvailability]);

  return {
    availability,
    loading,
    error,
    refetch: fetchAvailability,
    setAvailabilitySlots,
    deleteSlot,
  };
}

// Hook for closing a package (member)
export function useClosePackage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closePackage = async (purchaseId: number, reporte?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/packages/${purchaseId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reporte }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cerrar el paquete");
      }

      return { error: null };
    } catch (err: any) {
      const errorMsg = err.message || "Error al cerrar el paquete";
      setError(errorMsg);
      return { error: errorMsg };
    } finally {
      setLoading(false);
    }
  };

  return {
    closePackage,
    loading,
    error,
  };
}
