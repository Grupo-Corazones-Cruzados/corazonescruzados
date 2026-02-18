"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Tickets.module.css";

interface Evento {
  id: number;
  created_at: string;
  nombre: string;
  descripcion: string | null;
  fecha: string;
  estado: string;
  creador_nombre: string;
  creador_apellido: string;
  total_invitados: string;
  total_participaron: string;
}

export default function EventosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCrearModal, setShowCrearModal] = useState(false);
  const [form, setForm] = useState({ nombre: "", descripcion: "", fecha: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchEventos = async () => {
    try {
      const res = await fetch("/api/reclutamiento/eventos");
      if (res.ok) {
        const data = await res.json();
        setEventos(data.eventos);
      } else if (res.status === 403) {
        router.push("/dashboard/proyecto/reclutamiento/encuadre");
      }
    } catch {
      // ignore
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchEventos();
    }
  }, [authLoading, user]);

  const handleCrear = async () => {
    if (!form.nombre || !form.fecha || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reclutamiento/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowCrearModal(false);
        setForm({ nombre: "", descripcion: "", fecha: "" });
        fetchEventos();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Error de conexión");
    }
    setSubmitting(false);
  };

  const estadoColors: Record<string, { bg: string; color: string }> = {
    activo: { bg: "rgba(34, 197, 94, 0.15)", color: "#22c55e" },
    finalizado: { bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
    cancelado: { bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.emptyState}>
            <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Eventos de Reclutamiento</h1>
            <p className={styles.pageSubtitle}>
              Gestiona eventos para evaluar aspirantes
            </p>
          </div>
          <button
            onClick={() => setShowCrearModal(true)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#00CED1",
              color: "#000",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            + Crear Evento
          </button>
        </div>

        {/* Events Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}>
          {eventos.length === 0 ? (
            <div className={styles.emptyState}>
              <h3 className={styles.emptyTitle}>No hay eventos</h3>
              <p className={styles.emptyText}>Crea un evento para comenzar el proceso de selección.</p>
            </div>
          ) : (
            eventos.map((ev) => (
              <div
                key={ev.id}
                onClick={() => router.push(`/dashboard/proyecto/reclutamiento/encuadre/eventos/${ev.id}`)}
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                  background: "var(--surface-1, #141414)",
                  cursor: "pointer",
                  transition: "transform 200ms ease, border-color 200ms ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.borderColor = "rgba(0, 206, 209, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.borderColor = "var(--border-color, rgba(255, 255, 255, 0.06))";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600, color: "var(--text-primary)" }}>
                    {ev.nombre}
                  </h3>
                  <span style={{
                    padding: "4px 10px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600,
                    background: estadoColors[ev.estado]?.bg || "rgba(156, 163, 175, 0.15)",
                    color: estadoColors[ev.estado]?.color || "#9ca3af",
                  }}>
                    {ev.estado}
                  </span>
                </div>

                {ev.descripcion && (
                  <p style={{
                    margin: "0 0 12px", fontSize: "0.85rem", color: "var(--text-secondary)",
                    lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                  }}>
                    {ev.descripcion}
                  </p>
                )}

                <div style={{ display: "flex", gap: "16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  <span>
                    {new Date(ev.fecha).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span>{ev.total_invitados} invitados</span>
                  <span>{ev.total_participaron} participaron</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCrearModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(20px)",
        }} onClick={() => setShowCrearModal(false)}>
          <div style={{
            width: "min(500px, 96vw)", borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #1A1A1A 0%, #141414 100%)",
            padding: "28px",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", color: "#FFF", fontSize: "1.1rem" }}>Crear Evento</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Nombre del evento"
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Descripción</label>
              <textarea
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                rows={3}
                placeholder="Descripción del evento"
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                  resize: "vertical", fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Fecha *</label>
              <input
                type="datetime-local"
                value={form.fecha}
                onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCrearModal(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "transparent", color: "var(--text-primary)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCrear}
                disabled={!form.nombre || !form.fecha || submitting}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "none",
                  background: !form.nombre || !form.fecha || submitting ? "rgba(0, 206, 209, 0.3)" : "#00CED1",
                  color: "#000", fontWeight: 600, cursor: !form.nombre || !form.fecha || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
