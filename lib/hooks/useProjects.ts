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

export function useProject(id: number | null) {
  const { isAuthenticated } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [bids, setBids] = useState<ProjectBid[]>([]);
  const [requirements, setRequirements] = useState<ProjectRequirement[]>([]);
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

  const acceptBid = async (bidId: number) => {
    if (!id) return { error: "No project ID" };

    try {
      const response = await fetch(`/api/projects/${id}/bids`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId, action: "accept" }),
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

  const addRequirement = async (data: { titulo: string; descripcion?: string; costo?: number }) => {
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

  return {
    project,
    bids,
    requirements,
    loading,
    error,
    refetch: fetchProject,
    updateProject,
    acceptBid,
    addRequirement,
    updateRequirement,
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
