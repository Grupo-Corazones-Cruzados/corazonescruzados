"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useTickets, Ticket, TicketFilters } from "@/lib/hooks/useTickets";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/Tickets.module.css";

// Icons
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

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

const formatCurrency = (amount: number | null): string => {
  if (amount === null || amount === undefined) return "$0.00";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(amount);
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  const router = useRouter();

  return (
    <article
      className={styles.ticketCard}
      onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/tickets/${ticket.id}`);
        }
      }}
    >
      <div className={styles.ticketHeader}>
        <div>
          <h3 className={styles.ticketTitle}>
            {ticket.titulo || "Ticket sin título"}
          </h3>
          <p className={styles.ticketId}>#{ticket.id}</p>
        </div>
        <span className={`${styles.ticketStatus} ${getStatusClass(ticket.estado)}`}>
          {getStatusLabel(ticket.estado)}
        </span>
      </div>

      <div className={styles.ticketBody}>
        {ticket.miembro && (
          <div className={styles.ticketMeta}>
            <UserIcon />
            <span>{ticket.miembro.nombre}</span>
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
            <span>{ticket.horas_estimadas}h estimadas</span>
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

export default function TicketsPage() {
  const { profile } = useAuth();
  const { tickets, loading, error, stats, refetch } = useTickets();
  const [filters, setFilters] = useState<TicketFilters>({
    search: "",
    estado: "todos",
    miembro: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const userRole = profile?.rol || "cliente";

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          ticket.titulo?.toLowerCase().includes(searchLower) ||
          ticket.detalle?.toLowerCase().includes(searchLower) ||
          ticket.id.toString().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.estado !== "todos" && ticket.estado !== filters.estado) {
        return false;
      }

      return true;
    });
  }, [tickets, filters]);

  // Pagination
  const paginatedTickets = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTickets.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTickets, currentPage]);

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);

  const handleFilterChange = (key: keyof TicketFilters, value: string | number | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Tickets</h1>
            <p className={styles.pageSubtitle}>
              {userRole === "cliente"
                ? "Gestiona tus solicitudes de servicio"
                : "Administra los tickets asignados"}
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
              {filters.search || filters.estado !== "todos"
                ? "No se encontraron tickets"
                : "No hay tickets"}
            </h3>
            <p className={styles.emptyText}>
              {filters.search || filters.estado !== "todos"
                ? "Intenta con otros filtros de búsqueda"
                : "Crea tu primer ticket para comenzar"}
            </p>
            {!filters.search && filters.estado === "todos" && (
              <Link href="/dashboard/tickets/new" className={styles.primaryButton}>
                <PlusIcon />
                Crear Ticket
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className={styles.ticketsList}>
              {paginatedTickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  className={styles.pageButton}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1
                    );
                  })
                  .map((page, index, array) => (
                    <React.Fragment key={page}>
                      {index > 0 && array[index - 1] !== page - 1 && (
                        <span style={{ color: "var(--text-muted)" }}>...</span>
                      )}
                      <button
                        className={`${styles.pageButton} ${currentPage === page ? styles.pageButtonActive : ""}`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  ))}

                <button
                  className={styles.pageButton}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
