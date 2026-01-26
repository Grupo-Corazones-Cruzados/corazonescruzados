"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/Profile.module.css";

// Icons
const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const MailIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const PhoneIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

export default function PerfilPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading, updateProfile, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    avatar_url: "",
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [authLoading, isAuthenticated, router]);

  // Initialize form data when profile loads
  useEffect(() => {
    if (profile) {
      setFormData({
        nombre: profile.nombre || "",
        apellido: profile.apellido || "",
        telefono: profile.telefono || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setMessage(null);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", file);

      const response = await fetch("/api/upload/avatar", {
        method: "POST",
        body: formDataUpload,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Error al subir la imagen");
      }

      setFormData((prev) => ({ ...prev, avatar_url: data.url }));
      setMessage({ type: "success", text: "Foto de perfil actualizada" });
      await refreshUser();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Error al subir la imagen";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setUploadingAvatar(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const result = await updateProfile({
        nombre: formData.nombre.trim() || null,
        apellido: formData.apellido.trim() || null,
        telefono: formData.telefono.trim() || null,
      });

      if (result.success) {
        setMessage({ type: "success", text: "Perfil actualizado correctamente" });
        setIsEditing(false);
        await refreshUser();
      } else {
        setMessage({ type: "error", text: result.error || "Error al actualizar el perfil" });
      }
    } catch {
      setMessage({ type: "error", text: "Error al actualizar el perfil" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setMessage(null);
    if (profile) {
      setFormData({
        nombre: profile.nombre || "",
        apellido: profile.apellido || "",
        telefono: profile.telefono || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  };

  const getInitials = () => {
    if (formData.nombre && formData.apellido) {
      return `${formData.nombre[0]}${formData.apellido[0]}`.toUpperCase();
    }
    if (profile?.email) {
      return profile.email[0].toUpperCase();
    }
    return "U";
  };

  const getRolLabel = (rol: string) => {
    switch (rol) {
      case "admin":
        return "Administrador";
      case "miembro":
        return "Miembro";
      case "cliente":
      default:
        return "Cliente";
    }
  };

  if (authLoading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando...</p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated || !profile) {
    return null;
  }

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Back Button */}
        <button className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeftIcon />
          Volver
        </button>

        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.title}>Mi Perfil</h1>
          <p className={styles.subtitle}>Administra tu informacion personal</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`${styles.message} ${styles[message.type]}`}>
            {message.type === "success" && <CheckIcon />}
            {message.text}
          </div>
        )}

        {/* Profile Card */}
        <div className={styles.profileCard}>
          {/* Avatar Section */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper}>
              {formData.avatar_url ? (
                <img src={formData.avatar_url} alt="Avatar" className={styles.avatar} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {getInitials()}
                </div>
              )}
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarUpload}
                style={{ display: "none" }}
                disabled={uploadingAvatar}
              />
              {/* Upload button - always visible */}
              <button
                type="button"
                className={styles.avatarEditBtn}
                title="Cambiar foto"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <div className={styles.miniSpinner} />
                ) : (
                  <CameraIcon />
                )}
              </button>
            </div>
            <div className={styles.avatarInfo}>
              <h2 className={styles.userName}>
                {formData.nombre || formData.apellido
                  ? `${formData.nombre} ${formData.apellido}`.trim()
                  : profile.email}
              </h2>
              <div className={styles.badges}>
                <span className={`${styles.badge} ${styles[`badge${profile.rol}`]}`}>
                  <ShieldIcon />
                  {getRolLabel(profile.rol)}
                </span>
                <span className={`${styles.badge} ${profile.verificado ? styles.badgeVerified : styles.badgeUnverified}`}>
                  {profile.verificado ? "Verificado" : "No verificado"}
                </span>
              </div>
              {/* Upload hint */}
              <p className={styles.uploadHint}>
                <UploadIcon />
                Haz clic en el icono de camara para cambiar tu foto
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGrid}>
              {/* Nombre */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <UserIcon />
                  Nombre
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Tu nombre"
                    autoComplete="given-name"
                  />
                ) : (
                  <p className={styles.value}>{formData.nombre || "—"}</p>
                )}
              </div>

              {/* Apellido */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <UserIcon />
                  Apellido
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="apellido"
                    value={formData.apellido}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Tu apellido"
                    autoComplete="family-name"
                  />
                ) : (
                  <p className={styles.value}>{formData.apellido || "—"}</p>
                )}
              </div>

              {/* Email (read-only) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <MailIcon />
                  Correo electronico
                </label>
                <p className={styles.value}>{profile.email}</p>
                {!isEditing && (
                  <span className={styles.hint}>El correo no se puede modificar</span>
                )}
              </div>

              {/* Telefono */}
              <div className={styles.formGroup}>
                <label className={styles.label}>
                  <PhoneIcon />
                  Telefono
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="+593 999 999 999"
                    autoComplete="tel"
                  />
                ) : (
                  <p className={styles.value}>{formData.telefono || "—"}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className={styles.actions}>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className={styles.saveButton}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setIsEditing(true)}
                >
                  Editar perfil
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Additional Info Card */}
        <div className={styles.infoCard}>
          <h3 className={styles.infoTitle}>Informacion de la cuenta</h3>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Estado de verificacion</span>
              <span className={`${styles.infoValue} ${profile.verificado ? styles.verified : styles.unverified}`}>
                {profile.verificado ? "Verificado" : "Pendiente de verificacion"}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Rol en el sistema</span>
              <span className={styles.infoValue}>{getRolLabel(profile.rol)}</span>
            </div>
            {profile.id_miembro && (
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>ID de miembro</span>
                <span className={styles.infoValue}>#{profile.id_miembro}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
