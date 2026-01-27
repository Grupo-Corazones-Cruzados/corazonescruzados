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
    activos: number;
    asignados: number;
    completados: number;
  };
  miembros: {
    total: number;
  };
}

interface User {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  avatar_url: string | null;
  rol: string;
  verificado: boolean;
  id_miembro: number | null;
  created_at: string;
  miembro_nombre?: string;
  miembro_puesto?: string;
  bloqueado?: boolean;
  bloqueado_en?: string;
  motivo_bloqueo?: string;
}

interface ActiveUser {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  avatar_url: string | null;
  rol: string;
  last_login: string;
}

interface ActiveMember {
  id: number;
  nombre: string;
  puesto: string;
  foto: string | null;
  costo: number;
  last_login: string | null;
  user_avatar: string | null;
}

interface Fuente {
  id: number;
  nombre: string;
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

const EditIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserPlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="20" y1="8" x2="20" y2="14" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const BanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const UnlockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const UserMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

type ModalMode = "view" | "edit" | "convert" | "block" | "removeMember" | "delete";

export default function AdminPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [activeMembers, setActiveMembers] = useState<ActiveMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRol, setFilterRol] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Modal states
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("view");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit form
  const [editForm, setEditForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    rol: "",
    verificado: false,
  });

  // Convert to member form
  const [convertForm, setConvertForm] = useState({
    puesto: "",
    descripcion: "",
    costo: 0,
    id_fuente: "",
  });

  // Block form
  const [blockForm, setBlockForm] = useState({
    motivo: "",
  });

  // Remove member form
  const [removeMemberForm, setRemoveMemberForm] = useState({
    deleteMemberRecord: false,
  });

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

  useEffect(() => {
    if (isAuthenticated && profile?.rol === "admin") {
      fetchUsers();
    }
  }, [isAuthenticated, profile, page, search, filterRol]);

  // Fetch fuentes
  useEffect(() => {
    const fetchFuentes = async () => {
      try {
        const response = await fetch("/api/fuentes");
        if (response.ok) {
          const data = await response.json();
          setFuentes(data.fuentes || []);
        }
      } catch (error) {
        console.error("Error fetching fuentes:", error);
      }
    };

    if (isAuthenticated && profile?.rol === "admin") {
      fetchFuentes();
    }
  }, [isAuthenticated, profile]);

  // Fetch active users and members
  useEffect(() => {
    const fetchActive = async () => {
      try {
        const response = await fetch("/api/admin/active");
        if (response.ok) {
          const data = await response.json();
          setActiveUsers(data.activeUsers || []);
          setActiveMembers(data.activeMembers || []);
        }
      } catch (error) {
        console.error("Error fetching active:", error);
      }
    };

    if (isAuthenticated && profile?.rol === "admin") {
      fetchActive();
      // Refresh every 60 seconds
      const interval = setInterval(fetchActive, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, profile]);

  const openModal = (user: User, mode: ModalMode) => {
    setSelectedUser(user);
    setModalMode(mode);
    setMessage(null);

    if (mode === "edit") {
      setEditForm({
        nombre: user.nombre || "",
        apellido: user.apellido || "",
        telefono: user.telefono || "",
        rol: user.rol,
        verificado: user.verificado,
      });
    } else if (mode === "convert") {
      setConvertForm({
        puesto: "",
        descripcion: "",
        costo: 0,
        id_fuente: "",
      });
    } else if (mode === "block") {
      setBlockForm({ motivo: "" });
    } else if (mode === "removeMember") {
      setRemoveMemberForm({ deleteMemberRecord: false });
    }
  };

  const closeModal = () => {
    setSelectedUser(null);
    setMessage(null);
  };

  const handleSaveUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          ...editForm,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(users.map((u) => (u.id === selectedUser.id ? { ...u, ...data.user } : u)));
        setMessage({ type: "success", text: "Usuario actualizado correctamente" });
        setTimeout(() => closeModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al actualizar usuario" });
      }
    } catch (error) {
      console.error("Error updating user:", error);
      setMessage({ type: "error", text: "Error al actualizar usuario" });
    }
    setSaving(false);
  };

  const handleBlockUser = async (block: boolean) => {
    if (!selectedUser) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          block,
          motivo: block ? blockForm.motivo.trim() || "Bloqueado por administrador" : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(users.map((u) => (u.id === selectedUser.id ? data.user : u)));
        setMessage({ type: "success", text: block ? "Usuario bloqueado" : "Usuario desbloqueado" });
        setTimeout(() => closeModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al procesar" });
      }
    } catch (error) {
      console.error("Error blocking user:", error);
      setMessage({ type: "error", text: "Error al procesar la solicitud" });
    }
    setSaving(false);
  };

  const handleRemoveMember = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/remove-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          deleteMemberRecord: removeMemberForm.deleteMemberRecord,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(users.map((u) => (u.id === selectedUser.id ? data.user : u)));
        setMessage({ type: "success", text: "Miembro removido correctamente" });
        // Refresh active members list
        const activeResponse = await fetch("/api/admin/active");
        if (activeResponse.ok) {
          const activeData = await activeResponse.json();
          setActiveMembers(activeData.activeMembers || []);
        }
        setTimeout(() => closeModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al remover miembro" });
      }
    } catch (error) {
      console.error("Error removing member:", error);
      setMessage({ type: "error", text: "Error al remover miembro" });
    }
    setSaving(false);
  };

  const handleConvertToMember = async () => {
    if (!selectedUser) return;

    if (!convertForm.puesto.trim()) {
      setMessage({ type: "error", text: "El puesto es requerido" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/convert-to-member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          puesto: convertForm.puesto.trim(),
          descripcion: convertForm.descripcion.trim() || null,
          costo: convertForm.costo || 0,
          id_fuente: convertForm.id_fuente ? parseInt(convertForm.id_fuente) : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(users.map((u) => (u.id === selectedUser.id ? data.user : u)));
        setMessage({ type: "success", text: "Usuario convertido a miembro exitosamente" });
        // Refresh active members list
        const activeResponse = await fetch("/api/admin/active");
        if (activeResponse.ok) {
          const activeData = await activeResponse.json();
          setActiveMembers(activeData.activeMembers || []);
        }
        setTimeout(() => closeModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al convertir usuario" });
      }
    } catch (error) {
      console.error("Error converting user:", error);
      setMessage({ type: "error", text: "Error al convertir usuario a miembro" });
    }
    setSaving(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/users/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUsers(users.filter((u) => u.id !== selectedUser.id));
        setMessage({ type: "success", text: "Usuario eliminado correctamente" });
        setTimeout(() => closeModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al eliminar usuario" });
      }
    } catch (error) {
      console.error("Error deleting user:", error);
      setMessage({ type: "error", text: "Error al eliminar usuario" });
    }
    setSaving(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Sin conexion";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Ahora";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return formatDate(dateString);
  };

  const getInitials = (nombre: string | null, apellido: string | null, email: string) => {
    if (nombre && apellido) {
      return `${nombre[0]}${apellido[0]}`.toUpperCase();
    }
    if (nombre) {
      return nombre.slice(0, 2).toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getFullName = (user: User) => {
    if (user.nombre && user.apellido) {
      return `${user.nombre} ${user.apellido}`;
    }
    return user.nombre || user.apellido || "Sin nombre";
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

          </div>
        )}

        {/* Active Users/Members Grid */}
        <div className={styles.activeSectionsGrid}>
          {/* Active Users Section */}
          <section className={styles.activeSection}>
            <div className={styles.activeSectionHeader}>
              <h2 className={styles.activeSectionTitle}>
                Usuarios Activos
                {activeUsers.length > 0 && (
                  <span className={styles.activeCount}>{activeUsers.length}</span>
                )}
              </h2>
            </div>
            <div className={styles.activeSectionBody}>
              {activeUsers.length > 0 ? (
                <div className={styles.activeList}>
                  {activeUsers.map((user) => {
                    const isRecent = new Date().getTime() - new Date(user.last_login).getTime() < 3600000; // 1 hour
                    return (
                      <div key={user.id} className={styles.activeCard}>
                        <div className={styles.activeAvatarWrapper}>
                          <div className={styles.activeAvatar}>
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.nombre || user.email} />
                            ) : (
                              getInitials(user.nombre, user.apellido, user.email)
                            )}
                          </div>
                          <span className={isRecent ? styles.onlineIndicator : styles.offlineIndicator} />
                        </div>
                        <div className={styles.activeInfo}>
                          <span className={styles.activeName}>
                            {user.nombre && user.apellido
                              ? `${user.nombre} ${user.apellido}`
                              : user.nombre || user.email}
                          </span>
                          <span className={styles.activeRole}>{user.rol}</span>
                        </div>
                        <span className={`${styles.activeTime} ${isRecent ? styles.activeTimeRecent : ""}`}>
                          {formatTimeAgo(user.last_login)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.activeEmptyState}>
                  <UsersIcon />
                  <p>Sin usuarios activos en las ultimas 24h</p>
                </div>
              )}
            </div>
          </section>

          {/* Active Members Section */}
          <section className={styles.activeSection}>
            <div className={styles.activeSectionHeader}>
              <h2 className={styles.activeSectionTitle}>
                Miembros Conectados
                {activeMembers.filter((m) => m.last_login).length > 0 && (
                  <span className={styles.activeCount}>
                    {activeMembers.filter((m) => m.last_login).length}
                  </span>
                )}
              </h2>
            </div>
            <div className={styles.activeSectionBody}>
              {activeMembers.length > 0 ? (
                <div className={styles.activeList}>
                  {activeMembers.map((member) => {
                    const isRecent = member.last_login
                      ? new Date().getTime() - new Date(member.last_login).getTime() < 3600000
                      : false;
                    return (
                      <div key={member.id} className={styles.activeCard}>
                        <div className={styles.activeAvatarWrapper}>
                          <div className={styles.activeAvatar}>
                            {member.foto || member.user_avatar ? (
                              <img src={member.foto || member.user_avatar || ""} alt={member.nombre} />
                            ) : (
                              member.nombre
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                            )}
                          </div>
                          <span className={isRecent ? styles.onlineIndicator : styles.offlineIndicator} />
                        </div>
                        <div className={styles.activeInfo}>
                          <span className={styles.activeName}>{member.nombre}</span>
                          <span className={styles.activeRole}>{member.puesto}</span>
                        </div>
                        <span className={`${styles.activeTime} ${isRecent ? styles.activeTimeRecent : ""}`}>
                          {formatTimeAgo(member.last_login)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={styles.activeEmptyState}>
                  <UsersIcon />
                  <p>Sin miembros conectados recientemente</p>
                </div>
              )}
            </div>
          </section>
        </div>

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
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className={styles.userRow}>
                              <div className={styles.userAvatar}>
                                {user.avatar_url ? (
                                  <img src={user.avatar_url} alt={getFullName(user)} />
                                ) : (
                                  getInitials(user.nombre, user.apellido, user.email)
                                )}
                              </div>
                              <div className={styles.userInfo}>
                                <span className={styles.userName}>{getFullName(user)}</span>
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
                              {user.rol === "miembro" && user.miembro_puesto
                                ? user.miembro_puesto
                                : user.rol}
                            </span>
                          </td>
                          <td>
                            {user.bloqueado ? (
                              <span className={`${styles.badge} ${styles.badgeBlocked}`}>
                                Bloqueado
                              </span>
                            ) : (
                              <span
                                className={`${styles.badge} ${
                                  user.verificado ? styles.badgeVerified : styles.badgeUnverified
                                }`}
                              >
                                {user.verificado ? "Verificado" : "No verificado"}
                              </span>
                            )}
                          </td>
                          <td>
                            <div className={styles.actionButtons}>
                              <button
                                className={styles.iconButton}
                                onClick={() => openModal(user, "view")}
                                title="Ver detalles"
                              >
                                <EyeIcon />
                              </button>
                              <button
                                className={styles.iconButton}
                                onClick={() => openModal(user, "edit")}
                                title="Editar"
                              >
                                <EditIcon />
                              </button>
                              {!user.id_miembro && user.rol !== "admin" && !user.bloqueado && (
                                <button
                                  className={`${styles.iconButton} ${styles.iconButtonPrimary}`}
                                  onClick={() => openModal(user, "convert")}
                                  title="Convertir a miembro"
                                >
                                  <UserPlusIcon />
                                </button>
                              )}
                              {user.id_miembro && user.rol === "miembro" && (
                                <button
                                  className={`${styles.iconButton} ${styles.iconButtonWarning}`}
                                  onClick={() => openModal(user, "removeMember")}
                                  title="Quitar de miembro"
                                >
                                  <UserMinusIcon />
                                </button>
                              )}
                              {user.rol !== "admin" && (
                                <button
                                  className={`${styles.iconButton} ${user.bloqueado ? styles.iconButtonSuccess : styles.iconButtonDanger}`}
                                  onClick={() => openModal(user, "block")}
                                  title={user.bloqueado ? "Desbloquear" : "Bloquear"}
                                >
                                  {user.bloqueado ? <UnlockIcon /> : <BanIcon />}
                                </button>
                              )}
                              {user.rol !== "admin" && (
                                <button
                                  className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                  onClick={() => openModal(user, "delete")}
                                  title="Eliminar usuario"
                                >
                                  <TrashIcon />
                                </button>
                              )}
                            </div>
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
          
        </div>

        {/* User Modal */}
        {selectedUser && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {modalMode === "view" && "Detalles del Usuario"}
                  {modalMode === "edit" && "Editar Usuario"}
                  {modalMode === "convert" && "Convertir a Miembro"}
                  {modalMode === "block" && (selectedUser?.bloqueado ? "Desbloquear Usuario" : "Bloquear Usuario")}
                  {modalMode === "removeMember" && "Quitar de Miembro"}
                  {modalMode === "delete" && "Eliminar Usuario"}
                </h3>
                <button className={styles.iconButton} onClick={closeModal}>
                  <CloseIcon />
                </button>
              </div>

              {/* Message */}
              {message && (
                <div className={`${styles.modalMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <div className={styles.modalBody}>
                {/* User Info Header */}
                <div className={styles.modalUserHeader}>
                  <div className={styles.modalUserAvatar}>
                    {selectedUser.avatar_url ? (
                      <img src={selectedUser.avatar_url} alt={getFullName(selectedUser)} />
                    ) : (
                      getInitials(selectedUser.nombre, selectedUser.apellido, selectedUser.email)
                    )}
                  </div>
                  <div className={styles.modalUserInfo}>
                    <h4>{getFullName(selectedUser)}</h4>
                    <p>{selectedUser.email}</p>
                    <div className={styles.modalUserBadges}>
                      <span className={`${styles.badge} ${styles[`badge${selectedUser.rol.charAt(0).toUpperCase() + selectedUser.rol.slice(1)}`] || styles.badgeCliente}`}>
                        <ShieldIcon />
                        {selectedUser.rol}
                      </span>
                      {selectedUser.id_miembro && (
                        <span className={styles.badge} style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                          Miembro #{selectedUser.id_miembro}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* View Mode */}
                {modalMode === "view" && (
                  <div className={styles.modalDetails}>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Nombre</span>
                      <span className={styles.detailValue}>{selectedUser.nombre || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Apellido</span>
                      <span className={styles.detailValue}>{selectedUser.apellido || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Telefono</span>
                      <span className={styles.detailValue}>{selectedUser.telefono || "—"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Rol</span>
                      <span className={styles.detailValue}>{selectedUser.rol}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Verificado</span>
                      <span className={styles.detailValue}>{selectedUser.verificado ? "Si" : "No"}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span className={styles.detailLabel}>Fecha de registro</span>
                      <span className={styles.detailValue}>{formatDate(selectedUser.created_at)}</span>
                    </div>
                    {selectedUser.miembro_puesto && (
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Puesto de miembro</span>
                        <span className={styles.detailValue}>{selectedUser.miembro_puesto}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Edit Mode */}
                {modalMode === "edit" && (
                  <div className={styles.modalForm}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Nombre</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={editForm.nombre}
                          onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                          placeholder="Nombre"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Apellido</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={editForm.apellido}
                          onChange={(e) => setEditForm({ ...editForm, apellido: e.target.value })}
                          placeholder="Apellido"
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Telefono</label>
                      <input
                        type="tel"
                        className={styles.formInput}
                        value={editForm.telefono}
                        onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                        placeholder="+593 999 999 999"
                      />
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
                )}

                {/* Convert Mode */}
                {modalMode === "convert" && (
                  <div className={styles.modalForm}>
                    <div className={styles.convertNotice}>
                      <p>Al convertir este usuario en miembro:</p>
                      <ul>
                        <li>Se creara un registro en la tabla de miembros</li>
                        <li>Su rol cambiara automaticamente a "miembro"</li>
                        <li>Sera marcado como verificado</li>
                      </ul>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Puesto *</label>
                      <input
                        type="text"
                        className={styles.formInput}
                        value={convertForm.puesto}
                        onChange={(e) => setConvertForm({ ...convertForm, puesto: e.target.value })}
                        placeholder="Ej: Desarrollador, Disenador, Consultor..."
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Descripcion</label>
                      <textarea
                        className={styles.formTextarea}
                        value={convertForm.descripcion}
                        onChange={(e) => setConvertForm({ ...convertForm, descripcion: e.target.value })}
                        placeholder="Breve descripcion del miembro..."
                        rows={3}
                      />
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Costo por hora (USD)</label>
                        <input
                          type="number"
                          className={styles.formInput}
                          value={convertForm.costo}
                          onChange={(e) => setConvertForm({ ...convertForm, costo: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="10"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Area / Fuente</label>
                        <select
                          className={styles.formSelect}
                          value={convertForm.id_fuente}
                          onChange={(e) => setConvertForm({ ...convertForm, id_fuente: e.target.value })}
                        >
                          <option value="">Seleccionar area...</option>
                          {fuentes.map((fuente) => (
                            <option key={fuente.id} value={fuente.id}>
                              {fuente.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Block Mode */}
                {modalMode === "block" && (
                  <div className={styles.modalForm}>
                    {selectedUser?.bloqueado ? (
                      <div className={styles.convertNotice} style={{ background: "rgba(34, 197, 94, 0.1)", borderColor: "rgba(34, 197, 94, 0.3)" }}>
                        <p style={{ color: "#22c55e" }}>Este usuario esta bloqueado</p>
                        <ul>
                          <li>Motivo: {selectedUser.motivo_bloqueo || "Sin especificar"}</li>
                          <li>Al desbloquearlo podra iniciar sesion nuevamente</li>
                        </ul>
                      </div>
                    ) : (
                      <>
                        <div className={styles.convertNotice} style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
                          <p style={{ color: "#ef4444" }}>Bloquear usuario</p>
                          <ul>
                            <li>El usuario no podra iniciar sesion</li>
                            <li>Quedara marcado como bloqueado/baneado</li>
                            <li>Puedes desbloquearlo despues si lo necesitas</li>
                          </ul>
                        </div>

                        <div className={styles.formGroup}>
                          <label className={styles.formLabel}>Motivo del bloqueo</label>
                          <textarea
                            className={styles.formTextarea}
                            value={blockForm.motivo}
                            onChange={(e) => setBlockForm({ motivo: e.target.value })}
                            placeholder="Ej: Comportamiento inapropiado, spam, etc."
                            rows={3}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Remove Member Mode */}
                {modalMode === "removeMember" && (
                  <div className={styles.modalForm}>
                    <div className={styles.convertNotice} style={{ background: "rgba(251, 191, 36, 0.1)", borderColor: "rgba(251, 191, 36, 0.3)" }}>
                      <p style={{ color: "#d97706" }}>Quitar rol de miembro</p>
                      <ul>
                        <li>El usuario volvera a ser un cliente normal</li>
                        <li>Se desvinculara su perfil del registro de miembro</li>
                        <li>Puedes conservar o eliminar el registro de miembro</li>
                      </ul>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formCheckbox}>
                        <input
                          type="checkbox"
                          checked={removeMemberForm.deleteMemberRecord}
                          onChange={(e) => setRemoveMemberForm({ deleteMemberRecord: e.target.checked })}
                        />
                        Eliminar tambien el registro de miembro de la base de datos
                      </label>
                      <span className={styles.formHint}>
                        Si no marcas esta opcion, el registro se conservara para referencia futura
                      </span>
                    </div>
                  </div>
                )}

                {/* Delete Mode */}
                {modalMode === "delete" && (
                  <div className={styles.modalForm}>
                    <div className={styles.convertNotice} style={{ background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.3)" }}>
                      <p style={{ color: "#ef4444" }}>Eliminar usuario permanentemente</p>
                      <ul>
                        <li>Esta accion no se puede deshacer</li>
                        <li>Se eliminaran todos los datos del usuario</li>
                        <li>Si el usuario es miembro, se desvinculara del registro</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                {modalMode === "view" && (
                  <>
                    <button className={styles.secondaryButton} onClick={closeModal}>
                      Cerrar
                    </button>
                    <button className={styles.primaryButton} onClick={() => setModalMode("edit")}>
                      Editar
                    </button>
                  </>
                )}
                {modalMode === "edit" && (
                  <>
                    <button className={styles.secondaryButton} onClick={() => setModalMode("view")} disabled={saving}>
                      Cancelar
                    </button>
                    <button className={styles.primaryButton} onClick={handleSaveUser} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </>
                )}
                {modalMode === "convert" && (
                  <>
                    <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                      Cancelar
                    </button>
                    <button className={styles.primaryButton} onClick={handleConvertToMember} disabled={saving}>
                      {saving ? "Convirtiendo..." : "Convertir a miembro"}
                    </button>
                  </>
                )}
                {modalMode === "block" && (
                  <>
                    <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                      Cancelar
                    </button>
                    {selectedUser?.bloqueado ? (
                      <button className={styles.primaryButton} onClick={() => handleBlockUser(false)} disabled={saving}>
                        {saving ? "Desbloqueando..." : "Desbloquear usuario"}
                      </button>
                    ) : (
                      <button className={styles.dangerButton} onClick={() => handleBlockUser(true)} disabled={saving}>
                        {saving ? "Bloqueando..." : "Bloquear usuario"}
                      </button>
                    )}
                  </>
                )}
                {modalMode === "removeMember" && (
                  <>
                    <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                      Cancelar
                    </button>
                    <button className={styles.warningButton} onClick={handleRemoveMember} disabled={saving}>
                      {saving ? "Procesando..." : "Quitar de miembro"}
                    </button>
                  </>
                )}
                {modalMode === "delete" && (
                  <>
                    <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                      Cancelar
                    </button>
                    <button className={styles.dangerButton} onClick={handleDeleteUser} disabled={saving}>
                      {saving ? "Eliminando..." : "Eliminar usuario"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
