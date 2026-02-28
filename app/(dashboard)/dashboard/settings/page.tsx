"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import PageHeader from "@/components/layout/PageHeader";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Link from "next/link";
import styles from "./page.module.css";

export default function SettingsPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState(user?.first_name || "");
  const [lastName, setLastName] = useState(user?.last_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

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

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Administra tu perfil y preferencias."
      />

      <div className={styles.grid}>
        {/* Profile */}
        <Card padding="lg">
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
