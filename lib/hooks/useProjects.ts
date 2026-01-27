"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthProvider";

export interface Project {
  id: number;
  created_at: string;
  updated_at: string;
  id_cliente: number;
  id_miembro_asignado: number | null;
  titulo: string;
  descripcion: string | null;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  fecha_limite: string | null;
  estado: string;
  justificacion_cierre: string | null;
  cerrado_por: string | null;
  republicado: boolean;
  cliente?: {
    id: number;
    nombre: string;
    correo_electronico: string;
  };
  miembro_asignado?: {
    id: number;
    nombre: string;
    foto: string | null;
  };
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

  const fetchProject = useCallback(async () => {
    if (!isAuthenticated || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
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

      await fetchProject();
      return { error: null };
    } catch (err) {
      console.error("Error closing convocatoria:", err);
      return { error: "Error al cerrar la convocatoria" };
    }
  };

  const finishWork = async () => {
    if (!id) return { error: "No project ID", proyecto_completado: false };

    try {
      const response = await fetch(`/api/projects/${id}/finish-work`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al marcar trabajo como finalizado");
      }

      await fetchProject();
      return { error: null, proyecto_completado: data.proyecto_completado };
    } catch (err) {
      console.error("Error finishing work:", err);
      return { error: "Error al marcar trabajo como finalizado", proyecto_completado: false };
    }
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
