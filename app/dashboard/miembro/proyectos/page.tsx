"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";
import styles from "@/app/styles/Projects.module.css";

// Icons
const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const FolderIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

interface MemberProject {
  id: number;
  created_at: string;
  updated_at: string;
  titulo: string;
  descripcion: string | null;
  estado: string;
  presupuesto_min: number | null;
  presupuesto_max: number | null;
  fecha_limite: string | null;
  cliente?: { id: number; nombre: string; correo_electronico: string };
  mi_bid_id: number | null;
  mi_bid_estado: string | null;
  mi_precio_ofertado: number | null;
  mi_monto_acordado: number | null;
  mi_confirmado: boolean | null;
  bids_count: number;
  accepted_count: number;
}

interface Stats {
  total: number;
  postulados: number;
  asignados: number;
  completados: number;
  rechazados: number;
}

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "publicado": return styles.statusPublicado;
    case "asignado": return styles.statusAsignado;
    case "planificado": return styles.statusPlanificado;
    case "en_progreso": return styles.statusEnProgreso;
    case "completado": return styles.statusCompletado;
    case "completado_parcial": return styles.statusCompletadoParcial;
    case "no_completado": return styles.statusNoCompletado;
    case "cancelado_sin_acuerdo": return styles.statusCancelado;
    case "cancelado_sin_presupuesto": return styles.statusCancelado;
    case "no_pagado": return styles.statusNoPagado;
    case "no_completado_por_miembro": return styles.statusNoCompletado;
    default: return styles.statusPublicado;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "publicado": return "Publicado";
    case "asignado": return "Asignado";
    case "planificado": return "Planificado";
    case "en_progreso": return "En Progreso";
    case "completado": return "Completado";
    case "completado_parcial": return "Completado Parcial";
    case "no_completado": return "No Completado";
    case "cancelado_sin_acuerdo": return "Cancelado - Sin Acuerdo";
    case "cancelado_sin_presupuesto": return "Cancelado - Sin Presupuesto";
    case "no_pagado": return "No Pagado";
    case "no_completado_por_miembro": return "No Completado por Miembro";
    default: return estado;
  }
};

const getBidStatusLabel = (estado: string | null): string => {
  switch (estado) {
    case "pendiente": return "Postulación Pendiente";
    case "aceptada": return "Postulación Aceptada";
    case "rechazada": return "Postulación Rechazada";
    default: return "";
  }
};

const getBidStatusClass = (estado: string | null): string => {
  switch (estado) {
    case "pendiente": return styles.bidPendiente;
    case "aceptada": return styles.bidAceptada;
    case "rechazada": return styles.bidRechazada;
    default: return "";
  }
};

const formatDate = (dateString: string | null): string => {
  if (!dateString) return "Sin fecha";
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
};

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

function ProjectCard({ project }: { project: MemberProject }) {
  const router = useRouter();
  const isAccepted = project.mi_bid_estado === "aceptada";

  const budgetText = () => {
    if (project.mi_monto_acordado) return formatCurrency(project.mi_monto_acordado);
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

      {/* Show bid status */}
      {project.mi_bid_estado && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <span className={`${styles.bidStatus} ${getBidStatusClass(project.mi_bid_estado)}`}>
            {getBidStatusLabel(project.mi_bid_estado)}
          </span>
          {!isAccepted && project.mi_precio_ofertado && (
            <span style={{ marginLeft: "var(--space-2)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              Oferta: {formatCurrency(project.mi_precio_ofertado)}
            </span>
          )}
        </div>
      )}

      {/* Show monto acordado when accepted */}
      {isAccepted && project.mi_monto_acordado && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--turquoise)", fontWeight: 600 }}>
            Monto acordado: {formatCurrency(project.mi_monto_acordado)}
          </span>
        </div>
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

        {project.cliente && project.cliente.id && (
          <span className={styles.metaItem}>
            <UserIcon />
            {project.cliente.nombre}
          </span>
        )}
      </div>
    </article>
  );
}

export default function MisProyectosPage() {
  const { profile, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<MemberProject[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, postulados: 0, asignados: 0, completados: 0, rechazados: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", categoria: "todos" });

  // Redirect non-members
  React.useEffect(() => {
    if (!authLoading && (!isAuthenticated || (profile?.rol !== "miembro" && profile?.rol !== "admin"))) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  const fetchProjects = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/member/projects");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error al cargar");
      setProjects(data.projects || []);
      setStats(data.stats || { total: 0, postulados: 0, asignados: 0, completados: 0, rechazados: 0 });
    } catch (err) {
      console.error("Error fetching member projects:", err);
      setError("Error al cargar los proyectos");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const match = p.titulo.toLowerCase().includes(s) || p.descripcion?.toLowerCase().includes(s);
        if (!match) return false;
      }

      if (filters.categoria === "todos") return true;
      if (filters.categoria === "postulados") {
        return p.mi_bid_estado === "pendiente";
      }
      if (filters.categoria === "asignados") {
        return p.mi_bid_estado === "aceptada" && ["publicado", "planificado", "en_progreso"].includes(p.estado);
      }
      if (filters.categoria === "completados") {
        return p.mi_bid_estado === "aceptada" && ["completado", "completado_parcial"].includes(p.estado);
      }
      if (filters.categoria === "rechazados") {
        return p.mi_bid_estado === "rechazada";
      }
      return true;
    });
  }, [projects, filters]);

  if (authLoading || (!isAuthenticated && !profile)) {
    return (
      <DashboardLayout>
        <div className={ticketStyles.loadingState}>
          <div className={ticketStyles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={ticketStyles.pageHeader}>
          <div>
            <h1 className={ticketStyles.pageTitle}>Mis Proyectos</h1>
            <p className={ticketStyles.pageSubtitle}>
              Proyectos en los que has postulado o estás participando
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className={ticketStyles.statsGrid}>
          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconTotal}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{stats.total}</div>
              <div className={ticketStyles.statLabel}>Total</div>
            </div>
          </div>

          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconPending}`}>
              <ClockIcon />
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{stats.postulados}</div>
              <div className={ticketStyles.statLabel}>Postulados</div>
            </div>
          </div>

          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconActive}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" />
                <path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" />
                <path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
              </svg>
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{stats.asignados}</div>
              <div className={ticketStyles.statLabel}>Activos</div>
            </div>
          </div>

          <div className={ticketStyles.statCard}>
            <div className={`${ticketStyles.statIcon} ${ticketStyles.statIconCompleted}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={ticketStyles.statContent}>
              <div className={ticketStyles.statValue}>{stats.completados}</div>
              <div className={ticketStyles.statLabel}>Completados</div>
            </div>
          </div>
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
            value={filters.categoria}
            onChange={(e) => setFilters({ ...filters, categoria: e.target.value })}
          >
            <option value="todos">Todos</option>
            <option value="postulados">Postulaciones Pendientes</option>
            <option value="asignados">Activos (Asignado / En Progreso)</option>
            <option value="completados">Completados</option>
            <option value="rechazados">Rechazados</option>
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
            <button className={ticketStyles.secondaryButton} onClick={() => fetchProjects()}>
              Reintentar
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className={ticketStyles.emptyState}>
            <FolderIcon />
            <h3 className={ticketStyles.emptyTitle}>
              {filters.search || filters.categoria !== "todos"
                ? "No se encontraron proyectos"
                : "No tienes proyectos"}
            </h3>
            <p className={ticketStyles.emptyText}>
              {filters.search || filters.categoria !== "todos"
                ? "Intenta con otros filtros de búsqueda"
                : "Los proyectos en los que postules o participes aparecerán aquí"}
            </p>
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
