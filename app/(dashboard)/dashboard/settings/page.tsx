"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Link from "next/link";
import styles from "./page.module.css";

function getInitials(first?: string | null, last?: string | null) {
  return [first?.[0], last?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export default function SettingsPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when user loads
  if (!isLoading && user && !firstName && user.first_name) {
    setFirstName(user.first_name);
    setLastName(user.last_name || "");
    setPhone(user.phone || "");
  }

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "var(--space-20)" }}>
        <Spinner size="lg" />
      </div>
    );
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast("Solo se permiten archivos de imagen", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("La imagen debe ser menor a 5 MB", "error");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url } = await uploadRes.json();

      const profileRes = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: url }),
      });
      if (!profileRes.ok) throw new Error("Profile update failed");

      await refreshUser();
      toast("Foto de perfil actualizada", "success");
    } catch {
      toast("Error al subir la imagen", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          phone,
        }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      await refreshUser();
      toast("Perfil actualizado", "success");
    } catch {
      toast("Error al actualizar perfil", "error");
    } finally {
      setSaving(false);
    }
  };

  const isMemberWithoutPhone = user?.role === "member" && !user.phone;

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Administra tu perfil y preferencias."
      />

      {isMemberWithoutPhone && (
        <div className={styles.phoneBanner}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            Debes agregar tu número de teléfono para aparecer en la página pública y recibir contactos por WhatsApp.
          </span>
        </div>
      )}

      <div className={styles.grid}>
        {/* Profile */}
        <Card padding="lg">
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <button
              type="button"
              className={styles.avatarWrapper}
              onClick={handleAvatarClick}
              disabled={uploading}
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt="Avatar"
                  className={styles.avatarImg}
                />
              ) : (
                <span className={styles.avatarInitials}>
                  {getInitials(user?.first_name, user?.last_name)}
                </span>
              )}
              <span className={styles.avatarOverlay}>
                {uploading ? (
                  <Spinner size="sm" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <p className={styles.avatarHint}>Click para cambiar foto</p>
          </div>

          <h3 className={styles.cardTitle}>Perfil</h3>
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.row}>
              <Input
                label="Nombre"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <Input
                label="Apellido"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <Input
              label="Correo electrónico"
              value={user?.email || ""}
              disabled
              hint="El correo no se puede cambiar"
            />
            <Input
              label="Teléfono"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 ..."
            />
            <Button type="submit" isLoading={saving}>
              Guardar cambios
            </Button>
          </form>
        </Card>

        {/* Quick Links */}
        <div className={styles.sidebar}>
          {user?.role === "member" && (
            <>
              <Card padding="md" hover>
                <Link href="/dashboard/settings/availability" className={styles.sideLink}>
                  <span className={styles.sideLinkIcon}>📅</span>
                  <div>
                    <p className={styles.sideLinkTitle}>Disponibilidad</p>
                    <p className={styles.sideLinkDesc}>
                      Configura tus horarios de atención
                    </p>
                  </div>
                </Link>
              </Card>
              <Card padding="md" hover>
                <Link href="/dashboard/settings/cv" className={styles.sideLink}>
                  <span className={styles.sideLinkIcon}>📄</span>
                  <div>
                    <p className={styles.sideLinkTitle}>Mi CV</p>
                    <p className={styles.sideLinkDesc}>
                      Edita tu perfil profesional
                    </p>
                  </div>
                </Link>
              </Card>
              <Card padding="md" hover>
                <Link href="/dashboard/settings/portfolio" className={styles.sideLink}>
                  <span className={styles.sideLinkIcon}>🎨</span>
                  <div>
                    <p className={styles.sideLinkTitle}>Portafolio</p>
                    <p className={styles.sideLinkDesc}>
                      Administra tus proyectos destacados
                    </p>
                  </div>
                </Link>
              </Card>
            </>
          )}

          <Card padding="md">
            <h4 className={styles.infoTitle}>Información de la cuenta</h4>
            <div className={styles.infoList}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Rol</span>
                <span className={styles.infoValue}>
                  {user?.role === "admin"
                    ? "Administrador"
                    : user?.role === "member"
                    ? "Miembro"
                    : "Cliente"}
                </span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Verificado</span>
                <span className={styles.infoValue}>
                  {user?.is_verified ? "Sí" : "No"}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
