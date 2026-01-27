"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useTickets, Ticket, TicketFilters } from "@/lib/hooks/useTickets";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/Tickets.module.css";

// Icons
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
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

const TicketEmptyIcon = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
    <path d="M13 5v2" />
    <path d="M13 17v2" />
    <path d="M13 11v2" />
  </svg>
);

const getStatusClass = (estado: string | null): string => {
  switch (estado) {
    case "pendiente":
      return styles.statusPendiente;
    case "confirmado":
      return styles.statusConfirmado;
    case "en_progreso":
      return styles.statusEnProgreso;
    case "completado":
      return styles.statusCompletado;
    case "cancelado":
      return styles.statusCancelado;
    default:
      return styles.statusPendiente;
  }
};

const getStatusLabel = (estado: string | null): string => {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "confirmado":
      return "Confirmado";
    case "en_progreso":
      return "En Progreso";
    case "completado":
      return "Completado";
    case "cancelado":
      return "Cancelado";
    default:
      return "Pendiente";
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

const formatHours = (hours: number): string => {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
};

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  const router = useRouter();

  return (
    <article
      className={styles.ticketCard}
      onClick={() => router.push(`/dashboard/miembro/tickets/${ticket.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/miembro/tickets/${ticket.id}`);
        }
      }}
    >
      <div className={styles.ticketHeader}>
        <div>
          <h3 className={styles.ticketTitle}>
            {ticket.titulo || "Ticket sin titulo"}
          </h3>
          <p className={styles.ticketId}>#{ticket.id}</p>
        </div>
        <span className={`${styles.ticketStatus} ${getStatusClass(ticket.estado)}`}>
          {getStatusLabel(ticket.estado)}
        </span>
      </div>

      <div className={styles.ticketBody}>
        {ticket.cliente && (
          <div className={styles.ticketMeta}>
            <UserIcon />
            <span>{ticket.cliente.nombre}</span>
          </div>
        )}
        {ticket.fecha_programada && (
          <div className={styles.ticketMeta}>
            <CalendarIcon />
            <span>{formatDate(ticket.fecha_programada)}</span>
          </div>
        )}
        {ticket.horas_estimadas && (
          <div className={styles.ticketMeta}>
            <ClockIcon />
            <span>{formatHours(ticket.horas_estimadas)} estimadas</span>
          </div>
        )}
      </div>

      {ticket.detalle && (
        <p className={styles.ticketDescription}>{ticket.detalle}</p>
      )}

      <div className={styles.ticketFooter}>
        <span className={styles.ticketCost}>
          {formatCurrency(ticket.costo_estimado)}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
          {formatDate(ticket.created_at)}
        </span>
      </div>
    </article>
  );
}

export default function MiembroTicketsPage() {
  const { profile, isAuthenticated, loading: authLoading } = useAuth();
  const { tickets, loading, error, stats, refetch } = useTickets();
  const router = useRouter();
  const [filters, setFilters] = useState<TicketFilters>({
    search: "",
    estado: "todos",
    miembro: null,
  });
  const [clienteFilter, setClienteFilter] = useState<string>("todos");
  const [fechaFilter, setFechaFilter] = useState<string>("todos");

  // Redirect non-members
  React.useEffect(() => {
    if (!authLoading && (!isAuthenticated || (profile?.rol !== "miembro" && profile?.rol !== "admin"))) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Unique clients for dropdown
  const uniqueClients = useMemo(() => {
    const map = new Map<number, string>();
    for (const ticket of tickets) {
      if (ticket.cliente) {
        map.set(ticket.cliente.id, ticket.cliente.nombre);
      }
    }
    return Array.from(map.entries()); // [[id, nombre], ...]
  }, [tickets]);

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          ticket.titulo?.toLowerCase().includes(searchLower) ||
          ticket.detalle?.toLowerCase().includes(searchLower) ||
          ticket.id.toString().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.estado !== "todos" && ticket.estado !== filters.estado) {
        return false;
      }

      if (clienteFilter !== "todos" && ticket.cliente?.id !== parseInt(clienteFilter)) {
        return false;
      }

      if (fechaFilter !== "todos") {
        const ticketDate = new Date(ticket.created_at).getTime();
        const now = Date.now();
        const msInDay = 86400000;
        if (fechaFilter === "semana" && now - ticketDate > 7 * msInDay) return false;
        if (fechaFilter === "mes" && now - ticketDate > 30 * msInDay) return false;
        if (fechaFilter === "3meses" && now - ticketDate > 90 * msInDay) return false;
      }

      return true;
    });
  }, [tickets, filters, clienteFilter, fechaFilter]);

  // Group tickets by client
  const groupedTickets = useMemo(() => {
    const groups = new Map<string, Ticket[]>();
    for (const ticket of filteredTickets) {
      const name = ticket.cliente?.nombre || "Sin cliente";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name)!.push(ticket);
    }
    return Array.from(groups.entries());
  }, [filteredTickets]);

  const handleFilterChange = (key: keyof TicketFilters, value: string | number | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleClienteFilterChange = (value: string) => {
    setClienteFilter(value);
  };

  const handleFechaFilterChange = (value: string) => {
    setFechaFilter(value);
  };

  if (authLoading || (!isAuthenticated && !profile)) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Mis Tickets</h1>
            <p className={styles.pageSubtitle}>
              Gestiona los tickets asignados a ti
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
              </svg>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>Total</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPending}`}>
              <ClockIcon />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.pendientes}</div>
              <div className={styles.statLabel}>Pendientes</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconActive}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4" />
                <path d="m16.2 7.8 2.9-2.9" />
                <path d="M18 12h4" />
                <path d="m16.2 16.2 2.9 2.9" />
                <path d="M12 18v4" />
                <path d="m4.9 19.1 2.9-2.9" />
                <path d="M2 12h4" />
                <path d="m4.9 4.9 2.9 2.9" />
              </svg>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.enProgreso}</div>
              <div className={styles.statLabel}>En Progreso</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconCompleted}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.completados}</div>
              <div className={styles.statLabel}>Completados</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className={styles.filtersBar}>
          <input
            type="text"
            placeholder="Buscar tickets..."
            className={styles.searchInput}
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
          />

          <select
            className={styles.filterSelect}
            value={filters.estado}
            onChange={(e) => handleFilterChange("estado", e.target.value)}
          >
            <option value="todos">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmado">Confirmado</option>
            <option value="en_progreso">En Progreso</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            className={styles.filterSelect}
            value={clienteFilter}
            onChange={(e) => handleClienteFilterChange(e.target.value)}
          >
            <option value="todos">Todos los clientes</option>
            {uniqueClients.map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={fechaFilter}
            onChange={(e) => handleFechaFilterChange(e.target.value)}
          >
            <option value="todos">Todas las fechas</option>
            <option value="semana">Ultima semana</option>
            <option value="mes">Ultimo mes</option>
            <option value="3meses">Ultimos 3 meses</option>
          </select>
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p style={{ color: "var(--text-muted)" }}>Cargando tickets...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p style={{ color: "var(--primary-red)" }}>{error}</p>
            <button className={styles.secondaryButton} onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className={styles.emptyState}>
            <TicketEmptyIcon />
            <h3 className={styles.emptyTitle}>
              {filters.search || filters.estado !== "todos" || clienteFilter !== "todos" || fechaFilter !== "todos"
                ? "No se encontraron tickets"
                : "No tienes tickets asignados"}
            </h3>
            <p className={styles.emptyText}>
              {filters.search || filters.estado !== "todos" || clienteFilter !== "todos" || fechaFilter !== "todos"
                ? "Intenta con otros filtros de busqueda"
                : "Los tickets que te asignen apareceran aqui"}
            </p>
          </div>
        ) : (
          <div className={styles.ticketsList}>
            {groupedTickets.map(([groupName, groupTickets]) => (
              <div key={groupName} className={styles.ticketGroup}>
                <div className={styles.ticketGroupHeader}>
                  <span>{groupName}</span>
                  <span className={styles.ticketGroupCount}>{groupTickets.length}</span>
                </div>
                <div className={styles.ticketGroupBody}>
                  {groupTickets.map((ticket) => (
                    <TicketCard key={ticket.id} ticket={ticket} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
