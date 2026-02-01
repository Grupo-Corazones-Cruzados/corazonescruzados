"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import { useCreateMemberProject, useSearchClients, ClientSearchResult } from "@/lib/hooks/useProjects";
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

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const GlobeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
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
  tipo_proyecto: "cliente" | "miembro";
  visibilidad: "privado" | "publico";
  cliente?: { id: number; nombre: string; correo_electronico: string } | null;
  miembro_propietario?: { id: number; nombre: string; foto: string | null; puesto: string | null } | null;
  mi_bid_id: number | null;
  mi_bid_estado: string | null;
  mi_precio_ofertado: number | null;
  mi_monto_acordado: number | null;
  mi_confirmado: boolean | null;
  bids_count: number;
  accepted_count: number;
  es_propietario: boolean;
}

interface Stats {
  total: number;
  postulados: number;
  asignados: number;
  completados: number;
  rechazados: number;
  cancelados: number;
  propios: number;
  propios_privados: number;
  propios_publicos: number;
}

type TabType = "todos" | "propios" | "postulaciones";

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "publicado": return styles.statusPublicado;
    case "asignado": return styles.statusAsignado;
    case "planificado": return styles.statusPlanificado;
    case "borrador": return styles.statusBorrador;
    case "iniciado": return styles.statusIniciado;
    case "en_progreso": return styles.statusEnProgreso;
    case "en_implementacion": return styles.statusEnImplementacion;
    case "en_pruebas": return styles.statusEnPruebas;
    case "completado": return styles.statusCompletado;
    case "completado_parcial": return styles.statusCompletadoParcial;
    case "no_completado": return styles.statusNoCompletado;
    case "cancelado": return styles.statusCancelado;
    case "cancelado_sin_acuerdo": return styles.statusCancelado;
    case "cancelado_sin_presupuesto": return styles.statusCancelado;
    case "no_pagado": return styles.statusNoPagado;
    case "no_completado_por_miembro": return styles.statusNoCompletado;
    default: return styles.statusPublicado;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "borrador": return "Borrador";
    case "publicado": return "Publicado";
    case "asignado": return "Asignado";
    case "planificado": return "Planificado";
    case "iniciado": return "Iniciado";
    case "en_progreso": return "En Progreso";
    case "en_implementacion": return "En Implementacion";
    case "en_pruebas": return "En Pruebas";
    case "completado": return "Completado";
    case "completado_parcial": return "Completado Parcial";
    case "no_completado": return "No Completado";
    case "cancelado": return "Cancelado";
    case "cancelado_sin_acuerdo": return "Cancelado - Sin Acuerdo";
    case "cancelado_sin_presupuesto": return "Cancelado - Sin Presupuesto";
    case "no_pagado": return "No Pagado";
    case "no_completado_por_miembro": return "No Completado por Miembro";
    default: return estado;
  }
};

const getBidStatusLabel = (estado: string | null): string => {
  switch (estado) {
    case "pendiente": return "Postulacion Pendiente";
    case "aceptada": return "Postulacion Aceptada";
    case "rechazada": return "Postulacion Rechazada";
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
  const isOwner = project.es_propietario;

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
      onClick={() => router.push(`/dashboard/projects/${project.id}?from=miembro`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/projects/${project.id}?from=miembro`);
        }
      }}
    >
      <div className={styles.projectHeader}>
        <h3 className={styles.projectTitle}>{project.titulo}</h3>
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", alignItems: "center" }}>
          {/* Visibility badge for own projects */}
          {isOwner && (
            <span className={`${styles.visibilityBadge} ${project.visibilidad === "privado" ? styles.visibilityPrivado : styles.visibilityPublico}`}>
              {project.visibilidad === "privado" ? <><LockIcon /> Privado</> : <><GlobeIcon /> Publico</>}
            </span>
          )}
          <span className={`${styles.projectStatus} ${getStatusClass(project.estado)}`}>
            {getStatusLabel(project.estado)}
          </span>
        </div>
      </div>

      {project.descripcion && (
        <p className={styles.projectDescription}>{project.descripcion}</p>
      )}

      {/* Show owner badge if this is my project */}
      {isOwner && (
        <div style={{ marginBottom: "var(--space-3)" }}>
          <span className={styles.ownerBadge}>Mi Proyecto</span>
        </div>
      )}

      {/* Show bid status for projects where I bid (not my own) */}
      {!isOwner && project.mi_bid_estado && (
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
  const [stats, setStats] = useState<Stats>({
    total: 0, postulados: 0, asignados: 0, completados: 0, rechazados: 0, cancelados: 0,
    propios: 0, propios_privados: 0, propios_publicos: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: "", categoria: "todos" });
  const [activeTab, setActiveTab] = useState<TabType>("todos");

  // Create project modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProject, setNewProject] = useState({
    titulo: "",
    descripcion: "",
    visibilidad: "privado" as "privado" | "publico",
    presupuesto_min: "",
    presupuesto_max: "",
    fecha_limite: "",
    id_cliente: null as number | null,
  });
  const [selectedClient, setSelectedClient] = useState<ClientSearchResult | null>(null);
  const [clientSearchQuery, setClientSearchQuery] = useState("");

  const { createProject, loading: creatingProject } = useCreateMemberProject();
  const { searchClients, clearClients, clients: clientResults, loading: searchingClients } = useSearchClients();

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
      setStats(data.stats || {
        total: 0, postulados: 0, asignados: 0, completados: 0, rechazados: 0, cancelados: 0,
        propios: 0, propios_privados: 0, propios_publicos: 0
      });
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

  // Client search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (clientSearchQuery.trim().length >= 2) {
        searchClients(clientSearchQuery);
      } else {
        clearClients();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [clientSearchQuery, searchClients, clearClients]);

  // Filter projects by tab and search
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Filter by tab
    if (activeTab === "propios") {
      filtered = filtered.filter((p) => p.es_propietario === true);
    } else if (activeTab === "postulaciones") {
      filtered = filtered.filter((p) => !p.es_propietario && p.mi_bid_id !== null);
    }

    // Filter by search
    if (filters.search) {
      const s = filters.search.toLowerCase();
      filtered = filtered.filter((p) =>
        p.titulo.toLowerCase().includes(s) || p.descripcion?.toLowerCase().includes(s)
      );
    }

    // Filter by category
    if (filters.categoria !== "todos") {
      if (filters.categoria === "postulados") {
        filtered = filtered.filter((p) => p.mi_bid_estado === "pendiente");
      } else if (filters.categoria === "asignados") {
        filtered = filtered.filter((p) =>
          p.mi_bid_estado === "aceptada" && ["publicado", "planificado", "en_progreso"].includes(p.estado)
        );
      } else if (filters.categoria === "completados") {
        filtered = filtered.filter((p) =>
          p.mi_bid_estado === "aceptada" && ["completado", "completado_parcial"].includes(p.estado)
        );
      } else if (filters.categoria === "rechazados") {
        filtered = filtered.filter((p) => p.mi_bid_estado === "rechazada");
      } else if (filters.categoria === "privados") {
        filtered = filtered.filter((p) => p.es_propietario && p.visibilidad === "privado");
      } else if (filters.categoria === "publicos") {
        filtered = filtered.filter((p) => p.es_propietario && p.visibilidad === "publico");
      } else if (filters.categoria === "cancelados") {
        filtered = filtered.filter((p) =>
          ["cancelado", "cancelado_sin_acuerdo", "cancelado_sin_presupuesto"].includes(p.estado)
        );
      }
    }

    return filtered;
  }, [projects, filters, activeTab]);

  const handleCreateProject = async () => {
    if (!newProject.titulo.trim()) return;

    const result = await createProject({
      titulo: newProject.titulo.trim(),
      descripcion: newProject.descripcion.trim() || undefined,
      visibilidad: newProject.visibilidad,
      presupuesto_min: newProject.presupuesto_min ? parseFloat(newProject.presupuesto_min) : undefined,
      presupuesto_max: newProject.presupuesto_max ? parseFloat(newProject.presupuesto_max) : undefined,
      fecha_limite: newProject.fecha_limite || undefined,
      id_cliente: newProject.id_cliente || undefined,
    });

    if (!result.error && result.data) {
      setShowCreateModal(false);
      resetNewProjectForm();
      fetchProjects();
    } else {
      alert(result.error || "Error al crear el proyecto");
    }
  };

  const resetNewProjectForm = () => {
    setNewProject({
      titulo: "",
      descripcion: "",
      visibilidad: "privado",
      presupuesto_min: "",
      presupuesto_max: "",
      fecha_limite: "",
      id_cliente: null,
    });
    setSelectedClient(null);
    setClientSearchQuery("");
    clearClients();
  };

  const handleSelectClient = (client: ClientSearchResult) => {
    setSelectedClient(client);
    setNewProject({ ...newProject, id_cliente: client.id });
    setClientSearchQuery("");
    clearClients();
  };

  const handleRemoveClient = () => {
    setSelectedClient(null);
    setNewProject({ ...newProject, id_cliente: null });
  };

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
              Proyectos propios y postulaciones
            </p>
          </div>
          <button
            className={ticketStyles.primaryButton}
            onClick={() => setShowCreateModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}
          >
            <PlusIcon />
            Crear Proyecto
          </button>
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
              <div className={ticketStyles.statValue}>{stats.propios}</div>
              <div className={ticketStyles.statLabel}>Mis Proyectos</div>
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

        {/* Tabs */}
        <div className={styles.tabsContainer}>
          <button
            className={`${styles.tabButton} ${activeTab === "todos" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("todos")}
          >
            Todos ({stats.total})
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "propios" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("propios")}
          >
            Mis Proyectos ({stats.propios})
          </button>
          <button
            className={`${styles.tabButton} ${activeTab === "postulaciones" ? styles.tabButtonActive : ""}`}
            onClick={() => setActiveTab("postulaciones")}
          >
            Postulaciones ({stats.postulados + stats.asignados + stats.completados + stats.rechazados})
          </button>
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
            {activeTab === "propios" && (
              <>
                <option value="privados">Privados</option>
                <option value="publicos">Publicos</option>
              </>
            )}
            {activeTab === "postulaciones" && (
              <>
                <option value="postulados">Pendientes</option>
                <option value="asignados">Activos</option>
                <option value="completados">Completados</option>
                <option value="rechazados">Rechazados</option>
                <option value="cancelados">Cancelados</option>
              </>
            )}
            {activeTab === "todos" && (
              <>
                <option value="cancelados">Cancelados</option>
              </>
            )}
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
                : activeTab === "propios"
                ? "No tienes proyectos propios"
                : activeTab === "postulaciones"
                ? "No tienes postulaciones"
                : "No tienes proyectos"}
            </h3>
            <p className={ticketStyles.emptyText}>
              {filters.search || filters.categoria !== "todos"
                ? "Intenta con otros filtros de busqueda"
                : activeTab === "propios"
                ? "Crea tu primer proyecto para comenzar"
                : "Los proyectos en los que postules apareceran aqui"}
            </p>
            {activeTab === "propios" && (
              <button
                className={ticketStyles.primaryButton}
                onClick={() => setShowCreateModal(true)}
                style={{ marginTop: "var(--space-4)" }}
              >
                <PlusIcon /> Crear Proyecto
              </button>
            )}
          </div>
        ) : (
          <div className={styles.projectsGrid}>
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => { setShowCreateModal(false); resetNewProjectForm(); }}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "540px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
                <h3 className={styles.modalTitle} style={{ margin: 0 }}>Crear Proyecto</h3>
                <button
                  onClick={() => { setShowCreateModal(false); resetNewProjectForm(); }}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
                >
                  <XIcon />
                </button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Titulo *</label>
                <input
                  type="text"
                  value={newProject.titulo}
                  onChange={(e) => setNewProject({ ...newProject, titulo: e.target.value })}
                  className={styles.formInput}
                  placeholder="Nombre del proyecto"
                />
              </div>

              <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
                <label className={styles.formLabel}>Descripcion</label>
                <textarea
                  value={newProject.descripcion}
                  onChange={(e) => setNewProject({ ...newProject, descripcion: e.target.value })}
                  className={styles.bidFormTextarea}
                  placeholder="Describe el proyecto..."
                  style={{ minHeight: "100px" }}
                />
              </div>

              <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
                <label className={styles.formLabel}>Visibilidad</label>
                <div className={styles.visibilityToggle}>
                  <button
                    type="button"
                    className={`${styles.visibilityOption} ${newProject.visibilidad === "privado" ? styles.visibilityOptionActive : ""}`}
                    onClick={() => setNewProject({ ...newProject, visibilidad: "privado" })}
                  >
                    <LockIcon /> Privado
                  </button>
                  <button
                    type="button"
                    className={`${styles.visibilityOption} ${newProject.visibilidad === "publico" ? styles.visibilityOptionActive : ""}`}
                    onClick={() => setNewProject({ ...newProject, visibilidad: "publico" })}
                  >
                    <GlobeIcon /> Publico
                  </button>
                </div>
                <span className={styles.formHint}>
                  {newProject.visibilidad === "privado"
                    ? "Solo tu puedes ver este proyecto"
                    : "Otros miembros pueden ver y postularse a este proyecto"}
                </span>
              </div>

              <div className={styles.formRow} style={{ marginTop: "var(--space-3)" }}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Presupuesto Min</label>
                  <input
                    type="number"
                    value={newProject.presupuesto_min}
                    onChange={(e) => setNewProject({ ...newProject, presupuesto_min: e.target.value })}
                    className={styles.formInput}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Presupuesto Max</label>
                  <input
                    type="number"
                    value={newProject.presupuesto_max}
                    onChange={(e) => setNewProject({ ...newProject, presupuesto_max: e.target.value })}
                    className={styles.formInput}
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
              </div>

              <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
                <label className={styles.formLabel}>Fecha Limite</label>
                <input
                  type="date"
                  value={newProject.fecha_limite}
                  onChange={(e) => setNewProject({ ...newProject, fecha_limite: e.target.value })}
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup} style={{ marginTop: "var(--space-3)" }}>
                <label className={styles.formLabel}>Asociar Cliente (opcional)</label>
                {selectedClient ? (
                  <div className={styles.selectedClient}>
                    <span>{selectedClient.nombre} ({selectedClient.correo_electronico})</span>
                    <button type="button" onClick={handleRemoveClient} className={styles.removeClientBtn}>
                      <XIcon />
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      value={clientSearchQuery}
                      onChange={(e) => setClientSearchQuery(e.target.value)}
                      className={styles.formInput}
                      placeholder="Buscar cliente por nombre o email..."
                    />
                    {searchingClients && (
                      <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                        Buscando...
                      </span>
                    )}
                    {clientResults.length > 0 && (
                      <div className={styles.clientSearchResults}>
                        {clientResults.map((client) => (
                          <button
                            key={client.id}
                            type="button"
                            className={styles.clientSearchItem}
                            onClick={() => handleSelectClient(client)}
                          >
                            <span className={styles.clientName}>{client.nombre}</span>
                            <span className={styles.clientEmail}>{client.correo_electronico}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)" }}>
                <button
                  className={ticketStyles.primaryButton}
                  onClick={handleCreateProject}
                  disabled={creatingProject || !newProject.titulo.trim()}
                  style={{ flex: 1 }}
                >
                  {creatingProject ? "Creando..." : "Crear Proyecto"}
                </button>
                <button
                  className={ticketStyles.secondaryButton}
                  onClick={() => { setShowCreateModal(false); resetNewProjectForm(); }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
