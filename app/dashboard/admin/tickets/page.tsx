"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Admin.module.css";

interface Ticket {
  id: number;
  titulo: string;
  detalle: string | null;
  estado: string;
  horas_estimadas: number | null;
  horas_reales: number | null;
  costo_estimado: number | null;
  costo_real: number | null;
  fecha_programada: string | null;
  fecha_fin: string | null;
  created_at: string;
  google_meet_link: string | null;
  cliente_nombre: string | null;
  cliente_email: string | null;
  miembro_nombre: string | null;
  miembro_puesto: string | null;
  accion_nombre: string | null;
  total_slots: number;
  total_acciones: number;
}

// Icons
const TicketIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
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

// Ticket states
const TICKET_STATES = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_progreso", label: "En Progreso" },
  { value: "completado", label: "Completado" },
  { value: "cancelado", label: "Cancelado" },
];

const getStateLabel = (estado: string): string => {
  const state = TICKET_STATES.find(s => s.value === estado);
  return state?.label || estado;
};

const getStateClass = (estado: string): string => {
  const stateClasses: Record<string, string> = {
    pendiente: styles.badgeWarning,
    en_progreso: styles.badgeInfo,
    completado: styles.badgeSuccess,
    cancelado: styles.badgeDanger,
  };
  return stateClasses[estado] || styles.badgeDefault;
};

export default function AdminTicketsPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal states
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profile?.rol !== "admin")) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Fetch tickets
  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });
      if (search) params.append("search", search);
      if (filterEstado) params.append("estado", filterEstado);

      const response = await fetch(`/api/admin/tickets?${params}`);
      const data = await response.json();

      if (response.ok) {
        setTickets(data.tickets || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      } else {
        console.error("Error fetching tickets:", data.error);
        setTickets([]);
        setTotalPages(1);
        setTotal(0);
      }
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setTickets([]);
      setTotalPages(1);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && profile?.rol === "admin") {
      fetchTickets();
    }
  }, [isAuthenticated, profile, page, filterEstado]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated && profile?.rol === "admin") {
        setPage(1);
        fetchTickets();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const openDeleteModal = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setShowDeleteModal(true);
    setMessage(null);
  };

  const closeDeleteModal = () => {
    setSelectedTicket(null);
    setShowDeleteModal(false);
    setMessage(null);
  };

  const handleDelete = async () => {
    if (!selectedTicket) return;

    setDeleting(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/tickets?id=${selectedTicket.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: data.message || "Ticket eliminado" });
        // Remove from list
        setTickets(tickets.filter((t) => t.id !== selectedTicket.id));
        setTotal(total - 1);
        setTimeout(() => closeDeleteModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al eliminar" });
      }
    } catch (error) {
      console.error("Error deleting ticket:", error);
      setMessage({ type: "error", text: "Error al eliminar ticket" });
    }
    setDeleting(false);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "—";
    return `$${amount.toLocaleString()}`;
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
            <h1 className={styles.pageTitle}>Gestion de Tickets</h1>
            <p className={styles.pageSubtitle}>
              Administra todos los tickets del sistema ({total} tickets)
            </p>
          </div>
        </header>

        {/* Tickets Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <TicketIcon /> Tickets
            </h2>
            <div className={styles.sectionActions}>
              <button
                className={styles.iconButton}
                onClick={() => fetchTickets()}
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
                  placeholder="Buscar por titulo, cliente o miembro..."
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
                {TICKET_STATES.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Tickets Table */}
            {tickets.length > 0 ? (
              <>
                <div className={styles.tableWrapper}>
                  <table className={styles.usersTable}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Ticket</th>
                        <th>Estado</th>
                        <th>Cliente</th>
                        <th>Miembro</th>
                        <th>Horas</th>
                        <th>Costo</th>
                        <th>Creado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((ticket) => (
                        <tr key={ticket.id}>
                          <td>
                            <span style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
                              #{ticket.id}
                            </span>
                          </td>
                          <td>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{ticket.titulo}</span>
                              {ticket.accion_nombre && (
                                <span className={styles.userEmail}>{ticket.accion_nombre}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`${styles.badge} ${getStateClass(ticket.estado)}`}>
                              {getStateLabel(ticket.estado)}
                            </span>
                          </td>
                          <td>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{ticket.cliente_nombre || "—"}</span>
                              {ticket.cliente_email && (
                                <span className={styles.userEmail}>{ticket.cliente_email}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className={styles.userInfo}>
                              <span className={styles.userName}>{ticket.miembro_nombre || "—"}</span>
                              {ticket.miembro_puesto && (
                                <span className={styles.userEmail}>{ticket.miembro_puesto}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>
                              {ticket.horas_reales || ticket.horas_estimadas || "—"}
                              {ticket.horas_estimadas && !ticket.horas_reales && " (est.)"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>
                              {formatCurrency(ticket.costo_real || ticket.costo_estimado)}
                              {ticket.costo_estimado && !ticket.costo_real && " (est.)"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.85rem" }}>{formatDate(ticket.created_at)}</span>
                          </td>
                          <td>
                            <div className={styles.actionButtons}>
                              <button
                                className={styles.iconButton}
                                onClick={() => router.push(`/dashboard/tickets/${ticket.id}`)}
                                title="Ver ticket"
                              >
                                <EyeIcon />
                              </button>
                              <a
                                href={`/dashboard/tickets/${ticket.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.iconButton}
                                title="Abrir en nueva pestana"
                              >
                                <ExternalLinkIcon />
                              </a>
                              <button
                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                onClick={() => openDeleteModal(ticket)}
                                title="Eliminar ticket"
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
                <TicketIcon />
                <p>No se encontraron tickets</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedTicket && (
          <div className={styles.modalOverlay} onClick={closeDeleteModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Eliminar Ticket</h3>
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
                  <p style={{ color: "#ef4444" }}>Eliminar ticket permanentemente</p>
                  <ul>
                    <li>
                      <strong>Ticket:</strong> {selectedTicket.titulo}
                    </li>
                    <li>
                      <strong>ID:</strong> #{selectedTicket.id}
                    </li>
                    <li>
                      <strong>Estado:</strong> {getStateLabel(selectedTicket.estado)}
                    </li>
                    {selectedTicket.cliente_nombre && (
                      <li>
                        <strong>Cliente:</strong> {selectedTicket.cliente_nombre}
                      </li>
                    )}
                    {selectedTicket.miembro_nombre && (
                      <li>
                        <strong>Miembro:</strong> {selectedTicket.miembro_nombre}
                      </li>
                    )}
                    <li style={{ marginTop: "0.5rem" }}>Esta accion no se puede deshacer</li>
                    <li>Se eliminaran todos los datos asociados:</li>
                    <li style={{ marginLeft: "1rem" }}>- {selectedTicket.total_slots} slots de horario</li>
                    <li style={{ marginLeft: "1rem" }}>- {selectedTicket.total_acciones} acciones asociadas</li>
                  </ul>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button className={styles.secondaryButton} onClick={closeDeleteModal} disabled={deleting}>
                  Cancelar
                </button>
                <button className={styles.dangerButton} onClick={handleDelete} disabled={deleting}>
                  {deleting ? "Eliminando..." : "Eliminar Ticket"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
