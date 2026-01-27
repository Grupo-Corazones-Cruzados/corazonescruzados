"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useCreateProject } from "@/lib/hooks/useProjects";
import { useAuth } from "@/lib/AuthProvider";
import ticketStyles from "@/app/styles/Tickets.module.css";
import newTicketStyles from "@/app/styles/NewTicket.module.css";

// Icons
const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export default function NewProjectPage() {
  const router = useRouter();
  const { profile, isAuthenticated, loading: authLoading } = useAuth();
  const { createProject, loading: creating } = useCreateProject();

  const [clienteId, setClienteId] = useState<number | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(true);
  const [success, setSuccess] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<number | null>(null);

  // Form state
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [presupuestoMin, setPresupuestoMin] = useState("");
  const [presupuestoMax, setPresupuestoMax] = useState("");
  const [fechaLimite, setFechaLimite] = useState("");

  const userRole = profile?.rol || "cliente";

  // Redirect if not a client
  useEffect(() => {
    if (!authLoading && isAuthenticated && userRole !== "cliente" && userRole !== "admin") {
      router.push("/dashboard/projects");
    }
  }, [authLoading, isAuthenticated, userRole, router]);

  // Get or create client record
  useEffect(() => {
    const loadCliente = async () => {
      if (!isAuthenticated || !profile) return;

      try {
        const response = await fetch("/api/my-client");
        const data = await response.json();
        if (response.ok && data.clientId) {
          setClienteId(data.clientId);
        }
      } catch (error) {
        console.error("Error loading cliente:", error);
      } finally {
        setLoadingCliente(false);
      }
    };

    loadCliente();
  }, [isAuthenticated, profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clienteId || !titulo.trim()) return;

    const result = await createProject({
      id_cliente: clienteId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || undefined,
      presupuesto_min: presupuestoMin ? parseFloat(presupuestoMin) : undefined,
      presupuesto_max: presupuestoMax ? parseFloat(presupuestoMax) : undefined,
      fecha_limite: fechaLimite || undefined,
    });

    if (result.data && !result.error) {
      setSuccess(true);
      setCreatedProjectId(result.data.id);
    } else {
      alert(result.error || "Error al crear el proyecto");
    }
  };

  if (authLoading || loadingCliente) {
    return (
      <DashboardLayout>
        <div className={ticketStyles.loadingState}>
          <div className={ticketStyles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (success) {
    return (
      <DashboardLayout>
        <div className={newTicketStyles.page}>
          <div className={newTicketStyles.successState}>
            <div className={newTicketStyles.successIcon}>
              <CheckIcon />
            </div>
            <h2 className={newTicketStyles.successTitle}>Proyecto Publicado</h2>
            <p className={newTicketStyles.successText}>
              Tu proyecto ha sido publicado exitosamente. Los miembros podrán ver y postularse a tu proyecto.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <Link
                href={`/dashboard/projects/${createdProjectId}`}
                className={ticketStyles.primaryButton}
              >
                Ver Proyecto
              </Link>
              <Link
                href="/dashboard/projects"
                className={ticketStyles.secondaryButton}
              >
                Ir a Proyectos
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={newTicketStyles.page}>
        {/* Back Button */}
        <Link href="/dashboard/projects" className={newTicketStyles.backButton}>
          <ArrowLeftIcon />
          Volver a proyectos
        </Link>

        <h1 className={newTicketStyles.pageTitle}>Nuevo Proyecto</h1>
        <p className={newTicketStyles.pageSubtitle}>
          Publica tu proyecto y recibe postulaciones de miembros calificados
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: "var(--space-6)" }}>
          <div className={newTicketStyles.formSection}>
            <div className={newTicketStyles.formGroup}>
              <label className={newTicketStyles.formLabel}>Título del Proyecto *</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Desarrollo de aplicación móvil"
                className={newTicketStyles.formInput}
                required
              />
            </div>

            <div className={newTicketStyles.formGroup}>
              <label className={newTicketStyles.formLabel}>Descripción</label>
              <textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe los detalles de tu proyecto, objetivos, y cualquier información relevante..."
                className={newTicketStyles.formTextarea}
                rows={6}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div className={newTicketStyles.formGroup}>
                <label className={newTicketStyles.formLabel}>Presupuesto Mínimo (USD)</label>
                <input
                  type="number"
                  value={presupuestoMin}
                  onChange={(e) => setPresupuestoMin(e.target.value)}
                  placeholder="0.00"
                  className={newTicketStyles.formInput}
                  min="0"
                  step="0.01"
                />
              </div>

              <div className={newTicketStyles.formGroup}>
                <label className={newTicketStyles.formLabel}>Presupuesto Máximo (USD)</label>
                <input
                  type="number"
                  value={presupuestoMax}
                  onChange={(e) => setPresupuestoMax(e.target.value)}
                  placeholder="0.00"
                  className={newTicketStyles.formInput}
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className={newTicketStyles.formGroup}>
              <label className={newTicketStyles.formLabel}>Fecha Límite</label>
              <input
                type="date"
                value={fechaLimite}
                onChange={(e) => setFechaLimite(e.target.value)}
                className={newTicketStyles.formInput}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <div className={newTicketStyles.navigationButtons}>
            <Link href="/dashboard/projects" className={newTicketStyles.prevButton}>
              Cancelar
            </Link>
            <button
              type="submit"
              className={newTicketStyles.nextButton}
              disabled={creating || !titulo.trim()}
            >
              {creating ? "Publicando..." : "Publicar Proyecto"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
