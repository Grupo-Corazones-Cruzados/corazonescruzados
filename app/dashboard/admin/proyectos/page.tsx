"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Admin.module.css";
import { PROJECT_STATE_LABELS, type ProjectState } from "@/lib/projectStates";

interface Project {
  id: number;
  titulo: string;
  estado: ProjectState;
  tipo_proyecto: string;
  visibilidad: string;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  created_at: string;
  updated_at: string;
  propietario_nombre: string;
  propietario_tipo: string;
  total_postulaciones: number;
  miembros_aceptados: number;
  total_requerimientos: number;
  requerimientos_completados: number;
}

// Icons
const ProjectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SearchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 21h5v-5" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// All possible states for the filter
const ALL_STATES: ProjectState[] = [
  "borrador",
  "publicado",
  "planificado",
  "iniciado",
  "en_progreso",
  "en_implementacion",
  "en_pruebas",
  "completado",
  "completado_parcial",
  "no_completado",
  "cancelado",
  "cancelado_sin_acuerdo",
  "cancelado_sin_presupuesto",
  "no_pagado",
  "no_completado_por_miembro",
];

export default function AdminProyectosPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profile?.rol !== "admin")) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Fetch projects
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.append("search", search);
      if (filterEstado) params.append("estado", filterEstado);

      const response = await fetch(`/api/admin/projects?${params}`);
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        console.error("Error fetching projects:", data.error);
        setProjects([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjects([]);
      setTotalPages(1);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && profile?.rol === "admin") {
      fetchProjects();
    }
  }, [isAuthenticated, profile, page, filterEstado]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && profile?.rol === "admin") {
        setPage(1);
        fetchProjects();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project);
    setShowDeleteModal(true);
    setMessage(null);
  };

  const closeDeleteModal = () => {
    setSelectedProject(null);
    setShowDeleteModal(false);
    setMessage(null);
  };

  const handleDelete = async () => {
    if (!selectedProject) return;

    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/projects?id=${selectedProject.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message || "Proyecto eliminado" });
        // Remove from list
        setProjects(projects.filter((p) => p.id !== selectedProject.id));
        setTotal(total - 1);
        setTimeout(() => closeDeleteModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al eliminar" });
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      setMessage({ type: "error", text: "Error al eliminar proyecto" });
    }
    setDeleting(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatBudget = (min: number | null, max: number | null) => {
    if (!min && !max) return "—";
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    if (min) return `Desde $${min.toLocaleString()}`;
    if (max) return `Hasta $${max.toLocaleString()}`;
    return "—";
  };

  const getStateClass = (estado: ProjectState) => {
    const stateClasses: Record<string, string> = {
      borrador: styles.badgeDefault,
      publicado: styles.badgePrimary,
      planificado: styles.badgeInfo,
      iniciado: styles.badgeInfo,
      en_progreso: styles.badgeWarning,
      en_implementacion: styles.badgeWarning,
      en_pruebas: styles.badgeWarning,
      completado: styles.badgeSuccess,
      completado_parcial: styles.badgeSuccess,
      no_completado: styles.badgeDanger,
      cancelado: styles.badgeDanger,
      cancelado_sin_acuerdo: styles.badgeDanger,
      cancelado_sin_presupuesto: styles.badgeDanger,
      no_pagado: styles.badgeDanger,
      no_completado_por_miembro: styles.badgeDanger,
    };
    return stateClasses[estado] || styles.badgeDefault;
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Cargando...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isAuthenticated || profile?.rol !== "admin") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Gestion de Proyectos</h1>
            <p className={styles.pageSubtitle}>
              Administra todos los proyectos del sistema ({total} proyectos)
            </p>
          </div>
        </header>

        {/* Projects Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <ProjectIcon /> Proyectos
            </h2>
            <div className={styles.sectionActions}>
              <button
                className={styles.iconButton}
                onClick={() => fetchProjects()}
                title="Refrescar"
              >
                <RefreshIcon />
              </button>
            </div>
          </div>
          <div className={styles.sectionBody}>
            {/* Filters */}
            <div className={styles.filtersBar}>
              <div className={styles.searchWrapper}>
                <SearchIcon />
                <input
                  type="text"
                  placeholder="Buscar por titulo o propietario..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className={styles.filterSelect}
                value={filterEstado}
                onChange={(e) => {
                  setFilterEstado(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">Todos los estados</option>
                {ALL_STATES.map((estado) => (
                  <option key={estado} value={estado}>
                    {PROJECT_STATE_LABELS[estado]}
                  </option>
                ))}
              </select>
            </div>

            {/* Projects Table */}
            {projects.length > 0 ? (
              <>
                <div className={styles.tableWrapper}>
                  <table className={styles.usersTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Proyecto</th>
                        <th>Estado</th>
                        <th>Propietario</th>
                        <th>Presupuesto</th>
                        <th>Equipo</th>
                        <th>Progreso</th>
                        <th>Creado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projects.map((project) => (
                        <tr key={project.id}>
                          <td>
                            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                              #{project.id}
                            </span>
                          </td>
                          <td>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{project.titulo}</span>
                              <span className={styles.userEmail}>
                                {project.tipo_proyecto === "miembro" ? "Proyecto de miembro" : "Proyecto de cliente"}
                                {project.visibilidad === "privado" && " (Privado)"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${getStateClass(project.estado)}`}>
                              {PROJECT_STATE_LABELS[project.estado] || project.estado}
                            </span>
                          </td>
                          <td>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{project.propietario_nombre || "—"}</span>
                              <span className={styles.userEmail}>
                                {project.propietario_tipo === "cliente" ? "Cliente" : "Miembro"}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>
                              {formatBudget(project.presupuesto_min, project.presupuesto_max)}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>
                              {project.miembros_aceptados} / {project.total_postulaciones} postulaciones
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>
                              {project.requerimientos_completados} / {project.total_requerimientos} req.
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>{formatDate(project.created_at)}</span>
                          </td>
                          <td>
                            <div className={styles.actionButtons}>
                              <button
                                className={styles.iconButton}
                                onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                                title="Ver proyecto"
                              >
                                <EyeIcon />
                              </button>
                              <a
                                href={`/dashboard/projects/${project.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.iconButton}
                                title="Abrir en nueva pestana"
                              >
                                <ExternalLinkIcon />
                              </a>
                              <button
                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                onClick={() => openDeleteModal(project)}
                                title="Eliminar proyecto"
                              >
                                <TrashIcon />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={styles.pagination}>
                    <button
                      className={styles.pageButton}
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      Anterior
                    </button>
                    <span>
                      Pagina {page} de {totalPages}
                    </span>
                    <button
                      className={styles.pageButton}
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Siguiente
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.emptyState}>
                <ProjectIcon />
                <p>No se encontraron proyectos</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedProject && (
          <div className={styles.modalOverlay} onClick={closeDeleteModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Eliminar Proyecto</h3>
                <button className={styles.iconButton} onClick={closeDeleteModal}>
                  <CloseIcon />
                </button>
              </div>

              {message && (
                <div className={`${styles.modalMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <div className={styles.modalBody}>
                <div
                  className={styles.convertNotice}
                  style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}
                >
                  <p style={{ color: "#ef4444" }}>Eliminar proyecto permanentemente</p>
                  <ul>
                    <li>
                      <strong>Proyecto:</strong> {selectedProject.titulo}
                    </li>
                    <li>
                      <strong>ID:</strong> #{selectedProject.id}
                    </li>
                    <li>
                      <strong>Estado:</strong> {PROJECT_STATE_LABELS[selectedProject.estado]}
                    </li>
                    <li style={{ marginTop: "0.5rem" }}>Esta accion no se puede deshacer</li>
                    <li>Se eliminaran todos los datos asociados:</li>
                    <li style={{ marginLeft: "1rem" }}>- {selectedProject.total_postulaciones} postulaciones</li>
                    <li style={{ marginLeft: "1rem" }}>- {selectedProject.total_requerimientos} requerimientos</li>
                    <li style={{ marginLeft: "1rem" }}>- Mensajes, archivos y solicitudes de cancelacion</li>
                  </ul>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryButton} onClick={closeDeleteModal} disabled={deleting}>
                  Cancelar
                </button>
                <button className={styles.dangerButton} onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Eliminando..." : "Eliminar Proyecto"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
