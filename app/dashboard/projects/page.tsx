"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useProjects, Project } from "@/lib/hooks/useProjects";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";
import styles from "@/app/styles/Projects.module.css";

// Icons
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const UsersIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FolderIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "publicado":
      return styles.statusPublicado;
    case "asignado":
      return styles.statusAsignado;
    case "en_progreso":
      return styles.statusEnProgreso;
    case "completado":
      return styles.statusCompletado;
    case "cancelado":
      return styles.statusCancelado;
    default:
      return styles.statusPublicado;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "publicado":
      return "Publicado";
    case "asignado":
      return "Asignado";
    case "en_progreso":
      return "En Progreso";
    case "completado":
      return "Completado";
    case "cancelado":
      return "Cancelado";
    default:
      return estado;
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();

  const budgetText = () => {
    if (project.presupuesto_min && project.presupuesto_max) {
      return `${formatCurrency(project.presupuesto_min)} - ${formatCurrency(project.presupuesto_max)}`;
    } else if (project.presupuesto_min) {
      return `Desde ${formatCurrency(project.presupuesto_min)}`;
    } else if (project.presupuesto_max) {
      return `Hasta ${formatCurrency(project.presupuesto_max)}`;
    }
    return "Presupuesto abierto";
  };

  return (
    <article
      className={styles.projectCard}
      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/projects/${project.id}`);
        }
      }}
    >
      <div className={styles.projectHeader}>
        <h3 className={styles.projectTitle}>{project.titulo}</h3>
        <span className={`${styles.projectStatus} ${getStatusClass(project.estado)}`}>
          {getStatusLabel(project.estado)}
        </span>
      </div>

      {project.descripcion && (
        <p className={styles.projectDescription}>{project.descripcion}</p>
      )}

      <div className={styles.projectMeta}>
        <span className={`${styles.metaItem} ${styles.projectBudget}`}>
          {budgetText()}
        </span>

        {project.fecha_limite && (
          <span className={styles.metaItem}>
            <CalendarIcon />
            {formatDate(project.fecha_limite)}
          </span>
        )}

        {project.cliente && (
          <span className={styles.metaItem}>
            <UsersIcon />
            {project.cliente.nombre}
          </span>
        )}
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const { profile } = useAuth();
  const { projects, loading, error, refetch } = useProjects();
  const [filters, setFilters] = useState({
    search: "",
    estado: "todos",
  });

  const userRole = profile?.rol || "cliente";

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesSearch =
        project.titulo.toLowerCase().includes(searchLower) ||
        project.descripcion?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    if (filters.estado !== "todos" && project.estado !== filters.estado) {
      return false;
    }

    return true;
  });

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={ticketStyles.pageHeader}>
          <div>
            <h1 className={ticketStyles.pageTitle}>Proyectos</h1>
            <p className={ticketStyles.pageSubtitle}>
              {userRole === "cliente"
                ? "Publica proyectos y recibe postulaciones"
                : "Explora proyectos disponibles y postula"}
            </p>
          </div>
          {userRole === "cliente" && (
            <Link href="/dashboard/projects/new" className={ticketStyles.primaryButton}>
              <PlusIcon />
              Nuevo Proyecto
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className={ticketStyles.filtersBar}>
          <input
            type="text"
            placeholder="Buscar proyectos..."
            className={ticketStyles.searchInput}
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />

          <select
            className={ticketStyles.filterSelect}
            value={filters.estado}
            onChange={(e) => setFilters({ ...filters, estado: e.target.value })}
          >
            <option value="todos">Todos los estados</option>
            <option value="publicado">Publicado</option>
            <option value="asignado">Asignado</option>
            <option value="en_progreso">En Progreso</option>
            <option value="completado">Completado</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className={ticketStyles.loadingState}>
            <div className={ticketStyles.spinner} />
            <p style={{ color: "var(--text-muted)" }}>Cargando proyectos...</p>
          </div>
        ) : error ? (
          <div className={ticketStyles.emptyState}>
            <p style={{ color: "var(--primary-red)" }}>{error}</p>
            <button className={ticketStyles.secondaryButton} onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className={ticketStyles.emptyState}>
            <FolderIcon />
            <h3 className={ticketStyles.emptyTitle}>
              {filters.search || filters.estado !== "todos"
                ? "No se encontraron proyectos"
                : "No hay proyectos"}
            </h3>
            <p className={ticketStyles.emptyText}>
              {filters.search || filters.estado !== "todos"
                ? "Intenta con otros filtros de búsqueda"
                : userRole === "cliente"
                ? "Crea tu primer proyecto para comenzar"
                : "No hay proyectos disponibles"}
            </p>
            {userRole === "cliente" && !filters.search && filters.estado === "todos" && (
              <Link href="/dashboard/projects/new" className={ticketStyles.primaryButton}>
                <PlusIcon />
                Crear Proyecto
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.projectsGrid}>
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
