"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Admin.module.css";

interface Miembro {
  id: number;
  nombre: string;
  puesto: string;
  descripcion: string | null;
  foto: string | null;
  costo: number;
  correo: string | null;
  celular: string | null;
  id_fuente: number | null;
  fuente_nombre?: string;
  created_at: string;
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

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const UserMinusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="8.5" cy="7" r="4" />
    <line x1="23" y1="11" x2="17" y2="11" />
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const DollarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const ImageIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

type ModalMode = "view" | "edit" | "remove";

export default function MiembrosPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [fuentes, setFuentes] = useState<Fuente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal states
  const [selectedMiembro, setSelectedMiembro] = useState<Miembro | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>("view");
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [form, setForm] = useState({
    nombre: "",
    puesto: "",
    descripcion: "",
    foto: "",
    costo: 0,
    correo: "",
    celular: "",
    id_fuente: "",
  });

  // Remove member form
  const [removeForm, setRemoveForm] = useState({
    keepRecord: true,
  });

  // Check if user is admin
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || profile?.rol !== "admin")) {
      router.push("/dashboard");
    }
  }, [authLoading, isAuthenticated, profile, router]);

  // Fetch miembros
  const fetchMiembros = async () => {
    try {
      const response = await fetch("/api/admin/miembros");
      if (response.ok) {
        const data = await response.json();
        setMiembros(data.miembros || []);
      }
    } catch (error) {
      console.error("Error fetching miembros:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && profile?.rol === "admin") {
      fetchMiembros();
    }
  }, [isAuthenticated, profile]);

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

  const filteredMiembros = miembros.filter((m) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      m.nombre.toLowerCase().includes(searchLower) ||
      m.puesto.toLowerCase().includes(searchLower) ||
      m.correo?.toLowerCase().includes(searchLower)
    );
  });

  const openModal = (miembro: Miembro, mode: ModalMode) => {
    setSelectedMiembro(miembro);
    setModalMode(mode);
    setMessage(null);

    if (mode === "remove") {
      setRemoveForm({ keepRecord: true });
    } else {
      setForm({
        nombre: miembro.nombre || "",
        puesto: miembro.puesto || "",
        descripcion: miembro.descripcion || "",
        foto: miembro.foto || "",
        costo: miembro.costo || 0,
        correo: miembro.correo || "",
        celular: miembro.celular || "",
        id_fuente: miembro.id_fuente?.toString() || "",
      });
    }
  };

  const closeModal = () => {
    setSelectedMiembro(null);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!form.nombre.trim() || !form.puesto.trim()) {
      setMessage({ type: "error", text: "Nombre y puesto son requeridos" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/miembros/${selectedMiembro?.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          puesto: form.puesto.trim(),
          descripcion: form.descripcion.trim() || null,
          foto: form.foto.trim() || null,
          costo: form.costo || 0,
          correo: form.correo.trim() || null,
          celular: form.celular.trim() || null,
          id_fuente: form.id_fuente ? parseInt(form.id_fuente) : null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: "success", text: "Miembro actualizado correctamente" });
        await fetchMiembros();
        setTimeout(() => closeModal(), 1500);
      } else {
        setMessage({ type: "error", text: data.error || "Error al guardar" });
      }
    } catch (error) {
      console.error("Error saving miembro:", error);
      setMessage({ type: "error", text: "Error al guardar miembro" });
    }
    setSaving(false);
  };

  const handleRemoveMember = async () => {
    if (!selectedMiembro) return;

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/miembros/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          miembroId: selectedMiembro.id,
          keepRecord: removeForm.keepRecord,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.warning) {
          setMessage({ type: "error", text: data.message });
        } else if (data.success) {
          setMessage({ type: "success", text: data.message });
          await fetchMiembros();
          setTimeout(() => closeModal(), 1500);
        } else {
          setMessage({ type: "error", text: data.message || "No se pudo completar la operacion" });
        }
      } else {
        setMessage({ type: "error", text: data.error || "Error al remover miembro" });
      }
    } catch (error) {
      console.error("Error removing member:", error);
      setMessage({ type: "error", text: "Error al remover miembro" });
    }
    setSaving(false);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMiembro) return;

    setUploadingPhoto(true);
    setMessage(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);
      formDataUpload.append("miembroId", selectedMiembro.id.toString());

      const response = await fetch("/api/upload/member", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      setForm((prev) => ({ ...prev, foto: data.url }));
      setMessage({ type: "success", text: "Foto subida correctamente" });
      await fetchMiembros();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error al subir la imagen";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const getInitials = (nombre: string) => {
    return nombre
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
            <h1 className={styles.pageTitle}>Gestion de Miembros</h1>
            <p className={styles.pageSubtitle}>Administra los miembros del equipo</p>
          </div>
        </header>

        {/* Main Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Miembros ({miembros.length})</h2>
          </div>
          <div className={styles.sectionBody}>
            {/* Search */}
            <div className={styles.filtersBar}>
              <input
                type="text"
                placeholder="Buscar por nombre, puesto o correo..."
                className={styles.searchInput}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Members Table */}
            {filteredMiembros.length > 0 ? (
              <table className={styles.usersTable}>
                <thead>
                  <tr>
                    <th>Miembro</th>
                    <th>Puesto</th>
                    <th>Contacto</th>
                    <th>Costo/hr</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMiembros.map((miembro) => (
                    <tr key={miembro.id}>
                      <td>
                        <div className={styles.userRow}>
                          <div className={styles.userAvatar}>
                            {miembro.foto ? (
                              <img src={miembro.foto} alt={miembro.nombre} />
                            ) : (
                              getInitials(miembro.nombre)
                            )}
                          </div>
                          <div className={styles.userInfo}>
                            <span className={styles.userName}>{miembro.nombre}</span>
                            {miembro.fuente_nombre && (
                              <span className={styles.userEmail}>{miembro.fuente_nombre}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles.badgeMiembro}`}>
                          {miembro.puesto}
                        </span>
                      </td>
                      <td>
                        <div className={styles.contactInfo}>
                          {miembro.correo && (
                            <span className={styles.contactItem}>
                              <MailIcon />
                              {miembro.correo}
                            </span>
                          )}
                          {miembro.celular && (
                            <span className={styles.contactItem}>
                              <PhoneIcon />
                              {miembro.celular}
                            </span>
                          )}
                          {!miembro.correo && !miembro.celular && "—"}
                        </div>
                      </td>
                      <td>
                        <span className={styles.costValue}>
                          {formatCurrency(miembro.costo || 0)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.actionButtons}>
                          <button
                            className={styles.iconButton}
                            onClick={() => openModal(miembro, "view")}
                            title="Ver detalles"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            className={styles.iconButton}
                            onClick={() => openModal(miembro, "edit")}
                            title="Editar"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className={`${styles.iconButton} ${styles.iconButtonWarning}`}
                            onClick={() => openModal(miembro, "remove")}
                            title="Quitar de miembro"
                          >
                            <UserMinusIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <UsersIcon />
                <p>{search ? "No se encontraron miembros" : "No hay miembros registrados"}</p>
              </div>
            )}
          </div>
        </section>

        {/* Modal */}
        {selectedMiembro && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  {modalMode === "view" && "Detalles del Miembro"}
                  {modalMode === "edit" && "Editar Miembro"}
                  {modalMode === "remove" && "Quitar Miembro"}
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
                {/* View Mode */}
                {modalMode === "view" && selectedMiembro && (
                  <>
                    <div className={styles.modalUserHeader}>
                      <div className={styles.modalUserAvatar}>
                        {selectedMiembro.foto ? (
                          <img src={selectedMiembro.foto} alt={selectedMiembro.nombre} />
                        ) : (
                          getInitials(selectedMiembro.nombre)
                        )}
                      </div>
                      <div className={styles.modalUserInfo}>
                        <h4>{selectedMiembro.nombre}</h4>
                        <p>{selectedMiembro.puesto}</p>
                      </div>
                    </div>

                    <div className={styles.modalDetails}>
                      {selectedMiembro.descripcion && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Descripcion</span>
                          <span className={styles.detailValue}>{selectedMiembro.descripcion}</span>
                        </div>
                      )}
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Correo</span>
                        <span className={styles.detailValue}>{selectedMiembro.correo || "—"}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Telefono</span>
                        <span className={styles.detailValue}>{selectedMiembro.celular || "—"}</span>
                      </div>
                      <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Costo por hora</span>
                        <span className={styles.detailValue}>{formatCurrency(selectedMiembro.costo || 0)}</span>
                      </div>
                      {selectedMiembro.fuente_nombre && (
                        <div className={styles.detailRow}>
                          <span className={styles.detailLabel}>Area</span>
                          <span className={styles.detailValue}>{selectedMiembro.fuente_nombre}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Edit Mode */}
                {modalMode === "edit" && (
                  <div className={styles.modalForm}>
                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Nombre *</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={form.nombre}
                          onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                          placeholder="Nombre completo"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Puesto *</label>
                        <input
                          type="text"
                          className={styles.formInput}
                          value={form.puesto}
                          onChange={(e) => setForm({ ...form, puesto: e.target.value })}
                          placeholder="Ej: Desarrollador"
                        />
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Descripcion</label>
                      <textarea
                        className={styles.formTextarea}
                        value={form.descripcion}
                        onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                        placeholder="Breve descripcion..."
                        rows={3}
                      />
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Correo</label>
                        <input
                          type="email"
                          className={styles.formInput}
                          value={form.correo}
                          onChange={(e) => setForm({ ...form, correo: e.target.value })}
                          placeholder="correo@ejemplo.com"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Telefono</label>
                        <input
                          type="tel"
                          className={styles.formInput}
                          value={form.celular}
                          onChange={(e) => setForm({ ...form, celular: e.target.value })}
                          placeholder="+593 999 999 999"
                        />
                      </div>
                    </div>

                    <div className={styles.formRow}>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Costo por hora (USD)</label>
                        <input
                          type="number"
                          className={styles.formInput}
                          value={form.costo}
                          onChange={(e) => setForm({ ...form, costo: parseFloat(e.target.value) || 0 })}
                          min="0"
                          step="10"
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Area</label>
                        <select
                          className={styles.formSelect}
                          value={form.id_fuente}
                          onChange={(e) => setForm({ ...form, id_fuente: e.target.value })}
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

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Foto del miembro</label>
                      <div className={styles.photoUploadArea}>
                        {form.foto ? (
                          <div className={styles.photoPreview}>
                            <img src={form.foto} alt="Foto del miembro" />
                            <button
                              type="button"
                              className={styles.photoRemoveBtn}
                              onClick={() => setForm({ ...form, foto: "" })}
                              title="Quitar foto"
                            >
                              <CloseIcon />
                            </button>
                          </div>
                        ) : (
                          <div className={styles.photoPlaceholder}>
                            <ImageIcon />
                            <span>Sin foto</span>
                          </div>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handlePhotoUpload}
                          style={{ display: "none" }}
                          disabled={uploadingPhoto}
                        />
                        <button
                          type="button"
                          className={styles.photoUploadBtn}
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingPhoto}
                        >
                          {uploadingPhoto ? (
                            <>
                              <div className={styles.miniSpinner} />
                              Subiendo...
                            </>
                          ) : (
                            <>
                              <CameraIcon />
                              {form.foto ? "Cambiar foto" : "Subir foto"}
                            </>
                          )}
                        </button>
                        <span className={styles.formHint}>JPG, PNG, WEBP o GIF. Máximo 5MB</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Remove Mode */}
                {modalMode === "remove" && (
                  <div className={styles.modalForm}>
                    <div className={styles.convertNotice} style={{ background: "rgba(251, 191, 36, 0.1)", borderColor: "rgba(251, 191, 36, 0.3)" }}>
                      <p style={{ color: "#d97706" }}>Quitar miembro</p>
                      <ul>
                        <li>Si hay un usuario vinculado, volvera a ser cliente</li>
                        <li>Si el miembro tiene tickets o proyectos, no se podra eliminar el registro</li>
                      </ul>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formCheckbox}>
                        <input
                          type="checkbox"
                          checked={removeForm.keepRecord}
                          onChange={(e) => setRemoveForm({ keepRecord: e.target.checked })}
                        />
                        Conservar el registro del miembro
                      </label>
                      <span className={styles.formHint}>
                        {removeForm.keepRecord
                          ? "Solo se desvinculara el usuario (si existe)"
                          : "Se intentara eliminar el registro (si no tiene referencias)"}
                      </span>
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
                    <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                      Cancelar
                    </button>
                    <button className={styles.primaryButton} onClick={handleSave} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </button>
                  </>
                )}
                {modalMode === "remove" && (
                  <>
                    <button className={styles.secondaryButton} onClick={closeModal} disabled={saving}>
                      Cancelar
                    </button>
                    <button className={styles.warningButton} onClick={handleRemoveMember} disabled={saving}>
                      {saving ? "Procesando..." : "Quitar miembro"}
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
