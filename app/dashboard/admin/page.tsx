"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Admin.module.css";

interface Stats {
  usuarios: {
    total: number;
    clientes: number;
    miembros: number;
    admins: number;
    verificados: number;
  };
  tickets: {
    total: number;
    pendientes: number;
    enProgreso: number;
    completados: number;
  };
  proyectos: {
    total: number;
    publicados: number;
    asignados: number;
    completados: number;
  };
  facturas: {
    total: number;
    pendientes: number;
    pagadas: number;
    totalIngresos: number;
  };
  miembros: {
    total: number;
    activos: number;
  };
}

interface User {
  id: string;
  user_id: string;
  email: string;
  nombre: string;
  rol: string;
  verificado: boolean;
  created_at: string;
  foto_perfil: string | null;
}

interface Miembro {
  id: string;
  nombre: string;
  puesto: string;
  costo: number;
  foto: string | null;
  activo: boolean;
}

// Icons
const UsersIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const TicketIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
  </svg>
);

const ProjectIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const InvoiceIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const DollarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function AdminPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRol, setFilterRol] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ rol: "", verificado: false });
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profile?.rol !== "admin")) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Fetch stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/admin/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    if (isAuthenticated && profile?.rol === "admin") {
      fetchStats();
    }
  }, [isAuthenticated, profile]);

  // Fetch users
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "10",
        });
        if (search) params.append("search", search);
        if (filterRol) params.append("rol", filterRol);

        const response = await fetch(`/api/admin/users?${params}`);
        if (response.ok) {
          const data = await response.json();
          setUsers(data.users);
          setTotalPages(data.pagination.totalPages);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
      }
      setLoading(false);
    };

    if (isAuthenticated && profile?.rol === "admin") {
      fetchUsers();
    }
  }, [isAuthenticated, profile, page, search, filterRol]);

  // Fetch miembros
  useEffect(() => {
    const fetchMiembros = async () => {
      try {
        const response = await fetch("/api/members");
        if (response.ok) {
          const data = await response.json();
          setMiembros(data.members || []);
        }
      } catch (error) {
        console.error("Error fetching miembros:", error);
      }
    };

    if (isAuthenticated && profile?.rol === "admin") {
      fetchMiembros();
    }
  }, [isAuthenticated, profile]);

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditForm({ rol: user.rol, verificado: user.verificado });
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.user_id,
          rol: editForm.rol,
          verificado: editForm.verificado,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(users.map((u) => (u.user_id === editingUser.user_id ? { ...u, ...data.user } : u)));
        setEditingUser(null);
      } else {
        alert("Error al actualizar usuario");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Error al actualizar usuario");
    }
    setSaving(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getInitials = (nombre: string, email: string) => {
    if (nombre) {
      return nombre
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
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
            <h1 className={styles.pageTitle}>Panel de Administracion</h1>
            <p className={styles.pageSubtitle}>Gestiona usuarios, miembros y metricas del sistema</p>
          </div>
        </header>

        {/* Stats Cards */}
        {stats && (
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconUsers}`}>
                <UsersIcon />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.usuarios.total}</div>
                <div className={styles.statLabel}>Usuarios</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconTickets}`}>
                <TicketIcon />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.tickets.total}</div>
                <div className={styles.statLabel}>Tickets</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconProjects}`}>
                <ProjectIcon />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.proyectos.total}</div>
                <div className={styles.statLabel}>Proyectos</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconInvoices}`}>
                <InvoiceIcon />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{stats.facturas.total}</div>
                <div className={styles.statLabel}>Facturas</div>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${styles.statIconRevenue}`}>
                <DollarIcon />
              </div>
              <div className={styles.statContent}>
                <div className={styles.statValue}>{formatCurrency(stats.facturas.totalIngresos)}</div>
                <div className={styles.statLabel}>Ingresos</div>
              </div>
            </div>
          </div>
        )}

        {/* Sections Grid */}
        <div className={styles.sectionsGrid}>
          {/* Users Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Usuarios</h2>
            </div>
            <div className={styles.sectionBody}>
              {/* Filters */}
              <div className={styles.filtersBar}>
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  className={styles.searchInput}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <select
                  className={styles.filterSelect}
                  value={filterRol}
                  onChange={(e) => {
                    setFilterRol(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Todos los roles</option>
                  <option value="cliente">Cliente</option>
                  <option value="miembro">Miembro</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Users Table */}
              {users.length > 0 ? (
                <>
                  <table className={styles.usersTable}>
                    <thead>
                      <tr>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.user_id}>
                          <td>
                            <div className={styles.userRow}>
                              <div className={styles.userAvatar}>
                                {user.foto_perfil ? (
                                  <img src={user.foto_perfil} alt={user.nombre || user.email} />
                                ) : (
                                  getInitials(user.nombre || "", user.email)
                                )}
                              </div>
                              <div className={styles.userInfo}>
                                <span className={styles.userName}>{user.nombre || "Sin nombre"}</span>
                                <span className={styles.userEmail}>{user.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${
                                user.rol === "admin"
                                  ? styles.badgeAdmin
                                  : user.rol === "miembro"
                                  ? styles.badgeMiembro
                                  : styles.badgeCliente
                              }`}
                            >
                              {user.rol}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`${styles.badge} ${
                                user.verificado ? styles.badgeVerified : styles.badgeUnverified
                              }`}
                            >
                              {user.verificado ? "Verificado" : "No verificado"}
                            </span>
                          </td>
                          <td>
                            <button className={styles.iconButton} onClick={() => handleEditUser(user)} title="Editar">
                              <EditIcon />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

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
                  <UsersIcon />
                  <p>No se encontraron usuarios</p>
                </div>
              )}
            </div>
          </section>

          {/* Members Section */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Miembros Activos</h2>
            </div>
            <div className={styles.sectionBody}>
              {miembros.filter((m) => m.activo).length > 0 ? (
                <div className={styles.membersList}>
                  {miembros
                    .filter((m) => m.activo)
                    .map((miembro) => (
                      <div key={miembro.id} className={styles.memberCard}>
                        {miembro.foto ? (
                          <img src={miembro.foto} alt={miembro.nombre} className={styles.memberAvatar} />
                        ) : (
                          <div className={styles.memberAvatar}>
                            {miembro.nombre
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className={styles.memberInfo}>
                          <span className={styles.memberName}>{miembro.nombre}</span>
                          <span className={styles.memberRole}>{miembro.puesto}</span>
                        </div>
                        <span className={styles.memberCost}>{formatCurrency(miembro.costo)}/hr</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <UsersIcon />
                  <p>No hay miembros activos</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Edit User Modal */}
        {editingUser && (
          <div className={styles.modalOverlay} onClick={() => setEditingUser(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Editar Usuario</h3>
                <button className={styles.iconButton} onClick={() => setEditingUser(null)}>
                  <CloseIcon />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.userRow} style={{ marginBottom: "var(--space-4)" }}>
                  <div className={styles.userAvatar}>
                    {editingUser.foto_perfil ? (
                      <img src={editingUser.foto_perfil} alt={editingUser.nombre || editingUser.email} />
                    ) : (
                      getInitials(editingUser.nombre || "", editingUser.email)
                    )}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{editingUser.nombre || "Sin nombre"}</span>
                    <span className={styles.userEmail}>{editingUser.email}</span>
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Rol</label>
                  <select
                    className={styles.formSelect}
                    value={editForm.rol}
                    onChange={(e) => setEditForm({ ...editForm, rol: e.target.value })}
                  >
                    <option value="cliente">Cliente</option>
                    <option value="miembro">Miembro</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formCheckbox}>
                    <input
                      type="checkbox"
                      checked={editForm.verificado}
                      onChange={(e) => setEditForm({ ...editForm, verificado: e.target.checked })}
                    />
                    Usuario verificado
                  </label>
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.secondaryButton} onClick={() => setEditingUser(null)}>
                  Cancelar
                </button>
                <button className={styles.primaryButton} onClick={handleSaveUser} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
