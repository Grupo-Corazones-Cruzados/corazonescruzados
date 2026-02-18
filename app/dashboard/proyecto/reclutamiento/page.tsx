"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Tickets.module.css";

interface Postulacion {
  id: number;
  created_at: string;
  motivo: string;
  id_usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  avatar_url: string | null;
  estado: string;
}

interface Aspirante {
  aspirante: any;
  puntuaciones: any;
  eventos: any[];
  restricciones: any[];
}

const CRITERIOS = [
  "valor", "coraje", "pureza", "fe", "paciencia",
  "seriedad", "empatia", "espontaneidad", "autonomia",
];

export default function ReclutamientoPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rol, setRol] = useState<"cliente" | "reclutador" | "admin" | null>(null);
  const [loading, setLoading] = useState(true);

  // Client state
  const [motivo, setMotivo] = useState("");
  const [postulado, setPostulado] = useState(false);
  const [restriccion, setRestricion] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reclutador/Admin state
  const [postulaciones, setPostulaciones] = useState<Postulacion[]>([]);
  const [selectedAspirante, setSelectedAspirante] = useState<Aspirante | null>(null);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [showRestriccionModal, setShowRestriccionModal] = useState(false);
  const [restriccionForm, setRestriccionForm] = useState({ tipo: "temporal", motivo: "", dias: 7 });
  const [restriccionTarget, setRestriccionTarget] = useState<number | null>(null);

  const determineRole = useCallback(async () => {
    try {
      const res = await fetch("/api/reclutamiento/postulaciones");
      if (res.ok) {
        const data = await res.json();
        setPostulaciones(data.postulaciones);
        if (user?.rol === "admin") {
          setRol("admin");
        } else {
          setRol("reclutador");
        }
      } else if (res.status === 403) {
        setRol("cliente");
      } else {
        setRol("cliente");
      }
    } catch {
      setRol("cliente");
    }
    setLoading(false);
  }, [user?.rol]);

  const checkClientStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/reclutamiento/postulaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "__check__" }),
      });
      const data = await res.json();
      if (res.status === 403 && data.restriccion) {
        setRestricion(data.restriccion);
      } else if (res.status === 400 && data.error === "Ya tienes una postulación activa") {
        setPostulado(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user) {
      determineRole();
    }
  }, [authLoading, user, determineRole]);

  useEffect(() => {
    if (rol === "cliente") {
      checkClientStatus();
    }
  }, [rol, checkClientStatus]);

  const handleSubmitPostulacion = async () => {
    if (!motivo.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/reclutamiento/postulaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setPostulado(true);
      } else {
        alert(data.error || "Error al enviar postulación");
      }
    } catch {
      alert("Error de conexión");
    }
    setSubmitting(false);
  };

  const handleVerPerfil = async (postulacionId: number) => {
    try {
      const res = await fetch(`/api/reclutamiento/aspirantes/${postulacionId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAspirante(data);
        setShowPerfilModal(true);
      }
    } catch {
      alert("Error al cargar perfil");
    }
  };

  const handleAplicarRestriccion = async () => {
    if (!restriccionTarget) return;
    try {
      const res = await fetch(`/api/reclutamiento/aspirantes/${restriccionTarget}/restriccion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "aplicar",
          tipo: restriccionForm.tipo,
          motivo: restriccionForm.motivo,
          dias: restriccionForm.tipo === "temporal" ? restriccionForm.dias : undefined,
        }),
      });
      if (res.ok) {
        setShowRestriccionModal(false);
        determineRole();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Error de conexión");
    }
  };

  const handleLevantarRestriccion = async (postulacionId: number, restriccionId: number) => {
    try {
      const res = await fetch(`/api/reclutamiento/aspirantes/${postulacionId}/restriccion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "levantar", id_restriccion: restriccionId }),
      });
      if (res.ok) {
        determineRole();
        if (showPerfilModal && selectedAspirante) {
          handleVerPerfil(postulacionId);
        }
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Error de conexión");
    }
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

  // === CLIENT VIEW ===
  if (rol === "cliente") {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.pageHeader}>
            <div>
              <h1 className={styles.pageTitle}>Reclutamiento y Selección</h1>
              <p className={styles.pageSubtitle}>Postúlate para ser parte del equipo</p>
            </div>
          </div>

          {restriccion ? (
            <div style={{
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              background: "rgba(239, 68, 68, 0.05)",
              textAlign: "center",
              marginTop: "24px",
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
              <h3 style={{ color: "#ef4444", margin: "16px 0 8px" }}>Postulación Restringida</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                {restriccion.tipo === "permanente"
                  ? "Tu acceso ha sido restringido permanentemente."
                  : `Tu acceso está restringido temporalmente hasta ${new Date(restriccion.fecha_expiracion).toLocaleDateString()}.`}
              </p>
              {restriccion.motivo && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: "8px" }}>
                  Motivo: {restriccion.motivo}
                </p>
              )}
            </div>
          ) : postulado ? (
            <div style={{
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              background: "rgba(34, 197, 94, 0.05)",
              textAlign: "center",
              marginTop: "24px",
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h3 style={{ color: "#22c55e", margin: "16px 0 8px" }}>Postulación Enviada</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Tu postulación ha sido recibida. Te contactaremos cuando haya novedades.
              </p>
            </div>
          ) : (
            <div style={{
              padding: "32px",
              borderRadius: "16px",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
              background: "var(--surface-1, #141414)",
              marginTop: "24px",
            }}>
              <h3 style={{ margin: "0 0 8px", color: "var(--text-primary)", fontSize: "1.1rem" }}>
                Mensaje de motivación
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0 0 16px" }}>
                Cuéntanos por qué te gustaría unirte al equipo. ({motivo.length}/2000)
              </p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={2000}
                rows={6}
                placeholder="Escribe tu mensaje de motivación..."
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)",
                  fontSize: "0.9rem",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
              <button
                onClick={handleSubmitPostulacion}
                disabled={!motivo.trim() || submitting}
                style={{
                  marginTop: "16px",
                  padding: "10px 24px",
                  borderRadius: "8px",
                  border: "none",
                  background: !motivo.trim() || submitting ? "rgba(0, 206, 209, 0.3)" : "#00CED1",
                  color: "#000",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: !motivo.trim() || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Enviando..." : "Enviar Postulación"}
              </button>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // === RECLUTADOR / ADMIN VIEW ===
  const activePostulaciones = postulaciones.filter((p) => p.estado === "activo");
  const restrictedPostulaciones = postulaciones.filter((p) => p.estado === "restringido");

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Reclutamiento y Selección</h1>
            <p className={styles.pageSubtitle}>
              Gestiona aspirantes y procesos de selección
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard/proyecto/reclutamiento/encuadre/eventos")}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1px solid rgba(0, 206, 209, 0.3)",
              background: "rgba(0, 206, 209, 0.1)",
              color: "#00CED1",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            Eventos
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "16px",
          marginTop: "24px",
        }}>
          {[
            { label: "Total Postulantes", value: postulaciones.length, color: "#00CED1" },
            { label: "Activos", value: activePostulaciones.length, color: "#22c55e" },
            { label: "Restringidos", value: restrictedPostulaciones.length, color: "#ef4444" },
          ].map((stat) => (
            <div key={stat.label} style={{
              padding: "20px",
              borderRadius: "12px",
              border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
              background: "var(--surface-1, #141414)",
            }}>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {stat.label}
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "1.8rem", fontWeight: 700, color: stat.color }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Aspirantes Table */}
        <div style={{
          marginTop: "24px",
          borderRadius: "12px",
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
          background: "var(--surface-1, #141414)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
              Aspirantes ({postulaciones.length})
            </h3>
          </div>

          {postulaciones.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No hay postulaciones aún
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Aspirante", "Motivo", "Fecha", "Estado", "Acciones"].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {postulaciones.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.03))" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "var(--surface-2, #1A1A1A)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)",
                            overflow: "hidden", flexShrink: 0,
                          }}>
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              (p.nombre?.[0] || p.email[0]).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                              {[p.nombre, p.apellido].filter(Boolean).join(" ") || p.email}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-secondary)", maxWidth: 200 }}>
                        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.motivo}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          background: p.estado === "activo" ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
                          color: p.estado === "activo" ? "#22c55e" : "#ef4444",
                        }}>
                          {p.estado}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleVerPerfil(p.id)}
                            style={{
                              padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(0, 206, 209, 0.3)",
                              background: "transparent", color: "#00CED1", fontSize: "0.8rem", cursor: "pointer",
                            }}
                          >
                            Ver perfil
                          </button>
                          <button
                            onClick={() => {
                              setRestriccionTarget(p.id);
                              setShowRestriccionModal(true);
                            }}
                            style={{
                              padding: "6px 12px", borderRadius: "6px", border: "1px solid rgba(239, 68, 68, 0.3)",
                              background: "transparent", color: "#ef4444", fontSize: "0.8rem", cursor: "pointer",
                            }}
                          >
                            Restringir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Perfil Modal */}
      {showPerfilModal && selectedAspirante && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(20px)",
        }} onClick={() => setShowPerfilModal(false)}>
          <div style={{
            width: "min(800px, 96vw)", maxHeight: "88vh", overflow: "auto",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #1A1A1A 0%, #141414 100%)",
            padding: "28px",
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "var(--surface-2, #1A1A1A)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.2rem", fontWeight: 700, color: "var(--text-muted)",
                  overflow: "hidden", border: "2px solid rgba(255, 255, 255, 0.1)",
                }}>
                  {selectedAspirante.aspirante.avatar_url ? (
                    <img src={selectedAspirante.aspirante.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    (selectedAspirante.aspirante.nombre?.[0] || selectedAspirante.aspirante.email[0]).toUpperCase()
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "#FFF" }}>
                    {[selectedAspirante.aspirante.nombre, selectedAspirante.aspirante.apellido].filter(Boolean).join(" ") || selectedAspirante.aspirante.email}
                  </h2>
                  <p style={{ margin: "4px 0 0", color: "#8A8A8A", fontSize: "0.9rem" }}>{selectedAspirante.aspirante.email}</p>
                </div>
              </div>
              <button onClick={() => setShowPerfilModal(false)} style={{
                width: 36, height: 36, borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "transparent", color: "#FFF", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Motivo */}
            <div style={{
              padding: "16px", borderRadius: "12px",
              background: "rgba(0, 206, 209, 0.05)",
              border: "1px solid rgba(0, 206, 209, 0.15)",
              marginBottom: "20px",
            }}>
              <h4 style={{ margin: "0 0 8px", color: "#00CED1", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Motivación
              </h4>
              <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.9rem", lineHeight: 1.6 }}>
                {selectedAspirante.aspirante.motivo}
              </p>
            </div>

            {/* Puntuaciones */}
            {selectedAspirante.puntuaciones && Number(selectedAspirante.puntuaciones.total_evaluaciones) > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 12px", color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  Puntuaciones ({selectedAspirante.puntuaciones.total_evaluaciones} evaluaciones)
                </h4>
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px",
                }}>
                  {CRITERIOS.map((c) => {
                    const max = selectedAspirante.puntuaciones[`max_${c}`];
                    const min = selectedAspirante.puntuaciones[`min_${c}`];
                    const avg = selectedAspirante.puntuaciones[`avg_${c}`];
                    if (!max) return null;
                    return (
                      <div key={c} style={{
                        padding: "10px 14px", borderRadius: "8px",
                        background: "var(--surface-2, #1A1A1A)",
                        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                      }}>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "capitalize" }}>{c}</p>
                        <p style={{ margin: "4px 0 0", fontSize: "1.1rem", fontWeight: 700, color: "#00CED1" }}>
                          {avg}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                          min: {min} / max: {max}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Event History */}
            {selectedAspirante.eventos.length > 0 && (
              <div style={{ marginBottom: "20px" }}>
                <h4 style={{ margin: "0 0 12px", color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  Historial de Eventos
                </h4>
                {selectedAspirante.eventos.map((ev: any) => (
                  <div key={ev.id} style={{
                    padding: "10px 14px", borderRadius: "8px",
                    background: "var(--surface-2, #1A1A1A)",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                    marginBottom: "8px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                  }}>
                    <div>
                      <span style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9rem" }}>{ev.nombre}</span>
                      <span style={{ marginLeft: "10px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {new Date(ev.fecha).toLocaleDateString()}
                      </span>
                    </div>
                    <span style={{
                      padding: "4px 10px", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 500,
                      background: ev.participo ? "rgba(34, 197, 94, 0.15)" : "rgba(156, 163, 175, 0.15)",
                      color: ev.participo ? "#22c55e" : "#9ca3af",
                    }}>
                      {ev.participo ? "Participó" : "No participó"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Restricciones */}
            {selectedAspirante.restricciones.length > 0 && (
              <div>
                <h4 style={{ margin: "0 0 12px", color: "var(--text-primary)", fontSize: "0.95rem" }}>
                  Restricciones
                </h4>
                {selectedAspirante.restricciones.map((r: any) => (
                  <div key={r.id} style={{
                    padding: "10px 14px", borderRadius: "8px",
                    background: r.levantado ? "var(--surface-2, #1A1A1A)" : "rgba(239, 68, 68, 0.05)",
                    border: `1px solid ${r.levantado ? "var(--border-color, rgba(255, 255, 255, 0.06))" : "rgba(239, 68, 68, 0.2)"}`,
                    marginBottom: "8px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{
                          padding: "2px 8px", borderRadius: "9999px", fontSize: "0.7rem", fontWeight: 600,
                          background: r.tipo === "permanente" ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.15)",
                          color: r.tipo === "permanente" ? "#ef4444" : "#f59e0b",
                          marginRight: "8px",
                        }}>
                          {r.tipo}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>{r.motivo || "Sin motivo"}</span>
                        {r.levantado && (
                          <span style={{ marginLeft: "8px", fontSize: "0.75rem", color: "#22c55e" }}>
                            (Levantada)
                          </span>
                        )}
                      </div>
                      {!r.levantado && (
                        <button
                          onClick={() => handleLevantarRestriccion(selectedAspirante.aspirante.id, r.id)}
                          style={{
                            padding: "4px 10px", borderRadius: "6px",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                            background: "transparent", color: "#22c55e", fontSize: "0.75rem", cursor: "pointer",
                          }}
                        >
                          Levantar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restricción Modal */}
      {showRestriccionModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px",
          background: "rgba(0, 0, 0, 0.85)",
          backdropFilter: "blur(20px)",
        }} onClick={() => setShowRestriccionModal(false)}>
          <div style={{
            width: "min(480px, 96vw)", borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #1A1A1A 0%, #141414 100%)",
            padding: "28px",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", color: "#FFF", fontSize: "1.1rem" }}>Aplicar Restricción</h3>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Tipo</label>
              <select
                value={restriccionForm.tipo}
                onChange={(e) => setRestriccionForm({ ...restriccionForm, tipo: e.target.value })}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                }}
              >
                <option value="temporal">Temporal</option>
                {rol === "admin" && <option value="permanente">Permanente</option>}
              </select>
            </div>

            {restriccionForm.tipo === "temporal" && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Días</label>
                <input
                  type="number"
                  min={1}
                  value={restriccionForm.dias}
                  onChange={(e) => setRestriccionForm({ ...restriccionForm, dias: parseInt(e.target.value) || 1 })}
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                    background: "var(--surface-2, #1A1A1A)",
                    color: "var(--text-primary)", fontSize: "0.9rem",
                  }}
                />
              </div>
            )}

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Motivo (opcional)</label>
              <textarea
                value={restriccionForm.motivo}
                onChange={(e) => setRestriccionForm({ ...restriccionForm, motivo: e.target.value })}
                rows={3}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                  resize: "vertical", fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowRestriccionModal(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "transparent", color: "var(--text-primary)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleAplicarRestriccion}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "none", background: "#ef4444", color: "#FFF",
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
