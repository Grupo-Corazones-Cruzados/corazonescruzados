"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/AuthProvider";

export interface Project {
  id: number;
  created_at: string;
  updated_at: string;
  id_cliente: number | null;
  id_miembro_asignado: number | null;
  id_miembro_propietario: number | null;
  titulo: string;
  descripcion: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  fecha_limite: string | null;
  estado: string;
  justificacion_cierre: string | null;
  cerrado_por: string | null;
  republicado: boolean;
  tipo_proyecto: "cliente" | "miembro";
  visibilidad: "privado" | "publico";
  es_propietario?: boolean;
  cliente?: {
    id: number;
    nombre: string;
    correo_electronico: string;
  } | null;
  miembro_asignado?: {
    id: number;
    nombre: string;
    foto: string | null;
  } | null;
  miembro_propietario?: {
    id: number;
    nombre: string;
    foto: string | null;
    puesto: string | null;
  } | null;
  bids_count?: number;
}

export interface ProjectBid {
  id: number;
  created_at: string;
  id_project: number;
  id_miembro: number;
  propuesta: string;
  precio_ofertado: number;
  tiempo_estimado_dias: number | null;
  estado: string;
  imagenes: string[];
  monto_acordado: number | null;
  fecha_aceptacion: string | null;
  confirmado_por_miembro: boolean | null;
  fecha_confirmacion: string | null;
  miembro?: {
    id: number;
    nombre: string;
    foto: string | null;
    puesto: string | null;
  };
}

export interface ProjectRequirement {
  id: number;
  created_at: string;
  id_project: number;
  titulo: string;
  descripcion: string | null;
  costo: number | null;
  completado: boolean;
  fecha_completado: string | null;
  creado_por: "cliente" | "miembro";
  es_adicional: boolean;
  completado_por: number | null;
  miembro_completado?: {
    id: number;
    nombre: string;
    foto: string | null;
  } | null;
  creado_por_miembro_id: number | null;
  creado_por_cliente_id: number | null;
  creador?: {
    id: number;
    nombre: string;
    foto: string | null;
    tipo: "miembro" | "cliente";
  } | null;
}

export function useProjects() {
  const { isAuthenticated } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async (filters?: { estado?: string; search?: string }) => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.estado && filters.estado !== "todos") params.append("estado", filters.estado);
      if (filters?.search) params.append("search", filters.search);

      const response = await fetch(`/api/projects?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar los proyectos");
      }

      setProjects(data.projects || []);
    } catch (err) {
      console.error("Error fetching projects:", err);
      setError("Error al cargar los proyectos");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
  };
}

export interface AcceptedMember {
  bid_id: number;
  monto_acordado: number | null;
  confirmado_por_miembro: boolean | null;
  fecha_confirmacion: string | null;
  trabajo_finalizado: boolean;
  fecha_trabajo_finalizado: string | null;
  miembro: {
    id: number;
    nombre: string;
    foto: string | null;
    puesto: string | null;
  };
}

export function useProject(id: number | null) {
  const { isAuthenticated } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [bids, setBids] = useState<ProjectBid[]>([]);
  const [requirements, setRequirements] = useState<ProjectRequirement[]>([]);
  const [acceptedMembers, setAcceptedMembers] = useState<AcceptedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialLoadDone = useRef(false);

  const fetchProject = useCallback(async (silent?: boolean) => {
    if (!isAuthenticated || !id) {
      setLoading(false);
      return;
    }

    if (!silent && !initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/projects/${id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cargar el proyecto");
      }

      setProject(data.project);
      setBids(data.bids || []);
      setRequirements(data.requirements || []);
      setAcceptedMembers(data.accepted_members || []);
      initialLoadDone.current = true;
    } catch (err) {
      console.error("Error fetching project:", err);
      setError("Error al cargar el proyecto");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const updateProject = async (updates: Partial<Project>) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar el proyecto");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error updating project:", err);
      return { error: "Error al actualizar el proyecto" };
    }
  };

  const acceptBid = async (bidId: number, montoAcordado: number) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/bids`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId, action: "accept", monto_acordado: montoAcordado }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al aceptar la postulación");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error accepting bid:", err);
      return { error: "Error al aceptar la postulación" };
    }
  };

  const confirmParticipation = async (action: "confirm" | "cancel") => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al confirmar participación");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error confirming participation:", err);
      return { error: "Error al confirmar participación" };
    }
  };

  const planifyProject = async () => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "planificar" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al planificar el proyecto");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error planifying project:", err);
      return { error: "Error al planificar el proyecto" };
    }
  };

  const startProject = async () => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "iniciar" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al iniciar el proyecto");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error starting project:", err);
      return { error: "Error al iniciar el proyecto" };
    }
  };

  const completeProject = async (estado: string, justificacion?: string) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, justificacion }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cerrar el proyecto");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error completing project:", err);
      return { error: "Error al cerrar el proyecto" };
    }
  };

  const addRequirement = async (data: { titulo: string; descripcion?: string; costo?: number; es_adicional?: boolean }) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/requirements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al agregar el requerimiento");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error adding requirement:", err);
      return { error: "Error al agregar el requerimiento" };
    }
  };

  const updateRequirement = async (reqId: number, updates: Partial<ProjectRequirement>) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/requirements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId: reqId, ...updates }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al actualizar el requerimiento");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error updating requirement:", err);
      return { error: "Error al actualizar el requerimiento" };
    }
  };

  const deleteRequirement = async (reqId: number) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/requirements?requirementId=${reqId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al eliminar el requerimiento");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error deleting requirement:", err);
      return { error: "Error al eliminar el requerimiento" };
    }
  };

  const republishProject = async (titulo: string, descripcion: string) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/republish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descripcion }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al republicar el proyecto");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error republishing project:", err);
      return { error: "Error al republicar el proyecto" };
    }
  };

  const closeConvocatoria = async () => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/republish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cerrar_convocatoria" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al cerrar la convocatoria");
      }

      await fetchProject(true);
      return { error: null };
    } catch (err) {
      console.error("Error closing convocatoria:", err);
      return { error: "Error al cerrar la convocatoria" };
    }
  };

  const finishWork = async (miembroId: number): Promise<{ error: string | null; proyecto_completado: boolean }> => {
    if (!id) return { error: "No project ID", proyecto_completado: false };

    const response = await fetch(`/api/projects/${id}/finish-work`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || `Error ${response.status}`, proyecto_completado: false };
    }

    if (data.proyecto_completado) {
      setProject(prev => prev ? { ...prev, estado: "completado" } : prev);
    }

    // Always update acceptedMembers directly — no refetch
    const wasUndone = data.undone === true;
    setAcceptedMembers(prev => prev.map(m => {
      const isCurrentMember = m.miembro.id == miembroId;
      return isCurrentMember
        ? {
            ...m,
            trabajo_finalizado: !wasUndone,
            fecha_trabajo_finalizado: wasUndone ? null : new Date().toISOString(),
          }
        : m;
    }));

    return { error: null, proyecto_completado: data.proyecto_completado || false };
  };

  return {
    project,
    bids,
    requirements,
    acceptedMembers,
    loading,
    error,
    refetch: fetchProject,
    updateProject,
    acceptBid,
    confirmParticipation,
    planifyProject,
    startProject,
    completeProject,
    addRequirement,
    updateRequirement,
    deleteRequirement,
    republishProject,
    closeConvocatoria,
    finishWork,
  };
}

export function useCreateProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = async (data: {
    id_cliente: number;
    titulo: string;
    descripcion?: string;
    presupuesto_min?: number;
    presupuesto_max?: number;
    fecha_limite?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el proyecto");
      }

      return { data: result.project, error: null };
    } catch (err) {
      console.error("Error creating project:", err);
      const errorMessage = "Error al crear el proyecto";
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createProject,
    loading,
    error,
  };
}

export function useSubmitBid() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitBid = async (data: {
    id_project: number;
    id_miembro: number;
    propuesta: string;
    precio_ofertado: number;
    tiempo_estimado_dias?: number;
    imagenes?: string[];
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${data.id_project}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al enviar la postulación");
      }

      return { data: result.bid, error: null };
    } catch (err) {
      console.error("Error submitting bid:", err);
      const errorMessage = "Error al enviar la postulación";
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    submitBid,
    loading,
    error,
  };
}

export function useCreateMemberProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = async (data: {
    titulo: string;
    descripcion?: string;
    visibilidad?: "privado" | "publico";
    presupuesto_min?: number;
    presupuesto_max?: number;
    fecha_limite?: string;
    id_cliente?: number;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/member/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al crear el proyecto");
      }

      return { data: result.project, error: null };
    } catch (err) {
      console.error("Error creating member project:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al crear el proyecto";
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    createProject,
    loading,
    error,
  };
}

export function useUpdateMemberProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateProject = async (
    projectId: number,
    data: {
      titulo?: string;
      descripcion?: string;
      visibilidad?: "privado" | "publico";
      presupuesto_min?: number;
      presupuesto_max?: number;
      fecha_limite?: string;
      id_cliente?: number | null;
    }
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al actualizar el proyecto");
      }

      return { data: result.project, error: null };
    } catch (err) {
      console.error("Error updating member project:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al actualizar el proyecto";
      setError(errorMessage);
      return { data: null, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    updateProject,
    loading,
    error,
  };
}

export function useDeleteMemberProject() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteProject = async (projectId: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/member/projects/${projectId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al eliminar el proyecto");
      }

      return { error: null };
    } catch (err) {
      console.error("Error deleting member project:", err);
      const errorMessage = err instanceof Error ? err.message : "Error al eliminar el proyecto";
      setError(errorMessage);
      return { error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  return {
    deleteProject,
    loading,
    error,
  };
}

export interface ClientSearchResult {
  id: number;
  nombre: string;
  correo_electronico: string;
}

export function useSearchClients() {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchClients = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setClients([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/clients/search?q=${encodeURIComponent(query.trim())}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al buscar clientes");
      }

      setClients(result.clients || []);
    } catch (err) {
      console.error("Error searching clients:", err);
      setError("Error al buscar clientes");
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const clearClients = () => {
    setClients([]);
  };

  return {
    searchClients,
    clearClients,
    clients,
    loading,
    error,
  };
}
