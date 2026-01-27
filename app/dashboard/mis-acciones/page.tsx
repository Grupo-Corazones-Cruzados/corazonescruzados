"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/MisAcciones.module.css";

interface Action {
  id: number;
  nombre: string;
  id_miembro: number | null;
  miembro_nombre: string | null;
}

interface MemberInfo {
  id: number;
  nombre: string;
  id_fuente: number | null;
  fuente_nombre: string | null;
}

// Icons
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UnlinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const ZapIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
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

export default function MisAccionesPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();

  const [memberInfo, setMemberInfo] = useState<MemberInfo | null>(null);
  const [myActions, setMyActions] = useState<Action[]>([]);
  const [availableActions, setAvailableActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    nombre: "",
    assignToMe: true,
  });

  // Edit form
  const [editForm, setEditForm] = useState({ nombre: "" });

  // Check access
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profile?.rol !== "miembro")) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Fetch actions
  const fetchActions = async () => {
    try {
      const response = await fetch("/api/member/actions");
      const data = await response.json();

      if (response.ok) {
        setMemberInfo(data.memberInfo);
        setMyActions(data.myActions || []);
        setAvailableActions(data.availableActions || []);
        setError(null);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error("Error fetching actions:", err);
      setError("Error al cargar las acciones");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && profile?.rol === "miembro") {
      fetchActions();
    }
  }, [isAuthenticated, profile]);

  const handleCreateAction = async () => {
    if (!createForm.nombre.trim()) {
      setMessage({ type: "error", text: "El nombre es requerido" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/member/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: createForm.nombre.trim(),
          assignToMe: createForm.assignToMe,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Accion creada exitosamente" });
        setCreateForm({ nombre: "", assignToMe: true });
        await fetchActions();
        setTimeout(() => {
          setShowCreateModal(false);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al crear" });
      }
    } catch (err) {
      console.error("Error creating action:", err);
      setMessage({ type: "error", text: "Error al crear la accion" });
    }
    setSaving(false);
  };

  const handleAssignAction = async (actionId: number, assign: boolean) => {
    try {
      const response = await fetch("/api/member/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, assign }),
      });

      const data = await response.json();

      if (response.ok) {
        await fetchActions();
      } else {
        alert(data.error || "Error al actualizar");
      }
    } catch (err) {
      console.error("Error updating action:", err);
      alert("Error al actualizar la accion");
    }
  };

  const handleDeleteAction = async () => {
    if (!selectedAction) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/member/actions?id=${selectedAction.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Accion eliminada" });
        await fetchActions();
        setTimeout(() => {
          setShowDeleteModal(false);
          setSelectedAction(null);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al eliminar" });
      }
    } catch (err) {
      console.error("Error deleting action:", err);
      setMessage({ type: "error", text: "Error al eliminar la accion" });
    }
    setSaving(false);
  };

  const handleRenameAction = async () => {
    if (!selectedAction) return;
    if (!editForm.nombre.trim()) {
      setMessage({ type: "error", text: "El nombre es requerido" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/member/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId: selectedAction.id, nombre: editForm.nombre.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Accion renombrada exitosamente" });
        await fetchActions();
        setTimeout(() => {
          setShowEditModal(false);
          setSelectedAction(null);
          setMessage(null);
        }, 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al renombrar" });
      }
    } catch (err) {
      console.error("Error renaming action:", err);
      setMessage({ type: "error", text: "Error al renombrar la accion" });
    }
    setSaving(false);
  };

  const handleCardClick = (action: Action) => {
    setSelectedAction((prev) => (prev?.id === action.id ? null : action));
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

  if (!isAuthenticated || profile?.rol !== "miembro") {
    return null;
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <header className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Mis Acciones</h1>
            <p className={styles.pageSubtitle}>
              {memberInfo?.fuente_nombre
                ? `Gestiona las acciones de ${memberInfo.fuente_nombre}`
                : "Gestiona tus acciones disponibles"}
            </p>
          </div>
          <button
            className={styles.primaryButton}
            onClick={() => setShowCreateModal(true)}
            disabled={!memberInfo?.id_fuente}
          >
            <PlusIcon />
            Nueva Accion
          </button>
        </header>

        {/* Error message */}
        {error && (
          <div className={styles.errorBanner}>
            {error}
          </div>
        )}

        {/* No source assigned */}
        {!memberInfo?.id_fuente && (
          <div className={styles.noSourceBanner}>
            <ZapIcon />
            <h3>Sin area asignada</h3>
            <p>Contacta al administrador para que te asigne un area/fuente para poder gestionar acciones.</p>
          </div>
        )}

        {memberInfo?.id_fuente && (
          <>
            {/* My Actions Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  Mis Acciones Asignadas
                  {myActions.length > 0 && (
                    <span className={styles.badge}>{myActions.length}</span>
                  )}
                </h2>
              </div>

              {/* Toolbar */}
              <div className={styles.toolbar}>
                <div className={styles.toolbarInfo}>
                  {selectedAction && myActions.some((a) => a.id === selectedAction.id)
                    ? `Seleccionada: ${selectedAction.nombre}`
                    : "Selecciona una accion"}
                </div>
                <div className={styles.toolbarActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={!selectedAction || !myActions.some((a) => a.id === selectedAction.id)}
                    onClick={() => {
                      if (selectedAction) {
                        setEditForm({ nombre: selectedAction.nombre });
                        setShowEditModal(true);
                        setMessage(null);
                      }
                    }}
                  >
                    <EditIcon />
                    Editar
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={!selectedAction || !myActions.some((a) => a.id === selectedAction.id)}
                    onClick={() => {
                      if (selectedAction) {
                        setShowDeleteModal(true);
                        setMessage(null);
                      }
                    }}
                  >
                    <TrashIcon />
                    Eliminar
                  </button>
                </div>
              </div>

              <div className={styles.sectionBody}>
                {myActions.length > 0 ? (
                  <div className={styles.actionsGrid}>
                    {myActions.map((action) => (
                      <div
                        key={action.id}
                        className={`${styles.actionCard} ${styles.actionCardMine} ${styles.actionCardSelectable} ${selectedAction?.id === action.id ? styles.actionCardSelected : ""}`}
                        onClick={() => handleCardClick(action)}
                      >
                        <h3 className={styles.actionName}>{action.nombre}</h3>
                        <div className={styles.actionFooter}>
                          <button
                            className={styles.actionBtnWarning}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignAction(action.id, false);
                            }}
                          >
                            <UnlinkIcon />
                            Desasignar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <ZapIcon />
                    <p>No tienes acciones asignadas</p>
                    <span>Crea una nueva o asignate una disponible</span>
                  </div>
                )}
              </div>
            </section>

            {/* Available Actions Section */}
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>
                  Acciones Disponibles
                  {availableActions.length > 0 && (
                    <span className={styles.badgeSecondary}>{availableActions.length}</span>
                  )}
                </h2>
              </div>

              {/* Toolbar */}
              <div className={styles.toolbar}>
                <div className={styles.toolbarInfo}>
                  {selectedAction && availableActions.some((a) => a.id === selectedAction.id)
                    ? `Seleccionada: ${selectedAction.nombre}`
                    : "Selecciona una accion"}
                </div>
                <div className={styles.toolbarActions}>
                  <button
                    className={styles.secondaryButton}
                    disabled={!selectedAction || !availableActions.some((a) => a.id === selectedAction.id)}
                    onClick={() => {
                      if (selectedAction) {
                        setEditForm({ nombre: selectedAction.nombre });
                        setShowEditModal(true);
                        setMessage(null);
                      }
                    }}
                  >
                    <EditIcon />
                    Editar
                  </button>
                  <button
                    className={styles.dangerButton}
                    disabled={!selectedAction || !availableActions.some((a) => a.id === selectedAction.id)}
                    onClick={() => {
                      if (selectedAction) {
                        setShowDeleteModal(true);
                        setMessage(null);
                      }
                    }}
                  >
                    <TrashIcon />
                    Eliminar
                  </button>
                </div>
              </div>

              <div className={styles.sectionBody}>
                {availableActions.length > 0 ? (
                  <div className={styles.actionsGrid}>
                    {availableActions.map((action) => (
                      <div
                        key={action.id}
                        className={`${styles.actionCard} ${styles.actionCardSelectable} ${selectedAction?.id === action.id ? styles.actionCardSelected : ""}`}
                        onClick={() => handleCardClick(action)}
                      >
                        <h3 className={styles.actionName}>{action.nombre}</h3>
                        <div className={styles.actionFooter}>
                          <button
                            className={styles.actionBtnSuccess}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAssignAction(action.id, true);
                            }}
                          >
                            <CheckIcon />
                            Asignarme
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyStateSmall}>
                    <p>No hay acciones disponibles sin asignar</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className={styles.modalOverlay} onClick={() => !saving && setShowCreateModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Nueva Accion</h3>
                <button
                  className={styles.iconButton}
                  onClick={() => !saving && setShowCreateModal(false)}
                >
                  <CloseIcon />
                </button>
              </div>

              {message && (
                <div className={`${styles.modalMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nombre *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={createForm.nombre}
                    onChange={(e) => setCreateForm({ ...createForm, nombre: e.target.value })}
                    placeholder="Nombre de la accion"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formCheckbox}>
                    <input
                      type="checkbox"
                      checked={createForm.assignToMe}
                      onChange={(e) => setCreateForm({ ...createForm, assignToMe: e.target.checked })}
                    />
                    Asignarme esta accion automaticamente
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowCreateModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleCreateAction}
                  disabled={saving}
                >
                  {saving ? "Creando..." : "Crear Accion"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Modal */}
        {showDeleteModal && selectedAction && (
          <div className={styles.modalOverlay} onClick={() => !saving && setShowDeleteModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Eliminar Accion</h3>
                <button
                  className={styles.iconButton}
                  onClick={() => !saving && setShowDeleteModal(false)}
                >
                  <CloseIcon />
                </button>
              </div>

              {message && (
                <div className={`${styles.modalMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <div className={styles.modalBody}>
                <div className={styles.deleteWarning}>
                  <p>Estas seguro de eliminar la accion:</p>
                  <strong>{selectedAction.nombre}</strong>
                  <p className={styles.deleteNote}>Esta accion no se puede deshacer.</p>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowDeleteModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className={styles.dangerButton}
                  onClick={handleDeleteAction}
                  disabled={saving}
                >
                  {saving ? "Eliminando..." : "Eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Edit Modal */}
        {showEditModal && selectedAction && (
          <div className={styles.modalOverlay} onClick={() => !saving && setShowEditModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Editar Accion</h3>
                <button
                  className={styles.iconButton}
                  onClick={() => !saving && setShowEditModal(false)}
                >
                  <CloseIcon />
                </button>
              </div>

              {message && (
                <div className={`${styles.modalMessage} ${styles[message.type]}`}>
                  {message.text}
                </div>
              )}

              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Nombre *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={editForm.nombre}
                    onChange={(e) => setEditForm({ nombre: e.target.value })}
                    placeholder="Nombre de la accion"
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  className={styles.primaryButton}
                  onClick={handleRenameAction}
                  disabled={saving}
                >
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
