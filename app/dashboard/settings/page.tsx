"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";

// Icons
const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" x2="21" y1="14" y2="3" />
  </svg>
);

function SettingsContent() {
  const searchParams = useSearchParams();
  const { user, profile } = useAuth();
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  const userRole = profile?.rol || "cliente";
  const isMember = userRole === "miembro" || userRole === "admin";

  // Check for success/error messages from OAuth
  const success = searchParams.get("success");
  const error = searchParams.get("error");

  useEffect(() => {
    const checkGoogleConnection = async () => {
      if (!user?.id) return;

      try {
        const response = await fetch("/api/google/status");
        const data = await response.json();
        setGoogleConnected(data.connected || false);
      } catch {
        setGoogleConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkGoogleConnection();
  }, [user?.id]);

  const handleConnectGoogle = () => {
    if (user?.id) {
      window.location.href = `/api/google/auth?userId=${user.id}`;
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch("/api/google/status", { method: "DELETE" });
      if (response.ok) {
        setGoogleConnected(false);
      }
    } catch (err) {
      console.error("Error disconnecting Google:", err);
    }
  };

  return (
    <DashboardLayout>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div className={ticketStyles.pageHeader}>
          <div>
            <h1 className={ticketStyles.pageTitle}>Configuración</h1>
            <p className={ticketStyles.pageSubtitle}>
              Administra tu cuenta y preferencias
            </p>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success === "google_connected" && (
          <div style={{
            padding: "var(--space-4)",
            background: "rgba(34, 197, 94, 0.15)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
            color: "#22c55e"
          }}>
            <CheckCircleIcon />
            <span>Google Calendar conectado exitosamente</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: "var(--space-4)",
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius-md)",
            marginBottom: "var(--space-6)",
            color: "#ef4444"
          }}>
            Error: {error.replace(/_/g, " ")}
          </div>
        )}

        {/* Profile Section */}
        <section style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)",
          marginBottom: "var(--space-6)"
        }}>
          <h2 style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "var(--space-4)"
          }}>
            Perfil
          </h2>

          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)" }}>Nombre</span>
              <span style={{ color: "var(--text-primary)" }}>{profile?.nombre} {profile?.apellido}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0", borderBottom: "1px solid var(--border-subtle)" }}>
              <span style={{ color: "var(--text-muted)" }}>Email</span>
              <span style={{ color: "var(--text-primary)" }}>{user?.email}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-3) 0" }}>
              <span style={{ color: "var(--text-muted)" }}>Rol</span>
              <span style={{ color: "var(--turquoise)", textTransform: "capitalize" }}>{profile?.rol}</span>
            </div>
          </div>
        </section>

        {/* Member Settings */}
        {isMember && (
          <>
            {/* Availability Link */}
            <section style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              marginBottom: "var(--space-6)"
            }}>
              <h2 style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "var(--space-4)"
              }}>
                Disponibilidad
              </h2>

              <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                Configura tus horarios de disponibilidad para que los clientes puedan reservar citas contigo.
              </p>

              <Link
                href="/dashboard/settings/availability"
                className={ticketStyles.primaryButton}
                style={{ display: "inline-flex" }}
              >
                <CalendarIcon />
                Configurar Disponibilidad
              </Link>
            </section>

            {/* Google Calendar Integration */}
            <section style={{
              background: "var(--surface-1)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "var(--space-5)",
              marginBottom: "var(--space-6)"
            }}>
              <h2 style={{
                fontSize: "1.1rem",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "var(--space-4)"
              }}>
                Google Calendar
              </h2>

              <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-4)" }}>
                Conecta tu Google Calendar para sincronizar citas automáticamente y crear reuniones con Google Meet.
              </p>

              {loading ? (
                <p style={{ color: "var(--text-muted)" }}>Verificando conexión...</p>
              ) : googleConnected ? (
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-4)",
                    background: "rgba(34, 197, 94, 0.15)",
                    borderRadius: "var(--radius-md)",
                    color: "#22c55e"
                  }}>
                    <CheckCircleIcon />
                    <span>Conectado</span>
                  </div>
                  <button
                    onClick={handleDisconnectGoogle}
                    className={ticketStyles.secondaryButton}
                  >
                    Desconectar
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleConnectGoogle}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-4)",
                    background: "white",
                    color: "#1f2937",
                    border: "1px solid #d1d5db",
                    borderRadius: "var(--radius-md)",
                    fontSize: "0.95rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all var(--transition-fast)"
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Conectar Google Calendar
                  <ExternalLinkIcon />
                </button>
              )}
            </section>
          </>
        )}

        {/* Quick Links */}
        <section style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          padding: "var(--space-5)"
        }}>
          <h2 style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "var(--space-4)"
          }}>
            Accesos Rápidos
          </h2>

          <div style={{ display: "grid", gap: "var(--space-2)" }}>
            <Link
              href="/dashboard/tickets"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                textDecoration: "none",
                transition: "all var(--transition-fast)"
              }}
            >
              <span>Mis Tickets</span>
              <ExternalLinkIcon />
            </Link>
            <Link
              href="/dashboard/projects"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                textDecoration: "none",
                transition: "all var(--transition-fast)"
              }}
            >
              <span>Mis Proyectos</span>
              <ExternalLinkIcon />
            </Link>
            <Link
              href="/dashboard/invoices"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "var(--space-3) var(--space-4)",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                color: "var(--text-primary)",
                textDecoration: "none",
                transition: "all var(--transition-fast)"
              }}
            >
              <span>Mis Facturas</span>
              <ExternalLinkIcon />
            </Link>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px"
      }}>
        <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
      </div>
    }>
      <SettingsContent />
    </Suspense>
  );
}
